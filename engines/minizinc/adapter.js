import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSolverAdapter, SolverStatus } from '../../packages/multi-solver/src/base-adapter.js';
import { evaluateSolution } from '../../packages/validator/src/index.js';
import { generateDzn } from './dzn-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MODEL_PATH = path.join(__dirname, 'model.mzn');

/**
 * Aynı motorun doğrudan ve MiniZinc üzerinden çalıştırılmasını iki bağımsız motor gibi
 * raporlamamak için arka plan motoru eşleme tablosu.
 */
const DIRECT_ENGINE_EQUIVALENTS = {
  'cp-sat': 'ortools',
  'ortools': 'ortools',
  'com.google.ortools.sat': 'ortools',
  'highs': 'highs',
  'scip': 'scip'
};

export function resolveMiniZincBinary() {
  const candidates = [
    process.env.EVRAKPLUS_MINIZINC,
    path.join(PROJECT_ROOT, 'resources', 'engines', 'minizinc', 'minizinc.exe'),
    path.join(PROJECT_ROOT, 'resources', 'engines', 'minizinc', 'bin', 'minizinc')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'minizinc';
}

export class MiniZincAdapter extends BaseSolverAdapter {
  constructor(options = {}) {
    const backend = (options.backendSolver || 'gecode').toLowerCase();
    super('minizinc', `MiniZinc (${backend})`);
    this.minizincBin = options.minizincBin || resolveMiniZincBinary();
    this.backendSolver = backend;
    this.availableSolvers = [];
  }

  /**
   * MiniZinc üzerinden hangi gerçek çözüm motorunun çalıştığını şeffaf biçimde raporlar.
   */
  getBackendDisclosure() {
    const dup = DIRECT_ENGINE_EQUIVALENTS[this.backendSolver] || null;
    return {
      modelingLayer: 'MiniZinc',
      backendSolver: this.backendSolver,
      displayLabel: `MiniZinc → ${this.backendSolver}`,
      isIndependentFromDirectEngines: dup === null,
      duplicatesDirectEngine: dup
    };
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      role: 'Alternatif modelleme ve çözüm motorlarına erişim',
      backendDisclosure: this.getBackendDisclosure(),
      supportsHints: false,
      supportsMultiCore: this.backendSolver === 'gecode',
      supportsOptimalityProof: false,
      supportsRooms: false,
      supportsBuildingTransitions: false,
      supportsParallelGroups: true,
      supportsCancel: true,
      supportedConstraints: [
        'subject_diff_days',
        'subject_forbid_periods',
        'subject_pair_diff_day',
        'block_no_across_lunch',
        'teacher_class_limit',
        'parallel_group_sync'
      ]
    };
  }

  async healthCheck() {
    return new Promise(resolve => {
      const proc = spawn(this.minizincBin, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      let out = '';
      let err = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      proc.stderr.on('data', d => { err += d.toString(); });
      proc.on('error', e => resolve({ healthy: false, engine: this.id, error: e.message }));
      proc.on('close', code => {
        if (code !== 0) {
          resolve({ healthy: false, engine: this.id, error: err.trim() || `Exit code ${code}` });
          return;
        }
        const m = out.match(/version\s+([0-9.]+)/i);
        this.version = m ? m[1] : out.trim().split('\n')[0];

        // Kurulu gerçek çözücüleri sorgula
        const sp = spawn(this.minizincBin, ['--solvers-json'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });
        let sOut = '';
        sp.stdout.on('data', d => { sOut += d.toString(); });
        sp.on('close', () => {
          try {
            const parsed = JSON.parse(sOut);
            this.availableSolvers = parsed.map(s => ({ id: s.id, name: s.name, version: s.version, tags: s.tags || [] }));
          } catch {
            this.availableSolvers = [];
          }
          resolve({
            healthy: true,
            engine: this.id,
            version: this.version,
            binary: this.minizincBin,
            backendDisclosure: this.getBackendDisclosure(),
            availableSolvers: this.availableSolvers
          });
        });
      });
    });
  }

  async solve(solverInput, callbacks = {}) {
    const check = this.validateInput(solverInput);
    if (!check.valid) {
      return {
        engine: this.id,
        backendDisclosure: this.getBackendDisclosure(),
        status: SolverStatus.ERROR,
        rawStatus: 'UNSUPPORTED_CONSTRAINT',
        errors: check.errors,
        placements: {},
        evaluation: evaluateSolution(solverInput, {}, SolverStatus.ERROR)
      };
    }

    const gen = generateDzn(solverInput);
    if (gen.infeasible) {
      return {
        engine: this.id,
        backendDisclosure: this.getBackendDisclosure(),
        status: SolverStatus.INFEASIBLE,
        rawStatus: 'EMPTY_DOMAIN',
        elapsedMs: 0,
        message: gen.reason,
        placements: {},
        evaluation: evaluateSolution(solverInput, {}, SolverStatus.INFEASIBLE)
      };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evrakplus-mzn-'));
    const dznPath = path.join(tmpDir, 'data.dzn');
    fs.writeFileSync(dznPath, gen.dzn, 'utf8');

    this.cancelled = false;
    this.bestSolution = null;
    this.progress = {
      state: 'running',
      elapsedMs: 0,
      solutionsFound: 0,
      objectiveValue: null,
      bestBound: null,
      optimalityGap: null,
      message: `MiniZinc → ${this.backendSolver} başlatıldı`
    };

    const timeLimitMs = Math.max(1000, Math.round((solverInput.options?.timeLimitSeconds || 15) * 1000));
    const args = ['--solver', this.backendSolver, '--time-limit', String(timeLimitMs)];
    if (this.backendSolver === 'gecode') args.push('-p', '2');
    args.push(MODEL_PATH, dznPath);

    const t0 = Date.now();
    const P = solverInput.school.periodsPerDay;

    return new Promise(resolve => {
      const proc = spawn(this.minizincBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      this.activeProcess = proc;

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString('utf8'); });
      proc.stderr.on('data', d => { stderr += d.toString('utf8'); });

      const cleanup = () => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      };

      proc.on('error', err => {
        cleanup();
        this.activeProcess = null;
        this.progress.state = 'error';
        resolve({
          engine: this.id,
          backendDisclosure: this.getBackendDisclosure(),
          status: SolverStatus.ERROR,
          rawStatus: 'SPAWN_ERROR',
          elapsedMs: Date.now() - t0,
          error: err.message,
          placements: {},
          evaluation: evaluateSolution(solverInput, {}, SolverStatus.ERROR)
        });
      });

      proc.on('close', code => {
        cleanup();
        this.activeProcess = null;
        const elapsedMs = Date.now() - t0;

        if (this.cancelled) {
          this.progress.state = 'cancelled';
          resolve({
            engine: this.id,
            backendDisclosure: this.getBackendDisclosure(),
            status: SolverStatus.CANCELLED,
            rawStatus: 'CANCELLED',
            elapsedMs,
            placements: {},
            evaluation: evaluateSolution(solverInput, {}, SolverStatus.CANCELLED)
          });
          return;
        }

        let placements = {};
        let rawStatus = 'UNKNOWN';
        let mappedStatus = SolverStatus.UNKNOWN;

        if (stdout.includes('=====UNSATISFIABLE=====')) {
          rawStatus = 'UNSATISFIABLE';
          mappedStatus = SolverStatus.INFEASIBLE;
        } else {
          const jsonLines = stdout.split(/\r?\n/).filter(l => l.trim().startsWith('{"starts":'));
          if (jsonLines.length > 0) {
            try {
              const parsed = JSON.parse(jsonLines[jsonLines.length - 1]);
              const starts = parsed.starts || [];
              solverInput.blocks.forEach((b, i) => {
                const s = starts[i];
                if (Number.isInteger(s)) {
                  placements[b.blockId] = { day: Math.floor(s / P), period: s % P, roomId: b.roomId || null };
                }
              });
              rawStatus = 'SATISFIED';
              mappedStatus = SolverStatus.FEASIBLE;
            } catch {
              rawStatus = 'PARSE_ERROR';
              mappedStatus = SolverStatus.ERROR;
            }
          } else if (stdout.includes('=====UNKNOWN=====') || elapsedMs >= timeLimitMs * 0.9) {
            rawStatus = 'UNKNOWN';
            mappedStatus = SolverStatus.TIME_LIMIT;
          } else if (code !== 0) {
            rawStatus = `EXIT_${code}`;
            mappedStatus = SolverStatus.ERROR;
          }
        }

        const evaluation = evaluateSolution(solverInput, placements, mappedStatus);
        this.progress = {
          state: 'finished',
          elapsedMs,
          solutionsFound: Object.keys(placements).length > 0 ? 1 : 0,
          objectiveValue: null,
          bestBound: null,
          optimalityGap: null,
          message: `${this.getBackendDisclosure().displayLabel}: ${evaluation.validation.verifiedStatus}`
        };
        if (evaluation.validation.isHardValid) {
          this.bestSolution = { placements, evaluation };
        }
        if (callbacks.onProgress) callbacks.onProgress(this.getProgress());

        resolve({
          engine: this.id,
          version: this.version,
          backendDisclosure: this.getBackendDisclosure(),
          status: evaluation.validation.verifiedStatus,
          rawStatus,
          elapsedMs,
          error: mappedStatus === SolverStatus.ERROR ? stderr.trim() : undefined,
          placements,
          evaluation
        });
      });
    });
  }
}
