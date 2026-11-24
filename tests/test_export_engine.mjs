import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const EditorLogic = require('../renderer/editor_logic.js');
const ExportEngine = require('../renderer/export_engine.js');

function makeExportTestState(numClasses = 2, numTeachers = 2) {
  const slots = {};
  for (let d = 0; d < 6; d++) slots[d] = Array(7).fill('ACTIVE');
  const classes = [];
  const teachers = [];
  const placements = [];

  for (let i = 0; i < numTeachers; i++) {
    const avail = {};
    for (let d = 0; d < 6; d++) avail[d] = Array(7).fill('AVAILABLE');
    teachers.push({
      id: `t${i}`,
      name: i === 0 ? 'Şükran Çelik Öğretmen' : (i === 1 ? '=CMD|TestFormül' : `Öğretmen ${i + 1}`),
      shortCode: `OG${i + 1}`,
      branch: i % 2 === 0 ? 'Matematik' : 'Türkçe',
      maxHours: 30,
      maxDaily: 6,
      availability: avail
    });
  }

  for (let c = 0; c < numClasses; c++) {
    const cname = `${5 + (c % 4)}/${String.fromCharCode(65 + Math.floor(c / 4))}`;
    const tid = `t${c % numTeachers}`;
    classes.push({
      id: `c${c}`,
      name: cname,
      gradeKey: String(5 + (c % 4)),
      shift: c % 2 === 0 ? 'morning' : 'afternoon',
      homeRoom: `D-${101 + c}`,
      courses: [
        { id: 'mat', code: 'MAT', name: 'Matematik', hours: 2, blocks: [2], maxPerDay: 1, teacherId: tid }
      ]
    });
    placements.push({
      block_id: `c${c}__mat__b0`,
      assignment_id: `c${c}__mat`,
      block_index: 0,
      class_id: `c${c}`,
      class_name: cname,
      course_id: 'mat',
      course_code: 'MAT',
      course_name: 'Matematik',
      teacher_ids: [tid],
      room_id: c === 0 ? 'r1' : null,
      day_index: c % 5,
      start_period: 0,
      length: 2
    });
  }

  const state = {
    school: { name: 'Yoğunoluk Ortaokulu', academicYear: '2026–2027', coordinator: 'Mehmet Yılmaz', shiftMode: 'double' },
    bell: { startTime: '07:30', afternoonStartTime: '13:00', lessonDuration: 40, breakDuration: 10, lunchAfterPeriod: 0, lunchDuration: 0 },
    grid: { periodsPerDay: 7, activeDays: [true, true, true, true, true, false], slots },
    pinnedPlacementIds: ['c0__mat__b0'],
    lockedTeacherIds: [],
    exportSettings: ExportEngine.createDefaultExportSettings(),
    classes,
    teachers,
    rooms: [{ id: 'r1', name: 'Bilişim Lab-1', roomType: 'bilisim_lab', capacity: 1 }],
    solution: {
      engine: 'google_ortools_cp_sat',
      status: 'OPTIMAL',
      placed_blocks: placements.length,
      total_blocks: placements.length,
      placements
    }
  };

  const helpers = {
    getSlotStats: () => ({ activeDayIndices: [0, 1, 2, 3, 4], openTotal: 35 }),
    computeBellSchedule: () => ({
      isDouble: true,
      primary: Array.from({ length: 7 }, (_, i) => ({ period: i + 1, start: `0${7 + i}:30`, end: `0${8 + i}:10` })),
      afternoon: Array.from({ length: 7 }, (_, i) => ({ period: i + 1, start: `${13 + i}:00`, end: `${13 + i}:40` }))
    }),
    getClassShift: (cid) => {
      const cls = classes.find((x) => x.id === cid);
      return cls ? cls.shift : 'morning';
    },
    getBlockPhysicalSpan: (cid, sp, len) => {
      const cls = classes.find((x) => x.id === cid);
      const base = cls && cls.shift === 'afternoon' ? 780 : 450;
      return [base + sp * 50, base + (sp + len) * 50 - 10];
    },
    physicalSpansOverlap: (a, b) => a[0] < b[1] && b[0] < a[1],
    getCurrentClasses: () => state.classes,
    getCurrentTeachers: () => state.teachers,
    getCurrentRooms: () => state.rooms,
    ensureTeacherAvailabilitySize: () => {},
    computeTeacherGaps: (tid) => ExportEngine.computeTeacherDayMetrics(tid, state.solution.placements, 5).totalGaps
  };

  return { state, helpers };
}

