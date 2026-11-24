import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSolverAdapter, SolverStatus } from '../../packages/multi-solver/src/base-adapter.js';
import { evaluateSolution } from '../../packages/validator/src/index.js';
import { resolvePythonBinary } from '../ortools/adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGED_SCRIPT = process.resourcesPath ? path.join(process.resourcesPath, 'engines', 'highs', 'solver_highs.py') : '';
const SOLVER_SCRIPT = (PACKAGED_SCRIPT && fs.existsSync(PACKAGED_SCRIPT)) ? PACKAGED_SCRIPT : path.join(__dirname, 'solver_highs.py');

export class HighsAdapter extends BaseSolverAdapter {
  constructor(options = {}) {
    super('highs', 'HiGHS (MIP/MILP)');
    this.pythonBin = options.pythonBin || resolvePythonBinary();
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      role: 'Karma tamsayılı doğrusal optimizasyon',
      supportsHints: false,
      supportsMultiCore: true,
      supportsOptimalityProof: true,
      supportsRooms: true,
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
      const proc = spawn(this.pythonBin, [SOLVER_SCRIPT, '--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      let out = '';
      let err = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      proc.stderr.on('data', d => { err += d.toString(); });
      proc.on('error', e => resolve({ healthy: false, engine: this.id, error: e.message }));
      proc.on('close', code => {
        if (code === 0) {
          const jsonLine = out.split(/\r?\n/).map(l => l.trim()).reverse().find(l => l.startsWith('{'));
          if (jsonLine) {
            try {
              const info = JSON.parse(jsonLine);
              this.version = info.version;
              resolve({ healthy: true, engine: this.id, version: info.version, python: info.python, binary: this.pythonBin });
              return;
            } catch {
              // fallthrough
            }
          }
        }
        resolve({ healthy: false, engine: this.id, error: err.trim() || `Exit code ${code}` });
      });
    });
  }

  async solve(solverInput, callbacks = {}) {
    const check = this.validateInput(solverInput);
    if (!check.valid) {
      return {
        engine: this.id,
        status: SolverStatus.ERROR,
        rawStatus: 'UNSUPPORTED_CONSTRAINT',
        errors: check.errors,
        placements: {},
        evaluation: evaluateSolution(solverInput, {}, SolverStatus.ERROR)
      };
    }

    this.cancelled = false;
    this.bestSolution = null;
    this.progress = {
      state: 'running',
      elapsedMs: 0,
      solutionsFound: 0,
      objectiveValue: null,
      bestBound: null,
      optimalityGap: null,
      message: 'HiGHS MILP başlatıldı'
    };

    const t0 = Date.now();
    return new Promise(resolve => {
      const proc = spawn(this.pythonBin, [SOLVER_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      this.activeProcess = proc;

      let buffer = '';
      let stderr = '';
      let finalPayload = null;

      proc.stdout.on('data', chunk => {
        buffer += chunk.toString('utf8');
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'FINAL_RESULT') finalPayload = msg;
          } catch {
            // ignore
          }
        }
      });

      proc.stderr.on('data', d => { stderr += d.toString('utf8'); });

      proc.on('error', err => {
        this.activeProcess = null;
        this.progress.state = 'error';
        resolve({
          engine: this.id,
          status: SolverStatus.ERROR,
          rawStatus: 'SPAWN_ERROR',
          elapsedMs: Date.now() - t0,
          error: err.message,
          placements: {},
          evaluation: evaluateSolution(solverInput, {}, SolverStatus.ERROR)
        });
      });

      proc.on('close', code => {
        this.activeProcess = null;
        const elapsedMs = Date.now() - t0;

        if (this.cancelled) {
          this.progress.state = 'cancelled';
          resolve({
            engine: this.id,
            status: SolverStatus.CANCELLED,
            rawStatus: 'CANCELLED',
            elapsedMs,
            placements: {},
            evaluation: evaluateSolution(solverInput, {}, SolverStatus.CANCELLED)
          });
          return;
        }

        if (!finalPayload) {
          this.progress.state = 'error';
          resolve({
            engine: this.id,
            status: SolverStatus.ERROR,
            rawStatus: `EXIT_${code}`,
            elapsedMs,
            error: stderr.trim() || `HiGHS beklenmedik şekilde sonlandı (kod ${code})`,
            placements: {},
            evaluation: evaluateSolution(solverInput, {}, SolverStatus.ERROR)
          });
          return;
        }

        const placements = finalPayload.placements || {};
        const evaluation = evaluateSolution(solverInput, placements, finalPayload.status);
        this.statistics = finalPayload.statistics || {};
        this.progress = {
          state: 'finished',
          elapsedMs: finalPayload.elapsedMs ?? elapsedMs,
          solutionsFound: finalPayload.solutionsFound ?? 0,
          objectiveValue: finalPayload.objectiveValue ?? null,
          bestBound: finalPayload.bestBound ?? null,
          optimalityGap: finalPayload.optimalityGap ?? null,
          message: evaluation.validation.verifiedStatus
        };
        if (evaluation.validation.isHardValid) {
          this.bestSolution = { placements, evaluation };
        }
        if (callbacks.onProgress) callbacks.onProgress(this.getProgress());

        resolve({
          engine: this.id,
          version: this.version,
          status: evaluation.validation.verifiedStatus,
          rawStatus: finalPayload.rawStatus,
          elapsedMs: finalPayload.elapsedMs ?? elapsedMs,
          objectiveValue: finalPayload.objectiveValue ?? null,
          bestBound: finalPayload.bestBound ?? null,
          optimalityGap: finalPayload.optimalityGap ?? null,
          statistics: this.statistics,
          placements,
          evaluation
        });
      });

      proc.stdin.on('error', () => {});
      proc.stdin.write(JSON.stringify(solverInput));
      proc.stdin.end();
    });
  }
}
