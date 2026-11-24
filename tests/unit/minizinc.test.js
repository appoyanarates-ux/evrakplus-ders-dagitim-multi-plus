import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, SolverStatus } from '../../packages/core-schema/src/index.js';
import { MiniZincAdapter } from '../../engines/minizinc/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('MiniZinc CLI sağlık kontrolü, kurulu çözücü listesi ve motor şeffaflığı', async () => {
  const adapter = new MiniZincAdapter({ backendSolver: 'gecode' });
  const hc = await adapter.healthCheck();
  assert.equal(hc.healthy, true, `MiniZinc sağlıklı değil: ${hc.error}`);
  assert.ok(hc.version, 'MiniZinc sürümü okunamadı');
  assert.ok(hc.availableSolvers.some(s => s.id.includes('gecode')), 'Gecode çözücüsü bulunamadı');
  assert.equal(hc.backendDisclosure.isIndependentFromDirectEngines, true);
  assert.equal(hc.backendDisclosure.duplicatesDirectEngine, null);

  // OR-Tools seçildiğinde aynı motorun duplikasyonu açıkça bildirilmeli
  const mznOr = new MiniZincAdapter({ backendSolver: 'cp-sat' });
  const disc = mznOr.getBackendDisclosure();
  assert.equal(disc.isIndependentFromDirectEngines, false);
  assert.equal(disc.duplicatesDirectEngine, 'ortools');
});

test('MiniZinc (Gecode): Çok Küçük Okul (10/5, kilitli dersli) gerçek çözümü ve doğrulaması', async () => {
  const adapter = new MiniZincAdapter({ backendSolver: 'gecode' });
  await adapter.healthCheck();

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  proj.placements['a_0:0'] = { day: 3, period: 2, roomId: null, lock: true };
  const input = buildSolverInput(proj, { timeLimitSeconds: 15 });

  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.FEASIBLE, `Beklenen FEASIBLE, gelen: ${res.status} (${res.rawStatus}) ${res.error || ''}`);
  assert.equal(res.evaluation.validation.isValid, true, `Doğrulayıcı ihlalleri: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.equal(res.placements['a_0:0'].day, 3);
  assert.equal(res.placements['a_0:0'].period, 2);
  console.log(`  [MiniZinc->Gecode very_small 10/5] status=${res.status}, time=${res.elapsedMs}ms, quality=${res.evaluation.qualityScore}/100`);
});

test('MiniZinc (Chuffed): Çok Küçük Okul (10/5) gerçek çözümü ve doğrulaması', async () => {
  const adapter = new MiniZincAdapter({ backendSolver: 'chuffed' });
  const hc = await adapter.healthCheck();
  if (!hc.availableSolvers.some(s => s.id.includes('chuffed'))) {
    console.log('  [MiniZinc->Chuffed] bu kurulumda chuffed yok, atlandı.');
    return;
  }

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  const input = buildSolverInput(proj, { timeLimitSeconds: 15 });

  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.FEASIBLE, `Beklenen FEASIBLE, gelen: ${res.status} (${res.rawStatus})`);
  assert.equal(res.evaluation.validation.isValid, true);
  console.log(`  [MiniZinc->Chuffed very_small 10/5] status=${res.status}, time=${res.elapsedMs}ms, quality=${res.evaluation.qualityScore}/100`);
});
