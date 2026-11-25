"""
Ön denetim ve zaman/kapasite/çelişki doğrulaması (validate_model.py).
Google OR-Tools CP-SAT modelini kurmadan önce tüm veri tutarlılığını,
fiziksel zaman aralıklarını, kapasiteleri ve sabit atamaları denetler.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple


def parse_hhmm(value: str, default_min: int = 510) -> int:
    if not value or not isinstance(value, str):
        return default_min
    parts = value.strip().split(":")
    if len(parts) != 2:
        return default_min
    try:
        h = int(parts[0])
        m = int(parts[1])
        return h * 60 + m
    except ValueError:
        return default_min


def build_time_intervals(time_grid: Dict[str, Any]) -> Dict[str, List[Tuple[int, int]]]:
    """
    Her devre ('full_day', 'morning', 'afternoon') için 0-tabanlı periyotların
    fiziksel [başlangıç_dk, bitiş_dk) aralıklarını döndürür.
    """
    periods = int(time_grid.get("periods_per_day") or 0)
    bell = time_grid.get("bell_schedule")

    def _from_list(entries: List[Dict[str, Any]]) -> List[Tuple[int, int]]:
        intervals: List[Tuple[int, int]] = []
        for idx in range(periods):
            if idx < len(entries) and isinstance(entries[idx], dict):
                s = parse_hhmm(entries[idx].get("start"), 510 + idx * 50)
                e = parse_hhmm(entries[idx].get("end"), s + 40)
                if e <= s:
                    e = s + 40
                intervals.append((s, e))
            else:
                s = 510 + idx * 50
                intervals.append((s, s + 40))
        return intervals

    if isinstance(bell, dict):
        morning = _from_list(bell.get("morning") or [])
        afternoon = _from_list(bell.get("afternoon") or [])
        return {
            "morning": morning,
            "afternoon": afternoon,
            "full_day": morning,
        }
    elif isinstance(bell, list):
        full = _from_list(bell)
        return {
            "full_day": full,
            "morning": full,
            "afternoon": full,
        }
    else:
        default_iv = [(510 + i * 50, 550 + i * 50) for i in range(periods)]
        return {"full_day": default_iv, "morning": default_iv, "afternoon": default_iv}


def intervals_overlap(a: Tuple[int, int], b: Tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def get_block_physical_span(
    intervals: Dict[str, List[Tuple[int, int]]],
    shift: str,
    start_period: int,
    length: int,
) -> Tuple[int, int]:
    arr = intervals.get(shift) or intervals.get("full_day") or []
    if not arr or start_period < 0 or start_period + length > len(arr):
        return (start_period * 50, (start_period + length) * 50)
    return (arr[start_period][0], arr[start_period + length - 1][1])


def get_period_physical_span(
    intervals: Dict[str, List[Tuple[int, int]]],
    shift: str,
    period: int,
) -> Tuple[int, int]:
    arr = intervals.get(shift) or intervals.get("full_day") or []
    if not arr or period < 0 or period >= len(arr):
        return (period * 50, period * 50 + 40)
    return arr[period]


def extract_grid_sets(time_grid: Dict[str, Any]) -> Tuple[int, int, Set[Tuple[int, int]], Set[Tuple[int, int]], int, int]:
    num_days = int(time_grid.get("num_days") or 0)
    periods_per_day = int(time_grid.get("periods_per_day") or 0)

    blocked: Set[Tuple[int, int]] = set()
    for item in time_grid.get("blocked_slots") or []:
        d = int(item.get("day_index", -1))
        p = int(item.get("period", 0)) - 1  # JSON'da 1-tabanlı
        if 0 <= d < num_days and 0 <= p < periods_per_day:
            blocked.add((d, p))

    common_elective: Set[Tuple[int, int]] = set()
    for item in time_grid.get("common_elective_slots") or []:
        d = int(item.get("day_index", -1))
        p = int(item.get("period", 0)) - 1
        if 0 <= d < num_days and 0 <= p < periods_per_day and (d, p) not in blocked:
            common_elective.add((d, p))

    lunch_break = time_grid.get("lunch_break") or {}
    lunch_after = int(lunch_break.get("after_period") or 0)

    long_break = time_grid.get("long_break") or {}
    long_break_after = int(long_break.get("after_period") or 0) if long_break.get("prevent_block_split") else 0

    return num_days, periods_per_day, blocked, common_elective, lunch_after, long_break_after


def get_teacher_unavailable_set(teacher: Dict[str, Any], num_days: int, periods_per_day: int) -> Set[Tuple[int, int]]:
    unavail: Set[Tuple[int, int]] = set()
    for item in teacher.get("unavailable_slots") or []:
        d = int(item.get("day_index", -1))
        p = int(item.get("period", 0)) - 1
        if 0 <= d < num_days and 0 <= p < periods_per_day:
            unavail.add((d, p))
    return unavail


def get_teacher_prefer_avoid_set(teacher: Dict[str, Any], num_days: int, periods_per_day: int) -> Set[Tuple[int, int]]:
    avoid: Set[Tuple[int, int]] = set()
    for item in teacher.get("prefer_avoid_slots") or []:
        d = int(item.get("day_index", -1))
        p = int(item.get("period", 0)) - 1
        if 0 <= d < num_days and 0 <= p < periods_per_day:
            avoid.add((d, p))
    return avoid


def crosses_break(start_period: int, length: int, break_after_period: int) -> bool:
    """
    break_after_period 1-tabanlıdır (ör. 4 ise 4. dersten sonra ara var,
    yani 0-tabanlı periyot 3 ile 4 arasından blok geçemez).
    """
    if break_after_period <= 0 or length <= 1:
        return False
    return start_period < break_after_period < (start_period + length)


def compute_valid_starts_for_block(
    *,
    length: int,
    num_days: int,
    periods_per_day: int,
    blocked: Set[Tuple[int, int]],
    common_elective: Set[Tuple[int, int]],
    use_common_elective: bool,
    enforce_common_elective_exclusivity: bool,
    lunch_after: int,
    long_break_after: int,
    class_shift: str,
    teacher_unavail_sets: List[Set[Tuple[int, int]]],
) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]]]:
    """
    İki liste döndürür:
      - school_valid: yalnızca okul zaman çizelgesine göre geçerli başlangıçlar
      - full_valid: öğretmen müsaitlikleri de eklendikten sonra geçerli başlangıçlar
    """
    school_valid: List[Tuple[int, int]] = []
    full_valid: List[Tuple[int, int]] = []
    effective_lunch = lunch_after if class_shift == "full_day" else 0

    for d in range(num_days):
        for p in range(periods_per_day - length + 1):
            if crosses_break(p, length, effective_lunch):
                continue
            if crosses_break(p, length, long_break_after):
                continue

            ok_school = True
            for k in range(length):
                slot = (d, p + k)
                if slot in blocked:
                    ok_school = False
                    break
                if use_common_elective and slot not in common_elective:
                    ok_school = False
                    break
                if enforce_common_elective_exclusivity and (not use_common_elective) and (slot in common_elective):
                    ok_school = False
                    break

            if not ok_school:
                continue
            school_valid.append((d, p))

            ok_teacher = True
            for t_unavail in teacher_unavail_sets:
                for k in range(length):
                    if (d, p + k) in t_unavail:
                        ok_teacher = False
                        break
                if not ok_teacher:
                    break
            if ok_teacher:
                full_valid.append((d, p))

    return school_valid, full_valid


def resolve_fixed_assignments(
    fixed_assignments: List[Dict[str, Any]],
    assignments_by_id: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[Tuple[str, int], Dict[str, Any]], List[Dict[str, str]]]:
    """
    Sabit atamaları (assignment_id, block_index) anahtarına eşler.
    Eski kayıtlarda block_index yoksa aynı assignment_id ve uzunluktaki ilk boş bloğa eşler.
    """
    resolved: Dict[Tuple[str, int], Dict[str, Any]] = {}
    errors: List[Dict[str, str]] = []

    for fa in fixed_assignments or []:
        aid = fa.get("assignment_id")
        if not aid or aid not in assignments_by_id:
            continue
        asgn = assignments_by_id[aid]
        blocks = asgn.get("blocks") or []

        b_idx = fa.get("block_index")
        if b_idx is not None:
            try:
                b_idx = int(b_idx)
            except (TypeError, ValueError):
                b_idx = None

        if b_idx is not None and 0 <= b_idx < len(blocks):
            key = (aid, b_idx)
            if key in resolved:
                cid = asgn.get("class_id")
                cname = asgn.get("class_name") or cid or "Şube"
                errors.append({
                    "code": "DUPLICATE_FIXED_BLOCK",
                    "category": "Sabit / Kilitli Ders",
                    "message": f"Sabit dersler çakışıyor: {cname} - {asgn.get('course_name')} (blok {b_idx + 1}) birden fazla kez sabitlenmiş.",
                    "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                    "linkLabel": f"{cname} Sabit Dersine Git →",
                })
                continue
            resolved[key] = {
                "assignment_id": aid,
                "block_index": b_idx,
                "day_index": int(fa.get("day_index", -1)),
                "start_period": int(fa.get("start_period", -1)),
                "length": int(fa.get("length", blocks[b_idx])),
                "room_id": fa.get("room_id"),
            }
        else:
            # Geriye dönük uyumluluk: block_index olmayan sabit kayıtları uzunlukla eşle
            req_len = int(fa.get("length") or 0)
            matched_idx = None
            for idx, blen in enumerate(blocks):
                if (aid, idx) not in resolved and (req_len == 0 or int(blen) == req_len):
                    matched_idx = idx
                    break
            if matched_idx is not None:
                resolved[(aid, matched_idx)] = {
                    "assignment_id": aid,
                    "block_index": matched_idx,
                    "day_index": int(fa.get("day_index", -1)),
                    "start_period": int(fa.get("start_period", -1)),
                    "length": int(blocks[matched_idx]),
                    "room_id": fa.get("room_id"),
                }

    return resolved, errors


def validate_model(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tüm modeli çözüm öncesinde denetler.
    Dönüş:
      {
        "valid": bool,
        "errors": [{"code": str, "message": str, ...}],
        "warnings": [{"code": str, "message": str}],
        "summary": {...}
      }
    """
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    if not isinstance(config, dict):
        return {
            "valid": False,
            "errors": [{"code": "INVALID_PAYLOAD", "category": "Model Verisi", "message": "Model verisi geçerli bir JSON nesnesi değil."}],
            "warnings": [],
            "summary": {},
        }

    time_grid = config.get("time_grid") or {}
    num_days, periods_per_day, blocked, common_elective, lunch_after, long_break_after = extract_grid_sets(time_grid)
    intervals = build_time_intervals(time_grid)

    if num_days <= 0 or periods_per_day <= 0:
        errors.append({
            "code": "INVALID_TIME_GRID",
            "category": "Zaman Çizelgesi",
            "message": "Haftalık zaman çizelgesinde en az 1 açık gün ve 1 ders saati olmalıdır.",
            "nav": {"view": "menu1"},
            "linkLabel": "Zaman Çizelgesine Git →",
        })
        return {"valid": False, "errors": errors, "warnings": warnings, "summary": {}}

    classes = config.get("classes") or []
    teachers = config.get("teachers") or []
    rooms = config.get("rooms") or []
    assignments = config.get("assignments") or []

    if not classes:
        errors.append({
            "code": "NO_CLASSES",
            "category": "Sınıf / Şube",
            "message": "Önce en az bir sınıf/şube tanımlayın.",
            "nav": {"view": "menu2"},
            "linkLabel": "Şube Ekle →",
        })
    if not teachers:
        errors.append({
            "code": "NO_TEACHERS",
            "category": "Öğretmen",
            "message": "Önce en az bir öğretmen tanımlayın.",
            "nav": {"view": "menu3"},
            "linkLabel": "Öğretmen Ekle →",
        })
    if not assignments:
        errors.append({
            "code": "NO_ASSIGNMENTS",
            "category": "Ders Atama",
            "message": "Dağıtılacak ders ataması bulunmuyor.",
            "nav": {"view": "menu2"},
            "linkLabel": "Derslere Git →",
        })

    if errors:
        return {"valid": False, "errors": errors, "warnings": warnings, "summary": {}}

    class_map = {c["id"]: c for c in classes if "id" in c}
    teacher_map = {t["id"]: t for t in teachers if "id" in t}
    room_map = {r["id"]: r for r in rooms if "id" in r}
    rooms_by_type: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rooms:
        rooms_by_type[r.get("room_type") or "standard"].append(r)

    open_slots_per_week = num_days * periods_per_day - len(blocked)
    has_common_elective_courses = any(bool(a.get("use_common_elective_slot")) for a in assignments)
    enforce_common_exclusivity = bool(common_elective) and has_common_elective_courses

    teacher_unavail_map = {
        tid: get_teacher_unavailable_set(t, num_days, periods_per_day)
        for tid, t in teacher_map.items()
    }

    class_hours: Dict[str, int] = defaultdict(int)
    teacher_hours: Dict[str, int] = defaultdict(int)
    room_hours: Dict[str, int] = defaultdict(int)
    room_type_hours: Dict[str, int] = defaultdict(int)
    assignments_by_id: Dict[str, Dict[str, Any]] = {}
    seen_class_course_names: Dict[Tuple[str, str], str] = {}
    seen_class_course_codes: Dict[Tuple[str, str], str] = {}
    total_blocks = 0

    for asgn in assignments:
        aid = asgn.get("assignment_id")
        cid = asgn.get("class_id")
        cname = asgn.get("class_name") or cid or "Bilinmeyen Şube"
        course_name = asgn.get("course_name") or asgn.get("course_code") or "Bilinmeyen Ders"
        course_code = str(asgn.get("course_code") or "").strip().upper()
        norm_cname = " ".join(
            str(course_name).replace("İ", "i").replace("I", "ı").strip().lower().split()
        )
        hours = int(asgn.get("hours") or 0)
        blocks = [int(b) for b in (asgn.get("blocks") or []) if int(b) > 0]
        t_ids = [tid for tid in (asgn.get("teacher_ids") or []) if tid]
        room_id = asgn.get("room_id")
        room_type = asgn.get("room_type") or "standard"
        use_common = bool(asgn.get("use_common_elective_slot"))

        if not aid:
            errors.append({
                "code": "MISSING_ASSIGNMENT_ID",
                "category": "Ders Atama",
                "message": f"{cname} - {course_name} atamasında kimlik eksik.",
                "nav": {"view": "menu4", "classId": cid},
                "linkLabel": f"{cname} Dersine Git →",
            })
            continue
        assignments_by_id[aid] = asgn

        if cid not in class_map:
            errors.append({
                "code": "UNKNOWN_CLASS",
                "category": "Sınıf / Şube",
                "message": f"{cname} şubesi tanımlı sınıflar arasında bulunamadı.",
                "nav": {"view": "menu2"},
                "linkLabel": "Şubelere Git →",
            })
            continue

        dup_found = False
        if course_code:
            code_key = (cid, course_code)
            if code_key in seen_class_course_codes:
                dup_found = True
            else:
                seen_class_course_codes[code_key] = course_name
        if norm_cname:
            name_key = (cid, norm_cname)
            if name_key in seen_class_course_names:
                dup_found = True
            else:
                seen_class_course_names[name_key] = course_name
        if dup_found:
            errors.append({
                "code": "DUPLICATE_COURSE_IN_CLASS",
                "category": "Mükerrer Ders",
                "message": f"{cname} şubesinde '{course_name}' dersi birden fazla kez tanımlanmış. Bir sınıfa aynı ders yalnızca bir kez verilebilir.",
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Derslerini Düzelt →",
            })

        if not blocks or sum(blocks) != hours:
            errors.append({
                "code": "BLOCK_SUM_MISMATCH",
                "category": "Blok Yapısı",
                "message": f"Blok toplamı saatle uyuşmuyor: {cname} - {course_name} ({hours} sa, bloklar: {blocks}).",
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Bloklarını Düzelt →",
            })
            continue

        if not t_ids:
            errors.append({
                "code": "NO_TEACHER",
                "category": "Öğretmen Ataması",
                "message": f"Öğretmen yok: {cname} - {course_name} dersi için Menü 4'ten öğretmen atayın.",
                "nav": {"view": "menu4", "classId": cid, "search": course_name},
                "linkLabel": f"{cname} Ders Atamasına Git →",
            })
            continue

        missing_teachers = [tid for tid in t_ids if tid not in teacher_map]
        if missing_teachers:
            errors.append({
                "code": "UNKNOWN_TEACHER",
                "category": "Öğretmen Ataması",
                "message": f"Tanımsız öğretmen: {cname} - {course_name} dersine atanmış öğretmen listede bulunamadı.",
                "nav": {"view": "menu4", "classId": cid, "search": course_name},
                "linkLabel": f"{cname} Ders Atamasına Git →",
            })
            continue

        if room_id and room_id not in room_map:
            errors.append({
                "code": "UNKNOWN_ROOM",
                "category": "Özel Mekan",
                "message": f"Derslik bulunamıyor: {cname} - {course_name} için seçilen özel mekan listede yok.",
                "nav": {"view": "menu4", "classId": cid, "search": course_name},
                "linkLabel": f"{cname} Mekan Seçimine Git →",
            })
            continue

        class_hours[cid] += hours
        for tid in set(t_ids):
            teacher_hours[tid] += hours
        if room_id:
            room_hours[room_id] += hours
        elif room_type != "standard" and rooms_by_type.get(room_type):
            room_type_hours[room_type] += hours

        cls_shift = class_map[cid].get("shift") or "full_day"
        t_unavails = [teacher_unavail_map[tid] for tid in t_ids]

        for b_idx, blen in enumerate(blocks):
            total_blocks += 1
            school_valid, full_valid = compute_valid_starts_for_block(
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
            if not school_valid:
                if use_common:
                    errors.append({
                        "code": "COMMON_ELECTIVE_INSUFFICIENT",
                        "category": "Ortak Seçmeli",
                        "message": f"Ortak seçmeli alanı yetersiz: {cname} - {course_name} ({blen} saatlik blok) için uygun ortak seçmeli slotu yok.",
                        "nav": {"view": "menu1"},
                        "linkLabel": "Ortak Seçmeli Saatlerine Git →",
                        "links": [{"nav": {"view": "menu2", "classId": cid}, "label": f"{cname} Derslerine Git →"}],
                    })
                else:
                    errors.append({
                        "code": "BLOCK_DOES_NOT_FIT",
                        "category": "Blok / Zaman Çizelgesi",
                        "message": f"Blok uzunluğu sığmıyor: {cname} - {course_name} ({blen} saatlik blok) kapalı saatler veya öğle arası nedeniyle yerleşemiyor.",
                        "nav": {"view": "menu2", "classId": cid},
                        "linkLabel": f"{cname} Bloklarını Düzelt →",
                        "links": [{"nav": {"view": "menu1"}, "label": "Zaman Çizelgesine Git →"}],
                    })
            elif not full_valid:
                t_names = ", ".join(teacher_map[tid].get("name", tid) for tid in t_ids)
                first_tid = t_ids[0]
                first_tname = teacher_map[first_tid].get("name", first_tid)
                errors.append({
                    "code": "TEACHER_UNAVAILABLE",
                    "category": "Öğretmen Kapalı Saatleri",
                    "message": (
                        f"{cname} {course_name} dersi için {blen} saatlik blok yerleştirilemiyor. "
                        f"Atanan öğretmen ({t_names}) için uygun zamanlarda {blen} ardışık açık ders saati bulunmuyor."
                    ),
                    "nav": {"view": "menu3", "teacherId": first_tid},
                    "linkLabel": f"{first_tname} Kapalı Saatlerine Git →",
                    "links": [{"nav": {"view": "menu2", "classId": cid}, "label": f"{cname} Bloklarına Git →"}],
                })

        # Aynı gün maksimum blok sayısı ve gün sayısı kontrolü
        max_per_day = int(asgn.get("max_blocks_per_day") or 1)
        if max_per_day > 0 and len(blocks) > num_days * max_per_day:
            errors.append({
                "code": "MAX_BLOCKS_PER_DAY_EXCEEDED",
                "category": "Günlük Blok Sınırı",
                "message": f"Blok sayısı sığmıyor: {cname} - {course_name} ({len(blocks)} blok), günlük maks {max_per_day} blok sınırı ile {num_days} güne yerleşemez.",
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Ders Bloklarına Git →",
            })

    # Şube kapasite denetimi
    for cid, hrs in class_hours.items():
        cls = class_map[cid]
        cname = cls.get("name", cid)
        if hrs > open_slots_per_week:
            errors.append({
                "code": "CLASS_OVER_CAPACITY",
                "category": "Şube Ders Kapasitesi",
                "message": f"Şube açık saati yetersiz: {cname} için {hrs} saat ders var ancak haftada {open_slots_per_week} açık saat mevcut.",
                "nav": {"view": "menu2", "classId": cid},
                "linkLabel": f"{cname} Derslerine Git →",
                "links": [{"nav": {"view": "menu1"}, "label": "Zaman Çizelgesine Git →"}],
            })

    # Öğretmen yük ve müsaitlik denetimi
    for tid, hrs in teacher_hours.items():
        t = teacher_map[tid]
        tname = t.get("name", tid)
        max_w = int(t.get("max_weekly_hours") or 40)
        max_d = int(t.get("max_daily_hours") or periods_per_day)
        unavail = teacher_unavail_map[tid]

        if hrs > max_w:
            errors.append({
                "code": "TEACHER_OVER_WEEKLY_MAX",
                "category": "Öğretmen Haftalık Sınırı",
                "message": f"Öğretmen haftalık sınırı aşılıyor: {tname} için {hrs} saat ders atanmış, haftalık maksimum {max_w} saat.",
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Ayarlarına Git →",
                "links": [{"nav": {"view": "menu4"}, "label": "Ders Dağılımına Git →"}],
            })

        avail_total = 0
        day_caps: List[int] = []
        for d in range(num_days):
            day_open = sum(
                1 for p in range(periods_per_day)
                if (d, p) not in blocked and (d, p) not in unavail
            )
            avail_total += day_open
            day_caps.append(min(day_open, max_d))

        max_work_days = int(t.get("max_working_days") or 0)
        if 0 < max_work_days < num_days:
            top_days_cap = sum(sorted(day_caps, reverse=True)[:max_work_days])
            if hrs > top_days_cap:
                errors.append({
                    "code": "TEACHER_MAX_WORKING_DAYS_CAPACITY",
                    "category": "Öğretmen Çalışma Günü",
                    "message": (
                        f"Öğretmen çalışılabilir gün sınırı yetersiz: {tname} ({hrs} sa) haftada en fazla "
                        f"{max_work_days} gün sınırı ile sığmıyor (maks {top_days_cap} sa)."
                    ),
                    "nav": {"view": "menu3", "teacherId": tid},
                    "linkLabel": f"{tname} Gün Sınırına Git →",
                })

        max_daily_cap_sum = sum(day_caps)
        if hrs > avail_total:
            errors.append({
                "code": "TEACHER_UNAVAILABLE_CAPACITY",
                "category": "Öğretmen Kapalı Saatleri",
                "message": f"Öğretmen kapalı saatleri: {tname} için {hrs} saat ders atanmış ancak sadece {avail_total} müsait saati var.",
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Kapalı Saatlerine Git →",
            })
        elif hrs > max_daily_cap_sum:
            errors.append({
                "code": "TEACHER_DAILY_MAX_CAPACITY",
                "category": "Öğretmen Günlük Sınırı",
                "message": f"Öğretmen günlük ders sınırı yetersiz: {tname} ({hrs} sa) günlük en fazla {max_d} saat sınırı ile müsait günlere sığmıyor (maks {max_daily_cap_sum} sa).",
                "nav": {"view": "menu3", "teacherId": tid},
                "linkLabel": f"{tname} Günlük Sınırına Git →",
            })

    # Özel derslik kapasite denetimi
    for rid, hrs in room_hours.items():
        rm = room_map[rid]
        rname = rm.get("name", rid)
        cap = int(rm.get("simultaneous_capacity") or 1)
        max_cap = open_slots_per_week * cap
        if hrs > max_cap:
            errors.append({
                "code": "ROOM_OVER_CAPACITY",
                "category": "Özel Mekan Kapasitesi",
                "message": f"Derslik bulunamıyor: {rname} mekanına {hrs} saat ders atanmış, haftalık kapasite {max_cap} saat.",
                "nav": {"view": "menu4", "focus": "rooms"},
                "linkLabel": f"{rname} Mekan Ayarlarına Git →",
            })

    for rtype, hrs in room_type_hours.items():
        pool = rooms_by_type.get(rtype) or []
        total_cap = sum(int(r.get("simultaneous_capacity") or 1) for r in pool) * open_slots_per_week
        if hrs > total_cap:
            errors.append({
                "code": "ROOM_TYPE_OVER_CAPACITY",
                "category": "Özel Mekan Kapasitesi",
                "message": f"Derslik bulunamıyor: '{rtype}' türündeki dersler için {hrs} saat gerekiyor ancak mevcut mekan kapasitesi {total_cap} saat.",
                "nav": {"view": "menu4", "focus": "rooms"},
                "linkLabel": "Özel Mekanlara Git →",
            })

    # Sabit / kilitli atama denetimi
    resolved_fixed, fixed_errs = resolve_fixed_assignments(config.get("fixed_assignments") or [], assignments_by_id)
    errors.extend(fixed_errs)

    # Sabit atamaların kendi içinde geçerlilik ve çakışma kontrolü
    fixed_list = list(resolved_fixed.values())
    for i, fa in enumerate(fixed_list):
        aid = fa["assignment_id"]
        asgn = assignments_by_id[aid]
        cid = asgn["class_id"]
        cls = class_map[cid]
        cls_shift = cls.get("shift") or "full_day"
        d = fa["day_index"]
        p = fa["start_period"]
        blen = fa["length"]
        cname = asgn.get("class_name", cid)
        course_name = asgn.get("course_name", aid)

        if d < 0 or d >= num_days or p < 0 or p + blen > periods_per_day:
            errors.append({
                "code": "FIXED_OUT_OF_BOUNDS",
                "category": "Sabit / Kilitli Ders",
                "message": f"Sabit ders sınır dışında: {cname} - {course_name} (gün {d + 1}, {p + 1}. ders).",
                "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                "linkLabel": f"{cname} Sabit Dersine Git →",
            })
            continue

        effective_lunch = lunch_after if cls_shift == "full_day" else 0
        if crosses_break(p, blen, effective_lunch) or crosses_break(p, blen, long_break_after):
            errors.append({
                "code": "FIXED_CROSSES_BREAK",
                "category": "Sabit / Kilitli Ders",
                "message": f"Sabit ders öğle/uzun arayı bölüyor: {cname} - {course_name}.",
                "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                "linkLabel": f"{cname} Sabit Dersine Git →",
            })

        for k in range(blen):
            if (d, p + k) in blocked:
                errors.append({
                    "code": "FIXED_IN_BLOCKED_SLOT",
                    "category": "Sabit / Kilitli Ders",
                    "message": f"Sabit ders kapalı saatte: {cname} - {course_name} okulun kapalı saatine sabitlenmiş.",
                    "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                    "linkLabel": f"{cname} Sabit Dersine Git →",
                    "links": [{"nav": {"view": "menu1"}, "label": "Zaman Çizelgesine Git →"}],
                })
                break

        for tid in asgn.get("teacher_ids") or []:
            unavail = teacher_unavail_map.get(tid, set())
            if any((d, p + k) in unavail for k in range(blen)):
                tname = teacher_map.get(tid, {}).get("name", tid)
                errors.append({
                    "code": "FIXED_TEACHER_UNAVAILABLE",
                    "category": "Sabit Ders Çakışması",
                    "message": f"Sabit ders çelişkisi: {cname} - {course_name} sabitli ama {tname} o saatte kapalı.",
                    "nav": {"view": "menu3", "teacherId": tid},
                    "linkLabel": f"{tname} Kapalı Saatlerine Git →",
                    "links": [{"nav": {"view": "menu6", "tab": "class", "entityId": cid}, "label": f"{cname} Kilidini Aç →"}],
                })

        span_i = get_block_physical_span(intervals, cls_shift, p, blen)
        for j in range(i + 1, len(fixed_list)):
            fb = fixed_list[j]
            if fb["day_index"] != d:
                continue
            asgn_b = assignments_by_id[fb["assignment_id"]]
            cls_b = class_map[asgn_b["class_id"]]
            shift_b = cls_b.get("shift") or "full_day"
            span_j = get_block_physical_span(intervals, shift_b, fb["start_period"], fb["length"])
            if not intervals_overlap(span_i, span_j):
                continue

            if asgn["class_id"] == asgn_b["class_id"]:
                # Aynı şubede eşzamanlı alt grup değilse çakışma
                errors.append({
                    "code": "FIXED_CLASS_CONFLICT",
                    "category": "Sabit Ders Çakışması",
                    "message": f"Sabit dersler çakışıyor: {cname} şubesinde {course_name} ile {asgn_b.get('course_name')} aynı saatte sabitlenmiş.",
                    "nav": {"view": "menu6", "tab": "class", "entityId": cid},
                    "linkLabel": f"{cname} Sabit Derslerine Git →",
                })

            shared_teachers = set(asgn.get("teacher_ids") or []) & set(asgn_b.get("teacher_ids") or [])
            for tid in shared_teachers:
                tname = teacher_map.get(tid, {}).get("name", tid)
                errors.append({
                    "code": "FIXED_TEACHER_CONFLICT",
                    "category": "Sabit Ders Çakışması",
                    "message": f"Sabit dersler çakışıyor: {tname} aynı saatte hem {cname} hem {asgn_b.get('class_name')} dersine sabitlenmiş.",
                    "nav": {"view": "menu6", "tab": "teacher", "entityId": tid},
                    "linkLabel": f"{tname} Programına Git →",
                    "links": [{"nav": {"view": "menu6", "tab": "class", "entityId": cid}, "label": f"{cname} Kilidini Aç →"}],
                })

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "num_days": num_days,
            "periods_per_day": periods_per_day,
            "open_slots_per_week": open_slots_per_week,
            "total_classes": len(classes),
            "total_teachers": len(teachers),
            "total_rooms": len(rooms),
            "total_assignments": len(assignments),
            "total_blocks": total_blocks,
            "fixed_blocks": len(resolved_fixed),
        },
    }