test('Asama 4: Tek sube & tek ogretmen cikti sablonlari, ikili ogretim saatleri ve Turkce karakterler', () => {
  const { state, helpers } = makeExportTestState(2, 2);

  // Tek sube (Sabahci ve Oglenci)
  const clsHtml0 = ExportEngine.buildClassTimetablePageHtml(state, state.classes[0], helpers, false, 1, 1);
  const clsHtml1 = ExportEngine.buildClassTimetablePageHtml(state, state.classes[1], helpers, false, 1, 1);
  assert.ok(clsHtml0.includes('Yoğunoluk Ortaokulu'));
  assert.ok(clsHtml0.includes('Sabahçı Devresi'));
  assert.ok(clsHtml0.includes('Şükran Çelik Öğretmen'));
  assert.ok(clsHtml0.includes('Bilişim Lab-1'));
  assert.ok(clsHtml1.includes('Öğlenci Devresi'));
  assert.ok(clsHtml1.includes('13:00–13:40'));
  // Girilmeyen okul muduru adi uydurulmamali
  assert.ok(clsHtml0.includes('................................'));

  // Tek ogretmen
  const tchHtml = ExportEngine.buildTeacherTimetablePageHtml(state, state.teachers[0], helpers, false, 1, 1);
  assert.ok(tchHtml.includes('Şükran Çelik Öğretmen'));
  assert.ok(tchHtml.includes('Haftalık Boş Pencere:'));
  assert.ok(tchHtml.includes('Ders Listesi:'));
  assert.ok(tchHtml.includes('Aslını Aldım'));
  assert.ok(tchHtml.includes('colspan="2"'), '2 saatlik ders bloğu yatay colspan="2" ile birleştirilmeli');
  assert.ok(clsHtml0.includes('colspan="2"'), 'Sınıf programında 2 saatlik blok yatay colspan="2" ile birleştirilmeli');
  assert.ok(clsHtml0.includes('Yerleşim'), 'Sınıf programında alt Ders Listesi tablosu bulunmalı');

  // Çarşaf şablonlarında yatay blok birleştirme ve zil saati başlıkları
  const clsSheet = ExportEngine.buildCarsafPagesHtml(state, 'class_sheet', helpers, false);
  const tchSheet = ExportEngine.buildCarsafPagesHtml(state, 'teacher_sheet', helpers, false);
  assert.ok(clsSheet.includes('colspan="2"'));
  assert.ok(tchSheet.includes('colspan="2"'));
  assert.ok(clsSheet.includes('meb-day-group'));
  assert.ok(tchSheet.includes('meb-day-group'));
});

test('Asama 4: 50 sube ve 100 ogretmenlik toplu PDF HTML uretimi + A3/A4 carsaf bolme', () => {
  const { state, helpers } = makeExportTestState(50, 100);
  const t0 = performance.now();
  const classPages = state.classes.map((cls, i) => ExportEngine.buildClassTimetablePageHtml(state, cls, helpers, false, i + 1, 50)).join('');
  const teacherPages = state.teachers.map((t, i) => ExportEngine.buildTeacherTimetablePageHtml(state, t, helpers, false, i + 1, 100)).join('');
  const elapsed = performance.now() - t0;

  assert.equal((classPages.match(/class="doc-page"/g) || []).length, 50);
  assert.equal((teacherPages.match(/class="doc-page"/g) || []).length, 100);
  assert.ok(elapsed < 1000, `50 sube + 100 ogretmen sablon uretimi cok yavas: ${elapsed}ms`);

  // A4 cok sayfali carsaf bolme (5 gun -> 2 sayfa: 3 gun + 2 gun)
  state.exportSettings.pageSize = 'A4';
  state.exportSettings.splitA4Sheets = true;
  const a4Carsaf = ExportEngine.buildCarsafPagesHtml(state, 'class_sheet', helpers, false);
  assert.equal((a4Carsaf.match(/class="doc-page"/g) || []).length, 2);

  // A3 tek sayfa carsaf
  state.exportSettings.pageSize = 'A3';
  const a3Carsaf = ExportEngine.buildCarsafPagesHtml(state, 'class_sheet', helpers, false);
  assert.equal((a3Carsaf.match(/class="doc-page"/g) || []).length, 1);
});

