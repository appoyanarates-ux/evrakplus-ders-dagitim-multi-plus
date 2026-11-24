import os from 'node:os';
import { buildSolverInput, SolverStatus } from '../../core-schema/src/index.js';
import { runPrecheck, compareEvaluations } from '../../validator/src/index.js';
import { OrToolsAdapter } from '../../../engines/ortools/adapter.js';
import { TimefoldAdapter } from '../../../engines/timefold/adapter.js';
import { ChocoAdapter } from '../../../engines/choco/adapter.js';
import { MiniZincAdapter } from '../../../engines/minizinc/adapter.js';
import { ScipAdapter } from '../../../engines/scip/adapter.js';
import { HighsAdapter } from '../../../engines/highs/adapter.js';

export const SOLVER_ORDER = ['ortools', 'timefold', 'choco', 'minizinc', 'scip', 'highs'];

export const SolverMode = Object.freeze({
  SMART: 'smart',
  SINGLE: 'single',
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  HYBRID: 'hybrid',
  ULTIMATE: 'ultimate'
});

/**
 * EvrakPlus Multi Solver Optimization Engine
 * 6 gerçek optimizasyon motorunu merkezi süre bütçesi, CPU/RAM koruması,
 * PASS 0-7 aşamalı çözüm hattı ve bağımsız doğrulayıcı ile yönetir.
 */
export class MultiSolverEngine {
  constructor(options = {}) {
    this.adapters = new Map([
      ['ortools', new OrToolsAdapter(options.ortools)],
      ['timefold', new TimefoldAdapter(options.timefold)],
      ['choco', new ChocoAdapter(options.choco)],
      ['minizinc', new MiniZincAdapter(options.minizinc || { backendSolver: 'gecode' })],
      ['scip', new ScipAdapter(options.scip)],
      ['highs', new HighsAdapter(options.highs)]
    ]);
    this.cancelled = false;
    this.bestValid = null;
    this.runningAdapters = new Set();
  }

  getAdapter(id) {
    return this.adapters.get(id) || null;
  }

  listEngines() {
    return [...this.adapters.values()].map(a => a.getCapabilities());
  }

  async healthCheckAll() {
    const entries = [...this.adapters.entries()];
    const results = await Promise.all(entries.map(async ([id, adapter]) => {
      const hc = await adapter.healthCheck();
      return [id, { ...hc, capabilities: adapter.getCapabilities() }];
    }));
    return Object.fromEntries(results);
  }

  /**
   * Bilgisayarın CPU ve boş RAM kapasitesine göre paralel çalışabilecek
   * güvenli maksimum motor sayısını hesaplar (6 motoru kontrolsüz başlatmaz).
   */
  computeSafeConcurrency(requestedMax = 3) {
    const cpus = os.cpus().length || 2;
    const freeMemGB = os.freemem() / (1024 ** 3);
    const byCpu = Math.max(1, Math.floor(cpus / 2));
    const byRam = Math.max(1, Math.floor(freeMemGB / 1.5));
    return Math.max(1, Math.min(requestedMax, byCpu, byRam, 4));
  }

  /**
   * Akıllı otomatik mod: okul büyüklüğüne ve kısıt yoğunluğuna göre motor stratejisi seçer.
   */
  chooseSmartStrategy(solverInput) {
    const tCount = solverInput.teachers.length;
    const bCount = solverInput.blocks.length;
    const hasBuildingTransitions = (solverInput.buildings || []).some(
      b => Object.values(b.transitionPeriods || {}).some(v => Number(v) > 0)
    );

    if (hasBuildingTransitions) {
      return {
        mode: SolverMode.SEQUENTIAL,
        engines: ['choco', 'ortools'],
        reason: 'Bina geçiş süresi kısıtı tespit edildi; Choco Solver önceliklendirildi.'
      };
    }
    if (tCount <= 35 && bCount <= 250) {
      return {
        mode: SolverMode.HYBRID,
        engines: ['ortools', 'timefold'],
        reason: 'Küçük/orta ölçekli okul: OR-Tools CP-SAT + Timefold kalite iyileştirme hibriti.'
      };
    }
    return {
      mode: SolverMode.SINGLE,
      engines: ['ortools'],
      reason: 'Büyük/çok büyük okul: Çok çekirdekli Google OR-Tools CP-SAT ana motoru.'
    };
  }

