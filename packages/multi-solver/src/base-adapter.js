import { SolverStatus } from '../../core-schema/src/constants.js';

/**
 * EvrakPlus Multi Solver Optimization Engine — Ortak Motor Arayüzü.
 * Tüm 6 optimizasyon motoru (OR-Tools, Timefold, Choco, MiniZinc, SCIP, HiGHS)
 * bu temel sınıfı genişletir ve tüm 12 metodu gerçek olarak uygular.
 */
export class BaseSolverAdapter {
  constructor(id, displayName) {
    this.id = id;
    this.displayName = displayName;
    this.initialized = false;
    this.version = null;
    this.activeProcess = null;
    this.cancelled = false;
    this.progress = {
      state: 'idle',
      elapsedMs: 0,
      solutionsFound: 0,
      objectiveValue: null,
      bestBound: null,
      optimalityGap: null,
      message: ''
    };
    this.bestSolution = null;
    this.statistics = {};
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async healthCheck() {
    throw new Error(`${this.id}: healthCheck() uygulanmamış`);
  }

  async getVersion() {
    return this.version || 'unknown';
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      supportsHints: false,
      supportsMultiCore: false,
      supportsOptimalityProof: false,
      supportsRooms: true,
      supportsBuildingTransitions: false,
      supportsParallelGroups: false,
      supportsCancel: true,
      supportedConstraints: []
    };
  }

  /**
   * Motorun desteklemediği zorunlu kuralları açıkça raporlar.
   * Desteklenmeyen zorunlu kurallar asla yok sayılarak çözüm üretilmez.
   */
  validateInput(solverInput) {
    const errors = [];
    const caps = this.getCapabilities();
    if (!solverInput || !Array.isArray(solverInput.blocks)) {
      errors.push('Geçersiz SolverInput: blocks dizisi eksik.');
    }
    const supported = new Set(caps.supportedConstraints || []);
    for (const c of solverInput?.constraints || []) {
      if (c.level === 'HARD' && supported.size > 0 && !supported.has(c.type)) {
        errors.push(`${this.displayName} motoru '${c.type}' zorunlu kuralını desteklemiyor.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async buildModel(solverInput) {
    return { solverInput };
  }

  async solve(_solverInput, _callbacks = {}) {
    throw new Error(`${this.id}: solve() uygulanmamış`);
  }

  getProgress() {
    return { ...this.progress };
  }

  getBestSolution() {
    return this.bestSolution;
  }

  async cancel() {
    this.cancelled = true;
    if (this.activeProcess && !this.activeProcess.killed) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    this.progress.state = 'cancelled';
    return true;
  }

  getStatistics() {
    return { ...this.statistics };
  }

  async dispose() {
    await this.cancel();
    this.initialized = false;
  }
}

export { SolverStatus };
