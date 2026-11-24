"""
Gün indeksi dönüştürme ve eski sürüm JSON/kilit göçü testleri (test_import_export.py).
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLVER_DIR = os.path.join(ROOT, "solver")
if SOLVER_DIR not in sys.path:
    sys.path.insert(0, SOLVER_DIR)

from solver_ortools import solve_timetable
from validate_model import resolve_fixed_assignments
from validate_result import validate_result
from test_solver import make_base_config


def test_day_index_mapping_with_non_contiguous_active_days():
    """
    Aktif günler: Pazartesi(0), Salı(1), Perşembe(3), Cuma(4) -> 4 kompakt gün (0,1,2,3).
    teaching_day_indices = [0, 1, 3, 4], num_days = 4.
    """
    cfg = make_base_config(num_days=4, periods=6, lunch_after=0)
    cfg["time_grid"]["teaching_day_indices"] = [0, 1, 3, 4]
    cfg["time_grid"]["days"] = [
        {"index": 0, "name": "Pazartesi"},
        {"index": 1, "name": "Salı"},
        {"index": 2, "name": "Perşembe"},
        {"index": 3, "name": "Cuma"},
    ]
    cfg["classes"] = [{"id": "c1", "name": "5/A", "grade_key": "5", "shift": "full_day"}]
    cfg["teachers"] = [{"id": "t1", "name": "Öğr 1", "branch": "Türkçe", "min_weekly_hours": 0, "max_weekly_hours": 30, "max_daily_hours": 6, "unavailable_slots": [], "prefer_avoid_slots": []}]
    cfg["assignments"] = [{
        "assignment_id": "c1__trk", "class_id": "c1", "class_name": "5/A",
        "course_id": "trk", "course_code": "TRK", "course_name": "Türkçe",
        "hours": 8, "blocks": [2, 2, 2, 2], "teacher_ids": ["t1"],
        "room_id": None, "room_type": "standard", "max_blocks_per_day": 1, "use_common_elective_slot": False,
    }]
    res = solve_timetable(cfg)
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert sorted(p["day_index"] for p in res["placements"]) == [0, 1, 2, 3]
    assert validate_result(cfg, res)["valid"]


def test_legacy_fixed_assignments_without_block_index():
    """Eski sürüm JSON yedeklerinde block_index alanı yoksa uzunlukla doğru bloğa eşlenmeli."""
    assignments_by_id = {
        "c1__mat": {
            "assignment_id": "c1__mat",
            "class_name": "5/A",
            "course_name": "Matematik",
            "blocks": [2, 2, 1],
        }
    }
    legacy_fixed = [
        {"assignment_id": "c1__mat", "day_index": 0, "start_period": 0, "length": 2},
        {"assignment_id": "c1__mat", "day_index": 2, "start_period": 2, "length": 1},
    ]
    resolved, errors = resolve_fixed_assignments(legacy_fixed, assignments_by_id)
    assert not errors
    assert ("c1__mat", 0) in resolved
    assert ("c1__mat", 2) in resolved
    assert resolved[("c1__mat", 0)]["day_index"] == 0
    assert resolved[("c1__mat", 2)]["day_index"] == 2
