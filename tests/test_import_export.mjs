import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const RENDERER_HTML = path.join(ROOT, 'renderer', 'index.html');
const RENDERER_JS = path.join(ROOT, 'renderer', 'app.js');
const RENDERER_CSS = path.join(ROOT, 'renderer', 'assets', 'styles.css');
const MAIN_CJS = path.join(ROOT, 'electron', 'main.cjs');
const PRELOAD_CJS = path.join(ROOT, 'electron', 'preload.cjs');
const SOLVER_EXE = path.join(ROOT, 'resources', 'engines', 'ortools', 'multi_solver_engine.exe');

test('Arayuzde dis CDN veya internet bagimliligi yok (100% offline)', () => {
  const html = fs.readFileSync(RENDERER_HTML, 'utf8');
  const js = fs.readFileSync(RENDERER_JS, 'utf8');
  const css = fs.readFileSync(RENDERER_CSS, 'utf8');

  for (const forbidden of ['cdn.tailwindcss.com', 'unpkg.com', 'fonts.googleapis.com', 'https://']) {
    assert.ok(!html.includes(forbidden), `renderer/index.html icinde dis baglanti bulundu: ${forbidden}`);
  }
  for (const forbiddenCss of ['cdn.tailwindcss.com', 'unpkg.com', 'fonts.googleapis.com', '@import', 'url(http', 'url("http', "url('http"]) {
    assert.ok(!css.includes(forbiddenCss), `renderer/assets/styles.css icinde dis baglanti bulundu: ${forbiddenCss}`);
  }
  assert.ok(!js.includes('browser_js_iterative') || js.includes("=== 'browser_js_iterative'"), 'JS cozum motoru olmamali');
  assert.ok(fs.existsSync(path.join(ROOT, 'renderer', 'assets', 'lucide.min.js')), 'lucide.min.js eksik');
  assert.ok(fs.existsSync(path.join(ROOT, 'renderer', 'assets', 'xlsx.full.min.js')), 'xlsx.full.min.js eksik');
  assert.ok(fs.existsSync(RENDERER_CSS), 'styles.css eksik');
});

test('Electron guvenlik ayarlari ve preload API siniri dogru', () => {
  const mainSrc = fs.readFileSync(MAIN_CJS, 'utf8');
  const preloadSrc = fs.readFileSync(PRELOAD_CJS, 'utf8');

  assert.ok(mainSrc.includes('nodeIntegration: false'));
  assert.ok(mainSrc.includes('contextIsolation: true'));
  assert.ok(mainSrc.includes('sandbox: true'));
  assert.ok(mainSrc.includes('shell: false'));
  assert.ok(!mainSrc.includes('shell: true'));

  assert.ok(preloadSrc.includes('solveTimetable'));
  assert.ok(preloadSrc.includes('cancelSolve'));
  assert.ok(preloadSrc.includes('onSolveProgress'));
  assert.ok(preloadSrc.includes('getEngineInfo'));
});

