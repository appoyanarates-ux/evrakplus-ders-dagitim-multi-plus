#!/usr/bin/env python3
"""
EvrakPlus Ders Dagitim Multi Plus - HiGHS MIP/MILP Gercek Cozucusu
Ogretmen yuku dengeleme ve ders dagitimini kesin tamsayili MILP olarak modeller.
Kesirli LP cozumleri kesinlikle gecerli ders programi olarak kabul edilmez.
"""
import json
import math
import sys
import time
from collections import defaultdict
import highspy
from highspy import Highs, HighsVarType, HighsModelStatus, kHighsInf


def emit(event_type, payload):
    sys.stdout.write(json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def solve_instance(data):
    t0 = time.time()
    school = data["school"]
    D = int(school["daysPerWeek"])
    P = int(school["periodsPerDay"])
    lunch_after = int(school.get("lunchAfterPeriod") or 0)

    teachers = {t["id"]: t for t in data.get("teachers", [])}
    classes = {c["id"]: c for c in data.get("classes", [])}
    rooms = {r["id"]: r for r in data.get("rooms", [])}
    blocks = data.get("blocks", [])
    constraints = data.get("constraints", [])
    options = data.get("options", {})

    diff_day_hard = any(c["type"] == "subject_diff_days" and c.get("level") == "HARD" for c in constraints)
    lunch_hard = any(c["type"] == "block_no_across_lunch" and c.get("level") == "HARD" for c in constraints)
    forbid_map = defaultdict(set)
    pair_rules = []
    for c in constraints:
        if c["type"] == "subject_forbid_periods" and c.get("level") == "HARD":
            sk = c.get("params", {}).get("subjectKey")
            for pp in c.get("params", {}).get("periods", []):
                forbid_map[sk].add(int(pp))
        elif c["type"] == "subject_pair_diff_day" and c.get("level") == "HARD":
            pa = c.get("params", {}).get("subjectA")
            pb = c.get("params", {}).get("subjectB")
            if pa and pb:
                pair_rules.append((pa, pb))

    h = Highs()
    h.setOptionValue("output_flag", False)
    time_limit = float(options.get("timeLimitSeconds") or 30)
    if time_limit > 0:
        h.setOptionValue("time_limit", time_limit)
    h.setOptionValue("mip_rel_gap", 0.01)

    # Degisken ekleme yardimcisi (tum karar degiskenleri kesin integer {0, 1})
    var_count = 0
    col_costs = []
    col_lowers = []
    col_uppers = []
    col_types = []

    def add_bin(cost=0.0):
        nonlocal var_count
        idx = var_count
        var_count += 1
        col_costs.append(float(cost))
        col_lowers.append(0.0)
        col_uppers.append(1.0)
        col_types.append(HighsVarType.kInteger)
        return idx

    def add_cont(lb=0.0, ub=float(P), cost=0.0):
        nonlocal var_count
        idx = var_count
        var_count += 1
        col_costs.append(float(cost))
        col_lowers.append(float(lb))
        col_uppers.append(float(ub))
        col_types.append(HighsVarType.kContinuous)
        return idx

    rows = []  # (lb, ub, [(col, val), ...])

    def add_row(lb, ub, terms):
        if terms:
            rows.append((float(lb), float(ub), terms))

    x_vars = []  # list of dict[(d, p, rid)] -> col_idx
    teacher_slot_vars = defaultdict(list)
    class_slot_vars = defaultdict(list)
    class_all_groups = defaultdict(set)
    room_slot_vars = defaultdict(list)
    assignment_day_vars = defaultdict(lambda: defaultdict(list))
    class_subj_day_vars = defaultdict(lambda: defaultdict(list))
    teacher_day_hours = defaultdict(list)
    parallel_groups = defaultdict(list)

    for bi, b in enumerate(blocks):
        cid = b["classId"]
        cls = classes.get(cid, {})
        cls_closed = set(cls.get("closedSlots", []))
        t_ids = [t for t in ([b.get("teacherId")] + list(b.get("coTeacherIds", []))) if t]
        t_closed = set()
        t_pref_free = set()
        t_avoid_days = set()
        for tid in t_ids:
            t_obj = teachers.get(tid, {})
            t_closed.update(t_obj.get("closedSlots", []))
            t_pref_free.update(t_obj.get("preferredFreeSlots", []))
            t_avoid_days.update(int(x) for x in t_obj.get("avoidDays", []))

        length = int(b["length"])
        sk = b["subjectKey"]
        forbid_p = forbid_map.get(sk, set())
        locked = bool(b.get("locked"))
        locked_pl = b.get("lockedPlacement")

        eligible_rooms = [None]
        if rooms:
            req_type = b.get("requiredRoomType")
            fixed_room = b.get("roomId") or (None if req_type else cls.get("homeRoomId"))
            if fixed_room or req_type:
                eligible_rooms = []
                for rid, r in rooms.items():
                    if fixed_room and rid != fixed_room:
                        continue
                    if req_type and r.get("type") != req_type:
                        continue
                    if int(cls.get("studentCount") or 0) > int(r.get("capacity") or 999):
                        continue
                    eligible_rooms.append(rid)
                if not eligible_rooms:
                    return {
                        "status": "INFEASIBLE",
                        "rawStatus": "NO_ELIGIBLE_ROOM",
                        "elapsedMs": int((time.time() - t0) * 1000),
                        "placements": {}
                    }

        b_vars = {}
        for d in range(D):
            for p in range(P - length + 1):
                if locked and locked_pl:
                    if int(locked_pl["day"]) != d or int(locked_pl["period"]) != p:
                        continue
                if lunch_hard and b.get("forbidAcrossLunch", True) and lunch_after > 0:
                    if p < lunch_after and p + length > lunch_after:
                        continue
                slot_ok = True
                for k in range(length):
                    slot = f"{d}-{p + k}"
                    if slot in cls_closed or slot in t_closed or (p + k) in forbid_p:
                        slot_ok = False
                        break
                if not slot_ok:
                    continue

                # Tercih maliyeti
                cost = 0.0
                for k in range(length):
                    if f"{d}-{p + k}" in t_pref_free:
                        cost += 20.0
                if d in t_avoid_days:
                    cost += 8.0 * length

                for rid in eligible_rooms:
                    if rid is not None:
                        r_closed = set(rooms[rid].get("closedSlots", []))
                        if any(f"{d}-{p + k}" in r_closed for k in range(length)):
                            continue
                    col = add_bin(cost=cost)
                    b_vars[(d, p, rid)] = col

                    for k in range(length):
                        for tid in t_ids:
                            teacher_slot_vars[(tid, d, p + k)].append(col)
                        sg = b.get("studentGroupId")
                        class_slot_vars[(cid, sg, d, p + k)].append(col)
                        class_all_groups[cid].add(sg)
                        if rid is not None:
                            room_slot_vars[(rid, d, p + k)].append(col)

                    assignment_day_vars[b["assignmentId"]][d].append(col)
                    class_subj_day_vars[(cid, sk)][d].append(col)
                    for tid in t_ids:
                        teacher_day_hours[(tid, d)].append((col, float(length)))

        if not b_vars:
            return {
                "status": "INFEASIBLE",
                "rawStatus": "NO_CANDIDATE_SLOT",
                "elapsedMs": int((time.time() - t0) * 1000),
                "placements": {}
            }

        # Her blok tam 1 konuma atanmali
        add_row(1.0, 1.0, [(c, 1.0) for c in b_vars.values()])
        x_vars.append(b_vars)

        if b.get("parallelGroupId"):
            parallel_groups[b["parallelGroupId"]].append(bi)

    # 2. Ogretmen cakismasizligi
    for vlist in teacher_slot_vars.values():
        if len(vlist) > 1:
            add_row(-kHighsInf, 1.0, [(c, 1.0) for c in vlist])

    # 3. Sinif / ogrenci grubu cakismasizligi
    for cid, groups in class_all_groups.items():
        sub_groups = [g for g in groups if g is not None]
        for d in range(D):
            for p in range(P):
                full_vars = class_slot_vars.get((cid, None, d, p), [])
                if not sub_groups:
                    if len(full_vars) > 1:
                        add_row(-kHighsInf, 1.0, [(c, 1.0) for c in full_vars])
                else:
                    for g in sub_groups:
                        combined = full_vars + class_slot_vars.get((cid, g, d, p), [])
                        if len(combined) > 1:
                            add_row(-kHighsInf, 1.0, [(c, 1.0) for c in combined])

    # 4. Derslik cakismasizligi
    for vlist in room_slot_vars.values():
        if len(vlist) > 1:
            add_row(-kHighsInf, 1.0, [(c, 1.0) for c in vlist])

    # 5. Paralel grup senkronizasyonu
    for pg_id, bi_list in parallel_groups.items():
        if len(bi_list) < 2:
            continue
        ref_bi = bi_list[0]
        ref_by_dp = defaultdict(list)
        for (d, p, _), c in x_vars[ref_bi].items():
            ref_by_dp[(d, p)].append(c)
        for other_bi in bi_list[1:]:
            oth_by_dp = defaultdict(list)
            for (d, p, _), c in x_vars[other_bi].items():
                oth_by_dp[(d, p)].append(c)
            for dp in set(ref_by_dp.keys()) | set(oth_by_dp.keys()):
                terms = [(c, 1.0) for c in ref_by_dp.get(dp, [])] + [(c, -1.0) for c in oth_by_dp.get(dp, [])]
                if terms:
                    add_row(0.0, 0.0, terms)

    # 6. Ayni dersin bloklari farkli gunlerde
    if diff_day_hard:
        block_counts = defaultdict(int)
        allow_multi = {}
        for b in blocks:
            block_counts[b["assignmentId"]] += 1
            allow_multi[b["assignmentId"]] = bool(b.get("allowMultipleSameDay"))
        for aid, dmap in assignment_day_vars.items():
            if allow_multi.get(aid) or block_counts[aid] > D:
                continue
            for vlist in dmap.values():
                if len(vlist) > 1:
                    add_row(-kHighsInf, 1.0, [(c, 1.0) for c in vlist])

    # 7. Iki ders ayni gune dusmesin
    for sa, sb in pair_rules:
        for cid in classes.keys():
            for d in range(D):
                va = class_subj_day_vars[(cid, sa)].get(d, [])
                vb = class_subj_day_vars[(cid, sb)].get(d, [])
                if va and vb:
                    ha = add_bin(0.0)
                    hb = add_bin(0.0)
                    add_row(-kHighsInf, 0.0, [(c, 1.0) for c in va] + [(ha, -float(len(va)))])
                    add_row(-kHighsInf, 0.0, [(c, 1.0) for c in vb] + [(hb, -float(len(vb)))])
                    add_row(-kHighsInf, 1.0, [(ha, 1.0), (hb, 1.0)])

    # 8. Ogretmen dmax, cmax ve gunluk ders yuku dengeleme
    for tid, t in teachers.items():
        dmax = int(t.get("dmax") or P)
        cmax = int(t.get("cmax") or 0)
        max_load_col = add_cont(0.0, float(P), cost=5.0)
        for d in range(D):
            terms = teacher_day_hours.get((tid, d), [])
            if terms:
                if dmax < P:
                    add_row(-kHighsInf, float(dmax), terms)
                add_row(-kHighsInf, 0.0, terms + [(max_load_col, -1.0)])
            if cmax > 0 and cmax < P:
                for p in range(P - cmax):
                    win = []
                    for k in range(cmax + 1):
                        win.extend(teacher_slot_vars.get((tid, d, p + k), []))
                    if win:
                        add_row(-kHighsInf, float(cmax), [(c, 1.0) for c in win])

    # 9. Sinif dmax
    for cid, cls in classes.items():
        dmax = int(cls.get("dmax") or P)
        if dmax < P:
            for d in range(D):
                day_vars = []
                for p in range(P):
                    day_vars.extend(class_slot_vars.get((cid, None, d, p), []))
                if day_vars:
                    add_row(-kHighsInf, float(dmax), [(c, 1.0) for c in day_vars])

    # Modeli HiGHS'e toplu yukle (yuksek performans)
    h.addCols(var_count, col_costs, col_lowers, col_uppers, 0, [], [], [])
    h.changeColsIntegrality(var_count, list(range(var_count)), col_types)

    for lb, ub, terms in rows:
        # Ayni sutun tekrarlarini birlestir
        agg = defaultdict(float)
        for col, coef in terms:
            agg[col] += coef
        cols = list(agg.keys())
        vals = [agg[c] for c in cols]
        h.addRow(lb, ub, len(cols), cols, vals)

    h.run()
    elapsed_ms = int((time.time() - t0) * 1000)

    model_status = h.getModelStatus()
    info = h.getInfo()
    sol = h.getSolution()
    col_values = list(sol.col_value) if sol and len(sol.col_value) == var_count else []

    placements = {}
    fractional_detected = False

    has_primal = info.primal_solution_status == highspy.SolutionStatus.kSolutionStatusFeasible

    if has_primal and col_values:
        # Kesirli LP cozumunu kesinlikle reddet!
        for bi, b in enumerate(blocks):
            chosen = None
            for (d, p, rid), col in x_vars[bi].items():
                val = col_values[col]
                if abs(val - round(val)) > 1e-4:
                    fractional_detected = True
                    break
                if val > 0.5:
                    chosen = (d, p, rid)
            if fractional_detected:
                break
            if chosen is not None:
                placements[b["blockId"]] = {"day": chosen[0], "period": chosen[1], "roomId": chosen[2]}

    if fractional_detected:
        return {
            "status": "ERROR",
            "rawStatus": "FRACTIONAL_LP_REJECTED",
            "elapsedMs": elapsed_ms,
            "message": "Kesirli LP cozumu tespit edildi ve reddedildi.",
            "placements": {}
        }

    obj_val = float(info.objective_function_value) if has_primal else None
    dual_bound = float(info.mip_dual_bound) if has_primal and math.isfinite(info.mip_dual_bound) else None
    gap = round(float(info.mip_gap) * 100.0, 2) if has_primal and math.isfinite(info.mip_gap) else None

    if model_status == HighsModelStatus.kOptimal and has_primal:
        mapped_status = "OPTIMAL"
    elif has_primal:
        mapped_status = "FEASIBLE"
    elif model_status == HighsModelStatus.kInfeasible:
        mapped_status = "INFEASIBLE"
    elif model_status == HighsModelStatus.kTimeLimit:
        mapped_status = "TIME_LIMIT"
    else:
        mapped_status = "UNKNOWN"

    return {
        "status": mapped_status,
        "rawStatus": str(model_status).split(".")[-1],
        "elapsedMs": elapsed_ms,
        "solutionsFound": 1 if has_primal else 0,
        "objectiveValue": obj_val,
        "bestBound": dual_bound,
        "optimalityGap": gap,
        "statistics": {
            "mipNodes": int(info.mip_node_count),
            "simplexIterations": int(info.simplex_iteration_count),
            "numVars": var_count,
            "numRows": len(rows)
        },
        "placements": placements
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--version":
        h = Highs()
        print(json.dumps({
            "engine": "highs",
            "version": h.version(),
            "python": sys.version.split()[0]
        }))
        return

    raw = sys.stdin.read()
    if not raw.strip():
        emit("FINAL_RESULT", {"status": "ERROR", "rawStatus": "EMPTY_INPUT", "placements": {}})
        sys.exit(1)

    data = json.loads(raw)
    result = solve_instance(data)
    emit("FINAL_RESULT", result)


if __name__ == "__main__":
    main()
