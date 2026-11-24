"""
Özel derslik havuzu atama yardımcısı (pool_rooms.py).
Hiçbir çözücü kütüphanesine bağımlı olmayan saf Python modülüdür.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Tuple

from validate_model import get_block_physical_span


def assign_pool_rooms(
    placements: List[Dict[str, Any]],
    assignments_by_id: Dict[str, Dict[str, Any]],
    rooms_by_type: Dict[str, List[Dict[str, Any]]],
    classes_map: Dict[str, Dict[str, Any]],
    intervals: Dict[str, List[Tuple[int, int]]],
) -> None:
    by_type_day: Dict[Tuple[str, int], List[Tuple[int, int, Dict[str, Any]]]] = defaultdict(list)
    for pl in placements:
        if pl.get("room_id"):
            continue
        asgn = assignments_by_id[pl["assignment_id"]]
        rtype = asgn.get("room_type") or "standard"
        if rtype == "standard" or not rooms_by_type.get(rtype):
            continue
        shift = classes_map[pl["class_id"]].get("shift") or "full_day"
        s, e = get_block_physical_span(intervals, shift, pl["start_period"], pl["length"])
        by_type_day[(rtype, pl["day_index"])].append((s, e, pl))

    for (rtype, _day), items in by_type_day.items():
        pool = rooms_by_type[rtype]
        slots: List[Tuple[str, int]] = []
        for rm in pool:
            cap = int(rm.get("simultaneous_capacity") or 1)
            for _ in range(cap):
                slots.append((rm["id"], -1))

        items.sort(key=lambda x: (x[0], x[1]))
        for s, e, pl in items:
            assigned = None
            for idx, (rid, free_at) in enumerate(slots):
                if free_at <= s:
                    slots[idx] = (rid, e)
                    assigned = rid
                    break
            if assigned:
                pl["room_id"] = assigned
