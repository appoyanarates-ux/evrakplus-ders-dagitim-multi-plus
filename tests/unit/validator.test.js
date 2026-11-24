import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  createConstraint,
  buildSolverInput,
  SolverStatus,
  ConstraintLevel,
  RoomType
} from '../../packages/core-schema/src/index.js';
import {
  validateSchedule,
  evaluateSolution,
  compareEvaluations,
  runPrecheck
} from '../../packages/validator/src/index.js';

function makeSampleProject() {
  const p = createBlankProject({ school: { name: 'Test Ortaokulu', daysPerWeek: 5, periodsPerDay: 6 } });
  const b1 = p.buildings[0];
  const b2 = { id: 'b2', revision: 1, updatedAt: '', deletedAt: null, name: 'Ek Bina', code: 'B2', transitionPeriods: { [b1.id]: 1 } };
  b1.transitionPeriods = { b2: 1 };
  p.buildings.push(b2);

  p.rooms.push(
    { id: 'r1', revision: 1, updatedAt: '', deletedAt: null, name: 'Derslik 101', type: RoomType.CLASSROOM, buildingId: b1.id, capacity: 35, closed: [] },
    { id: 'r2', revision: 1, updatedAt: '', deletedAt: null, name: 'Fen Lab', type: RoomType.LAB_SCIENCE, buildingId: b2.id, capacity: 30, closed: [] }
  );
  p.teachers.push(
    { id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'Matematikçi', branch: 'Matematik', dmin: 0, dmax: 5, wmin: 0, wmax: 25, cmax: 3, maxDailyGaps: 1, maxWeeklyGaps: 3, maxDailyBuildingChanges: 1, maxWeeklyBuildingChanges: 3, preferredDays: [], avoidDays: [], av: { '0-0': 1, '1-0': 2 }, extra: [] },
    { id: 't2', revision: 1, updatedAt: '', deletedAt: null, name: 'Fenci', branch: 'Fen Bilimleri', dmin: 0, dmax: 5, wmin: 0, wmax: 25, cmax: 3, maxDailyGaps: null, maxWeeklyGaps: null, maxDailyBuildingChanges: null, maxWeeklyBuildingChanges: null, preferredDays: [], avoidDays: [], av: {}, extra: [] }
  );
  p.classes.push(
    { id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '5/A', grade: 5, shift: 'full', studentCount: 30, homeRoomId: 'r1', dmin: 0, dmax: 6, maxDailyGaps: 0, maxWeeklyGaps: 0, closed: ['4-5'], rehber: 't1', studentGroups: [] },
    { id: 'c2', revision: 1, updatedAt: '', deletedAt: null, name: '5/B', grade: 5, shift: 'full', studentCount: 30, homeRoomId: 'r1', dmin: 0, dmax: 6, maxDailyGaps: 0, maxWeeklyGaps: 0, closed: [], rehber: 't2', studentGroups: [] }
  );
  p.subjects = {
    MAT: { key: 'MAT', name: 'Matematik', short: 'MAT', branch: 'Matematik', requiredRoomType: null, forbidAcrossLunch: true },
    FEN: { key: 'FEN', name: 'Fen Bilimleri', short: 'FEN', branch: 'Fen Bilimleri', requiredRoomType: RoomType.LAB_SCIENCE, forbidAcrossLunch: true }
  };
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'MAT', hours: 4, pattern: '2+2', teacherId: 't1', kind: 'zorunlu' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'FEN', hours: 2, pattern: '2', teacherId: 't2', requiredRoomType: RoomType.LAB_SCIENCE, kind: 'zorunlu' }
  );
  return p;
}

test('Geçerli çizelge doğrulamadan geçmeli ve 100 üzerinden yüksek puan almalı', () => {
  const p = makeSampleProject();
  const input = buildSolverInput(p);
  const placements = {
    'a1:0': { day: 0, period: 1, roomId: 'r1' },
    'a1:1': { day: 2, period: 0, roomId: 'r1' },
    'a2:0': { day: 0, period: 3, roomId: 'r2' }
  };

  const ev = evaluateSolution(input, placements, SolverStatus.OPTIMAL);
  assert.equal(ev.validation.isValid, true);
  assert.equal(ev.validation.verifiedStatus, SolverStatus.OPTIMAL);
  assert.equal(ev.validation.metrics.hardViolationCount, 0);
  assert.equal(ev.rankTier, 2);
  assert.ok(ev.qualityScore >= 95, `Beklenen >= 95, gelen: ${ev.qualityScore}`);
});

test('Motor OPTIMAL iddia etse bile öğretmen/sınıf/derslik çakışması reddedilmeli ve geçerli çözümün gerisinde kalmalı', () => {
  const p = makeSampleProject();
  const input = buildSolverInput(p);

  // Çakışmalı (a1:0 ve a2:0 aynı sınıfta aynı saatte)
  const invalidPlacements = {
    'a1:0': { day: 0, period: 1, roomId: 'r1' },
    'a1:1': { day: 2, period: 0, roomId: 'r1' },
    'a2:0': { day: 0, period: 1, roomId: 'r2' }
  };
  const badEv = evaluateSolution(input, invalidPlacements, SolverStatus.OPTIMAL);
  assert.equal(badEv.validation.isValid, false);
  assert.equal(badEv.validation.verifiedStatus, SolverStatus.ERROR);
  assert.equal(badEv.qualityScore, 0);
  assert.equal(badEv.rankTier, 0);
  assert.ok(badEv.validation.hardViolations.some(v => v.code === 'CLASS_CONFLICT'));

  // Geçerli ama tercihen boş saat ihlalli (düşük kaliteli) çözüm yine de geçersizden üstün olmalı
  const lowQualityValid = {
    'a1:0': { day: 1, period: 0, roomId: 'r1' }, // 1-0 tercihen boş ihlali
    'a1:1': { day: 2, period: 0, roomId: 'r1' },
    'a2:0': { day: 3, period: 0, roomId: 'r2' }
  };
  const goodEv = evaluateSolution(input, lowQualityValid, SolverStatus.FEASIBLE);
  assert.equal(goodEv.validation.isValid, true);
  assert.ok(compareEvaluations(goodEv, badEv) > 0, 'Geçerli çözüm her zaman geçersizden üstün olmalıdır');
});

