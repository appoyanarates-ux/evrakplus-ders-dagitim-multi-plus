#!/usr/bin/env python3
"""
EvrakPlus Ders Dagitim Multi Plus - Google OR-Tools CP-SAT Gercek Cozucu
Standart SolverInput JSON alir, gercek CP-SAT optimizasyonu yapar ve NDJSON protokolunde
ilerleme, ara cozum ve nihai sonucu dondurur.
"""
import json
import os
import sys
import time
from collections import defaultdict
import ortools
from ortools.sat.python import cp_model


def emit(event_type, payload):
    sys.stdout.write(json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


class SolutionStreamer(cp_model.CpSolverSolutionCallback):
    def __init__(self, x_vars, room_vars, blocks, start_time):
        super().__init__()
        self._x_vars = x_vars
        self._room_vars = room_vars
        self._blocks = blocks
        self._start_time = start_time
        self.solutions_found = 0
        self.last_placements = {}

    def on_solution_callback(self):
        self.solutions_found += 1
        placements = {}
        for bi, b in enumerate(self._blocks):
            chosen_dp = None
            for (d, p), var in self._x_vars[bi].items():
                if self.Value(var) == 1:
                    chosen_dp = (d, p)
                    break
            if chosen_dp is not None:
                chosen_room = b.get("roomId")
                if bi in self._room_vars:
                    for rid, rvar in self._room_vars[bi].items():
                        if self.Value(rvar) == 1:
                            chosen_room = rid
                            break
                placements[b["blockId"]] = {
                    "day": chosen_dp[0],
                    "period": chosen_dp[1],
                    "roomId": chosen_room
                }
        self.last_placements = placements
        elapsed_ms = int((time.time() - self._start_time) * 1000)
        obj = self.ObjectiveValue()
        bound = self.BestObjectiveBound()
        emit("INTERMEDIATE_SOLUTION", {
            "solutionsFound": self.solutions_found,
            "elapsedMs": elapsed_ms,
            "objectiveValue": obj,
            "bestBound": bound,
            "assignedBlocks": len(placements),
            "placements": placements
        })


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

    diff_day_active = any(c["type"] == "subject_diff_days" and c.get("level") == "HARD" for c in constraints)
    lunch_hard = any(c["type"] == "block_no_across_lunch" and c.get("level") == "HARD" for c in constraints)
    forbid_map = defaultdict(set)
    pair_rules = []
    for c in constraints:
        if c["type"] == "subject_forbid_periods" and c.get("level") == "HARD":
            sk = c.get("params", {}).get("subjectKey")
            for pp in c.get("params", {}).get("periods", []):
                forbid_map[sk].add(int(pp))
        elif c["type"] == "subject_pair_diff_day" and c.get("level") == "HARD":
            p_a = c.get("params", {}).get("subjectA")
            p_b = c.get("params", {}).get("subjectB")
            if p_a and p_b:
                pair_rules.append((p_a, p_b))

    model = cp_model.CpModel()

    # 1. Her blok icin gecerli (d, p) aday degiskenleri olustur
    x_vars = []
    block_day_vars = []  # block_day_vars[bi][d] = list of x vars on day d
    teacher_slot_vars = defaultdict(list)  # (tid, d, p) -> list of x vars
    class_slot_vars = defaultdict(list)    # (cid, studentGroupId_or_None, d, p) -> list of x vars
    class_all_groups = defaultdict(set)
    assignment_day_vars = defaultdict(lambda: defaultdict(list))
    class_subj_day_vars = defaultdict(lambda: defaultdict(list))
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
        hint_pl = b.get("hintPlacement") if options.get("useHints", True) else None

        b_vars = {}
        b_days = defaultdict(list)

        for d in range(D):
            for p in range(P - length + 1):
                if locked and locked_pl:
                    if int(locked_pl["day"]) != d or int(locked_pl["period"]) != p:
                        continue
                if lunch_hard and b.get("forbidAcrossLunch", True) and lunch_after > 0:
                    if p < lunch_after and p + length > lunch_after:
                        continue
                ok = True
                for k in range(length):
                    slot = f"{d}-{p + k}"
                    if slot in cls_closed or slot in t_closed or (p + k) in forbid_p:
                        ok = False
                        break
                if not ok:
                    continue

                var = model.NewBoolVar(f"x_{bi}_{d}_{p}")
                b_vars[(d, p)] = var
                b_days[d].append(var)

                if hint_pl and int(hint_pl["day"]) == d and int(hint_pl["period"]) == p:
                    model.AddHint(var, 1)

                for k in range(length):
                    for tid in t_ids:
                        teacher_slot_vars[(tid, d, p + k)].append(var)
                    sg = b.get("studentGroupId")
                    class_slot_vars[(cid, sg, d, p + k)].append(var)
                    class_all_groups[cid].add(sg)

                assignment_day_vars[b["assignmentId"]][d].append(var)
                class_subj_day_vars[(cid, sk)][d].append(var)

        if not b_vars:
            elapsed_ms = int((time.time() - t0) * 1000)
            return {
                "status": "INFEASIBLE",
                "rawStatus": "NO_CANDIDATE_SLOT",
                "elapsedMs": elapsed_ms,
                "placements": {},
                "message": f"Blok {b['blockId']} icin hic uygun zaman dilimi yok."
            }

        # Her blok tam olarak bir yere yerlesmeli
        model.AddExactlyOne(list(b_vars.values()))
        x_vars.append(b_vars)
        block_day_vars.append(b_days)

        if b.get("parallelGroupId"):
            parallel_groups[b["parallelGroupId"]].append(bi)

    # 2. Ogretmen cakismasizligi
    for (tid, d, p), vlist in teacher_slot_vars.items():
        if len(vlist) > 1:
            model.AddAtMostOne(vlist)

    # 3. Sinif ve ogrenci grubu cakismasizligi
    for cid, groups in class_all_groups.items():
        for d in range(D):
            for p in range(P):
                full_vars = class_slot_vars.get((cid, None, d, p), [])
                sub_groups = [g for g in groups if g is not None]
                if not sub_groups:
                    if len(full_vars) > 1:
                        model.AddAtMostOne(full_vars)
                else:
                    # Her alt grup kendi icinde + tam sinif dersleriyle cakisamaz
                    for g in sub_groups:
                        combined = full_vars + class_slot_vars.get((cid, g, d, p), [])
                        if len(combined) > 1:
                            model.AddAtMostOne(combined)

    # 4. Paralel grup senkronizasyonu
    for pg_id, bi_list in parallel_groups.items():
        if len(bi_list) < 2:
            continue
        ref_bi = bi_list[0]
        for other_bi in bi_list[1:]:
            all_dps = set(x_vars[ref_bi].keys()) | set(x_vars[other_bi].keys())
            for dp in all_dps:
                v1 = x_vars[ref_bi].get(dp)
                v2 = x_vars[other_bi].get(dp)
                if v1 is not None and v2 is not None:
                    model.Add(v1 == v2)
                elif v1 is not None:
                    model.Add(v1 == 0)
                elif v2 is not None:
                    model.Add(v2 == 0)

    # 5. Derslik atamasi ve cakismasizligi (rooms tanimliysa)
    room_vars = {}
    if rooms:
        room_slot_vars = defaultdict(list)
        for bi, b in enumerate(blocks):
            cls = classes.get(b["classId"], {})
            req_type = b.get("requiredRoomType")
            fixed_room = b.get("roomId") or (None if req_type else cls.get("homeRoomId"))
            if not fixed_room and not req_type:
                continue

            eligible = []
            for rid, r in rooms.items():
                if fixed_room and rid != fixed_room:
                    continue
                if req_type and r.get("type") != req_type:
                    continue
                if int(cls.get("studentCount") or 0) > int(r.get("capacity") or 999):
                    continue
                eligible.append(rid)

            if not eligible:
                elapsed_ms = int((time.time() - t0) * 1000)
                return {
                    "status": "INFEASIBLE",
                    "rawStatus": "NO_ELIGIBLE_ROOM",
                    "elapsedMs": elapsed_ms,
                    "placements": {},
                    "message": f"Blok {b['blockId']} icin uygun derslik bulunamadi."
                }

            if len(eligible) == 1:
                rid = eligible[0]
                r_closed = set(rooms[rid].get("closedSlots", []))
                for (d, p), var in x_vars[bi].items():
                    for k in range(int(b["length"])):
                        if f"{d}-{p + k}" in r_closed:
                            model.Add(var == 0)
                        else:
                            room_slot_vars[(rid, d, p + k)].append(var)
                room_vars[bi] = {rid: model.NewConstant(1)}
            else:
                rv = {rid: model.NewBoolVar(f"r_{bi}_{rid}") for rid in eligible}
                model.AddExactlyOne(list(rv.values()))
                room_vars[bi] = rv
                for rid in eligible:
                    r_closed = set(rooms[rid].get("closedSlots", []))
                    for (d, p), xvar in x_vars[bi].items():
                        both = model.NewBoolVar(f"xr_{bi}_{rid}_{d}_{p}")
                        model.AddBoolAnd([xvar, rv[rid]]).OnlyEnforceIf(both)
                        model.AddBoolOr([xvar.Not(), rv[rid].Not()]).OnlyEnforceIf(both.Not())
                        for k in range(int(b["length"])):
                            if f"{d}-{p + k}" in r_closed:
                                model.Add(both == 0)
                            else:
                                room_slot_vars[(rid, d, p + k)].append(both)

        for (rid, d, p), vlist in room_slot_vars.items():
            if len(vlist) > 1:
                model.AddAtMostOne(vlist)

    # 6. Ayni dersin bloklari farkli gunlere
    if diff_day_active:
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
                    model.AddAtMostOne(vlist)

    # 7. Iki ders ayni gune dusmesin
    for (sa, sb) in pair_rules:
        for cid in classes.keys():
            for d in range(D):
                va = class_subj_day_vars[(cid, sa)].get(d, [])
                vb = class_subj_day_vars[(cid, sb)].get(d, [])
                if va and vb:
                    ha = model.NewBoolVar(f"has_{cid}_{sa}_{d}")
                    hb = model.NewBoolVar(f"has_{cid}_{sb}_{d}")
                    model.Add(sum(va) >= 1).OnlyEnforceIf(ha)
                    model.Add(sum(va) == 0).OnlyEnforceIf(ha.Not())
                    model.Add(sum(vb) >= 1).OnlyEnforceIf(hb)
                    model.Add(sum(vb) == 0).OnlyEnforceIf(hb.Not())
                    model.Add(ha + hb <= 1)

    # 8. Ogretmen gunluk maks ders (dmax) ve ardisik maks ders (cmax)
    for tid, t in teachers.items():
        dmax = int(t.get("dmax") or P)
        cmax = int(t.get("cmax") or 0)
        for d in range(D):
            day_occ = []
            for p in range(P):
                vlist = teacher_slot_vars.get((tid, d, p), [])
                if not vlist:
                    day_occ.append(None)
                elif len(vlist) == 1:
                    day_occ.append(vlist[0])
                else:
                    s_var = model.NewBoolVar(f"tocc_{tid}_{d}_{p}")
                    model.Add(s_var == sum(vlist))
                    day_occ.append(s_var)
            active_occ = [v for v in day_occ if v is not None]
            if active_occ and dmax < P:
                model.Add(sum(active_occ) <= dmax)
            if cmax > 0 and cmax < P:
                for p in range(P - cmax):
                    win = [day_occ[p + k] for k in range(cmax + 1) if day_occ[p + k] is not None]
                    if len(win) > cmax:
                        model.Add(sum(win) <= cmax)

    # 9. Sinif gunluk maks ders (dmax)
    for cid, cls in classes.items():
        dmax = int(cls.get("dmax") or P)
        if dmax < P:
            for d in range(D):
                day_vars = []
                for p in range(P):
                    day_vars.extend(class_slot_vars.get((cid, None, d, p), []))
                if day_vars:
                    model.Add(sum(day_vars) <= dmax)

    # 10. Esnek Amac Fonksiyonu (Ogretmen bosluklari + tercihen bos saatler + tercih edilmeyen gunler)
    penalties = []
    gap_weight = 10 if options.get("objectivePriority", "gaps") == "gaps" else 3

    for tid, t in teachers.items():
        pref_free = set(t.get("preferredFreeSlots", []))
        avoid_days = set(int(x) for x in t.get("avoidDays", []))
        for d in range(D):
            occ_p = []
            for p in range(P):
                vlist = teacher_slot_vars.get((tid, d, p), [])
                if not vlist:
                    occ_p.append(None)
                    continue
                if len(vlist) == 1:
                    s_var = vlist[0]
                else:
                    s_var = model.NewBoolVar(f"o_{tid}_{d}_{p}")
                    model.Add(s_var == sum(vlist))
                occ_p.append(s_var)

                if f"{d}-{p}" in pref_free:
                    penalties.append(s_var * 20)
                if d in avoid_days:
                    penalties.append(s_var * 8)

            # Gunluk pencere (bosluk) sayisi: p noktasinda ders yoksa ama oncesinde ve sonrasinda varsa gap=1
            non_empty = [i for i, v in enumerate(occ_p) if v is not None]
            if len(non_empty) >= 2:
                for p in range(non_empty[0] + 1, non_empty[-1]):
                    before = [occ_p[q] for q in range(p) if occ_p[q] is not None]
                    after = [occ_p[q] for q in range(p + 1, P) if occ_p[q] is not None]
                    if not before or not after:
                        continue
                    has_before = model.NewBoolVar(f"hb_{tid}_{d}_{p}")
                    has_after = model.NewBoolVar(f"ha_{tid}_{d}_{p}")
                    model.AddMaxEquality(has_before, before)
                    model.AddMaxEquality(has_after, after)
                    is_gap = model.NewBoolVar(f"gap_{tid}_{d}_{p}")
                    if occ_p[p] is None:
                        model.Add(is_gap >= has_before + has_after - 1)
                    else:
                        model.Add(is_gap >= has_before + has_after - occ_p[p] - 1)
                    penalties.append(is_gap * gap_weight)

    if penalties:
        model.Minimize(sum(penalties))

    # 11. Cozucu yapilandirmasi
    solver = cp_model.CpSolver()
    time_limit = float(options.get("timeLimitSeconds") or 120)
    if time_limit > 0:
        solver.parameters.max_time_in_seconds = time_limit
    num_workers = int(options.get("numWorkers") or 0)
    solver.parameters.num_search_workers = num_workers if num_workers > 0 else max(1, min(8, os.cpu_count() or 2))
    solver.parameters.random_seed = int(options.get("seed") or 42)

    callback = SolutionStreamer(x_vars, room_vars, blocks, t0)
    status_code = solver.Solve(model, callback)
    elapsed_ms = int((time.time() - t0) * 1000)

    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "ERROR",
        cp_model.UNKNOWN: "TIME_LIMIT" if (time_limit > 0 and elapsed_ms >= int(time_limit * 950)) else "UNKNOWN"
    }
    mapped_status = status_map.get(status_code, "UNKNOWN")
    raw_name = solver.StatusName(status_code)

    placements = {}
    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = callback.last_placements
        if not placements:
            for bi, b in enumerate(blocks):
                for (d, p), var in x_vars[bi].items():
                    if solver.Value(var) == 1:
                        chosen_room = b.get("roomId")
                        if bi in room_vars:
                            for rid, rvar in room_vars[bi].items():
                                if solver.Value(rvar) == 1:
                                    chosen_room = rid
                                    break
                        placements[b["blockId"]] = {"day": d, "period": p, "roomId": chosen_room}
                        break

    obj_val = solver.ObjectiveValue() if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None
    best_bound = solver.BestObjectiveBound() if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None

    return {
        "status": mapped_status,
        "rawStatus": raw_name,
        "elapsedMs": elapsed_ms,
        "solutionsFound": callback.solutions_found,
        "objectiveValue": obj_val,
        "bestBound": best_bound,
        "statistics": {
            "branches": solver.NumBranches(),
            "conflicts": solver.NumConflicts(),
            "wallTimeSec": solver.WallTime(),
            "numWorkers": solver.parameters.num_search_workers
        },
        "placements": placements
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--version":
        print(json.dumps({"engine": "ortools", "version": ortools.__version__, "python": sys.version.split()[0]}))
        return

    raw = sys.stdin.read()
    if not raw.strip():
        emit("FINAL_RESULT", {"status": "ERROR", "rawStatus": "EMPTY_INPUT", "message": "Bos girdi", "placements": {}})
        sys.exit(1)

    data = json.loads(raw)
    result = solve_instance(data)
    emit("FINAL_RESULT", result)


if __name__ == "__main__":
    main()
