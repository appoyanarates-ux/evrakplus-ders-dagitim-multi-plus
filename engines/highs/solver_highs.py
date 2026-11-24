"""
Gerçek HiGHS MILP Ders Dağıtım Motoru (solver_highs.py).
highspy (HiGHS C++ MILP çözücüsü) ile gerçek tamsayılı doğrusal model kurar,
çözer ve EvrakPlus Independent Schedule Validator + Ortak Kalite Puanlama
üzerinden doğrulanmış sonuç döndürür.
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

ENGINE_NAME = "highs"


def emit_progress(phase: str, message: str) -> None:
    try:
        sys.stderr.write(json.dumps({"type": "progress", "engine": ENGINE_NAME, "phase": phase, "message": message}, ensure_ascii=False) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def get_highs_version() -> str:
    try:
        import highspy
        h = highspy.Highs()
        h.silent()
        return f"HiGHS {h.version()} (highspy 1.16.0)"
    except Exception as exc:
        return f"unavailable ({exc})"


def health_check() -> Dict[str, Any]:
    try:
        import highspy
        h = highspy.Highs()
        h.silent()
        x = h.addBinary(name="x")
        h.minimize(-x)
        st = h.getModelStatus()
        ok = st == highspy.HighsModelStatus.kOptimal
        return {
            "available": ok,
            "engine": ENGINE_NAME,
            "display_name": "HiGHS MILP Solver",
            "version": get_highs_version(),
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
    except Exception as exc:
        return {
            "available": False,
            "engine": ENGINE_NAME,
            "display_name": "HiGHS MILP Solver",
            "version": "unavailable",
            "error": str(exc),
        }


def solve_with_highs(config: Dict[str, Any]) -> Dict[str, Any]:
    import highspy

    t0 = time.perf_counter()
    emit_progress("validating", "HiGHS: Model ön kontrolü yapılıyor")
    pre = validate_model(config)
    if not pre["valid"]:
        return {
            "engine": ENGINE_NAME,
            "engine_version": get_highs_version(),
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
    threads = int(req.get("threads") or 0)

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

    emit_progress("building", "HiGHS: MILP modeli oluşturuluyor")
    h = highspy.Highs()
    h.setOptionValue("output_flag", False)
    h.setOptionValue("time_limit", max(1.0, time_limit))
    if threads > 0:
        h.setOptionValue("threads", threads)

    # Değişken indeksleri (0-tabanlı tamsayı)
    var_costs: List[float] = []
    var_is_binary: List[bool] = []
    var_ub: List[float] = []

    def add_bin(cost: float = 0.0) -> int:
        idx = len(var_costs)
        var_costs.append(float(cost))
        var_is_binary.append(True)
        var_ub.append(1.0)
        return idx

    def add_int(ub: float, cost: float = 0.0) -> int:
        idx = len(var_costs)
        var_costs.append(float(cost))
        var_is_binary.append(False)
        var_ub.append(float(ub))
        return idx

    # Kısıt satırları: (lb, ub, [(col, val), ...])
    rows: List[Tuple[float, float, List[Tuple[int, float]]]] = []

    task_vars: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = {}
    class_day_items: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    teacher_day_items: Dict[Tuple[str, int], List[Tuple[int, int, int, int]]] = defaultdict(list)
    teacher_day_period_vars: Dict[Tuple[str, int, int], List[int]] = defaultdict(list)
    teacher_building_items: Dict[Tuple[str, int], List[Tuple[int, int, str, int]]] = defaultdict(list)
    room_day_items: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    room_type_day_items: Dict[Tuple[str, int], List[Tuple[int, int, int]]] = defaultdict(list)
    asgn_day_vars: Dict[Tuple[str, int], List[int]] = defaultdict(list)

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
                    "engine_version": get_highs_version(),
                    "status": "INFEASIBLE",
                    "solve_time_sec": round(time.perf_counter() - t0, 3),
                    "placed_blocks": 0,
                    "total_blocks": total_blocks,
                    "placements": [],
                    "unplaced": [{"assignment_id": aid, "block_index": b_idx, "reason": "Uygun başlangıç saati yok."}],
                    "diagnostics": [{"code": "NO_CANDIDATE", "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} için uygun saat bulunamadı."}],
                    "warnings": pre["warnings"],
                }

            vlist: List[Tuple[int, int, int]] = []
            for d, p in candidates:
                avoid_cost = 0.0
                for tid in t_ids:
                    for k in range(blen):
                        if (d, p + k) in teacher_avoid.get(tid, set()):
                            avoid_cost += 6.0
                vidx = add_bin(cost=avoid_cost)
                vlist.append((d, p, vidx))
                span = get_block_physical_span(intervals, shift, p, blen)
                class_day_items[(cid, d)].append((span[0], span[1], vidx))
                asgn_day_vars[(aid, d)].append(vidx)
                for tid in t_ids:
                    teacher_day_items[(tid, d)].append((span[0], span[1], vidx, blen))
                    for k in range(blen):
                        teacher_day_period_vars[(tid, d, p + k)].append(vidx)
                    if bldg:
                        teacher_building_items[(tid, d)].append((span[0], span[1], bldg, vidx))
                if rid and rid in room_map:
                    room_day_items[(rid, d)].append((span[0], span[1], vidx))
                elif rtype != "standard" and rooms_by_type.get(rtype):
                    room_type_day_items[(rtype, d)].append((span[0], span[1], vidx))

            task_vars[key] = vlist
            rows.append((1.0, 1.0, [(v, 1.0) for _, _, v in vlist]))

    inf = highspy.kHighsInf

    # Şube çakışması
    for (_cid, _d), items in class_day_items.items():
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > 1:
                rows.append((-inf, 1.0, [(v, 1.0) for v in ov]))

    # Öğretmen çakışması
    for (_tid, _d), items in teacher_day_items.items():
        for tp in sorted({s for s, _, _, _ in items}):
            ov = [v for s, e, v, _ in items if s <= tp < e]
            if len(ov) > 1:
                rows.append((-inf, 1.0, [(v, 1.0) for v in ov]))

    # Öğretmen günlük max, ardışık max, bina geçişi
    for t in teachers:
        tid = t["id"]
        max_d = float(int(t.get("max_daily_hours") or periods_per_day))
        max_consec = int(t.get("max_consecutive_hours") or 0)
        for d in range(num_days):
            day_items = teacher_day_items.get((tid, d), [])
            if day_items:
                rows.append((-inf, max_d, [(v, float(blen)) for _, _, v, blen in day_items]))
            if max_consec > 0 and max_consec < periods_per_day:
                for p0 in range(periods_per_day - max_consec):
                    win = []
                    for k in range(max_consec + 1):
                        win.extend(teacher_day_period_vars.get((tid, d, p0 + k), []))
                    if len(win) > max_consec:
                        rows.append((-inf, float(max_consec), [(v, 1.0) for v in win]))
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
                            rows.append((-inf, 1.0, [(v1, 1.0), (v2, 1.0)]))

    # Derslik kapasiteleri
    for (rid, _d), items in room_day_items.items():
        cap = float(int(room_map[rid].get("simultaneous_capacity") or 1))
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > cap:
                rows.append((-inf, cap, [(v, 1.0) for v in ov]))

    for (rtype, _d), items in room_type_day_items.items():
        cap = float(sum(int(r.get("simultaneous_capacity") or 1) for r in rooms_by_type[rtype]))
        for tp in sorted({s for s, _, _ in items}):
            ov = [v for s, e, v in items if s <= tp < e]
            if len(ov) > cap:
                rows.append((-inf, cap, [(v, 1.0) for v in ov]))

    # Aynı ders günlük max blok + yayma cezası
    spread_w = 18.0 if preference == "spread_days" else 8.0
    for (aid, _d), vlist in asgn_day_vars.items():
        max_b = int(assignments_by_id[aid].get("max_blocks_per_day") or 1)
        if max_b > 0 and len(vlist) > max_b:
            rows.append((-inf, float(max_b), [(v, 1.0) for v in vlist]))
        if max_b > 1 and len(vlist) > 1:
            extra = add_int(ub=float(len(vlist)), cost=spread_w)
            rows.append((-inf, 1.0, [(v, 1.0) for v in vlist] + [(extra, -1.0)]))

    # Öğretmen boşluk cezası
    gap_w = 20.0 if preference == "fewer_gaps" else 10.0
    for t in teachers:
        tid = t["id"]
        for d in range(num_days):
            for p in range(1, periods_per_day - 1):
                prev_v = teacher_day_period_vars.get((tid, d, p - 1), [])
                cur_v = teacher_day_period_vars.get((tid, d, p), [])
                next_v = teacher_day_period_vars.get((tid, d, p + 1), [])
                if prev_v and next_v:
                    g = add_bin(cost=gap_w)
                    # prev + next - cur - g <= 1
                    terms: Dict[int, float] = defaultdict(float)
                    for v in prev_v:
                        terms[v] += 1.0
                    for v in next_v:
                        terms[v] += 1.0
                    for v in cur_v:
                        terms[v] -= 1.0
                    terms[g] -= 1.0
                    rows.append((-inf, 1.0, [(k, val) for k, val in terms.items() if abs(val) > 1e-9]))

    # Değişkenleri ve satırları HiGHS modeline ekle
    num_vars = len(var_costs)
    for i in range(num_vars):
        h.addVar(0.0, var_ub[i])
        h.changeColCost(i, var_costs[i])
        h.changeColIntegrality(i, highspy.HighsVarType.kInteger)

    for lb, ub, terms in rows:
        if not terms:
            continue
        # Aynı sütun indekslerini birleştir
        merged: Dict[int, float] = defaultdict(float)
        for col, coef in terms:
            merged[col] += coef
        cols = [c for c, val in merged.items() if abs(val) > 1e-9]
        vals = [merged[c] for c in cols]
        if cols:
            h.addRow(lb, ub, len(cols), cols, vals)

    emit_progress("solving", "HiGHS: MILP optimizasyonu çalışıyor")
    h.run()
    elapsed = round(time.perf_counter() - t0, 3)

    mstatus = h.getModelStatus()
    sol = h.getSolution()
    has_values = bool(sol.col_value) and len(sol.col_value) == num_vars

    if mstatus == highspy.HighsModelStatus.kInfeasible or not has_values:
        st = "INFEASIBLE" if mstatus == highspy.HighsModelStatus.kInfeasible else (
            "TIME_LIMIT" if mstatus == highspy.HighsModelStatus.kTimeLimit else "UNKNOWN"
        )
        return {
            "engine": ENGINE_NAME,
            "engine_version": get_highs_version(),
            "status": st,
            "solve_time_sec": elapsed,
            "placed_blocks": 0,
            "total_blocks": total_blocks,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": f"HIGHS_{st}", "message": f"HiGHS çözüm bulamadı (durum: {mstatus})."}],
            "warnings": pre["warnings"],
        }

    col_vals = sol.col_value
    placements: List[Dict[str, Any]] = []
    for (aid, b_idx), vlist in task_vars.items():
        asgn = assignments_by_id[aid]
        blen = int((asgn.get("blocks") or [])[b_idx])
        for d, p, vidx in vlist:
            if col_vals[vidx] > 0.5:
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
    status = "OPTIMAL" if mstatus == highspy.HighsModelStatus.kOptimal else "FEASIBLE"
    result: Dict[str, Any] = {
        "engine": ENGINE_NAME,
        "engine_version": get_highs_version(),
        "status": status,
        "solve_time_sec": elapsed,
        "placed_blocks": len(placements),
        "total_blocks": total_blocks,
        "placements": placements,
        "unplaced": [],
        "diagnostics": [],
        "warnings": pre["warnings"],
    }

    emit_progress("validating_result", "HiGHS: Bağımsız doğrulama yapılıyor")
    val = validate_result(config, result)
    result["validation"] = val
    result["quality"] = score_schedule(config, result, val)
    if not val["valid"]:
        result["status"] = "ERROR"
        result["diagnostics"] = val["errors"]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="EvrakPlus HiGHS MILP Ders Dağıtım Motoru")
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

    res = solve_with_highs(config)
    out_text = json.dumps(res, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_text)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
