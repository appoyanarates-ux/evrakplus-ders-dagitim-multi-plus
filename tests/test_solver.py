"""
OR-Tools CP-SAT çözücü kabul testleri (test_solver.py).
Senaryolar: 1 şube/1 öğretmen, orta ölçek, 50+ öğretmen, 100+ öğretmen,
ikili öğretim, kapalı gün, engelli öğretmen saati, özel derslik, 2+2+2 blok,
ortak seçmeli, iki öğretmenli alt grup, sabit ders, sabit öğretmen, boştakileri yerleştirme.
"""

from __future__ import annotations

import os
import sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLVER_DIR = os.path.join(ROOT, "solver")
if SOLVER_DIR not in sys.path:
    sys.path.insert(0, SOLVER_DIR)

from solver_ortools import ENGINE_NAME, solve_timetable
from validate_result import validate_result


def make_bell(periods: int = 7, start_h: int = 8, start_m: int = 30, lunch_after: int = 4):
    schedule = []
    cur = start_h * 60 + start_m
    for p in range(1, periods + 1):
        s = cur
        e = s + 40
        schedule.append({
            "period": p,
            "start": f"{s // 60:02d}:{s % 60:02d}",
            "end": f"{e // 60:02d}:{e % 60:02d}",
        })
        cur = e + (45 if lunch_after == p else 10)
    return schedule


def make_base_config(num_days: int = 5, periods: int = 7, lunch_after: int = 4):
    days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][:num_days]
    return {
        "schema_version": "4.0-meb-2026-2027",
        "solver_target": ENGINE_NAME,
        "school": {
            "name": "Test Okulu",
            "academic_year": "2026-2027",
            "meb_school_type": "ortaokul",
            "shift_mode": "single",
            "weekly_target_hours": num_days * periods,
        },
        "time_grid": {
            "num_days": num_days,
            "days": [{"index": i, "name": n} for i, n in enumerate(days)],
            "periods_per_day": periods,
            "lunch_break": {"after_period": lunch_after, "duration_min": 45 if lunch_after else 0},
            "teaching_day_indices": list(range(num_days)),
            "bell_schedule": make_bell(periods, 8, 30, lunch_after),
            "blocked_slots": [],
            "common_elective_slots": [],
        },
        "classes": [],
        "teachers": [],
        "rooms": [],
        "assignments": [],
        "fixed_assignments": [],
        "solution_request": {"mode": "respect_locks", "preference": "balanced"},
        "solver_config": {"engine": ENGINE_NAME, "max_time_seconds": 30},
    }


def assert_valid_solution(cfg, res):
    assert res["engine"] == ENGINE_NAME
    assert res["status"] in ("OPTIMAL", "FEASIBLE"), f"Beklenen OPTIMAL/FEASIBLE, gelen: {res['status']} -> {res.get('diagnostics')}"
    assert res["placed_blocks"] == res["total_blocks"]
    assert len(res["placements"]) == res["total_blocks"]
    v = validate_result(cfg, res)
    assert v["valid"], f"Doğrulama hatası: {v['errors']}"


def test_single_class_single_teacher():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    cfg["teachers"] = [{"id": "t1", "name": "Matematik 1", "branch": "Matematik", "min_weekly_hours": 4, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []}]
    cfg["assignments"] = [{
        "assignment_id": "c1__mat",
        "class_id": "c1", "class_name": "5/A",
        "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
        "hours": 5, "blocks": [2, 2, 1], "teacher_ids": ["t1"],
        "room_id": None, "room_type": "standard", "max_blocks_per_day": 1,
        "use_common_elective_slot": False,
    }]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    assert sorted(p["length"] for p in res["placements"]) == [1, 2, 2]