test('Kapalı saat, kilitli ders bozulması ve bina geçiş süresi ihlalleri yakalanmalı', () => {
  const p = makeSampleProject();
  // a1:0'ı kilitle
  p.placements['a1:0'] = { day: 0, period: 1, roomId: 'r1', lock: true };
  // t1'e ikinci derste b2'de ders ver (bina geçiş süresi 1 saat, ama ardışık saatte koyacağız)
  p.assignments[1].teacherId = 't1';
  const input = buildSolverInput(p);

  const placements = {
    'a1:0': { day: 0, period: 0, roomId: 'r1' }, // hem kapalı (0-0) hem kilit bozuldu (0-1 idi)
    'a1:1': { day: 2, period: 0, roomId: 'r1' },
    'a2:0': { day: 0, period: 2, roomId: 'r2' }  // b1(0-0,0-1) -> b2(0-2): 0 boşluk < gereken 1
  };
  const val = validateSchedule(input, placements, SolverStatus.FEASIBLE);
  assert.equal(val.isValid, false);
  const codes = new Set(val.hardViolations.map(v => v.code));
  assert.ok(codes.has('TEACHER_CLOSED'));
  assert.ok(codes.has('LOCKED_VIOLATION'));
  assert.ok(codes.has('BUILDING_TRANSITION'));
});

test('Farklı alt öğrenci grupları aynı sınıfta paralel ders alabilmeli', () => {
  const p = createBlankProject({ school: { daysPerWeek: 5, periodsPerDay: 6 } });
  p.teachers.push(
    { id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'İngilizceci', branch: 'İngilizce', dmax: 6, wmax: 30, cmax: 0, av: {} },
    { id: 't2', revision: 1, updatedAt: '', deletedAt: null, name: 'Almancacı', branch: 'Almanca', dmax: 6, wmax: 30, cmax: 0, av: {} }
  );
  p.classes.push({ id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '9/A', grade: 9, dmax: 6, closed: [], studentGroups: [{ id: 'g1', name: 'Grup 1' }, { id: 'g2', name: 'Grup 2' }] });
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', studentGroupId: 'g1', parallelGroupId: 'pg1', subjectKey: 'ING', hours: 2, pattern: '2', teacherId: 't1', kind: 'secmeli' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', studentGroupId: 'g2', parallelGroupId: 'pg1', subjectKey: 'ALM', hours: 2, pattern: '2', teacherId: 't2', kind: 'secmeli' }
  );
  const input = buildSolverInput(p);

  // Aynı saatte paralel yerleşim -> GEÇERLİ
  const ok = validateSchedule(input, {
    'a1:0': { day: 0, period: 0 },
    'a2:0': { day: 0, period: 0 }
  });
  assert.equal(ok.isValid, true);

  // Farklı saatte yerleşim -> PARALLEL_GROUP_DESYNC
  const desync = validateSchedule(input, {
    'a1:0': { day: 0, period: 0 },
    'a2:0': { day: 1, period: 0 }
  });
  assert.equal(desync.isValid, false);
  assert.ok(desync.hardViolations.some(v => v.code === 'PARALLEL_GROUP_DESYNC'));
});

test('PASS 0 ön kontrolü öğretmen kapasite aşımını ve Hall gün grubu açığını yakalamalı', () => {
  const p = createBlankProject({ school: { daysPerWeek: 2, periodsPerDay: 2 } });
  // 2 gün x 2 saat = 4 saatlik 2 sınıf = 8 saat toplam talep
  // 2 öğretmen var ama ikisi de 0. gün (Pazartesi) kapalı!
  const closedDay0 = { '0-0': 1, '0-1': 1 };
  p.teachers.push(
    { id: 't1', revision: 1, updatedAt: '', deletedAt: null, name: 'Öğr 1', dmax: 2, av: closedDay0 },
    { id: 't2', revision: 1, updatedAt: '', deletedAt: null, name: 'Öğr 2', dmax: 2, av: closedDay0 }
  );
  p.classes.push(
    { id: 'c1', revision: 1, updatedAt: '', deletedAt: null, name: '5/A', grade: 5, dmax: 2, closed: [] },
    { id: 'c2', revision: 1, updatedAt: '', deletedAt: null, name: '5/B', grade: 5, dmax: 2, closed: [] }
  );
  p.assignments.push(
    { id: 'a1', revision: 1, updatedAt: '', deletedAt: null, classId: 'c1', subjectKey: 'MAT', hours: 4, pattern: '2+2', teacherId: 't1', kind: 'zorunlu' },
    { id: 'a2', revision: 1, updatedAt: '', deletedAt: null, classId: 'c2', subjectKey: 'TRK', hours: 4, pattern: '2+2', teacherId: 't2', kind: 'zorunlu' }
  );
  const input = buildSolverInput(p);
  const pre = runPrecheck(input);
  assert.equal(pre.passed, false);
  assert.ok(pre.issues.some(i => i.code === 'TEACHER_OVERLOAD'));
  assert.ok(pre.issues.some(i => i.code === 'HALL_DAY_GROUP_SHORTAGE'));
});
