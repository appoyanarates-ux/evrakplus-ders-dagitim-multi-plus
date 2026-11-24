import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSolverAdapter, SolverStatus } from '../../packages/multi-solver/src/base-adapter.js';
import { evaluateSolution } from '../../packages/validator/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGED_SCRIPT = process.resourcesPath ? path.join(process.resourcesPath, 'engines', 'ortools', 'solver_cpsat.py') : '';
const SOLVER_SCRIPT = (PACKAGED_SCRIPT && fs.existsSync(PACKAGED_SCRIPT)) ? PACKAGED_SCRIPT : path.join(__dirname, 'solver_cpsat.py');

/**
 * Gömülü Python çalışma ortamını öncelik sırasına göre bulur:
 * 1) resources/runtime/python/python.exe (EXE paketindeki gömülü Python)
 * 2) .venv/Scripts/python.exe (geliştirme sanal ortamı)
 * 3) Ortam değişkeni EVRAKPLUS_PYTHON
 * 4) Sistem PATH (python / python3)
 */
export function resolvePythonBinary() {
  const candidates = [
    process.env.EVRAKPLUS_PYTHON,
    path.join(PROJECT_ROOT, 'resources', 'runtime', 'python', 'python.exe'),
    path.join(PROJECT_ROOT, 'resources', 'runtime', 'python', 'bin', 'python3'),
    path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python3')
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export class OrToolsAdapter extends BaseSolverAdapter {
  constructor(options = {}) {
    super('ortools', 'Google OR-Tools CP-SAT');
    this.pythonBin = options.pythonBin || resolvePythonBinary();
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      role: 'Ana dağıtım motoru',
      supportsHints: true,
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
      proc.on('error', e => {
        resolve({ healthy: false, engine: this.id, error: e.message });
      });
      proc.on('close', code => {
        if (code === 0) {
          try {
            const info = JSON.parse(out.trim());
            this.version = info.version;
            resolve({ healthy: true, engine: this.id, version: info.version, python: info.python, binary: this.pythonBin });
            return;
          } catch {
            // fallthrough
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
      message: 'OR-Tools CP-SAT başlatıldı'
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
            if (msg.type === 'INTERMEDIATE_SOLUTION') {
              const ev = evaluateSolution(solverInput, msg.placements, SolverStatus.FEASIBLE);
              this.progress = {
                state: 'running',
                elapsedMs: msg.elapsedMs,
                solutionsFound: msg.solutionsFound,
                objectiveValue: msg.objectiveValue,
                bestBound: msg.bestBound,
                optimalityGap: (msg.objectiveValue != null && msg.bestBound != null && msg.objectiveValue > 0)
                  ? Math.round(Math.abs(msg.objectiveValue - msg.bestBound) / msg.objectiveValue * 10000) / 100
                  : null,
                message: `Ara çözüm #${msg.solutionsFound} (kalite: ${ev.qualityScore})`
              };
              if (ev.validation.isHardValid) {
                this.bestSolution = { placements: msg.placements, evaluation: ev };
              }
              if (callbacks.onProgress) callbacks.onProgress(this.getProgress());
              if (callbacks.onIntermediateSolution && this.bestSolution) {
                callbacks.onIntermediateSolution(this.bestSolution);
              }
            } else if (msg.type === 'FINAL_RESULT') {
              finalPayload = msg;
            }
          } catch {
            // ignore non-json lines
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
          const bestPl = this.bestSolution?.placements || {};
          const ev = evaluateSolution(solverInput, bestPl, SolverStatus.CANCELLED);
          this.progress.state = 'cancelled';
          resolve({
            engine: this.id,
            status: SolverStatus.CANCELLED,
            rawStatus: 'CANCELLED',
            elapsedMs,
            placements: bestPl,
            evaluation: ev
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
            error: stderr.trim() || `OR-Tools beklenmedik şekilde sonlandı (kod ${code})`,
            placements: this.bestSolution?.placements || {},
            evaluation: evaluateSolution(solverInput, this.bestSolution?.placements || {}, SolverStatus.ERROR)
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
          optimalityGap: (finalPayload.objectiveValue != null && finalPayload.bestBound != null && finalPayload.objectiveValue > 0)
            ? Math.round(Math.abs(finalPayload.objectiveValue - finalPayload.bestBound) / finalPayload.objectiveValue * 10000) / 100
            : 0,
          message: evaluation.validation.verifiedStatus
        };
        if (evaluation.validation.isHardValid) {
          this.bestSolution = { placements, evaluation };
        }

        resolve({
          engine: this.id,
          version: this.version,
          status: evaluation.validation.verifiedStatus,
          rawStatus: finalPayload.rawStatus,
          elapsedMs: finalPayload.elapsedMs ?? elapsedMs,
          objectiveValue: finalPayload.objectiveValue ?? null,
          bestBound: finalPayload.bestBound ?? null,
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