  async cancelAll() {
    this.cancelled = true;
    const kills = [...this.runningAdapters].map(a => a.cancel().catch(() => {}));
    await Promise.all(kills);
    this.runningAdapters.clear();
    return this.bestValid;
  }

  _updateBest(result) {
    if (!result || !result.evaluation) return;
    if (!result.evaluation.validation.isHardValid) return;
    if (!this.bestValid || compareEvaluations(result.evaluation, this.bestValid.evaluation) > 0) {
      this.bestValid = result;
    }
  }

  async _runEngine(engineId, solverInput, timeBudgetSec, callbacks = {}) {
    if (this.cancelled) return null;
    const adapter = this.adapters.get(engineId);
    if (!adapter) return null;

    const inputCopy = {
      ...solverInput,
      options: {
        ...(solverInput.options || {}),
        timeLimitSeconds: Math.max(2, Math.floor(timeBudgetSec))
      }
    };

    this.runningAdapters.add(adapter);
    try {
      const res = await adapter.solve(inputCopy, {
        onProgress: p => callbacks.onEngineProgress?.(engineId, p),
        onIntermediateSolution: sol => {
          if (sol?.evaluation?.validation?.isHardValid) {
            const candidate = { engine: engineId, status: sol.evaluation.validation.verifiedStatus, placements: sol.placements, evaluation: sol.evaluation };
            this._updateBest(candidate);
            callbacks.onBestUpdated?.(this.bestValid);
          }
        }
      });
      this._updateBest(res);
      callbacks.onEngineFinished?.(engineId, res);
      return res;
    } finally {
      this.runningAdapters.delete(adapter);
    }
  }

