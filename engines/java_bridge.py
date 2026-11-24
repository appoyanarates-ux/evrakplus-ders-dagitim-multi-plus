"""
Java Optimizasyon Motorları Köprüsü (java_bridge.py).
Gömülü paylaşımlı Java 21 JRE (resources/runtime/java/bin/java.exe) ile
Timefold Solver ve Choco Solver JAR'larını bağımsız alt süreç olarak çalıştırır.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_SOLVER_DIR = os.path.join(_ROOT, "solver")
for _p in (_ROOT, _SOLVER_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from validate_model import (  # noqa: E402
    build_time_intervals,
    compute_valid_starts_for_block,
    extract_grid_sets,
    get_block_physical_span,
    get_teacher_prefer_avoid_set,
    get_teacher_unavailable_set,
    resolve_fixed_assignments,
    validate_model,
)
from validate_result import validate_result  # noqa: E402
from quality_scorer import score_schedule  # noqa: E402
from pool_rooms import assign_pool_rooms  # noqa: E402


def find_java_exe() -> Optional[str]:
    env_j = os.environ.get("EVRAKPLUS_JAVA_EXE")
    if env_j and os.path.isfile(env_j):
        return env_j
    candidates = [
        os.path.join(_ROOT, "resources", "runtime", "java", "bin", "java.exe"),
        os.path.join(_ROOT, "resources", "runtime", "java", "bin", "java"),
    ]
    # Geliştirme ortamında D:\_build_cache\tools\jdk21
    jdk_root = r"D:\_build_cache\tools\jdk21"
    if os.path.isdir(jdk_root):
        for entry in os.listdir(jdk_root):
            candidates.append(os.path.join(jdk_root, entry, "bin", "java.exe"))
    for c in candidates:
        if os.path.isfile(c):
            return c
    return shutil.which("java")


def find_engine_jar(engine_key: str) -> Optional[str]:
    jar_map = {
        "timefold": ("timefold", "timefold-solver-runner.jar"),
        "choco": ("choco", "choco-solver-runner.jar"),
    }
    if engine_key not in jar_map:
        return None
    sub, name = jar_map[engine_key]
    env_var = f"EVRAKPLUS_{engine_key.upper()}_JAR"
    if os.environ.get(env_var) and os.path.isfile(os.environ[env_var]):
        return os.environ[env_var]
    candidates = [
        os.path.join(_ROOT, "resources", "engines", sub, name),
        os.path.join(_ROOT, "engines", sub, "target", name),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def health_check_java_engine(engine_key: str) -> Dict[str, Any]:
    java_exe = find_java_exe()
    jar_path = find_engine_jar(engine_key)
    engine_id = "timefold_solver" if engine_key == "timefold" else "choco_solver"
    display = "Timefold Solver" if engine_key == "timefold" else "Choco Solver"
    if not java_exe or not jar_path:
        return {
            "available": False,
            "engine": engine_id,
            "display_name": display,
            "version": "unavailable",
            "error": f"Java veya JAR bulunamadı (java={java_exe}, jar={jar_path}).",
        }
    try:
        out = subprocess.check_output(
            [java_exe, "-Xmx512m", "-jar", jar_path, "--health"],
            stderr=subprocess.PIPE,
            text=True,
            timeout=20,
        )
        for line in reversed(out.splitlines()):
            s = line.strip()
            if s.startswith("{") and s.endswith("}"):
                data = json.loads(s)
                data["java_executable"] = java_exe
                data["jar_path"] = jar_path
                return data
        return {"available": False, "engine": engine_id, "display_name": display, "version": "unknown", "error": "Geçersiz sağlık çıktısı"}
    except Exception as exc:
        return {"available": False, "engine": engine_id, "display_name": display, "version": "unavailable", "error": str(exc)}


def _build_java_payload(
    config: Dict[str, Any],
    initial_placements: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Ortak config JSON'unu Java motorlarının (Timefold & Choco) tüketeceği
    kanonik görev + aday listesi formatına çevirir.
    """
    time_grid = config.get("time_grid") or {}
    num_days, periods_per_day, blocked, common_elective, lunch_after, long_break_after = extract_grid_sets(time_grid)
    intervals = build_time_intervals(time_grid)
    classes = config.get("classes") or []
    teachers = config.get("teachers") or []
    rooms = config.get("rooms") or []
    assignments = config.get("assignments") or []

    class_map = {c["id"]: c for c in classes}
    room_map = {r["id"]: r for r in rooms}
    assignments_by_id = {a["assignment_id"]: a for a in assignments}
    rooms_by_type: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rooms:
        rooms_by_type[r.get("type") or "standard"].append(r)

    has_common_elective_courses = any(bool(a.get("use_common_elective_slot")) for a in assignments)
    enforce_common_exclusivity = bool(common_elective) and has_common_elective_courses
    teacher_unavail = {t["id"]: get_teacher_unavailable_set(t, num_days, periods_per_day) for t in teachers}
    teacher_avoid = {t["id"]: get_teacher_prefer_avoid_set(t, num_days, periods_per_day) for t in teachers}
    resolved_fixed, _ = resolve_fixed_assignments(config.get("fixed_assignments") or [], assignments_by_id)
    travel_min = int((config.get("school") or {}).get("building_travel_minutes") or 0)

    init_map: Dict[Tuple[str, int], Tuple[int, int]] = {}
    for pl in (initial_placements or []):
        if pl.get("assignment_id") is not None and pl.get("block_index") is not None:
            init_map[(str(pl["assignment_id"]), int(pl["block_index"]))] = (
                int(pl["day_index"]),
                int(pl["start_period"]),
            )

    def _get_asgn_building(asgn_obj: Dict[str, Any]) -> Optional[str]:
        rid = asgn_obj.get("room_id")
        if rid and rid in room_map and room_map[rid].get("building"):
            return str(room_map[rid]["building"]).strip()
        cid = asgn_obj["class_id"]
        if cid in class_map and class_map[cid].get("building"):
            return str(class_map[cid]["building"]).strip()
        return None

    tasks: List[Dict[str, Any]] = []
    for asgn in assignments:
        aid = asgn["assignment_id"]
        cid = asgn["class_id"]
        shift = class_map[cid].get("shift") or "full_day"
        t_ids = list(asgn.get("teacher_ids") or [])
        t_unavails = [teacher_unavail.get(tid, set()) for tid in t_ids]
        use_common = bool(asgn.get("use_common_elective_slot"))
        rtype = asgn.get("room_type") or "standard"
        rid = asgn.get("room_id")
        bldg = _get_asgn_building(asgn)

        for b_idx, blen in enumerate(asgn.get("blocks") or []):
            blen = int(blen)
            key = (aid, b_idx)
            fixed = resolved_fixed.get(key)
            pinned = fixed is not None
            if fixed:
                cands = [(int(fixed["day_index"]), int(fixed["start_period"]))]
            else:
                _, cands = compute_valid_starts_for_block(
                    length=blen,
                    num_days=num_days,
                    periods_per_day=periods_per_day,
                    blocked=blocked,
                    common_elective=common_elective,
                    use_common_elective=use_common,
                    enforce_common_elective_exclusivity=enforce_common_exclusivity,
                    lunch_after=lunch_after,
                    long_break_after=long_break_after,
                    class_shift=shift,
                    teacher_unavail_sets=t_unavails,
                )
            if not cands:
                return None, {
                    "code": "NO_CANDIDATE",
                    "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} (blok {b_idx + 1}) için uygun saat yok.",
                }

            cand_objs = []
            for d, p in cands:
                s_min, e_min = get_block_physical_span(intervals, shift, p, blen)
                avoid_cost = 0
                for tid in t_ids:
                    for k in range(blen):
                        if (d, p + k) in teacher_avoid.get(tid, set()):
                            avoid_cost += 6
                cand_objs.append({
                    "day_index": d,
                    "start_period": p,
                    "start_min": s_min,
                    "end_min": e_min,
                    "avoid_cost": avoid_cost,
                })

            t_obj: Dict[str, Any] = {
                "assignment_id": aid,
                "block_index": b_idx,
                "class_id": cid,
                "course_id": asgn.get("course_id") or "",
                "teacher_ids": t_ids,
                "room_id": rid,
                "room_type": rtype,
                "building": bldg,
                "length": blen,
                "max_blocks_per_day": int(asgn.get("max_blocks_per_day") or 1),
                "pinned": pinned,
                "candidates": cand_objs,
            }
            if key in init_map:
                t_obj["init_day"], t_obj["init_period"] = init_map[key]
            tasks.append(t_obj)

    req = config.get("solution_request") or {}
    payload = {
        "num_days": num_days,
        "periods_per_day": periods_per_day,
        "travel_min": travel_min,
        "time_limit_sec": float(req.get("time_limit_sec") or 15.0),
        "preference": str(req.get("preference") or "balanced"),
        "teacher_max_daily": {t["id"]: int(t.get("max_daily_hours") or periods_per_day) for t in teachers},
        "teacher_max_consec": {t["id"]: int(t.get("max_consecutive_hours") or 0) for t in teachers},
        "room_cap": {r["id"]: int(r.get("simultaneous_capacity") or 1) for r in rooms},
        "room_type_cap": {
            rt: sum(int(r.get("simultaneous_capacity") or 1) for r in rlist)
            for rt, rlist in rooms_by_type.items()
        },
        "tasks": tasks,
    }
    return payload, None


