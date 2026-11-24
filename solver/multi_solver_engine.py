"""
EvrakPlus Multi Solver Optimization Engine (multi_solver_engine.py).
Altı gerçek optimizasyon altyapısını (OR-Tools CP-SAT, Timefold Solver, Choco Solver,
MiniZinc [Gecode/Chuffed], SCIP, HiGHS) ortak veri modeli, Multi-Pass (PASS 0-7),
bağımsız doğrulama ve 100 üzerinden ortak kalite puanlama ile yönetir.

Çalışma Modları:
  - auto       : Okul büyüklüğü ve donanıma göre akıllı motor seçimi
  - single     : Kullanıcının seçtiği tek motor
  - sequential : Seçilen motorları bütçe içinde sırayla dener
  - parallel   : Seçilen motorları CPU/RAM sınırı altında paralel çalıştırır
  - hybrid     : OR-Tools -> Timefold warm-start iyileştirme + alternatif motorlar -> en iyi geçerli sonuç
  - ultimate   : Süre bütçesi içinde çok motorlu + çok stratejili en iyi geçerli çözüm
"""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_SOLVER_DIR = os.path.join(_ROOT, "solver")
for _p in (_ROOT, _SOLVER_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import ortools  # noqa: E402
from solver_ortools import solve_timetable as solve_ortools_core  # noqa: E402
from validate_model import validate_model  # noqa: E402
from validate_result import validate_result  # noqa: E402
from quality_scorer import compare_solutions, score_schedule  # noqa: E402
from engines.scip.solver_scip import health_check as scip_health, solve_with_scip  # noqa: E402
from engines.highs.solver_highs import health_check as highs_health, solve_with_highs  # noqa: E402
from engines.minizinc.solver_minizinc import health_check as minizinc_health, solve_with_minizinc  # noqa: E402
from engines.java_bridge import health_check_java_engine, solve_with_java_engine  # noqa: E402

ALL_ENGINE_KEYS = ["ortools", "timefold", "choco", "minizinc", "scip", "highs"]


def emit_event(payload: Dict[str, Any]) -> None:
    try:
        sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def get_system_resources() -> Dict[str, Any]:
    cpu_count = os.cpu_count() or 4
    total_ram_mb = 4096
    avail_ram_mb = 2048
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_ram_mb = int(vm.total // (1024 * 1024))
        avail_ram_mb = int(vm.available // (1024 * 1024))
    except Exception:
        pass
    return {
        "cpu_cores": cpu_count,
        "total_ram_mb": total_ram_mb,
        "available_ram_mb": avail_ram_mb,
    }


def ortools_health() -> Dict[str, Any]:
    return {
        "available": True,
        "engine": "google_ortools_cp_sat",
        "display_name": "Google OR-Tools CP-SAT",
        "version": f"Google OR-Tools {ortools.__version__}",
        "capabilities": {
            "dual_shift": True,
            "building_travel": True,
            "common_elective": True,
            "multi_teacher": True,
            "special_rooms": True,
            "max_consecutive": True,
            "warm_start": True,
        },
    }


def health_check_all() -> Dict[str, Any]:
    engines = {
        "ortools": ortools_health(),
        "timefold": health_check_java_engine("timefold"),
        "choco": health_check_java_engine("choco"),
        "minizinc": minizinc_health(),
        "scip": scip_health(),
        "highs": highs_health(),
    }
    available_count = sum(1 for e in engines.values() if e.get("available"))
    return {
        "orchestrator": "EvrakPlus Multi Solver Optimization Engine",
        "version": "1.0.0",
        "available_engines": available_count,
        "total_engines": len(engines),
        "system": get_system_resources(),
        "engines": engines,
    }


def _run_single_engine(
    engine_key: str,
    config: Dict[str, Any],
    time_limit_sec: float,
    initial_placements: Optional[List[Dict[str, Any]]] = None,
    minizinc_backend: str = "gecode",
    threads: int = 2,
    max_heap_mb: int = 1024,
) -> Dict[str, Any]:
    cfg = copy.deepcopy(config)
    req = cfg.setdefault("solution_request", {})
    req["time_limit_sec"] = max(2.0, float(time_limit_sec))
    req["threads"] = max(1, int(threads))

    emit_event({"type": "engine_start", "engine_key": engine_key, "time_limit_sec": req["time_limit_sec"]})
    t0 = time.perf_counter()
    try:
        if engine_key == "ortools":
            res = solve_ortools_core(cfg)
            res["engine_version"] = f"Google OR-Tools {ortools.__version__}"
            is_max = str((cfg.get("solution_request") or {}).get("mode") or "") == "maximize_placement"
            val = validate_result(cfg, res, allow_partial=is_max)
            res["validation"] = val
            res["quality"] = score_schedule(cfg, res, val)
        elif engine_key == "timefold":
            res = solve_with_java_engine("timefold", cfg, initial_placements=initial_placements, max_heap_mb=max_heap_mb)
        elif engine_key == "choco":
            res = solve_with_java_engine("choco", cfg, max_heap_mb=max_heap_mb)
        elif engine_key == "minizinc":
            res = solve_with_minizinc(cfg, backend=minizinc_backend)
        elif engine_key == "scip":
            res = solve_with_scip(cfg)
        elif engine_key == "highs":
            res = solve_with_highs(cfg)
        else:
            res = {
                "engine": engine_key,
                "status": "ERROR",
                "solve_time_sec": 0.0,
                "placed_blocks": 0,
                "total_blocks": 0,
                "placements": [],
                "unplaced": [],
                "diagnostics": [{"code": "UNKNOWN_ENGINE", "message": f"Bilinmeyen motor: {engine_key}"}],
            }
    except Exception as exc:
        res = {
            "engine": engine_key,
            "status": "ERROR",
            "solve_time_sec": round(time.perf_counter() - t0, 3),
            "placed_blocks": 0,
            "total_blocks": 0,
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "ENGINE_CRASH", "message": f"{engine_key} çalışma hatası: {exc}"}],
        }

    res["engine_key"] = engine_key
    if "validation" not in res:
        val = validate_result(cfg, res)
        res["validation"] = val
    if "quality" not in res:
        res["quality"] = score_schedule(cfg, res, res["validation"])

    emit_event({
        "type": "engine_done",
        "engine_key": engine_key,
        "status": res.get("status"),
        "valid": bool((res.get("validation") or {}).get("valid")),
        "quality_score": (res.get("quality") or {}).get("quality_score", 0.0),
        "solve_time_sec": res.get("solve_time_sec", 0.0),
    })
    return res


def _select_auto_engines(config: Dict[str, Any], available: List[str], perf_mode: str) -> List[str]:
    num_teachers = len(config.get("teachers") or [])
    num_blocks = sum(len(a.get("blocks") or []) for a in (config.get("assignments") or []))
    preferred_order = ["ortools", "timefold", "highs", "scip", "choco", "minizinc"]
    avail_ordered = [e for e in preferred_order if e in available]

    if perf_mode == "low":
        return avail_ordered[:1] or ["ortools"]
    if num_teachers >= 100 or num_blocks >= 800:
        # Büyük okullarda OR-Tools + Timefold (warm-start) en hızlı ve ölçeklenebilir ikili
        return [e for e in ["ortools", "timefold", "highs"] if e in avail_ordered]
    if num_teachers >= 40:
        return [e for e in ["ortools", "timefold", "highs", "scip"] if e in avail_ordered]
    # Küçük/Normal okullarda tüm uygun motorlar değerlendirilebilir
    return avail_ordered


def _apply_multipass_relaxation(config: Dict[str, Any], pass_num: int) -> Tuple[Dict[str, Any], List[str]]:
    """
    PASS 2-4 kontrollü yumuşatma (KESİN KURALLAR ASLA ESNETİLMEZ!).
    Hangi kuralın, hangi aşamada ve ne ölçüde esnetildiğini açıkça raporlar.
    """
    cfg = copy.deepcopy(config)
    notes: List[str] = []
    req = cfg.get("solution_request") or {}

    if pass_num == 2:
        # Yalnızca kullanıcının açıkça izin verdiği blok alternatifleri
        if not req.get("allow_block_alternatives"):
            return cfg, []
        changed = 0
        for asgn in cfg.get("assignments") or []:
            blocks = asgn.get("blocks") or []
            if any(int(b) >= 3 for b in blocks):
                asgn["original_blocks"] = list(blocks)
                new_blocks = []
                for b in blocks:
                    b = int(b)
                    if b == 4:
                        new_blocks.extend([2, 2])
                        changed += 1
                    elif b == 3:
                        new_blocks.extend([2, 1])
                        changed += 1
                    else:
                        new_blocks.append(b)
                asgn["blocks"] = new_blocks
        if changed:
            notes.append(f"PASS 2: Kullanıcı izniyle {changed} uzun blok (3-4 saat) alternatif alt bloklara ayrıldı.")
    elif pass_num == 3:
        # Esnek boşluk limitlerini gevşet (öğretmen günlük boşluk limiti varsa +1)
        changed = 0
        for t in cfg.get("teachers") or []:
            mg = int(t.get("max_daily_gaps") or 0)
            if mg > 0:
                t["max_daily_gaps"] = mg + 1
                changed += 1
        if changed:
            notes.append(f"PASS 3: {changed} öğretmenin esnek günlük boşluk limiti +1 saat esnetildi.")
    elif pass_num == 4:
        # Esnek ardışık ders limitini gevşet (+1)
        changed = 0
        for t in cfg.get("teachers") or []:
            mc = int(t.get("max_consecutive_hours") or 0)
            if mc > 0 and mc < 8:
                t["max_consecutive_hours"] = mc + 1
                changed += 1
        if changed:
            notes.append(f"PASS 4: {changed} öğretmenin ardışık ders limiti +1 saat esnetildi.")

    return cfg, notes


def run_multi_solver(config: Dict[str, Any]) -> Dict[str, Any]:
    t_start = time.perf_counter()
    req = config.get("solution_request") or {}
    mode = str(req.get("multi_mode") or "auto").lower()  # auto, single, sequential, parallel, hybrid, ultimate
    total_budget = float(req.get("time_limit_sec") or 60.0)
    perf_mode = str(req.get("performance_mode") or "balanced").lower()  # low, balanced, high
    minizinc_backend = str(req.get("minizinc_backend") or "gecode").lower()
    requested_engines = req.get("engines")
    if isinstance(requested_engines, list) and requested_engines:
        selected_engines = [e for e in requested_engines if e in ALL_ENGINE_KEYS]
    elif req.get("engine") in ALL_ENGINE_KEYS:
        selected_engines = [str(req["engine"])]
    else:
        selected_engines = []

    sys_res = get_system_resources()
    cpu_cores = sys_res["cpu_cores"]
    if perf_mode == "low":
        max_parallel = 1
        threads_per_engine = max(1, cpu_cores // 4)
        heap_mb = 512
    elif perf_mode == "high":
        max_parallel = min(4, max(2, cpu_cores // 2))
        threads_per_engine = max(1, cpu_cores // max_parallel)
        heap_mb = min(2048, max(768, sys_res["available_ram_mb"] // 4))
    else:
        max_parallel = min(3, max(1, cpu_cores // 2))
        threads_per_engine = max(1, cpu_cores // max(2, max_parallel))
        heap_mb = min(1536, max(512, sys_res["available_ram_mb"] // 5))

    pass_log: List[Dict[str, Any]] = []

    # Maksimumda Bitir (maximize_placement) modu doğrudan OR-Tools CP-SAT opsiyonel yerleştirme motorunu kullanır
    if str(req.get("mode") or "") == "maximize_placement":
        mode = "single"
        selected_engines = ["ortools"]

    # PASS 0: Veri ve kapasite ön kontrolü
    is_maximize = str(req.get("mode") or "") == "maximize_placement"
    emit_event({"type": "pass", "pass": 0, "message": "PASS 0: Veri ve kapasite ön kontrolü yapılıyor"})
    pre = validate_model(config)
    fatal_in_max = {"INVALID_GRID", "NO_ASSIGNMENTS", "MISSING_CLASS", "NO_TEACHER_ASSIGNED", "BLOCK_SUM_MISMATCH", "DUPLICATE_FIXED_BLOCK"}
    blocking_errors = [e for e in (pre.get("errors") or []) if (not is_maximize) or (e.get("code") in fatal_in_max)]
    pass_log.append({"pass": "PASS 0", "description": "Veri ve kapasite ön kontrolü", "valid": len(blocking_errors) == 0, "errors": len(blocking_errors)})
    if blocking_errors:
        return {
            "orchestrator": "EvrakPlus Multi Solver Optimization Engine",
            "mode": mode,
            "engine": "multi_solver",
            "status": "MODEL_INVALID",
            "solve_time_sec": round(time.perf_counter() - t_start, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": blocking_errors,
            "warnings": pre["warnings"],
            "candidates": [],
            "pass_log": pass_log,
            "relaxations": [],
        }

    # Sağlık taraması ile mevcut motorları bul
    hc = health_check_all()
    available_keys = [k for k, v in hc["engines"].items() if v.get("available")]
    if not selected_engines:
        selected_engines = _select_auto_engines(config, available_keys, perf_mode)
    else:
        selected_engines = [e for e in selected_engines if e in available_keys]

    if not selected_engines:
        return {
            "orchestrator": "EvrakPlus Multi Solver Optimization Engine",
            "mode": mode,
            "engine": "multi_solver",
            "status": "ERROR",
            "solve_time_sec": round(time.perf_counter() - t_start, 3),
            "placed_blocks": 0,
            "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
            "placements": [],
            "unplaced": [],
            "diagnostics": [{"code": "NO_AVAILABLE_ENGINE", "message": "Seçili veya kullanılabilir optimizasyon motoru bulunamadı."}],
            "warnings": pre["warnings"],
            "candidates": [],
            "pass_log": pass_log,
            "relaxations": [],
        }

    candidates: List[Dict[str, Any]] = []
    relaxations_applied: List[str] = []

    # PASS 1: Seçilen moda göre kesin kurallarla çözüm
    emit_event({"type": "pass", "pass": 1, "message": f"PASS 1: {mode.upper()} modunda çözüm aranıyor ({', '.join(selected_engines)})"})
    if mode == "single":
        eng = selected_engines[0]
        res = _run_single_engine(eng, config, total_budget, minizinc_backend=minizinc_backend, threads=threads_per_engine, max_heap_mb=heap_mb)
        candidates.append(res)
    elif mode == "sequential":
        per_budget = max(3.0, total_budget / max(1, len(selected_engines)))
        for eng in selected_engines:
            rem = total_budget - (time.perf_counter() - t_start)
            if rem <= 1.0:
                break
            res = _run_single_engine(eng, config, min(per_budget, rem), minizinc_backend=minizinc_backend, threads=threads_per_engine, max_heap_mb=heap_mb)
            candidates.append(res)
            if (res.get("validation") or {}).get("valid") and res.get("status") in ("OPTIMAL", "FEASIBLE"):
                break
    elif mode == "parallel":
        per_budget = max(3.0, total_budget)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(max_parallel, len(selected_engines))) as ex:
            futs = [
                ex.submit(_run_single_engine, eng, config, per_budget, None, minizinc_backend, threads_per_engine, heap_mb)
                for eng in selected_engines
            ]
            for f in concurrent.futures.as_completed(futs):
                candidates.append(f.result())
    elif mode in ("hybrid", "ultimate", "auto"):
        # 1. Aşama: OR-Tools (varsa) ile hızlı geçerli başlangıç çözümü üret
        seed_placements = None
        if "ortools" in selected_engines:
            ort_budget = max(3.0, total_budget * (0.35 if len(selected_engines) > 1 else 1.0))
            r_ort = _run_single_engine("ortools", config, ort_budget, threads=threads_per_engine, max_heap_mb=heap_mb)
            candidates.append(r_ort)
            if (r_ort.get("validation") or {}).get("valid") and r_ort.get("placements"):
                seed_placements = r_ort["placements"]

        # 2. Aşama: Timefold warm-start iyileştirme + diğer seçili motorlar paralel
        other_engines = [e for e in selected_engines if e != "ortools"]
        rem = total_budget - (time.perf_counter() - t_start)
        if other_engines and rem > 2.0:
            emit_event({"type": "pass", "pass": 6, "message": f"PASS 5-6: Alternatif motorlar ve kalite iyileştirme ({', '.join(other_engines)})"})
            per_budget = max(3.0, rem * 0.85)
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(max_parallel, len(other_engines))) as ex:
                futs = []
                for eng in other_engines:
                    init_p = seed_placements if eng == "timefold" else None
                    futs.append(ex.submit(_run_single_engine, eng, config, per_budget, init_p, minizinc_backend, threads_per_engine, heap_mb))
                for f in concurrent.futures.as_completed(futs):
                    candidates.append(f.result())

    pass_log.append({
        "pass": "PASS 1",
        "description": f"Kesin kurallarla {mode} çözüm",
        "candidates_count": len(candidates),
        "valid_count": sum(1 for c in candidates if (c.get("validation") or {}).get("valid")),
    })

    # PASS 2-4: Eğer hiç geçerli çözüm yoksa ve bütçe kaldıysa, yalnız kullanıcı izinli/esnek kuralları kontrollü dene
    valid_cands = [c for c in candidates if (c.get("validation") or {}).get("valid")]
    if not valid_cands and req.get("enable_multipass", True):
        for pnum in (2, 3, 4):
            rem = total_budget - (time.perf_counter() - t_start)
            if rem < 3.0:
                break
            relaxed_cfg, notes = _apply_multipass_relaxation(config, pnum)
            if not notes:
                continue
            emit_event({"type": "pass", "pass": pnum, "message": notes[0]})
            r_pass = _run_single_engine("ortools" if "ortools" in available_keys else selected_engines[0], relaxed_cfg, min(rem, 15.0), threads=threads_per_engine, max_heap_mb=heap_mb)
            r_pass["pass_notes"] = notes
            candidates.append(r_pass)
            pass_log.append({"pass": f"PASS {pnum}", "description": notes[0], "valid": bool((r_pass.get("validation") or {}).get("valid"))})
            if (r_pass.get("validation") or {}).get("valid"):
                relaxations_applied.extend(notes)
                break

    # PASS 7: Bağımsız doğrulama + Ortak Kalite Puanına göre en iyi geçerli sonucu seç
    emit_event({"type": "pass", "pass": 7, "message": "PASS 7: Ortak kalite puanına göre en iyi geçerli sonuç seçiliyor"})
    ranked = compare_solutions(candidates)
    best = ranked[0] if ranked else None

    total_elapsed = round(time.perf_counter() - t_start, 3)
    pass_log.append({
        "pass": "PASS 7",
        "description": "Bağımsız doğrulama ve kalite puanlama seçimi",
        "best_engine": best.get("engine_key") if best else None,
        "best_score": (best.get("quality") or {}).get("quality_score", 0.0) if best else 0.0,
    })

    # Özet aday listesi (karşılaştırma ekranı için hafif + tam placements)
    comparison_table = []
    for c in ranked:
        q = c.get("quality") or {}
        v = c.get("validation") or {}
        comparison_table.append({
            "engine_key": c.get("engine_key"),
            "engine": c.get("engine"),
            "backend_solver": c.get("backend_solver"),
            "engine_version": c.get("engine_version"),
            "status": c.get("status"),
            "valid": bool(v.get("valid")),
            "classification": v.get("classification", "INVALID"),
            "solve_time_sec": c.get("solve_time_sec", 0.0),
            "placed_blocks": c.get("placed_blocks", 0),
            "total_blocks": c.get("total_blocks", 0),
            "unplaced_blocks": q.get("unplaced_blocks", 0),
            "hard_violations": q.get("hard_violations", 0),
            "soft_violations": q.get("soft_violations", 0),
            "quality_score": q.get("quality_score", 0.0),
            "rank_tier": q.get("rank_tier", 0),
            "breakdown": q.get("breakdown", {}),
            "diagnostics": c.get("diagnostics", []),
            "placements": c.get("placements", []) if v.get("valid") else [],
        })

    if best and (best.get("validation") or {}).get("valid"):
        return {
            "orchestrator": "EvrakPlus Multi Solver Optimization Engine",
            "mode": mode,
            "engine": best.get("engine"),
            "engine_key": best.get("engine_key"),
            "backend_solver": best.get("backend_solver"),
            "engine_version": best.get("engine_version"),
            "status": best.get("status"),
            "solve_time_sec": total_elapsed,
            "best_engine_time_sec": best.get("solve_time_sec"),
            "placed_blocks": best.get("placed_blocks", 0),
            "total_blocks": best.get("total_blocks", 0),
            "placements": best.get("placements", []),
            "unplaced": best.get("unplaced", []),
            "diagnostics": best.get("diagnostics", []),
            "warnings": pre["warnings"],
            "validation": best.get("validation"),
            "quality": best.get("quality"),
            "candidates": comparison_table,
            "pass_log": pass_log,
            "relaxations": relaxations_applied,
            "system": sys_res,
        }

    return {
        "orchestrator": "EvrakPlus Multi Solver Optimization Engine",
        "mode": mode,
        "engine": best.get("engine") if best else "multi_solver",
        "engine_key": best.get("engine_key") if best else None,
        "status": best.get("status") if best else "UNKNOWN",
        "solve_time_sec": total_elapsed,
        "placed_blocks": 0,
        "total_blocks": int((pre.get("summary") or {}).get("total_blocks") or 0),
        "placements": [],
        "unplaced": best.get("unplaced", []) if best else [],
        "diagnostics": best.get("diagnostics", []) if best else [{"code": "NO_VALID_SOLUTION", "message": "Hiçbir motor geçerli çözüm üretemedi."}],
        "warnings": pre["warnings"],
        "validation": best.get("validation") if best else None,
        "quality": best.get("quality") if best else None,
        "candidates": comparison_table,
        "pass_log": pass_log,
        "relaxations": relaxations_applied,
        "system": sys_res,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="EvrakPlus Multi Solver Optimization Engine")
    parser.add_argument("--health-all", action="store_true", help="Altı motorun tamamını sağlık kontrolünden geçir")
    parser.add_argument("--input", "-i", help="Giriş JSON dosya yolu")
    parser.add_argument("--output", "-o", help="Çıkış JSON dosya yolu")
    args = parser.parse_args()

    if args.health_all:
        print(json.dumps(health_check_all(), ensure_ascii=False))
        return 0

    if not args.input:
        print(json.dumps({"status": "ERROR", "diagnostics": [{"code": "NO_INPUT", "message": "Giriş JSON dosyası belirtilmedi."}]}))
        return 1

    with open(args.input, "r", encoding="utf-8") as f:
        config = json.load(f)

    res = run_multi_solver(config)
    text = json.dumps(res, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
