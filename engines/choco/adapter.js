import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSolverAdapter, SolverStatus } from '../../packages/multi-solver/src/base-adapter.js';
import { evaluateSolution, compareEvaluations } from '../../packages/validator/src/index.js';
import { resolveJavaBinary } from '../timefold/adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export function resolveChocoJar() {
  const candidates = [
    path.join(PROJECT_ROOT, 'resources', 'engines', 'choco', 'evrakplus-choco.jar'),
    path.join(__dirname, 'target', 'evrakplus-choco.jar')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export class ChocoAdapter extends BaseSolverAdapter {
  constructor(options = {}) {
    super('choco', 'Choco Solver');
    this.javaBin = options.javaBin || resolveJavaBinary();
    this.jarPath = options.jarPath || resolveChocoJar();
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      role: 'Karmaşık kısıtların çözülmesi',
      supportsHints: false,
      supportsMultiCore: false,
      supportsOptimalityProof: false,
      supportsRooms: true,
      supportsBuildingTransitions: true,
      supportsParallelGroups: true,
      supportsAlternatives: true,
      supportsCancel: true,
      supportedConstraints: [
        'subject_diff_days',
        'subject_forbid_periods',
        'subject_pair_diff_day',
        'block_no_across_lunch',
        'teacher_class_limit',
        'parallel_group_sync',
        'teacher_building_transition'
      ]
    };
  }

  async healthCheck() {
    if (!fs.existsSync(this.jarPath)) {
      return { healthy: false, engine: this.id, error: `JAR bulunamadı: ${this.jarPath}` };
    }
    return new Promise(resolve => {
      const proc = spawn(this.javaBin, ['-jar', this.jarPath, '--version'], {
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
          try {
            const info = JSON.parse(out.trim());
            this.version = info.version;
            resolve({ healthy: true, engine: this.id, version: info.version, java: info.java, binary: this.javaBin, jar: this.jarPath });
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
        alternatives: [],
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
      message: 'Choco Solver başlatıldı'
    };

    const t0 = Date.now();
    return new Promise(resolve => {
      const proc = spawn(this.javaBin, ['-Xmx1024m', '-jar', this.jarPath], {
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
                objectiveValue: null,
                bestBound: null,
                optimalityGap: null,
                message: `Alternatif çözüm #${msg.solutionsFound} (kalite: ${ev.qualityScore})`
              };
              if (ev.validation.isHardValid && (!this.bestSolution || compareEvaluations(ev, this.bestSolution.evaluation) > 0)) {
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
          alternatives: [],
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
            alternatives: [],
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
            error: stderr.trim() || `Choco beklenmedik şekilde sonlandı (kod ${code})`,
            placements: this.bestSolution?.placements || {},
            alternatives: [],
            evaluation: evaluateSolution(solverInput, this.bestSolution?.placements || {}, SolverStatus.ERROR)
          });
          return;
        }

        // Tüm alternatifleri bağımsız doğrulayıcıdan geçir ve en iyi geçerli olanı seç
        const rawAlts = Array.isArray(finalPayload.alternatives) ? finalPayload.alternatives : [];
        const evaluatedAlts = rawAlts.map(pl => ({
          placements: pl,
          evaluation: evaluateSolution(solverInput, pl, finalPayload.status)
        })).sort((a, b) => compareEvaluations(b.evaluation, a.evaluation));

        const best = evaluatedAlts[0] || {
          placements: finalPayload.placements || {},
          evaluation: evaluateSolution(solverInput, finalPayload.placements || {}, finalPayload.status)
        };

        this.statistics = {
          constraintImpact: finalPayload.constraintImpact || null,
          alternativesCount: evaluatedAlts.length
        };
        this.progress = {
          state: 'finished',
          elapsedMs: finalPayload.elapsedMs ?? elapsedMs,
          solutionsFound: evaluatedAlts.length,
          objectiveValue: null,
          bestBound: null,
          optimalityGap: null,
          message: best.evaluation.validation.verifiedStatus
        };
        if (best.evaluation.validation.isHardValid) {
          this.bestSolution = best;
        }

        resolve({
          engine: this.id,
          version: this.version,
          status: best.evaluation.validation.verifiedStatus,
          rawStatus: finalPayload.rawStatus,
          elapsedMs: finalPayload.elapsedMs ?? elapsedMs,
          constraintImpact: finalPayload.constraintImpact || null,
          statistics: this.statistics,
          placements: best.placements,
          alternatives: evaluatedAlts,
          evaluation: best.evaluation
        });
      });

      proc.stdin.on('error', () => {});
      proc.stdin.write(JSON.stringify(solverInput));
      proc.stdin.end();
    });
  }
}
