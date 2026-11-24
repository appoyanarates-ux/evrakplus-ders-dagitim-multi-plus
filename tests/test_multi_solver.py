"""
EvrakPlus Ders Dağıtım Multi Plus - 6 Motorlu Entegrasyon & Doğrulama Testleri (test_multi_solver.py).
Altı gerçek optimizasyon altyapısının (OR-Tools, Timefold, Choco, MiniZinc [Gecode/Chuffed], SCIP, HiGHS),
bağımsız doğrulayıcının, ortak 100'lük kalite puanlamanın ve Multi-Pass/Hibrit/Paralel modların
gerçek okul verileriyle çalıştığını doğrular.
"""

from __future__ import annotations

import os
import sys
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOLVER_DIR = os.path.join(ROOT, "solver")
for _p in (ROOT, SOLVER_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from multi_solver_engine import health_check_all, run_multi_solver  # noqa: E402
from quality_scorer import compare_solutions, score_schedule  # noqa: E402
from validate_result import validate_result  # noqa: E402


def make_sample_school_config(num_classes: int = 3, num_teachers: int = 4) -> dict:
    classes = [
        {"id": f"c{i+1}", "name": f"5/{chr(65+i)}", "grade": 5, "shift": "full_day", "building": "Ana Bina"}
        for i in range(num_classes)
    ]
    teachers = [
        {
            "id": f"t{i+1}",
            "name": f"Öğretmen {i+1}",
            "branch": ["Matematik", "Türkçe", "Fen Bilimleri", "İngilizce"][i % 4],
            "min_weekly_hours": 1,
            "max_weekly_hours": 30,
            "max_daily_hours": 6,
            "unavailable_slots": [{"day_index": i % 5, "period": 6}] if i % 2 == 0 else [],
            "prefer_avoid_slots": [{"day_index": 4, "period": 6}],
        }
        for i in range(num_teachers)
    ]
    rooms = [
        {"id": "r_fen", "name": "Fen Lab", "type": "lab_fen", "simultaneous_capacity": 1, "building": "Ana Bina"},
    ]
    assignments = []
    aid_counter = 1
    for ci, cls in enumerate(classes):
        for ti in range(min(num_teachers, 4)):
            is_fen = (ti % 4 == 2)
            assignments.append({
                "assignment_id": f"a{aid_counter}",
                "class_id": cls["id"],
                "class_name": cls["name"],
                "course_id": f"crs_{ti}",
                "course_name": ["Matematik", "Türkçe", "Fen Bilimleri", "İngilizce"][ti % 4],
                "teacher_ids": [teachers[ti]["id"]],
                "hours": 4,
                "total_hours": 4,
                "weekly_hours": 4,
                "blocks": [2, 2],
                "max_blocks_per_day": 1,
                "room_type": "lab_fen" if is_fen else "standard",
                "room_id": None,
                "use_common_elective_slot": False,
            })
            aid_counter += 1

    return {
        "schema_version": "2.0",
        "school": {"name": "Test Ortaokulu", "type": "ortaokul", "building_travel_minutes": 0},
        "time_grid": {
            "num_days": 5,
            "periods_per_day": 6,
            "blocked_slots": [],
            "common_elective_slots": [],
            "lunch_break": {"after_period": 0},
            "long_break": {"after_period": 0, "prevent_block_split": False},
        },
        "classes": classes,
        "teachers": teachers,
        "rooms": rooms,
        "assignments": assignments,
        "fixed_assignments": [
            {"assignment_id": "a1", "block_index": 0, "day_index": 0, "start_period": 0}
        ],
        "solution_request": {
            "preference": "balanced",
            "time_limit_sec": 15,
            "multi_mode": "single",
            "performance_mode": "balanced",
        },
    }


def test_health_check_all_six_engines():
    hc = health_check_all()
    assert hc["total_engines"] == 6
    for key in ["ortools", "timefold", "choco", "minizinc", "scip", "highs"]:
        assert key in hc["engines"], f"Eksik motor: {key}"
        assert hc["engines"][key]["available"] is True, f"Motor erişilemiyor: {key} -> {hc['engines'][key]}"
        assert hc["engines"][key]["version"] not in ("", "unavailable")


@pytest.mark.parametrize("engine_key", ["ortools", "timefold", "choco", "minizinc", "scip", "highs"])
def test_each_engine_solves_and_passes_independent_validator(engine_key: str):
    cfg = make_sample_school_config(num_classes=3, num_teachers=4)
    cfg["solution_request"]["multi_mode"] = "single"
    cfg["solution_request"]["engines"] = [engine_key]
    cfg["solution_request"]["time_limit_sec"] = 20

    res = run_multi_solver(cfg)
    assert res["status"] in ("OPTIMAL", "FEASIBLE"), f"{engine_key} başarısız: {res.get('status')} / {res.get('diagnostics')}"
    assert res["placed_blocks"] == res["total_blocks"]
    assert res["validation"]["valid"] is True
    assert res["validation"]["classification"] == "VALID"
    assert res["quality"]["rank_tier"] == 2
    assert 0.0 <= res["quality"]["quality_score"] <= 100.0

    # Kilitli ders korunmuş mu?
    locked = [p for p in res["placements"] if p["assignment_id"] == "a1" and p["block_index"] == 0]
    assert len(locked) == 1
    assert locked[0]["day_index"] == 0 and locked[0]["start_period"] == 0


def test_minizinc_chuffed_backend():
    cfg = make_sample_school_config(num_classes=2, num_teachers=3)
    cfg["solution_request"]["multi_mode"] = "single"
    cfg["solution_request"]["engines"] = ["minizinc"]
    cfg["solution_request"]["minizinc_backend"] = "chuffed"
    cfg["solution_request"]["time_limit_sec"] = 15

    res = run_multi_solver(cfg)
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert res["backend_solver"] == "chuffed"
    assert res["validation"]["valid"] is True


def test_hybrid_mode_ortools_and_timefold_and_highs():
    cfg = make_sample_school_config(num_classes=3, num_teachers=4)
    cfg["solution_request"]["multi_mode"] = "hybrid"
    cfg["solution_request"]["engines"] = ["ortools", "timefold", "highs"]
    cfg["solution_request"]["time_limit_sec"] = 20

    res = run_multi_solver(cfg)
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert res["validation"]["valid"] is True
    assert len(res["candidates"]) == 3
    assert any(c["engine_key"] == "ortools" and c["valid"] for c in res["candidates"])
    assert any(c["engine_key"] == "timefold" and c["valid"] for c in res["candidates"])
    assert any(c["engine_key"] == "highs" and c["valid"] for c in res["candidates"])


def test_parallel_and_sequential_modes():
    cfg = make_sample_school_config(num_classes=2, num_teachers=3)
    cfg["solution_request"]["multi_mode"] = "parallel"
    cfg["solution_request"]["engines"] = ["ortools", "scip", "highs"]
    cfg["solution_request"]["time_limit_sec"] = 15
    res_par = run_multi_solver(cfg)
    assert res_par["validation"]["valid"] is True
    assert len(res_par["candidates"]) == 3

    cfg["solution_request"]["multi_mode"] = "sequential"
    cfg["solution_request"]["engines"] = ["scip", "ortools"]
    res_seq = run_multi_solver(cfg)
    assert res_seq["validation"]["valid"] is True
    assert len(res_seq["candidates"]) >= 1


def test_invalid_schedule_never_beats_valid_schedule():
    cfg = make_sample_school_config(num_classes=2, num_teachers=2)
    valid_candidate = {
        "engine_key": "ortools",
        "solve_time_sec": 2.0,
        "quality": {"rank_tier": 2, "hard_violations": 0, "placed_blocks": 8, "quality_score": 65.0},
    }
    invalid_high_soft = {
        "engine_key": "fake_bad",
        "solve_time_sec": 0.1,
        "quality": {"rank_tier": 0, "hard_violations": 1, "placed_blocks": 8, "quality_score": 99.0},
    }
    ranked = compare_solutions([invalid_high_soft, valid_candidate])
    assert ranked[0]["engine_key"] == "ortools"
