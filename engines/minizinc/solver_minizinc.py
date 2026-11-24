"""
Gerçek MiniZinc (Gecode / Chuffed) Ders Dağıtım Motoru (solver_minizinc.py).
Ortak JSON verisini gerçek .dzn dosyasına çevirir, gömülü minizinc.exe'yi
seçili arka uç çözücüyle (--solver gecode veya --solver chuffed) çalıştırır,
gerçekte kullanılan arka uç motorunu raporlar ve bağımsız doğrulamadan geçirir.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
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
    intervals_overlap,
    resolve_fixed_assignments,
    validate_model,
)
from validate_result import validate_result  # noqa: E402
from quality_scorer import score_schedule  # noqa: E402
from pool_rooms import assign_pool_rooms  # noqa: E402

ENGINE_NAME = "minizinc"


def emit_progress(phase: str, message: str) -> None:
    try:
        sys.stderr.write(json.dumps({"type": "progress", "engine": ENGINE_NAME, "phase": phase, "message": message}, ensure_ascii=False) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def find_minizinc_exe() -> Optional[str]:
    env_path = os.environ.get("EVRAKPLUS_MINIZINC_EXE")
    if env_path and os.path.isfile(env_path):
        return env_path
    candidates = [
        os.path.join(_ROOT, "resources", "engines", "minizinc", "minizinc.exe"),
        os.path.join(_ROOT, "resources", "engines", "minizinc", "bin", "minizinc.exe"),
        r"D:\_build_cache\tools\minizinc\minizinc.exe",
        r"D:\_build_cache\tools\minizinc\bin\minizinc.exe",
    ]
    # Alt klasörlerde ara (MiniZincIDE-*-win64/minizinc.exe)
    for base in (os.path.join(_ROOT, "resources", "engines", "minizinc"), r"D:\_build_cache\tools\minizinc"):
        if os.path.isdir(base):
            for entry in os.listdir(base):
                p1 = os.path.join(base, entry, "minizinc.exe")
                if os.path.isfile(p1):
                    candidates.insert(0, p1)
    for c in candidates:
        if os.path.isfile(c):
            return c
    return shutil.which("minizinc")


def find_mzn_model() -> str:
    env_m = os.environ.get("EVRAKPLUS_MZN_MODEL")
    if env_m and os.path.isfile(env_m):
        return env_m
    return os.path.join(_ROOT, "resources", "models", "timetable.mzn")


def get_minizinc_info() -> Tuple[Optional[str], str, List[str]]:
    exe = find_minizinc_exe()
    if not exe:
        return None, "unavailable", []
    version = "unknown"
    solvers: List[str] = []
    try:
        v_out = subprocess.check_output([exe, "--version"], stderr=subprocess.STDOUT, text=True, timeout=10)
        version = v_out.strip().splitlines()[0] if v_out.strip() else "unknown"
    except Exception:
        pass
    try:
        s_out = subprocess.check_output([exe, "--solvers-json"], stderr=subprocess.STDOUT, text=True, timeout=10)
        arr = json.loads(s_out)
        for item in arr:
            sid = str(item.get("id") or "")
            if sid:
                solvers.append(sid)
    except Exception:
        pass
    return exe, version, solvers


def health_check() -> Dict[str, Any]:
    exe, version, solvers = get_minizinc_info()
    model_path = find_mzn_model()
    available = bool(exe) and os.path.isfile(model_path)
    has_gecode = any("gecode" in s.lower() for s in solvers)
    has_chuffed = any("chuffed" in s.lower() for s in solvers)
    return {
        "available": available,
        "engine": ENGINE_NAME,
        "display_name": "MiniZinc (Gecode / Chuffed)",
        "version": version,
        "executable": exe,
        "backend_solvers": [s for s in ("gecode", "chuffed") if any(s in x.lower() for x in solvers)] or solvers[:5],
        "has_gecode": has_gecode,
        "has_chuffed": has_chuffed,
        "capabilities": {
            "dual_shift": True,
            "building_travel": True,
            "common_elective": True,
            "multi_teacher": True,
            "special_rooms": True,
            "max_consecutive": True,
            "warm_start": False,
        },
    }


def solve_with_minizinc(config: Dict[str, Any], backend: str = "gecode") -> Dict[str, Any]:
    t0 = time.perf_counter()
    exe, version, solvers = get_minizinc_info()
    model_path = find_mzn_model()
    if not exe or not os.path.isfile(model_path):
        return {
            "engine": ENGINE_NAME,
            "backend_solver": backend,
            "engine_version": version,
            "status": "ERROR",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": 0,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "MINIZINC_NOT_FOUND", "message": "MiniZinc yürütülebilir dosyası veya modeli bulunamadı."}],
            "warnings": [],
        }

    # Seçili arka uç yoksa mevcut ilk desteklenen arka uca geç (ve bunu açıkça raporla)
    chosen_backend = backend.lower()
    if not any(chosen_backend in s.lower() for s in solvers):
        if any("gecode" in s.lower() for s in solvers):
            chosen_backend = "gecode"
        elif any("chuffed" in s.lower() for s in solvers):
            chosen_backend = "chuffed"

    emit_progress("validating", f"MiniZinc ({chosen_backend}): Ön kontrol yapılıyor")
    pre = validate_model(config)
    if not pre["valid"]:
        return {
            "engine": ENGINE_NAME,
            "backend_solver": chosen_backend,
            "engine_version": f"{version} [{chosen_backend}]",
            "status": "MODEL_INVALID",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": pre["errors"],
            "warnings": pre["warnings"],
        }

    req = config.get("solution_request") or {}
    time_limit = float(req.get("time_limit_sec") or 30.0)
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

    def _get_asgn_building(asgn_obj: Dict[str, Any]) -> Optional[str]:
        rid = asgn_obj.get("room_id")
        if rid and rid in room_map and room_map[rid].get("building"):
            return str(room_map[rid]["building"]).strip()
        cid = asgn_obj["class_id"]
        if cid in class_map and class_map[cid].get("building"):
            return str(class_map[cid]["building"]).strip()
        return None

    # Görevler ve adaylar (1-tabanlı)
    tasks_meta: List[Tuple[str, int, int]] = []  # (aid, b_idx, blen)
    task_cand_start: List[int] = []
    task_cand_end: List[int] = []
    cand_day: List[int] = []
    cand_period: List[int] = []
    cand_cost: List[int] = []
    cand_task: List[int] = []

    class_day_cands: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    teacher_day_cands: Dict[Tuple[str, int], List[Tuple[int, int, int, int]]] = defaultdict(list)
    teacher_day_period_cands: Dict[Tuple[str, int, int], List[int]] = defaultdict(list)
    teacher_bldg_cands: Dict[Tuple[str, int], List[Tuple[int, int, str, int]]] = defaultdict(list)
    room_day_cands: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    room_type_day_cands: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    asgn_day_cands: Dict[Tuple[str, int], List[int]] = defaultdict(list)

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
            t_id_1 = len(tasks_meta) + 1
            tasks_meta.append((aid, b_idx, blen))
            fixed = resolved_fixed.get((aid, b_idx))
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
                return {
                    "engine": ENGINE_NAME,
                    "backend_solver": chosen_backend,
                    "engine_version": f"{version} [{chosen_backend}]",
                    "status": "INFEASIBLE",
                    "solve_time_sec": round(time.perf_counter() - t0, 3),
                    "placed_blocks": 0,
                    "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
                    "placements": [],
                    "unplaced": [{"assignment_id": aid, "block_index": b_idx, "reason": "Uygun saat yok."}],
                    "diagnostics": [{"code": "NO_CANDIDATE", "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} için uygun saat yok."}],
                    "warnings": pre["warnings"],
                }

            start_idx = len(cand_day) + 1
            for d, p in cands:
                c_idx = len(cand_day) + 1
                cost = 0
                for tid in t_ids:
                    for k in range(blen):
                        if (d, p + k) in teacher_avoid.get(tid, set()):
                            cost += 10
                cand_day.append(d)
                cand_period.append(p)
                cand_cost.append(cost)
                cand_task.append(t_id_1)

                span = get_block_physical_span(intervals, shift, p, blen)
                class_day_cands[(cid, d)].append((span[0], span[1], c_idx))
                asgn_day_cands[(aid, d)].append(c_idx)
                for tid in t_ids:
                    teacher_day_cands[(tid, d)].append((span[0], span[1], c_idx, blen))
                    for k in range(blen):
                        teacher_day_period_cands[(tid, d, p + k)].append(c_idx)
                    if bldg:
                        teacher_bldg_cands[(tid, d)].append((span[0], span[1], bldg, c_idx))
                if rid and rid in room_map:
                    room_day_cands[(rid, d)].append((span[0], span[1], c_idx))
                elif rtype != "standard" and rooms_by_type.get(rtype):
                    room_type_day_cands[(rtype, d)].append((span[0], span[1], c_idx))

            task_cand_start.append(start_idx)
            task_cand_end.append(len(cand_day))

    # Çakışma çiftleri (farklı görevlerin adayları arasında)
    conflict_pairs_set = set()

    def _add_pair(a: int, b: int) -> None:
        if cand_task[a - 1] == cand_task[b - 1]:
            return
        pair = (a, b) if a < b else (b, a)
        conflict_pairs_set.add(pair)

    for items in class_day_cands.values():
        for i in range(len(items)):
            s1, e1, c1 = items[i]
            for j in range(i + 1, len(items)):
                s2, e2, c2 = items[j]
                if intervals_overlap((s1, e1), (s2, e2)):
                    _add_pair(c1, c2)

    for items in teacher_day_cands.values():
        for i in range(len(items)):
            s1, e1, c1, _ = items[i]
            for j in range(i + 1, len(items)):
                s2, e2, c2, _ = items[j]
                if intervals_overlap((s1, e1), (s2, e2)):
                    _add_pair(c1, c2)

    if travel_min > 0:
        for items in teacher_bldg_cands.values():
            for i in range(len(items)):
                s1, e1, b1, c1 = items[i]
                for j in range(i + 1, len(items)):
                    s2, e2, b2, c2 = items[j]
                    if b1 == b2 or intervals_overlap((s1, e1), (s2, e2)):
                        continue
                    gap_min = (s2 - e1) if e1 <= s2 else (s1 - e2)
                    if gap_min < travel_min:
                        _add_pair(c1, c2)

    # Günlük gruplar ve kapasite grupları
    dg_start: List[int] = []
    dg_end: List[int] = []
    dg_limit: List[int] = []
    dg_cand: List[int] = []
    dg_weight: List[int] = []

    def _add_dg(items_cw: List[Tuple[int, int]], limit: int) -> None:
        if not items_cw:
            return
        s = len(dg_cand) + 1
        for c, w in items_cw:
            dg_cand.append(c)
            dg_weight.append(w)
        dg_start.append(s)
        dg_end.append(len(dg_cand))
        dg_limit.append(limit)

    for t in teachers:
        tid = t["id"]
        max_d = int(t.get("max_daily_hours") or periods_per_day)
        max_consec = int(t.get("max_consecutive_hours") or 0)
        for d in range(num_days):
            d_items = teacher_day_cands.get((tid, d), [])
            if d_items and sum(b for _, _, _, b in d_items) > max_d:
                _add_dg([(c, b) for _, _, c, b in d_items], max_d)
            if max_consec > 0 and max_consec < periods_per_day:
                for p0 in range(periods_per_day - max_consec):
                    win = []
                    for k in range(max_consec + 1):
                        win.extend(teacher_day_period_cands.get((tid, d, p0 + k), []))
                    if len(win) > max_consec:
                        _add_dg([(c, 1) for c in win], max_consec)

    for (aid, _d), clist in asgn_day_cands.items():
        max_b = int(assignments_by_id[aid].get("max_blocks_per_day") or 1)
        if max_b > 0 and len(clist) > max_b:
            _add_dg([(c, 1) for c in clist], max_b)

    cg_start: List[int] = []
    cg_end: List[int] = []
    cg_cap: List[int] = []
    cg_cand: List[int] = []

    def _add_room_cap(items: List[Tuple[int, int, int]], cap: int) -> None:
        if cap == 1:
            for i in range(len(items)):
                s1, e1, c1 = items[i]
                for j in range(i + 1, len(items)):
                    s2, e2, c2 = items[j]
                    if intervals_overlap((s1, e1), (s2, e2)):
                        _add_pair(c1, c2)
        else:
            for tp in sorted({s for s, _, _ in items}):
                ov = [c for s, e, c in items if s <= tp < e]
                if len(ov) > cap:
                    s = len(cg_cand) + 1
                    cg_cand.extend(ov)
                    cg_start.append(s)
                    cg_end.append(len(cg_cand))
                    cg_cap.append(cap)

    for (rid, _d), items in room_day_cands.items():
        _add_room_cap(items, int(room_map[rid].get("simultaneous_capacity") or 1))
    for (rtype, _d), items in room_type_day_cands.items():
        _add_room_cap(items, sum(int(r.get("simultaneous_capacity") or 1) for r in rooms_by_type[rtype]))

    conflict_pairs = sorted(conflict_pairs_set)
    conflict_a = [a for a, _ in conflict_pairs]
    conflict_b = [b for _, b in conflict_pairs]

    dzn_lines = [
        f"NUM_TASKS = {len(tasks_meta)};",
        f"NUM_CANDS = {len(cand_day)};",
        f"NUM_CONFLICT_PAIRS = {len(conflict_pairs)};",
        f"NUM_DAILY_GROUPS = {len(dg_start)};",
        f"NUM_DG_ITEMS = {len(dg_cand)};",
        f"NUM_CAP_GROUPS = {len(cg_start)};",
        f"NUM_CG_ITEMS = {len(cg_cand)};",
        f"task_cand_start = {task_cand_start};",
        f"task_cand_end = {task_cand_end};",
        f"cand_day = {cand_day};",
        f"cand_period = {cand_period};",
        f"cand_cost = {cand_cost};",
        f"cand_task = {cand_task};",
        f"conflict_a = {conflict_a};",
        f"conflict_b = {conflict_b};",
        f"dg_start = {dg_start};",
        f"dg_end = {dg_end};",
        f"dg_limit = {dg_limit};",
        f"dg_cand = {dg_cand};",
        f"dg_weight = {dg_weight};",
        f"cg_start = {cg_start};",
        f"cg_end = {cg_end};",
        f"cg_cap = {cg_cap};",
        f"cg_cand = {cg_cand};",
    ]

    tmp_dir = tempfile.mkdtemp(prefix="evrakplus_mzn_")
    dzn_path = os.path.join(tmp_dir, "data.dzn")
    try:
        with open(dzn_path, "w", encoding="utf-8") as f:
            f.write("\n".join(dzn_lines) + "\n")

        emit_progress("solving", f"MiniZinc ({chosen_backend}): CP optimizasyonu çalışıyor")
        cmd = [
            exe,
            "--solver", chosen_backend,
            "--time-limit", str(int(max(1000, time_limit * 1000))),
            model_path,
            dzn_path,
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=max(5, int(time_limit) + 15),
        )
        elapsed = round(time.perf_counter() - t0, 3)
        stdout = proc.stdout or ""
        stderr = proc.stderr or ""

        if "=====UNSATISFIABLE=====" in stdout:
            return {
                "engine": ENGINE_NAME,
                "backend_solver": chosen_backend,
                "engine_version": f"{version} [{chosen_backend}]",
                "status": "INFEASIBLE",
                "solve_time_sec": elapsed,
                "placed_blocks": 0,
                "total_blocks": len(tasks_meta),
                "placements": [],
                "unplaced": [],
                "diagnostics": [{"code": "MINIZINC_UNSAT", "message": f"MiniZinc ({chosen_backend}) modelin çözülemez olduğunu bildirdi."}],
                "warnings": pre["warnings"],
            }

        # Son JSON çözüm satırını ayıkla
        chosen_arr = None
        for line in reversed(stdout.splitlines()):
            s = line.strip()
            if s.startswith("{") and s.endswith("}"):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed.get("chosen"), list):
                        chosen_arr = parsed["chosen"]
                        break
                except Exception:
                    pass

        if not chosen_arr or len(chosen_arr) != len(tasks_meta):
            st = "TIME_LIMIT" if "=====UNKNOWN=====" in stdout or elapsed >= time_limit * 0.9 else "ERROR"
            return {
                "engine": ENGINE_NAME,
                "backend_solver": chosen_backend,
                "engine_version": f"{version} [{chosen_backend}]",
                "status": st,
                "solve_time_sec": elapsed,
                "placed_blocks": 0,
                "total_blocks": len(tasks_meta),
                "placements": [],
                "unplaced": [],
                "diagnostics": [{"code": f"MINIZINC_{st}", "message": f"MiniZinc ({chosen_backend}) çözüm üretemedi. {stderr.strip()[:240]}"}],
                "warnings": pre["warnings"],
            }

        placements: List[Dict[str, Any]] = []
        for idx, c_idx_1 in enumerate(chosen_arr):
            aid, b_idx, blen = tasks_meta[idx]
            asgn = assignments_by_id[aid]
            d = cand_day[c_idx_1 - 1]
            p = cand_period[c_idx_1 - 1]
            placements.append({
                "assignment_id": aid,
                "block_index": b_idx,
                "class_id": asgn["class_id"],
                "course_id": asgn.get("course_id") or "",
                "teacher_ids": list(asgn.get("teacher_ids") or []),
                "room_id": asgn.get("room_id"),
                "day_index": d,
                "start_period": p,
                "length": blen,
            })

        assign_pool_rooms(placements, assignments_by_id, rooms_by_type, class_map, intervals)
        is_opt = "==========" in stdout
        result: Dict[str, Any] = {
            "engine": ENGINE_NAME,
            "backend_solver": chosen_backend,
            "engine_version": f"{version} [{chosen_backend}]",
            "status": "OPTIMAL" if is_opt else "FEASIBLE",
            "solve_time_sec": elapsed,
            "placed_blocks": len(placements),
            "total_blocks": len(tasks_meta),
            "placements": placements,
            "unplaced": [],
            "diagnostics": [],
            "warnings": pre["warnings"],
        }
        emit_progress("validating_result", f"MiniZinc ({chosen_backend}): Bağımsız doğrulama yapılıyor")
        val = validate_result(config, result)
        result["validation"] = val
        result["quality"] = score_schedule(config, result, val)
        if not val["valid"]:
            result["status"] = "ERROR"
            result["diagnostics"] = val["errors"]
        return result
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="EvrakPlus MiniZinc (Gecode/Chuffed) Ders Dağıtım Motoru")
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--backend", default="gecode", choices=["gecode", "chuffed"])
    parser.add_argument("--input", "-i")
    parser.add_argument("--output", "-o")
    args = parser.parse_args()

    if args.health:
        print(json.dumps(health_check(), ensure_ascii=False))
        return 0

    if not args.input:
        print(json.dumps({"engine": ENGINE_NAME, "status": "ERROR", "diagnostics": [{"code": "NO_INPUT", "message": "Giriş dosyası belirtilmedi."}]}))
        return 1

    with open(args.input, "r", encoding="utf-8") as f:
        config = json.load(f)

    res = solve_with_minizinc(config, backend=args.backend)
    out_text = json.dumps(res, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_text)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
