"""
Ortak Kalite Puanlama Sistemi (quality_scorer.py).
Bütün optimizasyon motorlarının (OR-Tools, Timefold, Choco, MiniZinc, SCIP, HiGHS)
sonuçlarını aynı kriterler üzerinden 100 puanlık ortak ölçekte değerlendirir.

Öncelik sırası:
  1. Zorunlu kural ihlalinin olmaması (geçersiz çizelge asla geçerli çizelgeyi geçemez)
  2. Bütün gerekli derslerin atanması
  3. Öğretmen boşluklarının azaltılması
  4. Sınıf boşluklarının azaltılması
  5. Öğretmen tercihlerinin karşılanması
  6. Derslerin günlere dengeli dağıtılması
  7. Bina değişimlerinin azaltılması
  8. Blok ders tercihlerinin karşılanması
  9. Diğer esnek kuralların iyileştirilmesi
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from validate_model import (
    build_time_intervals,
    extract_grid_sets,
    get_block_physical_span,
    get_teacher_prefer_avoid_set,
)


def score_schedule(
    config: Dict[str, Any],
    result: Dict[str, Any],
    validation: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Bağımsız ve motor-agnostik 0..100 kalite puanı ve ayrıntılı metrik dökümü üretir.
    """
    placements = result.get("placements") or []
    time_grid = config.get("time_grid") or {}
    num_days, periods_per_day, _blocked, _ce, _la, _lba = extract_grid_sets(time_grid)
    intervals = build_time_intervals(time_grid)

    classes = {c["id"]: c for c in (config.get("classes") or []) if "id" in c}
    teachers = {t["id"]: t for t in (config.get("teachers") or []) if "id" in t}
    rooms = {r["id"]: r for r in (config.get("rooms") or []) if "id" in r}
    assignments = config.get("assignments") or []
    assignments_by_id = {a["assignment_id"]: a for a in assignments if "assignment_id" in a}

    total_expected_blocks = sum(len(a.get("blocks") or []) for a in assignments)
    placed_blocks = len(placements)
    unplaced_blocks = max(0, total_expected_blocks - placed_blocks)

    hard_violations = 0
    is_valid = True
    if validation is not None:
        hard_violations = int(len(validation.get("errors") or []))
        is_valid = bool(validation.get("valid"))

    teacher_avoid = {
        tid: get_teacher_prefer_avoid_set(t, num_days, periods_per_day)
        for tid, t in teachers.items()
    }

    def _get_building(pl_obj: Dict[str, Any]) -> Optional[str]:
        rid = pl_obj.get("room_id")
        if rid and rid in rooms and rooms[rid].get("building"):
            return str(rooms[rid]["building"]).strip()
        cid = pl_obj.get("class_id")
        if cid and cid in classes and classes[cid].get("building"):
            return str(classes[cid]["building"]).strip()
        return None

    teacher_day_periods: Dict[Tuple[str, int], List[int]] = defaultdict(list)
    teacher_day_spans: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    teacher_day_hours: Dict[Tuple[str, int], int] = defaultdict(int)
    class_day_periods: Dict[Tuple[str, int], List[int]] = defaultdict(list)
    asgn_day_counts: Dict[Tuple[str, int], int] = defaultdict(int)

    avoid_hits = 0
    total_hours = 0

    for pl in placements:
        aid = pl.get("assignment_id")
        asgn = assignments_by_id.get(aid, {})
        cid = pl.get("class_id") or asgn.get("class_id")
        d = int(pl.get("day_index", -1))
        p = int(pl.get("start_period", -1))
        blen = int(pl.get("length", 0))
        if d < 0 or p < 0 or blen <= 0:
            continue

        total_hours += blen
        shift = classes.get(cid, {}).get("shift") or "full_day"
        span = get_block_physical_span(intervals, shift, p, blen)
        asgn_day_counts[(aid, d)] += 1

        for k in range(blen):
            class_day_periods[(cid, d)].append(p + k)

        for tid in (pl.get("teacher_ids") or asgn.get("teacher_ids") or []):
            t_av = teacher_avoid.get(tid, set())
            for k in range(blen):
                teacher_day_periods[(tid, d)].append(p + k)
                if (d, p + k) in t_av:
                    avoid_hits += 1
            teacher_day_spans[(tid, d)].append((span[0], span[1], pl))
            teacher_day_hours[(tid, d)] += blen

    # 3. Öğretmen boşlukları
    teacher_gaps = 0
    for (_tid, _d), per_list in teacher_day_periods.items():
        uniq = sorted(set(per_list))
        if len(uniq) >= 2:
            teacher_gaps += (uniq[-1] - uniq[0] + 1) - len(uniq)

    # 4. Sınıf boşlukları
    class_gaps = 0
    for (_cid, _d), per_list in class_day_periods.items():
        uniq = sorted(set(per_list))
        if len(uniq) >= 2:
            class_gaps += (uniq[-1] - uniq[0] + 1) - len(uniq)

    # 6. Derslerin günlere dengeli dağıtılması (aynı dersten aynı gün >1 blok + öğretmen günlük dengesizlik)
    same_day_repeat_blocks = sum(max(0, cnt - 1) for cnt in asgn_day_counts.values())
    teacher_imbalance = 0
    for tid in teachers:
        active_hrs = [teacher_day_hours.get((tid, d), 0) for d in range(num_days) if teacher_day_hours.get((tid, d), 0) > 0]
        if len(active_hrs) >= 2:
            spread = max(active_hrs) - min(active_hrs)
            if spread > 2:
                teacher_imbalance += spread - 2

    # 7. Bina değişimleri
    building_changes = 0
    for (_tid, _d), items in teacher_day_spans.items():
        if len(items) < 2:
            continue
        ordered = sorted(items, key=lambda x: x[0])
        prev_b = None
        for _, _, pl_obj in ordered:
            b = _get_building(pl_obj)
            if b:
                if prev_b and b != prev_b:
                    building_changes += 1
                prev_b = b

    # 8. Blok ders tercihleri (orijinal bloklara kıyasla bölünme varsa ceza)
    block_split_penalty = 0
    for aid, asgn in assignments_by_id.items():
        orig = asgn.get("original_blocks")
        cur = asgn.get("blocks")
        if isinstance(orig, list) and isinstance(cur, list) and orig != cur:
            block_split_penalty += abs(len(cur) - len(orig))

    # Normalize edilmiş 0..100 puan hesabı
    # Ölçek: öğretmen/şube büyüklüğüne göre adil normalize
    denom_teachers = max(1, len(teachers))
    denom_classes = max(1, len(classes))
    denom_blocks = max(1, total_expected_blocks)

    # Ağırlıklı ceza kesintileri (toplam max 100 üzerinden düşülür)
    p_teacher_gaps = min(30.0, (teacher_gaps / denom_teachers) * 6.0)
    p_class_gaps = min(20.0, (class_gaps / denom_classes) * 8.0)
    p_avoid = min(15.0, (avoid_hits / max(1, total_hours)) * 60.0)
    p_spread = min(15.0, (same_day_repeat_blocks / denom_blocks) * 35.0 + (teacher_imbalance / denom_teachers) * 2.0)
    p_building = min(10.0, (building_changes / denom_teachers) * 5.0)
    p_blocks = min(10.0, (block_split_penalty / denom_blocks) * 25.0)

    soft_violations = teacher_gaps + class_gaps + avoid_hits + same_day_repeat_blocks + building_changes + block_split_penalty
    raw_soft_score = max(0.0, 100.0 - (p_teacher_gaps + p_class_gaps + p_avoid + p_spread + p_building + p_blocks))

    # Yerleşim tamamlama çarpanı
    completion_ratio = (placed_blocks / denom_blocks) if total_expected_blocks > 0 else 1.0
    if not is_valid or hard_violations > 0:
        # Geçersiz çizelge: rank_tier = 0; puan tavanı 49.9 (asla geçerli çizelgeyi geçemez)
        rank_tier = 0
        final_score = round(min(49.9, raw_soft_score * 0.45 * completion_ratio), 2)
    elif unplaced_blocks > 0:
        # Kısmi ama çakışmasız çizelge: rank_tier = 1
        rank_tier = 1
        final_score = round(min(79.9, raw_soft_score * completion_ratio), 2)
    else:
        # Tam ve geçerli çizelge: rank_tier = 2
        rank_tier = 2
        final_score = round(raw_soft_score, 2)

    return {
        "quality_score": final_score,
        "rank_tier": rank_tier,  # 2=Tam Geçerli, 1=Kısmi Geçerli, 0=Geçersiz
        "valid": is_valid and hard_violations == 0,
        "hard_violations": hard_violations,
        "soft_violations": int(soft_violations),
        "placed_blocks": placed_blocks,
        "total_blocks": total_expected_blocks,
        "unplaced_blocks": unplaced_blocks,
        "breakdown": {
            "teacher_gaps": teacher_gaps,
            "class_gaps": class_gaps,
            "teacher_preference_misses": avoid_hits,
            "same_day_repeat_blocks": same_day_repeat_blocks,
            "teacher_daily_imbalance": teacher_imbalance,
            "building_changes": building_changes,
            "block_split_count": block_split_penalty,
        },
    }


def compare_solutions(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Aday çözümleri öncelik sırasına göre sıralar:
      1. rank_tier (2 > 1 > 0) — geçersiz çizelge asla geçerli çizelgeyi geçmez
      2. hard_violations (daha az daha iyi)
      3. placed_blocks (daha fazla daha iyi)
      4. quality_score (daha yüksek daha iyi)
      5. solve_time_sec (daha hızlı daha iyi)
    """
    def _key(item: Dict[str, Any]) -> Tuple[int, int, int, float, float]:
        sc = item.get("quality") or {}
        return (
            int(sc.get("rank_tier", 0)),
            -int(sc.get("hard_violations", 999999)),
            int(sc.get("placed_blocks", 0)),
            float(sc.get("quality_score", 0.0)),
            -float(item.get("solve_time_sec", 999999.0)),
        )

    return sorted(candidates, key=_key, reverse=True)
