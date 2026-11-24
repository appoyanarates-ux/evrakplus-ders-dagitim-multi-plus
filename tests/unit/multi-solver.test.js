import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiSolverEngine, SolverMode } from '../../packages/multi-solver/src/index.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('MultiSolverEngine: 6 motorun tamamı sağlık kontrolünden geçmeli', async () => {
  const engine = new MultiSolverEngine();
  const health = await engine.healthCheckAll();
  const ids = Object.keys(health);
  assert.deepEqual(ids, ['ortools', 'timefold', 'choco', 'minizinc', 'scip', 'highs']);
  for (const [id, info] of Object.entries(health)) {
    assert.equal(info.healthy, true, `${id} sağlıklı değil: ${info.error}`);
    console.log(`  [Health] ${id}: v${info.version} OK`);
  }
});

test('MultiSolverEngine: Paralel mod (CPU/RAM kontrollü) çoklu motor yarışı ve karşılaştırma tablosu', async () => {
  const engine = new MultiSolverEngine();
  const proj = generateRealisticSchool('very_small', { withClosedDays: false });

  const safeConc = engine.computeSafeConcurrency(3);
  assert.ok(safeConc >= 1 && safeConc <= 4);

  const res = await engine.solve(proj, {
    mode: SolverMode.PARALLEL,
    engines: ['ortools', 'choco', 'minizinc', 'highs'],
    timeLimitSeconds: 20,
    perEngineSeconds: 12,
    maxConcurrency: 2
  });

  assert.equal(res.bestResult.evaluation.validation.isValid, true);
  assert.equal(res.comparison.length, 4);
  for (const row of res.comparison) {
    assert.equal(row.isValid, true, `${row.engine} geçersiz sonuç üretti`);
    console.log(`  [Parallel] ${row.engine}: status=${row.status}, quality=${row.qualityScore}/100, time=${row.elapsedMs}ms, gaps=${row.teacherGaps}`);
  }
  // Sıralama en yüksek kalite puanından düşüğe doğru olmalı
  assert.ok(res.comparison[0].qualityScore >= res.comparison[res.comparison.length - 1].qualityScore);
});

test('MultiSolverEngine: Akıllı otomatik mod (Hibrit OR-Tools -> Timefold) en iyi geçerli çözümü seçmeli', async () => {
  const engine = new MultiSolverEngine();
  const proj = generateRealisticSchool('very_small', { withClosedDays: false });

  const res = await engine.solve(proj, {
    mode: SolverMode.SMART,
    timeLimitSeconds: 18
  });

  assert.equal(res.mode, SolverMode.HYBRID);
  assert.equal(res.bestResult.evaluation.validation.isValid, true);
  assert.ok(res.comparison.length === 2, 'Hibrit modda 2 motor (OR-Tools + Timefold) çalışmalı');
  console.log(`  [Smart/Hybrid] winner=${res.bestResult.engine}, quality=${res.bestResult.evaluation.qualityScore}/100, totalTime=${res.elapsedMs}ms`);
});
