"""
EvrakPlus Ders Dagitim Multi Plus — Linux Optimizasyon Sunucusu (FastAPI)
Asenkron is kuyrugu, izole alt surec (worker process), bellek/zaman sinirlari,
Bearer token guvenligi ve 6 gercek motor (OR-Tools, Timefold, Choco, MiniZinc, SCIP, HiGHS) destegi.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[2]
API_TOKEN = os.environ.get("EVRAKPLUS_SOLVER_TOKEN", "")
MAX_CONCURRENT_JOBS = max(1, int(os.environ.get("EVRAKPLUS_MAX_WORKERS", "2")))

app = FastAPI(
    title="EvrakPlus Multi Plus Solver Server",
    version="1.0.0",
    description="6 gercek optimizasyon motorlu asenkron ders dagitim sunucusu"
)

executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS)

# In-memory job store (Redis varsa paralel durum senkronu eklenebilir)
JOBS: Dict[str, Dict[str, Any]] = {}
ACTIVE_PROCS: Dict[str, subprocess.Popen] = {}


def verify_token(authorization: Optional[str] = Header(default=None)):
    if not API_TOKEN:
        return True
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Yetkilendirme belirteci eksik.")
    token = authorization.split(" ", 1)[1].strip()
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail="Gecersiz API belirteci.")
    return True


def resolve_engine_commands() -> Dict[str, Dict[str, Any]]:
    py_bin = sys.executable
    java_candidates = [
        PROJECT_ROOT / "resources" / "runtime" / "java" / "bin" / "java.exe",
        PROJECT_ROOT / "resources" / "runtime" / "java" / "bin" / "java",
    ]
    java_bin = next((str(p) for p in java_candidates if p.exists()), shutil.which("java") or "java")

    mzn_candidates = [
        PROJECT_ROOT / "resources" / "engines" / "minizinc" / "minizinc.exe",
        PROJECT_ROOT / "resources" / "engines" / "minizinc" / "bin" / "minizinc",
    ]
    mzn_bin = next((str(p) for p in mzn_candidates if p.exists()), shutil.which("minizinc") or "minizinc")

    tf_jar = PROJECT_ROOT / "resources" / "engines" / "timefold" / "evrakplus-timefold.jar"
    ch_jar = PROJECT_ROOT / "resources" / "engines" / "choco" / "evrakplus-choco.jar"

    return {
        "ortools": {
            "name": "Google OR-Tools CP-SAT",
            "cmd": [py_bin, str(PROJECT_ROOT / "engines" / "ortools" / "solver_cpsat.py")],
            "version_cmd": [py_bin, str(PROJECT_ROOT / "engines" / "ortools" / "solver_cpsat.py"), "--version"],
            "available": (PROJECT_ROOT / "engines" / "ortools" / "solver_cpsat.py").exists(),
        },
        "timefold": {
            "name": "Timefold Solver",
            "cmd": [java_bin, "-Xmx1024m", "-jar", str(tf_jar)],
            "version_cmd": [java_bin, "-jar", str(tf_jar), "--version"],
            "available": tf_jar.exists(),
        },
        "choco": {
            "name": "Choco Solver",
            "cmd": [java_bin, "-Xmx1024m", "-jar", str(ch_jar)],
            "version_cmd": [java_bin, "-jar", str(ch_jar), "--version"],
            "available": ch_jar.exists(),
        },
        "minizinc": {
            "name": "MiniZinc (Gecode/Chuffed)",
            "cmd": [mzn_bin],
            "version_cmd": [mzn_bin, "--version"],
            "available": Path(mzn_bin).exists() or shutil.which("minizinc") is not None,
        },
        "scip": {
            "name": "SCIP (MILP)",
            "cmd": [py_bin, str(PROJECT_ROOT / "engines" / "scip" / "solver_scip.py")],
            "version_cmd": [py_bin, str(PROJECT_ROOT / "engines" / "scip" / "solver_scip.py"), "--version"],
            "available": (PROJECT_ROOT / "engines" / "scip" / "solver_scip.py").exists(),
        },
        "highs": {
            "name": "HiGHS (MIP/MILP)",
            "cmd": [py_bin, str(PROJECT_ROOT / "engines" / "highs" / "solver_highs.py")],
            "version_cmd": [py_bin, str(PROJECT_ROOT / "engines" / "highs" / "solver_highs.py"), "--version"],
            "available": (PROJECT_ROOT / "engines" / "highs" / "solver_highs.py").exists(),
        },
    }


class JobRequest(BaseModel):
    engine: str = Field(default="ortools")
    solverInput: Dict[str, Any]
    timeLimitSeconds: int = Field(default=30, ge=1, le=3600)


def _run_job_sync(job_id: str, engine_id: str, solver_input: Dict[str, Any], time_limit: int):
    job = JOBS[job_id]
    if job["status"] == "CANCELLED":
        return

    engines = resolve_engine_commands()
    spec = engines.get(engine_id)
    if not spec or not spec["available"]:
        job["status"] = "ERROR"
        job["error"] = f"Motor bulunamadi veya kurulu degil: {engine_id}"
        job["finishedAt"] = time.time()
        return

    job["status"] = "RUNNING"
    job["startedAt"] = time.time()

    payload = dict(solver_input)
    opts = dict(payload.get("options") or {})
    opts["timeLimitSeconds"] = time_limit
    payload["options"] = opts

    try:
        proc = subprocess.Popen(
            spec["cmd"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        ACTIVE_PROCS[job_id] = proc
        proc.stdin.write(json.dumps(payload, ensure_ascii=False))
        proc.stdin.close()

        final_result = None
        for line in proc.stdout:
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "INTERMEDIATE_SOLUTION":
                job["progress"] = {
                    "solutionsFound": msg.get("solutionsFound", 0),
                    "elapsedMs": msg.get("elapsedMs", 0),
                    "objectiveValue": msg.get("objectiveValue"),
                    "bestBound": msg.get("bestBound"),
                }
            elif msg.get("type") == "FINAL_RESULT":
                final_result = msg

        stderr_text = proc.stderr.read() if proc.stderr else ""
        proc.wait(timeout=max(10, time_limit + 15))
        ACTIVE_PROCS.pop(job_id, None)

        if job["status"] == "CANCELLED":
            job["finishedAt"] = time.time()
            return

        if final_result is None:
            job["status"] = "ERROR"
            job["error"] = stderr_text.strip() or f"Motor cikis kodu: {proc.returncode}"
        else:
            job["status"] = final_result.get("status", "UNKNOWN")
            job["result"] = final_result
            job["progress"]["elapsedMs"] = final_result.get("elapsedMs", int((time.time() - job["startedAt"]) * 1000))
        job["finishedAt"] = time.time()
    except Exception as exc:
        ACTIVE_PROCS.pop(job_id, None)
        if job["status"] != "CANCELLED":
            job["status"] = "ERROR"
            job["error"] = str(exc)
        job["finishedAt"] = time.time()


@app.get("/health")
def get_health():
    return {
        "ok": True,
        "service": "EvrakPlus Multi Plus Solver Server",
        "version": "1.0.0",
        "maxWorkers": MAX_CONCURRENT_JOBS,
        "activeJobs": len(ACTIVE_PROCS),
        "totalJobs": len(JOBS),
    }


@app.get("/engines")
def get_engines(_auth=Depends(verify_token)):
    specs = resolve_engine_commands()
    out = {}
    for eid, s in specs.items():
        ver = None
        healthy = False
        if s["available"]:
            try:
                r = subprocess.run(s["version_cmd"], capture_output=True, text=True, timeout=8)
                if r.returncode == 0:
                    healthy = True
                    lines = [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
                    json_line = next((ln for ln in reversed(lines) if ln.startswith("{")), None)
                    if json_line:
                        ver = json.loads(json_line).get("version")
                    elif lines:
                        ver = lines[0]
            except Exception:
                healthy = False
        out[eid] = {"name": s["name"], "available": s["available"], "healthy": healthy, "version": ver}
    return {"engines": out}


@app.post("/jobs", status_code=202)
async def create_job(req: JobRequest, _auth=Depends(verify_token)):
    engines = resolve_engine_commands()
    if req.engine not in engines or req.engine == "minizinc":
        # MiniZinc .dzn uretimi Node/JS tarafindan veya ayri uctan calisir; Python/Java motorlari dogrudan calisir
        if req.engine not in engines:
            raise HTTPException(status_code=400, detail=f"Bilinmeyen motor: {req.engine}")

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "id": job_id,
        "engine": req.engine,
        "status": "QUEUED",
        "createdAt": time.time(),
        "startedAt": None,
        "finishedAt": None,
        "progress": {"solutionsFound": 0, "elapsedMs": 0},
        "result": None,
        "error": None,
    }
    loop = asyncio.get_running_loop()
    loop.run_in_executor(executor, _run_job_sync, job_id, req.engine, req.solverInput, req.timeLimitSeconds)
    return {"id": job_id, "engine": req.engine, "status": "QUEUED"}


@app.get("/jobs/{job_id}")
def get_job(job_id: str, _auth=Depends(verify_token)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Is bulunamadi.")
    return {k: v for k, v in job.items() if k != "result"}


@app.get("/jobs/{job_id}/progress")
def get_job_progress(job_id: str, _auth=Depends(verify_token)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Is bulunamadi.")
    return {
        "id": job_id,
        "engine": job["engine"],
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
    }


@app.get("/jobs/{job_id}/result")
def get_job_result(job_id: str, _auth=Depends(verify_token)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Is bulunamadi.")
    return {
        "id": job_id,
        "engine": job["engine"],
        "status": job["status"],
        "result": job["result"],
        "error": job["error"],
    }


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, _auth=Depends(verify_token)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Is bulunamadi.")
    job["status"] = "CANCELLED"
    proc = ACTIVE_PROCS.pop(job_id, None)
    if proc and proc.poll() is None:
        try:
            proc.terminate()
        except Exception:
            pass
    return {"id": job_id, "status": "CANCELLED"}