def solve_with_java_engine(
    engine_key: str,
    config: Dict[str, Any],
    initial_placements: Optional[List[Dict[str, Any]]] = None,
    max_heap_mb: int = 1024,
) -> Dict[str, Any]:
    t0 = time.perf_counter()
    engine_id = "timefold_solver" if engine_key == "timefold" else "choco_solver"
    java_exe = find_java_exe()
    jar_path = find_engine_jar(engine_key)
    if not java_exe or not jar_path:
        return {
            "engine": engine_id,
            "engine_version": "unavailable",
            "status": "ERROR",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": 0,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "JAVA_ENGINE_MISSING", "message": f"{engine_id} çalışma ortamı veya JAR bulunamadı."}],
            "warnings": [],
        }

    pre = validate_model(config)
    if not pre["valid"]:
        return {
            "engine": engine_id,
            "engine_version": "java",
            "status": "MODEL_INVALID",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": pre["errors"],
            "warnings": pre["warnings"],
        }

    payload, err = _build_java_payload(config, initial_placements=initial_placements)
    if err or payload is None:
        return {
            "engine": engine_id,
            "engine_version": "java",
            "status": "INFEASIBLE",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": [err or {"code": "NO_CANDIDATE", "message": "Uygun başlangıç saati yok."}],
            "warnings": pre["warnings"],
        }

    tmp_dir = tempfile.mkdtemp(prefix=f"evrakplus_{engine_key}_")
    in_path = os.path.join(tmp_dir, "in.json")
    out_path = os.path.join(tmp_dir, "out.json")
    try:
        with open(in_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)

        time_limit = float(payload["time_limit_sec"])
        proc = subprocess.run(
            [java_exe, f"-Xmx{int(max_heap_mb)}m", "-jar", jar_path, "--input", in_path, "--output", out_path],
            capture_output=True,
            text=True,
            timeout=max(15, int(time_limit) + 25),
        )
        if not os.path.isfile(out_path):
            return {
                "engine": engine_id,
                "engine_version": "java",
                "status": "ERROR",
                "solve_time_sec": round(time.perf_counter() - t0, 3),
                "placed_blocks": 0,
                "total_blocks": len(payload["tasks"]),
                "placements": [],
                "unplaced": [],
                "diagnostics": [{"code": "JAVA_EXEC_ERROR", "message": f"{engine_id} çıktı üretemedi (kod {proc.returncode}): {(proc.stderr or '')[:300]}"}],
                "warnings": pre["warnings"],
            }

        with open(out_path, "r", encoding="utf-8") as f:
            res = json.load(f)

        # Havuz derslik ataması + Bağımsız Doğrulama + Ortak Kalite Puanı
        placements = res.get("placements") or []
        if placements:
            time_grid = config.get("time_grid") or {}
            intervals = build_time_intervals(time_grid)
            classes_map = {c["id"]: c for c in (config.get("classes") or [])}
            assignments_by_id = {a["assignment_id"]: a for a in (config.get("assignments") or [])}
            rooms_by_type: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            for r in (config.get("rooms") or []):
                rooms_by_type[r.get("type") or "standard"].append(r)
            assign_pool_rooms(placements, assignments_by_id, rooms_by_type, classes_map, intervals)
            res["placements"] = placements

        res.setdefault("unplaced", [])
        res.setdefault("diagnostics", [])
        res["warnings"] = pre["warnings"]

        if placements:
            val = validate_result(config, res)
            res["validation"] = val
            res["quality"] = score_schedule(config, res, val)
            if not val["valid"]:
                res["status"] = "ERROR"
                res["diagnostics"] = val["errors"]
        else:
            res["validation"] = {"validator": "EvrakPlus Independent Schedule Validator", "valid": False, "classification": "INVALID", "errors": [], "stats": {}}
            res["quality"] = score_schedule(config, res, res["validation"])
        return res
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
