import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, SolverStatus } from '../../packages/core-schema/src/index.js';
import { TimefoldAdapter } from '../../engines/timefold/adapter.js';
import { OrToolsAdapter } from '../../engines/ortools/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('Timefold Solver gömülü Java 21 sağlık kontrolü ve sürüm bilgisi', async () => {
  const adapter = new TimefoldAdapter();
  const hc = await adapter.healthCheck();
  assert.equal(hc.healthy, true, `Timefold sağlıklı değil: ${hc.error}`);
  assert.equal(hc.version, '1.17.0');
  assert.ok(hc.java && hc.java.startsWith('21'), `Gömülü Java 21 bekleniyor, gelen: ${hc.java}`);
});

test('Timefold Solver: Çok Küçük Okul (10 öğretmen, 5 şube, kilitli dersli) sıfırdan çözüm ve doğrulama', async () => {
  const adapter = new TimefoldAdapter();
  await adapter.healthCheck();

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  proj.placements['a_0:0'] = { day: 2, period: 1, roomId: null, lock: true };

  const input = buildSolverInput(proj, { timeLimitSeconds: 12 });
  const res = await adapter.solve(input);

  assert.equal(res.status, SolverStatus.FEASIBLE, `Beklenen FEASIBLE, gelen: ${res.status} (${res.rawStatus})`);
  assert.equal(res.evaluation.validation.isValid, true, `Doğrulayıcı ihlalleri: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.equal(res.evaluation.validation.metrics.hardViolationCount, 0);
  assert.equal(res.evaluation.validation.metrics.unassignedBlocksCount, 0);
  assert.equal(res.placements['a_0:0'].day, 2);
  assert.equal(res.placements['a_0:0'].period, 1);
  console.log(`  [Timefold very_small 10/5] status=${res.status}, raw=${res.rawStatus}, time=${res.elapsedMs}ms, quality=${res.evaluation.qualityScore}/100, gaps=${res.evaluation.validation.metrics.totalTeacherGaps}`);
});

test('Timefold Solver: OR-Tools başlangıç çözümünü (hibrit / warm start) iyileştirme ve kilitli dersi koruma', async () => {
  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  proj.placements['a_0:0'] = { day: 0, period: 0, roomId: null, lock: true };

  // 1. Önce OR-Tools ile geçerli başlangıç çözümü üret
  const orAdapter = new OrToolsAdapter();
  const input1 = buildSolverInput(proj, { timeLimitSeconds: 5 });
  const r1 = await orAdapter.solve(input1);
  assert.equal(r1.evaluation.validation.isValid, true);

  // 2. Başlangıç çözümünü hint olarak yerleştir (kilitli dersi koru)
  for (const [bid, pl] of Object.entries(r1.placements)) {
    proj.placements[bid] = { ...pl, lock: bid === 'a_0:0' };
  }

  // 3. Timefold ile iyileştirme çalıştır
  const tfAdapter = new TimefoldAdapter();
  await tfAdapter.healthCheck();
  const input2 = buildSolverInput(proj, { timeLimitSeconds: 8, useHints: true });
  const r2 = await tfAdapter.solve(input2);

  assert.equal(r2.evaluation.validation.isValid, true);
  assert.equal(r2.placements['a_0:0'].day, 0);
  assert.equal(r2.placements['a_0:0'].period, 0);
  console.log(`  [Hybrid OR-Tools->Timefold] OR quality=${r1.evaluation.qualityScore} -> TF quality=${r2.evaluation.qualityScore}, time=${r2.elapsedMs}ms`);
});
