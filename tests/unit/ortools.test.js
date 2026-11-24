import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, createBlankProject, SolverStatus } from '../../packages/core-schema/src/index.js';
import { OrToolsAdapter } from '../../engines/ortools/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('OR-Tools CP-SAT sağlık kontrolü ve gerçek sürüm bilgisi', async () => {
  const adapter = new OrToolsAdapter();
  const hc = await adapter.healthCheck();
  assert.equal(hc.healthy, true, `OR-Tools sağlıklı değil: ${hc.error}`);
  assert.ok(hc.version && hc.version.includes('.'), `Geçersiz sürüm: ${hc.version}`);
  assert.equal(await adapter.getVersion(), hc.version);
});

test('OR-Tools CP-SAT: Çok Küçük Okul (10 öğretmen, 5 şube) gerçek çözümü ve bağımsız doğrulaması', async () => {
  const adapter = new OrToolsAdapter();
  await adapter.healthCheck();

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  // İlk bloğu kilitleyelim ve korunduğunu doğrulayalım
  proj.placements['a_0:0'] = { day: 1, period: 2, roomId: null, lock: true };

  const input = buildSolverInput(proj, { timeLimitSeconds: 15, numWorkers: 4 });
  let intermediateCount = 0;

  const res = await adapter.solve(input, {
    onIntermediateSolution: () => { intermediateCount++; }
  });

  assert.ok([SolverStatus.OPTIMAL, SolverStatus.FEASIBLE].includes(res.status), `Beklenen OPTIMAL/FEASIBLE, gelen: ${res.status}`);
  assert.equal(res.evaluation.validation.isValid, true, `Doğrulayıcı ihlalleri: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.equal(res.evaluation.validation.metrics.hardViolationCount, 0);
  assert.equal(res.evaluation.validation.metrics.unassignedBlocksCount, 0);
  assert.equal(res.placements['a_0:0'].day, 1);
  assert.equal(res.placements['a_0:0'].period, 2);
  assert.ok(intermediateCount >= 1, 'En az 1 ara çözüm akışı bekleniyor');
  assert.ok(res.evaluation.qualityScore >= 70, `Kalite puanı beklenenden düşük: ${res.evaluation.qualityScore}`);
  console.log(`  [OR-Tools very_small 10/5] status=${res.status}, time=${res.elapsedMs}ms, quality=${res.evaluation.qualityScore}/100, gaps=${res.evaluation.validation.metrics.totalTeacherGaps}`);
});

test('OR-Tools CP-SAT: Küçük Okul (25 öğretmen, 12 şube, kapalı günlü) gerçek çözümü', async () => {
  const adapter = new OrToolsAdapter();
  await adapter.healthCheck();

  const proj = generateRealisticSchool('small', { withClosedDays: true });
  const input = buildSolverInput(proj, { timeLimitSeconds: 20, numWorkers: 4 });
  const res = await adapter.solve(input);

  assert.ok([SolverStatus.OPTIMAL, SolverStatus.FEASIBLE].includes(res.status), `Beklenen OPTIMAL/FEASIBLE, gelen: ${res.status}`);
  assert.equal(res.evaluation.validation.isValid, true);
  assert.equal(res.evaluation.validation.metrics.hardViolationCount, 0);
  assert.equal(res.evaluation.validation.metrics.unassignedBlocksCount, 0);
  console.log(`  [OR-Tools small 25/12] status=${res.status}, time=${res.elapsedMs}ms, quality=${res.evaluation.qualityScore}/100, gaps=${res.evaluation.validation.metrics.totalTeacherGaps}`);
});

test('OR-Tools CP-SAT: Çözümsüz (INFEASIBLE) veride gerçek INFEASIBLE durumu dönmeli', async () => {
  const adapter = new OrToolsAdapter();
  const p = createBlankProject({ school: { daysPerWeek: 1, periodsPerDay: 2 } });
  p.teachers.push({ id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'Tek Öğr', dmax: 2, wmax: 2, av: {} });
  p.classes.push({ id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '5/A', grade: 5, dmax: 2, closed: [] });
  // 1 günde 2 saat var ama 4 saatlik ders atanmış -> kesinlikle çözümsüz
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'MAT', hours: 2, pattern: '2', teacherId: 't1', kind: 'zorunlu' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'TRK', hours: 2, pattern: '2', teacherId: 't1', kind: 'zorunlu' }
  );
  const input = buildSolverInput(p, { timeLimitSeconds: 5 });
  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.INFEASIBLE);
  assert.equal(res.evaluation.validation.isValid, false);
});