  /**
   * Seçilen çalışma moduna göre optimizasyonu yürütür.
   */
  async solve(projectOrInput, options = {}, callbacks = {}) {
    const t0 = Date.now();
    this.cancelled = false;
    this.bestValid = null;

    const isProject = Boolean(projectOrInput?.assignments && projectOrInput?.school?.daysPerWeek);
    const solverInput = isProject ? buildSolverInput(projectOrInput, options) : projectOrInput;
    const totalBudgetSec = Math.max(5, Number(options.timeLimitSeconds ?? solverInput.options?.timeLimitSeconds ?? 60));
    const deadline = t0 + totalBudgetSec * 1000;
    const remainingSec = () => Math.max(0, (deadline - Date.now()) / 1000);

    // PASS 0: Ön kontrol
    const precheck = runPrecheck(solverInput);
    const passLog = [{ pass: 0, name: 'Veri ve model ön kontrolü', passed: precheck.passed, errorCount: precheck.errorCount, warningCount: precheck.warningCount }];

    let mode = options.mode || SolverMode.SMART;
    let selectedEngines = options.engines || null;
    let strategyNote = '';

    if (mode === SolverMode.SMART) {
      const smart = this.chooseSmartStrategy(solverInput);
      mode = smart.mode;
      selectedEngines = selectedEngines || smart.engines;
      strategyNote = smart.reason;
    }

    const allResults = [];

    if (mode === SolverMode.SINGLE) {
      const eid = (selectedEngines && selectedEngines[0]) || options.engine || 'ortools';
      const r = await this._runEngine(eid, solverInput, remainingSec(), callbacks);
      if (r) allResults.push(r);
      passLog.push({ pass: 1, name: `Tek motor (${eid})`, status: r?.status, quality: r?.evaluation?.qualityScore });
    } else if (mode === SolverMode.SEQUENTIAL) {
      const order = selectedEngines || SOLVER_ORDER;
      for (let i = 0; i < order.length && !this.cancelled && remainingSec() >= 2; i++) {
        const eid = order[i];
        const share = Math.max(3, remainingSec() / (order.length - i));
        const r = await this._runEngine(eid, solverInput, share, callbacks);
        if (r) allResults.push(r);
        passLog.push({ pass: i === 0 ? 1 : 5, name: `Sıralı (${eid})`, status: r?.status, quality: r?.evaluation?.qualityScore });
        if (r?.evaluation?.validation?.isValid && options.stopOnFirstValid !== false) break;
      }
    } else if (mode === SolverMode.PARALLEL) {
      const pool = selectedEngines || ['ortools', 'choco', 'minizinc', 'highs'];
      const concurrency = this.computeSafeConcurrency(options.maxConcurrency || 3);
      const queue = [...pool];
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0 && !this.cancelled && remainingSec() >= 2) {
          const eid = queue.shift();
          const r = await this._runEngine(eid, solverInput, Math.min(remainingSec(), options.perEngineSeconds || remainingSec()), callbacks);
          if (r) allResults.push(r);
        }
      });
      await Promise.all(workers);
      passLog.push({ pass: 5, name: `Paralel (${pool.join(', ')}, concurrency=${concurrency})`, completed: allResults.length });
    } else if (mode === SolverMode.HYBRID) {
      // Faz 1: Başlangıç geçerli çözümü (OR-Tools, başarısızsa Choco)
      const primaryId = (selectedEngines && selectedEngines[0]) || 'ortools';
      const improverId = (selectedEngines && selectedEngines[1]) || 'timefold';
      const r1 = await this._runEngine(primaryId, solverInput, Math.max(4, remainingSec() * 0.45), callbacks);
      if (r1) allResults.push(r1);
      passLog.push({ pass: 1, name: `Hibrit Faz 1 (${primaryId})`, status: r1?.status, quality: r1?.evaluation?.qualityScore });

      // Faz 2: Yalnızca supportsHints === true olan iyileştirici motorla warm-start
      const improver = this.adapters.get(improverId);
      if (r1?.evaluation?.validation?.isValid && improver && improver.getCapabilities().supportsHints && !this.cancelled && remainingSec() >= 3) {
        const hintedInput = {
          ...solverInput,
          blocks: solverInput.blocks.map(b => ({
            ...b,
            hintPlacement: r1.placements[b.blockId] || b.hintPlacement
          })),
          options: { ...(solverInput.options || {}), useHints: true }
        };
        const r2 = await this._runEngine(improverId, hintedInput, Math.max(4, remainingSec()), callbacks);
        if (r2) allResults.push(r2);
        passLog.push({ pass: 6, name: `Hibrit Faz 2 İyileştirme (${improverId})`, status: r2?.status, quality: r2?.evaluation?.qualityScore });
      }
    } else if (mode === SolverMode.ULTIMATE) {
      const order = selectedEngines || ['ortools', 'timefold', 'choco', 'minizinc', 'highs'];
      const perEngine = Math.max(4, totalBudgetSec / order.length);
      for (const eid of order) {
        if (this.cancelled || remainingSec() < 2) break;
        // Eğer elde geçerli çözüm varsa ve motor hint destekliyorsa warm-start ver
        const adapter = this.adapters.get(eid);
        let runInput = solverInput;
        if (this.bestValid?.evaluation?.validation?.isValid && adapter?.getCapabilities().supportsHints) {
          runInput = {
            ...solverInput,
            blocks: solverInput.blocks.map(b => ({
              ...b,
              hintPlacement: this.bestValid.placements[b.blockId] || b.hintPlacement
            })),
            options: { ...(solverInput.options || {}), useHints: true }
          };
        }
        const r = await this._runEngine(eid, runInput, Math.min(perEngine, remainingSec()), callbacks);
        if (r) allResults.push(r);
      }
      passLog.push({ pass: 7, name: `Ultimate (${order.join(' → ')})`, resultsCount: allResults.length });
    }

    // PASS 7: Tüm sonuçları bağımsız doğrulayıcı ve 100 puan kalite sistemiyle sırala
    const ranked = [...allResults].sort((a, b) => compareEvaluations(b.evaluation, a.evaluation));
    const best = this.bestValid || ranked[0] || null;

    // Süre dolduysa ve çözüm yoksa kesinlikle çözümsüz iddia etme -> TIME_LIMIT
    let finalStatus = best?.status || SolverStatus.UNKNOWN;
    if (!best?.evaluation?.validation?.isValid && remainingSec() <= 0.1 && finalStatus !== SolverStatus.INFEASIBLE) {
      finalStatus = SolverStatus.TIME_LIMIT;
    }
    if (this.cancelled && !best?.evaluation?.validation?.isValid) {
      finalStatus = SolverStatus.CANCELLED;
    }

    return {
      mode,
      strategyNote,
      status: finalStatus,
      elapsedMs: Date.now() - t0,
      precheck,
      passLog,
      bestResult: best,
      comparison: ranked.map(r => ({
        engine: r.engine,
        version: r.version || null,
        backendDisclosure: r.backendDisclosure || null,
        status: r.status,
        rawStatus: r.rawStatus,
        isValid: r.evaluation.validation.isValid,
        qualityScore: r.evaluation.qualityScore,
        assignedBlocks: r.evaluation.validation.metrics.assignedBlocks,
        unassignedBlocks: r.evaluation.validation.metrics.unassignedBlocksCount,
        hardViolations: r.evaluation.validation.metrics.hardViolationCount,
        softViolations: r.evaluation.validation.metrics.softViolationCount,
        teacherGaps: r.evaluation.validation.metrics.totalTeacherGaps,
        elapsedMs: r.elapsedMs,
        optimalityGap: r.optimalityGap ?? null
      })),
      results: ranked
    };
  }

  /**
   * PASS 0–7 Aşamalı Çözüm Hattı.
   * Zorunlu güvenlik kuralları (çakışma, kapalı saat, kilitli ders) hiçbir aşamada esnetilmez.
   */
  async solveMultiPass(project, options = {}, callbacks = {}) {
    const relaxedLog = [];
    const baseInput = buildSolverInput(project, options);

    // PASS 1: Tüm zorunlu ve tercih kurallarıyla OR-Tools
    const pass1 = await this.solve(baseInput, { ...options, mode: SolverMode.SINGLE, engine: 'ortools', timeLimitSeconds: Math.min(15, options.timeLimitSeconds || 30) }, callbacks);
    if (pass1.bestResult?.evaluation?.validation?.isValid) {
      // PASS 6: Timefold iyileştirme (isteğe bağlı)
      if (options.enablePass6Improve !== false) {
        const improved = await this.solve(baseInput, { ...options, mode: SolverMode.HYBRID, engines: ['ortools', 'timefold'], timeLimitSeconds: Math.min(20, options.timeLimitSeconds || 30) }, callbacks);
        return { ...improved, relaxedLog };
      }
      return { ...pass1, relaxedLog };
    }

    // PASS 3: Esnek (non-HARD) kuralları geçici olarak devre dışı bırak ve raporla
    const nonHardRemoved = baseInput.constraints.filter(c => c.level !== 'HARD');
    if (nonHardRemoved.length > 0) {
      relaxedLog.push({
        pass: 3,
        relaxedConstraints: nonHardRemoved.map(c => ({ id: c.id, type: c.type, level: c.level }))
      });
      const pass3Input = {
        ...baseInput,
        constraints: baseInput.constraints.filter(c => c.level === 'HARD')
      };
      const pass3 = await this.solve(pass3Input, { ...options, mode: SolverMode.SEQUENTIAL, engines: ['ortools', 'choco', 'minizinc', 'highs'], timeLimitSeconds: options.timeLimitSeconds || 30 }, callbacks);
      return { ...pass3, relaxedLog };
    }

    // PASS 5: Alternatif motorlarla arama
    const pass5 = await this.solve(baseInput, { ...options, mode: SolverMode.SEQUENTIAL, engines: ['choco', 'minizinc', 'highs', 'scip', 'timefold'], timeLimitSeconds: options.timeLimitSeconds || 30 }, callbacks);
    return { ...pass5, relaxedLog };
  }
}