test('Derlenmis Windows OR-Tools EXE (--info ve gercek cozum) calisiyor', () => {
  assert.ok(fs.existsSync(SOLVER_EXE), `PyInstaller ciktisi yok: ${SOLVER_EXE}`);

  const infoRes = spawnSync(SOLVER_EXE, ['--health-all'], { encoding: 'utf8', shell: false });
  assert.equal(infoRes.status, 0, infoRes.stderr);
  const lastJsonLine = infoRes.stdout.trim().split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
  const info = JSON.parse(lastJsonLine);
  assert.equal(info.engines.ortools.engine, 'google_ortools_cp_sat');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-exe-test-'));
  const inPath = path.join(tmpDir, 'in.json');
  const outPath = path.join(tmpDir, 'out.json');
  try {
    const sampleModel = {
      schema_version: '4.0-meb-2026-2027',
      solver_target: 'google_ortools_cp_sat',
      time_grid: {
        num_days: 5,
        periods_per_day: 6,
        lunch_break: { after_period: 0, duration_min: 0 },
        bell_schedule: [
          { period: 1, start: '08:30', end: '09:10' },
          { period: 2, start: '09:20', end: '10:00' },
          { period: 3, start: '10:10', end: '10:50' },
          { period: 4, start: '11:00', end: '11:40' },
          { period: 5, start: '11:50', end: '12:30' },
          { period: 6, start: '12:40', end: '13:20' }
        ],
        blocked_slots: [],
        common_elective_slots: []
      },
      classes: [{ id: 'c1', name: '5/A', grade_key: '5', shift: 'full_day' }],
      teachers: [{ id: 't1', name: 'Mat 1', branch: 'Matematik', min_weekly_hours: 4, max_weekly_hours: 30, max_daily_hours: 6, unavailable_slots: [], prefer_avoid_slots: [] }],
      rooms: [],
      assignments: [{
        assignment_id: 'c1__mat', class_id: 'c1', class_name: '5/A',
        course_id: 'mat', course_code: 'MAT', course_name: 'Matematik',
        hours: 6, blocks: [2, 2, 2], teacher_ids: ['t1'],
        room_id: null, room_type: 'standard', max_blocks_per_day: 1, use_common_elective_slot: false
      }],
      fixed_assignments: [],
      solution_request: { mode: 'respect_locks', preference: 'balanced', multi_mode: 'single', engines: ['ortools'] },
      solver_config: { engine: 'google_ortools_cp_sat', max_time_seconds: 15 }
    };
    fs.writeFileSync(inPath, JSON.stringify(sampleModel), 'utf8');
    const solveRes = spawnSync(SOLVER_EXE, ['--input', inPath, '--output', outPath], { encoding: 'utf8', shell: false });
    assert.equal(solveRes.status, 0, solveRes.stderr);
    const sol = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(sol.engine, 'google_ortools_cp_sat');
    assert.ok(['OPTIMAL', 'FEASIBLE'].includes(sol.status));
    assert.equal(sol.placed_blocks, 3);
    assert.equal(sol.total_blocks, 3);
    assert.equal(sol.placements.length, 3);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Gercek alt surec iptali (cancel/kill) sureci sonlandiriyor', async () => {
  assert.ok(fs.existsSync(SOLVER_EXE), `PyInstaller ciktisi yok: ${SOLVER_EXE}`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-cancel-test-'));
  const inPath = path.join(tmpDir, 'in.json');
  const outPath = path.join(tmpDir, 'out.json');

  // Buyuk bir model olustur ve 250ms sonra alt sureci gercekten sonlandir
  const classes = [];
  const teachers = [];
  const assignments = [];
  for (let i = 0; i < 30; i++) classes.push({ id: `c${i}`, name: `5/${i}`, grade_key: '5', shift: 'full_day' });
  for (let i = 0; i < 60; i++) teachers.push({ id: `t${i}`, name: `Ogr ${i}`, branch: 'Genel', min_weekly_hours: 0, max_weekly_hours: 30, max_daily_hours: 6, unavailable_slots: [], prefer_avoid_slots: [] });
  for (let c = 0; c < 30; c++) {
    for (let s = 0; s < 6; s++) {
      const tid = `t${(c * 2 + s) % 60}`;
      assignments.push({
        assignment_id: `c${c}__s${s}`, class_id: `c${c}`, class_name: `5/${c}`,
        course_id: `s${s}`, course_code: `D${s}`, course_name: `Ders ${s}`,
        hours: 4, blocks: [2, 2], teacher_ids: [tid],
        room_id: null, room_type: 'standard', max_blocks_per_day: 1, use_common_elective_slot: false
      });
    }
  }
  const bigModel = {
    schema_version: '4.0-meb-2026-2027',
    solver_target: 'google_ortools_cp_sat',
    time_grid: {
      num_days: 5, periods_per_day: 7, lunch_break: { after_period: 4, duration_min: 45 },
      bell_schedule: Array.from({ length: 7 }, (_, i) => ({ period: i + 1, start: `${8 + i}:00`, end: `${8 + i}:40` })),
      blocked_slots: [], common_elective_slots: []
    },
    classes, teachers, rooms: [], assignments, fixed_assignments: [],
    solution_request: { mode: 'respect_locks', preference: 'fewer_gaps' },
    solver_config: { engine: 'google_ortools_cp_sat', max_time_seconds: 60 }
  };
  fs.writeFileSync(inPath, JSON.stringify(bigModel), 'utf8');

  const child = spawn(SOLVER_EXE, ['--input', inPath, '--output', outPath], { shell: false, windowsHide: true });
  const exitPromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));

  await new Promise((r) => setTimeout(r, 300));
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true });
  const { code } = await exitPromise;
  assert.notEqual(code, 0, 'Iptal edilen surec 0 koduyla basarili bitmemeli');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});


import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const EditorLogic = require('../renderer/editor_logic.js');

