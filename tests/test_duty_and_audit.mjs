import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const DutyModule = require('../renderer/duty_module.js');
const EditorLogic = require('../renderer/editor_logic.js');

test('1. Öğretmen varsayılan saat sınırları (Min 1, Maks 30, Günlük Maks okul saatine göre) ve ekstra ders eşleştirme', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'renderer/index.html'), 'utf8');
  assert.ok(html.includes('id="tmMinHours" type="number" min="1" max="40" value="1"'));
  assert.ok(html.includes('id="tmMaxHours" type="number" min="1" max="45" value="30"'));
  assert.ok(html.includes('id="tmRole"'));
  assert.ok(html.includes('id="tmExtraSubjects"'));
  assert.ok(html.includes('id="btnM4AutoMatchExtra"'));

  const teacher = { id: 't1', name: 'Ali Yılmaz', branch: 'Matematik', extraSubjects: ['Bilişim Teknolojileri', 'Seç. İngilizce'] };
  assert.equal(DutyModule.doesTeacherExtraMatchCourse(teacher, 'Bilişim Teknolojileri ve Yazılım', 'BİL'), true);
  assert.equal(DutyModule.doesTeacherExtraMatchCourse(teacher, 'Türkçe', 'TÜR'), false);
});

test('2. Okul Nöbeti: En yoğun / en az ders gününe dağıtım, Müdür & Müdür Yrd. muafiyeti ve Aylık Rotasyonlu Çizelge', () => {
  const teachers = [
    { id: 't_mudur', name: 'Özcan Müdür', branch: 'Müzik', role: 'mudur', maxHours: 6, minHours: 1 },
    { id: 't_myrd', name: 'Ayşe Yrd.', branch: 'Türkçe', role: 'mudur_yardimcisi', maxHours: 6, minHours: 1 },
    { id: 't1', name: 'Mehmet Öğretmen', branch: 'Matematik', role: 'ogretmen', maxHours: 30, minHours: 1 },
    { id: 't2', name: 'Zeynep Öğretmen', branch: 'Fen Bilimleri', role: 'ogretmen', maxHours: 30, minHours: 1 }
  ];

  // t1: Pazartesi 6 saat (en yoğun), Cuma 1 saat (en az)
  // t2: Çarşamba 5 saat (en yoğun), Salı 1 saat (en az)
  const state = {
    school: { name: 'Atatürk Ortaokulu' },
    grid: { periodsPerDay: 7, slots: Array.from({ length: 5 }, () => Array(7).fill('ACTIVE')) },
    solution: {
      placements: [
        { class_id: 'c1', class_name: '5/A', course_code: 'MAT', course_name: 'Matematik', day_index: 0, start_period: 0, length: 6, teacher_ids: ['t1'] },
        { class_id: 'c1', class_name: '5/A', course_code: 'MAT', course_name: 'Matematik', day_index: 4, start_period: 0, length: 1, teacher_ids: ['t1'] },
        { class_id: 'c1', class_name: '5/A', course_code: 'FEN', course_name: 'Fen Bilimleri', day_index: 2, start_period: 0, length: 5, teacher_ids: ['t2'] },
        { class_id: 'c1', class_name: '5/A', course_code: 'FEN', course_name: 'Fen Bilimleri', day_index: 1, start_period: 0, length: 1, teacher_ids: ['t2'] }
      ]
    }
  };
  const activeDays = [0, 1, 2, 3, 4];

  // A) En yoğun ders gününe nöbet dağıt
  const rBusy = DutyModule.autoAssignSchoolDuties(state, teachers, activeDays, 'busiest_day');
  assert.equal(rBusy.assignedCount, 2);
  assert.equal(rBusy.skippedAdminsCount, 2);
  assert.equal(teachers[0].dutyDay, -1, 'Okul Müdürü nöbet tutmamalı');
  assert.equal(teachers[1].dutyDay, -1, 'Müdür Yardımcısı nöbet tutmamalı');
  assert.equal(teachers[2].dutyDay, 0, 'Mehmet en yoğun günü olan Pazartesi nöbet almalı');
  assert.equal(teachers[3].dutyDay, 2, 'Zeynep en yoğun günü olan Çarşamba nöbet almalı');

  // B) En az ders gününe nöbet dağıt
  const rLight = DutyModule.autoAssignSchoolDuties(state, teachers, activeDays, 'lightest_day');
  assert.equal(rLight.assignedCount, 2);
  assert.equal(teachers[0].dutyDay, -1);
  assert.equal(teachers[1].dutyDay, -1);
  assert.equal(teachers[2].dutyDay, 4, 'Mehmet en az ders günü olan Cuma nöbet almalı');
  assert.equal(teachers[3].dutyDay, 1, 'Zeynep en az ders günü olan Salı nöbet almalı');

  // C) Aylık nöbet çizelgesi (Kasım 2026) + haftalık rotasyon + yazdırılabilir HTML
  const monthly = DutyModule.buildMonthlyDutySchedule(state, teachers, activeDays, 2026, 11, true);
  assert.equal(monthly.monthName, 'Kasım');
  assert.ok(monthly.rows.length >= 20, 'Kasım 2026 en az 20 iş günü içermeli');
  const printHtml = DutyModule.buildMonthlyDutyPrintHtml(state, monthly);
  assert.ok(printHtml.includes('KASIM 2026 AYLIK ÖĞRETMEN NÖBET ÇİZELGESİ'));
  assert.equal(printHtml.includes('Özcan Müdür'), false, 'Müdür aylık nöbet listesinde görünmemeli');
});

