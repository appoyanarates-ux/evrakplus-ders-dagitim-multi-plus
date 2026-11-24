#!/usr/bin/env python3
"""
EvrakPlus Ders Dagitim - Son Yayin Kabul Performans ve Sert Kisit Olcumu
4 okul profili (10/5, 30/15, 70/30, 120/50) + kilitli dersler (fixed_assignments) +
kapali ogretmen saatleri (unavailable_slots) + ozel derslik kapasitesi (rooms) +
ortak secmeli saatleri + infeasible + time-limit senaryolari.

Bellek olcumleri ayri ayri raporlanir:
  - payload_kb: Model JSON dosya buyuklugu (KB)
  - peak_py_heap_mb: Python tracemalloc yigin pik bellegi (MB, yalnizca Python nesneleri)
  - peak_os_rss_mb: Windows GetProcessMemoryInfo PeakWorkingSetSize (MB, C++ OR-Tools dahil gercek RAM)
"""
import ctypes
import json
import os
import sys
import time
import tracemalloc
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "solver"))

from solver_ortools import ENGINE_NAME, solve_timetable
from validate_result import validate_result


class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.c_uint32),
        ("PageFaultCount", ctypes.c_uint32),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def get_process_memory_mb():
    """Windows OS gercek surec bellegi (Current RSS & Peak Working Set, MB)."""
    try:
        psapi = ctypes.WinDLL("psapi.dll")
        kernel32 = ctypes.WinDLL("kernel32.dll")
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        psapi.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
        psapi.GetProcessMemoryInfo.restype = ctypes.c_int
        hproc = kernel32.GetCurrentProcess()
        pmc = PROCESS_MEMORY_COUNTERS()
        pmc.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
        if psapi.GetProcessMemoryInfo(hproc, ctypes.byref(pmc), pmc.cb):
            return (
                round(pmc.WorkingSetSize / (1024 * 1024), 2),
                round(pmc.PeakWorkingSetSize / (1024 * 1024), 2),
            )
    except Exception:
        pass
    return (0.0, 0.0)


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


