import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  SchoolTypes,
  MAIN_MENUS,
  ConstraintLevel,
  getBlockPatternsForHours,
  parseBlockPattern,
  CURRICULUM_TEMPLATES,
  getCurriculumTemplate,
  listSchoolTypes,
  createBlankProject,
  createConstraint,
  validateProjectSchema,
  sanitizeBackupJson,
  migrateProject,
  buildSolverInput
} from '../../packages/core-schema/src/index.js';

test('11 MEB kurum türü ve 18 ana menü eksiksiz tanımlı olmalı', () => {
  assert.equal(SchoolTypes.length, 11);
  assert.equal(MAIN_MENUS.length, 18);
  const listed = listSchoolTypes();
  assert.equal(listed.length, 11);
  for (const st of listed) {
    assert.equal(st.hasTemplate, true, `${st.id} şablonu eksik`);
    assert.equal(st.officialApproved, false, 'Doğrulanmamış şablon MEB onaylı gösterilemez');
    const tpl = getCurriculumTemplate(st.id);
    assert.equal(tpl.officialApproved, false);
    assert.equal(tpl.editable, true);
  }
  assert.ok(CURRICULUM_TEMPLATES.version);
});

test('Blok kombinasyonları doğru üretilmeli ve ayrıştırılmalı', () => {
  assert.deepEqual(getBlockPatternsForHours(2), ['2', '1+1']);
  assert.deepEqual(getBlockPatternsForHours(3), ['3', '2+1', '1+1+1']);
  assert.ok(getBlockPatternsForHours(5).includes('3+2'));
  assert.ok(getBlockPatternsForHours(6).includes('2+2+2'));
  assert.deepEqual(parseBlockPattern('2+2+1', 5), [2, 2, 1]);
  assert.deepEqual(parseBlockPattern('invalid', 5), [2, 2, 1]);
});

test('Boş v3 projesi şema doğrulamasından geçmeli, bozuk JSON reddedilmeli', () => {
  const proj = createBlankProject({ school: { name: 'Atatürk Ortaokulu' } });
  assert.equal(proj.schemaVersion, SCHEMA_VERSION);
  assert.equal(proj.buildings.length, 1);
  assert.equal(validateProjectSchema(proj).valid, true);

  assert.equal(validateProjectSchema(null).valid, false);
  assert.equal(validateProjectSchema({ school: { daysPerWeek: 99, periodsPerDay: 7 } }).valid, false);

  const brokenRef = createBlankProject();
  brokenRef.assignments.push({ id: 'a1', classId: 'non-existent', subjectKey: 'MAT', hours: 5, pattern: '2+2+1' });
  const res = validateProjectSchema(brokenRef);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('non-existent')));
});

test('Eski Çarşaf v2 projesi sıfır veri kaybıyla v3 formatına taşınmalı', () => {
  const legacyV2 = {
    v: 2,
    school: { name: 'Örnek Ortaokulu', year: '2026-2027', mudur: 'Ahmet Yılmaz', myard: [{ id: 'm1', name: 'Ayşe Kaya', gorev: 'Program' }], donem: '1. Dönem', type: 'ilk', D: 5, P: 7, start: '08:30', len: 40, brk: 10, lunchAfter: 5, lunchLen: 40 },
    subjects: { MAT: ['Matematik', 'MAT', 'Matematik'], TRK: ['Türkçe', 'TRK', 'Türkçe'] },
    classes: [{ id: 'c1', name: '5/A', grade: 5, closed: ['4-6'], rehber: 't1' }],
    teachers: [{ id: 't1', name: 'Ali Veli', short: 'AV', branch: 'Matematik', dmax: 6, cmax: 4, av: { '0-0': 1, '1-2': 2 }, extra: ['TRK'], dutyD: '2', dutyP: 'Bahçe' }],
    cards: [{ id: 'k1', classId: 'c1', subj: 'MAT', hours: 5, pattern: '2+2+1', teacherId: 't1', kind: 'zorunlu' }],
    rules: [
      { id: 'r1', type: 'diff', on: true },
      { id: 'r2', type: 'forbid', on: true, a: 'MAT', periods: [0] },
      { id: 'r3', type: 'pair', on: true, a: 'MAT', b: 'TRK' }
    ],
    place: { 'k1:0': { d: 0, p: 1, lock: true } },
    duty: { places: ['Bahçe'], admin: { 0: 'Ayşe Kaya' } }
  };

  const v3 = migrateProject(legacyV2);
  assert.equal(v3.schemaVersion, 3);
  assert.equal(v3.school.name, 'Örnek Ortaokulu');
  assert.equal(v3.school.principal, 'Ahmet Yılmaz');
  assert.equal(v3.school.vicePrincipals.length, 1);
  assert.equal(v3.teachers.length, 1);
  assert.equal(v3.teachers[0].av['0-0'], 1);
  assert.equal(v3.teachers[0].av['1-2'], 2);
  assert.equal(v3.assignments.length, 1);
  assert.equal(v3.assignments[0].pattern, '2+2+1');
  assert.equal(v3.constraints.length, 3);
  assert.equal(v3.placements['k1:0'].day, 0);
  assert.equal(v3.placements['k1:0'].period, 1);
  assert.equal(v3.placements['k1:0'].lock, true);
  assert.equal(validateProjectSchema(v3).valid, true);

  // Standart SolverInput üretimi
  const solverInput = buildSolverInput(v3, { timeLimitSeconds: 30 });
  assert.equal(solverInput.school.daysPerWeek, 5);
  assert.equal(solverInput.school.periodsPerDay, 7);
  assert.equal(solverInput.blocks.length, 3); // 2+2+1 => 3 blok
  assert.equal(solverInput.blocks[0].locked, true);
  assert.equal(solverInput.blocks[0].length, 2);
  assert.deepEqual(solverInput.teachers[0].closedSlots, ['0-0']);
  assert.deepEqual(solverInput.teachers[0].preferredFreeSlots, ['1-2']);
});

test('Yedekleme JSON temizleyici hiçbir şifre, token veya API anahtarı bırakmamalı', () => {
  const proj = createBlankProject();
  proj.auth = { access_token: 'secret123', refresh_token: 'ref456', apiKey: 'key789', password: 'pw' };
  proj.school.secretNote = 'gizli';
  const clean = sanitizeBackupJson(proj);
  const str = JSON.stringify(clean);
  assert.equal(str.includes('secret123'), false);
  assert.equal(str.includes('ref456'), false);
  assert.equal(str.includes('key789'), false);
  assert.equal(str.includes('password'), false);
  assert.equal(clean.school.name, 'Yeni Okul');
});

test('4 seviyeli kısıt oluşturucu varsayılan ağırlıkları doğru atamalı', () => {
  const hard = createConstraint({ type: 'room_no_conflict', level: ConstraintLevel.HARD });
  const pref = createConstraint({ type: 'teacher_preferred_days', level: ConstraintLevel.PREFERENCE });
  assert.ok(hard.weight > pref.weight);
  assert.equal(hard.level, 'HARD');
  assert.equal(pref.level, 'PREFERENCE');
});
