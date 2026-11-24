"""
Gerçek SCIP MILP Ders Dağıtım Motoru (solver_scip.py).
SCIP Optimization Suite (SCIP 10.0.0 + SoPlex 8.0.0 LP çözücüsü) ile
gerçek tamsayılı doğrusal programlama (MILP) kurar, çözer ve
EvrakPlus Independent Schedule Validator + Ortak Kalite Puanlama üzerinden doğrulanmış sonuç döndürür.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
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

ENGINE_NAME = "scip"


def emit_progress(phase: str, message: str) -> None:
    try:
        sys.stderr.write(json.dumps({"type": "progress", "engine": ENGINE_NAME, "phase": phase, "message": message}, ensure_ascii=False) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def get_scip_version() -> str:
    try:
        from ortools.linear_solver import pywraplp
        s = pywraplp.Solver.CreateSolver("SCIP")
        if s is None:
            return "unavailable"
        return s.SolverVersion()
    except Exception as exc:
        return f"unavailable ({exc})"


def health_check() -> Dict[str, Any]:
    try:
        from ortools.linear_solver import pywraplp
        s = pywraplp.Solver.CreateSolver("SCIP")
        if s is None:
            return {"available": False, "engine": ENGINE_NAME, "display_name": "SCIP Optimization Suite", "version": "unavailable", "error": "SCIP backend bulunamadı"}
        x = s.BoolVar("x")
        s.Maximize(x)
        st = s.Solve()
        ok = st == pywraplp.Solver.OPTIMAL and round(x.solution_value()) == 1
        return {
            "available": ok,
            "engine": ENGINE_NAME,
            "display_name": "SCIP Optimization Suite",
            "version": s.SolverVersion(),
            "capabilities": {
                "dual_shift": True,
                "building_travel": True,
                "common_elective": True,
                "multi_teacher": True,
                "special_rooms": True,
                "max_consecutive": True,
                "warm_start": True,
            },
        }
    except Exception as exc:
        return {
            "available": False,
            "engine": ENGINE_NAME,
            "display_name": "SCIP Optimization Suite",
            "version": "unavailable",
            "error": str(exc),
        }


def solve_with_scip(config: Dict[str, Any]) -> Dict[str, Any]:
    from ortools.linear_solver import pywraplp

    t0 = time.perf_counter()
    emit_progress("validating", "SCIP: Model ön kontrolü yapılıyor")
    pre = validate_model(config)
    if not pre["valid"]:
        return {
            "engine": ENGINE_NAME,
            "engine_version": get_scip_version(),
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
    preference = str(req.get("preference") or "balanced")

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

    emit_progress("building", "SCIP: MILP modeli oluşturuluyor")
    solver = pywraplp.Solver.CreateSolver("SCIP")
    if solver is None:
        return {
            "engine": ENGINE_NAME,
            "engine_version": "unavailable",
            "status": "ERROR",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "SCIP_UNAVAILABLE", "message": "SCIP çözücüsü başlatılamadı."}],
            "warnings": pre["warnings"],
        }

    solver.SetTimeLimit(int(max(1000, time_limit * 1000)))
    scip_ver = solver.SolverVersion()

    task_vars: Dict[Tuple[str, int], List[Tuple[int, int, Any]]] = {}
    class_day_items: Dict[Tuple[str, int], List[Tuple[int, int, Any]]] = defaultdict(list)
    teacher_day_items: Dict[Tuple[str, int], List[Tuple[int, int, Any, int]]] = defaultdict(list)
    teacher_day_period_vars: Dict[Tuple[str, int, int], List[Any]] = defaultdict(list)
    teacher_building_items: Dict[Tuple[str, int], List[Tuple[int, int, str, Any]]] = defaultdict(list)
    room_day_items: Dict[Tuple[str, int], List[Tuple[int, int, Any]]] = defaultdict(list)
    room_type_day_items: Dict[Tuple[str, int], List[Tuple[int, int, Any]]] = defaultdict(list)
    asgn_day_vars: Dict[Tuple[str, int], List[Any]] = defaultdict(list)
    obj = solver.Objective()
    obj.SetMinimization()

    def _get_asgn_building(asgn_obj: Dict[str, Any]) -> Optional[str]:
        rid = asgn_obj.get("room_id")
        if rid and rid in room_map and room_map[rid].get("building"):
            return str(room_map[rid]["building"]).strip()
        cid = asgn_obj["class_id"]
        if cid in class_map and class_map[cid].get("building"):
            return str(class_map[cid]["building"]).strip()
        return None

    total_blocks = 0
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
            total_blocks += 1
            key = (aid, b_idx)
            fixed = resolved_fixed.get(key)
            if fixed:
                candidates = [(int(fixed["day_index"]), int(fixed["start_period"]))]
            else:
                _, candidates = compute_valid_starts_for_block(
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
            if not candidates:
                return {
                    "engine": ENGINE_NAME,
                    "engine_version": scip_ver,
                    "status": "INFEASIBLE",
                    "solve_time_sec": round(time.perf_counter() - t0, 3),
                    "placed_blocks": 0,
                    "total_blocks": total_blocks,
                    "placements": [],
                    "unplaced": [{"assignment_id": aid, "block_index": b_idx, "reason": "Uygun başlangıç saati yok."}],
                    "diagnostics": [{"code": "NO_CANDIDATE", "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} için uygun saat yok."}],
                    "warnings": pre["warnings"],
                }

            vlist: List[Tuple[int, int, Any]] = []
            for d, p in candidates:
                var = solver.BoolVar(f"x_{aid}_{b_idx}_{d}_{p}")
                vlist.append((d, p, var))
                span = get_block_physical_span(intervals, shift, p, blen)
                class_day_items[(cid, d)].append((span[0], span[1], var))
                asgn_day_vars[(aid, d)].append(var)

                avoid_cost = 0.0
                for tid in t_ids:
                    teacher_day_items[(tid, d)].append((span[0], span[1], var, blen))
                    for k in range(blen):
                        teacher_day_period_vars[(tid, d, p + k)].append(var)
                        if (d, p + k) in teacher_avoid.get(tid, set()):
                            avoid_cost += 6.0
                    if bldg:
                        teacher_building_items[(tid, d)].append((span[0], span[1], bldg, var))
                if rid and rid in room_map:
                    room_day_items[(rid, d)].append((span[0], span[1], var))
                elif rtype != "standard" and rooms_by_type.get(rtype):
                    room_type_day_items[(rtype, d)].append((span[0], span[1], var))
                if avoid_cost > 0:
                    obj.SetCoefficient(var, avoid_cost)

            task_vars[key] = vlist
            solver.Add(sum(v for _, _, v in vlist) == 1)

    for (_cid, _d), items in class_day_items.items():
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > 1:
                solver.Add(sum(ov) <= 1)

    for (_tid, _d), items in teacher_day_items.items():
        for tp in sorted({s for s, _, _, _ in items}):
            ov = [v for s, e, v, _ in items if s <= tp < e]
            if len(ov) > 1:
                solver.Add(sum(ov) <= 1)

    for t in teachers:
        tid = t["id"]
        max_d = int(t.get("max_daily_hours") or periods_per_day)
        max_consec = int(t.get("max_consecutive_hours") or 0)
        for d in range(num_days):
            day_items = teacher_day_items.get((tid, d), [])
            if day_items:
                solver.Add(sum(blen * v for _, _, v, blen in day_items) <= max_d)
            if max_consec > 0 and max_consec < periods_per_day:
                for p0 in range(periods_per_day - max_consec):
                    win = []
                    for k in range(max_consec + 1):
                        win.extend(teacher_day_period_vars.get((tid, d, p0 + k), []))
                    if len(win) > max_consec:
                        solver.Add(sum(win) <= max_consec)
            if travel_min > 0:
                b_items = teacher_building_items.get((tid, d), [])
                for i in range(len(b_items)):
                    s1, e1, b1, v1 = b_items[i]
                    for j in range(i + 1, len(b_items)):
                        s2, e2, b2, v2 = b_items[j]
                        if b1 == b2 or intervals_overlap((s1, e1), (s2, e2)):
                            continue
                        gap_min = (s2 - e1) if e1 <= s2 else (s1 - e2)
                        if gap_min < travel_min:
                            solver.Add(v1 + v2 <= 1)

    for (rid, _d), items in room_day_items.items():
        cap = int(room_map[rid].get("simultaneous_capacity") or 1)
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > cap:
                solver.Add(sum(ov) <= cap)

    for (rtype, _d), items in room_type_day_items.items():
        cap = sum(int(r.get("simultaneous_capacity") or 1) for r in rooms_by_type[rtype])
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > cap:
                solver.Add(sum(ov) <= cap)

    spread_w = 18.0 if preference == "spread_days" else 8.0
    for (aid, d), vlist in asgn_day_vars.items():
        max_b = int(assignments_by_id[aid].get("max_blocks_per_day") or 1)
        if max_b > 0 and len(vlist) > max_b:
            solver.Add(sum(vlist) <= max_b)
        if max_b > 1 and len(vlist) > 1:
            extra = solver.IntVar(0, len(vlist), f"rep_{aid}_{d}")
            solver.Add(extra >= sum(vlist) - 1)
            obj.SetCoefficient(extra, spread_w)

    gap_w = 20.0 if preference == "fewer_gaps" else 10.0
    for t in teachers:
        tid = t["id"]
        for d in range(num_days):
            for p in range(1, periods_per_day - 1):
                prev_v = teacher_day_period_vars.get((tid, d, p - 1), [])
                cur_v = teacher_day_period_vars.get((tid, d, p), [])
                next_v = teacher_day_period_vars.get((tid, d, p + 1), [])
                if prev_v and next_v:
                    g = solver.BoolVar(f"g_{tid}_{d}_{p}")
                    solver.Add(g >= sum(prev_v) + sum(next_v) - sum(cur_v) - 1)
                    obj.SetCoefficient(g, gap_w)

    emit_progress("solving", "SCIP: MILP optimizasyonu çalışıyor")
    st_code = solver.Solve()
    elapsed = round(time.perf_counter() - t0, 3)

    if st_code not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        st_name = "INFEASIBLE" if st_code == pywraplp.Solver.INFEASIBLE else (
            "TIME_LIMIT" if elapsed >= time_limit * 0.9 else "UNKNOWN"
        )
        return {
            "engine": ENGINE_NAME,
            "engine_version": scip_ver,
            "status": st_name,
            "solve_time_sec": elapsed,
            "placed_blocks": 0,
            "total_blocks": total_blocks,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": f"SCIP_{st_name}", "message": f"SCIP çözüm bulamadı (durum kodu: {st_code})."}],
            "warnings": pre["warnings"],
        }

    placements: List[Dict[str, Any]] = []
    for (aid, b_idx), vlist in task_vars.items():
        asgn = assignments_by_id[aid]
        blen = int((asgn.get("blocks") or [])[b_idx])
        for d, p, var in vlist:
            if var.solution_value() > 0.5:
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
                break

    assign_pool_rooms(placements, assignments_by_id, rooms_by_type, class_map, intervals)
    status = "OPTIMAL" if st_code == pywraplp.Solver.OPTIMAL else "FEASIBLE"
    result: Dict[str, Any] = {
        "engine": ENGINE_NAME,
        "engine_version": scip_ver,
        "status": status,
        "solve_time_sec": elapsed,
        "placed_blocks": len(placements),
        "total_blocks": total_blocks,
        "placements": placements,
        "unplaced": [],
        "diagnostics": [],
        "warnings": pre["warnings"],
    }

    emit_progress("validating_result", "SCIP: Bağımsız doğrulama yapılıyor")
    val = validate_result(config, result)
    result["validation"] = val
    result["quality"] = score_schedule(config, result, val)
    if not val["valid"]:
        result["status"] = "ERROR"
        result["diagnostics"] = val["errors"]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="EvrakPlus SCIP MILP Ders Dağıtım Motoru")
    parser.add_argument("--health", action="store_true")
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

    res = solve_with_scip(config)
    out_text = json.dumps(res, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_text)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
