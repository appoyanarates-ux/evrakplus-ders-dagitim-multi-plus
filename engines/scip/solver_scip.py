#!/usr/bin/env python3
"""
EvrakPlus Ders Dagitim Multi Plus - SCIP Karma Tamsayili Matematiksel Optimizasyon (MILP) Cozucusu
Ogretmen, sinif, derslik ve zaman dilimi atamalarini MILP olarak modeller;
ders yuklerini dengeler, optimality gap ve dual/primal sinirlari raporlar.
"""
import json
import sys
import time
from collections import defaultdict
import pyscipopt
from pyscipopt import Model, quicksum


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

    model = Model("EvrakPlus-SCIP-MILP")
    model.hideOutput(True)
    # Windows SCIP wheel'lerinde simetrik buyuk cizelgelerde bliss/sassy stack overflow korumasini onle
    model.setParam("misc/usesymmetry", 0)

    time_limit = float(options.get("timeLimitSeconds") or 30)
    if time_limit > 0:
        model.setParam("limits/time", time_limit)

    # Karar degiskenleri: x[bi][(d, p, rid_or_None)] in {0, 1}
    x_vars = []
    teacher_slot_vars = defaultdict(list)
    class_slot_vars = defaultdict(list)
    class_all_groups = defaultdict(set)
    room_slot_vars = defaultdict(list)
    assignment_day_vars = defaultdict(lambda: defaultdict(list))
    class_subj_day_vars = defaultdict(lambda: defaultdict(list))
    teacher_day_hours_expr = defaultdict(list)
    parallel_groups = defaultdict(list)

    for bi, b in enumerate(blocks):
        cid = b["classId"]
        cls = classes.get(cid, {})
        cls_closed = set(cls.get("closedSlots", []))
        t_ids = [t for t in ([b.get("teacherId")] + list(b.get("coTeacherIds", []))) if t]
        t_closed = set()
        for tid in t_ids:
            t_closed.update(teachers.get(tid, {}).get("closedSlots", []))

        length = int(b["length"])
        sk = b["subjectKey"]
        forbid_p = forbid_map.get(sk, set())
        locked = bool(b.get("locked"))
        locked_pl = b.get("lockedPlacement")

        # Uygun derslikler
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

                for rid in eligible_rooms:
                    if rid is not None:
                        r_closed = set(rooms[rid].get("closedSlots", []))
                        if any(f"{d}-{p + k}" in r_closed for k in range(length)):
                            continue
                    vname = f"x_{bi}_{d}_{p}_{rid or 'none'}"
                    var = model.addVar(vname, vtype="B")
                    b_vars[(d, p, rid)] = var

                    for k in range(length):
                        for tid in t_ids:
                            teacher_slot_vars[(tid, d, p + k)].append(var)
                        sg = b.get("studentGroupId")
                        class_slot_vars[(cid, sg, d, p + k)].append(var)
                        class_all_groups[cid].add(sg)
                        if rid is not None:
                            room_slot_vars[(rid, d, p + k)].append(var)

                    assignment_day_vars[b["assignmentId"]][d].append(var)
                    class_subj_day_vars[(cid, sk)][d].append(var)
                    for tid in t_ids:
                        teacher_day_hours_expr[(tid, d)].append((length, var))

        if not b_vars:
            return {
                "status": "INFEASIBLE",
                "rawStatus": "NO_CANDIDATE_SLOT",
                "elapsedMs": int((time.time() - t0) * 1000),
                "placements": {}
            }

        # Her blok tam 1 konuma atanmali
        model.addCons(quicksum(b_vars.values()) == 1, name=f"assign_{bi}")
        x_vars.append(b_vars)

        if b.get("parallelGroupId"):
            parallel_groups[b["parallelGroupId"]].append(bi)

    # 2. Ogretmen cakismasizligi
    for (tid, d, p), vlist in teacher_slot_vars.items():
        if len(vlist) > 1:
            model.addCons(quicksum(vlist) <= 1, name=f"tconf_{tid}_{d}_{p}")

    # 3. Sinif ve ogrenci grubu cakismasizligi
    for cid, groups in class_all_groups.items():
        sub_groups = [g for g in groups if g is not None]
        for d in range(D):
            for p in range(P):
                full_vars = class_slot_vars.get((cid, None, d, p), [])
                if not sub_groups:
                    if len(full_vars) > 1:
                        model.addCons(quicksum(full_vars) <= 1, name=f"cconf_{cid}_{d}_{p}")
                else:
                    for g in sub_groups:
                        combined = full_vars + class_slot_vars.get((cid, g, d, p), [])
                        if len(combined) > 1:
                            model.addCons(quicksum(combined) <= 1, name=f"cgconf_{cid}_{g}_{d}_{p}")

    # 4. Derslik cakismasizligi
    for (rid, d, p), vlist in room_slot_vars.items():
        if len(vlist) > 1:
            model.addCons(quicksum(vlist) <= 1, name=f"rconf_{rid}_{d}_{p}")

    # 5. Paralel grup senkronizasyonu
    for pg_id, bi_list in parallel_groups.items():
        if len(bi_list) < 2:
            continue
        ref_bi = bi_list[0]
        ref_by_dp = defaultdict(list)
        for (d, p, _), v in x_vars[ref_bi].items():
            ref_by_dp[(d, p)].append(v)
        for other_bi in bi_list[1:]:
            oth_by_dp = defaultdict(list)
            for (d, p, _), v in x_vars[other_bi].items():
                oth_by_dp[(d, p)].append(v)
            for dp in set(ref_by_dp.keys()) | set(oth_by_dp.keys()):
                model.addCons(quicksum(ref_by_dp.get(dp, [])) == quicksum(oth_by_dp.get(dp, [])))

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
            for d, vlist in dmap.items():
                if len(vlist) > 1:
                    model.addCons(quicksum(vlist) <= 1, name=f"diff_{aid}_{d}")

    # 7. Iki ders ayni gune dusmesin
    for sa, sb in pair_rules:
        for cid in classes.keys():
            for d in range(D):
                va = class_subj_day_vars[(cid, sa)].get(d, [])
                vb = class_subj_day_vars[(cid, sb)].get(d, [])
                if va and vb:
                    ha = model.addVar(f"ha_{cid}_{sa}_{d}", vtype="B")
                    hb = model.addVar(f"hb_{cid}_{sb}_{d}", vtype="B")
                    model.addCons(quicksum(va) <= len(va) * ha)
                    model.addCons(quicksum(vb) <= len(vb) * hb)
                    model.addCons(ha + hb <= 1)

    # 8. Ogretmen gunluk maks ders (dmax), ardisik maks (cmax) ve ders yuku dengeleme
    obj_terms = []
    for tid, t in teachers.items():
        dmax = int(t.get("dmax") or P)
        cmax = int(t.get("cmax") or 0)
        pref_free = set(t.get("preferredFreeSlots", []))
        avoid_days = set(int(x) for x in t.get("avoidDays", []))

        # Ders yuku dengeleme: ogretmenin gunluk maks yukunu minimize et
        max_load_var = model.addVar(f"tmaxload_{tid}", vtype="C", lb=0, ub=P)
        has_any_day = False

        for d in range(D):
            expr_list = teacher_day_hours_expr.get((tid, d), [])
            if expr_list:
                has_any_day = True
                if dmax < P:
                    model.addCons(quicksum(w * v for w, v in expr_list) <= dmax, name=f"tdmax_{tid}_{d}")
                model.addCons(quicksum(w * v for w, v in expr_list) <= max_load_var, name=f"tbal_{tid}_{d}")
                if d in avoid_days:
                    for w, v in expr_list:
                        obj_terms.append((8 * w, v))

            # Tercihen bos saatler ve cmax
            for p in range(P):
                vlist = teacher_slot_vars.get((tid, d, p), [])
                if vlist and f"{d}-{p}" in pref_free:
                    for v in vlist:
                        obj_terms.append((20, v))

            if cmax > 0 and cmax < P:
                for p in range(P - cmax):
                    win = []
                    for k in range(cmax + 1):
                        win.extend(teacher_slot_vars.get((tid, d, p + k), []))
                    if win:
                        model.addCons(quicksum(win) <= cmax, name=f"tcmax_{tid}_{d}_{p}")

        if has_any_day:
            obj_terms.append((5, max_load_var))

    # Sinif gunluk maks ders (dmax)
    for cid, cls in classes.items():
        dmax = int(cls.get("dmax") or P)
        if dmax < P:
            for d in range(D):
                day_vars = []
                for p in range(P):
                    day_vars.extend(class_slot_vars.get((cid, None, d, p), []))
                if day_vars:
                    model.addCons(quicksum(day_vars) <= dmax, name=f"cdmax_{cid}_{d}")

    if obj_terms:
        model.setObjective(quicksum(coef * var for coef, var in obj_terms), "minimize")

    model.optimize()
    elapsed_ms = int((time.time() - t0) * 1000)

    scip_status = model.getStatus()
    nsols = model.getNSols()

    placements = {}
    primal_bound = None
    dual_bound = None
    gap = None

    if nsols > 0:
        best_sol = model.getBestSol()
        primal_bound = float(model.getSolObjVal(best_sol))
        try:
            dual_bound = float(model.getDualbound())
            g = model.getGap()
            gap = round(float(g) * 100.0, 2) if g < 1e15 else None
        except Exception:
            dual_bound = None
            gap = None

        for bi, b in enumerate(blocks):
            for (d, p, rid), var in x_vars[bi].items():
                val = model.getSolVal(best_sol, var)
                if val > 0.5:
                    placements[b["blockId"]] = {"day": d, "period": p, "roomId": rid}
                    break

    if scip_status == "optimal":
        mapped_status = "OPTIMAL"
    elif nsols > 0:
        mapped_status = "FEASIBLE"
    elif scip_status == "infeasible":
        mapped_status = "INFEASIBLE"
    elif scip_status == "timelimit":
        mapped_status = "TIME_LIMIT"
    else:
        mapped_status = "UNKNOWN"

    return {
        "status": mapped_status,
        "rawStatus": scip_status,
        "elapsedMs": elapsed_ms,
        "solutionsFound": nsols,
        "objectiveValue": primal_bound,
        "bestBound": dual_bound,
        "optimalityGap": gap,
        "statistics": {
            "nodes": model.getNNodes(),
            "lpIterations": model.getNLPIterations(),
            "solvingTimeSec": model.getSolvingTime()
        },
        "placements": placements
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--version":
        m = Model()
        print(json.dumps({
            "engine": "scip",
            "version": str(m.version()),
            "pyscipopt": pyscipopt.__version__,
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
