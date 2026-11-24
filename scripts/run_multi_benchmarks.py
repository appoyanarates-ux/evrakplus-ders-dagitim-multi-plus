"""
EvrakPlus Ders Dağıtım Multi Plus - 6 Okul Profili Gerçek Performans Testi (run_multi_benchmarks.py)
Profiller:
  1. Küçük      : 10 öğretmen,  5 şube
  2. Normal     : 25 öğretmen, 12 şube
  3. Orta       : 50 öğretmen, 24 şube
  4. Büyük      : 100 öğretmen, 45 şube
  5. Çok Büyük  : 150 öğretmen, 65 şube
  6. Ultimate   : 250 öğretmen, 100 şube
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, List

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOLVER_DIR = os.path.join(ROOT, "solver")
for _p in (ROOT, SOLVER_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from multi_solver_engine import health_check_all, run_multi_solver  # noqa: E402


def build_school_profile(name: str, num_teachers: int, num_classes: int) -> Dict[str, Any]:
    num_days = 5
    periods_per_day = 7
    classes = [
        {"id": f"c{i+1}", "name": f"{5 + (i % 4)}/{chr(65 + (i // 4) % 26)}{i+1}", "grade": 5 + (i % 4), "shift": "full_day", "building": "Ana Bina"}
        for i in range(num_classes)
    ]
    branches = ["Matematik", "Türkçe", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü", "Görsel", "Müzik", "Beden", "Bilişim"]
    teachers = [
        {
            "id": f"t{i+1}",
            "name": f"Öğretmen {i+1}",
            "branch": branches[i % len(branches)],
            "min_weekly_hours": 1,
            "max_weekly_hours": 30,
            "max_daily_hours": 7,
            "unavailable_slots": [{"day_index": i % 5, "period": 7}] if i % 4 == 0 else [],
            "prefer_avoid_slots": [{"day_index": 4, "period": 7}],
        }
        for i in range(num_teachers)
    ]

    # Her şube için 6 ders x 4 saat = 24 saat (bloklar [2, 2]) — öğretmen yükü dengeli (~12-16 sa)
    assignments = []
    teacher_load = [0] * num_teachers
    aid = 1
    courses_per_class = 6
    for ci, cls in enumerate(classes):
        for k in range(courses_per_class):
            # En az yüklü öğretmeni seç
            best_ti = min(range(num_teachers), key=lambda idx: (teacher_load[idx], (idx - ci - k) % num_teachers))
            teacher_load[best_ti] += 4
            assignments.append({
                "assignment_id": f"a{aid}",
                "class_id": cls["id"],
                "class_name": cls["name"],
                "course_id": f"crs_{k}",
                "course_name": branches[k % len(branches)],
                "teacher_ids": [teachers[best_ti]["id"]],
                "hours": 4,
                "blocks": [2, 2],
                "max_blocks_per_day": 1,
                "room_type": "standard",
                "room_id": None,
                "use_common_elective_slot": False,
            })
            aid += 1

    return {
        "schema_version": "2.0",
        "school": {"name": name, "type": "ortaokul", "building_travel_minutes": 0},
        "time_grid": {
            "num_days": num_days,
            "periods_per_day": periods_per_day,
            "blocked_slots": [],
            "common_elective_slots": [],
            "lunch_break": {"after_period": 0},
            "long_break": {"after_period": 0, "prevent_block_split": False},
        },
        "classes": classes,
        "teachers": teachers,
        "rooms": [],
        "assignments": assignments,
        "fixed_assignments": [],
        "solution_request": {
            "preference": "balanced",
            "time_limit_sec": 20,
            "multi_mode": "single",
            "performance_mode": "balanced",
            "enable_multipass": False,
        },
    }


def main() -> int:
    hc = health_check_all()
    profiles = [
        ("Küçük", 10, 5, ["ortools", "timefold", "choco", "minizinc", "scip", "highs"], 15),
        ("Normal", 25, 12, ["ortools", "timefold", "choco", "minizinc", "scip", "highs"], 15),
        ("Orta", 50, 24, ["ortools", "timefold", "highs"], 20),
        ("Büyük", 100, 45, ["ortools", "timefold"], 25),
        ("Çok Büyük", 150, 65, ["ortools"], 30),
        ("Ultimate", 250, 100, ["ortools"], 40),
    ]

    results: List[Dict[str, Any]] = []
    for pname, nt, nc, engines, tlim in profiles:
        cfg = build_school_profile(pname, nt, nc)
        for eng in engines:
            cfg["solution_request"]["engines"] = [eng]
            cfg["solution_request"]["time_limit_sec"] = tlim
            res = run_multi_solver(cfg)
            q = res.get("quality") or {}
            v = res.get("validation") or {}
            row = {
                "profile": pname,
                "teachers": nt,
                "classes": nc,
                "engine": eng,
                "engine_version": res.get("engine_version") or (hc["engines"].get(eng, {}).get("version", "")),
                "status": res.get("status"),
                "valid": bool(v.get("valid")),
                "solve_time_sec": res.get("solve_time_sec"),
                "placed_blocks": res.get("placed_blocks"),
                "total_blocks": res.get("total_blocks"),
                "hard_violations": q.get("hard_violations", 0),
                "soft_violations": q.get("soft_violations", 0),
                "quality_score": q.get("quality_score", 0.0),
            }
            results.append(row)
            print(f"[{pname} {nt}T/{nc}C] {eng:9s} -> {row['status']:10s} valid={str(row['valid']):5s} {row['placed_blocks']}/{row['total_blocks']} time={row['solve_time_sec']}s score={row['quality_score']}/100")

    out_json = os.path.join(ROOT, "docs", "multi_benchmark_results.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"health": hc, "benchmarks": results}, f, ensure_ascii=False, indent=2)
    print(f"Saved: {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