def test_few_classes_and_teachers():
    cfg = make_base_config(num_days=5, periods=7, lunch_after=4)
    courses_spec = [
        ("TRK", "Türkçe", 6, [2, 2, 2]),
        ("MAT", "Matematik", 5, [2, 2, 1]),
        ("FEN", "Fen Bilimleri", 4, [2, 2]),
        ("ING", "İngilizce", 4, [2, 2]),
        ("SOS", "Sosyal Bilgiler", 3, [2, 1]),
    ]
    for ci in range(4):
        cfg["classes"].append({"id": f"c{ci}", "name": f"5/{chr(65+ci)}", "grade_key": "5", "shift": "full_day"})
    for idx, (code, name, _h, _b) in enumerate(courses_spec):
        cfg["teachers"].append({
            "id": f"t{idx}", "name": f"{name} Öğr", "branch": name,
            "min_weekly_hours": 10, "max_weekly_hours": 30, "max_daily_hours": 6,
            "unavailable_slots": [], "prefer_avoid_slots": [],
        })
    for ci in range(4):
        for idx, (code, name, hrs, blks) in enumerate(courses_spec):
            cfg["assignments"].append({
                "assignment_id": f"c{ci}__{code}",
                "class_id": f"c{ci}", "class_name": f"5/{chr(65+ci)}",
                "course_id": code, "course_code": code, "course_name": name,
                "hours": hrs, "blocks": list(blks), "teacher_ids": [f"t{idx}"],
                "room_id": None, "room_type": "standard", "max_blocks_per_day": 1,
                "use_common_elective_slot": False,
            })
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def build_large_school_config(num_classes: int, num_teachers: int):
    cfg = make_base_config(num_days=5, periods=7, lunch_after=4)
    cfg["solver_config"]["max_time_seconds"] = 45
    # 7 branş, her sınıfta 26 saatlik (13 blok) gerçekçi ortaokul yükü
    subjects = [
        ("TRK", "Türkçe", 6, [2, 2, 2]),
        ("MAT", "Matematik", 5, [2, 2, 1]),
        ("FEN", "Fen Bilimleri", 4, [2, 2]),
        ("ING", "İngilizce", 4, [2, 2]),
        ("SOS", "Sosyal", 3, [2, 1]),
        ("DKB", "Din Kültürü", 2, [2]),
        ("BES", "Beden Eğitimi", 2, [2]),
    ]
    for ci in range(num_classes):
        grade = 5 + (ci % 4)
        sec = chr(65 + (ci // 4))
        cfg["classes"].append({"id": f"c{ci}", "name": f"{grade}/{sec}", "grade_key": str(grade), "shift": "full_day"})

    teachers_by_subj = {s[0]: [] for s in subjects}
    for ti in range(num_teachers):
        subj = subjects[ti % len(subjects)]
        tid = f"t{ti}"
        cfg["teachers"].append({
            "id": tid, "name": f"{subj[1]} {ti+1}", "branch": subj[1],
            "min_weekly_hours": 10, "max_weekly_hours": 30, "max_daily_hours": 6,
            "unavailable_slots": [], "prefer_avoid_slots": [],
        })
        teachers_by_subj[subj[0]].append(tid)

    teacher_load = {t["id"]: 0 for t in cfg["teachers"]}
    for ci in range(num_classes):
        for code, name, hrs, blks in subjects:
            pool = teachers_by_subj[code]
            tid = min(pool, key=lambda x: teacher_load[x])
            teacher_load[tid] += hrs
            cfg["assignments"].append({
                "assignment_id": f"c{ci}__{code}",
                "class_id": f"c{ci}", "class_name": cfg["classes"][ci]["name"],
                "course_id": code, "course_code": code, "course_name": name,
                "hours": hrs, "blocks": list(blks), "teacher_ids": [tid],
                "room_id": None, "room_type": "standard", "max_blocks_per_day": 1,
                "use_common_elective_slot": False,
            })
    return cfg


def test_50_plus_teachers():
    cfg = build_large_school_config(num_classes=24, num_teachers=56)
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_100_plus_teachers():
    cfg = build_large_school_config(num_classes=40, num_teachers=105)
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_double_shift_physical_time_overlap():
    """
    Sabahçı 6. ders 12:30-13:10, Öğlenci 1. ders 13:00-13:40 -> fiziksel olarak çakışıyor!
    Aynı öğretmen hem sabahçı hem öğlenci sınıfta ders veriyor; CP-SAT bu iki fiziksel
    çakışan slota aynı gün aynı öğretmeni koymamalı.
    """
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    cfg["school"]["shift_mode"] = "double"
    cfg["time_grid"]["bell_schedule"] = {
        "morning": [
            {"period": 1, "start": "08:00", "end": "08:40"},
            {"period": 2, "start": "08:50", "end": "09:30"},
            {"period": 3, "start": "09:40", "end": "10:20"},
            {"period": 4, "start": "10:30", "end": "11:10"},
            {"period": 5, "start": "11:20", "end": "12:00"},
            {"period": 6, "start": "12:30", "end": "13:10"},
        ],
        "afternoon": [
            {"period": 1, "start": "13:00", "end": "13:40"},
            {"period": 2, "start": "13:50", "end": "14:30"},
            {"period": 3, "start": "14:40", "end": "15:20"},
            {"period": 4, "start": "15:30", "end": "16:10"},
            {"period": 5, "start": "16:20", "end": "17:00"},
            {"period": 6, "start": "17:10", "end": "17:50"},
        ],
    }
    cfg["classes"] = [
        {"id": "c_m", "name": "5/A (Sabah)", "grade_key": "5", "shift": "morning"},
        {"id": "c_a", "name": "6/A (Öğle)", "grade_key": "6", "shift": "afternoon"},
    ]
    cfg["teachers"] = [
        {"id": "t1", "name": "Ortak Öğretmen", "branch": "Matematik", "min_weekly_hours": 4, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    # Sabahçı 6. derse sabitle (12:30-13:10), öğlenci dersi aynı gün 1. derse (13:00-13:40) koyamaması gerekir
    cfg["assignments"] = [
        {
            "assignment_id": "c_m__mat", "class_id": "c_m", "class_name": "5/A (Sabah)",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 1, "blocks": [1], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c_a__mat", "class_id": "c_a", "class_name": "6/A (Öğle)",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 5, "blocks": [1, 1, 1, 1, 1], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
    ]
    cfg["fixed_assignments"] = [
        {"assignment_id": "c_m__mat", "block_index": 0, "day_index": 0, "start_period": 5, "length": 1}
    ]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    # Öğlenci dersin gün 0'daki yerleşimi periyot 0 (13:00-13:40) OLMAMALI
    for pl in res["placements"]:
        if pl["assignment_id"] == "c_a__mat" and pl["day_index"] == 0:
            assert pl["start_period"] != 0


def test_closed_day_and_teacher_unavailable():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    # Çarşamba (day_index=2) tamamen kapalı
    cfg["time_grid"]["blocked_slots"] = [{"day_index": 2, "period": p} for p in range(1, 7)]
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    # Öğretmen Pazartesi (day_index=0) tamamen kapalı
    cfg["teachers"] = [{
        "id": "t1", "name": "Fen 1", "branch": "Fen",
        "min_weekly_hours": 4, "max_weekly_hours": 20, "max_daily_hours": 4,
        "unavailable_slots": [{"day_index": 0, "period": p} for p in range(1, 7)],
        "prefer_avoid_slots": [{"day_index": 4, "period": 6}],
    }]
    cfg["assignments"] = [{
        "assignment_id": "c1__fen", "class_id": "c1", "class_name": "5/A",
        "course_id": "fen", "course_code": "FEN", "course_name": "Fen Bilimleri",
        "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
        "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
    }]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    # Sadece Salı(1), Perşembe(3), Cuma(4) kullanılmalı
    used_days = sorted(pl["day_index"] for pl in res["placements"])
    assert used_days == [1, 3, 4]
    assert [pl["length"] for pl in res["placements"]] == [2, 2, 2]


def test_special_room_capacity_and_split_group_two_teachers():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    cfg["classes"] = [
        {"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"},
        {"id": "c2", "name": "5/B", "grade_key": "5", "shift": "full_day"},
    ]
    cfg["teachers"] = [
        {"id": "t1", "name": "Bilişim 1", "branch": "Bilişim", "min_weekly_hours": 2, "max_weekly_hours": 20, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
        {"id": "t2", "name": "Bilişim 2", "branch": "Bilişim", "min_weekly_hours": 2, "max_weekly_hours": 20, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    cfg["rooms"] = [
        {"id": "lab1", "name": "BT Lab-1", "room_type": "bilisim_lab", "simultaneous_capacity": 1},
    ]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__bt", "class_id": "c1", "class_name": "5/A",
            "course_id": "bt", "course_code": "BTY", "course_name": "Bilişim",
            "hours": 2, "blocks": [2], "teacher_ids": ["t1", "t2"],  # iki öğretmenli alt grup
            "room_id": "lab1", "room_type": "bilisim_lab", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c2__bt", "class_id": "c2", "class_name": "5/B",
            "course_id": "bt", "course_code": "BTY", "course_name": "Bilişim",
            "hours": 2, "blocks": [2], "teacher_ids": ["t1"],
            "room_id": "lab1", "room_type": "bilisim_lab", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
    ]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    p1, p2 = res["placements"]
    assert p1["room_id"] == "lab1" and p2["room_id"] == "lab1"
    assert not (p1["day_index"] == p2["day_index"] and p1["start_period"] == p2["start_period"])


def test_common_elective_slots():
    cfg = make_base_config(num_days=5, periods=7, lunch_after=4)
    # Cuma 5., 6., 7. dersler ortak seçmeli
    cfg["time_grid"]["common_elective_slots"] = [
        {"day_index": 4, "period": 5},
        {"day_index": 4, "period": 6},
        {"day_index": 4, "period": 7},
    ]
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    cfg["teachers"] = [
        {"id": "t1", "name": "Mat 1", "branch": "Matematik", "min_weekly_hours": 2, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
        {"id": "t2", "name": "Seçmeli 1", "branch": "Bilişim", "min_weekly_hours": 2, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__mat", "class_id": "c1", "class_name": "5/A",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c1__rob", "class_id": "c1", "class_name": "5/A",
            "course_id": "rob", "course_code": "ROB", "course_name": "Robotik",
            "hours": 2, "blocks": [2], "teacher_ids": ["t2"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": True,
        },
    ]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    rob = [p for p in res["placements"] if p["course_code"] == "ROB"][0]
    assert rob["day_index"] == 4 and rob["start_period"] in (4, 5)
    for p in res["placements"]:
        if p["course_code"] == "MAT" and p["day_index"] == 4:
            assert p["start_period"] + p["length"] <= 4


def test_fixed_course_block_index_and_fixed_teacher_and_fill_empty():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    cfg["teachers"] = [
        {"id": "t1", "name": "Türkçe 1", "branch": "Türkçe", "min_weekly_hours": 6, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
        {"id": "t2", "name": "Mat 1", "branch": "Matematik", "min_weekly_hours": 4, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__trk", "class_id": "c1", "class_name": "5/A",
            "course_id": "trk", "course_code": "TRK", "course_name": "Türkçe",
            "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c1__mat", "class_id": "c1", "class_name": "5/A",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 4, "blocks": [2, 2], "teacher_ids": ["t2"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
    ]
    # Aynı uzunluktaki 2+2+2 bloktan sadece block_index=1'i Çarşamba 1. derse sabitle
    cfg["fixed_assignments"] = [
        {"assignment_id": "c1__trk", "block_index": 1, "day_index": 2, "start_period": 0, "length": 2},
    ]
    res1 = solve_timetable(cfg)
    assert_valid_solution(cfg, res1)
    trk_b1 = [p for p in res1["placements"] if p["assignment_id"] == "c1__trk" and p["block_index"] == 1][0]
    assert trk_b1["day_index"] == 2 and trk_b1["start_period"] == 0

    # Şimdi t1 öğretmeninin TÜM yerleşimlerini sabitle ve yeniden dağıt (fill_empty / locked teacher)
    t1_fixed = [p for p in res1["placements"] if "t1" in p["teacher_ids"]]
    cfg["fixed_assignments"] = t1_fixed
    cfg["solution_request"] = {"mode": "fill_empty", "preference": "fewer_gaps"}
    res2 = solve_timetable(cfg)
    assert_valid_solution(cfg, res2)
    for orig in t1_fixed:
        match = [p for p in res2["placements"] if p["assignment_id"] == orig["assignment_id"] and p["block_index"] == orig["block_index"]][0]
        assert match["day_index"] == orig["day_index"] and match["start_period"] == orig["start_period"]


@pytest.mark.parametrize("pref", ["balanced", "fewer_gaps", "spread_days"])
def test_all_three_preferences(pref):
    cfg = make_base_config(num_days=5, periods=7, lunch_after=4)
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    cfg["teachers"] = [{"id": "t1", "name": "Öğr 1", "branch": "Genel", "min_weekly_hours": 6, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []}]
    cfg["assignments"] = [{
        "assignment_id": "c1__d1", "class_id": "c1", "class_name": "5/A",
        "course_id": "d1", "course_code": "MAT", "course_name": "Matematik",
        "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
        "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
    }]
    cfg["solution_request"]["preference"] = pref
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_10_classes_20_teachers():
    cfg = build_large_school_config(num_classes=10, num_teachers=20)
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_30_classes_50_teachers():
    cfg = build_large_school_config(num_classes=30, num_teachers=50)
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_50_classes_100_plus_teachers():
    cfg = build_large_school_config(num_classes=50, num_teachers=105)
    cfg["solver_config"]["max_time_seconds"] = 60
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)


def test_max_working_days_consecutive_and_daily_gaps():
    cfg = make_base_config(num_days=5, periods=7, lunch_after=0)
    cfg["classes"] = [
        {"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"},
        {"id": "c2", "name": "5/B", "grade_key": "5", "shift": "full_day"},
    ]
    cfg["teachers"] = [{
        "id": "t1", "name": "Kısıtlı Öğr", "branch": "Matematik",
        "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6,
        "max_consecutive_hours": 3,
        "max_daily_gaps": 1,
        "max_working_days": 3,
        "unavailable_slots": [], "prefer_avoid_slots": [],
    }]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__mat", "class_id": "c1", "class_name": "5/A",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c2__mat", "class_id": "c2", "class_name": "5/B",
            "course_id": "mat", "course_code": "MAT", "course_name": "Matematik",
            "hours": 6, "blocks": [2, 2, 2], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
    ]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    worked_days = {p["day_index"] for p in res["placements"]}
    assert len(worked_days) <= 3


def test_building_travel_time_constraint():
    """
    A Blok ve B Blok arasında 25 dk geçiş süresi tanımlı; teneffüs 10 dk.
    Aynı öğretmen 1. derste A Blok'ta (08:30-09:10) ise 2. derste B Blok'ta (09:20-10:00) olamaz (10 < 25).
    """
    cfg = make_base_config(num_days=2, periods=5, lunch_after=0)
    cfg["school"]["building_travel_minutes"] = 25
    cfg["classes"] = [
        {"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day", "building": "A-Blok"},
        {"id": "c2", "name": "6/A", "grade_key": "6", "shift": "full_day", "building": "B-Blok"},
    ]
    cfg["teachers"] = [{
        "id": "t1", "name": "Gezen Öğr", "branch": "Müzik",
        "min_weekly_hours": 0, "max_weekly_hours": 20, "max_daily_hours": 4,
        "unavailable_slots": [], "prefer_avoid_slots": [],
    }]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__mzk", "class_id": "c1", "class_name": "5/A",
            "course_id": "mzk", "course_code": "MZK", "course_name": "Müzik",
            "hours": 1, "blocks": [1], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
        {
            "assignment_id": "c2__mzk", "class_id": "c2", "class_name": "6/A",
            "course_id": "mzk", "course_code": "MZK", "course_name": "Müzik",
            "hours": 1, "blocks": [1], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
        },
    ]
    # İkisini de aynı güne zorlamak için gün 1'i kapat
    cfg["time_grid"]["blocked_slots"] = [{"day_index": 1, "period": p} for p in range(1, 6)]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    p1, p2 = sorted(res["placements"], key=lambda x: x["start_period"])
    assert p2["start_period"] - (p1["start_period"] + p1["length"]) >= 1


def test_synchronized_common_electives_across_classes():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    # 4 saatlik ortak seçmeli havuzu var, iki 5. sınıfın 2'şer saatlik ortak seçmelisi aynı saatte senkronize olmalı
    cfg["time_grid"]["common_elective_slots"] = [
        {"day_index": 2, "period": 5},
        {"day_index": 2, "period": 6},
        {"day_index": 4, "period": 5},
        {"day_index": 4, "period": 6},
    ]
    cfg["classes"] = [
        {"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"},
        {"id": "c2", "name": "5/B", "grade_key": "5", "shift": "full_day"},
    ]
    cfg["teachers"] = [
        {"id": "t1", "name": "Seçmeli 1", "branch": "Bilişim", "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
        {"id": "t2", "name": "Seçmeli 2", "branch": "Spor", "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    cfg["assignments"] = [
        {
            "assignment_id": "c1__s1", "class_id": "c1", "class_name": "5/A",
            "course_id": "s1", "course_code": "ROB", "course_name": "Robotik",
            "hours": 2, "blocks": [2], "teacher_ids": ["t1"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": True,
        },
        {
            "assignment_id": "c2__s2", "class_id": "c2", "class_name": "5/B",
            "course_id": "s2", "course_code": "SPR", "course_name": "Spor",
            "hours": 2, "blocks": [2], "teacher_ids": ["t2"],
            "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": True,
        },
    ]
    res = solve_timetable(cfg)
    assert_valid_solution(cfg, res)
    p1, p2 = res["placements"]
    assert p1["day_index"] == p2["day_index"] and p1["start_period"] == p2["start_period"]


def test_redistribute_selected_class_and_teacher():
    cfg = make_base_config(num_days=5, periods=6, lunch_after=0)
    cfg["classes"] = [
        {"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"},
        {"id": "c2", "name": "5/B", "grade_key": "5", "shift": "full_day"},
    ]
    cfg["teachers"] = [
        {"id": "t1", "name": "Öğr 1", "branch": "Mat", "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
        {"id": "t2", "name": "Öğr 2", "branch": "Fen", "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []},
    ]
    cfg["assignments"] = [
        {"assignment_id": "c1__mat", "class_id": "c1", "class_name": "5/A", "course_id": "mat", "course_code": "MAT", "course_name": "Mat", "hours": 4, "blocks": [2, 2], "teacher_ids": ["t1"], "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False},
        {"assignment_id": "c2__fen", "class_id": "c2", "class_name": "5/B", "course_id": "fen", "course_code": "FEN", "course_name": "Fen", "hours": 4, "blocks": [2, 2], "teacher_ids": ["t2"], "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False},
    ]
    res1 = solve_timetable(cfg)
    assert_valid_solution(cfg, res1)

    # Sadece c1'i yeniden dağıt, c2 sabit kalsın
    c2_fixed = [p for p in res1["placements"] if p["class_id"] == "c2"]
    cfg["fixed_assignments"] = c2_fixed
    cfg["solution_request"] = {"mode": "redistribute_class", "target_id": "c1", "preference": "spread_days"}
    res2 = solve_timetable(cfg)
    assert_valid_solution(cfg, res2)
    for orig in c2_fixed:
        m = [p for p in res2["placements"] if p["assignment_id"] == orig["assignment_id"] and p["block_index"] == orig["block_index"]][0]
        assert m["day_index"] == orig["day_index"] and m["start_period"] == orig["start_period"]

    # Sadece t1'i yeniden dağıt, t2 sabit kalsın
    t2_fixed = [p for p in res2["placements"] if "t2" in p["teacher_ids"]]
    cfg["fixed_assignments"] = t2_fixed
    cfg["solution_request"] = {"mode": "redistribute_teacher", "target_id": "t1", "preference": "fewer_gaps"}
    res3 = solve_timetable(cfg)
    assert_valid_solution(cfg, res3)
    for orig in t2_fixed:
        m = [p for p in res3["placements"] if p["assignment_id"] == orig["assignment_id"] and p["block_index"] == orig["block_index"]][0]
        assert m["day_index"] == orig["day_index"] and m["start_period"] == orig["start_period"]


def test_repair_min_changes_preserves_existing_schedule():
    """
    Aşama 3 Kural 8: En Az Değişiklikle Onarma (repair_min_changes).
    20 ders bloğundan oluşan geçerli bir programda yalnız 1 öğretmenin Salı günü
    1. dersi sonradan kapatıldığında, OR-Tools kilitleri koruyup diğer derslerin
    büyük çoğunluğunu yerinde bırakarak sadece çakışan dersi taşımalıdır.
    """
    cfg = build_large_school_config(num_classes=4, num_teachers=8)
    res1 = solve_timetable(cfg)
    assert_valid_solution(cfg, res1)

    # İlk yerleşimden bir bloğu seç ve o öğretmenin o saatini kapat
    victim = res1["placements"][0]
    victim_tid = victim["teacher_ids"][0]
    victim_day = victim["day_index"]
    victim_period = victim["start_period"]

    for t in cfg["teachers"]:
        if t["id"] == victim_tid:
            t["unavailable_slots"].append({"day_index": victim_day, "period": victim_period + 1})

    # Başka bir bloğu kilitle
    locked_pl = res1["placements"][-1]
    cfg["fixed_assignments"] = [locked_pl]
    cfg["previous_placements"] = res1["placements"]
    cfg["solution_request"] = {"mode": "repair_min_changes", "preference": "balanced"}

    res2 = solve_timetable(cfg)
    assert_valid_solution(cfg, res2)

    # Kilitli blok kesinlikle aynı yerde kalmalı
    locked_after = [
        p for p in res2["placements"]
        if p["assignment_id"] == locked_pl["assignment_id"] and p["block_index"] == locked_pl["block_index"]
    ][0]
    assert locked_after["day_index"] == locked_pl["day_index"]
    assert locked_after["start_period"] == locked_pl["start_period"]
    assert locked_after["block_id"] == f"{locked_pl['assignment_id']}__b{locked_pl['block_index']}"

    # Değişen blok sayısı çok az olmalı (en fazla 2 blok hareket etmeli)
    old_pos = {(p["assignment_id"], p["block_index"]): (p["day_index"], p["start_period"]) for p in res1["placements"]}
    moved_count = sum(
        1 for p in res2["placements"]
        if old_pos[(p["assignment_id"], p["block_index"])] != (p["day_index"], p["start_period"])
    )
    assert 1 <= moved_count <= 2, f"En az değişiklikle onarımda {moved_count} blok değişti (beklenen 1-2)"