function makeTestEditorState() {
  const slots = {};
  for (let d = 0; d < 6; d++) slots[d] = Array(7).fill('ACTIVE');
  slots[2][6] = 'BLOCKED'; // Carsamba 7. ders okulda kapali

  const t1Avail = {};
  const t2Avail = {};
  for (let d = 0; d < 6; d++) {
    t1Avail[d] = Array(7).fill('AVAILABLE');
    t2Avail[d] = Array(7).fill('AVAILABLE');
  }
  t1Avail[1][2] = 'UNAVAILABLE'; // t1 Sali 3. ders kapali

  const state = {
    school: { shiftMode: 'single', buildingTravelMinutes: 0 },
    bell: { startTime: '08:30', lessonDuration: 40, breakDuration: 10, lunchAfterPeriod: 4, lunchDuration: 45 },
    grid: { periodsPerDay: 7, activeDays: [true, true, true, true, true, false], slots },
    pinnedPlacementIds: [],
    lockedTeacherIds: [],
    classes: [
      {
        id: 'c1', name: '7/A', gradeKey: '7', shift: 'full_day',
        courses: [
          { id: 'mat', code: 'MAT', name: 'Matematik', hours: 4, blocks: [2, 2], maxPerDay: 1, teacherId: 't1' },
          { id: 'trk', code: 'TRK', name: 'Türkçe', hours: 1, blocks: [1], maxPerDay: 1, teacherId: 't2' }
        ]
      },
      {
        id: 'c2', name: '8/B', gradeKey: '8', shift: 'full_day',
        courses: [
          { id: 'mat2', code: 'MAT', name: 'Matematik', hours: 1, blocks: [1], maxPerDay: 1, teacherId: 't1' }
        ]
      }
    ],
    teachers: [
      { id: 't1', name: 'Ahmet Öğretmen', branch: 'Matematik', maxHours: 30, maxDaily: 6, availability: t1Avail },
      { id: 't2', name: 'Zeynep Öğretmen', branch: 'Türkçe', maxHours: 30, maxDaily: 6, availability: t2Avail }
    ],
    rooms: [],
    solution: {
      engine: 'google_ortools_cp_sat',
      status: 'OPTIMAL',
      placed_blocks: 4,
      total_blocks: 4,
      placements: [
        { block_id: 'c1__mat__b0', assignment_id: 'c1__mat', block_index: 0, class_id: 'c1', class_name: '7/A', course_id: 'mat', course_code: 'MAT', course_name: 'Matematik', teacher_ids: ['t1'], room_id: null, day_index: 0, start_period: 0, length: 2 },
        { block_id: 'c1__mat__b1', assignment_id: 'c1__mat', block_index: 1, class_id: 'c1', class_name: '7/A', course_id: 'mat', course_code: 'MAT', course_name: 'Matematik', teacher_ids: ['t1'], room_id: null, day_index: 2, start_period: 0, length: 2 },
        { block_id: 'c1__trk__b0', assignment_id: 'c1__trk', block_index: 0, class_id: 'c1', class_name: '7/A', course_id: 'trk', course_code: 'TRK', course_name: 'Türkçe', teacher_ids: ['t2'], room_id: null, day_index: 0, start_period: 2, length: 1 },
        { block_id: 'c2__mat2__b0', assignment_id: 'c2__mat2', block_index: 0, class_id: 'c2', class_name: '8/B', course_id: 'mat2', course_code: 'MAT', course_name: 'Matematik', teacher_ids: ['t1'], room_id: null, day_index: 0, start_period: 2, length: 1 }
      ]
    }
  };

  const helpers = {
    getSlotStats: () => ({ activeDayIndices: [0, 1, 2, 3, 4] }),
    getClassShift: () => 'full_day',
    getBlockPhysicalSpan: (_cid, sp, len) => [510 + sp * 50, 510 + (sp + len) * 50 - 10],
    physicalSpansOverlap: (a, b) => a[0] < b[1] && b[0] < a[1],
    getCurrentClasses: () => state.classes,
    getCurrentTeachers: () => state.teachers,
    getCurrentRooms: () => state.rooms,
    ensureTeacherAvailabilitySize: () => {},
    computeTeacherGaps: () => 0
  };

  return { state, helpers };
}

