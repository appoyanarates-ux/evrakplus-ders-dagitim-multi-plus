"""
Bağımsız çözüm doğrulayıcı (validate_result.py).
OR-Tools CP-SAT tarafından üretilen her çözümün eksiksiz ve çakışmasız olduğunu
modelden bağımsız olarak yeniden denetler.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from validate_model import (
    build_time_intervals,
    crosses_break,
    extract_grid_sets,
    get_block_physical_span,
    get_teacher_unavailable_set,
    intervals_overlap,
    resolve_fixed_assignments,
)


def validate_result(config: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dönüş:
      {
        "valid": bool,
        "errors": [{"code": str, "message": str}],
        "stats": {...}
      }
    """
    errors: List[Dict[str, str]] = []

    if not isinstance(result, dict):
        return {"valid": False, "errors": [{"code": "INVALID_RESULT", "message": "Çözüm nesnesi geçersiz."}], "stats": {}}

    if result.get("engine") != "google_ortools_cp_sat":
        errors.append({
            "code": "INVALID_ENGINE",
            "message": f"Beklenen motor google_ortools_cp_sat, gelen: {result.get('engine')}",
        })

    placements = result.get("placements")
    if not isinstance(placements, list):
        errors.append({"code": "MISSING_PLACEMENTS", "message": "Çözümde yerleşim listesi yok."})
        return {"valid": False, "errors": errors, "stats": {}}

    time_grid = config.get("time_grid") or {}
    num_days, periods_per_day, blocked, common_elective, lunch_after, long_break_after = extract_grid_sets(time_grid)
    intervals = build_time_intervals(time_grid)

    classes = {c["id"]: c for c in (config.get("classes") or []) if "id" in c}
    teachers = {t["id"]: t for t in (config.get("teachers") or []) if "id" in t}
    rooms = {r["id"]: r for r in (config.get("rooms") or []) if "id" in r}
    assignments = config.get("assignments") or []
    assignments_by_id = {a["assignment_id"]: a for a in assignments if "assignment_id" in a}

    has_common_elective_courses = any(bool(a.get("use_common_elective_slot")) for a in assignments)
    enforce_common_exclusivity = bool(common_elective) and has_common_elective_courses

    teacher_unavail = {
        tid: get_teacher_unavailable_set(t, num_days, periods_per_day)
        for tid, t in teachers.items()
    }

    # 1. Beklenen tüm bloklar tam bir kez yerleşmiş mi?
    expected_blocks: Dict[Tuple[str, int], int] = {}
    for asgn in assignments:
        aid = asgn["assignment_id"]
        for b_idx, blen in enumerate(asgn.get("blocks") or []):
            expected_blocks[(aid, b_idx)] = int(blen)

    seen_blocks: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for pl in placements:
        aid = pl.get("assignment_id")
        b_idx = pl.get("block_index")
        if aid not in assignments_by_id or b_idx is None:
            errors.append({
                "code": "UNKNOWN_PLACEMENT_BLOCK",
                "message": f"Geçersiz yerleşim bloğu: assignment_id={aid}, block_index={b_idx}",
            })
            continue
        key = (aid, int(b_idx))
        if key not in expected_blocks:
            errors.append({
                "code": "UNEXPECTED_BLOCK",
                "message": f"Modelde olmayan blok yerleşmiş: {key}",
            })
            continue
        if key in seen_blocks:
            errors.append({
                "code": "DUPLICATE_BLOCK",
                "message": f"Aynı ders bloğu birden fazla kez yerleşmiş: {key}",
            })
            continue
        if int(pl.get("length", -1)) != expected_blocks[key]:
            errors.append({
                "code": "LENGTH_MISMATCH",
                "message": f"Blok uzunluğu değişmiş: {key} (beklenen {expected_blocks[key]}, gelen {pl.get('length')})",
            })
        seen_blocks[key] = pl

    missing = set(expected_blocks.keys()) - set(seen_blocks.keys())
    if missing:
        errors.append({
            "code": "MISSING_BLOCKS",
            "message": f"{len(missing)} ders bloğu yerleşmemiş.",
        })

    # 2. Tekil yerleşim kuralları + çakışma toplama
    class_day_spans: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    teacher_day_spans: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    teacher_day_periods: Dict[Tuple[str, int], List[int]] = defaultdict(list)
    teacher_weekly_hours: Dict[str, int] = defaultdict(int)
    room_day_spans: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    asgn_day_count: Dict[Tuple[str, int], int] = defaultdict(int)

    for pl in placements:
        aid = pl.get("assignment_id")
        if aid not in assignments_by_id:
            continue
        asgn = assignments_by_id[aid]
        cid = pl.get("class_id") or asgn["class_id"]
        cls = classes.get(cid, {})
        shift = cls.get("shift") or "full_day"
        d = int(pl.get("day_index", -1))
        p = int(pl.get("start_period", -1))
        blen = int(pl.get("length", 0))
        t_ids = list(pl.get("teacher_ids") or asgn.get("teacher_ids") or [])
        room_id = pl.get("room_id")

        if d < 0 or d >= num_days or p < 0 or blen <= 0 or p + blen > periods_per_day:
            errors.append({
                "code": "OUT_OF_BOUNDS",
                "message": f"Zaman sınırı ihlali: {asgn.get('class_name')} - {asgn.get('course_name')} (gün {d + 1}, {p + 1}. ders, {blen} sa).",
            })
            continue

        effective_lunch = lunch_after if shift == "full_day" else 0
        if crosses_break(p, blen, effective_lunch):
            errors.append({
                "code": "LUNCH_SPLIT",
                "message": f"Öğle arası bölünmüş: {asgn.get('class_name')} - {asgn.get('course_name')}.",
            })
        if crosses_break(p, blen, long_break_after):
            errors.append({
                "code": "LONG_BREAK_SPLIT",
                "message": f"Uzun ara bölünmüş: {asgn.get('class_name')} - {asgn.get('course_name')}.",
            })

        use_common = bool(asgn.get("use_common_elective_slot"))
        for k in range(blen):
            slot = (d, p + k)
            if slot in blocked:
                errors.append({
                    "code": "BLOCKED_SLOT_USED",
                    "message": f"Kapalı saat kullanılmış: {asgn.get('class_name')} - {asgn.get('course_name')} (gün {d + 1}, {p + k + 1}. ders).",
                })
                break
            if use_common and slot not in common_elective:
                errors.append({
                    "code": "COMMON_ELECTIVE_VIOLATION",
                    "message": f"Ortak seçmeli dersi ortak slot dışında: {asgn.get('class_name')} - {asgn.get('course_name')}.",
                })
                break
            if enforce_common_exclusivity and (not use_common) and (slot in common_elective):
                errors.append({
                    "code": "NON_ELECTIVE_IN_COMMON_SLOT",
                    "message": f"Ortak seçmeli slotuna farklı ders konmuş: {asgn.get('class_name')} - {asgn.get('course_name')}.",
                })
                break

        span = get_block_physical_span(intervals, shift, p, blen)
        class_day_spans[(cid, d)].append((span[0], span[1], pl))
        asgn_day_count[(aid, d)] += 1

        for tid in t_ids:
            unavail = teacher_unavail.get(tid, set())
            for k in range(blen):
                if (d, p + k) in unavail:
                    tname = teachers.get(tid, {}).get("name", tid)
                    errors.append({
                        "code": "TEACHER_UNAVAILABLE_VIOLATION",
                        "message": f"Öğretmen kapalı saatine ders konmuş: {tname} (gün {d + 1}, {p + k + 1}. ders).",
                    })
                    break
                teacher_day_periods[(tid, d)].append(p + k)
            teacher_day_spans[(tid, d)].append((span[0], span[1], pl))
            teacher_weekly_hours[tid] += blen

        if room_id:
            if room_id not in rooms:
                errors.append({
                    "code": "INVALID_ROOM_ASSIGNED",
                    "message": f"Tanımsız derslik atanmış: {room_id}",
                })
            else:
                room_day_spans[(room_id, d)].append((span[0], span[1], pl))

    # 3. Şube çakışma kontrolü (fiziksel zaman)
    for (cid, d), items in class_day_spans.items():
        items.sort(key=lambda x: x[0])
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if intervals_overlap((items[i][0], items[i][1]), (items[j][0], items[j][1])):
                    errors.append({
                        "code": "CLASS_OVERLAP",
                        "message": f"Şube çakışması: {classes.get(cid, {}).get('name', cid)} (gün {d + 1}) aynı saatte iki ders.",
                    })

    # 4. Öğretmen çakışma kontrolü (fiziksel zaman — ikili öğretim dahil)
    for (tid, d), items in teacher_day_spans.items():
        items.sort(key=lambda x: x[0])
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if intervals_overlap((items[i][0], items[i][1]), (items[j][0], items[j][1])):
                    tname = teachers.get(tid, {}).get("name", tid)
                    errors.append({
                        "code": "TEACHER_OVERLAP",
                        "message": f"Öğretmen çakışması: {tname} (gün {d + 1}) aynı fiziksel saatte iki sınıfta.",
                    })

    # 5. Öğretmen günlük, haftalık, ardışık, boş pencere ve çalışılabilir gün limitleri
    school_cfg = config.get("school") or {}
    travel_min = int(school_cfg.get("building_travel_minutes") or 0)

    def _get_building(pl_obj: Dict[str, Any]) -> Optional[str]:
        rid = pl_obj.get("room_id")
        if rid and rid in rooms and rooms[rid].get("building"):
            return str(rooms[rid]["building"]).strip()
        cid = pl_obj.get("class_id")
        if cid and cid in classes and classes[cid].get("building"):
            return str(classes[cid]["building"]).strip()
        return None

    for tid, t in teachers.items():
        max_w = int(t.get("max_weekly_hours") or 40)
        max_d = int(t.get("max_daily_hours") or periods_per_day)
        max_consec = int(t.get("max_consecutive_hours") or 0)
        max_gaps_day = int(t.get("max_daily_gaps") or 0)
        max_work_days = int(t.get("max_working_days") or 0)
        if teacher_weekly_hours.get(tid, 0) > max_w:
            errors.append({
                "code": "TEACHER_WEEKLY_MAX_VIOLATION",
                "message": f"Öğretmen haftalık sınır aşıldı: {t.get('name', tid)} ({teacher_weekly_hours[tid]}/{max_w} sa).",
            })
        active_days_count = 0
        for d in range(num_days):
            day_items = teacher_day_spans.get((tid, d), [])
            day_hrs = sum(pl["length"] for _, _, pl in day_items)
            if day_hrs > 0:
                active_days_count += 1
            if day_hrs > max_d:
                errors.append({
                    "code": "TEACHER_DAILY_MAX_VIOLATION",
                    "message": f"Öğretmen günlük sınır aşıldı: {t.get('name', tid)} gün {d + 1} ({day_hrs}/{max_d} sa).",
                })
            per_list = sorted(set(teacher_day_periods.get((tid, d), [])))
            if max_consec > 0 and per_list:
                run = 0
                prev = -2
                for pp in per_list:
                    run = run + 1 if pp == prev + 1 else 1
                    prev = pp
                    if run > max_consec:
                        errors.append({
                            "code": "TEACHER_MAX_CONSECUTIVE_VIOLATION",
                            "message": f"Öğretmen ardışık ders sınırı aşıldı: {t.get('name', tid)} gün {d + 1} ({run}/{max_consec}).",
                        })
                        break
            if max_gaps_day > 0 and len(per_list) >= 2:
                gaps = (per_list[-1] - per_list[0] + 1) - len(per_list)
                if gaps > max_gaps_day:
                    errors.append({
                        "code": "TEACHER_DAILY_GAP_VIOLATION",
                        "message": f"Öğretmen günlük boş ders sınırı aşıldı: {t.get('name', tid)} gün {d + 1} ({gaps}/{max_gaps_day}).",
                    })
            if travel_min > 0 and len(day_items) >= 2:
                ordered = sorted(day_items, key=lambda x: x[0])
                for idx_i in range(len(ordered) - 1):
                    s1, e1, pl1 = ordered[idx_i]
                    s2, _e2, pl2 = ordered[idx_i + 1]
                    b1 = _get_building(pl1)
                    b2 = _get_building(pl2)
                    if b1 and b2 and b1 != b2 and (s2 - e1) < travel_min:
                        errors.append({
                            "code": "BUILDING_TRAVEL_VIOLATION",
                            "message": (
                                f"Bina geçiş süresi ihlali: {t.get('name', tid)} gün {d + 1} "
                                f"({b1} -> {b2}, ara {s2 - e1} dk < {travel_min} dk)."
                            ),
                        })
        if max_work_days > 0 and active_days_count > max_work_days:
            errors.append({
                "code": "TEACHER_WORKING_DAYS_VIOLATION",
                "message": f"Öğretmen haftalık çalışılabilir gün sınırı aşıldı: {t.get('name', tid)} ({active_days_count}/{max_work_days} gün).",
            })

    # 6. Özel derslik kapasite kontrolü (sweep-line)
    for (rid, d), items in room_day_spans.items():
        cap = int(rooms[rid].get("simultaneous_capacity") or 1)
        events: List[Tuple[int, int]] = []
        for s, e, _ in items:
            events.append((s, 1))
            events.append((e, -1))
        events.sort(key=lambda x: (x[0], x[1]))  # bitiş (-1) başlangıç (+1) öncesi
        active = 0
        for _, delta in events:
            active += delta
            if active > cap:
                errors.append({
                    "code": "ROOM_CAPACITY_VIOLATION",
                    "message": f"Derslik kapasitesi aşıldı: {rooms[rid].get('name', rid)} gün {d + 1} (eşzamanlı {active}/{cap}).",
                })
                break

    # 7. Aynı gün maksimum blok sayısı
    for (aid, d), cnt in asgn_day_count.items():
        max_d = int(assignments_by_id[aid].get("max_blocks_per_day") or 1)
        if max_d > 0 and cnt > max_d:
            asgn = assignments_by_id[aid]
            errors.append({
                "code": "MAX_BLOCKS_PER_DAY_VIOLATION",
                "message": f"Aynı gün blok sınırı aşıldı: {asgn.get('class_name')} - {asgn.get('course_name')} gün {d + 1} ({cnt}/{max_d}).",
            })

    # 8. Kilitli / sabit atama koruma kontrolü
    resolved_fixed, _ = resolve_fixed_assignments(config.get("fixed_assignments") or [], assignments_by_id)
    for key, fa in resolved_fixed.items():
        pl = seen_blocks.get(key)
        if not pl:
            errors.append({
                "code": "FIXED_BLOCK_MISSING",
                "message": f"Kilitli ders yerleşmemiş: {key}",
            })
            continue
        if int(pl["day_index"]) != fa["day_index"] or int(pl["start_period"]) != fa["start_period"]:
            asgn = assignments_by_id[key[0]]
            errors.append({
                "code": "FIXED_BLOCK_MOVED",
                "message": f"Kilitli ders yeri değişmiş: {asgn.get('class_name')} - {asgn.get('course_name')} (blok {key[1] + 1}).",
            })
        if fa.get("room_id") and pl.get("room_id") != fa.get("room_id"):
            asgn = assignments_by_id[key[0]]
            errors.append({
                "code": "FIXED_ROOM_CHANGED",
                "message": f"Kilitli dersin dersliği değişmiş: {asgn.get('class_name')} - {asgn.get('course_name')}.",
            })

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "stats": {
            "expected_blocks": len(expected_blocks),
            "placed_blocks": len(placements),
            "error_count": len(errors),
        },
    }
