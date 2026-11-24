"""
EvrakPlus Multi Solver Optimization Engine - Ortak Adaptör Arayüzü (base_adapter.py).
Bütün optimizasyon motorları aynı yaşam döngüsü ve sonuç sözleşmesini uygular.
"""

from __future__ import annotations

import abc
import time
from typing import Any, Dict, List, Optional


class BaseSolverAdapter(abc.ABC):
    """
    Standart 12 metotlu ortak motor adaptörü:
      initialize, healthCheck, getVersion, getCapabilities, validateInput,
      buildModel, solve, getProgress, getBestSolution, cancel, getStatistics, dispose
    """

    engine_id: str = "unknown"
    display_name: str = "Unknown Engine"

    def __init__(self) -> None:
        self._initialized: bool = False
        self._cancelled: bool = False
        self._progress: Dict[str, Any] = {
            "phase": "idle",
            "message": "Hazır",
            "elapsed_sec": 0.0,
            "percent": None,  # Gerçek hesaplanamıyorsa asla sahte yüzde üretme
        }
        self._best_solution: Optional[Dict[str, Any]] = None
        self._stats: Dict[str, Any] = {}
        self._start_time: float = 0.0

    def initialize(self) -> Dict[str, Any]:
        self._initialized = True
        self._cancelled = False
        return {"ok": True, "engine": self.engine_id, "version": self.getVersion()}

    @abc.abstractmethod
    def healthCheck(self) -> Dict[str, Any]:
        raise NotImplementedError

    @abc.abstractmethod
    def getVersion(self) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def getCapabilities(self) -> Dict[str, Any]:
        raise NotImplementedError

    def validateInput(self, config: Dict[str, Any]) -> Dict[str, Any]:
        import os
        import sys
        solver_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "solver"))
        if solver_dir not in sys.path:
            sys.path.insert(0, solver_dir)
        from validate_model import validate_model
        return validate_model(config)

    @abc.abstractmethod
    def buildModel(self, config: Dict[str, Any]) -> Any:
        raise NotImplementedError

    @abc.abstractmethod
    def solve(self, config: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        raise NotImplementedError

    def getProgress(self) -> Dict[str, Any]:
        p = dict(self._progress)
        if self._start_time > 0:
            p["elapsed_sec"] = round(time.perf_counter() - self._start_time, 2)
        return p

    def getBestSolution(self) -> Optional[Dict[str, Any]]:
        return self._best_solution

    def cancel(self) -> bool:
        self._cancelled = True
        self._progress["phase"] = "cancelled"
        self._progress["message"] = "İptal edildi"
        return True

    def getStatistics(self) -> Dict[str, Any]:
        return dict(self._stats)

    def dispose(self) -> None:
        self._initialized = False
        self._best_solution = None


def check_engine_suitability(capabilities: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bir motorun verilen okul verisindeki zorunlu kuralları destekleyip desteklemediğini kontrol eder.
    Desteklemiyorsa motoru ilgili çözüm için uygun olmayan (unsuitable) olarak işaretler.
    """
    reasons: List[str] = []
    time_grid = config.get("time_grid") or {}
    teachers = config.get("teachers") or []
    rooms = config.get("rooms") or []
    assignments = config.get("assignments") or []
    school = config.get("school") or {}

    has_dual_shift = any((c.get("shift") in ("morning", "afternoon")) for c in (config.get("classes") or []))
    has_building_travel = int(school.get("building_travel_minutes") or 0) > 0
    has_common_elective = bool(time_grid.get("common_elective_slots")) and any(
        a.get("use_common_elective_slot") for a in assignments
    )
    has_multi_teacher = any(len(a.get("teacher_ids") or []) > 1 for a in assignments)
    has_special_rooms = any((a.get("room_type") or "standard") != "standard" or a.get("room_id") for a in assignments)
    has_max_consec = any(int(t.get("max_consecutive_hours") or 0) > 0 for t in teachers)

    if has_dual_shift and not capabilities.get("dual_shift", True):
        reasons.append("İkili öğretim (fiziksel zaman çakışması) bu motor adaptöründe desteklenmiyor.")
    if has_building_travel and not capabilities.get("building_travel", True):
        reasons.append("Binalar arası geçiş süresi bu motor adaptöründe desteklenmiyor.")
    if has_common_elective and not capabilities.get("common_elective", True):
        reasons.append("Ortak seçmeli saat kısıtı bu motor adaptöründe desteklenmiyor.")
    if has_multi_teacher and not capabilities.get("multi_teacher", True):
        reasons.append("İki öğretmenli eşzamanlı ders bu motor adaptöründe desteklenmiyor.")
    if has_special_rooms and not capabilities.get("special_rooms", True):
        reasons.append("Özel derslik kapasitesi bu motor adaptöründe desteklenmiyor.")
    if has_max_consec and not capabilities.get("max_consecutive", True):
        reasons.append("Ardışık maksimum ders kısıtı bu motor adaptöründe desteklenmiyor.")

    return {"suitable": len(reasons) == 0, "reasons": reasons}