test('Asama 4: Gercek 7 sayfali Excel (.xlsx) uretimi, geri okuma ve formul enjeksiyon korumasi', () => {
  const { state, helpers } = makeExportTestState(4, 4);
  const { workbook, validation } = ExportEngine.buildExcelWorkbook(XLSX, state, helpers, EditorLogic);

  assert.equal(validation.isValid, true);
  assert.deepEqual(workbook.SheetNames, [
    'Sinif Programlari',
    'Ogretmen Programlari',
    'Sinif Carsaf',
    'Ogretmen Carsaf',
    'Ozel Derslikler',
    'Ogretmen Ders Yukleri',
    'Program Kalite Raporu'
  ]);

  // Gercek .xlsx dosyasina yazip tekrar oku
  const tmpFile = path.join(os.tmpdir(), `test_ders_prog_${Date.now()}.xlsx`);
  try {
    XLSX.writeFile(workbook, tmpFile);
    assert.ok(fs.existsSync(tmpFile));
    const readBack = XLSX.readFile(tmpFile);
    assert.equal(readBack.SheetNames.length, 7);

    // Formul enjeksiyonu korumasini dogrula (=CMD|TestFormül -> '=CMD|TestFormül)
    const tchSheet = readBack.Sheets['Ogretmen Ders Yukleri'];
    const rows = XLSX.utils.sheet_to_json(tchSheet, { header: 1 });
    const dangerousRow = rows.find((r) => String(r[0] || '').includes('CMD|TestFormül'));
    assert.ok(dangerousRow, 'Ogretmen satiri bulunamadi');
    assert.ok(String(dangerousRow[0]).startsWith("'="), 'Excel formul enjeksiyonu engellenmeli!');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('Asama 4: Bos pencere hesabi, gecersiz program TASLAK uyarisi ve EvrakPlus yetki kontrolu', () => {
  // 1. Bos pencere: 1. ders (p=0) ve 4. ders (p=3) dolu -> arada 2 bos saat (p=1, p=2); ders oncesi/sonrasi sayilmaz!
  const mockPl = [
    { day_index: 0, start_period: 0, length: 1, teacher_ids: ['t1'] },
    { day_index: 0, start_period: 3, length: 1, teacher_ids: ['t1'] }
  ];
  const m = ExportEngine.computeTeacherDayMetrics('t1', mockPl, 5);
  assert.equal(m.totalGaps, 2);
  assert.equal(m.workingDays, 1);
  assert.equal(m.maxConsecutive, 1);

  // 2. Gecersiz programda TASLAK uyarisi
  const { state, helpers } = makeExportTestState(2, 2);
  // Ikinci yerlesimi kaldirarak eksik ders saati olustur
  state.solution.placements.pop();
  const val = ExportEngine.checkScheduleValidityForExport(state, helpers, EditorLogic);
  assert.equal(val.isValid, false);
  assert.equal(val.isDraft, true);
  assert.match(val.message, /eksik ders saati/i);
  const draftHtml = ExportEngine.buildClassTimetablePageHtml(state, state.classes[0], helpers, val.isDraft, 1, 1);
  assert.ok(draftHtml.includes('TASLAK – DOĞRULANMAMIŞ'));

  // 3. EvrakPlus merkezi yetki kontrolu (sahte oturum yok)
  assert.equal(ExportEngine.EvrakPlusAuthService.checkExportPermission('export_pdf', state).allowed, true);
  state.exportSettings.evrakPlusEnforcement = 'strict_evrakplus';
  const denied = ExportEngine.EvrakPlusAuthService.checkExportPermission('export_pdf', state);
  assert.equal(denied.allowed, false);
  assert.equal(denied.status, 'missing_license');

  // Suresi dolmus yetki reddedilmeli
  state.evrakPlusLicense = { token: 'srv_tok', expiresAt: '2020-01-01T00:00:00Z' };
  assert.equal(ExportEngine.EvrakPlusAuthService.checkExportPermission('export_xlsx', state).status, 'expired_license');

  // Gecerli sureli yetki onaylanmali
  state.evrakPlusLicense = { token: 'srv_tok', expiresAt: '2099-01-01T00:00:00Z' };
  assert.equal(ExportEngine.EvrakPlusAuthService.checkExportPermission('export_xlsx', state).allowed, true);
});
