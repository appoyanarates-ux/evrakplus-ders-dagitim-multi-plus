import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, createBlankProject, RoomType, SolverStatus } from '../../packages/core-schema/src/index.js';
import { ChocoAdapter } from '../../engines/choco/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('Choco Solver gömülü Java 21 sağlık kontrolü ve sürüm bilgisi', async () => {
  const adapter = new ChocoAdapter();
  const hc = await adapter.healthCheck();
  assert.equal(hc.healthy, true, `Choco sağlıklı değil: ${hc.error}`);
  assert.equal(hc.version, '4.10.18');
  assert.ok(hc.java && hc.java.startsWith('21'), `Gömülü Java 21 bekleniyor, gelen: ${hc.java}`);
});

test('Choco Solver: Çok Küçük Okul (10/5) çoklu alternatif çözüm üretimi ve kısıt etki raporu', async () => {
  const adapter = new ChocoAdapter();
  await adapter.healthCheck();

  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  proj.placements['a_0:0'] = { day: 1, period: 0, roomId: null, lock: true };
  const input = buildSolverInput(proj, { timeLimitSeconds: 15 });
  input.options.maxAlternatives = 3;

  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.FEASIBLE, `Beklenen FEASIBLE, gelen: ${res.status} (${res.rawStatus})`);
  assert.equal(res.evaluation.validation.isValid, true, `Doğrulayıcı ihlalleri: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.ok(res.alternatives.length >= 2, `En az 2 alternatif bekleniyor, gelen: ${res.alternatives.length}`);
  assert.equal(res.placements['a_0:0'].day, 1);
  assert.equal(res.placements['a_0:0'].period, 0);
  assert.ok(res.constraintImpact && res.constraintImpact.constraintCounts, 'Kısıt etki raporu eksik');
  console.log(`  [Choco very_small 10/5] status=${res.status}, alts=${res.alternatives.length}, time=${res.elapsedMs}ms, bestQuality=${res.evaluation.qualityScore}/100, domainRed=${res.constraintImpact.domainReductionPercent}%`);
});

test('Choco Solver: Derslik türü + iki bina geçiş süresi kısıtı gerçek çözümü ve bağımsız doğrulaması', async () => {
  const adapter = new ChocoAdapter();
  await adapter.healthCheck();

  const p = createBlankProject({ school: { name: 'İki Binalı Okul', daysPerWeek: 2, periodsPerDay: 6 } });
  const b1 = p.buildings[0];
  const b2 = { id: 'b2', revision: 1, updatedAt: '', deletedAt: null, name: 'Laboratuvar Binası', code: 'B2', transitionPeriods: { [b1.id]: 1 } };
  b1.transitionPeriods = { b2: 1 };
  p.buildings.push(b2);

  p.rooms.push(
    { id: 'r1', revision: 1, updatedAt: '', deletedAt: null, name: '101', type: RoomType.CLASSROOM, buildingId: b1.id, capacity: 35, closed: [] },
    { id: 'r2', revision: 1, updatedAt: '', deletedAt: null, name: 'Fen Lab', type: RoomType.LAB_SCIENCE, buildingId: b2.id, capacity: 35, closed: [] }
  );
  p.teachers.push(
    { id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'Ortak Öğretmen', branch: 'Fen', dmax: 6, wmax: 12, cmax: 0, av: {} }
  );
  p.classes.push(
    { id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '6/A', grade: 6, studentCount: 30, homeRoomId: 'r1', dmax: 6, closed: [] }
  );
  p.subjects = {
    MAT: { key: 'MAT', name: 'Matematik', short: 'MAT', branch: 'Matematik', requiredRoomType: null, forbidAcrossLunch: false },
    FEN: { key: 'FEN', name: 'Fen', short: 'FEN', branch: 'Fen', requiredRoomType: RoomType.LAB_SCIENCE, forbidAcrossLunch: false }
  };
  // Aynı öğretmene aynı gün içinde iki farklı binada dersler -> Choco en az 1 saat bina geçiş boşluğu bırakmalı!
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'MAT', hours: 2, pattern: '2', teacherId: 't1', roomId: 'r1', kind: 'zorunlu' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'FEN', hours: 2, pattern: '2', teacherId: 't1', requiredRoomType: RoomType.LAB_SCIENCE, kind: 'zorunlu' }
  );

  const input = buildSolverInput(p, { timeLimitSeconds: 10 });
  const res = await adapter.solve(input);
  assert.equal(res.status, SolverStatus.FEASIBLE);
  assert.equal(res.evaluation.validation.isValid, true, `Bina geçiş doğrulama hatası: ${JSON.stringify(res.evaluation.validation.hardViolations)}`);
  assert.equal(res.placements['a2:0'].roomId, 'r2');
  assert.ok(res.constraintImpact.constraintCounts.buildingTransition >= 1, 'Bina geçiş kısıtı eklenmiş olmalı');
});
