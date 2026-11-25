import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Multi Plus zorunlu kök dosyaları ve dokümantasyon mevcut', () => {
  for (const f of ['README.md', 'CHANGELOG.md', 'SECURITY.md', 'THIRD_PARTY_LICENSES.md', 'INSTALLATION.md', 'BUILD.md', 'TEST_REPORT.md', '.gitignore', '.env.example']) {
    assert.equal(fs.existsSync(path.join(ROOT, f)), true, `Eksik dosya: ${f}`);
  }
});

test('Altı optimizasyon motoru kaynak ve kaynak dosyaları mevcut', () => {
  const required = [
    'solver/solver_ortools.py',
    'solver/multi_solver_engine.py',
    'solver/validate_result.py',
    'solver/quality_scorer.py',
    'engines/base_adapter.py',
    'engines/java_bridge.py',
    'engines/scip/solver_scip.py',
    'engines/highs/solver_highs.py',
    'engines/minizinc/solver_minizinc.py',
    'resources/models/timetable.mzn',
    'engines/timefold/pom.xml',
    'engines/choco/pom.xml',
  ];
  for (const p of required) {
    assert.equal(fs.existsSync(path.join(ROOT, p)), true, `Eksik motor dosyası: ${p}`);
  }
});

test('cPanel Web, Solver Server, WP Connect ve GitHub Actions dosyaları mevcut', () => {
  const required = [
    'web/install.php',
    'web/api.php',
    'web/.htaccess',
    'solver-server/Dockerfile',
    'solver-server/docker-compose.yml',
    'solver-server/server.py',
    'evrakplus-multi-plus-connect/evrakplus-multi-plus-connect.php',
    '.github/workflows/test.yml',
    '.github/workflows/build-windows.yml',
    '.github/workflows/build-web.yml',
    '.github/workflows/build-solver-server.yml',
    '.github/workflows/release.yml',
  ];
  for (const p of required) {
    assert.equal(fs.existsSync(path.join(ROOT, p)), true, `Eksik bileşen: ${p}`);
  }
});

test('Electron preload ve main.cjs Multi Solver IPC ve gizlilik kurallarını korur', () => {
  const preload = fs.readFileSync(path.join(ROOT, 'electron/preload.cjs'), 'utf8');
  assert.match(preload, /getMultiSolverHealth/);
  assert.match(preload, /solveTimetable/);
  const main = fs.readFileSync(path.join(ROOT, 'electron/main.cjs'), 'utf8');
  assert.match(main, /ipcMain\.handle\('multi:health'/);
  assert.match(main, /EVRAKPLUS_JAVA_EXE/);
  assert.match(main, /EVRAKPLUS_MINIZINC_EXE/);
});

test('Okul Kulüpleri modülü 32 MEB kulübü, manuel ekleme ve silmeyi destekler', async () => {
  const clubsMod = await import(new URL('../renderer/clubs_module.js', import.meta.url));
  const api = clubsMod.default || globalThis.EvrakPlusClubs;
  assert.equal(api.DEFAULT_SCHOOL_CLUBS.length, 32);
  const st = { teachersBySchool: { s1: [{ id: 't1', name: 'Ali', club: '' }] } };
  const list = api.getSchoolClubs(st);
  assert.equal(list.length, 32);
  const addRes = api.addSchoolClub(st, 'Robotik Kodlama Kulübü');
  assert.equal(addRes.ok, true);
  assert.equal(st.schoolClubs.length, 33);
  st.teachersBySchool.s1[0].club = 'Robotik Kodlama Kulübü';
  const delRes = api.removeSchoolClub(st, 'Robotik Kodlama Kulübü');
  assert.equal(delRes.ok, true);
  assert.equal(st.schoolClubs.length, 32);
  assert.equal(st.teachersBySchool.s1[0].club, '');
});

test('Resmî MEB/TTKB 19 okul türü, 5 kurum grubu ve tüm zorunlu/seçmeli saat toplamları matematiksel olarak doğrudur', () => {
  const ctx = { window: {}, defaultBlocksForHours: (h) => [h], inferRoomType: () => 'standard' };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'renderer', 'meb_curriculum.js'), 'utf8'), ctx);
  const { MEB_SCHOOL_GROUPS, MEB_SCHOOL_TYPES, MEB_BRANCHES_BY_SCHOOL_TYPE, getMebTemplatesForGrade } = ctx.window;
  assert.equal(MEB_SCHOOL_GROUPS.length, 5);
  assert.equal(Object.keys(MEB_SCHOOL_TYPES).length, 19);
  for (const [id, meta] of Object.entries(MEB_SCHOOL_TYPES)) {
    assert.ok(MEB_BRANCHES_BY_SCHOOL_TYPE[id]?.length > 0, `Branş listesi eksik: ${id}`);
    const grades = meta.prepGrade ? [meta.prepGrade, ...meta.grades] : meta.grades;
    for (const gr of grades) {
      const mand = getMebTemplatesForGrade(id, gr.key, 'mandatory');
      const elec = getMebTemplatesForGrade(id, gr.key, 'elective');
      const mandSum = mand.reduce((s, c) => s + c.hours, 0);
      const isPrimary = (id === 'ilkokul' || id === 'muzik_ilkokul');
      const isOzel = id.startsWith('ozel_');
      const expected = isPrimary
        ? (gr.core + (gr.meslek || 0) + gr.elective)
        : isOzel ? (gr.core + (gr.guidance || 0)) : (gr.core + (gr.meslek || 0) + (gr.guidance || 0));
      assert.equal(mandSum, expected, `${id} ${gr.key}. sınıf zorunlu saat toplamı uyumsuz`);
      if (!isPrimary && (gr.elective > 0 || (isOzel && gr.meslek > 0))) {
        assert.ok(elec.length > 0, `${id} ${gr.key}. sınıf seçmeli havuzu boş`);
      }
    }
  }
});
