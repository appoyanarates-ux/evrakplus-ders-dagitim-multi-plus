import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, createBlankProject, SolverStatus } from '../../packages/core-schema/src/index.js';
import { ScipAdapter } from '../../engines/scip/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('SCIP MILP sağlık kontrolü ve gerçek sürüm bilgisi', async () => {
  const adapter = new ScipAdapter();
  const hc = await adapter.healthCheck();
  assert.equal(hc.healthy, true, `SCIP sağlıklı değil: ${hc.error}`);
  assert.ok(hc.version, 'SCIP sürümü okunamadı');
});

test('SCIP MILP: Çok Küçük Okul (10/5, kilitli dersli) gerçek çözümü, optimality gap ve bağımsız doğrulama', async () => {
  const adapter = new ScipAdapter();
  await adapter.healthCheck();

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  proj.placements['a_0:0'] = { day: 4, period: 1, roomId: null, lock: true };
  const input = buildSolverInput(proj, { timeLimitSeconds: 20 });

  const res = await adapter.solve(input);
  assert.ok([SolverStatus.OPTIMAL, SolverStatus.FEASIBLE].includes(res.status), `Beklenen OPTIMAL/FEASIBLE, gelen: ${res.status} (${res.rawStatus}) ${res.error || ''}`);
  assert.equal(res.evaluation.validation.isValid, true, `Doğrulayıcı ihlalleri: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.equal(res.placements['a_0:0'].day, 4);
  assert.equal(res.placements['a_0:0'].period, 1);
  assert.notEqual(res.objectiveValue, null, 'Objective value raporlanmalı');
  console.log(`  [SCIP very_small 10/5] status=${res.status}, time=${res.elapsedMs}ms, obj=${res.objectiveValue}, bound=${res.bestBound}, gap=${res.optimalityGap}%, quality=${res.evaluation.qualityScore}/100`);
});

test('SCIP MILP: Çözümsüz (INFEASIBLE) veride gerçek INFEASIBLE durumu dönmeli', async () => {
  const adapter = new ScipAdapter();
  const p = createBlankProject({ school: { daysPerWeek: 1, periodsPerDay: 2 } });
  p.teachers.push({ id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'Tek Öğr', dmax: 2, wmax: 2, av: {} });
  p.classes.push({ id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '5/A', grade: 5, dmax: 2, closed: [] });
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'MAT', hours: 2, pattern: '2', teacherId: 't1', kind: 'zorunlu' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'TRK', hours: 2, pattern: '2', teacherId: 't1', kind: 'zorunlu' }
  );
  const input = buildSolverInput(p, { timeLimitSeconds: 5 });
  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.INFEASIBLE);
  assert.equal(res.evaluation.validation.isValid, false);
});
