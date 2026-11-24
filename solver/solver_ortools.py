"""
Tek otomatik ders dağıtım motoru: Google OR-Tools CP-SAT (solver_ortools.py).
Yalnızca Google OR-Tools CP-SAT kullanır; hiçbir yedek/greedy/JS çözücü içermez.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

import ortools
from ortools.sat.python import cp_model

# PyInstaller onedir/onefile ve doğrudan çalıştırmada yerel modül yolunu garantiye al
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if _CURRENT_DIR not in sys.path:
    sys.path.insert(0, _CURRENT_DIR)

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

ENGINE_NAME = "google_ortools_cp_sat"

PREFERENCE_WEIGHTS = {
    "balanced": {"gap": 10, "avoid": 6, "spread": 8, "balance": 4},
    "fewer_gaps": {"gap": 24, "avoid": 6, "spread": 4, "balance": 2},
    "spread_days": {"gap": 6, "avoid": 6, "spread": 20, "balance": 8},
}


def emit_progress(phase: str, message: str) -> None:
    try:
        payload = json.dumps({"type": "progress", "phase": phase, "message": message}, ensure_ascii=False)
        sys.stderr.write(payload + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def assign_pool_rooms(
    placements: List[Dict[str, Any]],
    assignments_by_id: Dict[str, Dict[str, Any]],
    rooms_by_type: Dict[str, List[Dict[str, Any]]],
    classes_map: Dict[str, Dict[str, Any]],
    intervals: Dict[str, List[Tuple[int, int]]],
) -> None:
    """
    room_id atanmamış ancak özel room_type isteyen derslere,
    aynı türdeki derslik havuzundan çakışmasız somut room_id atar.
    """
    by_type_day: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    for pl in placements:
        if pl.get("room_id"):
            continue
        asgn = assignments_by_id[pl["assignment_id"]]
        rtype = asgn.get("room_type") or "standard"
        if rtype == "standard" or not rooms_by_type.get(rtype):
            continue
        shift = classes_map[pl["class_id"]].get("shift") or "full_day"
        s, e = get_block_physical_span(intervals, shift, pl["start_period"], pl["length"])
        by_type_day[(rtype, pl["day_index"])].append((s, e, pl))

    for (rtype, _day), items in by_type_day.items():
        pool = rooms_by_type[rtype]
        # Her oda kapasitesi kadar birim slot aç
        slots: List[Tuple[str, int]] = []  # (room_id, free_after_min)
        for rm in pool:
            cap = int(rm.get("simultaneous_capacity") or 1)
            for _ in range(cap):
                slots.append((rm["id"], -1))

        items.sort(key=lambda x: (x[0], x[1]))
        for s, e, pl in items:
            assigned = None
            for idx, (rid, free_at) in enumerate(slots):
                if free_at <= s:
                    slots[idx] = (rid, e)
                    assigned = rid
                    break
            if assigned:
                pl["room_id"] = assigned


DEFAULT_DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]


def _get_day_name(time_grid: Dict[str, Any], day_index: int) -> str:
    days = time_grid.get("days")
    if isinstance(days, list):
        for item in days:
            if isinstance(item, dict) and int(item.get("index", -1)) == day_index and item.get("name"):
                return str(item["name"])
    if 0 <= day_index < len(DEFAULT_DAY_NAMES):
        return DEFAULT_DAY_NAMES[day_index]
    return f"Gün {day_index + 1}"


def diagnose_infeasibility(
    *,
    config: Dict[str, Any],
    time_grid: Dict[str, Any],
    num_days: int,
    periods_per_day: int,
    blocked: Set[Tuple[int, int]],
    common_elective: Set[Tuple[int, int]],
    lunch_after: int,
    long_break_after: int,
    intervals: Dict[str, List[Tuple[int, int]]],
    class_map: Dict[str, Dict[str, Any]],
    teacher_map: Dict[str, Dict[str, Any]],
    room_map: Dict[str, Dict[str, Any]],
    rooms_by_type: Dict[str, List[Dict[str, Any]]],
    assignments: List[Dict[str, Any]],
    assignments_by_id: Dict[str, Dict[str, Any]],
    teacher_unavail: Dict[str, Set[Tuple[int, int]]],
    resolved_fixed: Dict[Tuple[str, int], Dict[str, Any]],
    enforce_common_exclusivity: bool,
    travel_min: int,
    max_diag_time_sec: float = 8.0,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    CP-SAT AddAssumptions + SufficientAssumptionsForInfeasibility kullanarak
    çözülemezliğin (INFEASIBLE) tam kaynağını (UNSAT çekirdeğini) tespit eder.
    """
    emit_progress("diagnosing", "Çelişki kaynağı analiz ediliyor")
    dmodel = cp_model.CpModel()
    assumptions: List[cp_model.IntVar] = []
    assumption_meta: Dict[int, Dict[str, Any]] = {}

    def make_assumption(name: str, meta: Dict[str, Any]) -> cp_model.IntVar:
        v = dmodel.NewBoolVar(name)
        assumptions.append(v)
        assumption_meta[v.Index()] = meta
        return v

    class_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    teacher_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    teacher_day_period_vars: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
    room_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    room_type_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    asgn_day_vars: Dict[Tuple[str, int], List[cp_model.IntVar]] = defaultdict(list)
    teacher_building_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, str, cp_model.IntVar]]] = defaultdict(list)
    class_common_slot_vars: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
    class_common_hours: Dict[str, int] = defaultdict(int)

    teacher_forbidden_vars: Dict[str, List[cp_model.IntVar]] = defaultdict(list)
    non_elective_in_common_vars: List[cp_model.IntVar] = []

    asgn_place_assumptions: Dict[str, cp_model.IntVar] = {}

    for asgn in assignments:
        aid = asgn["assignment_id"]
        cid = asgn["class_id"]
        cls = class_map[cid]
        cls_shift = cls.get("shift") or "full_day"
        t_ids = list(asgn.get("teacher_ids") or [])
        base_room_id = asgn.get("room_id")
        room_type = asgn.get("room_type") or "standard"
        use_common = bool(asgn.get("use_common_elective_slot"))
        blocks = [int(b) for b in (asgn.get("blocks") or [])]
        if use_common:
            class_common_hours[cid] += sum(blocks)

        a_place = make_assumption(
            f"a_place_{aid}",
            {"kind": "asgn_place", "priority": 2, "assignment_id": aid},
        )
        asgn_place_assumptions[aid] = a_place

        for b_idx, blen in enumerate(blocks):
            key = (aid, b_idx)
            fa_entry = resolved_fixed.get(key)
            eff_room_id = (fa_entry.get("room_id") if fa_entry and fa_entry.get("room_id") else base_room_id)

            school_valid, _ = compute_valid_starts_for_block(
                length=blen,
                num_days=num_days,
                periods_per_day=periods_per_day,
                blocked=blocked,
                common_elective=common_elective,
                use_common_elective=use_common,
                enforce_common_elective_exclusivity=False,
                lunch_after=lunch_after,
                long_break_after=long_break_after,
                class_shift=cls_shift,
                teacher_unavail_sets=[],
            )
            if fa_entry is not None:
                fslot = (fa_entry["day_index"], fa_entry["start_period"])
                if fslot not in school_valid:
                    school_valid.append(fslot)

            if not school_valid:
                continue

            blk_building = None
            if eff_room_id and eff_room_id in room_map and room_map[eff_room_id].get("building"):
                blk_building = str(room_map[eff_room_id]["building"]).strip()
            elif cls.get("building"):
                blk_building = str(cls["building"]).strip()

            cands_vars: List[cp_model.IntVar] = []
            fixed_var: Optional[cp_model.IntVar] = None

            for d, p in school_valid:
                var = dmodel.NewBoolVar(f"dx_{aid}_{b_idx}_{d}_{p}")
                cands_vars.append(var)
                if fa_entry is not None and d == fa_entry["day_index"] and p == fa_entry["start_period"]:
                    fixed_var = var

                span_s, span_e = get_block_physical_span(intervals, cls_shift, p, blen)
                class_day_vars[(cid, d)].append((span_s, span_e, var, blen))
                asgn_day_vars[(aid, d)].append(var)

                if use_common:
                    for k in range(blen):
                        class_common_slot_vars[(cid, d, p + k)].append(var)
                elif enforce_common_exclusivity:
                    if any((d, p + k) in common_elective for k in range(blen)):
                        non_elective_in_common_vars.append(var)

                for tid in t_ids:
                    teacher_day_vars[(tid, d)].append((span_s, span_e, var, blen))
                    if travel_min > 0 and blk_building:
                        teacher_building_day_vars[(tid, d)].append((span_s, span_e, blk_building, var))
                    if any((d, p + k) in teacher_unavail[tid] for k in range(blen)):
                        teacher_forbidden_vars[tid].append(var)
                    for k in range(blen):
                        teacher_day_period_vars[(tid, d, p + k)].append(var)

                if eff_room_id:
                    room_day_vars[(eff_room_id, d)].append((span_s, span_e, var, blen))
                elif room_type != "standard" and rooms_by_type.get(room_type):
                    room_type_day_vars[(room_type, d)].append((span_s, span_e, var, blen))

            # Blok tam bir kez yerleşir (atama varsayımına bağlı)
            dmodel.Add(sum(cands_vars) == 1).OnlyEnforceIf(a_place)
            dmodel.Add(sum(cands_vars) <= 1)

            if fa_entry is not None and fixed_var is not None:
                a_fix = make_assumption(
                    f"a_fix_{aid}_{b_idx}",
                    {
                        "kind": "fixed",
                        "priority": 1,
                        "assignment_id": aid,
                        "block_index": b_idx,
                        "day_index": fa_entry["day_index"],
                        "start_period": fa_entry["start_period"],
                        "length": blen,
                    },
                )
                dmodel.Add(fixed_var == 1).OnlyEnforceIf(a_fix)

    # Öğretmen kapalı saatleri varsayımları
    for tid, fvars in teacher_forbidden_vars.items():
        if not fvars:
            continue
        a_tu = make_assumption(
            f"a_tu_{tid}",
            {"kind": "t_unavail", "priority": 1, "teacher_id": tid},
        )
        dmodel.Add(sum(fvars) == 0).OnlyEnforceIf(a_tu)

    # Ortak seçmeli münhasırlık varsayımı
    if non_elective_in_common_vars:
        a_ce = make_assumption(
            "a_common_excl",
            {"kind": "common_excl", "priority": 1},
        )
        dmodel.Add(sum(non_elective_in_common_vars) == 0).OnlyEnforceIf(a_ce)

    # Şube çakışması yok (şube bazında varsayım)
    class_ov_assumptions: Dict[str, cp_model.IntVar] = {}
    for (cid, _d), items in class_day_vars.items():
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > 1:
                if cid not in class_ov_assumptions:
                    class_ov_assumptions[cid] = make_assumption(
                        f"a_cov_{cid}",
                        {"kind": "c_overlap", "priority": 1, "class_id": cid},
                    )
                dmodel.Add(sum(covering) <= 1).OnlyEnforceIf(class_ov_assumptions[cid])

    # Öğretmen çakışması yok (öğretmen bazında varsayım)
    teacher_ov_assumptions: Dict[str, cp_model.IntVar] = {}
    for (tid, _d), items in teacher_day_vars.items():
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > 1:
                if tid not in teacher_ov_assumptions:
                    teacher_ov_assumptions[tid] = make_assumption(
                        f"a_tov_{tid}",
                        {"kind": "t_overlap", "priority": 1, "teacher_id": tid},
                    )
                dmodel.Add(sum(covering) <= 1).OnlyEnforceIf(teacher_ov_assumptions[tid])

    # Özel derslik kapasitesi (oda bazında varsayım)
    room_assumptions: Dict[str, cp_model.IntVar] = {}
    for (rid, _d), items in room_day_vars.items():
        cap = int(room_map[rid].get("simultaneous_capacity") or 1)
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > cap:
                if rid not in room_assumptions:
                    room_assumptions[rid] = make_assumption(
                        f"a_rm_{rid}",
                        {"kind": "room_cap", "priority": 1, "room_id": rid},
                    )
                dmodel.Add(sum(covering) <= cap).OnlyEnforceIf(room_assumptions[rid])

    # Özel derslik türü havuzu kapasitesi
    rtype_assumptions: Dict[str, cp_model.IntVar] = {}
    for (rtype, _d), items in room_type_day_vars.items():
        pool = rooms_by_type.get(rtype) or []
        total_cap = sum(int(r.get("simultaneous_capacity") or 1) for r in pool)
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > total_cap:
                if rtype not in rtype_assumptions:
                    rtype_assumptions[rtype] = make_assumption(
                        f"a_rt_{rtype}",
                        {"kind": "rtype_cap", "priority": 1, "room_type": rtype},
                    )
                dmodel.Add(sum(covering) <= total_cap).OnlyEnforceIf(rtype_assumptions[rtype])

    # Aynı dersin günlük blok sayısı sınırı
    for asgn in assignments:
        aid = asgn["assignment_id"]
        max_per_day = int(asgn.get("max_blocks_per_day") or 1)
        if max_per_day <= 0:
            continue
        a_amd: Optional[cp_model.IntVar] = None
        for d in range(num_days):
            d_vars = asgn_day_vars.get((aid, d)) or []
            if len(d_vars) > max_per_day:
                if a_amd is None:
                    a_amd = make_assumption(
                        f"a_amd_{aid}",
                        {"kind": "asgn_max_day", "priority": 1, "assignment_id": aid, "max_per_day": max_per_day},
                    )
                dmodel.Add(sum(d_vars) <= max_per_day).OnlyEnforceIf(a_amd)

    # Öğretmen günlük maks saat, çalışılabilir gün, ardışık maks saat, pencere ve bina geçişi
    is_double_shift = isinstance(time_grid.get("bell_schedule"), dict)
    for tid, t in teacher_map.items():
        max_daily = int(t.get("max_daily_hours") or periods_per_day)
        max_consec = int(t.get("max_consecutive_hours") or 0)
        max_gaps_day = int(t.get("max_daily_gaps") or 0)
        max_work_days = int(t.get("max_working_days") or 0)

        a_t_daily: Optional[cp_model.IntVar] = None
        a_t_consec: Optional[cp_model.IntVar] = None
        a_t_gaps: Optional[cp_model.IntVar] = None
        a_t_travel: Optional[cp_model.IntVar] = None
        working_day_vars: List[cp_model.IntVar] = []

        for d in range(num_days):
            items = teacher_day_vars.get((tid, d)) or []
            if not items:
                continue
            day_load = sum(blen * v for _, _, v, blen in items)
            if a_t_daily is None:
                a_t_daily = make_assumption(
                    f"a_tmd_{tid}",
                    {"kind": "t_max_daily", "priority": 1, "teacher_id": tid, "limit": max_daily},
                )
            dmodel.Add(day_load <= max_daily).OnlyEnforceIf(a_t_daily)

            if 0 < max_work_days < num_days:
                wd = dmodel.NewBoolVar(f"dwd_{tid}_{d}")
                dmodel.AddMaxEquality(wd, [v for _, _, v, _ in items])
                working_day_vars.append(wd)

            if travel_min > 0:
                b_items = teacher_building_day_vars.get((tid, d)) or []
                if len(b_items) >= 2:
                    by_bspan: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
                    for bs, be, bname, bv in b_items:
                        by_bspan[(bname, bs, be)].append(bv)
                    grouped = list(by_bspan.items())
                    for i in range(len(grouped)):
                        (b1, s1, e1), vars1 = grouped[i]
                        for j in range(i + 1, len(grouped)):
                            (b2, s2, e2), vars2 = grouped[j]
                            if b1 == b2:
                                continue
                            if (s2 - e1) < travel_min and (s1 - e2) < travel_min:
                                if a_t_travel is None:
                                    a_t_travel = make_assumption(
                                        f"a_ttr_{tid}",
                                        {"kind": "t_travel", "priority": 1, "teacher_id": tid, "travel_min": travel_min},
                                    )
                                dmodel.Add(sum(vars1) + sum(vars2) <= 1).OnlyEnforceIf(a_t_travel)

            if not is_double_shift and periods_per_day >= 3 and ((0 < max_consec < periods_per_day) or max_gaps_day > 0):
                busy_vars: List[cp_model.IntVar] = []
                for p in range(periods_per_day):
                    p_vars = teacher_day_period_vars.get((tid, d, p)) or []
                    if not p_vars:
                        busy_vars.append(dmodel.NewConstant(0))
                    elif len(p_vars) == 1:
                        busy_vars.append(p_vars[0])
                    else:
                        bv = dmodel.NewBoolVar(f"dtb_{tid}_{d}_{p}")
                        dmodel.AddMaxEquality(bv, p_vars)
                        busy_vars.append(bv)

                if 0 < max_consec < periods_per_day:
                    if a_t_consec is None:
                        a_t_consec = make_assumption(
                            f"a_tmc_{tid}",
                            {"kind": "t_max_consec", "priority": 1, "teacher_id": tid, "limit": max_consec},
                        )
                    for p in range(periods_per_day - max_consec):
                        dmodel.Add(sum(busy_vars[p : p + max_consec + 1]) <= max_consec).OnlyEnforceIf(a_t_consec)

                if max_gaps_day > 0:
                    has_before = [dmodel.NewConstant(0)]
                    for p in range(1, periods_per_day):
                        hb = dmodel.NewBoolVar(f"dhb_{tid}_{d}_{p}")
                        dmodel.Add(hb >= busy_vars[p - 1])
                        dmodel.Add(hb >= has_before[p - 1])
                        has_before.append(hb)

                    has_after: List[cp_model.IntVar] = [dmodel.NewConstant(0)] * periods_per_day
                    for p in range(periods_per_day - 2, -1, -1):
                        ha = dmodel.NewBoolVar(f"dha_{tid}_{d}_{p}")
                        dmodel.Add(ha >= busy_vars[p + 1])
                        dmodel.Add(ha >= has_after[p + 1])
                        has_after[p] = ha

                    day_gaps: List[cp_model.IntVar] = []
                    for p in range(1, periods_per_day - 1):
                        gp = dmodel.NewBoolVar(f"dgp_{tid}_{d}_{p}")
                        dmodel.Add(gp >= has_before[p] + has_after[p] - busy_vars[p] - 1)
                        day_gaps.append(gp)

                    if day_gaps:
                        if a_t_gaps is None:
                            a_t_gaps = make_assumption(
                                f"a_tmg_{tid}",
                                {"kind": "t_max_gaps", "priority": 1, "teacher_id": tid, "limit": max_gaps_day},
                            )
                        dmodel.Add(sum(day_gaps) <= max_gaps_day).OnlyEnforceIf(a_t_gaps)

        if 0 < max_work_days < num_days and len(working_day_vars) > max_work_days:
            a_t_days = make_assumption(
                f"a_tmdays_{tid}",
                {"kind": "t_max_days", "priority": 1, "teacher_id": tid, "limit": max_work_days},
            )
            dmodel.Add(sum(working_day_vars) <= max_work_days).OnlyEnforceIf(a_t_days)

    # Ortak seçmeli senkronizasyonu
    if common_elective and class_common_hours:
        by_grade_hrs: Dict[Tuple[str, int], List[str]] = defaultdict(list)
        for cid, chrs in class_common_hours.items():
            if chrs > 0 and cid in class_map:
                gkey = str(class_map[cid].get("grade_key") or "")
                by_grade_hrs[(gkey, chrs)].append(cid)
        for (gkey, _chrs), cids in by_grade_hrs.items():
            if len(cids) < 2:
                continue
            a_csync = make_assumption(
                f"a_csync_{gkey}",
                {"kind": "common_sync", "priority": 1, "grade_key": gkey, "class_ids": cids},
            )
            ref_cid = cids[0]
            for other_cid in cids[1:]:
                for d, p in sorted(common_elective):
                    ref_vars = class_common_slot_vars.get((ref_cid, d, p)) or []
                    oth_vars = class_common_slot_vars.get((other_cid, d, p)) or []
                    if ref_vars or oth_vars:
                        dmodel.Add(sum(ref_vars) == sum(oth_vars)).OnlyEnforceIf(a_csync)

    if not assumptions:
        return [], None

    dmodel.AddAssumptions(assumptions)
    dsolver = cp_model.CpSolver()
    dsolver.parameters.max_time_in_seconds = max(1.0, float(max_diag_time_sec))
    dsolver.parameters.num_search_workers = 1
    dstatus = dsolver.Solve(dmodel)

    if dstatus != cp_model.INFEASIBLE:
        return [], None

    core_indices = list(dsolver.SufficientAssumptionsForInfeasibility())
    if not core_indices:
        return [], None

    raw_items: List[Dict[str, Any]] = []
    for idx in core_indices:
        meta = assumption_meta.get(idx)
        if meta:
            raw_items.append(meta)

    # Önce kısıt kaynakları (priority=1), sonra çelişkiye dahil dersler (priority=2)
    kind_order = {
        "fixed": 1,
        "t_unavail": 2,
        "t_max_daily": 3,
        "t_max_days": 4,
        "t_max_consec": 5,
        "t_max_gaps": 6,
        "t_travel": 7,
        "asgn_max_day": 8,
        "room_cap": 9,
        "rtype_cap": 10,
        "common_sync": 11,
        "common_excl": 12,
        "t_overlap": 13,
        "c_overlap": 14,
        "asgn_place": 20,
    }
    raw_items.sort(key=lambda m: (m.get("priority", 99), kind_order.get(m.get("kind", ""), 50)))

    diagnostics: List[Dict[str, Any]] = []
    summary_parts: List[str] = []
    involved_asgn_count = 0

    for meta in raw_items:
        kind = meta.get("kind")

        if kind == "fixed":
            aid = meta["assignment_id"]
            asgn = assignments_by_id[aid]
            cid = asgn["class_id"]
            cname = asgn.get("class_name") or cid
            course_name = asgn.get("course_name") or aid
            day_name = _get_day_name(time_grid, meta["day_index"])
            period_no = int(meta["start_period"]) + 1
            blen = int(meta["length"])
            t_ids = list(asgn.get("teacher_ids") or [])
            links: List[Dict[str, Any]] = []
            if t_ids and t_ids[0] in teacher_map:
                t0 = teacher_map[t_ids[0]]
                links.append({
                    "nav": {"view": "menu3", "teacherId": t_ids[0]},
                    "label": f"{t0.get('name', t_ids[0])} Ayarlarına Git →",
                })
            diagnostics.append({
                "code": "CONFLICT_FIXED_ASSIGNMENT",
                "category": "Sabit / Kilitli Ders",
                "message": (
                    f"Sabit/kilitli ders çelişkiye neden oluyor: {cname} — {course_name} "
                    f"({day_name} {period_no}. ders, {blen} sa). Bu kilidi kaldırıp tekrar deneyin."
                ),
                "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                "linkLabel": f"{cname} Sabit Dersine Git →",
                "links": links,
            })
            summary_parts.append(f"Sabit ders ({cname} {course_name}, {day_name} {period_no}. ders)")

        elif kind == "t_unavail":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            unavail_cnt = len(teacher_unavail.get(tid, set()))
            diagnostics.append({
                "code": "CONFLICT_TEACHER_UNAVAILABLE",
                "category": "Öğretmen Kapalı Saatleri",
                "message": (
                    f"{tname} öğretmeninin kapalı saatleri ({unavail_cnt} kapalı saat) "
                    f"atanmış ders bloklarıyla çelişiyor; dersleri kalan açık saatlere sığmıyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Kapalı Saatlerine Git →",
            })
            summary_parts.append(f"{tname} (kapalı saatler)")

        elif kind == "t_max_daily":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            lim = int(meta["limit"])
            diagnostics.append({
                "code": "CONFLICT_TEACHER_DAILY_MAX",
                "category": "Öğretmen Günlük Sınırı",
                "message": (
                    f"{tname} öğretmeninin günlük maksimum ders sınırı (en fazla {lim} sa/gün) "
                    f"mevcut ders blokları ve diğer kısıtlarla çelişiyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Günlük Sınırına Git →",
            })
            summary_parts.append(f"{tname} (günlük maks. {lim} sa)")

        elif kind == "t_max_days":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            lim = int(meta["limit"])
            diagnostics.append({
                "code": "CONFLICT_TEACHER_MAX_DAYS",
                "category": "Öğretmen Çalışma Günü",
                "message": (
                    f"{tname} öğretmeninin çalışılabilir gün sınırı (en fazla {lim} gün) "
                    f"atanmış ders bloklarıyla çelişiyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Gün Sınırına Git →",
            })
            summary_parts.append(f"{tname} (maks. {lim} gün)")

        elif kind == "t_max_consec":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            lim = int(meta["limit"])
            diagnostics.append({
                "code": "CONFLICT_TEACHER_MAX_CONSECUTIVE",
                "category": "Öğretmen Ardışık Sınırı",
                "message": (
                    f"{tname} öğretmeninin ardışık maksimum ders sınırı (en fazla {lim} saat) "
                    f"mevcut bloklar ve açık saatlerle çelişiyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Ardışık Sınırına Git →",
            })
            summary_parts.append(f"{tname} (ardışık maks. {lim} sa)")

        elif kind == "t_max_gaps":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            lim = int(meta["limit"])
            diagnostics.append({
                "code": "CONFLICT_TEACHER_MAX_GAPS",
                "category": "Öğretmen Pencere Sınırı",
                "message": (
                    f"{tname} öğretmeninin günlük maksimum pencere (boşluk) sınırı (en fazla {lim} pencere) "
                    f"diğer kısıtlarla çelişiyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Pencere Sınırına Git →",
            })
            summary_parts.append(f"{tname} (maks. {lim} pencere)")

        elif kind == "t_travel":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            tmin = int(meta["travel_min"])
            diagnostics.append({
                "code": "CONFLICT_BUILDING_TRAVEL",
                "category": "Bina Geçiş Süresi",
                "message": (
                    f"{tname} öğretmeninin farklı binalardaki dersleri arasında en az {tmin} dk "
                    f"geçiş süresi kuralı sağlanamıyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Ayarlarına Git →",
            })
            summary_parts.append(f"{tname} (bina geçiş süresi)")

        elif kind == "asgn_max_day":
            aid = meta["assignment_id"]
            asgn = assignments_by_id[aid]
            cid = asgn["class_id"]
            cname = asgn.get("class_name") or cid
            course_name = asgn.get("course_name") or aid
            lim = int(meta["max_per_day"])
            diagnostics.append({
                "code": "CONFLICT_COURSE_MAX_PER_DAY",
                "category": "Ders Günlük Blok Sınırı",
                "message": (
                    f"{cname} — {course_name} dersinin aynı gün en fazla {lim} blok kuralı "
                    f"mevcut açık günler ve öğretmen müsaitliğiyle çelişiyor."
                ),
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Ders Bloklarına Git →",
                "links": [{"nav": {"view": "menu4", "classId": cid, "search": course_name}, "label": "Ders Atamasına Git →"}],
            })
            summary_parts.append(f"{cname} {course_name} (günlük maks. {lim} blok)")

        elif kind == "room_cap":
            rid = meta["room_id"]
            rm = room_map.get(rid, {})
            rname = rm.get("name", rid)
            cap = int(rm.get("simultaneous_capacity") or 1)
            diagnostics.append({
                "code": "CONFLICT_ROOM_CAPACITY",
                "category": "Özel Mekan Kapasitesi",
                "message": (
                    f"{rname} özel mekanının eşzamanlı kapasitesi ({cap} sınıf) "
                    f"atanmış derslerin uygun zamanlarıyla çakışıyor."
                ),
                "nav": {"view": "menu4", "focus": "rooms"},
                "linkLabel": f"{rname} Mekan Ayarlarına Git →",
            })
            summary_parts.append(f"{rname} (mekan kapasitesi)")

        elif kind == "rtype_cap":
            rtype = meta["room_type"]
            diagnostics.append({
                "code": "CONFLICT_ROOM_TYPE_CAPACITY",
                "category": "Özel Mekan Havuzu",
                "message": (
                    f"'{rtype}' türündeki özel mekan havuzunun kapasitesi "
                    f"atanmış derslerin uygun saatlerine yetmiyor."
                ),
                "nav": {"view": "menu4", "focus": "rooms"},
                "linkLabel": "Özel Mekanlara Git →",
            })
            summary_parts.append(f"'{rtype}' mekan havuzu")

        elif kind == "common_sync":
            gkey = meta.get("grade_key") or ""
            cids = meta.get("class_ids") or []
            cnames = ", ".join(class_map[c].get("name", c) for c in cids[:6] if c in class_map)
            diagnostics.append({
                "code": "CONFLICT_COMMON_ELECTIVE_SYNC",
                "category": "Ortak Seçmeli Eşzamanlama",
                "message": (
                    f"{gkey}. sınıf şubelerinin ({cnames}) ortak seçmeli dersleri aynı saatlere "
                    f"senkronize edilemiyor; ortak seçmeli slotlarını veya öğretmen müsaitliklerini kontrol edin."
                ),
                "nav": {"view": "menu1"},
                "linkLabel": "Ortak Seçmeli Saatlerine Git →",
            })
            summary_parts.append(f"{gkey}. sınıf ortak seçmeli eşzamanlama")

        elif kind == "common_excl":
            diagnostics.append({
                "code": "CONFLICT_COMMON_ELECTIVE_EXCLUSIVITY",
                "category": "Ortak Seçmeli Alanı",
                "message": (
                    "Ortak seçmeli saatlerinin diğer derslere kapalı olması nedeniyle "
                    "normal ders blokları kalan açık saatlere sığmıyor."
                ),
                "nav": {"view": "menu1"},
                "linkLabel": "Ortak Seçmeli Saatlerine Git →",
            })
            summary_parts.append("Ortak seçmeli saat sınırı")

        elif kind == "t_overlap":
            tid = meta["teacher_id"]
            t = teacher_map.get(tid, {})
            tname = t.get("name", tid)
            diagnostics.append({
                "code": "CONFLICT_TEACHER_OVERLAP",
                "category": "Öğretmen Saat Çakışması",
                "message": (
                    f"{tname} öğretmenine atanmış dersler aynı zaman dilimlerine sıkışıyor "
                    f"ve çakışmadan yerleşemiyor."
                ),
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Ayarlarına Git →",
                "links": [{"nav": {"view": "menu4"}, "label": "Ders Dağılımına Git →"}],
            })
            summary_parts.append(f"{tname} (ders çakışması)")

        elif kind == "c_overlap":
            cid = meta["class_id"]
            cls = class_map.get(cid, {})
            cname = cls.get("name", cid)
            diagnostics.append({
                "code": "CONFLICT_CLASS_OVERLAP",
                "category": "Şube Saat / Blok Sığmama",
                "message": (
                    f"{cname} şubesinin ders blokları okulun açık saatlerine çakışmadan sığmıyor "
                    f"(blok uzunlukları, öğle arası veya kapalı saatleri kontrol edin)."
                ),
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Ders/Bloklarına Git →",
                "links": [{"nav": {"view": "menu1"}, "label": "Zaman Çizelgesine Git →"}],
            })
            summary_parts.append(f"{cname} şubesi (blok/saat çakışması)")

        elif kind == "asgn_place":
            if involved_asgn_count >= 8:
                continue
            involved_asgn_count += 1
            aid = meta["assignment_id"]
            asgn = assignments_by_id[aid]
            cid = asgn["class_id"]
            cname = asgn.get("class_name") or cid
            course_name = asgn.get("course_name") or aid
            blocks_str = "+".join(str(b) for b in (asgn.get("blocks") or []))
            t_ids = list(asgn.get("teacher_ids") or [])
            t_names = ", ".join(teacher_map[tid].get("name", tid) for tid in t_ids if tid in teacher_map)
            links = [{"nav": {"view": "menu2", "classId": cid}, "label": f"{cname} Blokları →"}]
            if t_ids and t_ids[0] in teacher_map:
                t0 = teacher_map[t_ids[0]]
                links.append({"nav": {"view": "menu3", "teacherId": t_ids[0]}, "label": f"{t0.get('name', t_ids[0])} →"})
            diagnostics.append({
                "code": "CONFLICT_INVOLVED_ASSIGNMENT",
                "category": "Çelişkiye Dahil Ders",
                "message": (
                    f"{cname} — {course_name} (blok: {blocks_str}, öğretmen: {t_names or '—'}) "
                    f"bu çelişki grubunun parçası."
                ),
                "nav": {"view": "menu4", "classId": cid, "search": course_name},
                "linkLabel": f"{cname} {course_name} Atamasına Git →",
                "links": links,
            })

    if not diagnostics:
        return [], None

    unique_summary = list(dict.fromkeys(summary_parts))[:4]
    if unique_summary:
        summary_msg = "Çelişki kaynağı tespit edildi: " + ", ".join(unique_summary) + "."
    else:
        summary_msg = diagnostics[0]["message"]

    return diagnostics, summary_msg


def solve_timetable(config: Dict[str, Any]) -> Dict[str, Any]:
    t0 = time.perf_counter()
    emit_progress("validating", "Model kontrol ediliyor")

    validation = validate_model(config)
    total_blocks = int((validation.get("summary") or {}).get("total_blocks") or 0)
    if total_blocks == 0:
        for asgn in config.get("assignments") or []:
            total_blocks += len(asgn.get("blocks") or [])

    is_max_mode_early = str((config.get("solution_request") or {}).get("mode") or "") == "maximize_placement"
    fatal_in_max = {"INVALID_GRID", "NO_ASSIGNMENTS", "MISSING_CLASS", "NO_TEACHER_ASSIGNED", "BLOCK_SUM_MISMATCH", "DUPLICATE_FIXED_BLOCK"}
    blocking_val_errors = [e for e in (validation.get("errors") or []) if (not is_max_mode_early) or (e.get("code") in fatal_in_max)]
    if blocking_val_errors:
        unplaced = []
        for asgn in config.get("assignments") or []:
            for b_idx, blen in enumerate(asgn.get("blocks") or []):
                unplaced.append({
                    "assignment_id": asgn.get("assignment_id"),
                    "block_index": b_idx,
                    "class_id": asgn.get("class_id"),
                    "class_name": asgn.get("class_name"),
                    "course_id": asgn.get("course_id"),
                    "course_code": asgn.get("course_code"),
                    "course_name": asgn.get("course_name"),
                    "teacher_ids": asgn.get("teacher_ids") or [],
                    "room_id": asgn.get("room_id"),
                    "length": int(blen),
                })
        return {
            "engine": ENGINE_NAME,
            "status": "INFEASIBLE",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": total_blocks,
            "placements": [],
            "unplaced": unplaced,
            "diagnostics": validation["errors"],
            "message": validation["errors"][0]["message"] if validation["errors"] else "Model ön denetimden geçemedi.",
        }

    time_grid = config.get("time_grid") or {}
    num_days, periods_per_day, blocked, common_elective, lunch_after, long_break_after = extract_grid_sets(time_grid)
    intervals = build_time_intervals(time_grid)

    classes = config.get("classes") or []
    teachers = config.get("teachers") or []
    rooms = config.get("rooms") or []
    assignments = config.get("assignments") or []

    class_map = {c["id"]: c for c in classes}
    teacher_map = {t["id"]: t for t in teachers}
    room_map = {r["id"]: r for r in rooms}
    rooms_by_type: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rooms:
        rooms_by_type[r.get("room_type") or "standard"].append(r)
    assignments_by_id = {a["assignment_id"]: a for a in assignments}

    has_common_elective_courses = any(bool(a.get("use_common_elective_slot")) for a in assignments)
    enforce_common_exclusivity = bool(common_elective) and has_common_elective_courses

    teacher_unavail = {tid: get_teacher_unavailable_set(t, num_days, periods_per_day) for tid, t in teacher_map.items()}
    teacher_avoid = {tid: get_teacher_prefer_avoid_set(t, num_days, periods_per_day) for tid, t in teacher_map.items()}

    resolved_fixed, _ = resolve_fixed_assignments(config.get("fixed_assignments") or [], assignments_by_id)

    sol_req = config.get("solution_request") or {}
    solver_cfg = config.get("solver_config") or {}
    pref_key = sol_req.get("preference") or solver_cfg.get("preference") or "balanced"
    if pref_key not in PREFERENCE_WEIGHTS:
        pref_key = "balanced"
    weights = PREFERENCE_WEIGHTS[pref_key]

    max_time_sec = float(
        solver_cfg.get("max_time_seconds")
        or solver_cfg.get("timeLimitSec")
        or 60
    )
    max_time_sec = max(1.0, min(600.0, max_time_sec))

    # =========================================================================
    # CP-SAT MODEL KURULUMU
    # =========================================================================
    emit_progress("solving", "OR-Tools çözüm arıyor")
    model = cp_model.CpModel()

    # x[(aid, b_idx, d, p)] -> BoolVar
    x: Dict[Tuple[str, int, int, int], cp_model.IntVar] = {}
    block_candidates: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar]]] = {}
    block_meta: Dict[Tuple[str, int], Dict[str, Any]] = {}

    # Fiziksel zaman çakışma indeksleri: (entity_id, day) -> [(start_min, end_min, var, length)]
    class_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    teacher_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    teacher_day_period_vars: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
    room_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    room_type_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, cp_model.IntVar, int]]] = defaultdict(list)
    asgn_day_vars: Dict[Tuple[str, int], List[cp_model.IntVar]] = defaultdict(list)
    teacher_building_day_vars: Dict[Tuple[str, int], List[Tuple[int, int, str, cp_model.IntVar]]] = defaultdict(list)
    class_common_slot_vars: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
    class_common_hours: Dict[str, int] = defaultdict(int)

    school_cfg = config.get("school") or {}
    travel_min = int(school_cfg.get("building_travel_minutes") or 0)

    objective_terms: List[cp_model.LinearExpr] = []
    pre_unplaced_diags: List[Tuple[Tuple[str, int], Dict[str, Any]]] = []

    for asgn in assignments:
        aid = asgn["assignment_id"]
        cid = asgn["class_id"]
        cls = class_map[cid]
        cls_shift = cls.get("shift") or "full_day"
        t_ids = list(asgn.get("teacher_ids") or [])
        base_room_id = asgn.get("room_id")
        room_type = asgn.get("room_type") or "standard"
        use_common = bool(asgn.get("use_common_elective_slot"))
        t_unavails = [teacher_unavail[tid] for tid in t_ids]
        blocks = [int(b) for b in (asgn.get("blocks") or [])]
        if use_common:
            class_common_hours[cid] += sum(blocks)

        for b_idx, blen in enumerate(blocks):
            key = (aid, b_idx)
            fa_entry = resolved_fixed.get(key)
            eff_room_id = (fa_entry.get("room_id") if fa_entry and fa_entry.get("room_id") else base_room_id)
            block_meta[key] = {
                "assignment": asgn,
                "length": blen,
                "shift": cls_shift,
                "room_id": eff_room_id,
            }

            if fa_entry is not None:
                valid_starts = [(fa_entry["day_index"], fa_entry["start_period"])]
            else:
                _, valid_starts = compute_valid_starts_for_block(
                    length=blen,
                    num_days=num_days,
                    periods_per_day=periods_per_day,
                    blocked=blocked,
                    common_elective=common_elective,
                    use_common_elective=use_common,
                    enforce_common_elective_exclusivity=enforce_common_exclusivity,
                    lunch_after=lunch_after,
                    long_break_after=long_break_after,
                    class_shift=cls_shift,
                    teacher_unavail_sets=t_unavails,
                )

            # Kesin kural: normal modda hiç uygun aday yoksa sessiz atlama YOK -> INFEASIBLE
            # Maksimumda Bitir (maximize_placement) modunda bu blok yerleşemeyen olarak raporlanır, diğerleri yerleştirilir.
            is_maximize_mode = str(sol_req.get("mode") or "") == "maximize_placement"
            if not valid_starts:
                links: List[Dict[str, Any]] = [
                    {"nav": {"view": "menu2", "classId": cid}, "label": f"{asgn.get('class_name')} Bloklarına Git →"},
                    {"nav": {"view": "menu4", "classId": cid, "search": asgn.get("course_name") or ""}, "label": f"{asgn.get('class_name')} Ders Atamasına Git →"},
                ]
                primary_nav: Dict[str, Any] = {"view": "menu4", "classId": cid, "search": asgn.get("course_name") or ""}
                primary_label = f"{asgn.get('class_name')} Dersine Git →"
                if t_ids and t_ids[0] in teacher_map:
                    t0_name = teacher_map[t_ids[0]].get("name", t_ids[0])
                    primary_nav = {"view": "menu3", "teacherId": t_ids[0]}
                    primary_label = f"{t0_name} Kapalı Saatlerine Git →"
                diag_entry = {
                    "code": "NO_VALID_START",
                    "category": "Uygun Saat Bulunamadı",
                    "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} ({blen} sa blok) yerleştirilemiyor: Öğretmen kapalı saatleri, öğle arası veya okul kapalı saatleri nedeniyle uygun aralık yok. Öneri: Öğretmenin kapalı saatlerini açın veya blok uzunluğunu küçültün.",
                    "nav": primary_nav,
                    "linkLabel": primary_label,
                    "links": links,
                }
                if is_maximize_mode and key not in resolved_fixed:
                    block_candidates[key] = []
                    pre_unplaced_diags.append((key, diag_entry))
                    continue
                return {
                    "engine": ENGINE_NAME,
                    "status": "INFEASIBLE",
                    "solve_time_sec": round(time.perf_counter() - t0, 3),
                    "placed_blocks": 0,
                    "total_blocks": total_blocks,
                    "placements": [],
                    "unplaced": [],
                    "diagnostics": [diag_entry],
                    "message": f"{asgn.get('class_name')} - {asgn.get('course_name')} dersi için uygun zaman bulunamadı.",
                }

            blk_building = None
            if eff_room_id and eff_room_id in room_map and room_map[eff_room_id].get("building"):
                blk_building = str(room_map[eff_room_id]["building"]).strip()
            elif cls.get("building"):
                blk_building = str(cls["building"]).strip()

            cands: List[Tuple[int, int, cp_model.IntVar]] = []
            for d, p in valid_starts:
                var = model.NewBoolVar(f"x_{aid}_{b_idx}_{d}_{p}")
                x[(aid, b_idx, d, p)] = var
                cands.append((d, p, var))

                span_s, span_e = get_block_physical_span(intervals, cls_shift, p, blen)
                class_day_vars[(cid, d)].append((span_s, span_e, var, blen))
                asgn_day_vars[(aid, d)].append(var)

                if use_common:
                    for k in range(blen):
                        class_common_slot_vars[(cid, d, p + k)].append(var)

                for tid in t_ids:
                    teacher_day_vars[(tid, d)].append((span_s, span_e, var, blen))
                    if travel_min > 0 and blk_building:
                        teacher_building_day_vars[(tid, d)].append((span_s, span_e, blk_building, var))
                    for k in range(blen):
                        teacher_day_period_vars[(tid, d, p + k)].append(var)
                        if (d, p + k) in teacher_avoid[tid]:
                            objective_terms.append(weights["avoid"] * var)

                if eff_room_id:
                    room_day_vars[(eff_room_id, d)].append((span_s, span_e, var, blen))
                elif room_type != "standard" and rooms_by_type.get(room_type):
                    room_type_day_vars[(room_type, d)].append((span_s, span_e, var, blen))

            block_candidates[key] = cands
            # Kural 1: Normal modda her blok tam 1 kez yerleşir; Maksimumda Bitir modunda kilitli olmayan bloklar isteğe bağlı + çok yüksek ödüllüdür
            if is_maximize_mode and key not in resolved_fixed:
                model.AddAtMostOne([v for _, _, v in cands])
                unplaced_v = model.NewBoolVar(f"unpl_{aid}_{b_idx}")
                model.Add(sum(v for _, _, v in cands) + unplaced_v == 1)
                objective_terms.append((10000 * blen) * unplaced_v)
            else:
                model.AddExactlyOne([v for _, _, v in cands])

        # Aynı uzunlukta ve sabitlenmemiş ardışık bloklar arasında simetri kırma (maximize_placement dışında)
        if len(blocks) > 1 and str(sol_req.get("mode") or "") != "maximize_placement":
            for b_idx in range(len(blocks) - 1):
                k1 = (aid, b_idx)
                k2 = (aid, b_idx + 1)
                if blocks[b_idx] == blocks[b_idx + 1] and k1 not in resolved_fixed and k2 not in resolved_fixed:
                    pos1 = sum((d * periods_per_day + p) * v for d, p, v in block_candidates[k1])
                    pos2 = sum((d * periods_per_day + p) * v for d, p, v in block_candidates[k2])
                    model.Add(pos1 < pos2)

    # Kural 2: Şube çakışması yok (fiziksel zaman aralıkları)
    for (_cid, _d), items in class_day_vars.items():
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > 1:
                model.AddAtMostOne(covering)

    # Kural 3: Öğretmen çakışması yok (fiziksel zaman aralıkları — ikili öğretim dahil)
    for (_tid, _d), items in teacher_day_vars.items():
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > 1:
                model.AddAtMostOne(covering)

    # Kural 5: Özel derslik kapasitesi (açıkça seçilmiş room_id)
    for (rid, _d), items in room_day_vars.items():
        cap = int(room_map[rid].get("simultaneous_capacity") or 1)
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > cap:
                if cap == 1:
                    model.AddAtMostOne(covering)
                else:
                    model.Add(sum(covering) <= cap)

    # Kural 5b: Özel derslik türü havuzu kapasitesi
    for (rtype, _d), items in room_type_day_vars.items():
        pool = rooms_by_type.get(rtype) or []
        total_cap = sum(int(r.get("simultaneous_capacity") or 1) for r in pool)
        start_points = sorted({s for s, _, _, _ in items})
        for t_pt in start_points:
            covering = [v for s, e, v, _ in items if s <= t_pt < e]
            if len(covering) > total_cap:
                if total_cap == 1:
                    model.AddAtMostOne(covering)
                else:
                    model.Add(sum(covering) <= total_cap)

    # Kural 8a: Aynı dersin günlük blok sayısı sınırı + günlere yayma hedefi
    for asgn in assignments:
        aid = asgn["assignment_id"]
        max_per_day = int(asgn.get("max_blocks_per_day") or 1)
        day_active_vars: List[cp_model.IntVar] = []
        for d in range(num_days):
            d_vars = asgn_day_vars.get((aid, d)) or []
            if not d_vars:
                day_active_vars.append(model.NewConstant(0))
                continue
            if max_per_day > 0:
                if max_per_day == 1 and len(d_vars) > 1:
                    model.AddAtMostOne(d_vars)
                elif len(d_vars) > max_per_day:
                    model.Add(sum(d_vars) <= max_per_day)

            # Günlere yayma yumuşak cezası: aynı gün 1'den fazla blok veya ardışık günler
            if max_per_day > 1 and len(d_vars) > 1 and weights["spread"] > 0:
                extra = model.NewIntVar(0, max_per_day, f"extra_{aid}_{d}")
                model.Add(extra >= sum(d_vars) - 1)
                objective_terms.append(weights["spread"] * extra)

            if len(asgn.get("blocks") or []) > 1 and len(asgn.get("blocks") or []) <= (num_days + 1) // 2:
                has_day = model.NewBoolVar(f"ad_{aid}_{d}")
                model.AddMaxEquality(has_day, d_vars)
                day_active_vars.append(has_day)
            else:
                day_active_vars.append(model.NewConstant(0))

        # Az bloklu derslerin arka arkaya günlere yığılmasını hafifçe cezalandır
        if len(asgn.get("blocks") or []) > 1 and len(asgn.get("blocks") or []) <= (num_days + 1) // 2 and weights["spread"] > 0:
            for d in range(num_days - 1):
                adj = model.NewBoolVar(f"adj_{aid}_{d}")
                model.Add(adj >= day_active_vars[d] + day_active_vars[d + 1] - 1)
                objective_terms.append((weights["spread"] // 2) * adj)

    # Kural 8b & 11: Öğretmen günlük maks saat, ardışık maks saat, boş pencere, çalışılabilir gün ve denge hedefleri
    is_double_shift = isinstance(time_grid.get("bell_schedule"), dict)
    for tid, t in teacher_map.items():
        max_daily = int(t.get("max_daily_hours") or periods_per_day)
        max_consec = int(t.get("max_consecutive_hours") or 0)
        max_gaps_day = int(t.get("max_daily_gaps") or 0)
        max_work_days = int(t.get("max_working_days") or 0)

        day_loads: List[cp_model.LinearExpr] = []
        working_day_vars: List[cp_model.IntVar] = []
        has_any_var = False

        for d in range(num_days):
            items = teacher_day_vars.get((tid, d)) or []
            if not items:
                continue
            has_any_var = True
            day_load = sum(blen * v for _, _, v, blen in items)
            model.Add(day_load <= max_daily)
            day_loads.append(day_load)

            if 0 < max_work_days < num_days:
                wd = model.NewBoolVar(f"wd_{tid}_{d}")
                model.AddMaxEquality(wd, [v for _, _, v, _ in items])
                working_day_vars.append(wd)

            # Bina geçiş süresi kısıtı (farklı binalardaki iki ders arasında en az travel_min dk boşluk)
            if travel_min > 0:
                b_items = teacher_building_day_vars.get((tid, d)) or []
                if len(b_items) >= 2:
                    by_bspan: Dict[Tuple[str, int, int], List[cp_model.IntVar]] = defaultdict(list)
                    for bs, be, bname, bv in b_items:
                        by_bspan[(bname, bs, be)].append(bv)
                    grouped = list(by_bspan.items())
                    for i in range(len(grouped)):
                        (b1, s1, e1), vars1 = grouped[i]
                        for j in range(i + 1, len(grouped)):
                            (b2, s2, e2), vars2 = grouped[j]
                            if b1 == b2:
                                continue
                            # İki farklı binadaki derslerin arası travel_min'den azsa birlikte seçilemez
                            if (s2 - e1) < travel_min and (s1 - e2) < travel_min:
                                model.Add(sum(vars1) + sum(vars2) <= 1)

            # Boş pencere (gap) ve ardışık ders sınırı (tekli öğretimde doğrudan periyot dizisi üzerinde)
            if not is_double_shift and periods_per_day >= 3:
                busy_vars: List[cp_model.IntVar] = []
                for p in range(periods_per_day):
                    p_vars = teacher_day_period_vars.get((tid, d, p)) or []
                    if not p_vars:
                        busy_vars.append(model.NewConstant(0))
                    elif len(p_vars) == 1:
                        busy_vars.append(p_vars[0])
                    else:
                        bv = model.NewBoolVar(f"tb_{tid}_{d}_{p}")
                        model.Add(bv == sum(p_vars))
                        busy_vars.append(bv)

                # Ardışık maksimum ders saati (isteğe bağlı sert kural)
                if max_consec > 0 and max_consec < periods_per_day:
                    for p in range(periods_per_day - max_consec):
                        model.Add(sum(busy_vars[p : p + max_consec + 1]) <= max_consec)

                # O(P) doğrusal boş pencere (gap) hesaplaması
                if weights["gap"] > 0 or max_gaps_day > 0:
                    has_before = [model.NewConstant(0)]
                    for p in range(1, periods_per_day):
                        hb = model.NewBoolVar(f"hb_{tid}_{d}_{p}")
                        model.Add(hb >= busy_vars[p - 1])
                        model.Add(hb >= has_before[p - 1])
                        has_before.append(hb)

                    has_after: List[cp_model.IntVar] = [model.NewConstant(0)] * periods_per_day
                    for p in range(periods_per_day - 2, -1, -1):
                        ha = model.NewBoolVar(f"ha_{tid}_{d}_{p}")
                        model.Add(ha >= busy_vars[p + 1])
                        model.Add(ha >= has_after[p + 1])
                        has_after[p] = ha

                    day_gaps: List[cp_model.IntVar] = []
                    for p in range(1, periods_per_day - 1):
                        gp = model.NewBoolVar(f"gp_{tid}_{d}_{p}")
                        model.Add(gp >= has_before[p] + has_after[p] - busy_vars[p] - 1)
                        day_gaps.append(gp)
                        if weights["gap"] > 0:
                            objective_terms.append(weights["gap"] * gp)

                    if max_gaps_day > 0 and day_gaps:
                        model.Add(sum(day_gaps) <= max_gaps_day)

        if 0 < max_work_days < num_days and len(working_day_vars) > max_work_days:
            model.Add(sum(working_day_vars) <= max_work_days)

        if has_any_var and len(day_loads) > 1 and weights["balance"] > 0:
            max_day_load = model.NewIntVar(0, max_daily, f"mdl_{tid}")
            for dl in day_loads:
                model.Add(max_day_load >= dl)
            objective_terms.append(weights["balance"] * max_day_load)

    # Kural 9b: Aynı sınıf düzeyinde ortak seçmeli dersi olan şubelerin ortak seçmeli saatlerini senkronize et
    if common_elective and class_common_hours:
        by_grade_hrs: Dict[Tuple[str, int], List[str]] = defaultdict(list)
        for cid, chrs in class_common_hours.items():
            if chrs > 0 and cid in class_map:
                gkey = str(class_map[cid].get("grade_key") or "")
                by_grade_hrs[(gkey, chrs)].append(cid)
        for (_gkey, _chrs), cids in by_grade_hrs.items():
            if len(cids) < 2:
                continue
            ref_cid = cids[0]
            for other_cid in cids[1:]:
                for d, p in sorted(common_elective):
                    ref_vars = class_common_slot_vars.get((ref_cid, d, p)) or []
                    oth_vars = class_common_slot_vars.get((other_cid, d, p)) or []
                    if ref_vars or oth_vars:
                        model.Add(sum(ref_vars) == sum(oth_vars))

    # Kural 9c (Pedagojik Kural): Aynı öğretmen aynı sınıfa aynı gün birden fazla FARKLI dersle (kendi branşı + branş dışı/ek ders) girmesin
    tc_multi_mode = str(
        sol_req.get("same_teacher_class_multi_course_mode")
        or (config.get("school") or {}).get("same_teacher_class_multi_course_mode")
        or "soft"
    ).lower()
    if tc_multi_mode in ("soft", "hard"):
        tc_assignments: Dict[Tuple[str, str], List[str]] = defaultdict(list)
        for asgn in assignments:
            cid_k = asgn["class_id"]
            aid_k = asgn["assignment_id"]
            for tid_k in (asgn.get("teacher_ids") or []):
                tc_assignments[(tid_k, cid_k)].append(aid_k)
        for (tid_k, cid_k), aids_list in tc_assignments.items():
            # Yalnızca aynı öğretmen aynı sınıfta 2+ farklı derse giriyorsa uygula
            if len(aids_list) < 2:
                continue
            for d in range(num_days):
                course_day_flags: List[cp_model.IntVar] = []
                for aid_k in aids_list:
                    avars = asgn_day_vars.get((aid_k, d)) or []
                    if not avars:
                        continue
                    flag = model.NewBoolVar(f"tcm_{tid_k}_{cid_k}_{aid_k}_{d}")
                    model.AddMaxEquality(flag, avars)
                    course_day_flags.append(flag)
                if len(course_day_flags) >= 2:
                    if tc_multi_mode == "hard":
                        model.Add(sum(course_day_flags) <= 1)
                    else:
                        excess = model.NewIntVar(0, len(course_day_flags) - 1, f"tcm_ex_{tid_k}_{cid_k}_{d}")
                        model.Add(excess >= sum(course_day_flags) - 1)
                        objective_terms.append(35 * excess)

    # Kural 12 (Aşama 3): En Az Değişiklikle Onarma (repair_min_changes)
    req_mode = str(sol_req.get("mode") or "full_solve")
    prev_placements_raw = (
        config.get("previous_placements")
        or sol_req.get("previous_placements")
        or []
    )
    prev_map: Dict[Tuple[str, int], Tuple[int, int]] = {}
    if prev_placements_raw:
        resolved_prev, _ = resolve_fixed_assignments(prev_placements_raw, assignments_by_id)
        for pkey, pinfo in resolved_prev.items():
            prev_map[pkey] = (pinfo["day_index"], pinfo["start_period"])

    if req_mode == "repair_min_changes" and prev_map:
        CHANGE_BLOCK_PENALTY = 1000
        CHANGE_ENTITY_PENALTY = 300
        teacher_moved_vars: Dict[str, List[cp_model.IntVar]] = defaultdict(list)
        class_moved_vars: Dict[str, List[cp_model.IntVar]] = defaultdict(list)

        for key, (prev_d, prev_p) in prev_map.items():
            if key in resolved_fixed or key not in block_candidates:
                continue
            aid, b_idx = key
            asgn = assignments_by_id[aid]
            stay_var = x.get((aid, b_idx, prev_d, prev_p))
            if stay_var is not None:
                moved = model.NewBoolVar(f"mv_{aid}_{b_idx}")
                model.Add(moved + stay_var == 1)
                model.AddHint(stay_var, 1)
                objective_terms.append(CHANGE_BLOCK_PENALTY * moved)
                class_moved_vars[asgn["class_id"]].append(moved)
                for tid in asgn.get("teacher_ids") or []:
                    teacher_moved_vars[tid].append(moved)

        for cid_k, mvars in class_moved_vars.items():
            if not mvars:
                continue
            cls_changed = model.NewBoolVar(f"cchg_{cid_k}")
            model.AddMaxEquality(cls_changed, mvars)
            objective_terms.append(CHANGE_ENTITY_PENALTY * cls_changed)

        for tid_k, mvars in teacher_moved_vars.items():
            if not mvars:
                continue
            tch_changed = model.NewBoolVar(f"tchg_{tid_k}")
            model.AddMaxEquality(tch_changed, mvars)
            objective_terms.append(CHANGE_ENTITY_PENALTY * tch_changed)

    if objective_terms:
        model.Minimize(sum(objective_terms))

    # =========================================================================
    # CP-SAT ÇÖZÜM
    # =========================================================================
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_time_sec
    num_workers = int(solver_cfg.get("numWorkers") or min(8, os.cpu_count() or 4))
    solver.parameters.num_search_workers = max(1, min(16, num_workers))
    if req_mode not in ("regenerate", "full_solve_fresh"):
        solver.parameters.random_seed = 42

    status_code = solver.Solve(model)
    status_name = solver.StatusName(status_code)
    solve_time = round(time.perf_counter() - t0, 3)

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        if status_name == "INFEASIBLE":
            try:
                core_diags, core_summary = diagnose_infeasibility(
                    config=config,
                    time_grid=time_grid,
                    num_days=num_days,
                    periods_per_day=periods_per_day,
                    blocked=blocked,
                    common_elective=common_elective,
                    lunch_after=lunch_after,
                    long_break_after=long_break_after,
                    intervals=intervals,
                    class_map=class_map,
                    teacher_map=teacher_map,
                    room_map=room_map,
                    rooms_by_type=rooms_by_type,
                    assignments=assignments,
                    assignments_by_id=assignments_by_id,
                    teacher_unavail=teacher_unavail,
                    resolved_fixed=resolved_fixed,
                    enforce_common_exclusivity=enforce_common_exclusivity,
                    travel_min=travel_min,
                    max_diag_time_sec=min(8.0, max_time_sec),
                )
            except Exception:
                core_diags, core_summary = [], None

            solve_time = round(time.perf_counter() - t0, 3)
            if core_diags:
                return {
                    "engine": ENGINE_NAME,
                    "status": status_name,
                    "solve_time_sec": solve_time,
                    "placed_blocks": 0,
                    "total_blocks": total_blocks,
                    "placements": [],
                    "unplaced": [],
                    "diagnostics": core_diags,
                    "message": core_summary or core_diags[0]["message"],
                }

        diag_msg = (
            "Kısıtlar birbiriyle çelişiyor; öğretmen kapalı saatleri, günlük sınırlar, özel mekanlar veya sabit dersleri kontrol edin."
            if status_name == "INFEASIBLE"
            else (
                f"Belirlenen sürede ({int(max_time_sec)} sn) geçerli bir çözüm bulunamadı."
                if status_name == "UNKNOWN"
                else "Model kurulumunda geçersiz bir durum oluştu."
            )
        )
        fallback_links = [
            {"nav": {"view": "menu3"}, "label": "Öğretmen Kısıtlarına Git →"},
            {"nav": {"view": "menu2"}, "label": "Sınıf/Bloklara Git →"},
            {"nav": {"view": "menu4", "focus": "rooms"}, "label": "Özel Mekanlara Git →"},
            {"nav": {"view": "menu1"}, "label": "Zaman Çizelgesine Git →"},
        ] if status_name == "INFEASIBLE" else []
        return {
            "engine": ENGINE_NAME,
            "status": status_name,
            "solve_time_sec": solve_time,
            "placed_blocks": 0,
            "total_blocks": total_blocks,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{
                "code": status_name,
                "category": "Kısıt Çelişkisi" if status_name == "INFEASIBLE" else status_name,
                "message": diag_msg,
                "nav": {"view": "menu3"} if status_name == "INFEASIBLE" else {"view": "menu5"},
                "linkLabel": "Öğretmen Kısıtlarına Git →" if status_name == "INFEASIBLE" else "Dağıtım Ayarlarına Git →",
                "links": fallback_links[1:] if len(fallback_links) > 1 else [],
            }],
            "message": diag_msg,
        }

    # =========================================================================
    # SONUÇ ÇIKARIMI VE BAĞIMSIZ DOĞRULAMA
    # =========================================================================
    emit_progress("verifying", "Doğrulanıyor")
    is_maximize_mode = req_mode == "maximize_placement"
    placements: List[Dict[str, Any]] = []
    unplaced_items: List[Dict[str, Any]] = []
    unplaced_diags: List[Dict[str, Any]] = []
    pre_unplaced_map = {k: d for k, d in pre_unplaced_diags}

    # Yerleşen öğretmen/şube/derslik saatlerini analiz için topla
    placed_teacher_slots: Dict[str, Set[Tuple[int, int]]] = defaultdict(set)
    placed_class_slots: Dict[str, Set[Tuple[int, int]]] = defaultdict(set)

    for (aid, b_idx), cands in block_candidates.items():
        asgn = assignments_by_id[aid]
        blen = block_meta[(aid, b_idx)]["length"]
        found = False
        for d, p, var in cands:
            if solver.BooleanValue(var):
                found = True
                placements.append({
                    "block_id": f"{aid}__b{b_idx}",
                    "assignment_id": aid,
                    "block_index": b_idx,
                    "class_id": asgn["class_id"],
                    "class_name": asgn.get("class_name", ""),
                    "course_id": asgn["course_id"],
                    "course_code": asgn.get("course_code", ""),
                    "course_name": asgn.get("course_name", ""),
                    "teacher_ids": list(asgn.get("teacher_ids") or []),
                    "room_id": block_meta[(aid, b_idx)].get("room_id") or None,
                    "day_index": d,
                    "start_period": p,
                    "length": blen,
                })
                for k in range(blen):
                    placed_class_slots[asgn["class_id"]].add((d, p + k))
                    for tid in (asgn.get("teacher_ids") or []):
                        placed_teacher_slots[tid].add((d, p + k))
                break
        if not found:
            cid = asgn["class_id"]
            cname = asgn.get("class_name") or cid
            crs_name = asgn.get("course_name") or asgn.get("course_id") or "Ders"
            t_ids = list(asgn.get("teacher_ids") or [])
            t_names = [teacher_map[tid].get("name", tid) for tid in t_ids if tid in teacher_map]
            t_label = ", ".join(t_names) if t_names else "Öğretmen atanmamış"

            if (aid, b_idx) in pre_unplaced_map:
                diag = pre_unplaced_map[(aid, b_idx)]
                reason = diag["message"]
            else:
                # Kök neden ve çözüm önerisi analizi
                reasons: List[str] = []
                suggestions: List[str] = []
                links_list: List[Dict[str, Any]] = [
                    {"nav": {"view": "menu2", "classId": cid}, "label": f"{cname} Bloklarına Git →"},
                    {"nav": {"view": "menu4", "classId": cid, "search": crs_name}, "label": f"{cname} Ders Atamasına Git →"},
                ]
                primary_nav: Dict[str, Any] = {"view": "menu4", "classId": cid, "search": crs_name}
                primary_label = f"{cname} Ders Atamasına Git →"

                # 1. Öğretmen gün/saat kısıtı ve ders yükü analizi
                assigned_hours_by_t: Dict[str, int] = defaultdict(int)
                for a_all in assignments:
                    ah = int(a_all.get("hours") or sum(a_all.get("blocks") or []))
                    for tid_all in (a_all.get("teacher_ids") or []):
                        assigned_hours_by_t[tid_all] += ah

                for tid in t_ids:
                    if tid not in teacher_map:
                        continue
                    t_obj = teacher_map[tid]
                    t_name = t_obj.get("name", tid)
                    t_unav = teacher_unavail.get(tid, set())
                    unavail_cnt = len(t_unav)
                    open_total = max(0, (num_days * periods_per_day) - len(blocked) - unavail_cnt)
                    used_cnt = len(placed_teacher_slots.get(tid, set()))
                    free_cnt = max(0, open_total - used_cnt)
                    closed_days = [
                        _get_day_name(time_grid, dd)
                        for dd in range(num_days)
                        if all((dd, pp) in t_unav or (dd, pp) in blocked for pp in range(periods_per_day))
                    ]
                    max_w = int(t_obj.get("max_weekly_hours") or 30)
                    tot_assigned = assigned_hours_by_t.get(tid, 0)
                    if tot_assigned > max_w:
                        reasons.append(f"Öğretmen ders yükü aşımı: {t_name} ({tot_assigned}/{max_w} sa)")
                        suggestions.append(f"{t_name} öğretmeninin haftalık yük sınırını artırın veya bir dersini başka öğretmene aktarın")
                    if closed_days:
                        reasons.append(f"Öğretmen gün kısıtı: {t_name} ({', '.join(closed_days)} günü tamamen kapalı)")
                        suggestions.append(f"{t_name} için {closed_days[0]} gününden en az {blen} saat açın")
                    elif free_cnt < blen or unavail_cnt >= periods_per_day:
                        reasons.append(f"Öğretmen saat kısıtı: {t_name} (kapalı: {unavail_cnt} sa, kalan boş: {free_cnt} sa)")
                        suggestions.append(f"{t_name} için kapalı saatlerden en az {blen} saat açın veya günlük üst sınırı artırın")
                    if closed_days or free_cnt < blen or tot_assigned > max_w:
                        primary_nav = {"view": "menu3", "teacherId": tid}
                        primary_label = f"{t_name} Müsaitliğine Git →"
                        links_list.insert(0, {"nav": {"view": "menu3", "teacherId": tid}, "label": f"{t_name} Müsaitliğine Git →"})

                # 2. Ders bloğu yapısı analizi
                if blen >= 3:
                    reasons.append(f"Ders bloğu uzunluğu ({blen} sa) öğle arası veya kapalı saatlere takılıyor")
                    alt_str = "2+1" if blen == 3 else "2+2"
                    suggestions.append(f"{cname} {crs_name} bloğunu {alt_str} şeklinde bölün (veya Otomatik Alternatif Blokları açık tutun)")

                # 3. Özel derslik analizi
                rtype = asgn.get("room_type") or "standard"
                if rtype != "standard" or asgn.get("room_id"):
                    reasons.append(f"Özel mekan/derslik ({rtype}) uygun saatlerde dolu")
                    suggestions.append("Özel mekan eşzamanlı kapasitesini artırın veya farklı derslik atayın")
                    links_list.append({"nav": {"view": "menu4", "focus": "rooms"}, "label": "Dersliklere Git →"})

                # 4. Branş / Branş Dışı Alternatif Öğretmen Önerisi
                crs_lower = crs_name.lower()
                alt_candidates: List[Tuple[int, str]] = []
                for other_tid, other_t in teacher_map.items():
                    if other_tid in t_ids:
                        continue
                    o_max = int(other_t.get("max_weekly_hours") or 30)
                    o_open = max(0, (num_days * periods_per_day) - len(blocked) - len(teacher_unavail.get(other_tid, set())))
                    o_used = len(placed_teacher_slots.get(other_tid, set()))
                    o_spare = min(o_max - assigned_hours_by_t.get(other_tid, 0), o_open - o_used)
                    if o_spare < blen:
                        continue
                    o_branch = str(other_t.get("branch") or "").lower()
                    o_extras = [str(x).lower() for x in (other_t.get("extra_subjects") or [])]
                    match_score = 0
                    if o_branch and (o_branch in crs_lower or crs_lower in o_branch):
                        match_score = 2
                    elif any(ex and (ex in crs_lower or crs_lower in ex) for ex in o_extras):
                        match_score = 1
                    if match_score > 0:
                        alt_candidates.append((match_score * 100 + o_spare, f"{other_t.get('name', other_tid)} ({o_spare} sa boş)"))
                if not alt_candidates:
                    # Aynı branşta boş yoksa en geniş boş kapasiteli diğer öğretmenleri branş dışı seçenek olarak öner
                    for other_tid, other_t in teacher_map.items():
                        if other_tid in t_ids:
                            continue
                        o_open = max(0, (num_days * periods_per_day) - len(blocked) - len(teacher_unavail.get(other_tid, set())))
                        o_spare = o_open - len(placed_teacher_slots.get(other_tid, set()))
                        if o_spare >= blen + 2:
                            alt_candidates.append((o_spare, f"{other_t.get('name', other_tid)} ({other_t.get('branch', '')}, {o_spare} sa boş)"))
                if alt_candidates:
                    alt_candidates.sort(key=lambda x: x[0], reverse=True)
                    top_alts = ", ".join(name for _, name in alt_candidates[:2])
                    suggestions.append(f"Alternatif öğretmen önerisi: Bu ders {top_alts} öğretmenine aktarılırsa dağıtılabilir")

                # 5. Genel çakışma açıklaması
                if not reasons:
                    reasons.append(f"{cname} şubesi ile {t_label} öğretmeninin {blen} saatlik ortak boş bloğu çakışma nedeniyle bulunamadı")
                    suggestions.append(f"{blen} saatlik bloğu küçültün veya öğretmenin kapalı saatlerinden birini açın")

                reason = f"{cname} - {crs_name} ({blen} sa blok, {t_label}): " + "; ".join(reasons) + ". Çözüm önerisi: " + "; ".join(suggestions) + "."
                diag = {
                    "code": "UNPLACED_BLOCK",
                    "category": "Yerleşmeyen Ders Analizi",
                    "message": reason,
                    "nav": primary_nav,
                    "linkLabel": primary_label,
                    "links": links_list[:3],
                }
            unplaced_items.append({
                "block_id": f"{aid}__b{b_idx}",
                "assignment_id": aid,
                "block_index": b_idx,
                "class_id": cid,
                "class_name": cname,
                "course_id": asgn.get("course_id", ""),
                "course_name": crs_name,
                "teacher_ids": t_ids,
                "length": blen,
                "reason": reason,
                "nav": diag.get("nav"),
                "linkLabel": diag.get("linkLabel"),
                "links": diag.get("links") or [],
            })
            unplaced_diags.append(diag)

    # Özel derslik türü havuzu olan derslere çakışmasız somut room_id ata
    assign_pool_rooms(placements, assignments_by_id, rooms_by_type, class_map, intervals)

    placements.sort(key=lambda item: (item["class_id"], item["day_index"], item["start_period"], item["block_index"]))

    final_status = "PARTIAL" if (is_maximize_mode and len(unplaced_items) > 0 and len(placements) > 0) else status_name
    result = {
        "engine": ENGINE_NAME,
        "status": final_status,
        "solve_time_sec": round(time.perf_counter() - t0, 3),
        "placed_blocks": len(placements),
        "total_blocks": total_blocks,
        "placements": placements,
        "unplaced": unplaced_items,
        "diagnostics": unplaced_diags,
        "message": (
            f"Maksimumda dağıtım tamamlandı: {len(placements)}/{total_blocks} blok yerleştirildi, {len(unplaced_items)} blok yerleşemedi (nedenleri ve çözüm bağlantıları aşağıda)."
            if unplaced_items
            else f"OR-Tools CP-SAT dağıtımı tamamlandı ({len(placements)}/{total_blocks} blok)."
        ),
    }

    verification = validate_result(config, result, allow_partial=is_maximize_mode)
    if not verification["valid"]:
        return {
            "engine": ENGINE_NAME,
            "status": "MODEL_INVALID",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": total_blocks,
            "placements": [],
            "unplaced": unplaced_items,
            "diagnostics": verification["errors"],
            "message": "Çözüm doğrulama testinden geçemedi; hatalı program yüklenmedi.",
        }

    emit_progress("done", "Tamamlandı")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Okul Ders Dağıtım Programı — Google OR-Tools CP-SAT Motoru")
    parser.add_argument("--input", help="Girdi model JSON dosya yolu")
    parser.add_argument("--output", help="Çıktı çözüm JSON dosya yolu")
    parser.add_argument("--info", action="store_true", help="Motor ve sürüm bilgisi döndür")
    parser.add_argument("--validate", action="store_true", help="Mevcut çözümü bağımsız doğrula")
    args = parser.parse_args()

    if args.info:
        info = {
            "engine": ENGINE_NAME,
            "ortools_version": getattr(ortools, "__version__", "unknown"),
            "python_version": sys.version.split()[0],
        }
        sys.stdout.write(json.dumps(info, ensure_ascii=False))
        sys.stdout.flush()
        return 0

    if args.validate:
        try:
            if args.input:
                with open(args.input, "r", encoding="utf-8") as f:
                    payload = json.load(f)
            else:
                payload = json.loads(sys.stdin.read())
            cfg_in = payload.get("config") or {}
            sol_in = payload.get("solution") or {}
            model_check = validate_model(cfg_in)
            res_check = validate_result(cfg_in, sol_in)
            out_obj = {
                "valid": bool(model_check["valid"] and res_check["valid"]),
                "model_errors": model_check["errors"],
                "result_errors": res_check["errors"],
                "stats": res_check.get("stats") or {},
            }
            out_str = json.dumps(out_obj, ensure_ascii=False)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    f.write(out_str)
            else:
                sys.stdout.write(out_str)
                sys.stdout.flush()
            return 0
        except Exception as exc:
            err_str = json.dumps({"valid": False, "model_errors": [], "result_errors": [{"code": "VALIDATE_ERROR", "message": str(exc)}]}, ensure_ascii=False)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    f.write(err_str)
            else:
                sys.stdout.write(err_str)
            return 1

    try:
        if args.input:
            with open(args.input, "r", encoding="utf-8") as f:
                config = json.load(f)
        else:
            raw = sys.stdin.read()
            config = json.loads(raw)
    except Exception as exc:
        err_result = {
            "engine": ENGINE_NAME,
            "status": "MODEL_INVALID",
            "solve_time_sec": 0.0,
            "placed_blocks": 0,
            "total_blocks": 0,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "JSON_READ_ERROR", "message": f"Girdi JSON okunamadı: {exc}"}],
            "message": f"Girdi JSON okunamadı: {exc}",
        }
        out_str = json.dumps(err_result, ensure_ascii=False)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out_str)
        else:
            sys.stdout.write(out_str)
        return 1

    result = solve_timetable(config)
    out_str = json.dumps(result, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_str)
    else:
        sys.stdout.write(out_str)
        sys.stdout.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