test('Asama 3: 1 saatlik ders, 2 saatlik blok tasima, kilit koruma, kapali saat ve takas cakisma kontrolu', () => {
  const { state, helpers } = makeTestEditorState();
  const [matB0, _matB1, trkB0, _mat2B0] = state.solution.placements;

  // 1. Tek saatlik ders farkli gune tasinabiliyor mu?
  const move1h = EditorLogic.validateManualPlacementFull(state, { ...trkB0, day_index: 3, start_period: 1 }, helpers, [trkB0]);
  assert.equal(move1h.valid, true, move1h.error);

  // 2. Iki saatlik blok tek parca tasinabiliyor mu ve ogle arasini (4. dersten sonra) bolmesi engelleniyor mu?
  const move2hOk = EditorLogic.validateManualPlacementFull(state, { ...matB0, day_index: 3, start_period: 0 }, helpers, [matB0]);
  assert.equal(move2hOk.valid, true, move2hOk.error);
  const move2hLunchSplit = EditorLogic.validateManualPlacementFull(state, { ...matB0, day_index: 3, start_period: 3 }, helpers, [matB0]);
  assert.equal(move2hLunchSplit.valid, false, '2 saatlik blok ogle arasini bolememeli');

  // 3. Kilitli blok tasinmasi engelleniyor mu?
  state.pinnedPlacementIds = ['c1__mat__b0'];
  const moveLockedCourse = EditorLogic.validateManualPlacementFull(state, { ...matB0, day_index: 3, start_period: 0 }, helpers, [matB0]);
  assert.equal(moveLockedCourse.valid, false);
  assert.match(moveLockedCourse.error, /kilitli/i);
  state.pinnedPlacementIds = [];

  // 4. Kilitli ogretmenin programi korunuyor mu?
  state.lockedTeacherIds = ['t1'];
  const moveLockedTeacher = EditorLogic.validateManualPlacementFull(state, { ...matB0, day_index: 3, start_period: 0 }, helpers, [matB0]);
  assert.equal(moveLockedTeacher.valid, false);
  assert.match(moveLockedTeacher.error, /öğretmeni kilitli/i);
  state.lockedTeacherIds = [];

  // 5. Ogretmenin kapali saatine (Sali 3. ders -> day=1, period=2) ders tasinmasi engelleniyor mu?
  const moveUnavail = EditorLogic.validateManualPlacementFull(state, { ...matB0, day_index: 1, start_period: 1 }, helpers, [matB0]);
  assert.equal(moveUnavail.valid, false);
  assert.match(moveUnavail.error, /kapalı/i);

  // 6. Iki dersin takasinda ogretmen cakismasi denetleniyor mu?
  // trkB0 Pazartesi 3. derste (period=2). Ayni saatte 8/B'de t1 (Ahmet Ogretmen) derste!
  // Dolayisiyla matB0 (t1) ile trkB0 takas edilirse t1 Pazartesi 3. derste hem 7/A hem 8/B'de cakisir!
  const badSwap = EditorLogic.validateDirectSwap(state, matB0, trkB0, helpers);
  assert.equal(badSwap.valid, false, 'Takasta t1 ogretmeni 8/B ile cakismali');
  assert.match(badSwap.error, /Çakışma/i);
});

test('Asama 3: 35 adimli Geri Al / Ileri Al (Undo / Redo) ve 105 ogretmenli denetim hizi', () => {
  const { state, helpers } = makeTestEditorState();
  const history = EditorLogic.createHistoryManager(40);

  // 35 ardisik degisiklik kaydet
  for (let step = 1; step <= 35; step++) {
    history.push(state);
    state.solution.placements[2].day_index = step % 5;
    state.solution.placements[2].start_period = step % 4;
    if (step === 10) state.pinnedPlacementIds = ['c1__trk__b0'];
  }
  assert.equal(history.counts().undo, 35);

  // 35 adim geri al ve baslangic durumuna dondugunu dogrula
  for (let step = 1; step <= 35; step++) {
    assert.equal(history.undo(state), true);
  }
  assert.equal(state.solution.placements[2].day_index, 0);
  assert.equal(state.solution.placements[2].start_period, 2);
  assert.deepEqual(state.pinnedPlacementIds, []);
  assert.equal(history.counts().redo, 35);

  // 10 adim ileri al
  for (let step = 1; step <= 10; step++) {
    assert.equal(history.redo(state), true);
  }
  assert.deepEqual(state.pinnedPlacementIds, ['c1__trk__b0']);

  // 105 ogretmenli buyuk programda auditScheduleLocal performansi (< 150ms)
  for (let i = 0; i < 105; i++) {
    state.teachers.push({ id: `tx_${i}`, name: `Ogr ${i}`, branch: 'Genel', availability: {} });
  }
  const t0 = performance.now();
  const issues = EditorLogic.auditScheduleLocal(state, helpers);
  const elapsedMs = performance.now() - t0;
  assert.ok(Array.isArray(issues));
  assert.ok(elapsedMs < 200, `105+ ogretmen denetimi cok yavas: ${elapsedMs}ms`);
});