test('3. Programı Kontrol Et: Tam adres göstererek tüm hata türlerini tespit eder', () => {
  const classes = [
    {
      id: 'c1', name: '7/A',
      courses: [
        { id: 'cr1', name: 'Matematik', hours: 5, teacherId: null }, // Boş ders hatası
        { id: 'cr2', name: 'Türkçe', hours: 35, teacherId: 't1' }   // Yük aşımı hatası (35 > 30)
      ]
    }
  ];
  const teachers = [
    { id: 't1', name: 'Ali Öğretmen', branch: 'Türkçe', role: 'ogretmen', minHours: 1, maxHours: 30, maxDaily: 7 },
    { id: 't_admin', name: 'Müdür Bey', branch: 'Tarih', role: 'mudur', minHours: 1, maxHours: 6, maxDaily: 6 }
  ];
  const state = {
    school: { name: 'Test Okulu' },
    grid: { periodsPerDay: 7, slots: Array.from({ length: 5 }, () => Array(7).fill('ACTIVE')) },
    dutyConfig: {
      locations: ['Bahçe'],
      weeklyAssignments: { 0: { Bahçe: ['t_admin'] } } // İdareci nöbet ihlali!
    },
    solution: { placements: [], unplaced: [{ class_name: '7/A', course_name: 'Fen Bilimleri', length: 2 }] }
  };
  const helpers = {
    getCurrentClasses: () => classes,
    getCurrentTeachers: () => teachers,
    getCurrentRooms: () => [],
    getSlotStats: () => ({ activeDayIndices: [0, 1, 2, 3, 4], openSlots: 35 })
  };

  const report = DutyModule.runFullAddressAudit(state, helpers, EditorLogic);
  assert.equal(report.isClean, false);
  assert.ok(report.errors.some((e) => e.address.includes('Menü 4 → Ders Atama → 7/A → Matematik')));
  assert.ok(report.errors.some((e) => e.address.includes('Menü 3 → Öğretmenler → Ali Öğretmen')));
  assert.ok(report.errors.some((e) => e.address.includes('Menü 6 → Okul Nöbeti → Pazartesi / Bahçe → Müdür Bey')));
  assert.ok(report.errors.some((e) => e.address.includes('Menü 5 → Otomatik Dağıtım → 7/A → Fen Bilimleri')));
});