def build_hard_school_model(
    num_classes: int,
    num_teachers: int,
    periods: int = 7,
    time_limit: int = 45,
    make_infeasible: bool = False,
    with_hard_constraints: bool = True,
):
    num_days = 5
    days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]
    classes = []
    for i in range(num_classes):
        grade = 5 + (i % 4)
        sec = chr(65 + (i // 4) % 26)
        classes.append({
            "id": f"c_{i + 1}",
            "name": f"{grade}/{sec}",
            "grade_key": str(grade),
            "shift": "full_day",
        })

    # 14x2 + 7x1 = 35 saat / hafta (oglen arasi 4. saatten sonra tam sigar)
    subjects = [
        ("mat", "MAT", "Matematik", [2, 2, 1], "standard", False),       # 5
        ("tur", "TUR", "Türkçe", [2, 2, 1], "standard", False),          # 5
        ("fen", "FEN", "Fen Bilimleri", [2, 2], "standard", False),      # 4
        ("sos", "SOS", "Sosyal Bilgiler", [2, 1], "standard", False),    # 3
        ("ing", "ING", "İngilizce", [2, 1], "standard", False),          # 3
        ("din", "DIN", "Din Kültürü", [2], "standard", False),           # 2
        ("bed", "BED", "Beden Eğitimi", [2], "spor_salonu", False),      # 2
        ("gor", "GOR", "Görsel Sanatlar", [1], "standard", False),       # 1
        ("muz", "MUZ", "Müzik", [1], "standard", False),                 # 1
        ("bil", "BIL", "Bilişim", [2], "bilisim_lab", False),            # 2
        ("sc1", "SC1", "Seçmeli 1", [2], "standard", False),             # 2
        ("sc2", "SC2", "Seçmeli 2", [2], "standard", False),             # 2
        ("sc3", "SC3", "Seçmeli 3", [2], "standard", False),             # 2
        ("reh", "REH", "Rehberlik", [1], "standard", False),             # 1
    ]

    all_slots = [{"day_index": d, "period": p} for d in range(num_days) for p in range(1, periods + 1)]
    teachers = []
    unavailable_teacher_count = 0
    for t in range(num_teachers):
        subj_name = subjects[t % len(subjects)][2]
        unavail = []
        if make_infeasible and t == 0:
            unavail = all_slots
        elif with_hard_constraints and t % 4 == 1:
            # %25 ogretmenin 1 kapali gunu/yarim gunu (son 3 saat kapali -> kesin cozulebilir sert kisit)
            closed_day = t % num_days
            unavail = [{"day_index": closed_day, "period": p} for p in (5, 6, 7)]
            unavailable_teacher_count += 1

        teachers.append({
            "id": f"t_{t + 1}",
            "name": f"Öğretmen {t + 1}",
            "branch": subj_name,
            "min_weekly_hours": 0,
            "max_weekly_hours": 30,
            "max_daily_hours": periods,
            "unavailable_slots": unavail,
            "prefer_avoid_slots": [],
        })

    # Ozel derslik kapasitesi (Her sinif 2 saat Bilisim + 2 saat Beden -> 50 sube = 100 saat / 35 slot => en az 4 lab & 4 spor alani)
    needed_rooms = max(1, (num_classes * 2 + 25) // 26)
    rooms = []
    if with_hard_constraints:
        for r in range(needed_rooms):
            rooms.append({"id": f"lab_{r + 1}", "name": f"Bilişim Lab {r + 1}", "type": "bilisim_lab", "capacity": 1})
            rooms.append({"id": f"spor_{r + 1}", "name": f"Spor Alanı {r + 1}", "type": "spor_salonu", "capacity": 1})

    teacher_load = {t["id"]: 0 for t in teachers}
    assignments = []
    fixed_assignments = []
    locked_teacher_slots = set()

    for c_idx, cls in enumerate(classes):
        for cid, code, name, blocks, rtype, use_common in subjects:
            hrs = sum(blocks)
            tid = min(teacher_load.keys(), key=lambda x: teacher_load[x])
            teacher_load[tid] += hrs
            aid = f"{cls['id']}__{cid}"
            assignments.append({
                "assignment_id": aid,
                "class_id": cls["id"],
                "class_name": cls["name"],
                "course_id": cid,
                "course_code": code,
                "course_name": name,
                "hours": hrs,
                "blocks": blocks,
                "teacher_ids": [tid],
                "room_id": None,
                "room_type": rtype if with_hard_constraints else "standard",
                "max_blocks_per_day": 1,
                "use_common_elective_slot": use_common,
            })

            # Sert kilitli dersler (ilk N subenin Matematik 0. blogunu Pazartesi-Cuma 1. saate kilitle, ogretmen cakismasiz!)
            if with_hard_constraints and cid == "mat" and len(fixed_assignments) < min(20, num_classes):
                day_i = c_idx % num_days
                start_p = 1
                if (tid, day_i, start_p) not in locked_teacher_slots and (tid, day_i, start_p + 1) not in locked_teacher_slots:
                    # Ogretmenin kapali saatiyle cakismadigindan emin ol (kapali saatler 5,6,7 oldugu icin 1-2 her zaman acik)
                    fixed_assignments.append({
                        "assignment_id": aid,
                        "block_index": 0,
                        "day_index": day_i,
                        "start_period": start_p,
                        "length": blocks[0],
                    })
                    locked_teacher_slots.add((tid, day_i, start_p))
                    locked_teacher_slots.add((tid, day_i, start_p + 1))

    model = {
        "schema_version": "4.0-meb-2026-2027",
        "solver_target": ENGINE_NAME,
        "school": {
            "name": f"Test Okulu ({num_teachers} Öğrt / {num_classes} Şube)",
            "academic_year": "2026-2027",
            "meb_school_type": "ortaokul",
            "shift_mode": "single",
            "weekly_target_hours": num_days * periods,
        },
        "time_grid": {
            "num_days": num_days,
            "days": [{"index": i, "name": n} for i, n in enumerate(days)],
            "periods_per_day": periods,
            "lunch_break": {"after_period": 4, "duration_min": 45},
            "teaching_day_indices": list(range(num_days)),
            "bell_schedule": make_bell(periods, 8, 30, 4),
            "blocked_slots": [],
            "common_elective_slots": [],
        },
        "classes": classes,
        "teachers": teachers,
        "rooms": rooms,
        "assignments": assignments,
        "fixed_assignments": fixed_assignments,
        "solution_request": {"mode": "respect_locks", "preference": "balanced"},
        "solver_config": {"engine": ENGINE_NAME, "max_time_seconds": time_limit},
    }
    meta = {
        "locked_blocks": len(fixed_assignments),
        "teachers_with_unavail": unavailable_teacher_count,
        "special_rooms": len(rooms),
    }
    return model, meta


def run_case(label: str, num_teachers: int, num_classes: int, time_limit: int = 45, make_infeasible: bool = False):
    t_load0 = time.perf_counter()
    model, meta = build_hard_school_model(
        num_classes, num_teachers, periods=7, time_limit=time_limit, make_infeasible=make_infeasible, with_hard_constraints=True
    )
    serialized = json.dumps(model)
    loaded = json.loads(serialized)
    load_ms = (time.perf_counter() - t_load0) * 1000.0

    tracemalloc.start()
    t0 = time.perf_counter()
    result = solve_timetable(loaded)
    solve_sec = time.perf_counter() - t0
    _, peak_py_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    cur_rss_mb, peak_rss_mb = get_process_memory_mb()

    verified = False
    locks_preserved = False
    if result.get("status") in ("OPTIMAL", "FEASIBLE"):
        val = validate_result(loaded, result)
        verified = bool(val.get("valid"))
        # Tum kilitlerin tam yerinde oldugunu ayrica teyit et
        pl_map = {(p["assignment_id"], p["block_index"]): p for p in result.get("placements", [])}
        locks_preserved = all(
            (fx["assignment_id"], fx["block_index"]) in pl_map
            and pl_map[(fx["assignment_id"], fx["block_index"])]["day_index"] == fx["day_index"]
            and pl_map[(fx["assignment_id"], fx["block_index"])]["start_period"] == fx["start_period"]
            for fx in loaded["fixed_assignments"]
        )

    return {
        "profile": label,
        "teachers": num_teachers,
        "classes": num_classes,
        "total_blocks": result.get("total_blocks", 0),
        "placed_blocks": result.get("placed_blocks", 0),
        "locked_blocks": meta["locked_blocks"],
        "locks_preserved": locks_preserved,
        "teachers_with_unavail": meta["teachers_with_unavail"],
        "special_rooms": meta["special_rooms"],
        "payload_kb": round(len(serialized.encode("utf-8")) / 1024.0, 1),
        "load_ms": round(load_ms, 2),
        "solve_sec": round(solve_sec, 3),
        "status": result.get("status"),
        "verified": verified,
        "peak_py_heap_mb": round(peak_py_bytes / (1024 * 1024), 2),
        "os_current_rss_mb": cur_rss_mb,
        "os_peak_rss_mb": peak_rss_mb,
    }


def main():
    cases = [
        ("Küçük Okul (10 Öğrt, 5 Şube + Kilit + Özel Derslik)", 10, 5, 20, False),
        ("Orta Okul (30 Öğrt, 15 Şube + Kilit + Özel Derslik)", 30, 15, 30, False),
        ("Büyük Okul (70 Öğrt, 30 Şube + Kilit + Özel Derslik)", 70, 30, 45, False),
        ("Çok Büyük Okul (120 Öğrt, 50 Şube + 20 Kilit + 30 Engelli Öğrt + 8 Özel Derslik)", 120, 50, 60, False),
        ("Çözülemez Senaryo (Kapalı Öğretmen)", 10, 5, 10, True),
        ("Zaman Sınırı Senaryosu (1 sn / 120 Öğrt)", 120, 50, 1, False),
    ]
    results = []
    for args in cases:
        rec = run_case(*args)
        results.append(rec)
        print(json.dumps(rec, ensure_ascii=False), flush=True)

    out_path = ROOT / "docs" / "perf_benchmark_results.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
