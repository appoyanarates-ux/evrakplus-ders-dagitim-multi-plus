"""
EvrakPlus Ders Dağıtım Multi Plus - Bağımsız Linux/VPS Optimizasyon Servisi (server.py)
Paylaşımlı cPanel sunucuları için harici asenkron 6-motorlu optimizasyon kuyruğu.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_SOLVER_DIR = os.path.join(_ROOT, "solver")
for _p in (_ROOT, _SOLVER_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from multi_solver_engine import health_check_all, run_multi_solver  # noqa: E402

API_KEY = os.environ.get("SOLVER_SERVER_API_KEY", "")
PORT = int(os.environ.get("PORT", "8787"))

JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


def _worker_run(job_id: str, config: Dict[str, Any]) -> None:
    with JOBS_LOCK:
        JOBS[job_id]["status"] = "RUNNING"
        JOBS[job_id]["started_at"] = time.time()
    try:
        res = run_multi_solver(config)
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "COMPLETED"
            JOBS[job_id]["result"] = res
            JOBS[job_id]["finished_at"] = time.time()
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "ERROR"
            JOBS[job_id]["error"] = str(exc)
            JOBS[job_id]["finished_at"] = time.time()


class SolverHandler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj: Any) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        if not API_KEY:
            return True
        return self.headers.get("X-API-Key", "") == API_KEY

    def do_GET(self) -> None:
        if self.path == "/v1/health":
            self._send(200, health_check_all())
            return
        if not self._authorized():
            self._send(401, {"ok": False, "error": "Yetkisiz erişim"})
            return
        if self.path.startswith("/v1/jobs/"):
            job_id = self.path.split("/v1/jobs/", 1)[1].strip("/")
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                self._send(404, {"ok": False, "error": "İş bulunamadı"})
                return
            self._send(200, job)
            return
        self._send(404, {"ok": False, "error": "Bilinmeyen uç nokta"})

    def do_POST(self) -> None:
        if not self._authorized():
            self._send(401, {"ok": False, "error": "Yetkisiz erişim"})
            return
        if self.path == "/v1/jobs":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw.decode("utf-8"))
            job_id = str(body.get("job_uuid") or uuid.uuid4().hex)
            cfg = body.get("config") or body
            with JOBS_LOCK:
                JOBS[job_id] = {"job_uuid": job_id, "status": "QUEUED", "created_at": time.time()}
            t = threading.Thread(target=_worker_run, args=(job_id, cfg), daemon=True)
            t.start()
            self._send(202, {"ok": True, "job_uuid": job_id, "status": "QUEUED"})
            return
        self._send(404, {"ok": False, "error": "Bilinmeyen uç nokta"})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), SolverHandler)
    print(f"EvrakPlus Multi Plus Solver Server listening on 0.0.0.0:{PORT}")
    srv.serve_forever()
