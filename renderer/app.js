'use strict';

/* =========================================================================
   1. MEB 2025-2026 / 2026-2027 OKUL TÜRLERİ (meb_curriculum.js'den yüklenir)
   ========================================================================= */
const ROOM_TYPES = [
  { id: 'standard', label: 'Standart Derslik' },
  { id: 'bilisim_lab', label: 'Bilişim / BT Lab' },
  { id: 'fen_lab', label: 'Fen / Fizik-Kimya-Biyoloji Lab' },
  { id: 'spor_salonu', label: 'Spor Salonu / Bahçe' },
  { id: 'muzik_odasi', label: 'Müzik Odası' },
  { id: 'gorsel_atolye', label: 'Görsel Sanatlar Atölyesi' },
  { id: 'tek_tasarim', label: 'Teknoloji Tasarım Atölyesi' },
  { id: 'uygulama_mescid', label: 'Uygulama / Mescid' }
];

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/* =========================================================================
   2. BLOK VE DERS ŞABLONLARI
   ========================================================================= */
function defaultBlocksForHours(h) {
  const n = Number(h) || 1;
  if (n <= 2) return [n];
  if (n === 3) return [2, 1];
  if (n === 4) return [2, 2];
  if (n === 5) return [2, 2, 1];
  if (n === 6) return [2, 2, 2];
  if (n === 8) return [2, 2, 2, 2];
  if (n === 10) return [2, 2, 2, 2, 2];
  if (n === 12) return [2, 2, 2, 2, 2, 2];
  if (n === 20) return [4, 4, 4, 4, 4];
  const res = []; let rem = n;
  while (rem >= 2) { res.push(2); rem -= 2; }
  if (rem === 1) res.push(1);
  return res;
}

function getBlockPresets(hours) {
  const h = Number(hours) || 1;
  if (h === 1) return [[1]];
  if (h === 2) return [[2], [1, 1]];
  if (h === 3) return [[2, 1], [3], [1, 1, 1]];
  if (h === 4) return [[2, 2], [2, 1, 1], [3, 1], [1, 1, 1, 1]];
  if (h === 5) return [[2, 2, 1], [3, 2], [2, 1, 1, 1], [1, 1, 1, 1, 1]];
  if (h === 6) return [[2, 2, 2], [3, 3], [2, 2, 1, 1]];
  if (h === 8) return [[2, 2, 2, 2], [2, 2, 2, 1, 1]];
  if (h === 10) return [[2, 2, 2, 2, 2], [3, 2, 2, 2, 1]];
  return [defaultBlocksForHours(h)];
}

function inferRoomType(name) {
  const n = (name || '').toLocaleLowerCase('tr-TR');
  if (n.includes('bilişim') || n.includes('robotik') || n.includes('yapay zek') || n.includes('dijital')) return 'bilisim_lab';
  if (n.includes('beden') || n.includes('spor') || n.includes('halk oyun')) return 'spor_salonu';
  if (n.includes('müzik')) return 'muzik_odasi';
  if (n.includes('görsel') || n.includes('sanat') || n.includes('hüsnühat')) return 'gorsel_atolye';
  if (n.includes('teknoloji ve tasarım')) return 'tek_tasarim';
  if (n.includes('fen bilimleri') || n.includes('fizik') || n.includes('kimya') || n.includes('biyoloji')) return 'fen_lab';
  if (n.includes('hitabet')) return 'uygulama_mescid';
  return 'standard';
}

/* getMebTemplatesForGrade() meb_curriculum.js dosyasından yüklenir. */

/* =========================================================================
   3. 7 MENÜ YAPISI
   ========================================================================= */
const MENU_ITEMS = [
  { id: 'menu1', step: 1, title: 'Kurum ve Zaman Çizelgesi' },
  { id: 'menu2', step: 2, title: 'Sınıflar, Şubeler ve Dersleri' },
  { id: 'menu3', step: 3, title: 'Öğretmenler ve Müsaitlik' },
  { id: 'menu4', step: 4, title: 'Derslikler ve Ders Atama' },
  { id: 'menu5', step: 5, title: 'Ders Dağıtımı' },
  { id: 'menu6', step: 6, title: 'Program Çıktıları ve Raporlar' },
  { id: 'menu7', step: 7, title: 'Proje Kayıt ve Yedekleme' }
];

/* =========================================================================
   4. UYGULAMA DURUMU VE ESKİ SÜRÜM GÖÇÜ (SIFIR DEMO VERİ)
   ========================================================================= */
const STORAGE_KEY = 'meb_ortools_timetable_v5';
const LEGACY_STORAGE_KEYS = [
  'meb_ortools_timetable_v4',
  'meb_ortools_timetable_v3',
  'meb_ortools_timetable_v2',
  'meb_ortools_timetable_v1'
];
const ARCHIVE_KEY = 'meb_ortools_saved_projects_v1';

function buildDefaultSlots(schoolTypeId, periodsPerDay, activeDays, ihoMode = '36') {
  const slots = {};
  for (let d = 0; d < 6; d++) {
    slots[d] = [];
    for (let p = 0; p < periodsPerDay; p++) slots[d].push('ACTIVE');
  }
  if (schoolTypeId === 'iho' && ihoMode === '36' && periodsPerDay === 8) {
    for (let d = 0; d < 4; d++) slots[d][7] = 'BLOCKED';
  }
  if (schoolTypeId === 'iho' && ihoMode === '27' && periodsPerDay === 6) {
    slots[2][5] = 'BLOCKED'; slots[3][5] = 'BLOCKED'; slots[4][5] = 'BLOCKED';
  }
  const meta = MEB_SCHOOL_TYPES[schoolTypeId];
  if (meta && meta.defaultTargetHours === 43 && periodsPerDay === 9) {
    slots[3][8] = 'BLOCKED'; slots[4][8] = 'BLOCKED';
  }
  return slots;
}

function createInitialState(schoolTypeId = 'ortaokul') {
  const meta = MEB_SCHOOL_TYPES[schoolTypeId];
  const activeDays = [true, true, true, true, true, false];
  const periodsPerDay = meta.defaultPeriods;
  return {
    activeView: 'menu1',
    brushMode: 'CYCLE',
    school: {
      name: '', academicYear: '2026-2027', coordinator: '',
      schoolTypeId, hasPrepClass: false, ihoMode: '36', shiftMode: 'single'
    },
    bell: {
      startTime: '08:30', afternoonStartTime: '13:00',
      lessonDuration: 40, breakDuration: 10,
      longBreakAfterPeriod: 2, longBreakDuration: 15,
      lunchAfterPeriod: periodsPerDay >= 7 ? 4 : 0, lunchDuration: 45
    },
    grid: {
      periodsPerDay, activeDays,
      slots: buildDefaultSlots(schoolTypeId, periodsPerDay, activeDays, '36')
    },
    classesBySchoolType: { [schoolTypeId]: [] },
    selectedClassId: null,
    gradeFilter: 'ALL',
    teachersBySchoolType: { [schoolTypeId]: [] },
    selectedTeacherId: null,
    teacherBranchFilter: 'ALL',
    teacherSearch: '',
    teacherBrush: 'CYCLE',
    roomsBySchoolType: { [schoolTypeId]: [] },
    m4ClassFilter: 'ALL',
    m4OnlyUnassigned: false,
    m4Search: '',
    distributionPreference: 'balanced',
    solution: null,
    lastSolveError: null,
    m5TplTab: 'class_sheet',
    m5EntityId: '',
    lockedTeacherIds: [],
    m6Tab: 'class',
    m6EntityId: 'ALL',
    pinnedPlacementIds: []
  };
}

const editorHistory = window.DersEditorLogic.createHistoryManager(40);
let pendingPreviewResult = null;
let pendingSwapPair = null;
let m6SwapSourceKey = null;
let m6DraggingKey = null;

function getEditorHelpers() {
  return {
    getSlotStats,
    computeBellSchedule,
    getClassShift,
    getBlockPhysicalSpan,
    physicalSpansOverlap,
    getCurrentClasses,
    getCurrentTeachers,
    getCurrentRooms,
    ensureTeacherAvailabilitySize,
    computeTeacherGaps
  };
}

function updateUndoRedoButtons() {
  const counts = editorHistory.counts();
  const uBtn = document.getElementById('btnM6Undo');
  const rBtn = document.getElementById('btnM6Redo');
  if (uBtn) {
    uBtn.disabled = !editorHistory.canUndo();
    uBtn.title = counts.undo ? `Geri Al (${counts.undo} adım)` : 'Geri alınacak işlem yok';
  }
  if (rBtn) {
    rBtn.disabled = !editorHistory.canRedo();
    rBtn.title = counts.redo ? `İleri Al (${counts.redo} adım)` : 'İleri alınacak işlem yok';
  }
}

function getPlacementKey(pl) {
  return window.DersEditorLogic.ensureBlockId(pl);
}

function migrateSolutionAndLocks(s) {
  if (!s.solution || !Array.isArray(s.solution.placements)) return;
  if (s.solution.engine === 'browser_js_iterative') {
    s.solution = null;
    s.pinnedPlacementIds = [];
    return;
  }
  const perAssignment = {};
  const legacyToNewKey = {};
  s.solution.placements.forEach((pl) => {
    const legacyKey = `${pl.assignment_id}__d${pl.day_index}_p${pl.start_period}`;
    if (pl.block_index === undefined || pl.block_index === null) {
      const idx = perAssignment[pl.assignment_id] || 0;
      pl.block_index = idx;
      perAssignment[pl.assignment_id] = idx + 1;
    } else {
      perAssignment[pl.assignment_id] = Math.max(perAssignment[pl.assignment_id] || 0, Number(pl.block_index) + 1);
    }
    pl.block_id = `${pl.assignment_id}__b${pl.block_index}`;
    legacyToNewKey[legacyKey] = pl.block_id;
  });
  if (Array.isArray(s.pinnedPlacementIds) && s.pinnedPlacementIds.length) {
    s.pinnedPlacementIds = Array.from(new Set(
      s.pinnedPlacementIds.map((k) => legacyToNewKey[k] || k)
    ));
  }
}

function ensureState(s) {
  const stId = s.school.schoolTypeId;
  if (!s.classesBySchoolType) s.classesBySchoolType = {};
  if (!Array.isArray(s.classesBySchoolType[stId])) s.classesBySchoolType[stId] = [];
  const list = s.classesBySchoolType[stId];
  if (!list.some((c) => c.id === s.selectedClassId)) {
    s.selectedClassId = list[0] ? list[0].id : null;
  }
  if (!s.teachersBySchoolType) s.teachersBySchoolType = {};
  if (!Array.isArray(s.teachersBySchoolType[stId])) s.teachersBySchoolType[stId] = [];
  const tList = s.teachersBySchoolType[stId];
  if (!tList.some((t) => t.id === s.selectedTeacherId)) {
    s.selectedTeacherId = tList[0] ? tList[0].id : null;
  }
  if (!s.teacherBranchFilter) s.teacherBranchFilter = 'ALL';
  if (!s.teacherBrush) s.teacherBrush = 'CYCLE';
  if (!s.roomsBySchoolType) s.roomsBySchoolType = {};
  if (!Array.isArray(s.roomsBySchoolType[stId])) s.roomsBySchoolType[stId] = [];
  if (!s.m4ClassFilter) s.m4ClassFilter = 'ALL';
  if (!['balanced', 'fewer_gaps', 'spread_days'].includes(s.distributionPreference)) {
    s.distributionPreference = 'balanced';
  }
  if (!s.m5TplTab) s.m5TplTab = 'class_sheet';
  if (!Array.isArray(s.lockedTeacherIds)) s.lockedTeacherIds = [];
  if (!s.m6Tab) s.m6Tab = 'class';
  if (!s.m6EntityId) s.m6EntityId = 'ALL';
  if (!Array.isArray(s.pinnedPlacementIds)) s.pinnedPlacementIds = [];
  if (!MENU_ITEMS.some((m) => m.id === s.activeView)) s.activeView = 'menu1';
  if (window.DersExportEngine) {
    s.exportSettings = {
      ...window.DersExportEngine.createDefaultExportSettings(),
      ...(s.exportSettings || {})
    };
  }
  migrateSolutionAndLocks(s);
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const oldKey of LEGACY_STORAGE_KEYS) {
        const legacy = localStorage.getItem(oldKey);
        if (legacy) { raw = legacy; break; }
      }
    }
    if (!raw) return createInitialState('ortaokul');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.school || !MEB_SCHOOL_TYPES[parsed.school.schoolTypeId]) {
      return createInitialState('ortaokul');
    }
    ensureState(parsed);
    return parsed;
  } catch (e) {
    return createInitialState('ortaokul');
  }
}

function saveState(opts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  if ((!opts || !opts.skipAutoSync) && window.EvrakPlusUI && typeof window.EvrakPlusUI.notifyLocalChange === 'function') {
    window.EvrakPlusUI.notifyLocalChange();
  }
}

let state = loadState();
let isPainting = false;
let paintTargetValue = 'ACTIVE';
let modalDraftBlocks = [2];
let engineInfoState = { checked: false, available: false, version: null, error: null };

/* =========================================================================
   5. YARDIMCI HESAPLAMALAR VE FİZİKSEL ZAMAN KONTROLLERİ
   ========================================================================= */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getActiveGrades() {
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const list = [];
  if (meta.hasPrepOption && state.school.hasPrepClass && meta.prepGrade) list.push(meta.prepGrade);
  meta.grades.forEach((g) => list.push(g));
  return list;
}

function getCurrentClasses() { ensureState(state); return state.classesBySchoolType[state.school.schoolTypeId]; }
function getCurrentRooms() { ensureState(state); return state.roomsBySchoolType[state.school.schoolTypeId]; }
function getCurrentTeachers() { ensureState(state); return state.teachersBySchoolType[state.school.schoolTypeId]; }
function getSelectedTeacher() { const l = getCurrentTeachers(); return l.find((t) => t.id === state.selectedTeacherId) || l[0] || null; }
function getSelectedClass() { const l = getCurrentClasses(); return l.find((c) => c.id === state.selectedClassId) || l[0] || null; }

function isBranchMatchingCourse(branch, courseName) {
  const b = (branch || '').toLocaleLowerCase('tr-TR');
  const c = (courseName || '').toLocaleLowerCase('tr-TR');
  if (!b || !c) return false;
  if (b.includes('sınıf öğretmen')) return !c.includes('yabancı dil') && !c.includes('din kültürü');
  if (b.includes('türkçe') || b.includes('edebiyat')) return c.includes('türkçe') || c.includes('edebiyat') || c.includes('okuma') || c.includes('yazarlık') || c.includes('masal') || c.includes('metin');
  if (b.includes('matematik')) return c.includes('matematik');
  if (b.includes('fen')) return c.includes('fen');
  if (b.includes('fizik')) return c.includes('fizik');
  if (b.includes('kimya')) return c.includes('kimya');
  if (b.includes('biyoloji')) return c.includes('biyoloji') || c.includes('genetik') || c.includes('tıp') || c.includes('sağlık');
  if (b.includes('sosyal')) return c.includes('sosyal') || c.includes('inkılap') || c.includes('hukuk') || c.includes('şehrimiz') || c.includes('vatandaş');
  if (b.includes('tarih')) return c.includes('tarih') || c.includes('inkılap');
  if (b.includes('coğrafya')) return c.includes('coğrafya') || c.includes('çevre') || c.includes('iklim');
  if (b.includes('felsefe')) return c.includes('felsefe') || c.includes('psikoloji') || c.includes('sosyoloji') || c.includes('mantık') || c.includes('düşünme');
  if (b.includes('ingilizce')) return c.includes('yabancı dil') || c.includes('ingilizce');
  if (b.includes('almanca') || b.includes('2. yabancı')) return c.includes('ikinci yabancı') || c.includes('almanca');
  if (b.includes('arapça')) return c.includes('arapça');
  if (b.includes('ihl meslek')) return c.includes('kur') || c.includes('siyer') || c.includes('fıkıh') || c.includes('hadis') || c.includes('tefsir') || c.includes('kelam') || c.includes('akaid') || c.includes('hitabet') || c.includes('peygamber') || c.includes('dinî');
  if (b.includes('din kültürü')) return c.includes('din') || c.includes('kur') || c.includes('peygamber') || c.includes('ahlak');
  if (b.includes('bilişim')) return c.includes('bilişim') || c.includes('robotik') || c.includes('yapay zek') || c.includes('dijital');
  if (b.includes('teknoloji ve tasarım')) return c.includes('teknoloji ve tasarım');
  if (b.includes('görsel')) return c.includes('görsel') || c.includes('sanat');
  if (b.includes('müzik')) return c.includes('müzik') || c.includes('musiki');
  if (b.includes('beden')) return c.includes('beden') || c.includes('spor') || c.includes('oyun');
  if (b.includes('rehberlik')) return c.includes('rehberlik');
  return c.includes(b);
}

function createDefaultAvailability() {
  const avail = {};
  for (let d = 0; d < 6; d++) {
    avail[d] = [];
    for (let p = 0; p < state.grid.periodsPerDay; p++) {
      const schoolSlot = (state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE';
      avail[d].push(schoolSlot === 'BLOCKED' ? 'UNAVAILABLE' : 'AVAILABLE');
    }
  }
  return avail;
}

function ensureTeacherAvailabilitySize(t) {
  if (!t.availability) t.availability = createDefaultAvailability();
  for (let d = 0; d < 6; d++) {
    if (!Array.isArray(t.availability[d])) t.availability[d] = [];
    while (t.availability[d].length < state.grid.periodsPerDay) {
      const schoolSlot = (state.grid.slots[d] && state.grid.slots[d][t.availability[d].length]) || 'ACTIVE';
      t.availability[d].push(schoolSlot === 'BLOCKED' ? 'UNAVAILABLE' : 'AVAILABLE');
    }
  }
}

function generateFallbackTeacherName(branch) {
  const existing = getCurrentTeachers().filter((t) => t.branch === branch);
  return `${branch} ${existing.length + 1}`;
}

function makeTeacherShortCode(name) {
  const words = (name || 'OG').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0].slice(0, 2) + words[words.length - 1].slice(0, 2)).toUpperCase();
}

function getTargetWeeklyHours() {
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  if (state.school.schoolTypeId === 'iho') return Number(state.school.ihoMode) || 36;
  return meta.defaultTargetHours;
}

function getCourseBlocks(c) {
  if (c.blockMode === 'auto' || !Array.isArray(c.blocks) || c.blocks.length === 0) {
    return defaultBlocksForHours(c.hours);
  }
  return c.blocks;
}

function evaluateClass(cls) {
  const grades = getActiveGrades();
  const gradeObj = grades.find((g) => g.key === cls.gradeKey) || grades[0];
  const courses = cls.courses || [];
  const mand = courses.filter((c) => c.category === 'zorunlu' || c.category === 'meslek' || c.category === 'serbest');
  const elec = courses.filter((c) => c.category === 'secmeli');
  const ext = courses.filter((c) => c.category === 'harici');

  const mandHours = mand.reduce((s, c) => s + (Number(c.hours) || 0), 0);
  const elecHours = elec.reduce((s, c) => s + (Number(c.hours) || 0), 0);
  const extHours = ext.reduce((s, c) => s + (Number(c.hours) || 0), 0);
  const totalHours = mandHours + elecHours + extHours;
  const targetTotal = state.school.schoolTypeId === 'iho' ? getTargetWeeklyHours() : gradeObj.total;
  const isPrimarySchool = state.school.schoolTypeId === 'ilkokul' || state.school.schoolTypeId === 'muzik_ilkokul';
  const targetElective = isPrimarySchool ? 0 : (gradeObj.elective || 0);
  const totalBlocks = courses.reduce((s, c) => s + getCourseBlocks(c).length, 0);

  const issues = [];
  if (totalHours < targetTotal) issues.push(`Haftalık hedefe ${targetTotal - totalHours} saat eksik (${totalHours}/${targetTotal} sa)`);
  else if (totalHours > targetTotal) issues.push(`Haftalık hedeften ${totalHours - targetTotal} saat fazla (${totalHours}/${targetTotal} sa)`);

  const isThreeGroupMiddle = state.school.schoolTypeId === 'ortaokul' || state.school.schoolTypeId === 'muzik_ortaokul' || state.school.schoolTypeId === 'spor_ortaokul';
  if (targetElective > 0 && elec.length > 0 && isThreeGroupMiddle) {
    const grps = new Set(elec.map((c) => c.group).filter(Boolean));
    const req = ['İnsan, Toplum ve Bilim', 'Din, Ahlak ve Değer', 'Kültür, Sanat ve Spor'];
    const miss = req.filter((g) => !grps.has(g));
    if (miss.length > 0) issues.push(`Ortaokulda 3 seçmeli gruptan da ders seçilmeli (Eksik: ${miss.join(', ')})`);
  }

  return { gradeObj, mand, elec, ext, mandHours, elecHours, extHours, totalHours, targetTotal, targetElective, totalBlocks, issues, isValid: issues.length === 0 && totalHours === targetTotal };
}

function parseTimeToMinutes(hhmm) {
  const p = (hhmm || '08:30').split(':').map(Number);
  return (p.length === 2 && !Number.isNaN(p[0]) && !Number.isNaN(p[1])) ? p[0] * 60 + p[1] : 510;
}
function formatMinutes(t) {
  const n = ((t % 1440) + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}
function computeShiftSchedule(startStr, includeLunch) {
  const { lessonDuration, breakDuration, longBreakAfterPeriod, longBreakDuration, lunchAfterPeriod, lunchDuration } = state.bell;
  const count = state.grid.periodsPerDay;
  const sch = [];
  let cur = parseTimeToMinutes(startStr);
  const lA = includeLunch ? (Number(lunchAfterPeriod) || 0) : 0;
  const lbA = Number(longBreakAfterPeriod) || 0;
  for (let i = 1; i <= count; i++) {
    const s = cur, e = s + (Number(lessonDuration) || 40);
    sch.push({ period: i, start: formatMinutes(s), end: formatMinutes(e), startMin: s, endMin: e, isAfterLunch: lA > 0 && i === lA + 1, isAfterLongBreak: lbA > 0 && lbA !== lA && i === lbA + 1 });
    cur = e;
    if (i < count) cur += (lA === i ? (Number(lunchDuration) || 45) : (lbA === i ? (Number(longBreakDuration) || 15) : (Number(breakDuration) || 10)));
  }
  return sch;
}
function computeBellSchedule() {
  const isDouble = state.school.shiftMode === 'double';
  return { primary: computeShiftSchedule(state.bell.startTime, !isDouble), afternoon: isDouble ? computeShiftSchedule(state.bell.afternoonStartTime, false) : null, isDouble };
}
function getClassShift(classId) {
  if (state.school.shiftMode !== 'double') return 'full_day';
  const cls = getCurrentClasses().find((c) => c.id === classId);
  return (cls && cls.shift === 'afternoon') ? 'afternoon' : 'morning';
}
function getBlockPhysicalSpan(classId, startPeriod, length) {
  const { primary, afternoon, isDouble } = computeBellSchedule();
  const shift = getClassShift(classId);
  const arr = (isDouble && shift === 'afternoon' && afternoon) ? afternoon : primary;
  if (!arr || startPeriod < 0 || startPeriod + length > arr.length) {
    return [startPeriod * 50, (startPeriod + length) * 50];
  }
  return [arr[startPeriod].startMin, arr[startPeriod + length - 1].endMin];
}
function physicalSpansOverlap(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}
function getSlotStats() {
  let active = 0, commonElective = 0, blocked = 0; const activeDayIndices = [];
  for (let d = 0; d < 6; d++) {
    if (!state.grid.activeDays[d]) continue;
    activeDayIndices.push(d);
    for (let p = 0; p < state.grid.periodsPerDay; p++) {
      const val = (state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE';
      if (val === 'ACTIVE') active++; else if (val === 'COMMON_ELECTIVE') commonElective++; else blocked++;
    }
  }
  return { active, commonElective, openTotal: active + commonElective, blocked, activeDayIndices };
}
function getNextCycleValue(cur) { return cur === 'ACTIVE' ? 'COMMON_ELECTIVE' : (cur === 'COMMON_ELECTIVE' ? 'BLOCKED' : 'ACTIVE'); }

function validateManualPlacement(candidate, ignorePlacement = null) {
  const res = window.DersEditorLogic.validateManualPlacementFull(
    state,
    candidate,
    getEditorHelpers(),
    ignorePlacement ? [ignorePlacement] : []
  );
  return res.valid ? null : res.error;
}

function buildOrToolsConfig() {
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const { primary, afternoon, isDouble } = computeBellSchedule();
  const stats = getSlotStats();
  const blockedSlots = [], commonElectiveSlots = [];
  stats.activeDayIndices.forEach((d, cIdx) => {
    for (let p = 0; p < state.grid.periodsPerDay; p++) {
      const v = (state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE';
      if (v === 'BLOCKED') blockedSlots.push({ day_index: cIdx, day_name: DAY_NAMES[d], period: p + 1 });
      else if (v === 'COMMON_ELECTIVE') commonElectiveSlots.push({ day_index: cIdx, day_name: DAY_NAMES[d], period: p + 1 });
    }
  });

  return {
    schema_version: '4.0-meb-2026-2027',
    solver_target: 'google_ortools_cp_sat',
    school: {
      name: state.school.name || null, academic_year: state.school.academicYear,
      coordinator: state.school.coordinator || null, meb_school_type: meta.id,
      meb_decision: meta.decision, shift_mode: state.school.shiftMode,
      weekly_target_hours: getTargetWeeklyHours()
    },
    time_grid: {
      num_days: stats.activeDayIndices.length,
      days: stats.activeDayIndices.map((d, idx) => ({ index: idx, name: DAY_NAMES[d] })),
      periods_per_day: state.grid.periodsPerDay,
      lunch_break: {
        after_period: state.school.shiftMode === 'single' ? Number(state.bell.lunchAfterPeriod || 0) : 0,
        duration_min: Number(state.bell.lunchDuration || 0)
      },
      long_break: {
        after_period: Number(state.bell.longBreakAfterPeriod || 0),
        duration_min: Number(state.bell.longBreakDuration || 0),
        prevent_block_split: false
      },
      teaching_day_indices: stats.activeDayIndices,
      bell_schedule: isDouble
        ? { morning: primary.map((b) => ({ period: b.period, start: b.start, end: b.end })), afternoon: afternoon.map((b) => ({ period: b.period, start: b.start, end: b.end })) }
        : primary.map((b) => ({ period: b.period, start: b.start, end: b.end })),
      blocked_slots: blockedSlots,
      common_elective_slots: commonElectiveSlots
    },
    classes: getCurrentClasses().map((cls) => {
      const ev = evaluateClass(cls);
      return {
        id: cls.id, name: cls.name, grade_key: cls.gradeKey,
        student_count: cls.studentCount, home_room: cls.homeRoom || null,
        shift: isDouble ? (cls.shift || 'morning') : 'full_day',
        total_weekly_hours: ev.totalHours,
        courses: (cls.courses || []).map((c) => ({
          id: c.id, code: c.code, name: c.name, category: c.category, group: c.group || null,
          hours: c.hours, blocks: getCourseBlocks(c), max_blocks_per_day: c.maxPerDay || 1,
          room_type: c.roomType || 'standard',
          split_groups: c.splitGroups ? 2 : 1,
          use_common_elective_slot: Boolean(c.useCommonSlot)
        }))
      };
    }),
    teachers: getCurrentTeachers().map((t) => {
      ensureTeacherAvailabilitySize(t);
      const unavail = [], preferAvoid = [];
      stats.activeDayIndices.forEach((d, cIdx) => {
        for (let p = 0; p < state.grid.periodsPerDay; p++) {
          const v = (t.availability[d] && t.availability[d][p]) || 'AVAILABLE';
          if (v === 'UNAVAILABLE') unavail.push({ day_index: cIdx, day_name: DAY_NAMES[d], period: p + 1 });
          else if (v === 'PREFER_AVOID') preferAvoid.push({ day_index: cIdx, day_name: DAY_NAMES[d], period: p + 1 });
        }
      });
      return {
        id: t.id, name: t.name, short_code: t.shortCode || makeTeacherShortCode(t.name),
        branch: t.branch, min_weekly_hours: t.minHours, max_weekly_hours: t.maxHours,
        max_daily_hours: t.maxDaily,
        max_consecutive_hours: Number(t.maxConsecutive || 0),
        max_daily_gaps: Number(t.maxDailyGaps || 0),
        max_working_days: Number(t.maxWorkingDays || 0),
        duty_day: t.dutyDay >= 0 ? DAY_NAMES[t.dutyDay] : null,
        unavailable_slots: unavail, prefer_avoid_slots: preferAvoid
      };
    }),
    rooms: getCurrentRooms().map((r) => ({
      id: r.id, name: r.name, room_type: r.roomType, simultaneous_capacity: r.capacity || 1
    })),
    assignments: (() => {
      const out = [];
      const teachers = getCurrentTeachers();
      getCurrentClasses().forEach((cls) => {
        (cls.courses || []).forEach((c) => {
          const tIds = [];
          if (c.teacherId) tIds.push(c.teacherId);
          if (c.splitGroups && c.teacherId2) tIds.push(c.teacherId2);
          const primaryT = teachers.find((t) => t.id === c.teacherId);
          out.push({
            assignment_id: `${cls.id}__${c.id}`,
            class_id: cls.id, class_name: cls.name,
            course_id: c.id, course_code: c.code, course_name: c.name,
            hours: c.hours, blocks: getCourseBlocks(c),
            teacher_ids: tIds,
            is_cross_branch: primaryT ? !isBranchMatchingCourse(primaryT.branch, c.name) : false,
            room_id: c.assignedRoomId || null,
            room_type: c.roomType || 'standard',
            max_blocks_per_day: c.maxPerDay || 1,
            use_common_elective_slot: Boolean(c.useCommonSlot)
          });
        });
      });
      return out;
    })(),
    solver_config: {
      engine: 'google_ortools_cp_sat',
      max_time_seconds: 60,
      preference: state.distributionPreference || 'balanced'
    },
    solution_request: {
      mode: 'respect_locks',
      preference: state.distributionPreference || 'balanced'
    },
    fixed_assignments: (state.solution && Array.isArray(state.solution.placements))
      ? state.solution.placements.filter((pl) =>
          (state.pinnedPlacementIds || []).includes(getPlacementKey(pl)) ||
          (pl.teacher_ids || []).some((tid) => (state.lockedTeacherIds || []).includes(tid))
        )
      : []
  };
}

/* =========================================================================
   6. ORTAK + MENÜ 1 RENDER
   ========================================================================= */
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  toast.classList.remove('hidden'); toast.classList.add('flex');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { toast.classList.add('hidden'); toast.classList.remove('flex'); }, 2800);
}

function renderSidebar() {
  const nav = document.getElementById('navMenu');
  nav.innerHTML = MENU_ITEMS.map((item) => {
    const isSel = state.activeView === item.id;
    return `
      <button type="button" data-menu-id="${item.id}" class="nav-item-btn w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition ${isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${isSel ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}">${item.step}</span>
          <span class="text-xs font-medium truncate">${item.title}</span>
        </div>
      </button>
    `;
  }).join('');
  nav.querySelectorAll('.nav-item-btn').forEach((btn) => {
    btn.addEventListener('click', () => { state.activeView = btn.dataset.menuId; saveState(); renderAll(); closeMobileSidebar(); });
  });
}

function applySchoolTypeDefaults(schoolTypeId, customIhoMode) {
  const meta = MEB_SCHOOL_TYPES[schoolTypeId];
  const ihoMode = customIhoMode || (schoolTypeId === 'iho' ? state.school.ihoMode : '36');
  let periods = meta.defaultPeriods;
  if (schoolTypeId === 'iho') periods = ihoMode === '27' ? 6 : 8;
  state.school.schoolTypeId = schoolTypeId;
  state.school.ihoMode = ihoMode;
  state.grid.periodsPerDay = periods;
  state.grid.activeDays = [true, true, true, true, true, false];
  state.grid.slots = buildDefaultSlots(schoolTypeId, periods, state.grid.activeDays, ihoMode);
  state.bell.lunchAfterPeriod = (state.school.shiftMode === 'single' && periods >= 7) ? 4 : 0;
  ensureState(state);
  saveState(); renderAll();
}

function renderMenu1() {
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const target = getTargetWeeklyHours();
  const stats = getSlotStats();
  const { primary, afternoon, isDouble } = computeBellSchedule();
  const grades = getActiveGrades();

  document.getElementById('kpiSchoolType').textContent = meta.shortName;
  document.getElementById('kpiDecisionNo').textContent = meta.decision;
  document.getElementById('kpiTargetHours').textContent = target + ' saat';
  document.getElementById('kpiGradesText').textContent = grades.map((g) => g.grade.replace('. Sınıf', '')).join(', ') + '. sınıflar';
  document.getElementById('kpiOpenSlots').textContent = stats.openTotal;
  document.getElementById('kpiCommonSlots').textContent = stats.commonElective > 0 ? `(${stats.commonElective} ortak)` : '';
  const capEl = document.getElementById('kpiCapacityStatus');
  if (stats.openTotal === target) { capEl.textContent = 'Hedef saatle tam uyumlu'; capEl.className = 'text-xs font-medium mt-0.5 text-emerald-600'; }
  else if (stats.openTotal > target) { capEl.textContent = `+${stats.openTotal - target} fazla slot`; capEl.className = 'text-xs font-medium mt-0.5 text-amber-600'; }
  else { capEl.textContent = `${target - stats.openTotal} slot eksik`; capEl.className = 'text-xs font-medium mt-0.5 text-rose-600'; }

  const fS = primary.length ? primary[0].start : '--:--', lE = primary.length ? primary[primary.length - 1].end : '--:--';
  document.getElementById('kpiTimeSpan').textContent = isDouble && afternoon ? `İkili · ${fS} / ${afternoon[0].start}` : `${fS} – ${lE}`;
  document.getElementById('kpiGridDims').textContent = `${isDouble ? 'İkili' : 'Tekli'} · ${stats.activeDayIndices.length} gün × ${state.grid.periodsPerDay} ders`;

  const stGrid = document.getElementById('schoolTypeGrid');
  const groups = (typeof MEB_SCHOOL_GROUPS !== 'undefined' && Array.isArray(MEB_SCHOOL_GROUPS))
    ? MEB_SCHOOL_GROUPS
    : [{ id: 'all', title: 'Okul Türleri', subtitle: '', schoolIds: Object.keys(MEB_SCHOOL_TYPES) }];

  stGrid.innerHTML = groups.map((grp) => {
    const cards = grp.schoolIds
      .map((id) => MEB_SCHOOL_TYPES[id])
      .filter(Boolean)
      .map((t) => {
        const act = t.id === state.school.schoolTypeId;
        return `<button type="button" data-school-type="${t.id}" class="school-type-btn text-left p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${act ? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-600 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'}">
          <div class="min-w-0">
            <div class="text-xs font-bold ${act ? 'text-indigo-900' : 'text-slate-800'} leading-snug">${t.name}</div>
            <div class="text-[10px] text-slate-500 mt-0.5 truncate">${t.decision}</div>
          </div>
          <span class="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-md ${act ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}">${t.defaultTargetHours} sa</span>
        </button>`;
      }).join('');
    const hasActiveInGroup = grp.schoolIds.includes(state.school.schoolTypeId);
    return `
      <div class="rounded-xl border ${hasActiveInGroup ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200/80 bg-slate-50/40'} p-2.5 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-1 px-0.5">
          <div class="text-[11px] font-extrabold ${hasActiveInGroup ? 'text-indigo-900' : 'text-slate-700'}">${grp.title}</div>
          ${grp.subtitle ? `<div class="text-[10px] text-slate-400 font-medium">${grp.subtitle}</div>` : ''}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${cards}</div>
      </div>
    `;
  }).join('');
  stGrid.querySelectorAll('.school-type-btn').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.schoolType !== state.school.schoolTypeId) {
      applySchoolTypeDefaults(b.dataset.schoolType);
      showToast(MEB_SCHOOL_TYPES[b.dataset.schoolType].name + ' seçildi');
    }
  }));

  const box = document.getElementById('specialOptionsContainer');
  if (meta.hasPrepOption) {
    box.classList.remove('hidden');
    box.innerHTML = `<div class="flex items-center justify-between gap-3"><div><div class="text-xs font-semibold text-slate-800">Hazırlık Sınıfı</div><div class="text-[11px] text-slate-500">40 saatlik hazırlık çizelgesini dahil et.</div></div><label class="inline-flex items-center gap-2 cursor-pointer"><input id="chkPrepClass" type="checkbox" ${state.school.hasPrepClass ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600" /><span class="text-xs font-semibold">${state.school.hasPrepClass ? 'Dahil' : 'Yok'}</span></label></div>`;
    document.getElementById('chkPrepClass').addEventListener('change', (e) => { state.school.hasPrepClass = e.target.checked; saveState(); renderAll(); });
  } else if (meta.hasIhoModes) {
    box.classList.remove('hidden');
    box.innerHTML = `<div class="text-xs font-semibold text-slate-800">İHO Haftalık Saat Programı</div><div class="grid grid-cols-3 gap-2">${['36', '40', '27'].map((m) => `<button type="button" data-iho-mode="${m}" class="iho-mode-btn p-2 rounded-lg border text-xs font-bold ${state.school.ihoMode === m ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-700'}">${m} Saat</button>`).join('')}</div>`;
    box.querySelectorAll('.iho-mode-btn').forEach((b) => b.addEventListener('click', () => applySchoolTypeDefaults('iho', b.dataset.ihoMode)));
  } else { box.classList.add('hidden'); box.innerHTML = ''; }

  const thExtra = document.getElementById('thExtraCol');
  thExtra.classList.toggle('hidden', !meta.hasMeslekCol);
  if (meta.hasMeslekCol) thExtra.textContent = meta.extraColLabel || 'Meslek';
  const tOvr = state.school.schoolTypeId === 'iho' ? target : null;
  document.getElementById('mebSummaryTbody').innerHTML = grades.map((g) => `<tr>
    <td class="py-2 pr-1.5 font-semibold text-slate-800 whitespace-nowrap">${g.grade}</td>
    <td class="py-2 px-1.5 text-right text-slate-600 whitespace-nowrap">${g.core}</td>
    ${meta.hasMeslekCol ? `<td class="py-2 px-1.5 text-right text-slate-600 whitespace-nowrap">${g.meslek || 0}</td>` : ''}
    <td class="py-2 px-1.5 text-right text-slate-600 whitespace-nowrap">${g.elective}</td>
    <td class="py-2 px-1.5 text-right text-slate-600 whitespace-nowrap">${g.guidance > 0 ? g.guidance : '–'}</td>
    <td class="py-2 pl-1.5 text-right font-bold text-indigo-700 whitespace-nowrap">${tOvr || g.total}</td>
  </tr>`).join('');
  document.getElementById('mebNotesBox').innerHTML = `<div class="font-semibold text-indigo-950 mb-1">Notlar</div>` + meta.notes.map((n) => `<div>• ${n}</div>`).join('');

  document.getElementById('btnShiftSingle').className = 'shift-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition ' + (!isDouble ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600');
  document.getElementById('btnShiftDouble').className = 'shift-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition ' + (isDouble ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600');
  document.getElementById('lblStartTime').textContent = isDouble ? 'Sabahçı Başlangıç' : 'İlk Ders Başlangıç';
  document.getElementById('afternoonStartWrap').classList.toggle('hidden', !isDouble);
  document.getElementById('lunchBreakBox').classList.toggle('hidden', isDouble);

  const dBox = document.getElementById('dayCheckboxes');
  dBox.innerHTML = DAY_SHORT.map((lb, idx) => `<button type="button" data-day-idx="${idx}" class="day-toggle-btn px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${state.grid.activeDays[idx] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-300'}">${lb}</button>`).join('');
  dBox.querySelectorAll('.day-toggle-btn').forEach((b) => b.addEventListener('click', () => {
    const idx = Number(b.dataset.dayIdx);
    if (state.grid.activeDays[idx] && state.grid.activeDays.filter(Boolean).length <= 1) return;
    state.grid.activeDays[idx] = !state.grid.activeDays[idx]; saveState(); renderAll();
  }));

  const bStyles = { CYCLE: 'bg-slate-900 text-white border-slate-900', ACTIVE: 'bg-emerald-600 text-white border-emerald-600', COMMON_ELECTIVE: 'bg-amber-500 text-white border-amber-500', BLOCKED: 'bg-slate-600 text-white border-slate-600' };
  document.querySelectorAll('.brush-btn').forEach((b) => { b.className = 'brush-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ' + (state.brushMode === b.dataset.brush ? bStyles[b.dataset.brush] : 'bg-white text-slate-600 border-slate-300'); });

  renderSlotMatrix();
}

function applySlotStyle(btn, val) {
  let cs = 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-800', lb = 'Açık';
  if (val === 'COMMON_ELECTIVE') { cs = 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'; lb = 'Ortak Seçmeli'; }
  else if (val === 'BLOCKED') { cs = 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-400 line-through'; lb = 'Kapalı'; }
  btn.className = 'slot-cell w-full py-2 px-1 rounded-lg border text-xs font-semibold ' + cs;
  btn.textContent = lb;
}

function renderSlotMatrix() {
  const { primary, afternoon, isDouble } = computeBellSchedule();
  const stats = getSlotStats();
  const target = getTargetWeeklyHours();
  const diff = stats.openTotal - target;
  const banner = document.getElementById('capacityBanner');
  if (diff === 0) { banner.className = 'rounded-xl px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800'; banner.innerHTML = `<span><strong>Tam Uyumlu:</strong> ${stats.openTotal} / ${target} saat.</span><span>Ortak: ${stats.commonElective} · Kapalı: ${stats.blocked}</span>`; }
  else if (diff > 0) { banner.className = 'rounded-xl px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 text-amber-900'; banner.innerHTML = `<span><strong>+${diff} Fazla Slot:</strong> ${stats.openTotal} açık (hedef ${target}).</span><span>Ortak: ${stats.commonElective} · Kapalı: ${stats.blocked}</span>`; }
  else { banner.className = 'rounded-xl px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 text-rose-800'; banner.innerHTML = `<span><strong>${Math.abs(diff)} Eksik Slot:</strong> ${stats.openTotal} / ${target} saat.</span><span>Ortak: ${stats.commonElective} · Kapalı: ${stats.blocked}</span>`; }

  const head = document.getElementById('slotMatrixHead');
  head.innerHTML = `<th class="p-2 text-left text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 w-36">Ders / Zil</th>` +
    stats.activeDayIndices.map((d) => {
      let open = 0; for (let p = 0; p < state.grid.periodsPerDay; p++) if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') !== 'BLOCKED') open++;
      return `<th class="p-1.5 text-center bg-slate-50 border border-slate-200"><button type="button" data-col-day="${d}" class="col-bulk-btn w-full py-1 rounded-lg hover:bg-indigo-50 transition"><div class="text-xs font-semibold text-slate-700">${DAY_NAMES[d]}</div><div class="text-[10px] text-slate-400">${open} açık</div></button></th>`;
    }).join('');

  const tbody = document.getElementById('slotMatrixBody');
  const rows = [];
  primary.forEach((b, pIdx) => {
    if (b.isAfterLongBreak) rows.push(`<tr><td colspan="${stats.activeDayIndices.length + 1}" class="py-1 px-3 bg-amber-50/70 border border-slate-200 text-center text-[11px] font-semibold text-amber-800">Uzun Teneffüs (${state.bell.longBreakDuration} dk)</td></tr>`);
    if (b.isAfterLunch) rows.push(`<tr><td colspan="${stats.activeDayIndices.length + 1}" class="py-1.5 px-3 bg-indigo-50/60 border border-slate-200 text-center text-[11px] font-semibold text-indigo-700">Öğle Arası (${state.bell.lunchDuration} dk)</td></tr>`);
    const aft = isDouble && afternoon && afternoon[pIdx] ? `<div class="text-[10px] text-amber-700 font-mono">Ö: ${afternoon[pIdx].start}–${afternoon[pIdx].end}</div>` : '';
    const cells = stats.activeDayIndices.map((d) => {
      const val = (state.grid.slots[d] && state.grid.slots[d][pIdx]) || 'ACTIVE';
      let cs = 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-800', lb = 'Açık';
      if (val === 'COMMON_ELECTIVE') { cs = 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'; lb = 'Ortak Seçmeli'; }
      else if (val === 'BLOCKED') { cs = 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-400 line-through'; lb = 'Kapalı'; }
      return `<td class="p-1 border border-slate-200 text-center"><button type="button" data-d="${d}" data-p="${pIdx}" class="slot-cell w-full py-2 px-1 rounded-lg border text-xs font-semibold ${cs}">${lb}</button></td>`;
    }).join('');
    rows.push(`<tr><td class="p-1.5 border border-slate-200 bg-slate-50/60"><button type="button" data-row-period="${pIdx}" class="row-bulk-btn w-full text-left px-1.5 py-1 rounded-lg hover:bg-indigo-50"><div class="text-xs font-bold text-slate-800">${b.period}. Ders</div><div class="text-[10px] text-slate-500 font-mono">${isDouble ? 'S: ' : ''}${b.start}–${b.end}</div>${aft}</button></td>${cells}</tr>`);
  });
  tbody.innerHTML = rows.join('');

  head.querySelectorAll('.col-bulk-btn').forEach((btn) => btn.addEventListener('click', () => {
    const d = Number(btn.dataset.colDay);
    let tVal = state.brushMode;
    if (tVal === 'CYCLE') {
      let hasOpen = false; for (let p = 0; p < state.grid.periodsPerDay; p++) if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') !== 'BLOCKED') hasOpen = true;
      tVal = hasOpen ? 'BLOCKED' : 'ACTIVE';
    }
    for (let p = 0; p < state.grid.periodsPerDay; p++) state.grid.slots[d][p] = tVal;
    saveState(); renderMenu1();
  }));
  tbody.querySelectorAll('.row-bulk-btn').forEach((btn) => btn.addEventListener('click', () => {
    const pIdx = Number(btn.dataset.rowPeriod);
    let tVal = state.brushMode;
    if (tVal === 'CYCLE') {
      const hasOpen = stats.activeDayIndices.some((d) => ((state.grid.slots[d] && state.grid.slots[d][pIdx]) || 'ACTIVE') !== 'BLOCKED');
      tVal = hasOpen ? 'BLOCKED' : 'ACTIVE';
    }
    stats.activeDayIndices.forEach((d) => { if (!state.grid.slots[d]) state.grid.slots[d] = []; state.grid.slots[d][pIdx] = tVal; });
    saveState(); renderMenu1();
  }));
  tbody.querySelectorAll('.slot-cell').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const d = Number(btn.dataset.d), p = Number(btn.dataset.p);
      if (!state.grid.slots[d]) state.grid.slots[d] = [];
      paintTargetValue = state.brushMode === 'CYCLE' ? getNextCycleValue(state.grid.slots[d][p] || 'ACTIVE') : state.brushMode;
      isPainting = true;
      document.getElementById('matrixWrapper').classList.add('matrix-painting');
      state.grid.slots[d][p] = paintTargetValue;
      applySlotStyle(btn, paintTargetValue);
    });
    btn.addEventListener('mouseenter', () => {
      if (!isPainting) return;
      const d = Number(btn.dataset.d), p = Number(btn.dataset.p);
      if (!state.grid.slots[d]) state.grid.slots[d] = [];
      if (state.grid.slots[d][p] === paintTargetValue) return;
      state.grid.slots[d][p] = paintTargetValue;
      applySlotStyle(btn, paintTargetValue);
    });
  });
}

/* =========================================================================
   7. MENÜ 2 RENDER (SINIFLAR, ŞUBELER VE DERSLERİ)
   ========================================================================= */
function renderCourseRow(c) {
  const blks = getCourseBlocks(c);
  const isAuto = (c.blockMode || 'auto') === 'auto';
  const chips = blks.map((b) => `<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-800">${b}</span>`).join('<span class="text-slate-400 text-[10px]">+</span>');
  let badge = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (c.category === 'secmeli') badge = 'bg-amber-50 text-amber-800 border-amber-200';
  else if (c.category === 'harici') badge = 'bg-teal-50 text-teal-800 border-teal-200';
  else if (c.category === 'meslek') badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return `
    <tr class="hover:bg-slate-50/70 transition">
      <td class="py-2 px-3">
        <span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 text-[11px]">${escapeHtml(c.code)}</span>
      </td>
      <td class="py-2 px-3">
        <div class="font-semibold text-slate-900 leading-snug">${escapeHtml(c.name)}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-1">
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge}">${escapeHtml(c.group || c.category)}</span>
          ${c.useCommonSlot ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">Ortak Slot</span>' : ''}
          ${c.splitGroups ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">2 Grup</span>' : ''}
        </div>
      </td>
      <td class="py-2 px-2 text-center">
        <input type="number" min="1" max="20" value="${c.hours}" data-cid="${c.id}" class="cls-hrs-inp w-14 px-1.5 py-1 rounded-md border border-slate-300 text-center font-bold text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
      </td>
      <td class="py-2 px-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <div class="flex items-center gap-1">${chips}</div>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${isAuto ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}">${isAuto ? 'Oto' : 'Özel'}</span>
          <button type="button" data-edit-cid="${c.id}" class="cls-edit-btn text-[11px] font-semibold text-indigo-600 hover:underline ml-auto">Blok</button>
        </div>
      </td>
      <td class="py-2 px-2 text-center">
        <div class="inline-flex items-center gap-1">
          <button type="button" data-edit-cid="${c.id}" class="cls-edit-btn p-1.5 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition" title="Düzenle"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button type="button" data-del-cid="${c.id}" class="cls-del-btn p-1.5 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition" title="Sil"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </td>
    </tr>
  `;
}

function normalizeCourseKeyName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
}

function findDuplicateCourseInClass(cls, code, name, excludeCourseId = null) {
  if (!cls || !Array.isArray(cls.courses)) return null;
  const normCode = String(code || '').trim().toUpperCase();
  const normName = normalizeCourseKeyName(name);
  return cls.courses.find((c) => {
    if (excludeCourseId && c.id === excludeCourseId) return false;
    const cCode = String(c.code || '').trim().toUpperCase();
    const cName = normalizeCourseKeyName(c.name);
    if (normCode && cCode && cCode === normCode) return true;
    if (normName && cName && cName === normName) return true;
    return false;
  }) || null;
}

function renderMenu2() {
  ensureState(state);
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const classes = getCurrentClasses();
  const grades = getActiveGrades();
  const weeklyGoal = getTargetWeeklyHours();

  document.getElementById('m2SchoolLabel').textContent = meta.name;

  let totalStudents = 0, validCount = 0, schoolHours = 0, schoolBlocks = 0;
  const evalMap = {};
  classes.forEach((cls) => {
    const ev = evaluateClass(cls);
    evalMap[cls.id] = ev;
    totalStudents += Number(cls.studentCount) || 0;
    if (ev.isValid) validCount++;
    schoolHours += ev.totalHours;
    schoolBlocks += ev.totalBlocks;
  });

  document.getElementById('kpiClassCount').textContent = `${classes.length} şube`;
  document.getElementById('kpiStudentTotal').textContent = `${totalStudents} öğrenci`;
  document.getElementById('kpiValidClasses').textContent = `${validCount} / ${classes.length}`;
  document.getElementById('kpiValidClasses').className = 'text-2xl font-bold mt-1 ' + (classes.length > 0 && validCount === classes.length ? 'text-emerald-600' : 'text-slate-900');
  document.getElementById('kpiValidHint').textContent = classes.length === 0 ? 'Henüz şube eklenmedi' : (validCount === classes.length ? 'Tüm şubeler tam uyumlu' : `${classes.length - validCount} şubede eksik/fazla saat var`);
  document.getElementById('kpiSchoolHours').textContent = `${schoolHours} sa`;
  document.getElementById('kpiSchoolBlocks').textContent = `${schoolBlocks} ders bloğu`;
  document.getElementById('kpiWeeklyGoal').textContent = `${weeklyGoal} sa`;
  document.getElementById('kpiGoalNote').textContent = `${meta.shortName} haftalık ders saati`;

  const gFilter = document.getElementById('gradeFilter');
  gFilter.innerHTML = `<option value="ALL">Tümü (${classes.length})</option>` + grades.map((g) => `<option value="${g.key}" ${state.gradeFilter === g.key ? 'selected' : ''}>${g.grade}</option>`).join('');

  const listEl = document.getElementById('classListEl');
  const detailEl = document.getElementById('classDetailEl');

  if (classes.length === 0) {
    listEl.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">Henüz şube eklenmedi.</div>`;
    detailEl.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto"><i data-lucide="school" class="w-6 h-6"></i></div>
        <div>
          <h3 class="text-base font-bold text-slate-900">Başlamak İçin İlk Sınıf / Şubenizi Oluşturun</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">Boş okul projesi ile başlıyorsunuz. Şubeyi oluşturduktan sonra tek tıkla <strong>Zorunlu Dersleri Oluştur</strong> diyebilir, ardından seçmeli veya harici dersleri ekleyebilirsiniz.</p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button id="btnEmptyBulkClass" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition">
            <i data-lucide="layers" class="w-4 h-4"></i> Toplu Sınıf / Şube Oluştur
          </button>
          <button id="btnEmptyAddClass" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition">
            <i data-lucide="plus" class="w-4 h-4"></i> Tekli Şube Ekle
          </button>
        </div>
      </div>
    `;
    document.getElementById('btnEmptyAddClass').addEventListener('click', openAddClassModal);
    document.getElementById('btnEmptyBulkClass').addEventListener('click', openBulkCreateModal);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const visible = state.gradeFilter === 'ALL' ? classes : classes.filter((c) => c.gradeKey === state.gradeFilter);
  listEl.innerHTML = visible.map((cls) => {
    const ev = evalMap[cls.id];
    const isSel = cls.id === state.selectedClassId;
    const badgeClass = ev.totalHours === ev.targetTotal
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : (ev.totalHours > ev.targetTotal ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200');
    return `
      <div data-cls-id="${cls.id}" class="cls-card p-3 rounded-xl border cursor-pointer transition ${isSel ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:bg-slate-50'}">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">${escapeHtml(cls.name)}</span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-900 truncate">${escapeHtml(cls.name)} · ${cls.studentCount} öğr.</div>
              <div class="text-[11px] text-slate-500 mt-0.5">${ev.mandHours} zorunlu + ${ev.elecHours + ev.extHours} seçmeli/harici</div>
            </div>
          </div>
          <span class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}">${ev.totalHours}/${ev.targetTotal}</span>
        </div>
      </div>
    `;
  }).join('');
  listEl.querySelectorAll('.cls-card').forEach((card) => card.addEventListener('click', () => { state.selectedClassId = card.dataset.clsId; saveState(); renderMenu2(); }));

  const activeCls = getSelectedClass();
  const ev = evalMap[activeCls.id];
  const peers = classes.filter((c) => c.gradeKey === activeCls.gradeKey && c.id !== activeCls.id);

  const bannerHtml = ev.isValid
    ? `<div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
        <span><strong>Tamamlandı:</strong> ${escapeHtml(activeCls.name)} sınıfı haftalık <strong>${ev.totalHours} / ${ev.targetTotal} saat</strong> (${ev.mandHours} zorunlu + ${ev.elecHours} seçmeli${ev.extHours ? ` + ${ev.extHours} harici` : ''}).</span>
        <span class="font-bold text-emerald-700">${ev.totalBlocks} ders bloğu</span>
      </div>`
    : `<div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-950 space-y-0.5">
        ${ev.issues.map((i) => `<div>• ${escapeHtml(i)}</div>`).join('')}
      </div>`;

  detailEl.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">${escapeHtml(activeCls.name)}</div>
          <div>
            <h3 class="text-base font-bold text-slate-900">${escapeHtml(activeCls.name)} Sınıfı (${ev.gradeObj.grade})</h3>
            <p class="text-xs text-slate-500">Haftalık Hedef: <strong>${ev.targetTotal} saat</strong> · Şu an: <strong class="text-indigo-700">${ev.totalHours} saat</strong></p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          ${peers.length > 0 ? `<button id="btnCopyCoursesPeers" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Diğer ${ev.gradeObj.grade}'lere Kopyala</button>` : ''}
          <button id="btnDupClass" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"><i data-lucide="copy-plus" class="w-3.5 h-3.5"></i> Çoğalt</button>
          <button id="btnDelClass" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition" title="Şubeyi Sil"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Şube Adı</label>
          <input id="editClsName" type="text" value="${escapeHtml(activeCls.name)}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Öğrenci Mevcudu</label>
          <input id="editClsStudents" type="number" min="5" max="60" value="${activeCls.studentCount}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Derslik</label>
          <input id="editClsRoom" type="text" value="${escapeHtml(activeCls.homeRoom || '')}" placeholder="D-101" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none" />
        </div>
        ${state.school.shiftMode === 'double' ? `
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Devre</label>
            <select id="editClsShift" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
              <option value="morning" ${activeCls.shift !== 'afternoon' ? 'selected' : ''}>Sabahçı</option>
              <option value="afternoon" ${activeCls.shift === 'afternoon' ? 'selected' : ''}>Öğlenci</option>
            </select>
          </div>` : ''}
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <button id="btnCreateMandatory" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Zorunlu Dersleri Oluştur
        </button>
        <button id="btnOpenElectivePicker" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm transition">
          <i data-lucide="library" class="w-3.5 h-3.5"></i> Seçmeli Ders Ekle
        </button>
        <button id="btnAddExternalCourse" type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Harici / Özel Ders Ekle
        </button>
      </div>

      ${bannerHtml}

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left text-xs border-collapse min-w-[600px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
              <th class="py-2.5 px-3 w-16">Kod</th>
              <th class="py-2.5 px-3">Ders Adı</th>
              <th class="py-2.5 px-2 text-center w-20">Saat</th>
              <th class="py-2.5 px-3 w-52">Blok (Otomatik / Çoklu)</th>
              <th class="py-2.5 px-2 text-center w-20">İşlem</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr class="bg-indigo-50/70">
              <td colspan="5" class="py-1.5 px-3">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-indigo-950">Zorunlu / Ortak Dersler (${ev.mand.length} ders · ${ev.mandHours} saat)</span>
                  <button type="button" id="btnAddManualMand" class="text-[11px] font-semibold text-indigo-700 hover:underline">+ Zorunlu Ekle</button>
                </div>
              </td>
            </tr>
            ${ev.mand.length ? ev.mand.map(renderCourseRow).join('') : `<tr><td colspan="5" class="py-4 px-3 text-center text-slate-400 italic">Zorunlu ders yok — yukarıdaki <strong>"Zorunlu Dersleri Oluştur"</strong> düğmesine tıklayın.</td></tr>`}
            <tr class="bg-amber-50/70">
              <td colspan="5" class="py-1.5 px-3">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-amber-950">Seçmeli ve Harici Dersler (${ev.elec.length + ev.ext.length} ders · ${ev.elecHours + ev.extHours} saat · Hedef Seçmeli: ${ev.targetElective} sa)</span>
                  <button type="button" id="btnAddManualElec" class="text-[11px] font-semibold text-amber-800 hover:underline">+ Seçmeli Havuzunu Aç</button>
                </div>
              </td>
            </tr>
            ${(ev.elec.length + ev.ext.length) > 0
              ? [...ev.elec, ...ev.ext].map(renderCourseRow).join('')
              : `<tr><td colspan="5" class="py-4 px-3 text-center text-slate-400 italic">Bu şubeye henüz seçmeli ders eklenmedi.</td></tr>`}
          </tbody>
          <tfoot>
            <tr class="bg-slate-900 text-white font-semibold text-xs">
              <td colspan="2" class="py-3 px-3">HAFTALIK DERS SAATİ TOPLAMI (${escapeHtml(activeCls.name)})</td>
              <td class="py-3 px-2 text-center text-sm font-bold ${ev.totalHours === ev.targetTotal ? 'text-emerald-300' : 'text-amber-300'}">${ev.totalHours} sa</td>
              <td colspan="2" class="py-3 px-3 text-slate-300 text-[11px]">
                Zorunlu: <strong class="text-white">${ev.mandHours}</strong> + Seçmeli: <strong class="text-amber-300">${ev.elecHours}</strong>${ev.extHours ? ` + Harici: <strong class="text-teal-300">${ev.extHours}</strong>` : ''} / Hedef: <strong>${ev.targetTotal} sa</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  document.getElementById('editClsName').addEventListener('change', (e) => { activeCls.name = e.target.value.trim() || activeCls.name; saveState(); renderMenu2(); });
  document.getElementById('editClsStudents').addEventListener('change', (e) => { activeCls.studentCount = Math.max(5, Math.min(60, Number(e.target.value) || 25)); saveState(); renderMenu2(); });
  document.getElementById('editClsRoom').addEventListener('change', (e) => { activeCls.homeRoom = e.target.value.trim(); saveState(); renderMenu2(); });
  const shSel = document.getElementById('editClsShift');
  if (shSel) shSel.addEventListener('change', (e) => { activeCls.shift = e.target.value; saveState(); renderMenu2(); });

  document.getElementById('btnCreateMandatory').addEventListener('click', () => {
    const templates = getMebTemplatesForGrade(state.school.schoolTypeId, activeCls.gradeKey, 'mandatory');
    if (!activeCls.courses) activeCls.courses = [];
    let added = 0;
    templates.forEach((t) => {
      if (!findDuplicateCourseInClass(activeCls, t.code, t.name)) {
        activeCls.courses.push({ ...t, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) });
        added++;
      }
    });
    saveState(); renderMenu2();
    showToast(added > 0 ? `${activeCls.name} için ${added} zorunlu ders oluşturuldu` : 'Zorunlu dersler zaten tanımlı');
  });

  document.getElementById('btnOpenElectivePicker').addEventListener('click', openElectivePickerModal);
  document.getElementById('btnAddManualElec').addEventListener('click', openElectivePickerModal);
  document.getElementById('btnAddManualMand').addEventListener('click', () => openCourseModal(null, 'zorunlu'));
  document.getElementById('btnAddExternalCourse').addEventListener('click', () => openCourseModal(null, 'harici'));

  const btnCopyPeers = document.getElementById('btnCopyCoursesPeers');
  if (btnCopyPeers) {
    btnCopyPeers.addEventListener('click', () => {
      const uniqueSrc = [];
      (activeCls.courses || []).forEach((c) => {
        if (!findDuplicateCourseInClass({ courses: uniqueSrc }, c.code, c.name)) uniqueSrc.push(c);
      });
      peers.forEach((p) => {
        p.courses = JSON.parse(JSON.stringify(uniqueSrc)).map((c) => ({ ...c, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }));
      });
      saveState(); renderMenu2();
      showToast(`Dersler ${peers.length} şubeye kopyalandı`);
    });
  }

  document.getElementById('btnDupClass').addEventListener('click', () => {
    const sameGrade = classes.filter((c) => c.gradeKey === activeCls.gradeKey);
    const nextChar = String.fromCharCode(65 + sameGrade.length);
    const clone = JSON.parse(JSON.stringify(activeCls));
    clone.id = 'cls_' + Date.now();
    clone.section = nextChar;
    clone.name = activeCls.gradeKey === 'H' ? `Haz-${nextChar}` : `${activeCls.gradeKey}/${nextChar}`;
    clone.courses = (clone.courses || []).map((c) => ({ ...c, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }));
    classes.push(clone);
    state.selectedClassId = clone.id;
    saveState(); renderMenu2();
    showToast(`${clone.name} şubesi çoğaltıldı`);
  });

  document.getElementById('btnDelClass').addEventListener('click', () => {
    const idx = classes.findIndex((c) => c.id === activeCls.id);
    if (idx >= 0) {
      const rm = classes.splice(idx, 1)[0];
      state.selectedClassId = classes[0] ? classes[0].id : null;
      saveState(); renderMenu2();
      showToast(`${rm.name} şubesi silindi`);
    }
  });

  detailEl.querySelectorAll('.cls-hrs-inp').forEach((inp) => {
    inp.addEventListener('change', () => {
      const c = (activeCls.courses || []).find((x) => x.id === inp.dataset.cid);
      if (!c) return;
      c.hours = Math.max(1, Math.min(20, Number(inp.value) || 1));
      if ((c.blockMode || 'auto') === 'auto') c.blocks = defaultBlocksForHours(c.hours);
      saveState(); renderMenu2();
    });
  });
  detailEl.querySelectorAll('.cls-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = (activeCls.courses || []).find((x) => x.id === btn.dataset.editCid);
      if (c) openCourseModal(c);
    });
  });
  detailEl.querySelectorAll('.cls-del-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = (activeCls.courses || []).findIndex((x) => x.id === btn.dataset.delCid);
      if (idx >= 0) {
        const rm = activeCls.courses.splice(idx, 1)[0];
        saveState(); renderMenu2();
        showToast(`${rm.name} silindi`);
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/* =========================================================================
   8. MODALLAR: ŞUBE EKLE · SEÇMELİ HAVUZU · DERS & ÇOKLU BLOK OLUŞTURUCU
   ========================================================================= */
const BULK_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
let bulkCreateSelection = {};
let bulkMandSelection = new Set();

function openBulkCreateModal() {
  const grades = getActiveGrades();
  bulkCreateSelection = {};
  grades.forEach((g) => { bulkCreateSelection[g.key] = { enabled: true, letters: new Set(['A', 'B']) }; });
  const shiftWrap = document.getElementById('bulkShiftWrap');
  if (state.school.shiftMode === 'double') { shiftWrap.classList.remove('hidden'); shiftWrap.classList.add('inline-flex'); }
  else { shiftWrap.classList.add('hidden'); shiftWrap.classList.remove('inline-flex'); }
  renderBulkCreateRows();
  const m = document.getElementById('bulkCreateModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderBulkCreateRows() {
  const grades = getActiveGrades();
  const existingNames = new Set(getCurrentClasses().map((c) => c.name.toUpperCase()));
  const container = document.getElementById('bulkCreateRows');

  container.innerHTML = grades.map((g) => {
    const sel = bulkCreateSelection[g.key] || { enabled: false, letters: new Set() };
    return `
      <div class="rounded-xl border ${sel.enabled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/50 opacity-70'} p-3.5 space-y-2.5 transition">
        <div class="flex items-center justify-between gap-2">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" data-bg-chk="${g.key}" ${sel.enabled ? 'checked' : ''} class="bulk-grade-chk w-4 h-4 rounded text-indigo-600" />
            <span class="text-xs font-bold text-slate-900">${g.grade}</span>
          </label>
          <span class="text-[11px] font-semibold text-indigo-700">${sel.enabled ? sel.letters.size : 0} şube seçili</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          ${BULK_LETTERS.map((L) => {
            const clsName = (g.key === 'H' ? `Haz-${L}` : `${g.key}/${L}`).toUpperCase();
            const alreadyExists = existingNames.has(clsName);
            const isPicked = sel.enabled && sel.letters.has(L);
            return `<button type="button" data-bg-key="${g.key}" data-bg-let="${L}" ${alreadyExists ? 'disabled' : ''} class="bulk-let-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              alreadyExists ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through' : (isPicked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50')
            }">${L}</button>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  let totalToCreate = 0;
  grades.forEach((g) => {
    const sel = bulkCreateSelection[g.key];
    if (sel && sel.enabled) {
      sel.letters.forEach((L) => {
        const clsName = (g.key === 'H' ? `Haz-${L}` : `${g.key}/${L}`).toUpperCase();
        if (!existingNames.has(clsName)) totalToCreate++;
      });
    }
  });
  document.getElementById('bulkCreateSummary').textContent = `${totalToCreate} yeni şube oluşturulacak`;

  container.querySelectorAll('.bulk-grade-chk').forEach((chk) => chk.addEventListener('change', () => {
    const gk = chk.dataset.bgChk;
    bulkCreateSelection[gk].enabled = chk.checked;
    if (chk.checked && bulkCreateSelection[gk].letters.size === 0) bulkCreateSelection[gk].letters.add('A');
    renderBulkCreateRows();
  }));
  container.querySelectorAll('.bulk-let-btn').forEach((btn) => btn.addEventListener('click', () => {
    const gk = btn.dataset.bgKey, L = btn.dataset.bgLet;
    const sel = bulkCreateSelection[gk];
    if (!sel.enabled) sel.enabled = true;
    if (sel.letters.has(L)) sel.letters.delete(L); else sel.letters.add(L);
    renderBulkCreateRows();
  }));
}

function openBulkMandModal() {
  const classes = getCurrentClasses();
  if (classes.length === 0) { showToast('Önce en az bir sınıf / şube oluşturun'); return; }
  bulkMandSelection = new Set();
  classes.forEach((cls) => { if (evaluateClass(cls).mand.length === 0) bulkMandSelection.add(cls.id); });
  if (bulkMandSelection.size === 0) classes.forEach((cls) => bulkMandSelection.add(cls.id));
  renderBulkMandList();
  const m = document.getElementById('bulkMandModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderBulkMandList() {
  const grades = getActiveGrades();
  const classes = getCurrentClasses();
  const container = document.getElementById('bulkMandList');

  const groupsHtml = grades.map((g) => {
    const gClasses = classes.filter((c) => c.gradeKey === g.key);
    if (gClasses.length === 0) return '';
    const allChecked = gClasses.every((c) => bulkMandSelection.has(c.id));
    return `
      <div class="rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" data-bm-grade="${g.key}" ${allChecked ? 'checked' : ''} class="bm-grade-chk w-4 h-4 rounded text-emerald-600" />
            <span class="text-xs font-bold text-slate-900">${g.grade} (${gClasses.length} şube)</span>
          </label>
          <span class="text-[11px] text-slate-500">Zorunlu: ${g.core + (g.meslek || 0) + (g.guidance || 0)} sa</span>
        </div>
        <div class="p-3 flex flex-wrap gap-2 bg-white">
          ${gClasses.map((cls) => {
            const ev = evaluateClass(cls);
            const checked = bulkMandSelection.has(cls.id);
            return `<label class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition text-xs font-semibold ${checked ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
              <input type="checkbox" data-bm-cls="${cls.id}" ${checked ? 'checked' : ''} class="bm-cls-chk w-3.5 h-3.5 rounded text-emerald-600" />
              <span>${escapeHtml(cls.name)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${ev.mandHours > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}">${ev.mandHours} sa</span>
            </label>`;
          }).join('')}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  container.innerHTML = groupsHtml || `<div class="py-8 text-center text-xs text-slate-400">Şube bulunamadı.</div>`;
  document.getElementById('bulkMandTopCount').textContent = `${bulkMandSelection.size} şube seçili`;

  container.querySelectorAll('.bm-grade-chk').forEach((chk) => chk.addEventListener('change', () => {
    const gClasses = classes.filter((c) => c.gradeKey === chk.dataset.bmGrade);
    gClasses.forEach((c) => { if (chk.checked) bulkMandSelection.add(c.id); else bulkMandSelection.delete(c.id); });
    renderBulkMandList();
  }));
  container.querySelectorAll('.bm-cls-chk').forEach((chk) => chk.addEventListener('change', () => {
    if (chk.checked) bulkMandSelection.add(chk.dataset.bmCls); else bulkMandSelection.delete(chk.dataset.bmCls);
    renderBulkMandList();
  }));
}

function openAddClassModal() {
  const grades = getActiveGrades();
  document.getElementById('newClassGrade').innerHTML = grades.map((g) => `<option value="${g.key}">${g.grade}</option>`).join('');
  document.getElementById('newClassShiftWrap').classList.toggle('hidden', state.school.shiftMode !== 'double');
  document.getElementById('newClassSection').value = '';
  document.getElementById('newClassStudents').value = '25';
  document.getElementById('newClassRoom').value = '';
  const m = document.getElementById('addClassModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderElectivePickerList() {
  const activeCls = getSelectedClass();
  if (!activeCls) return;
  const ev = evaluateClass(activeCls);
  const q = (document.getElementById('inputEpSearch').value || '').trim().toLocaleLowerCase('tr-TR');
  const templates = getMebTemplatesForGrade(state.school.schoolTypeId, activeCls.gradeKey, 'elective')
    .filter((t) => !q || `${t.code} ${t.name} ${t.group}`.toLocaleLowerCase('tr-TR').includes(q));

  document.getElementById('epModalTitle').textContent = `${activeCls.name} için Seçmeli Ders Seçimi (${ev.gradeObj.grade})`;
  document.getElementById('epFooterSummary').textContent = `Şube Toplamı: ${ev.totalHours} / ${ev.targetTotal} sa (Seçmeli: ${ev.elecHours} / ${ev.targetElective} sa)`;

  const container = document.getElementById('epListContainer');
  if (templates.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Bu sınıfa uygun seçmeli ders bulunamadı. Üstteki "+ Listede Olmayan Seçmeli Ekle" ile kendiniz ekleyebilirsiniz.</div>`;
    return;
  }

  container.innerHTML = templates.map((t, idx) => {
    const added = (activeCls.courses || []).some((c) => c.code === t.code && c.category === 'secmeli');
    const hourPicker = t.hourOptions.length > 1
      ? `<select data-ep-idx="${idx}" class="ep-hrs-sel px-2 py-1 rounded border border-slate-300 text-xs font-bold bg-white">${t.hourOptions.map((v) => `<option value="${v}" ${v === t.hours ? 'selected' : ''}>${v} sa</option>`).join('')}</select>`
      : `<span class="text-xs font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">${t.hours} sa</span>`;
    return `
      <div class="px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-slate-900 truncate"><span class="font-mono text-[11px] text-indigo-700 mr-1.5">${t.code}</span>${t.name}</div>
          <div class="text-[10px] text-slate-500">${t.group}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${hourPicker}
          <button type="button" data-ep-idx="${idx}" class="ep-toggle-btn px-3 py-1 rounded-lg text-xs font-semibold transition ${added ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}">
            ${added ? 'Eklendi ✓' : '+ Ekle'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.ep-toggle-btn').forEach((btn) => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.epIdx);
    const t = templates[idx];
    const hrsSel = container.querySelector(`.ep-hrs-sel[data-ep-idx="${idx}"]`);
    const chosenH = hrsSel ? Number(hrsSel.value) : t.hours;
    if (!activeCls.courses) activeCls.courses = [];
    const existingIdx = activeCls.courses.findIndex((c) => c.code === t.code && c.category === 'secmeli');
    if (existingIdx >= 0) activeCls.courses.splice(existingIdx, 1);
    else {
      const dup = findDuplicateCourseInClass(activeCls, t.code, t.name);
      if (dup) {
        showToast(`${activeCls.name} şubesinde "${dup.name}" dersi zaten tanımlı! Bir sınıfa aynı ders birden fazla kez verilemez.`);
        return;
      }
      activeCls.courses.push({
        ...t, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        hours: chosenH, blocks: defaultBlocksForHours(chosenH), blockMode: 'auto'
      });
    }
    saveState(); renderElectivePickerList(); renderMenu2();
  }));
}

function openElectivePickerModal() {
  document.getElementById('inputEpSearch').value = '';
  renderElectivePickerList();
  const m = document.getElementById('electivePickerModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderModalBlocks() {
  const isAuto = document.getElementById('cmBlockAuto').checked;
  const hrs = Math.max(1, Math.min(20, Number(document.getElementById('cmHours').value) || 1));
  if (isAuto) modalDraftBlocks = defaultBlocksForHours(hrs);

  const chipsEl = document.getElementById('cmBlockChips');
  if (modalDraftBlocks.length === 0) {
    chipsEl.innerHTML = `<span class="text-[11px] text-slate-400">Blok eklemek için aşağıdaki +1, +2, +3 butonlarına tıklayın...</span>`;
  } else {
    chipsEl.innerHTML = modalDraftBlocks.map((b, idx) => `
      <button type="button" data-rm-blk="${idx}" ${isAuto ? 'disabled' : ''} class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${
        isAuto ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-rose-600 hover:border-rose-600'
      }">${b} sa ${!isAuto ? '<span class="text-[10px] opacity-80">×</span>' : ''}</button>
    `).join('<span class="text-slate-400 text-xs font-bold">+</span>');
  }
  if (!isAuto) {
    chipsEl.querySelectorAll('[data-rm-blk]').forEach((btn) => btn.addEventListener('click', () => {
      modalDraftBlocks.splice(Number(btn.dataset.rmBlk), 1); renderModalBlocks();
    }));
  }

  const sum = modalDraftBlocks.reduce((a, b) => a + b, 0);
  const sumEl = document.getElementById('cmBlockSumInfo');
  sumEl.textContent = sum === hrs ? `Toplam: ${sum} sa (${modalDraftBlocks.length} blok)` : `Blok Toplamı: ${sum} sa (Kaydedince saat ${sum} olur)`;
  sumEl.className = 'text-[11px] font-semibold ' + (sum === hrs ? 'text-emerald-700' : 'text-amber-700');

  const presets = getBlockPresets(hrs);
  const pEl = document.getElementById('cmBlockPresets');
  pEl.innerHTML = `<span class="text-[11px] text-slate-500">Hazır:</span>` + presets.map((p) => `<button type="button" data-preset="${p.join(',')}" class="cm-preset-btn px-2 py-0.5 rounded bg-white hover:bg-indigo-50 border border-slate-300 text-[11px] font-mono text-slate-700">${p.join('+')}</button>`).join('');
  pEl.querySelectorAll('.cm-preset-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.getElementById('cmBlockAuto').checked = false;
    modalDraftBlocks = btn.dataset.preset.split(',').map(Number);
    renderModalBlocks();
  }));
  document.querySelectorAll('.cm-add-blk, #btnCmClearBlocks').forEach((b) => { b.disabled = isAuto; b.classList.toggle('opacity-40', isAuto); });
}

function openCourseModal(courseObj = null, defaultCat = 'harici') {
  document.getElementById('cmRoom').innerHTML = ROOM_TYPES.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
  if (courseObj) {
    document.getElementById('courseModalTitle').textContent = `Dersi Düzenle (${courseObj.name})`;
    document.getElementById('editCourseId').value = courseObj.id;
    document.getElementById('cmName').value = courseObj.name;
    document.getElementById('cmCode').value = courseObj.code;
    document.getElementById('cmCategory').value = courseObj.category === 'serbest' ? 'zorunlu' : courseObj.category;
    document.getElementById('cmGroup').value = courseObj.group || 'Zorunlu';
    document.getElementById('cmHours').value = courseObj.hours || 2;
    document.getElementById('cmMaxDay').value = String(courseObj.maxPerDay || 1);
    document.getElementById('cmRoom').value = courseObj.roomType || 'standard';
    document.getElementById('cmSplitGroups').checked = Boolean(courseObj.splitGroups);
    document.getElementById('cmUseCommon').checked = Boolean(courseObj.useCommonSlot);
    document.getElementById('cmBlockAuto').checked = (courseObj.blockMode || 'auto') === 'auto';
    modalDraftBlocks = [...getCourseBlocks(courseObj)];
  } else {
    document.getElementById('courseModalTitle').textContent = defaultCat === 'secmeli' ? 'Özel Seçmeli Ders Ekle' : (defaultCat === 'zorunlu' ? 'Zorunlu Ders Ekle' : 'Harici Ders Ekle');
    document.getElementById('editCourseId').value = '';
    document.getElementById('cmName').value = '';
    document.getElementById('cmCode').value = '';
    document.getElementById('cmCategory').value = defaultCat;
    document.getElementById('cmGroup').value = defaultCat === 'secmeli' ? 'İnsan, Toplum ve Bilim' : (defaultCat === 'harici' ? 'Harici / Destek' : 'Zorunlu');
    document.getElementById('cmHours').value = 2;
    document.getElementById('cmMaxDay').value = '1';
    document.getElementById('cmRoom').value = 'standard';
    document.getElementById('cmSplitGroups').checked = false;
    document.getElementById('cmUseCommon').checked = false;
    document.getElementById('cmBlockAuto').checked = true;
    modalDraftBlocks = [2];
  }
  renderModalBlocks();
  const m = document.getElementById('courseModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

/* =========================================================================
   8B. MENÜ 3 RENDER (ÖĞRETMENLER VE MÜSAİTLİK)
   ========================================================================= */
let modalDraftAvail = {};
let bulkTeacherCounts = {};
let isTeacherPainting = false;
let teacherPaintVal = 'AVAILABLE';

function getTeacherSlotStats(t) {
  ensureTeacherAvailabilitySize(t);
  const stats = getSlotStats();
  let avail = 0, unavail = 0, avoid = 0;
  stats.activeDayIndices.forEach((d) => {
    for (let p = 0; p < state.grid.periodsPerDay; p++) {
      if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') === 'BLOCKED') continue;
      const v = t.availability[d][p] || 'AVAILABLE';
      if (v === 'AVAILABLE') avail++;
      else if (v === 'PREFER_AVOID') avoid++;
      else unavail++;
    }
  });
  return { avail, unavail, avoid };
}

function nextTeacherSlotVal(cur) {
  if (cur === 'AVAILABLE') return 'UNAVAILABLE';
  if (cur === 'UNAVAILABLE') return 'PREFER_AVOID';
  return 'AVAILABLE';
}

function applyTeacherCellStyle(btn, val) {
  let cs = 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-800', lb = 'Müsait';
  if (val === 'UNAVAILABLE') { cs = 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 line-through'; lb = 'Kapalı'; }
  else if (val === 'PREFER_AVOID') { cs = 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'; lb = 'Tercihen Boş'; }
  btn.className = 't-slot-cell w-full py-2 px-1 rounded-lg border text-xs font-semibold transition select-none ' + cs;
  btn.textContent = lb;
}

function renderMenu3() {
  ensureState(state);
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const teachers = getCurrentTeachers();
  const branches = MEB_BRANCHES_BY_SCHOOL_TYPE[state.school.schoolTypeId] || [];
  const classes = getCurrentClasses();
  const schoolDemand = classes.reduce((s, c) => s + evaluateClass(c).totalHours, 0);

  document.getElementById('m3SchoolLabel').textContent = meta.name;

  const uniqueBranches = new Set(teachers.map((t) => t.branch));
  let totalCap = 0, totalBlocked = 0, totalAvoid = 0, dutyCount = 0;
  teachers.forEach((t) => {
    totalCap += Number(t.maxHours) || 0;
    const st = getTeacherSlotStats(t);
    totalBlocked += st.unavail;
    totalAvoid += st.avoid;
    if (t.dutyDay >= 0) dutyCount++;
  });

  document.getElementById('m3KpiCount').textContent = `${teachers.length} öğretmen`;
  document.getElementById('m3KpiBranches').textContent = `${uniqueBranches.size} farklı branş`;
  document.getElementById('m3KpiCapacity').textContent = `${totalCap} sa`;
  document.getElementById('m3KpiDemandCompare').textContent = `Okul ders yükü: ${schoolDemand} sa`;
  document.getElementById('m3KpiBlocked').textContent = `${totalBlocked} slot`;
  document.getElementById('m3KpiSoft').textContent = `${totalAvoid} tercihen boş slot`;
  document.getElementById('m3KpiDuty').textContent = `${dutyCount} öğretmen`;

  const bFilter = document.getElementById('m3BranchFilter');
  const allBranchNames = Array.from(new Set([...branches, ...teachers.map((t) => t.branch)]));
  bFilter.innerHTML = `<option value="ALL">Tüm Branşlar (${teachers.length})</option>` +
    allBranchNames.map((b) => {
      const cnt = teachers.filter((t) => t.branch === b).length;
      return cnt > 0 ? `<option value="${escapeHtml(b)}" ${state.teacherBranchFilter === b ? 'selected' : ''}>${escapeHtml(b)} (${cnt})</option>` : '';
    }).join('');

  const listEl = document.getElementById('m3TeacherList');
  const detailEl = document.getElementById('m3TeacherDetail');

  if (teachers.length === 0) {
    listEl.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">Henüz öğretmen eklenmedi.</div>`;
    detailEl.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto"><i data-lucide="user-plus" class="w-6 h-6"></i></div>
        <div>
          <h3 class="text-base font-bold text-slate-900">Öğretmen Kadronuzu Oluşturun</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto mt-1"><strong>${meta.name}</strong> branşlarından tek tek veya toplu öğretmen ekleyebilirsiniz.</p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button id="btnEmptyAddTeacher" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"><i data-lucide="user-plus" class="w-4 h-4"></i> Öğretmen Ekle</button>
          <button id="btnEmptyBulkTeacher" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"><i data-lucide="users" class="w-4 h-4"></i> Branşa Göre Toplu Ekle</button>
        </div>
      </div>
    `;
    document.getElementById('btnEmptyAddTeacher').addEventListener('click', openTeacherModal);
    document.getElementById('btnEmptyBulkTeacher').addEventListener('click', openBulkTeacherModal);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const q = (state.teacherSearch || '').trim().toLocaleLowerCase('tr-TR');
  const visible = teachers.filter((t) => {
    if (state.teacherBranchFilter !== 'ALL' && t.branch !== state.teacherBranchFilter) return false;
    if (q && !`${t.name} ${t.branch}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
    return true;
  });

  listEl.innerHTML = visible.map((t) => {
    const isSel = t.id === state.selectedTeacherId;
    const st = getTeacherSlotStats(t);
    return `
      <div data-tid="${t.id}" class="t-card p-3 rounded-xl border cursor-pointer transition ${isSel ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:bg-slate-50'}">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 truncate">${escapeHtml(t.name)}</div>
            <div class="text-[11px] text-slate-500 truncate mt-0.5">${escapeHtml(t.branch)} · ${t.minHours}–${t.maxHours} sa</div>
            ${t.club ? `<div class="text-[10px] font-semibold text-violet-700 truncate mt-0.5">Kulüp: ${escapeHtml(t.club)}</div>` : ''}
          </div>
          <span class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${st.unavail > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">${st.avail} açık</span>
        </div>
      </div>
    `;
  }).join('') || `<div class="py-6 text-center text-xs text-slate-400">Eşleşen öğretmen yok.</div>`;

  listEl.querySelectorAll('.t-card').forEach((c) => c.addEventListener('click', () => { state.selectedTeacherId = c.dataset.tid; saveState(); renderMenu3(); }));

  const activeT = getSelectedTeacher();
  ensureTeacherAvailabilitySize(activeT);
  const tStats = getTeacherSlotStats(activeT);
  const gridStats = getSlotStats();
  const { primary } = computeBellSchedule();

  const tBrushStyles = {
    CYCLE: 'bg-slate-900 text-white border-slate-900',
    AVAILABLE: 'bg-emerald-600 text-white border-emerald-600',
    UNAVAILABLE: 'bg-rose-600 text-white border-rose-600',
    PREFER_AVOID: 'bg-amber-500 text-white border-amber-500'
  };

  const rowsHtml = primary.map((b, pIdx) => {
    const cells = gridStats.activeDayIndices.map((d) => {
      if (((state.grid.slots[d] && state.grid.slots[d][pIdx]) || 'ACTIVE') === 'BLOCKED') {
        return `<td class="p-1 border border-slate-200 text-center bg-slate-100 text-[10px] text-slate-400">Okul Kapalı</td>`;
      }
      const v = activeT.availability[d][pIdx] || 'AVAILABLE';
      let cs = 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-800', lb = 'Müsait';
      if (v === 'UNAVAILABLE') { cs = 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 line-through'; lb = 'Kapalı'; }
      else if (v === 'PREFER_AVOID') { cs = 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'; lb = 'Tercihen Boş'; }
      return `<td class="p-1 border border-slate-200 text-center"><button type="button" data-td="${d}" data-tp="${pIdx}" class="t-slot-cell w-full py-2 px-1 rounded-lg border text-xs font-semibold transition select-none ${cs}">${lb}</button></td>`;
    }).join('');
    return `
      <tr>
        <td class="p-1.5 border border-slate-200 bg-slate-50/70">
          <button type="button" data-t-row="${pIdx}" class="t-row-bulk w-full text-left px-1.5 py-1 rounded hover:bg-indigo-50 transition">
            <div class="text-xs font-bold text-slate-800">${b.period}. Ders</div>
            <div class="text-[10px] text-slate-500 font-mono">${b.start}–${b.end}</div>
          </button>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  detailEl.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">${escapeHtml(activeT.shortCode || makeTeacherShortCode(activeT.name))}</div>
          <div>
            <h3 class="text-base font-bold text-slate-900">${escapeHtml(activeT.name)}</h3>
            <p class="text-xs text-slate-500">${escapeHtml(activeT.branch)} · ${tStats.avail} müsait, ${tStats.unavail} kapalı, ${tStats.avoid} tercihen boş</p>
          </div>
        </div>
        <button id="btnDelTeacher" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Öğretmeni Sil</button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="col-span-2">
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Ad Soyad (Boşsa Branş Adı)</label>
          <input id="editTName" type="text" value="${escapeHtml(activeT.name)}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Branş</label>
          <select id="editTBranch" class="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
            ${Array.from(new Set([...branches, activeT.branch])).map((b) => `<option value="${escapeHtml(b)}" ${b === activeT.branch ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Min / Maks Saat (1–30)</label>
          <div class="flex items-center gap-1">
            <input id="editTMin" type="number" min="1" max="40" value="${activeT.minHours ?? 1}" class="w-1/2 px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs text-center font-bold" />
            <input id="editTMax" type="number" min="1" max="45" value="${activeT.maxHours ?? 30}" class="w-1/2 px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs text-center font-bold" />
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Günlük Maks (${state.grid.periodsPerDay}) / Nöbet</label>
          <div class="flex items-center gap-1">
            <input id="editTDaily" type="number" min="1" max="12" value="${activeT.maxDaily || state.grid.periodsPerDay || 7}" title="Günlük Maksimum Ders" class="w-14 px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs text-center font-bold" />
            <select id="editTDuty" title="Nöbet Günü" ${(activeT.role === 'mudur' || activeT.role === 'mudur_yardimcisi') ? 'disabled' : ''} class="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white disabled:bg-slate-100 disabled:text-slate-400">
              <option value="-1" ${(activeT.dutyDay < 0 || activeT.role === 'mudur' || activeT.role === 'mudur_yardimcisi') ? 'selected' : ''}>${(activeT.role === 'mudur' || activeT.role === 'mudur_yardimcisi') ? 'İdareci (Muaf)' : 'Nöbet Yok'}</option>
              ${gridStats.activeDayIndices.map((d) => `<option value="${d}" ${activeT.dutyDay === d ? 'selected' : ''}>${DAY_SHORT[d]}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Görev / Unvan</label>
          <select id="editTRole" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold">
            <option value="ogretmen" ${(!activeT.role || activeT.role === 'ogretmen') ? 'selected' : ''}>Öğretmen (Nöbet Tutar)</option>
            <option value="mudur" ${activeT.role === 'mudur' ? 'selected' : ''}>Okul Müdürü (Okul Nöbeti Tutmaz)</option>
            <option value="mudur_yardimcisi" ${activeT.role === 'mudur_yardimcisi' ? 'selected' : ''}>Müdür Yardımcısı (Okul Nöbeti Tutmaz)</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Ekstra Okutabileceği Dersler / Branşlar <span class="text-slate-400 font-normal">(Virgülle ayırın)</span></label>
          <input id="editTExtraSubjects" type="text" value="${escapeHtml(Array.isArray(activeT.extraSubjects) ? activeT.extraSubjects.join(', ') : '')}" placeholder="Örn: Bilişim, Seçmeli İngilizce, Rehberlik" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none" />
        </div>
      </div>

      <div class="pt-1">
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Okul Kulübü</label>
        <div class="flex flex-wrap items-center gap-1.5">
          <select id="editTClub" class="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium">
            <option value="">Kulüp Atanmadı</option>
            ${(window.EvrakPlusClubs ? window.EvrakPlusClubs.getSchoolClubs(state) : []).map((c) => `<option value="${escapeHtml(c)}" ${activeT.club === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            ${activeT.club && !(window.EvrakPlusClubs ? window.EvrakPlusClubs.getSchoolClubs(state) : []).includes(activeT.club) ? `<option value="${escapeHtml(activeT.club)}" selected>${escapeHtml(activeT.club)}</option>` : ''}
          </select>
          <input id="editTNewClubInput" type="text" placeholder="Manuel yeni kulüp yaz..." class="w-44 px-2 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none" />
          <button id="btnQuickAddTClub" type="button" class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition">+ Ekle & Ata</button>
          ${activeT.club ? `<button id="btnClearTClub" type="button" title="Öğretmenin kulübünü kaldır" class="px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition">Kaldır</button>` : ''}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 pt-1">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Günlük Maks. Ardışık <span class="text-slate-400 font-normal">(0=sınırsız)</span></label>
          <input id="editTMaxConsec" type="number" min="0" max="10" value="${Number(activeT.maxConsecutive || 0)}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Günlük Maks. Boş Ders <span class="text-slate-400 font-normal">(0=sınırsız)</span></label>
          <input id="editTMaxGaps" type="number" min="0" max="6" value="${Number(activeT.maxDailyGaps || 0)}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Haftalık Maks. Gün <span class="text-slate-400 font-normal">(0=sınırsız)</span></label>
          <input id="editTMaxDays" type="number" min="0" max="6" value="${Number(activeT.maxWorkingDays || 0)}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold" />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div class="text-xs font-bold text-slate-800">Haftalık Müsaitlik Matrisi</div>
        <div class="flex flex-wrap items-center gap-1">
          ${[
            { id: 'CYCLE', label: 'Döngüsel' },
            { id: 'AVAILABLE', label: 'Müsait' },
            { id: 'UNAVAILABLE', label: 'Kapalı' },
            { id: 'PREFER_AVOID', label: 'Tercihen Boş' }
          ].map((b) => `<button type="button" data-tbrush="${b.id}" class="t-brush-btn px-2 py-1 rounded-md text-[11px] font-semibold border transition ${state.teacherBrush === b.id ? tBrushStyles[b.id] : 'bg-white text-slate-600 border-slate-300'}">${b.label}</button>`).join('')}
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[480px]">
          <thead>
            <tr>
              <th class="p-2 text-left text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 w-32">Ders / Saat</th>
              ${gridStats.activeDayIndices.map((d) => `<th class="p-1.5 text-center bg-slate-50 border border-slate-200"><button type="button" data-t-col="${d}" class="t-col-bulk w-full py-1 rounded hover:bg-indigo-50 text-xs font-semibold text-slate-700 transition">${DAY_NAMES[d]}</button></th>`).join('')}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="text-slate-500">Gün başlığına tıklayarak öğretmene tek tıkla <strong>boş gün</strong> verebilirsiniz.</span>
        <button id="btnResetTeacherAvail" type="button" class="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold transition">Tüm Saatleri Müsait Yap</button>
      </div>
    </div>
  `;

  document.getElementById('editTName').addEventListener('change', (e) => { activeT.name = e.target.value.trim() || activeT.branch; activeT.shortCode = makeTeacherShortCode(activeT.name); saveState(); renderMenu3(); });
  document.getElementById('editTBranch').addEventListener('change', (e) => { activeT.branch = e.target.value; saveState(); renderMenu3(); });
  document.getElementById('editTMin').addEventListener('change', (e) => { activeT.minHours = Math.max(1, Math.min(40, Number(e.target.value) || 1)); saveState(); renderMenu3(); });
  document.getElementById('editTMax').addEventListener('change', (e) => { activeT.maxHours = Math.max(1, Math.min(45, Number(e.target.value) || 30)); saveState(); renderMenu3(); });
  document.getElementById('editTDaily').addEventListener('change', (e) => { activeT.maxDaily = Math.max(1, Math.min(12, Number(e.target.value) || state.grid.periodsPerDay || 7)); saveState(); });
  document.getElementById('editTDuty').addEventListener('change', (e) => { activeT.dutyDay = Number(e.target.value); saveState(); renderMenu3(); });
  document.getElementById('editTRole').addEventListener('change', (e) => {
    activeT.role = e.target.value;
    if (activeT.role === 'mudur' || activeT.role === 'mudur_yardimcisi') {
      activeT.dutyDay = -1;
      activeT.dutyLocation = '';
    }
    saveState(); renderMenu3();
  });
  document.getElementById('editTExtraSubjects').addEventListener('change', (e) => {
    activeT.extraSubjects = String(e.target.value || '').split(',').map((s) => s.trim()).filter(Boolean);
    saveState(); renderMenu3();
  });
  const editTClubEl = document.getElementById('editTClub');
  if (editTClubEl) {
    editTClubEl.addEventListener('change', (e) => {
      activeT.club = e.target.value || '';
      saveState(); renderMenu3();
    });
  }
  const btnQuickAddTClub = document.getElementById('btnQuickAddTClub');
  if (btnQuickAddTClub) {
    btnQuickAddTClub.addEventListener('click', () => {
      const inp = document.getElementById('editTNewClubInput');
      const name = inp ? inp.value.trim() : '';
      if (!name) { showToast('Lütfen eklenecek kulüp adını yazın'); return; }
      if (window.EvrakPlusClubs) window.EvrakPlusClubs.addSchoolClub(state, name);
      activeT.club = name;
      saveState(); renderMenu3();
      showToast(`"${name}" kulübü eklendi ve ${activeT.name} öğretmenine atandı`);
    });
  }
  const btnClearTClub = document.getElementById('btnClearTClub');
  if (btnClearTClub) {
    btnClearTClub.addEventListener('click', () => {
      activeT.club = '';
      saveState(); renderMenu3();
      showToast(`${activeT.name} kulüp ataması kaldırıldı`);
    });
  }
  const clubPanelEl = document.getElementById('m3ClubManagerPanel');
  if (clubPanelEl && !clubPanelEl.classList.contains('hidden') && window.EvrakPlusClubs) {
    window.EvrakPlusClubs.renderClubManagerPanel(clubPanelEl, state, (msg) => {
      saveState(); renderMenu3();
      if (msg) showToast(msg);
    });
  }
  document.getElementById('editTMaxConsec').addEventListener('change', (e) => { activeT.maxConsecutive = Math.max(0, Math.min(10, Number(e.target.value) || 0)); saveState(); });
  document.getElementById('editTMaxGaps').addEventListener('change', (e) => { activeT.maxDailyGaps = Math.max(0, Math.min(6, Number(e.target.value) || 0)); saveState(); });
  document.getElementById('editTMaxDays').addEventListener('change', (e) => { activeT.maxWorkingDays = Math.max(0, Math.min(6, Number(e.target.value) || 0)); saveState(); });

  document.getElementById('btnDelTeacher').addEventListener('click', () => {
    const idx = teachers.findIndex((x) => x.id === activeT.id);
    if (idx >= 0) {
      const rm = teachers.splice(idx, 1)[0];
      state.selectedTeacherId = teachers[0] ? teachers[0].id : null;
      saveState(); renderMenu3(); showToast(`${rm.name} silindi`);
    }
  });

  document.getElementById('btnResetTeacherAvail').addEventListener('click', () => {
    activeT.availability = createDefaultAvailability();
    saveState(); renderMenu3(); showToast(`${activeT.name} tüm açık saatlerde müsait yapıldı`);
  });

  detailEl.querySelectorAll('.t-brush-btn').forEach((b) => b.addEventListener('click', () => { state.teacherBrush = b.dataset.tbrush; saveState(); renderMenu3(); }));
  detailEl.querySelectorAll('.t-col-bulk').forEach((btn) => btn.addEventListener('click', () => {
    const d = Number(btn.dataset.tCol);
    let tVal = state.teacherBrush;
    if (tVal === 'CYCLE') {
      let hasAvail = false;
      for (let p = 0; p < state.grid.periodsPerDay; p++) {
        if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') === 'BLOCKED') continue;
        if ((activeT.availability[d][p] || 'AVAILABLE') === 'AVAILABLE') hasAvail = true;
      }
      tVal = hasAvail ? 'UNAVAILABLE' : 'AVAILABLE';
    }
    for (let p = 0; p < state.grid.periodsPerDay; p++) {
      if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') !== 'BLOCKED') activeT.availability[d][p] = tVal;
    }
    saveState(); renderMenu3();
  }));
  detailEl.querySelectorAll('.t-row-bulk').forEach((btn) => btn.addEventListener('click', () => {
    const p = Number(btn.dataset.tRow);
    let tVal = state.teacherBrush;
    if (tVal === 'CYCLE') {
      const hasAvail = gridStats.activeDayIndices.some((d) => ((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') !== 'BLOCKED' && (activeT.availability[d][p] || 'AVAILABLE') === 'AVAILABLE');
      tVal = hasAvail ? 'UNAVAILABLE' : 'AVAILABLE';
    }
    gridStats.activeDayIndices.forEach((d) => {
      if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') !== 'BLOCKED') activeT.availability[d][p] = tVal;
    });
    saveState(); renderMenu3();
  }));
  detailEl.querySelectorAll('.t-slot-cell').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const d = Number(btn.dataset.td), p = Number(btn.dataset.tp);
      teacherPaintVal = state.teacherBrush === 'CYCLE' ? nextTeacherSlotVal(activeT.availability[d][p] || 'AVAILABLE') : state.teacherBrush;
      isTeacherPainting = true;
      activeT.availability[d][p] = teacherPaintVal;
      applyTeacherCellStyle(btn, teacherPaintVal);
    });
    btn.addEventListener('mouseenter', () => {
      if (!isTeacherPainting) return;
      const d = Number(btn.dataset.td), p = Number(btn.dataset.tp);
      if (activeT.availability[d][p] === teacherPaintVal) return;
      activeT.availability[d][p] = teacherPaintVal;
      applyTeacherCellStyle(btn, teacherPaintVal);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderModalAvailGrid() {
  const gridStats = getSlotStats();
  const wrap = document.getElementById('tmAvailGridWrap');
  let htmlRows = `<table class="w-full border-collapse text-[11px]"><thead><tr><th class="p-1 text-left text-slate-500">Ders</th>${gridStats.activeDayIndices.map((d) => `<th class="p-1 text-center text-slate-700 font-semibold">${DAY_SHORT[d]}</th>`).join('')}</tr></thead><tbody>`;
  for (let p = 0; p < state.grid.periodsPerDay; p++) {
    htmlRows += `<tr><td class="p-1 font-bold text-slate-600">${p + 1}.</td>`;
    gridStats.activeDayIndices.forEach((d) => {
      if (((state.grid.slots[d] && state.grid.slots[d][p]) || 'ACTIVE') === 'BLOCKED') {
        htmlRows += `<td class="p-0.5 text-center"><span class="block py-1 rounded bg-slate-100 text-slate-400">—</span></td>`;
      } else {
        const v = (modalDraftAvail[d] && modalDraftAvail[d][p]) || 'AVAILABLE';
        const cls = v === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : (v === 'UNAVAILABLE' ? 'bg-rose-100 text-rose-700 border-rose-300 line-through' : 'bg-amber-100 text-amber-900 border-amber-300');
        const lbl = v === 'AVAILABLE' ? 'Açık' : (v === 'UNAVAILABLE' ? 'Kapalı' : 'Boş');
        htmlRows += `<td class="p-0.5 text-center"><button type="button" data-md="${d}" data-mp="${p}" class="tm-av-cell w-full py-1 rounded border font-semibold ${cls}">${lbl}</button></td>`;
      }
    });
    htmlRows += `</tr>`;
  }
  htmlRows += `</tbody></table>`;
  wrap.innerHTML = htmlRows;
  wrap.querySelectorAll('.tm-av-cell').forEach((btn) => btn.addEventListener('click', () => {
    const d = Number(btn.dataset.md), p = Number(btn.dataset.mp);
    modalDraftAvail[d][p] = nextTeacherSlotVal(modalDraftAvail[d][p] || 'AVAILABLE');
    renderModalAvailGrid();
  }));
}

function openTeacherModal() {
  const branches = MEB_BRANCHES_BY_SCHOOL_TYPE[state.school.schoolTypeId] || [];
  document.getElementById('tmBranch').innerHTML = branches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('') + `<option value="__CUSTOM__">Diğer / Özel Branş...</option>`;
  document.getElementById('tmCustomBranchWrap').classList.add('hidden');
  document.getElementById('tmCustomBranch').value = '';
  document.getElementById('tmName').value = '';
  document.getElementById('tmRole').value = 'ogretmen';
  document.getElementById('tmExtraSubjects').value = '';
  document.getElementById('tmMinHours').value = '1';
  document.getElementById('tmMaxHours').value = '30';
  document.getElementById('tmMaxDaily').value = String(state.grid.periodsPerDay || 7);
  document.getElementById('tmDutyDay').value = '-1';
  modalDraftAvail = createDefaultAvailability();
  renderModalAvailGrid();
  const m = document.getElementById('teacherModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function openBulkTeacherModal() {
  const branches = MEB_BRANCHES_BY_SCHOOL_TYPE[state.school.schoolTypeId] || [];
  bulkTeacherCounts = {};
  branches.forEach((b) => { bulkTeacherCounts[b] = 0; });
  renderBulkTeacherRows();
  const m = document.getElementById('bulkTeacherModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderBulkTeacherRows() {
  const branches = MEB_BRANCHES_BY_SCHOOL_TYPE[state.school.schoolTypeId] || [];
  const container = document.getElementById('bulkTeacherRows');
  let total = 0;
  container.innerHTML = branches.map((b) => {
    const cnt = bulkTeacherCounts[b] || 0;
    total += cnt;
    return `
      <div class="flex items-center justify-between gap-2 p-3 rounded-xl border ${cnt > 0 ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-white'}">
        <span class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(b)}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" data-bt-dec="${escapeHtml(b)}" class="bt-dec w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700">−</button>
          <span class="w-6 text-center text-xs font-bold text-slate-900">${cnt}</span>
          <button type="button" data-bt-inc="${escapeHtml(b)}" class="bt-inc w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-white">+</button>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('bulkTeacherSummary').textContent = `${total} öğretmen oluşturulacak`;
  container.querySelectorAll('.bt-dec').forEach((btn) => btn.addEventListener('click', () => {
    const b = btn.dataset.btDec; bulkTeacherCounts[b] = Math.max(0, (bulkTeacherCounts[b] || 0) - 1); renderBulkTeacherRows();
  }));
  container.querySelectorAll('.bt-inc').forEach((btn) => btn.addEventListener('click', () => {
    const b = btn.dataset.btInc; bulkTeacherCounts[b] = Math.min(20, (bulkTeacherCounts[b] || 0) + 1); renderBulkTeacherRows();
  }));
}

/* =========================================================================
   8C. MENÜ 4 RENDER (DERSLİKLER VE DERS ATAMA)
   ========================================================================= */
function computeTeacherLoads() {
  const teachers = getCurrentTeachers();
  const map = {};
  teachers.forEach((t) => { map[t.id] = { teacher: t, totalHours: 0, coursesSummary: {}, crossBranchHours: 0, assignments: [] }; });
  getCurrentClasses().forEach((cls) => {
    (cls.courses || []).forEach((c) => {
      const hrs = Number(c.hours) || 0;
      const blocks = getCourseBlocks(c);
      const addLoad = (tid, slot) => {
        if (!tid || !map[tid]) return;
        const isCross = !isBranchMatchingCourse(map[tid].teacher.branch, c.name);
        map[tid].totalHours += hrs;
        map[tid].coursesSummary[c.name] = (map[tid].coursesSummary[c.name] || 0) + hrs;
        if (isCross) map[tid].crossBranchHours += hrs;
        map[tid].assignments.push({
          classId: cls.id,
          className: cls.name,
          courseId: c.id,
          courseCode: c.code || '',
          courseName: c.name,
          hours: hrs,
          blocks,
          slot,
          splitGroups: Boolean(c.splitGroups),
          isCross
        });
      };
      addLoad(c.teacherId, 1);
      if (c.splitGroups) addLoad(c.teacherId2, 2);
    });
  });
  return map;
}

let m4LoadSearchText = '';
let m4LoadFilterMode = 'ALL';
let m4ExpandedTeacherIds = new Set();
let m4TransferContext = null;

function getTeacherInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
}

function openM4TransferModal(ctx) {
  const teachers = getCurrentTeachers();
  const loadMap = computeTeacherLoads();
  const srcTeacher = teachers.find((t) => t.id === ctx.sourceTeacherId);
  if (!srcTeacher) return;

  m4TransferContext = ctx;
  const isBulk = ctx.mode === 'bulk';
  const titleEl = document.getElementById('m4TransferTitle');
  const subEl = document.getElementById('m4TransferSubtitle');
  const srcBox = document.getElementById('m4TransferSourceBox');
  const targetSel = document.getElementById('m4TransferTargetSelect');
  const unassignBtn = document.getElementById('btnM4TransferUnassign');

  if (titleEl) titleEl.textContent = isBulk ? 'Öğretmenin Tüm Derslerini Aktar' : 'Dersi Başka Öğretmene Aktar';
  if (subEl) subEl.textContent = isBulk
    ? 'Bu öğretmendeki tüm dersler seçeceğiniz yeni öğretmene topluca devredilir'
    : 'Seçili şube dersini yeni öğretmene anında devredin';

  const srcLoad = loadMap[srcTeacher.id] || { totalHours: 0, assignments: [] };
  const transferHours = isBulk ? srcLoad.totalHours : (Number(ctx.hours) || 0);

  if (srcBox) {
    if (isBulk) {
      srcBox.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Kaynak Öğretmen (Toplu Aktarım)</div>
            <div class="text-sm font-bold text-slate-900 mt-0.5">${escapeHtml(srcTeacher.name)}</div>
            <div class="text-[11px] text-slate-500">${escapeHtml(srcTeacher.branch)} · ${srcLoad.assignments.length} ders</div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">${transferHours} sa</span>
        </div>
      `;
    } else {
      srcBox.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Aktarılacak Ders</div>
            <div class="text-sm font-bold text-slate-900 mt-0.5">
              <span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[11px] mr-1.5">${escapeHtml(ctx.className)}</span>
              ${escapeHtml(ctx.courseName)}
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">Mevcut Öğretmen: <strong>${escapeHtml(srcTeacher.name)}</strong> (${srcLoad.totalHours}/${srcTeacher.maxHours} sa)${ctx.slot === 2 ? ' · 2. Grup' : ''}</div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold shrink-0">${transferHours} sa</span>
        </div>
      `;
    }
  }

  if (unassignBtn) {
    unassignBtn.textContent = isBulk ? 'Tüm Atamalarını Kaldır' : 'Atamayı Kaldır (Boşa Çıkar)';
  }

  const candidates = teachers.filter((t) => t.id !== srcTeacher.id);
  const recommended = [];
  const others = [];
  candidates.forEach((t) => {
    const matchMain = isBulk
      ? t.branch === srcTeacher.branch
      : (isBranchMatchingCourse(t.branch, ctx.courseName) || (window.DersDutyModule && window.DersDutyModule.doesTeacherExtraMatchCourse(t, ctx.courseName, ctx.courseCode || '')));
    if (matchMain) recommended.push(t); else others.push(t);
  });
  const byLoad = (a, b) => (loadMap[a.id] ? loadMap[a.id].totalHours : 0) - (loadMap[b.id] ? loadMap[b.id].totalHours : 0);
  recommended.sort(byLoad);
  others.sort(byLoad);

  const renderOpt = (t) => {
    const cur = loadMap[t.id] ? loadMap[t.id].totalHours : 0;
    const next = cur + transferHours;
    const warn = next > t.maxHours ? ' ⚠ Aşım' : '';
    return `<option value="${t.id}">${escapeHtml(t.name)} (${escapeHtml(t.branch)} · ${cur} → ${next} / ${t.maxHours} sa${warn})</option>`;
  };

  if (targetSel) {
    targetSel.innerHTML = `<option value="">— Hedef Öğretmen Seçin —</option>`
      + (recommended.length ? `<optgroup label="Aynı Branş / Ek Ders (Önerilen)">${recommended.map(renderOpt).join('')}</optgroup>` : '')
      + (others.length ? `<optgroup label="Diğer Branşlar">${others.map(renderOpt).join('')}</optgroup>` : '');
    if (recommended.length > 0) targetSel.value = recommended[0].id;
  }

  updateM4TransferPreview();
  const modal = document.getElementById('m4TransferModal');
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  if (window.lucide) window.lucide.createIcons();
}

function closeM4TransferModal() {
  m4TransferContext = null;
  const modal = document.getElementById('m4TransferModal');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function updateM4TransferPreview() {
  const previewEl = document.getElementById('m4TransferPreviewBox');
  const targetSel = document.getElementById('m4TransferTargetSelect');
  if (!previewEl || !targetSel || !m4TransferContext) return;

  const targetId = targetSel.value;
  if (!targetId) {
    previewEl.classList.add('hidden');
    return;
  }

  const teachers = getCurrentTeachers();
  const loadMap = computeTeacherLoads();
  const srcT = teachers.find((t) => t.id === m4TransferContext.sourceTeacherId);
  const dstT = teachers.find((t) => t.id === targetId);
  if (!srcT || !dstT) { previewEl.classList.add('hidden'); return; }

  const srcCur = loadMap[srcT.id] ? loadMap[srcT.id].totalHours : 0;
  const dstCur = loadMap[dstT.id] ? loadMap[dstT.id].totalHours : 0;
  const hrs = m4TransferContext.mode === 'bulk' ? srcCur : (Number(m4TransferContext.hours) || 0);
  const srcNext = Math.max(0, srcCur - hrs);
  const dstNext = dstCur + hrs;
  const dstOver = dstNext > dstT.maxHours;

  previewEl.classList.remove('hidden');
  previewEl.innerHTML = `
    <div class="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Aktarım Sonrası Yük Önizlemesi</div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <div class="rounded-lg bg-white border border-slate-200 p-2.5">
        <div class="text-[11px] font-bold text-slate-800 truncate">${escapeHtml(srcT.name)}</div>
        <div class="text-xs mt-1"><span class="text-slate-400 line-through">${srcCur} sa</span> → <span class="font-bold text-emerald-700">${srcNext} / ${srcT.maxHours} sa</span></div>
      </div>
      <div class="rounded-lg bg-white border ${dstOver ? 'border-rose-300 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/30'} p-2.5">
        <div class="text-[11px] font-bold text-slate-800 truncate">${escapeHtml(dstT.name)}</div>
        <div class="text-xs mt-1"><span class="text-slate-400">${dstCur} sa</span> → <span class="font-bold ${dstOver ? 'text-rose-600' : 'text-indigo-700'}">${dstNext} / ${dstT.maxHours} sa</span></div>
        ${dstOver ? `<div class="text-[10px] font-semibold text-rose-600 mt-0.5">Maksimum saat sınırı (+${dstNext - dstT.maxHours} sa) aşılacak</div>` : ''}
      </div>
    </div>
  `;
}

function executeM4Transfer(unassignOnly = false) {
  if (!m4TransferContext) return;
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const targetId = unassignOnly ? null : (document.getElementById('m4TransferTargetSelect')?.value || null);
  if (!unassignOnly && !targetId) {
    showToast('Lütfen hedef bir öğretmen seçin.');
    return;
  }

  const dstTeacher = targetId ? teachers.find((t) => t.id === targetId) : null;
  let movedCount = 0;

  let unplacedCount = 0;
  if (m4TransferContext.mode === 'bulk') {
    const srcId = m4TransferContext.sourceTeacherId;
    classes.forEach((cls) => {
      (cls.courses || []).forEach((c) => {
        let changed = false;
        if (c.teacherId === srcId) { c.teacherId = targetId; movedCount++; changed = true; }
        if (c.splitGroups && c.teacherId2 === srcId) { c.teacherId2 = targetId; movedCount++; changed = true; }
        if (changed) unplacedCount += unplaceAssignmentFromSolution(cls, c, srcId, targetId);
      });
    });
  } else {
    const cls = classes.find((x) => x.id === m4TransferContext.classId);
    const c = cls && (cls.courses || []).find((x) => x.id === m4TransferContext.courseId);
    if (c) {
      const oldTid = m4TransferContext.slot === 2 ? c.teacherId2 : c.teacherId;
      if (m4TransferContext.slot === 2) c.teacherId2 = targetId;
      else c.teacherId = targetId;
      unplacedCount += unplaceAssignmentFromSolution(cls, c, oldTid, targetId);
      movedCount = 1;
    }
  }

  if (movedCount > 0) {
    if (targetId && window._m4CollapsedTeacherIds) window._m4CollapsedTeacherIds.delete(targetId);
    if (targetId && typeof m4ExpandedTeacherIds !== 'undefined') m4ExpandedTeacherIds.add(targetId);
    saveState();
    closeM4TransferModal();
    renderMenu4();
    const unpNote = unplacedCount > 0 ? ` (${unplacedCount} yerleşim boşa düşürüldü)` : '';
    showToast(
      unassignOnly
        ? `${movedCount} ders ataması kaldırıldı (boşa çıkarıldı)${unpNote}`
        : `${movedCount} ders ${dstTeacher ? dstTeacher.name : 'yeni öğretmene'} aktarıldı${unpNote}`
    );
  } else {
    closeM4TransferModal();
  }
}

function buildTeacherSelectHtml(selectedTid, courseName, teachers, loadMap, dataAttrs) {
  const matched = [], others = [];
  teachers.forEach((t) => { if (isBranchMatchingCourse(t.branch, courseName)) matched.push(t); else others.push(t); });
  const optHtml = (t) => `<option value="${t.id}" ${t.id === selectedTid ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)} · ${loadMap[t.id] ? loadMap[t.id].totalHours : 0}/${t.maxHours} sa)</option>`;
  return `
    <select ${dataAttrs} class="w-full px-2 py-1.5 rounded-lg border ${selectedTid ? 'border-slate-300 bg-white text-slate-800' : 'border-amber-300 bg-amber-50/50 text-amber-900'} text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none">
      <option value="">— Öğretmen Seçin —</option>
      ${matched.length ? `<optgroup label="Ana Branş (Önerilen)">${matched.map(optHtml).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Diğer Branşlar (Branş Dışı Atama)">${others.map(optHtml).join('')}</optgroup>` : ''}
    </select>
  `;
}

function unplaceAssignmentFromSolution(cls, course, oldTeacherId, newTeacherId) {
  if (!state.solution || !Array.isArray(state.solution.placements) || !cls || !course) return 0;
  const aid = `${cls.id}__${course.id}`;
  const removed = [];
  const kept = [];
  state.solution.placements.forEach((pl) => {
    const match = pl.assignment_id === aid || (pl.class_id === cls.id && pl.course_id === course.id);
    if (match) removed.push(pl);
    else kept.push(pl);
  });
  if (!removed.length) return 0;
  state.solution.placements = kept;
  state.solution.placed_blocks = kept.length;
  const removedKeys = new Set(removed.map((pl) => getPlacementKey(pl)));
  state.pinnedPlacementIds = (state.pinnedPlacementIds || []).filter((k) => !removedKeys.has(k));
  if (!Array.isArray(state.solution.unplaced)) state.solution.unplaced = [];
  const tMap = Object.fromEntries(getCurrentTeachers().map((t) => [t.id, t]));
  const oldName = oldTeacherId && tMap[oldTeacherId] ? tMap[oldTeacherId].name : 'Atanmamış';
  const newName = newTeacherId && tMap[newTeacherId] ? tMap[newTeacherId].name : 'Atanmamış';
  removed.forEach((pl) => {
    state.solution.unplaced.push({
      block_id: pl.block_id || `${aid}__b${pl.block_index}`,
      assignment_id: pl.assignment_id || aid,
      block_index: pl.block_index || 0,
      class_id: cls.id,
      class_name: cls.name,
      course_id: course.id,
      course_name: course.name,
      teacher_ids: [course.teacherId, course.teacherId2].filter(Boolean),
      previous_teacher_id: oldTeacherId || null,
      length: pl.length || 1,
      reason: `Öğretmen değişti (${oldName} → ${newName}); bu ders boşa düştü ve yeniden yerleşmeyi bekliyor.`
    });
  });
  return removed.length;
}

function getUnplacedCourseSummaryMap() {
  const byTeacher = {};
  const allUnplaced = [];
  if (!state.solution || !Array.isArray(state.solution.placements)) return { byTeacher, allUnplaced };
  const placedCountByAid = {};
  state.solution.placements.forEach((pl) => {
    const k = pl.assignment_id || `${pl.class_id}__${pl.course_id}`;
    placedCountByAid[k] = (placedCountByAid[k] || 0) + 1;
  });
  getCurrentClasses().forEach((cls) => {
    (cls.courses || []).forEach((c) => {
      const blocks = Array.isArray(c.blocks) && c.blocks.length ? c.blocks : [Number(c.hours) || 1];
      const aid = `${cls.id}__${c.id}`;
      const placedCnt = placedCountByAid[aid] || 0;
      const missingCnt = Math.max(0, blocks.length - placedCnt);
      if (missingCnt > 0) {
        const missingHours = blocks.slice(placedCnt).reduce((s, b) => s + (Number(b) || 1), 0);
        const item = {
          classId: cls.id,
          className: cls.name,
          courseName: c.name,
          missingBlocks: missingCnt,
          missingHours,
          teacherIds: [c.teacherId, c.teacherId2].filter(Boolean)
        };
        allUnplaced.push(item);
        item.teacherIds.forEach((tid) => {
          if (!byTeacher[tid]) byTeacher[tid] = [];
          byTeacher[tid].push(item);
        });
      }
    });
  });
  return { byTeacher, allUnplaced };
}

function renderMenu4() {
  ensureState(state);
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const rooms = getCurrentRooms();
  const loadMap = computeTeacherLoads();

  let totalHours = 0, assignedHours = 0, unassignedCount = 0, crossBranchCount = 0;
  const flatRows = [];
  classes.forEach((cls) => {
    (cls.courses || []).forEach((c) => {
      const hrs = Number(c.hours) || 0;
      totalHours += hrs;
      const needsTwo = Boolean(c.splitGroups);
      const hasT1 = Boolean(c.teacherId && teachers.some((t) => t.id === c.teacherId));
      const hasT2 = !needsTwo || Boolean(c.teacherId2 && teachers.some((t) => t.id === c.teacherId2));
      if (hasT1 && hasT2) assignedHours += hrs; else unassignedCount++;
      const t1 = teachers.find((t) => t.id === c.teacherId);
      const isCross = Boolean(t1 && !isBranchMatchingCourse(t1.branch, c.name));
      if (isCross) crossBranchCount++;
      flatRows.push({ cls, c, isAssigned: hasT1 && hasT2, isCross });
    });
  });

  const pct = totalHours > 0 ? Math.round((assignedHours / totalHours) * 100) : 0;
  let overloaded = 0;
  Object.values(loadMap).forEach((entry) => { if (entry.totalHours > entry.teacher.maxHours) overloaded++; });

  document.getElementById('m4KpiAssignedHours').textContent = `${assignedHours} / ${totalHours} sa`;
  document.getElementById('m4KpiAssignedPct').textContent = `%${pct} tamamlandı`;
  document.getElementById('m4KpiUnassigned').textContent = `${unassignedCount} ders`;
  document.getElementById('m4KpiCrossBranch').textContent = `${crossBranchCount} branş dışı atama`;
  document.getElementById('m4KpiOverloaded').textContent = `${overloaded}`;
  document.getElementById('m4KpiOverloaded').className = 'text-2xl font-bold mt-1 ' + (overloaded > 0 ? 'text-rose-600' : 'text-emerald-600');
  document.getElementById('m4KpiTeacherSummary').textContent = `${teachers.length} öğretmen kayıtlı`;
  document.getElementById('m4KpiRooms').textContent = `${rooms.length} mekan`;
  const tabBadgeAssign = document.getElementById('m4TabBadgeAssign');
  if (tabBadgeAssign) tabBadgeAssign.textContent = unassignedCount > 0 ? `${unassignedCount} boş` : `${flatRows.length} ders`;
  const tabBadgeRooms = document.getElementById('m4TabBadgeRooms');
  if (tabBadgeRooms) tabBadgeRooms.textContent = `${rooms.length}`;

  // Geniş Sekme Görünümünü Güncelle
  if (!window._m4ActiveTab) window._m4ActiveTab = 'assign';
  const activeTab = window._m4ActiveTab;
  document.getElementById('m4PanelAssign')?.classList.toggle('hidden', activeTab !== 'assign');
  document.getElementById('m4PanelLoads')?.classList.toggle('hidden', activeTab !== 'loads');
  document.getElementById('m4PanelRooms')?.classList.toggle('hidden', activeTab !== 'rooms');
  document.querySelectorAll('.m4-ws-tab').forEach((btn) => {
    const isAct = btn.dataset.m4Tab === activeTab;
    btn.className = `m4-ws-tab ${btn.dataset.m4Tab === 'rooms' ? '' : 'flex-1 min-w-[180px] '}inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${isAct ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`;
  });

  // Filtre Durumunu Doğrula ve Girdileri Senkronize Et (Gizli Filtre Hatasını Önler)
  if (state.m4ClassFilter && state.m4ClassFilter !== 'ALL' && !classes.some((c) => c.id === state.m4ClassFilter)) {
    state.m4ClassFilter = 'ALL';
  }
  const clsFilter = document.getElementById('m4ClassFilter');
  clsFilter.innerHTML = `<option value="ALL">Tüm Şubeler (${classes.length})</option>` +
    classes.map((cls) => `<option value="${cls.id}" ${state.m4ClassFilter === cls.id ? 'selected' : ''}>${escapeHtml(cls.name)}</option>`).join('');
  const searchInputEl = document.getElementById('m4Search');
  if (searchInputEl && searchInputEl.value !== (state.m4Search || '')) searchInputEl.value = state.m4Search || '';
  const onlyUnassEl = document.getElementById('m4OnlyUnassigned');
  if (onlyUnassEl) onlyUnassEl.checked = Boolean(state.m4OnlyUnassigned);

  const tableWrap = document.getElementById('m4AssignTableWrap');
  const filterBannerEl = document.getElementById('m4FilterStatusBanner');
  const btnResetFilters = document.getElementById('btnM4ResetFilters');
  if (classes.length === 0 || flatRows.length === 0) {
    if (filterBannerEl) filterBannerEl.classList.add('hidden');
    if (btnResetFilters) btnResetFilters.classList.add('hidden');
    tableWrap.innerHTML = `<div class="py-12 px-4 text-center space-y-3"><div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto"><i data-lucide="clipboard-list" class="w-6 h-6"></i></div><div class="text-sm font-bold text-slate-800">Atanacak Şube veya Ders Bulunamadı</div><p class="text-xs text-slate-500 max-w-md mx-auto">Önce Menü 2'den şube ve dersleri, Menü 3'ten öğretmenlerinizi ekleyin.</p></div>`;
  } else if (teachers.length === 0) {
    if (filterBannerEl) filterBannerEl.classList.add('hidden');
    if (btnResetFilters) btnResetFilters.classList.add('hidden');
    tableWrap.innerHTML = `<div class="py-12 px-4 text-center space-y-3"><div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><i data-lucide="user-plus" class="w-6 h-6"></i></div><div class="text-sm font-bold text-slate-800">Henüz Öğretmen Eklenmedi</div><p class="text-xs text-slate-500 max-w-md mx-auto">Ders ataması için Menü 3'ten öğretmen kadronuzu oluşturun.</p></div>`;
  } else {
    const q = (state.m4Search || '').trim().toLocaleLowerCase('tr-TR');
    const hasAnyFilter = (state.m4ClassFilter && state.m4ClassFilter !== 'ALL') || Boolean(state.m4OnlyUnassigned) || Boolean(q);
    const filtered = flatRows.filter((row) => {
      if (state.m4ClassFilter !== 'ALL' && row.cls.id !== state.m4ClassFilter) return false;
      if (state.m4OnlyUnassigned && row.isAssigned) return false;
      if (q) {
        const t1 = teachers.find((t) => t.id === row.c.teacherId);
        const hay = `${row.cls.name} ${row.c.code} ${row.c.name} ${t1 ? t1.name + ' ' + t1.branch : ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (btnResetFilters) btnResetFilters.classList.toggle('hidden', !hasAnyFilter);
    if (filterBannerEl) {
      if (hasAnyFilter) {
        const activeParts = [];
        if (state.m4ClassFilter !== 'ALL') {
          const fc = classes.find((x) => x.id === state.m4ClassFilter);
          activeParts.push(`Şube: ${fc ? fc.name : state.m4ClassFilter}`);
        }
        if (state.m4OnlyUnassigned) activeParts.push('Sadece Atanmamışlar');
        if (q) activeParts.push(`Arama: "${state.m4Search}"`);
        filterBannerEl.className = 'rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs';
        filterBannerEl.innerHTML = `<div class="text-amber-900 font-semibold">Aktif filtre (${escapeHtml(activeParts.join(' · '))}): Toplam <strong>${flatRows.length}</strong> dersten <strong>${filtered.length}</strong> tanesi gösteriliyor${unassignedCount > 0 ? ` (${unassignedCount} atanmamış ders mevcut)` : ''}.</div><button type="button" id="btnM4BannerReset" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition">Tüm Dersleri Göster</button>`;
        document.getElementById('btnM4BannerReset')?.addEventListener('click', () => {
          state.m4ClassFilter = 'ALL'; state.m4OnlyUnassigned = false; state.m4Search = '';
          saveState(); renderMenu4();
        });
      } else {
        filterBannerEl.classList.add('hidden');
      }
    }

    if (filtered.length === 0) {
      tableWrap.innerHTML = `<div class="py-8 text-center space-y-2"><div class="text-xs text-slate-500">Seçili filtreye uyan ders bulunamadı.</div><button type="button" id="btnM4EmptyReset" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Tüm Filtreleri Temizle</button></div>`;
      document.getElementById('btnM4EmptyReset')?.addEventListener('click', () => {
        state.m4ClassFilter = 'ALL'; state.m4OnlyUnassigned = false; state.m4Search = '';
        saveState(); renderMenu4();
      });
    } else {
      tableWrap.innerHTML = `
        <table class="w-full text-left text-xs border-collapse min-w-[660px]">
          <thead>
            <tr class="bg-slate-50 border-y border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
              <th class="py-2.5 px-2.5 w-16">Şube</th>
              <th class="py-2.5 px-2.5">Ders & Blok</th>
              <th class="py-2.5 px-2.5 w-64">Öğretmen Ataması (Tüm Branşlar Açık)</th>
              <th class="py-2.5 px-2.5 w-36">Özel Mekan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${filtered.map(({ cls, c, isCross }) => {
              const blks = getCourseBlocks(c).join('+');
              const sel1 = buildTeacherSelectHtml(c.teacherId || '', c.name, teachers, loadMap, `data-acls="${cls.id}" data-acrs="${c.id}" data-slot="1"`);
              const sel2 = c.splitGroups ? `<div class="mt-1.5">${buildTeacherSelectHtml(c.teacherId2 || '', c.name, teachers, loadMap, `data-acls="${cls.id}" data-acrs="${c.id}" data-slot="2"`)}</div>` : '';
              const roomSelect = `<select data-rcls="${cls.id}" data-rcrs="${c.id}" class="m4-room-sel w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none"><option value="">Sınıf Dersliği</option>${rooms.map((r) => `<option value="${r.id}" ${c.assignedRoomId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select>`;
              return `<tr class="hover:bg-slate-50/70">
                <td class="py-2.5 px-2.5 font-bold text-indigo-700 whitespace-nowrap">${escapeHtml(cls.name)}</td>
                <td class="py-2.5 px-2.5">
                  <div class="font-semibold text-slate-900"><span class="font-mono text-[11px] text-slate-500 mr-1">${escapeHtml(c.code)}</span>${escapeHtml(c.name)}</div>
                  <div class="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5"><span class="font-bold text-slate-700">${c.hours} sa</span><span class="font-mono">(${blks})</span>${c.splitGroups ? '<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">2 Grup</span>' : ''}${isCross ? '<span class="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold">Branş Dışı</span>' : ''}</div>
                </td>
                <td class="py-2.5 px-2.5">${sel1}${sel2}</td>
                <td class="py-2.5 px-2.5">${roomSelect}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
      tableWrap.querySelectorAll('select[data-acls]').forEach((sel) => sel.addEventListener('change', () => {
        const cls = classes.find((x) => x.id === sel.dataset.acls);
        const c = cls && (cls.courses || []).find((x) => x.id === sel.dataset.acrs);
        if (!c) return;
        const oldTid = sel.dataset.slot === '2' ? c.teacherId2 : c.teacherId;
        const newTid = sel.value || null;
        if (sel.dataset.slot === '2') c.teacherId2 = newTid; else c.teacherId = newTid;
        const dropped = unplaceAssignmentFromSolution(cls, c, oldTid, newTid);
        saveState(); renderMenu4();
        if (dropped > 0) {
          showToast(`${cls.name} - ${c.name} dersi öğretmen değiştiği için boşa düştü (${dropped} blok). Menü 5'ten "Boştaki Dersleri Yerleştir" ile dağıtabilirsiniz.`);
        }
      }));
      tableWrap.querySelectorAll('.m4-room-sel').forEach((sel) => sel.addEventListener('change', () => {
        const cls = classes.find((x) => x.id === sel.dataset.rcls);
        const c = cls && (cls.courses || []).find((x) => x.id === sel.dataset.rcrs);
        if (!c) return;
        c.assignedRoomId = sel.value || null;
        saveState();
      }));
    }
  }

  const loadListEl = document.getElementById('m4TeacherLoadList');
  const loadCountBadge = document.getElementById('m4LoadCountBadge');
  const lq = (m4LoadSearchText || '').trim().toLocaleLowerCase('tr-TR');

  const filteredTeachers = teachers.filter((t) => {
    const info = loadMap[t.id] || { totalHours: 0, assignments: [] };
    if (m4LoadFilterMode === 'OVER' && !(info.totalHours > t.maxHours)) return false;
    if (m4LoadFilterMode === 'ACTIVE' && info.totalHours === 0) return false;
    if (m4LoadFilterMode === 'EMPTY' && info.totalHours > 0) return false;
    if (lq) {
      const courseNames = info.assignments.map((a) => `${a.className} ${a.courseName}`).join(' ');
      const hay = `${t.name} ${t.branch} ${courseNames}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(lq)) return false;
    }
    return true;
  }).sort((a, b) => {
    const la = loadMap[a.id] ? loadMap[a.id].totalHours : 0;
    const lb = loadMap[b.id] ? loadMap[b.id].totalHours : 0;
    const oa = la > a.maxHours ? 1 : 0;
    const ob = lb > b.maxHours ? 1 : 0;
    if (oa !== ob) return ob - oa; // Yük aşanlar en üstte
    if (lb !== la) return lb - la;
    return a.name.localeCompare(b.name, 'tr');
  });

  if (loadCountBadge) loadCountBadge.textContent = `${filteredTeachers.length} / ${teachers.length}`;

  if (!window._m4SelectedLoadKeys) window._m4SelectedLoadKeys = new Set();
  if (!window._m4CollapsedTeacherIds) window._m4CollapsedTeacherIds = new Set();
  const selLoadKeys = window._m4SelectedLoadKeys;
  const collapsedTIds = window._m4CollapsedTeacherIds;

  // Geçersiz seçimleri temizle
  const validLoadKeySet = new Set();
  teachers.forEach((t) => {
    const info = loadMap[t.id] || { assignments: [] };
    info.assignments.forEach((a) => validLoadKeySet.add(`${t.id}::${a.classId}::${a.courseId}::${a.slot}`));
  });
  for (const k of Array.from(selLoadKeys)) {
    if (!validLoadKeySet.has(k)) selLoadKeys.delete(k);
  }

  const bulkHostEl = document.getElementById('m4TeacherLoadBulkHost');
  if (teachers.length === 0) {
    if (bulkHostEl) bulkHostEl.innerHTML = '';
    loadListEl.innerHTML = `<div class="col-span-full py-10 text-center text-xs text-slate-400">Henüz öğretmen eklenmedi.</div>`;
  } else if (filteredTeachers.length === 0) {
    if (bulkHostEl) bulkHostEl.innerHTML = '';
    loadListEl.innerHTML = `<div class="col-span-full py-10 text-center text-xs text-slate-400">Filtreye uyan öğretmen bulunamadı.</div>`;
  } else {
    const bulkBarHtml = selLoadKeys.size > 0 ? `
      <div class="sticky top-2 z-20 rounded-xl border border-indigo-300 bg-indigo-50/95 backdrop-blur p-3 shadow-md flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-extrabold">${selLoadKeys.size} ders seçildi</span>
          <button type="button" id="btnM4BulkClearSel" class="text-xs font-semibold text-slate-600 hover:text-slate-900 underline">Seçimi Temizle</button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select id="m4BulkTargetTeacher" class="min-w-[210px] px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-semibold text-slate-800">
            <option value="">Hedef öğretmen seçin...</option>
            ${teachers.map((tt) => {
              const li = loadMap[tt.id] ? loadMap[tt.id].totalHours : 0;
              return `<option value="${tt.id}">${escapeHtml(tt.name)} (${escapeHtml(tt.branch)} · ${li}/${tt.maxHours || 30}s)</option>`;
            }).join('')}
          </select>
          <button type="button" id="btnM4BulkTransferSelected" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition">Seçilenleri Aktar</button>
          <button type="button" id="btnM4BulkRemoveSelected" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition">Öğretmenlerden Al</button>
        </div>
      </div>
    ` : '';
    if (bulkHostEl) bulkHostEl.innerHTML = bulkBarHtml;

    loadListEl.innerHTML = filteredTeachers.map((t) => {
      const info = loadMap[t.id] || { totalHours: 0, coursesSummary: {}, crossBranchHours: 0, assignments: [] };
      const maxH = Math.max(1, Number(t.maxHours) || 30);
      const minH = Number(t.minHours) || 1;
      const ratio = Math.min(100, Math.round((info.totalHours / maxH) * 100));
      const isOver = info.totalHours > maxH;
      const isEmpty = info.totalHours === 0;
      const isBelowMin = !isEmpty && info.totalHours < minH;
      const remaining = maxH - info.totalHours;
      const isExpanded = !collapsedTIds.has(t.id);

      const avatarCls = isOver
        ? 'bg-rose-600 text-white'
        : isEmpty
          ? 'bg-slate-200 text-slate-600'
          : isBelowMin
            ? 'bg-amber-500 text-white'
            : 'bg-indigo-600 text-white';
      const barColor = isOver ? 'bg-rose-500' : (isEmpty ? 'bg-slate-300' : (isBelowMin ? 'bg-amber-400' : 'bg-emerald-500'));
      const statusBadge = isOver
        ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">+${info.totalHours - maxH}s Aşım</span>`
        : isEmpty
          ? `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">Derssiz</span>`
          : `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">${remaining > 0 ? `+${remaining}s boş` : 'Tam dolu'}</span>`;

      const tAllKeys = info.assignments.map((a) => `${t.id}::${a.classId}::${a.courseId}::${a.slot}`);
      const allSelected = tAllKeys.length > 0 && tAllKeys.every((k) => selLoadKeys.has(k));

      const expandedRows = info.assignments.length === 0
        ? `<div class="py-4 text-center text-xs text-slate-400 bg-white/70 rounded-lg border border-dashed border-slate-200">Bu öğretmene henüz ders atanmamış. Aşağıdan <strong>+ Ders Ekle / Ata</strong> ile hemen ekleyebilirsiniz.</div>`
        : info.assignments.map((a) => {
          const k = `${t.id}::${a.classId}::${a.courseId}::${a.slot}`;
          const checked = selLoadKeys.has(k);
          const blkText = (Array.isArray(a.blocks) && a.blocks.length ? a.blocks : [a.hours]).join('+');
          return `
          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2 px-2.5 rounded-xl border transition ${checked ? 'bg-indigo-50/80 border-indigo-300' : 'bg-white border-slate-200/80 hover:border-indigo-300'}">
            <label class="min-w-0 flex items-center gap-2 flex-1 cursor-pointer">
              <input type="checkbox" class="m4-load-chk rounded border-slate-300 text-indigo-600 shrink-0" data-load-key="${escapeHtml(k)}" ${checked ? 'checked' : ''} />
              <span class="shrink-0 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[11px]">${escapeHtml(a.className)}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-800 truncate">${escapeHtml(a.courseName)}${a.slot === 2 ? ' <span class="text-[10px] text-indigo-600">(2.Grup)</span>' : ''}</div>
                <div class="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="font-bold text-slate-700">${a.hours} sa</span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">Blok: ${blkText}</span>
                  ${a.isCross ? '<span class="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-semibold">Branş dışı</span>' : ''}
                </div>
              </div>
            </label>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button"
                class="m4-edit-course-one inline-flex items-center px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white text-[10px] font-bold transition"
                data-cls-id="${a.classId}" data-crs-id="${a.courseId}" title="Ders saatini, adını veya bloklarını düzelt">
                Düzelt
              </button>
              <button type="button"
                class="m4-transfer-one inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-[10px] font-bold transition"
                data-src-tid="${t.id}" data-cls-id="${a.classId}" data-cls-name="${escapeHtml(a.className)}"
                data-crs-id="${a.courseId}" data-crs-code="${escapeHtml(a.courseCode)}" data-crs-name="${escapeHtml(a.courseName)}"
                data-hrs="${a.hours}" data-slot="${a.slot}" title="Başka öğretmene değiştir / aktar">
                Değiştir
              </button>
              <button type="button"
                class="m4-unassign-one inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white text-[10px] font-bold transition"
                data-src-tid="${t.id}" data-cls-id="${a.classId}" data-crs-id="${a.courseId}" data-slot="${a.slot}"
                title="Dersi bu öğretmenden al (şubede boşa çıkar)">
                Al
              </button>
              <button type="button"
                class="m4-delete-course-one inline-flex items-center px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[10px] font-bold transition"
                data-cls-id="${a.classId}" data-crs-id="${a.courseId}" data-cls-name="${escapeHtml(a.className)}" data-crs-name="${escapeHtml(a.courseName)}"
                title="Bu dersi şubeden tamamen sil">
                Sil
              </button>
            </div>
          </div>`;
        }).join('');

      return `
        <div class="rounded-2xl border shadow-xs transition-all flex flex-col ${isOver ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300'}">
          <div class="p-4 space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                ${info.assignments.length > 0 ? `<input type="checkbox" class="m4-load-select-all-t rounded border-slate-300 text-indigo-600 shrink-0" data-selall-tid="${t.id}" title="Bu öğretmenin tüm derslerini seç" ${allSelected ? 'checked' : ''} />` : ''}
                <button type="button" data-toggle-tid="${t.id}" class="m4-load-toggle flex items-center gap-2.5 min-w-0 flex-1 text-left">
                  <div class="w-10 h-10 rounded-xl ${avatarCls} flex items-center justify-center text-xs font-extrabold shrink-0 shadow-xs">${escapeHtml(getTeacherInitials(t.name))}</div>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-slate-900 truncate">${escapeHtml(t.name)}</div>
                    <div class="text-xs text-slate-500 truncate">${escapeHtml(t.branch)} · ${info.assignments.length} ders${info.crossBranchHours > 0 ? ` · <span class="text-teal-700 font-semibold">${info.crossBranchHours}s branş dışı</span>` : ''}</div>
                  </div>
                </button>
              </div>
              <button type="button" data-toggle-tid="${t.id}" class="m4-load-toggle flex flex-col items-end shrink-0 gap-1">
                <div class="flex items-center gap-1">
                  <span class="text-sm font-extrabold ${isOver ? 'text-rose-600' : 'text-slate-900'}">${info.totalHours}<span class="text-xs font-medium text-slate-400">/${maxH}s</span></span>
                  <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-slate-400"></i>
                </div>
                ${statusBadge}
              </button>
            </div>
            <div class="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div class="h-full ${barColor} rounded-full transition-all" style="width: ${ratio}%;"></div>
            </div>
          </div>
          ${isExpanded ? `
            <div class="px-4 pb-4 pt-2 border-t border-slate-200/70 space-y-2.5 flex-1 flex flex-col justify-between">
              <div class="space-y-1.5">${expandedRows}</div>
              <div class="flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-slate-200/60">
                <div class="flex items-center gap-1.5">
                  <button type="button" data-add-for-tid="${t.id}" class="m4-add-course-for-t inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition">
                    + Ders Ekle / Ata
                  </button>
                  <button type="button" data-filter-tname="${escapeHtml(t.name)}" class="m4-filter-teacher inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition">
                    Tabloda Gör
                  </button>
                </div>
                <div class="flex items-center gap-1.5">
                  ${info.assignments.length > 0 ? `
                    <button type="button" data-unassign-all-tid="${t.id}" class="m4-unassign-all inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[11px] font-bold transition">
                      Tümünü Al
                    </button>
                    <button type="button" data-bulk-tid="${t.id}" class="m4-transfer-bulk inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition">
                      Tümünü Aktar (${info.assignments.length})
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    loadListEl.querySelectorAll('.m4-add-course-for-t').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openM4TeacherAddCourseModal(btn.dataset.addForTid);
    }));

    loadListEl.querySelectorAll('.m4-edit-course-one').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cls = classes.find((x) => x.id === btn.dataset.clsId);
      const c = cls && (cls.courses || []).find((x) => x.id === btn.dataset.crsId);
      if (!cls || !c) return;
      state.selectedClassId = cls.id;
      openCourseModal(c, c.category || 'zorunlu');
    }));

    loadListEl.querySelectorAll('.m4-delete-course-one').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cls = classes.find((x) => x.id === btn.dataset.clsId);
      if (!cls) return;
      const idx = (cls.courses || []).findIndex((x) => x.id === btn.dataset.crsId);
      if (idx < 0) return;
      const c = cls.courses[idx];
      if (!confirm(`${cls.name} şubesinden "${c.name}" (${c.hours} sa) dersini kalıcı olarak silmek istiyor musunuz?`)) return;
      unplaceAssignmentFromSolution(cls, c, c.teacherId, null);
      cls.courses.splice(idx, 1);
      saveState(); renderMenu4();
      showToast(`${cls.name} - ${c.name} dersi şubeden silindi.`);
    }));

    loadListEl.querySelectorAll('.m4-load-toggle').forEach((btn) => btn.addEventListener('click', () => {
      const tid = btn.dataset.toggleTid;
      if (collapsedTIds.has(tid)) collapsedTIds.delete(tid);
      else collapsedTIds.add(tid);
      renderMenu4();
    }));

    loadListEl.querySelectorAll('.m4-load-chk').forEach((chk) => chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const k = chk.dataset.loadKey;
      if (chk.checked) selLoadKeys.add(k); else selLoadKeys.delete(k);
      renderMenu4();
    }));

    loadListEl.querySelectorAll('.m4-load-select-all-t').forEach((chk) => chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const tid = chk.dataset.selallTid;
      const info = loadMap[tid] || { assignments: [] };
      info.assignments.forEach((a) => {
        const k = `${tid}::${a.classId}::${a.courseId}::${a.slot}`;
        if (chk.checked) selLoadKeys.add(k); else selLoadKeys.delete(k);
      });
      renderMenu4();
    }));

    loadListEl.querySelectorAll('.m4-unassign-one').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cls = classes.find((x) => x.id === btn.dataset.clsId);
      const c = cls && (cls.courses || []).find((x) => x.id === btn.dataset.crsId);
      if (!c) return;
      const slot = Number(btn.dataset.slot) || 1;
      const oldTid = btn.dataset.srcTid;
      if (slot === 2) c.teacherId2 = null; else c.teacherId = null;
      const dropped = unplaceAssignmentFromSolution(cls, c, oldTid, null);
      selLoadKeys.delete(`${oldTid}::${cls.id}::${c.id}::${slot}`);
      saveState(); renderMenu4();
      showToast(`${cls.name} - ${c.name} öğretmenden alındı${dropped > 0 ? ` (${dropped} blok programda boşa düştü)` : ''}.`);
    }));

    loadListEl.querySelectorAll('.m4-unassign-all').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tid = btn.dataset.unassignAllTid;
      let count = 0; let droppedTotal = 0;
      classes.forEach((cls) => (cls.courses || []).forEach((c) => {
        if (c.teacherId === tid) { c.teacherId = null; count++; droppedTotal += unplaceAssignmentFromSolution(cls, c, tid, null); }
        if (c.teacherId2 === tid) { c.teacherId2 = null; count++; droppedTotal += unplaceAssignmentFromSolution(cls, c, tid, null); }
      }));
      saveState(); renderMenu4();
      showToast(`${count} ders öğretmenden alındı${droppedTotal > 0 ? ` (${droppedTotal} blok boşa düştü)` : ''}.`);
    }));

    const btnClrSel = document.getElementById('btnM4BulkClearSel');
    if (btnClrSel) btnClrSel.addEventListener('click', () => { selLoadKeys.clear(); renderMenu4(); });

    const btnBulkTr = document.getElementById('btnM4BulkTransferSelected');
    if (btnBulkTr) btnBulkTr.addEventListener('click', () => {
      const targetTid = (document.getElementById('m4BulkTargetTeacher') || {}).value;
      if (!targetTid) { showToast('Lütfen aktarılacak hedef öğretmeni seçin.'); return; }
      let moved = 0; let droppedTotal = 0;
      Array.from(selLoadKeys).forEach((k) => {
        const [srcTid, clsId, crsId, slotStr] = k.split('::');
        const cls = classes.find((x) => x.id === clsId);
        const c = cls && (cls.courses || []).find((x) => x.id === crsId);
        if (!c) return;
        const slot = Number(slotStr) || 1;
        if (slot === 2) c.teacherId2 = targetTid; else c.teacherId = targetTid;
        droppedTotal += unplaceAssignmentFromSolution(cls, c, srcTid, targetTid);
        moved++;
      });
      selLoadKeys.clear();
      saveState(); renderMenu4();
      showToast(`${moved} seçili ders yeni öğretmene aktarıldı${droppedTotal > 0 ? ` (${droppedTotal} blok programda boşa düştü)` : ''}.`);
    });

    const btnBulkRm = document.getElementById('btnM4BulkRemoveSelected');
    if (btnBulkRm) btnBulkRm.addEventListener('click', () => {
      let removed = 0; let droppedTotal = 0;
      Array.from(selLoadKeys).forEach((k) => {
        const [srcTid, clsId, crsId, slotStr] = k.split('::');
        const cls = classes.find((x) => x.id === clsId);
        const c = cls && (cls.courses || []).find((x) => x.id === crsId);
        if (!c) return;
        const slot = Number(slotStr) || 1;
        if (slot === 2) c.teacherId2 = null; else c.teacherId = null;
        droppedTotal += unplaceAssignmentFromSolution(cls, c, srcTid, null);
        removed++;
      });
      selLoadKeys.clear();
      saveState(); renderMenu4();
      showToast(`${removed} seçili ders öğretmenlerden alındı${droppedTotal > 0 ? ` (${droppedTotal} blok boşa düştü)` : ''}.`);
    });

    loadListEl.querySelectorAll('.m4-transfer-one').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openM4TransferModal({
        mode: 'single',
        sourceTeacherId: btn.dataset.srcTid,
        classId: btn.dataset.clsId,
        className: btn.dataset.clsName,
        courseId: btn.dataset.crsId,
        courseCode: btn.dataset.crsCode,
        courseName: btn.dataset.crsName,
        hours: Number(btn.dataset.hrs) || 0,
        slot: Number(btn.dataset.slot) || 1
      });
    }));

    loadListEl.querySelectorAll('.m4-transfer-bulk').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openM4TransferModal({ mode: 'bulk', sourceTeacherId: btn.dataset.bulkTid });
    }));

    loadListEl.querySelectorAll('.m4-filter-teacher').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.filterTname || '';
      window._m4ActiveTab = 'assign';
      state.m4ClassFilter = 'ALL';
      state.m4OnlyUnassigned = false;
      state.m4Search = name;
      const searchEl = document.getElementById('m4Search');
      if (searchEl) searchEl.value = name;
      renderMenu4();
    }));
  }

  const roomListEl = document.getElementById('m4RoomList');
  if (rooms.length === 0) {
    roomListEl.innerHTML = `<div class="py-4 text-center text-xs text-slate-400">Henüz özel mekan eklenmedi.</div>`;
  } else {
    roomListEl.innerHTML = rooms.map((r) => {
      const typeObj = ROOM_TYPES.find((x) => x.id === r.roomType);
      return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
        <div class="min-w-0"><div class="text-xs font-bold text-slate-800 truncate">${escapeHtml(r.name)}</div><div class="text-[10px] text-slate-500">${typeObj ? typeObj.label : r.roomType} · Kapasite: ${r.capacity} sınıf</div></div>
        <button type="button" data-del-room="${r.id}" class="m4-del-room p-1 rounded text-rose-500 hover:bg-rose-50" title="Mekanı sil"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>`;
    }).join('');
    roomListEl.querySelectorAll('.m4-del-room').forEach((btn) => btn.addEventListener('click', () => {
      const idx = rooms.findIndex((r) => r.id === btn.dataset.delRoom);
      if (idx >= 0) { const rm = rooms.splice(idx, 1)[0]; saveState(); renderMenu4(); showToast(`${rm.name} silindi`); }
    }));
  }

  if (window.lucide) window.lucide.createIcons();
}

function openRoomModal() {
  document.getElementById('rmType').innerHTML = ROOM_TYPES.filter((r) => r.id !== 'standard').map((r) => `<option value="${r.id}">${r.label}</option>`).join('') + `<option value="standard">Diğer Özel Derslik</option>`;
  document.getElementById('rmName').value = '';
  document.getElementById('rmCap').value = '1';
  const m = document.getElementById('roomModal'); m.classList.remove('hidden'); m.classList.add('flex');
}

/* ---------- Menü 4: Öğretmen Ders Yüklerinden Ders Ekle / Başka Öğretmene Ata ---------- */
let m4AddCourseMode = 'existing';

function setM4AddCourseMode(mode) {
  m4AddCourseMode = mode === 'new' ? 'new' : 'existing';
  document.getElementById('m4AddModeExisting')?.classList.toggle('hidden', m4AddCourseMode !== 'existing');
  document.getElementById('m4AddModeNew')?.classList.toggle('hidden', m4AddCourseMode !== 'new');
  document.querySelectorAll('.m4-add-mode-btn').forEach((b) => {
    const act = b.dataset.m4AddMode === m4AddCourseMode;
    b.className = `m4-add-mode-btn py-2 px-3 rounded-lg text-xs font-bold transition ${act ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`;
  });
}

function populateM4AddNewTemplates() {
  const clsSel = document.getElementById('m4AddNewClassSel');
  const tplSel = document.getElementById('m4AddNewTemplateSel');
  if (!clsSel || !tplSel) return;
  const cls = getCurrentClasses().find((x) => x.id === clsSel.value);
  if (!cls) { tplSel.innerHTML = '<option value="">— Şube seçin —</option>'; return; }
  const allTpls = [
    ...getMebTemplatesForGrade(state.school.schoolTypeId, cls.gradeKey, 'elective'),
    ...getMebTemplatesForGrade(state.school.schoolTypeId, cls.gradeKey, 'mandatory')
  ].filter((t) => !findDuplicateCourseInClass(cls, t.code, t.name));
  tplSel.innerHTML = `<option value="">— Manuel giriş veya şablon seçin (${allTpls.length}) —</option>` +
    allTpls.map((t, i) => `<option value="${i}" data-code="${escapeHtml(t.code)}" data-name="${escapeHtml(t.name)}" data-cat="${escapeHtml(t.category)}" data-grp="${escapeHtml(t.group || '')}" data-hrs="${t.hours}">${escapeHtml(t.name)} (${t.hours} sa · ${escapeHtml(t.group || t.category)})</option>`).join('');
}

function openM4TeacherAddCourseModal(defaultTid = '') {
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const loadMap = computeTeacherLoads();
  if (!classes.length) { showToast('Önce Menü 2’den en az bir şube oluşturun.'); return; }
  if (!teachers.length) { showToast('Önce Menü 3’ten en az bir öğretmen ekleyin.'); return; }

  const defT = teachers.find((t) => t.id === defaultTid) || null;
  const titleEl = document.getElementById('m4AddCourseTitle');
  if (titleEl) titleEl.textContent = defT ? `${defT.name} — Ders Ekle / Ata` : 'Ders Ekle ve Öğretmen Ata';

  const teacherOpts = `<option value="">— Öğretmen Atamadan Ekle —</option>` + teachers.map((t) => {
    const ld = loadMap[t.id] ? loadMap[t.id].totalHours : 0;
    return `<option value="${t.id}" ${t.id === defaultTid ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)} · ${ld}/${t.maxHours || 30} sa)</option>`;
  }).join('');

  // Mod A: Atanmamış dersler listesi
  const unassignedList = [];
  classes.forEach((cls) => (cls.courses || []).forEach((c) => {
    if (!c.teacherId || !teachers.some((t) => t.id === c.teacherId)) {
      unassignedList.push({ cls, c, slot: 1 });
    } else if (c.splitGroups && (!c.teacherId2 || !teachers.some((t) => t.id === c.teacherId2))) {
      unassignedList.push({ cls, c, slot: 2 });
    }
  }));
  const exSel = document.getElementById('m4AddExistingCourseSel');
  if (exSel) {
    exSel.innerHTML = unassignedList.length === 0
      ? '<option value="">Tüm mevcut dersler atanmış (Yeni Ders Ekle sekmesini kullanın)</option>'
      : unassignedList.map((u) => `<option value="${u.cls.id}::${u.c.id}::${u.slot}">${escapeHtml(u.cls.name)} · ${escapeHtml(u.c.name)} (${u.c.hours} sa · Blok: ${getCourseBlocks(u.c).join('+')})${u.slot === 2 ? ' [2. Grup]' : ''}</option>`).join('');
  }
  const exTSel = document.getElementById('m4AddExistingTeacherSel');
  if (exTSel) exTSel.innerHTML = teacherOpts;

  // Mod B: Şubeye yeni ders ekle
  const newClsSel = document.getElementById('m4AddNewClassSel');
  if (newClsSel) {
    newClsSel.innerHTML = classes.map((cls) => {
      const ev = evaluateClass(cls);
      const diff = ev.targetTotal - ev.totalHours;
      const diffTxt = diff > 0 ? `${diff} sa eksik` : (diff < 0 ? `+${Math.abs(diff)} sa fazla` : 'Tam');
      return `<option value="${cls.id}">${escapeHtml(cls.name)} (${ev.totalHours}/${ev.targetTotal} sa · ${diffTxt})</option>`;
    }).join('');
  }
  populateM4AddNewTemplates();
  const newTSel = document.getElementById('m4AddNewTeacherSel');
  if (newTSel) newTSel.innerHTML = teacherOpts;
  const nName = document.getElementById('m4AddNewName'); if (nName) nName.value = '';
  const nCode = document.getElementById('m4AddNewCode'); if (nCode) nCode.value = '';
  const nHrs = document.getElementById('m4AddNewHours'); if (nHrs) nHrs.value = '2';
  const nBlks = document.getElementById('m4AddNewBlocks'); if (nBlks) nBlks.value = '';

  setM4AddCourseMode(unassignedList.length > 0 ? 'existing' : 'new');
  const m = document.getElementById('m4TeacherAddCourseModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

function closeM4TeacherAddCourseModal() {
  const m = document.getElementById('m4TeacherAddCourseModal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

function submitM4TeacherAddCourse() {
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  if (m4AddCourseMode === 'existing') {
    const val = document.getElementById('m4AddExistingCourseSel')?.value || '';
    const tid = document.getElementById('m4AddExistingTeacherSel')?.value || '';
    if (!val) { showToast('Atanacak boş ders seçilmedi.'); return; }
    if (!tid) { showToast('Lütfen atanacak öğretmeni seçin.'); return; }
    const [clsId, crsId, slotStr] = val.split('::');
    const cls = classes.find((x) => x.id === clsId);
    const c = cls && (cls.courses || []).find((x) => x.id === crsId);
    if (!cls || !c) return;
    if (Number(slotStr) === 2) c.teacherId2 = tid; else c.teacherId = tid;
    const tObj = teachers.find((t) => t.id === tid);
    if (window._m4CollapsedTeacherIds) window._m4CollapsedTeacherIds.delete(tid);
    saveState(); closeM4TeacherAddCourseModal(); renderMenu4();
    showToast(`${cls.name} - ${c.name} dersi ${tObj ? tObj.name : 'öğretmene'} atandı.`);
  } else {
    const clsId = document.getElementById('m4AddNewClassSel')?.value || '';
    const cls = classes.find((x) => x.id === clsId);
    if (!cls) { showToast('Lütfen şube seçin.'); return; }
    const name = (document.getElementById('m4AddNewName')?.value || '').trim();
    if (!name) { showToast('Lütfen ders adını girin.'); return; }
    const code = (document.getElementById('m4AddNewCode')?.value || name.slice(0, 4)).trim().toUpperCase();
    const category = document.getElementById('m4AddNewCategory')?.value || 'secmeli';
    let hours = Math.max(1, Math.min(20, Number(document.getElementById('m4AddNewHours')?.value) || 2));
    const blkRaw = (document.getElementById('m4AddNewBlocks')?.value || '').trim();
    let blocks = defaultBlocksForHours(hours);
    let blockMode = 'auto';
    if (blkRaw) {
      const parsed = blkRaw.split(/[+,\s]+/).map((n) => parseInt(n, 10)).filter((n) => n > 0);
      if (parsed.length > 0) {
        blocks = parsed;
        hours = parsed.reduce((a, b) => a + b, 0);
        blockMode = 'manual';
      }
    }
    const dup = findDuplicateCourseInClass(cls, code, name);
    if (dup) {
      showToast(`${cls.name} şubesinde "${dup.name}" dersi zaten tanımlı! Bir sınıfa aynı ders birden fazla kez verilemez.`);
      return;
    }
    const tid = document.getElementById('m4AddNewTeacherSel')?.value || null;
    const tplSel = document.getElementById('m4AddNewTemplateSel');
    const opt = tplSel && tplSel.selectedOptions && tplSel.selectedOptions[0];
    const grp = (opt && opt.dataset && opt.dataset.grp) ? opt.dataset.grp : (category === 'secmeli' ? 'Seçmeli' : 'Ortak');
    if (!cls.courses) cls.courses = [];
    cls.courses.push({
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, code, category, group: grp, hours, blocks, blockMode,
      maxPerDay: 1, roomType: inferRoomType(name), splitGroups: false, useCommonSlot: false,
      teacherId: tid || undefined
    });
    if (tid && window._m4CollapsedTeacherIds) window._m4CollapsedTeacherIds.delete(tid);
    const tObj = tid ? teachers.find((t) => t.id === tid) : null;
    saveState(); closeM4TeacherAddCourseModal(); renderMenu4();
    showToast(`${cls.name} şubesine ${name} (${hours} sa) eklendi${tObj ? ` ve ${tObj.name} öğretmenine atandı` : ''}.`);
  }
}

/* ---------- Menü 4: Akıllı Seçmeli Ders Öner ve Ata ---------- */
let m4ElectiveProposals = [];

function buildElectiveSuggestions() {
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const loadMap = computeTeacherLoads();
  const simHours = {};
  teachers.forEach((t) => { simHours[t.id] = loadMap[t.id] ? loadMap[t.id].totalHours : 0; });

  const pickBestTeacher = (courseName, courseCode, hrs) => {
    if (!teachers.length) return null;
    const scored = teachers.map((t) => {
      const maxH = Number(t.maxHours) || 30;
      const cur = simHours[t.id] || 0;
      const free = maxH - cur;
      const isMain = isBranchMatchingCourse(t.branch, courseName);
      const isExtra = Boolean(window.DersDutyModule && window.DersDutyModule.doesTeacherExtraMatchCourse(t, courseName, courseCode));
      let score = 0;
      if (isMain) score += 100;
      else if (isExtra) score += 60;
      if (free >= hrs) score += 40 + Math.min(25, free);
      else score -= 50;
      return { t, score, free };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.free >= hrs) {
      simHours[best.t.id] = (simHours[best.t.id] || 0) + hrs;
      return best.t.id;
    }
    return best ? best.t.id : null;
  };

  const proposals = [];
  const threeGroups = ['İnsan, Toplum ve Bilim', 'Din, Ahlak ve Değer', 'Kültür, Sanat ve Spor'];

  classes.forEach((cls) => {
    const ev = evaluateClass(cls);
    let remaining = ev.targetTotal - ev.totalHours;
    if (remaining <= 0) return;

    const pool = getMebTemplatesForGrade(state.school.schoolTypeId, cls.gradeKey, 'elective')
      .filter((t) => !findDuplicateCourseInClass(cls, t.code, t.name));
    if (!pool.length) return;

    const existingGroups = new Set((cls.courses || []).filter((c) => c.category === 'secmeli').map((c) => c.group));
    const chosen = [];
    const chosenCodes = new Set();

    const tryPickFrom = (candidates, targetMax) => {
      for (const t of candidates) {
        if (chosenCodes.has(t.code)) continue;
        const opts = (Array.isArray(t.hourOptions) && t.hourOptions.length ? [...t.hourOptions] : [t.hours]).sort((a, b) => b - a);
        const fitH = opts.find((h) => h <= targetMax);
        if (!fitH) continue;
        chosen.push({ ...t, hours: fitH, blocks: defaultBlocksForHours(fitH), blockMode: 'auto' });
        chosenCodes.add(t.code);
        return fitH;
      }
      return 0;
    };

    // 1. Önce eksik 3 zorunlu seçmeli gruptan birer ders seç (MEB kuralı)
    const missingGroups = threeGroups.filter((g) => !existingGroups.has(g));
    missingGroups.forEach((g) => {
      if (remaining <= 0) return;
      const cands = pool.filter((t) => t.group === g || (t.group && t.group.includes(g)));
      // Kalan gruplara da en az 1'er saat yer bırak
      const reserve = Math.max(0, missingGroups.filter((mg) => mg !== g && !chosen.some((x) => x.group === mg)).length - 1);
      const maxForThis = Math.max(1, remaining - reserve);
      const used = tryPickFrom(cands, maxForThis);
      remaining -= used;
    });

    // 2. Kalan eksik saatleri diğer uygun seçmeli derslerle tamamla
    let guard = 0;
    while (remaining > 0 && guard < 15) {
      guard++;
      const used = tryPickFrom(pool, remaining);
      if (used <= 0) break;
      remaining -= used;
    }

    chosen.forEach((c) => {
      const suggestedTid = pickBestTeacher(c.name, c.code, c.hours);
      proposals.push({
        key: `${cls.id}::${c.code}`,
        checked: true,
        classId: cls.id,
        className: cls.name,
        gradeKey: cls.gradeKey,
        course: c,
        teacherId: suggestedTid
      });
    });
  });

  return proposals;
}

function openM4ElectiveSuggestModal() {
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  if (!classes.length) { showToast('Önce Menü 2’den şubelerinizi oluşturun.'); return; }

  m4ElectiveProposals = buildElectiveSuggestions();
  const sumBar = document.getElementById('m4SuggestSummaryBar');
  const bodyEl = document.getElementById('m4SuggestListBody');

  if (m4ElectiveProposals.length === 0) {
    sumBar.innerHTML = `<span class="font-bold text-emerald-700">Tüm şubelerin haftalık ders saatleri dolu veya uygun ek seçmeli ders bulunmadı.</span>`;
    bodyEl.innerHTML = `<div class="py-10 text-center text-xs text-slate-500">Haftalık hedef saati eksik şube bulunmuyor. Tüm şubeler hedef saatine ulaşmış görünüyor.</div>`;
  } else {
    const classSet = new Set(m4ElectiveProposals.map((p) => p.classId));
    const totalHrs = m4ElectiveProposals.reduce((s, p) => s + p.course.hours, 0);
    sumBar.innerHTML = `
      <div class="font-bold text-slate-800">${classSet.size} şube için toplam <span class="text-amber-700">${m4ElectiveProposals.length} seçmeli ders (${totalHrs} saat)</span> önerildi.</div>
      <div class="flex items-center gap-2">
        <button type="button" id="btnM4SugAll" class="text-indigo-700 font-bold hover:underline">Tümünü Seç</button>
        <span class="text-slate-300">|</span>
        <button type="button" id="btnM4SugNone" class="text-slate-600 font-semibold hover:underline">Temizle</button>
      </div>
    `;

    const loadMap = computeTeacherLoads();
    const byClass = new Map();
    m4ElectiveProposals.forEach((p, idx) => {
      if (!byClass.has(p.classId)) byClass.set(p.classId, []);
      byClass.get(p.classId).push({ ...p, idx });
    });

    bodyEl.innerHTML = Array.from(byClass.entries()).map(([clsId, items]) => {
      const cls = classes.find((x) => x.id === clsId);
      const ev = cls ? evaluateClass(cls) : { totalHours: 0, targetTotal: 0 };
      const addH = items.reduce((s, x) => s + x.course.hours, 0);
      return `
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div class="text-xs font-extrabold text-indigo-900">${escapeHtml(cls ? cls.name : clsId)}</div>
            <div class="text-[11px] font-semibold text-slate-600">Mevcut: ${ev.totalHours} sa + Öneri: <strong class="text-amber-700">+${addH} sa</strong> → <strong>${ev.totalHours + addH} / ${ev.targetTotal} sa</strong></div>
          </div>
          <div class="divide-y divide-slate-100">
            ${items.map((it) => `
              <div class="px-3.5 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-white hover:bg-slate-50/70">
                <label class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                  <input type="checkbox" class="m4-sug-chk rounded border-slate-300 text-amber-600" data-sug-idx="${it.idx}" ${it.checked ? 'checked' : ''} />
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-slate-800 truncate">${escapeHtml(it.course.name)} <span class="font-mono text-[10px] text-slate-400">(${escapeHtml(it.course.code)})</span></div>
                    <div class="text-[10px] text-slate-500">${escapeHtml(it.course.group || 'Seçmeli')} · <strong>${it.course.hours} sa</strong> · Blok: ${it.course.blocks.join('+')}</div>
                  </div>
                </label>
                <select data-sug-tidx="${it.idx}" class="m4-sug-tsel w-full sm:w-64 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700">
                  <option value="">— Öğretmen Atamadan Ekle —</option>
                  ${teachers.map((t) => {
                    const ld = loadMap[t.id] ? loadMap[t.id].totalHours : 0;
                    return `<option value="${t.id}" ${t.id === it.teacherId ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)} · ${ld}/${t.maxHours || 30}s)</option>`;
                  }).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    bodyEl.querySelectorAll('.m4-sug-chk').forEach((chk) => chk.addEventListener('change', () => {
      const i = Number(chk.dataset.sugIdx);
      if (m4ElectiveProposals[i]) m4ElectiveProposals[i].checked = chk.checked;
    }));
    bodyEl.querySelectorAll('.m4-sug-tsel').forEach((sel) => sel.addEventListener('change', () => {
      const i = Number(sel.dataset.sugTidx);
      if (m4ElectiveProposals[i]) m4ElectiveProposals[i].teacherId = sel.value || null;
    }));
    document.getElementById('btnM4SugAll')?.addEventListener('click', () => {
      m4ElectiveProposals.forEach((p) => { p.checked = true; });
      bodyEl.querySelectorAll('.m4-sug-chk').forEach((c) => { c.checked = true; });
    });
    document.getElementById('btnM4SugNone')?.addEventListener('click', () => {
      m4ElectiveProposals.forEach((p) => { p.checked = false; });
      bodyEl.querySelectorAll('.m4-sug-chk').forEach((c) => { c.checked = false; });
    });
  }

  const m = document.getElementById('m4ElectiveSuggestModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

function closeM4ElectiveSuggestModal() {
  const m = document.getElementById('m4ElectiveSuggestModal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

function confirmM4ElectiveSuggestions() {
  const classes = getCurrentClasses();
  let added = 0; let assigned = 0;
  m4ElectiveProposals.filter((p) => p.checked).forEach((p) => {
    const cls = classes.find((x) => x.id === p.classId);
    if (!cls) return;
    if (!cls.courses) cls.courses = [];
    if (findDuplicateCourseInClass(cls, p.course.code, p.course.name)) return;
    cls.courses.push({
      ...p.course,
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      teacherId: p.teacherId || undefined
    });
    added++;
    if (p.teacherId) assigned++;
  });
  saveState(); closeM4ElectiveSuggestModal(); renderAll();
  showToast(added > 0 ? `${added} seçmeli ders şubelere eklendi (${assigned} öğretmen atandı).` : 'Eklenecek yeni seçmeli ders seçilmedi.');
}

/* =========================================================================
   8D. MENÜ 5: TEK MOTOR GOOGLE OR-TOOLS CP-SAT (ELECTRON IPC KÖPRÜSÜ)
   ========================================================================= */
let solverRunning = false;
let activeSolveRequest = 0;
const REQUIRED_SOLVER = 'google_ortools_cp_sat';

let liveWatchSolution = null;
let liveElapsedTimer = null;
let liveStartMs = 0;

function setSolverUiRunning(running, phaseMessage) {
  solverRunning = running;
  for (const id of ['btnM5RunSolver', 'btnM5MaximizeSolve', 'btnM5RestartSolver', 'btnM5PlaceUnplaced']) {
    const b = document.getElementById(id);
    if (b) b.disabled = running;
  }
  const stop = document.getElementById('btnM5StopSolver');
  if (stop) stop.disabled = !running;
  const prog = document.getElementById('m5ProgressWrap');
  const lbl = document.getElementById('m5ProgressLabel');
  const pctEl = document.getElementById('m5ProgressPct');
  const barEl = document.getElementById('m5ProgressBarFill');
  const blkEl = document.getElementById('m5LiveBlocks');
  const solEl = document.getElementById('m5LiveSolutions');
  const elpEl = document.getElementById('m5LiveElapsed');

  if (running) {
    liveWatchSolution = null;
    liveStartMs = Date.now();
    if (prog) prog.classList.remove('hidden');
    if (lbl && phaseMessage) lbl.textContent = phaseMessage;
    if (pctEl) pctEl.textContent = '%0';
    if (barEl) { barEl.style.width = '6%'; barEl.classList.add('animate-pulse'); }
    if (blkEl) blkEl.textContent = '0/0 blok';
    if (solEl) solEl.textContent = 'Çözüm #0';
    if (elpEl) elpEl.textContent = '0.0 sn';
    if (liveElapsedTimer) clearInterval(liveElapsedTimer);
    liveElapsedTimer = setInterval(() => {
      if (!solverRunning) return;
      const el = document.getElementById('m5LiveElapsed');
      if (el) el.textContent = `${((Date.now() - liveStartMs) / 1000).toFixed(1)} sn`;
    }, 400);
  } else {
    liveWatchSolution = null;
    if (liveElapsedTimer) { clearInterval(liveElapsedTimer); liveElapsedTimer = null; }
    if (barEl) barEl.classList.remove('animate-pulse');
    if (prog) prog.classList.add('hidden');
  }
}

function stopOrToolsSolver(manualStop = true) {
  if (!solverRunning) return;
  activeSolveRequest++;
  setSolverUiRunning(false);
  const api = window.dersDagitimAPI;
  if (api && typeof api.cancelSolve === 'function') {
    Promise.resolve(api.cancelSolve()).catch(() => {});
  }
  if (manualStop) showToast('Dağıtım durduruldu.');
}

function validateBeforeSolve(cfg) {
  const problems = [];
  if (!cfg.classes.length) {
    problems.push({ message: 'Önce sınıf ve şube ekleyin.', nav: { view: 'menu2' }, linkLabel: 'Şube Ekle →' });
  }
  if (!cfg.assignments.length) {
    problems.push({ message: 'Dağıtılacak ders bulunmuyor.', nav: { view: 'menu2' }, linkLabel: 'Derslere Git →' });
  }
  if (!cfg.teachers.length) {
    problems.push({ message: 'Öğretmen ekleyin.', nav: { view: 'menu3' }, linkLabel: 'Öğretmen Ekle →' });
  }
  for (const a of cfg.assignments) {
    if (!Array.isArray(a.teacher_ids) || !a.teacher_ids.length) {
      problems.push({
        message: `${a.class_name}: ${a.course_name} için öğretmen atanmamış.`,
        nav: { view: 'menu4', classId: a.class_id, search: a.course_name },
        linkLabel: `${a.class_name} Dersine Git →`
      });
    }
    if (!a.blocks || !a.blocks.length || a.blocks.reduce((sum, v) => sum + v, 0) !== a.hours) {
      problems.push({
        message: `${a.class_name}: ${a.course_name} blok toplamı ile ders saati eşleşmiyor.`,
        nav: { view: 'menu2', classId: a.class_id },
        linkLabel: `${a.class_name} Bloklarını Düzelt →`
      });
    }
  }
  return problems;
}

function inferDiagnosticNav(diag) {
  const extraLinks = (diag && Array.isArray(diag.links))
    ? diag.links.filter((l) => l && l.nav && l.label)
    : [];
  if (diag && diag.nav) {
    return {
      nav: diag.nav,
      linkLabel: diag.linkLabel || 'Düzeltmek İçin Git →',
      category: diag.category || null,
      links: extraLinks
    };
  }
  const msg = String((diag && diag.message) || diag || '');
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();

  // Şube eşleşmesi (ör. "5/A: Görsel Sanatlar...")
  for (const cls of classes) {
    if (cls.name && msg.includes(cls.name)) {
      if (/öğretmen atanmamış|atanmamış/i.test(msg)) {
        return { nav: { view: 'menu4', classId: cls.id }, linkLabel: `${cls.name} Ders Atamasına Git →`, category: diag && diag.category, links: extraLinks };
      }
      if (/blok|ders saati/i.test(msg)) {
        return { nav: { view: 'menu2', classId: cls.id }, linkLabel: `${cls.name} Bloklarına Git →`, category: diag && diag.category, links: extraLinks };
      }
      return { nav: { view: 'menu4', classId: cls.id }, linkLabel: `${cls.name} İçin Git →`, category: diag && diag.category, links: extraLinks };
    }
  }
  // Öğretmen eşleşmesi
  for (const t of teachers) {
    if (t.name && msg.includes(t.name)) {
      return { nav: { view: 'menu3', teacherId: t.id }, linkLabel: `${t.name} Ayarlarına Git →`, category: diag && diag.category, links: extraLinks };
    }
  }
  if (/öğle|zil|kapalı gün|slot|zaman/i.test(msg)) {
    return { nav: { view: 'menu1' }, linkLabel: 'Zaman Çizelgesine Git →', category: diag && diag.category, links: extraLinks };
  }
  if (/derslik|mekan|laboratuvar|salon/i.test(msg)) {
    return { nav: { view: 'menu4', focus: 'rooms' }, linkLabel: 'Özel Dersliklere Git →', category: diag && diag.category, links: extraLinks };
  }
  if (/öğretmen/i.test(msg)) {
    return { nav: { view: 'menu3' }, linkLabel: 'Öğretmenlere Git →', category: diag && diag.category, links: extraLinks };
  }
  return { nav: { view: 'menu4' }, linkLabel: 'Ders Atamaya Git →', category: diag && diag.category, links: extraLinks };
}

function navigateFromWarningLink(nav) {
  if (!nav || !nav.view) return;
  state.activeView = nav.view;
  if (nav.view === 'menu2' && nav.classId) {
    state.selectedClassId = nav.classId;
    state.gradeFilter = 'ALL';
  }
  if (nav.view === 'menu3' && nav.teacherId) {
    state.selectedTeacherId = nav.teacherId;
    state.teacherSearch = '';
    state.teacherBranchFilter = 'ALL';
    const tSearch = document.getElementById('m3TeacherSearch');
    if (tSearch) tSearch.value = '';
  }
  if (nav.view === 'menu4') {
    if (nav.classId) state.m4ClassFilter = nav.classId;
    const nextSearch = nav.search !== undefined ? nav.search : '';
    state.m4Search = nextSearch;
    const sInp = document.getElementById('m4Search');
    if (sInp) sInp.value = nextSearch;
  }
  if (nav.view === 'menu6') {
    if (nav.tab) state.m6Tab = nav.tab;
    if (nav.entityId) state.m6EntityId = nav.entityId;
  }
  saveState();
  renderAll();
  if (nav.view === 'menu4' && nav.focus === 'rooms') {
    const roomEl = document.getElementById('m4RoomList');
    if (roomEl && typeof roomEl.scrollIntoView === 'function') {
      roomEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      roomEl.classList.add('ring-2', 'ring-rose-400', 'rounded-xl');
      setTimeout(() => roomEl.classList.remove('ring-2', 'ring-rose-400', 'rounded-xl'), 2200);
    }
  }
}

function formatFriendlyStatus(status) {
  if (status === 'OPTIMAL' || status === 'FEASIBLE') return 'Geçerli Program Oluşturuldu';
  if (status === 'INFEASIBLE') return 'Mevcut kısıtlarla uygun ders programı oluşturulamıyor';
  if (status === 'UNKNOWN') return 'Belirlenen sürede uygun çözüm bulunamadı';
  if (status === 'MODEL_INVALID') return 'Program doğrulama kontrolünden geçemedi';
  if (status === 'PARTIAL') return 'Kısmi Program';
  return String(status || '');
}

function openPreviewModal(result, metaLabel) {
  pendingPreviewResult = { result, keepPinned: true };
  const oldPlacements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
  const diff = window.DersEditorLogic.computeSolutionDiff(
    oldPlacements,
    result.placements || [],
    state.pinnedPlacementIds,
    state.lockedTeacherIds
  );
  const gridStats = getSlotStats();
  const fmtSlot = (d, p) => (d === null || d === undefined) ? 'Yeni' : `${DAY_SHORT[gridStats.activeDayIndices[d]] || ('G' + (d + 1))} ${p + 1}. ders`;

  document.getElementById('previewModalTitle').textContent = `Değişiklik Önizleme — ${metaLabel || 'Otomatik Dağıtım Önerisi'}`;
  document.getElementById('previewModalKpis').innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 p-2.5 text-center"><div class="text-[10px] text-slate-500">Değişen Ders Bloğu</div><div class="text-lg font-bold text-indigo-700">${diff.changedCount}</div></div>
    <div class="bg-white rounded-xl border border-slate-200 p-2.5 text-center"><div class="text-[10px] text-slate-500">Etkilenen Öğretmen</div><div class="text-lg font-bold text-slate-900">${diff.affectedTeacherCount}</div></div>
    <div class="bg-white rounded-xl border border-slate-200 p-2.5 text-center"><div class="text-[10px] text-slate-500">Etkilenen Şube</div><div class="text-lg font-bold text-slate-900">${diff.affectedClassCount}</div></div>
    <div class="bg-white rounded-xl border border-slate-200 p-2.5 text-center"><div class="text-[10px] text-slate-500">Korunan Kilitli Ders</div><div class="text-lg font-bold text-emerald-600">${diff.preservedLockedCount}</div></div>
  `;

  const diffEl = document.getElementById('previewModalDiff');
  if (!diff.changes.length) {
    diffEl.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">Mevcut program ile önerilen program arasında yerleşim farkı bulunmadı.</div>`;
  } else {
    diffEl.innerHTML = `
      <table class="w-full text-left text-xs border-collapse">
        <thead><tr class="bg-slate-50 border-y border-slate-200 text-[11px] text-slate-500"><th class="py-2 px-2.5">Şube</th><th class="py-2 px-2.5">Ders</th><th class="py-2 px-2.5">Önceki Yer</th><th class="py-2 px-2.5">Önerilen Yer</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          ${diff.changes.slice(0, 60).map((ch) => `
            <tr class="bg-amber-50/40">
              <td class="py-2 px-2.5 font-bold text-indigo-800">${escapeHtml(ch.class_name)}</td>
              <td class="py-2 px-2.5 font-semibold text-slate-900">${escapeHtml(ch.course_code)} · ${escapeHtml(ch.course_name)} <span class="text-[10px] text-slate-500">(${ch.length} sa)</span></td>
              <td class="py-2 px-2.5 text-slate-500 line-through">${fmtSlot(ch.oldDay, ch.oldPeriod)}</td>
              <td class="py-2 px-2.5 font-bold text-emerald-700">${fmtSlot(ch.newDay, ch.newPeriod)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${diff.changes.length > 60 ? `<div class="text-[11px] text-slate-400 text-center pt-2">Toplam ${diff.changes.length} değişiklikten ilk 60 tanesi gösteriliyor.</div>` : ''}
    `;
  }

  const m = document.getElementById('previewModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

function openSwapModal(plA, plB) {
  pendingSwapPair = { plA, plB };
  const check = window.DersEditorLogic.validateDirectSwap(state, plA, plB, getEditorHelpers());
  const gridStats = getSlotStats();
  const teachers = getCurrentTeachers();
  const tMap = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
  const fmt = (pl) => `${DAY_NAMES[gridStats.activeDayIndices[pl.day_index]] || ''} ${pl.start_period + 1}. ders (${pl.length} sa)`;
  const tNames = (pl) => (pl.teacher_ids || []).map((id) => tMap[id] || '').filter(Boolean).join(', ') || 'Öğretmensiz';

  const body = document.getElementById('swapModalBody');
  body.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-1">
        <div class="text-[10px] font-bold text-indigo-700 uppercase">1. Ders</div>
        <div class="text-xs font-bold text-slate-900">${escapeHtml(plA.class_name)} · ${escapeHtml(plA.course_name)}</div>
        <div class="text-[11px] text-slate-600">${escapeHtml(tNames(plA))}</div>
        <div class="text-[11px] font-semibold text-indigo-800">${fmt(plA)}</div>
      </div>
      <div class="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
        <div class="text-[10px] font-bold text-amber-800 uppercase">2. Ders</div>
        <div class="text-xs font-bold text-slate-900">${escapeHtml(plB.class_name)} · ${escapeHtml(plB.course_name)}</div>
        <div class="text-[11px] text-slate-600">${escapeHtml(tNames(plB))}</div>
        <div class="text-[11px] font-semibold text-amber-900">${fmt(plB)}</div>
      </div>
    </div>
    ${check.valid
      ? `<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900"><strong>Doğrudan takas uygun:</strong> Her iki ders için öğretmen, sınıf, blok ve mekan kuralları sağlanıyor.${check.warnings.length ? `<div class="mt-1 text-amber-800">Not: ${escapeHtml(check.warnings[0])}</div>` : ''}</div>`
      : `<div class="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 space-y-1">
          <div class="font-bold">Doğrudan takas yapılamıyor:</div>
          <div>${escapeHtml(check.error)}</div>
          <div class="text-[11px] text-slate-600 pt-1">İsterseniz “Otomatik Uygun Yer Ara” seçeneğiyle mevcut programı en az değişiklikle düzenleyebilirsiniz.</div>
        </div>`}
  `;

  document.getElementById('btnConfirmSwap').classList.toggle('hidden', !check.valid);
  document.getElementById('btnSwapAskOrTools').classList.toggle('hidden', check.valid);

  const m = document.getElementById('swapModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

async function runScheduleAudit(targetPanelId = null) {
  const panelId = targetPanelId || (state.activeView === 'menu6' ? 'm6AuditPanel' : 'm5AuditPanel');
  const panel = document.getElementById(panelId) || document.getElementById('m5AuditPanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.innerHTML = `<div class="text-xs text-slate-500">Program tüm menülerde tam adresli olarak kontrol ediliyor...</div>`;

  const fullAudit = window.DersDutyModule
    ? window.DersDutyModule.runFullAddressAudit(state, getEditorHelpers(), window.DersEditorLogic)
    : { isClean: true, errors: [], warnings: [] };

  const api = window.dersDagitimAPI;
  let pyErrors = [];
  if (api && typeof api.validateTimetable === 'function' && state.solution && Array.isArray(state.solution.placements) && state.solution.placements.length) {
    try {
      const val = await api.validateTimetable(buildOrToolsConfig(), state.solution);
      if (val && Array.isArray(val.result_errors)) {
        pyErrors = val.result_errors;
      }
    } catch (_e) {}
  }

  const allErrors = [...(fullAudit.errors || [])];
  const seenMsgs = new Set(allErrors.map((e) => e.message));
  pyErrors.forEach((pe) => {
    const msg = pe.message || String(pe);
    if (!seenMsgs.has(msg)) {
      allErrors.push({
        severity: 'error',
        category: 'Bağımsız Doğrulama Hatası',
        address: 'Menü 5 / Menü 6 → Çözüm Doğrulama',
        message: msg,
        nav: { view: 'menu6', tab: 'report' }
      });
      seenMsgs.add(msg);
    }
  });
  const warnings = fullAudit.warnings || [];

  if (allErrors.length === 0) {
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-emerald-700 font-bold text-sm"><i data-lucide="check-circle-2" class="w-5 h-5"></i> Program Kontrolü Başarılı — Hata Bulunmadı</div>
        <button type="button" class="btn-close-audit text-xs text-slate-400 hover:text-slate-700">Kapat</button>
      </div>
      ${warnings.length ? `<div class="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-900 space-y-1.5"><div class="font-bold">Uyarılar (${warnings.length})</div>${warnings.slice(0, 12).map((w) => `<div><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 mr-1.5">${escapeHtml(w.address)}</span> ${escapeHtml(w.message)}</div>`).join('')}</div>` : ''}
    `;
  } else {
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div class="flex items-center gap-2 text-rose-700 font-bold text-sm"><i data-lucide="alert-triangle" class="w-5 h-5"></i> ${allErrors.length} Hata Tespit Edildi (Tam Adres Listesi)</div>
        <div class="flex items-center gap-2">
          <button type="button" id="btnAuditFixOrTools" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition"><i data-lucide="wrench" class="w-3.5 h-3.5"></i> Otomatik Düzelt</button>
          <button type="button" class="btn-close-audit text-xs text-slate-400 hover:text-slate-700">Kapat</button>
        </div>
      </div>
      <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
        ${allErrors.slice(0, 40).map((err, idx) => `
          <div class="p-3 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-bold text-rose-800">${idx + 1}. ${escapeHtml(err.category)}</span>
                <span class="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-rose-300 text-rose-900 font-semibold">${escapeHtml(err.address || 'Genel')}</span>
              </div>
              <div class="text-slate-800">${escapeHtml(err.message)}</div>
            </div>
            ${err.nav ? `<button type="button" data-audit-go="${idx}" class="audit-go-btn px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 text-[11px] font-bold shrink-0">Adrese Git →</button>` : ''}
          </div>
        `).join('')}
      </div>
      ${warnings.length ? `<div class="rounded-xl bg-amber-50/70 border border-amber-200 p-2.5 text-[11px] text-amber-900 space-y-1"><div class="font-bold">Ek Uyarılar (${warnings.length})</div>${warnings.slice(0, 8).map((w) => `<div><strong>${escapeHtml(w.address)}:</strong> ${escapeHtml(w.message)}</div>`).join('')}</div>` : ''}
    `;
    const fixBtn = panel.querySelector('#btnAuditFixOrTools');
    if (fixBtn) fixBtn.addEventListener('click', () => startOrToolsSolver(true, false, { mode: 'repair_min_changes', preview: true }));
    panel.querySelectorAll('.audit-go-btn').forEach((btn) => btn.addEventListener('click', () => {
      const item = allErrors[Number(btn.dataset.auditGo)];
      if (!item || !item.nav) return;
      state.activeView = item.nav.view || 'menu6';
      if (item.nav.view === 'menu3' && item.nav.teacherId) state.selectedTeacherId = item.nav.teacherId;
      if (item.nav.view === 'menu4' && item.nav.classId) state.m4ClassFilter = item.nav.classId;
      if (item.nav.view === 'menu6') {
        if (item.nav.tab) state.m6Tab = item.nav.tab;
        if (item.nav.entityId) state.m6EntityId = item.nav.entityId;
      }
      saveState(); renderAll();
    }));
  }
  const closeBtn = panel.querySelector('.btn-close-audit');
  if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
  if (window.lucide) window.lucide.createIcons();
}

window.applyMultiSolverCandidate = function applyMultiSolverCandidate(cand) {
  if (!cand || !cand.valid || !Array.isArray(cand.placements) || !cand.placements.length) {
    showToast('Yalnızca bağımsız doğrulamadan geçmiş geçerli çizelgeler uygulanabilir.');
    return;
  }
  editorHistory.push(state);
  state.solution = {
    engine: cand.engine || 'multi_solver',
    engine_key: cand.engine_key,
    engine_version: cand.engine_version,
    status: cand.status || 'FEASIBLE',
    solve_time_sec: cand.solve_time_sec || 0,
    placed_blocks: cand.placed_blocks || cand.placements.length,
    total_blocks: cand.total_blocks || cand.placements.length,
    placements: cand.placements,
    unplaced: [],
    diagnostics: [],
    quality: { quality_score: cand.quality_score, hard_violations: cand.hard_violations, soft_violations: cand.soft_violations }
  };
  saveState();
  updateUndoRedoButtons();
  renderMenu5();
  showToast(`${cand.engine_key || cand.engine} çizelgesi uygulandı (Kalite: ${cand.quality_score}/100).`);
};

async function startOrToolsSolver(keepPinned = true, onlyUnplaced = false, scopeOpts = null) {
  if (solverRunning) return;
  const api = window.dersDagitimAPI;
  if (!api || typeof api.solveTimetable !== 'function') {
    showToast('HTML önizleme modundasınız. Otomatik dağıtım Windows uygulamasında çalışır.');
    return;
  }
  const cfg = buildOrToolsConfig();
  const problems = validateBeforeSolve(cfg);
  if (problems.length) {
    state.lastSolveError = { status: 'INFEASIBLE', message: problems[0].message, diagnostics: problems };
    saveState(); renderMenu5();
    showToast(problems[0].message);
    return;
  }

  const oldPlacements = Array.isArray(state.solution && state.solution.placements) ? state.solution.placements : [];
  let mode = onlyUnplaced ? 'fill_empty' : (keepPinned ? 'full_solve' : 'regenerate');
  let showPreview = Boolean(scopeOpts && scopeOpts.preview);
  let previewLabel = 'Otomatik Dağıtım Önerisi';

  if (scopeOpts && scopeOpts.mode === 'maximize_placement') {
    mode = 'maximize_placement';
    cfg.fixed_assignments = keepPinned
      ? oldPlacements.filter((pl) =>
          state.pinnedPlacementIds.includes(getPlacementKey(pl)) ||
          (pl.teacher_ids || []).some((tid) => state.lockedTeacherIds.includes(tid)))
      : [];
  } else if (scopeOpts && scopeOpts.mode === 'repair_min_changes') {
    mode = 'repair_min_changes';
    showPreview = true;
    previewLabel = 'En Az Değişiklikle Onarım';
    cfg.previous_placements = oldPlacements;
    cfg.fixed_assignments = oldPlacements.filter((pl) =>
      state.pinnedPlacementIds.includes(getPlacementKey(pl)) ||
      (pl.teacher_ids || []).some((tid) => state.lockedTeacherIds.includes(tid))
    );
    if (Array.isArray(scopeOpts.extraFixed)) {
      const seenFixed = new Set(cfg.fixed_assignments.map((p) => getPlacementKey(p)));
      scopeOpts.extraFixed.forEach((ef) => {
        const k = getPlacementKey(ef);
        if (!seenFixed.has(k)) { cfg.fixed_assignments.push(ef); seenFixed.add(k); }
      });
    }
  } else if (scopeOpts && scopeOpts.type === 'class' && scopeOpts.id) {
    mode = 'selected_class';
    showPreview = true;
    const cObj = getCurrentClasses().find((c) => c.id === scopeOpts.id);
    previewLabel = `${cObj ? cObj.name : 'Seçili Sınıf'} Yeniden Dağıtım`;
    cfg.fixed_assignments = oldPlacements.filter((pl) =>
      pl.class_id !== scopeOpts.id ||
      state.pinnedPlacementIds.includes(getPlacementKey(pl)) ||
      (pl.teacher_ids || []).some((tid) => state.lockedTeacherIds.includes(tid))
    );
  } else if (scopeOpts && scopeOpts.type === 'teacher' && scopeOpts.id) {
    mode = 'selected_teacher';
    showPreview = true;
    const tObj = getCurrentTeachers().find((t) => t.id === scopeOpts.id);
    previewLabel = `${tObj ? tObj.name : 'Seçili Öğretmen'} Yeniden Dağıtım`;
    cfg.fixed_assignments = oldPlacements.filter((pl) =>
      !(pl.teacher_ids || []).includes(scopeOpts.id) ||
      state.pinnedPlacementIds.includes(getPlacementKey(pl))
    );
  } else {
    cfg.fixed_assignments = keepPinned
      ? oldPlacements.filter((pl) => onlyUnplaced ||
          state.pinnedPlacementIds.includes(getPlacementKey(pl)) ||
          (pl.teacher_ids || []).some((tid) => state.lockedTeacherIds.includes(tid)))
      : [];
  }

  const multiOpts = (window.EvrakPlusMultiSolverUI && typeof window.EvrakPlusMultiSolverUI.getRequestOptions === 'function')
    ? window.EvrakPlusMultiSolverUI.getRequestOptions()
    : { multi_mode: 'auto', engines: ['ortools'], time_limit_sec: 60, performance_mode: 'balanced' };

  cfg.solution_request = {
    mode,
    target_id: scopeOpts ? (scopeOpts.id || null) : null,
    preference: state.distributionPreference || 'balanced',
    ...multiOpts
  };
  cfg.solver_config = {
    engine: REQUIRED_SOLVER,
    max_time_seconds: multiOpts.time_limit_sec || 60,
    preference: state.distributionPreference || 'balanced'
  };

  const currentRequest = ++activeSolveRequest;
  setSolverUiRunning(true, 'PASS 0: Model kontrol ediliyor...');

  try {
    const result = await api.solveTimetable(cfg);
    if (currentRequest !== activeSolveRequest) return;
    if (window.EvrakPlusMultiSolverUI && typeof window.EvrakPlusMultiSolverUI.recordSolveResult === 'function') {
      window.EvrakPlusMultiSolverUI.recordSolveResult(result);
    }
    const engineAccepted = (window.EvrakPlusMultiSolverUI && typeof window.EvrakPlusMultiSolverUI.isAcceptedEngine === 'function')
      ? window.EvrakPlusMultiSolverUI.isAcceptedEngine(result && result.engine)
      : (result && result.engine === REQUIRED_SOLVER);
    if (!result || !engineAccepted || !Array.isArray(result.placements)) {
      throw new Error('Beklenen dağıtım sonucu alınamadı.');
    }
    if (result.status === 'CANCELLED') {
      showToast('Dağıtım durduruldu. Önceki program korundu.');
      return;
    }
    if (!['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID', 'PARTIAL', 'TIME_LIMIT', 'ERROR'].includes(result.status)) {
      throw new Error('Dağıtım motoru geçersiz durum döndürdü.');
    }

    if (result.status === 'PARTIAL' && Array.isArray(result.placements) && result.placements.length > 0) {
      editorHistory.push(state);
      state.solution = result;
      state.lastSolveError = {
        status: 'PARTIAL',
        solve_time_sec: result.solve_time_sec || 0,
        message: result.message || `${result.placed_blocks}/${result.total_blocks} blok yerleştirildi; yerleşemeyen derslerin nedenleri ve çözüm bağlantıları aşağıda.`,
        diagnostics: result.diagnostics || (result.unplaced || []).map((u) => ({
          code: 'UNPLACED_BLOCK',
          category: 'Yerleşmeyen Ders',
          message: u.reason || `${u.class_name || ''} - ${u.course_name || ''} yerleşemedi.`,
          nav: u.nav,
          linkLabel: u.linkLabel,
          links: u.links || []
        }))
      };
      saveState();
      updateUndoRedoButtons();
      showToast(`Maksimumda dağıtım: ${result.placed_blocks}/${result.total_blocks} blok yerleşti (${(result.unplaced || []).length} blok inceleme bekliyor).`);
    } else if (result.status === 'OPTIMAL' || result.status === 'FEASIBLE') {
      const expectedTotal = cfg.assignments.reduce((sum, a) => sum + a.blocks.length, 0);
      if (result.total_blocks !== expectedTotal || result.placements.length !== expectedTotal || result.placed_blocks !== expectedTotal) {
        throw new Error('Gelen çözüm ile modelin blok sayısı uyuşmuyor.');
      }
      state.lastSolveError = null;
      if (showPreview && oldPlacements.length > 0) {
        openPreviewModal(result, previewLabel);
      } else {
        editorHistory.push(state);
        state.solution = result;
        if (!keepPinned) state.pinnedPlacementIds = [];
        saveState();
        updateUndoRedoButtons();
        showToast(`Dağıtım tamamlandı: ${result.placed_blocks}/${result.total_blocks} blok (${result.solve_time_sec} sn).`);
      }
    } else {
      state.lastSolveError = {
        status: result.status,
        solve_time_sec: result.solve_time_sec || 0,
        message: result.message || formatFriendlyStatus(result.status),
        diagnostics: result.diagnostics || []
      };
      saveState();
      showToast(state.lastSolveError.message);
    }
  } catch (err) {
    if (currentRequest === activeSolveRequest) {
      const msg = (err && err.message) ? err.message : 'Bilinmeyen hata';
      state.lastSolveError = { status: 'ERROR', message: msg, diagnostics: [{ message: msg }] };
      showToast('Dağıtım hatası: ' + msg);
    }
  } finally {
    if (currentRequest === activeSolveRequest) {
      setSolverUiRunning(false);
      renderMenu5(); renderMenu6();
    }
  }
}

function placeUnplacedBlocks() {
  if (!state.solution || !Array.isArray(state.solution.unplaced) || !state.solution.unplaced.length) {
    showToast('Boşta kalan ders bulunmuyor.');
    return;
  }
  startOrToolsSolver(true, true);
}

let activeCamPlacement = null;

function getPlacementLockType(pl) {
  const courseLocked = (state.pinnedPlacementIds || []).includes(getPlacementKey(pl));
  const teacherLocked = (pl.teacher_ids || []).some((tid) => (state.lockedTeacherIds || []).includes(tid));
  if (courseLocked && teacherLocked) return 'both';
  if (courseLocked) return 'course';
  if (teacherLocked) return 'teacher';
  return 'none';
}

function toggleTeacherLock(tid) {
  if (!tid) return;
  const idx = state.lockedTeacherIds.indexOf(tid);
  const tObj = getCurrentTeachers().find((t) => t.id === tid);
  if (idx >= 0) {
    state.lockedTeacherIds.splice(idx, 1);
    showToast(`${tObj ? tObj.name : 'Öğretmen'} kilidi kaldırıldı`);
  } else {
    state.lockedTeacherIds.push(tid);
    showToast(`${tObj ? tObj.name : 'Öğretmen'} kilitlendi`);
  }
  saveState(); renderMenu5();
}

function toggleTeacherAvailabilityAt(tid, origDay, periodIdx) {
  const t = getCurrentTeachers().find((x) => x.id === tid);
  if (!t) return;
  ensureTeacherAvailabilitySize(t);
  t.availability[origDay][periodIdx] = (t.availability[origDay][periodIdx] || 'AVAILABLE') === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
  saveState(); renderMenu5(); renderMenu3();
}

function openCellActionModal(pl) {
  activeCamPlacement = pl;
  const teachers = getCurrentTeachers();
  const loadMap = computeTeacherLoads();
  const gridStats = getSlotStats();
  const dayName = DAY_NAMES[gridStats.activeDayIndices[pl.day_index]] || '';
  const primaryTid = (pl.teacher_ids && pl.teacher_ids[0]) || '';
  const isPinned = (state.pinnedPlacementIds || []).includes(getPlacementKey(pl));
  const isTLocked = primaryTid && (state.lockedTeacherIds || []).includes(primaryTid);

  document.getElementById('camTitle').textContent = `${pl.class_name} · ${pl.course_code} (${pl.course_name})`;
  document.getElementById('camSub').textContent = `${dayName} ${pl.start_period + 1}. Ders (${pl.length} saatlik blok)`;

  const sel = document.getElementById('camTeacherSelect');
  const matched = teachers.filter((t) => isBranchMatchingCourse(t.branch, pl.course_name));
  const others = teachers.filter((t) => !isBranchMatchingCourse(t.branch, pl.course_name));
  const opt = (t) => `<option value="${t.id}" ${t.id === primaryTid ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)} · ${loadMap[t.id] ? loadMap[t.id].totalHours : 0}/${t.maxHours} sa)</option>`;
  sel.innerHTML = `<option value="">— Öğretmensiz —</option>` +
    (matched.length ? `<optgroup label="Ana Branş">${matched.map(opt).join('')}</optgroup>` : '') +
    (others.length ? `<optgroup label="Diğer Branşlar">${others.map(opt).join('')}</optgroup>` : '');

  const btnPin = document.getElementById('btnCamTogglePin');
  btnPin.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ' + (isPinned ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50');
  btnPin.innerHTML = `<i data-lucide="${isPinned ? 'unlock' : 'lock'}" class="w-3.5 h-3.5"></i> ${isPinned ? 'Ders Kilidini Kaldır' : 'Bu Dersi Kilitle'}`;

  const btnTLock = document.getElementById('btnCamToggleTeacherLock');
  btnTLock.disabled = !primaryTid;
  btnTLock.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition disabled:opacity-40 ' + (isTLocked ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50');
  btnTLock.innerHTML = `<i data-lucide="${isTLocked ? 'unlock' : 'lock'}" class="w-3.5 h-3.5"></i> ${isTLocked ? 'Öğretmen Kilidini Aç' : 'Öğretmeni Kilitle'}`;

  const m = document.getElementById('cellActionModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

function openManualPlaceModal(classId, cDayIdx, periodIdx) {
  const cls = getCurrentClasses().find((c) => c.id === classId);
  if (!cls) return;
  const gridStats = getSlotStats();
  const dayName = DAY_NAMES[gridStats.activeDayIndices[cDayIdx]] || '';
  document.getElementById('mpmTitle').textContent = `${cls.name} · ${dayName} ${periodIdx + 1}. Ders`;
  document.getElementById('mpmSub').textContent = 'Bu saate elle yerleştirmek istediğiniz dersi seçin (otomatik kilitlenir):';

  const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
  const usedBlockIndices = {};
  placements.forEach((p) => {
    if (p.class_id === classId) {
      if (!usedBlockIndices[p.assignment_id]) usedBlockIndices[p.assignment_id] = new Set();
      usedBlockIndices[p.assignment_id].add(Number(p.block_index));
    }
  });

  const teachers = getCurrentTeachers();
  const tMap = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
  const availableBlocks = [];
  (cls.courses || []).forEach((c) => {
    const aid = `${cls.id}__${c.id}`;
    const blks = getCourseBlocks(c);
    const used = usedBlockIndices[aid] || new Set();
    blks.forEach((len, bIdx) => {
      if (!used.has(bIdx)) availableBlocks.push({ c, blockIndex: bIdx, len });
    });
  });

  const listEl = document.getElementById('mpmList');
  if (availableBlocks.length === 0) {
    listEl.innerHTML = `<div class="py-6 text-center text-xs text-slate-400">Bu sınıfın boşta kalan dersi yok.</div>`;
  } else {
    listEl.innerHTML = availableBlocks.map((item, idx) => {
      const tName = item.c.teacherId && tMap[item.c.teacherId] ? tMap[item.c.teacherId] : 'Öğretmen atanmamış';
      return `<button type="button" data-mp-idx="${idx}" class="mpm-pick-btn w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition">
        <div>
          <div class="text-xs font-bold text-slate-900"><span class="font-mono text-indigo-700 mr-1.5">${escapeHtml(item.c.code)}</span>${escapeHtml(item.c.name)}</div>
          <div class="text-[11px] text-slate-500">${escapeHtml(tName)} · ${item.len} saatlik blok</div>
        </div>
        <span class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold shrink-0">Yerleştir</span>
      </button>`;
    }).join('');

    listEl.querySelectorAll('.mpm-pick-btn').forEach((btn) => btn.addEventListener('click', () => {
      const pick = availableBlocks[Number(btn.dataset.mpIdx)];
      const tIds = [];
      if (pick.c.teacherId) tIds.push(pick.c.teacherId);
      if (pick.c.splitGroups && pick.c.teacherId2) tIds.push(pick.c.teacherId2);

      const newPl = {
        assignment_id: `${cls.id}__${pick.c.id}`,
        block_index: pick.blockIndex,
        class_id: cls.id, class_name: cls.name,
        course_id: pick.c.id, course_code: pick.c.code, course_name: pick.c.name,
        teacher_ids: tIds, room_id: pick.c.assignedRoomId || null,
        day_index: cDayIdx, start_period: periodIdx, length: pick.len
      };

      const err = validateManualPlacement(newPl, null);
      if (err) { showToast(err); return; }

      if (!state.solution) {
        const totalB = getCurrentClasses().reduce((s, cl) => s + (cl.courses || []).reduce((x, co) => x + getCourseBlocks(co).length, 0), 0);
        state.solution = { engine: 'manual', status: 'PARTIAL', solve_time_sec: 0, placed_blocks: 0, total_blocks: totalB, unplaced: [], placements: [] };
      }
      state.solution.placements.push(newPl);
      state.solution.placed_blocks = state.solution.placements.length;
      if (Array.isArray(state.solution.unplaced)) {
        const uIdx = state.solution.unplaced.findIndex((u) => u.assignment_id === newPl.assignment_id && (u.block_index === undefined || u.block_index === newPl.block_index));
        if (uIdx >= 0) state.solution.unplaced.splice(uIdx, 1);
      }
      const key = getPlacementKey(newPl);
      if (!state.pinnedPlacementIds.includes(key)) state.pinnedPlacementIds.push(key);
      saveState();
      document.getElementById('manualPlaceModal').classList.add('hidden');
      document.getElementById('manualPlaceModal').classList.remove('flex');
      renderMenu5(); renderMenu6();
      showToast(`${pick.c.code} yerleştirildi ve kilitlendi`);
    }));
  }

  const m = document.getElementById('manualPlaceModal');
  m.classList.remove('hidden'); m.classList.add('flex');
}

function renderMenu5Templates() {
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const activeSol = (solverRunning && liveWatchSolution && Array.isArray(liveWatchSolution.placements))
    ? liveWatchSolution
    : state.solution;
  const placements = (activeSol && Array.isArray(activeSol.placements)) ? activeSol.placements : [];
  const gridStats = getSlotStats();
  const { primary } = computeBellSchedule();
  const periods = state.grid.periodsPerDay;
  const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const dayPalette = ['bg-indigo-50/70 text-indigo-900', 'bg-emerald-50/70 text-emerald-900', 'bg-amber-50/70 text-amber-900', 'bg-sky-50/70 text-sky-900', 'bg-violet-50/70 text-violet-900', 'bg-rose-50/70 text-rose-900'];

  document.querySelectorAll('.m5-tpl-btn').forEach((btn) => {
    const active = btn.dataset.m5Tpl === state.m5TplTab;
    btn.className = 'm5-tpl-btn px-3 py-1.5 rounded-lg text-xs font-semibold border transition ' + (active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50');
  });

  const ctrlEl = document.getElementById('m5TplControls');
  const lockBarEl = document.getElementById('m5LockSummaryBar');
  const hintEl = document.getElementById('m5TplHintBar');
  const stageEl = document.getElementById('m5TemplateStage');

  const pinnedCnt = (state.pinnedPlacementIds || []).length;
  const lockedTCnt = (state.lockedTeacherIds || []).length;
  const unplacedInfo = getUnplacedCourseSummaryMap();
  const totalUnplacedBlocks = unplacedInfo.allUnplaced.reduce((s, u) => s + u.missingBlocks, 0);
  const unplacedTooltip = unplacedInfo.allUnplaced.slice(0, 12).map((u) => `${u.className} ${u.courseName} (${u.missingBlocks} blok / ${u.missingHours} sa)`).join('\n');
  const bulkLockOn = Boolean(window._m5BulkLockMode);
  lockBarEl.innerHTML = `
    <div class="flex flex-wrap items-center gap-2.5">
      <span class="inline-flex items-center gap-1.5 font-bold ${pinnedCnt > 0 ? 'text-amber-800' : 'text-slate-500'}">
        <span class="w-3.5 h-3.5 rounded border-2 border-amber-600 bg-amber-200 inline-block"></span>
        Kilitli Ders: <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">${pinnedCnt}</span>
      </span>
      <span class="inline-flex items-center gap-1.5 font-bold ${lockedTCnt > 0 ? 'text-emerald-800' : 'text-slate-500'}">
        <span class="w-3.5 h-3.5 rounded border-2 border-emerald-600 bg-emerald-200 inline-block"></span>
        Kilitli Öğretmen: <span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">${lockedTCnt}</span>
      </span>
      ${totalUnplacedBlocks > 0 ? `<span title="${escapeHtml(unplacedTooltip)}" class="inline-flex items-center gap-1.5 font-bold text-rose-700 cursor-help px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
        Boşta / Yerleşmemiş Ders: <span class="px-1.5 py-0.5 rounded bg-rose-600 text-white">${totalUnplacedBlocks} blok</span>
      </span>` : ''}
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <button type="button" id="btnM5BulkLockMode" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${bulkLockOn ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300'}">
        🔒 ${bulkLockOn ? 'Toplu Kilit Modu: AÇIK (Bitir)' : 'Toplu Kilit Seçimi'}
      </button>
      ${placements.length > 0 ? `<button type="button" id="btnM5LockAllVisible" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold transition">Görünümü Kilitle</button>` : ''}
      ${(pinnedCnt > 0 || lockedTCnt > 0) ? `<button type="button" id="btnM5UnlockAll" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition">Tüm Kilitleri Kaldır</button>` : ''}
    </div>
  `;
  const btnBulkMode = document.getElementById('btnM5BulkLockMode');
  if (btnBulkMode) {
    btnBulkMode.addEventListener('click', () => {
      window._m5BulkLockMode = !window._m5BulkLockMode;
      renderMenu5Templates();
      showToast(window._m5BulkLockMode
        ? 'Toplu Kilit Seçim Modu açıldı: Ders hücrelerine tek tıkla seri kilitleme/açma yapabilirsiniz.'
        : 'Toplu Kilit Seçim Modu kapatıldı.');
    });
  }
  const btnLockVisible = document.getElementById('btnM5LockAllVisible');
  if (btnLockVisible) {
    btnLockVisible.addEventListener('click', () => {
      if (!Array.isArray(state.pinnedPlacementIds)) state.pinnedPlacementIds = [];
      const pinnedSet = new Set(state.pinnedPlacementIds);
      let targetPlacements = placements;
      if (state.m5TplTab === 'class' && state.m5EntityId) {
        targetPlacements = placements.filter((p) => p.class_id === state.m5EntityId);
      } else if (state.m5TplTab === 'teacher' && state.m5EntityId) {
        targetPlacements = placements.filter((p) => (p.teacher_ids || []).includes(state.m5EntityId));
      }
      let added = 0;
      targetPlacements.forEach((pl) => {
        const k = getPlacementKey(pl);
        if (!pinnedSet.has(k)) { pinnedSet.add(k); added++; }
      });
      state.pinnedPlacementIds = Array.from(pinnedSet);
      saveState(); renderMenu5Templates();
      showToast(added > 0 ? `${added} ders bloğu topluca kilitlendi.` : 'Görünümdeki tüm dersler zaten kilitli.');
    });
  }
  const btnUnlockAll = document.getElementById('btnM5UnlockAll');
  if (btnUnlockAll) {
    btnUnlockAll.addEventListener('click', () => {
      const m = document.getElementById('confirmUnlockAllModal');
      m.classList.remove('hidden'); m.classList.add('flex');
    });
  }

  if (state.m5TplTab === 'class') {
    if (!classes.length) {
      ctrlEl.innerHTML = ''; hintEl.innerHTML = '<span>Sınıf şablonu için Menü 2’den şube oluşturun.</span>';
      stageEl.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Henüz şube eklenmedi.</div>';
      return;
    }
    const activeCls = classes.find((c) => c.id === state.m5EntityId) || classes[0];
    state.m5EntityId = activeCls.id;
    ctrlEl.innerHTML = `
      <select id="m5EntitySel" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white">${classes.map((c) => `<option value="${c.id}" ${c.id === activeCls.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      <button type="button" id="btnM5RedistClass" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition">
        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Bu Sınıfı Yeniden Dağıt
      </button>
    `;
    document.getElementById('m5EntitySel').addEventListener('change', (e) => { state.m5EntityId = e.target.value; saveState(); renderMenu5Templates(); });
    document.getElementById('btnM5RedistClass').addEventListener('click', () => startOrToolsSolver(true, false, { type: 'class', id: activeCls.id }));
    hintEl.innerHTML = `<span><strong>Sınıf Şablonu (${escapeHtml(activeCls.name)}):</strong> Boş hücreye tıklayarak elle ders yerleştirebilir, dolu hücreye tıklayarak kilitleme/kaldırma/öğretmen değiştirme yapabilirsiniz.</span>`;

    const cMap = {};
    placements.filter((p) => p.class_id === activeCls.id).forEach((pl) => { for (let k = 0; k < pl.length; k++) cMap[`${pl.day_index}_${pl.start_period + k}`] = pl; });

    stageEl.innerHTML = `
      <table class="w-full border-collapse min-w-[560px]">
        <thead><tr><th class="p-2 text-left text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 w-28">Ders / Saat</th>${gridStats.activeDayIndices.map((d) => `<th class="p-2 text-center text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200">${DAY_NAMES[d]}</th>`).join('')}</tr></thead>
        <tbody>
          ${primary.map((b, pIdx) => `<tr>
            <td class="p-2 border border-slate-200 bg-slate-50/70 whitespace-nowrap"><div class="text-xs font-bold text-slate-800">${b.period}. Ders</div><div class="text-[10px] text-slate-500 font-mono">${b.start}–${b.end}</div></td>
            ${gridStats.activeDayIndices.map((origDay, cIdx) => {
              if (((state.grid.slots[origDay] && state.grid.slots[origDay][pIdx]) || 'ACTIVE') === 'BLOCKED') return `<td class="p-1.5 border border-slate-200 bg-slate-100 text-center text-[10px] text-slate-400">Kapalı</td>`;
              const pl = cMap[`${cIdx}_${pIdx}`];
              if (!pl) return `<td class="p-1 border border-slate-200 text-center"><button type="button" data-m5-empty-cls="${activeCls.id}" data-m5-d="${cIdx}" data-m5-p="${pIdx}" class="m5-empty-cls-btn w-full py-2.5 rounded-lg border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-[10px] text-slate-400 hover:text-indigo-700 transition">+ Yerleştir</button></td>`;
              const lt = getPlacementLockType(pl);
              const lockCls = lt === 'course' || lt === 'both' ? 'locked-course-cell' : (lt === 'teacher' ? 'locked-teacher-cell' : 'bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100/60');
              const lockBadge = lt === 'both' ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">KİLİTLİ</span>' : (lt === 'course' ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">KİLİTLİ</span>' : (lt === 'teacher' ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">ÖĞR</span>' : ''));
              const tNames = (pl.teacher_ids || []).map((id) => tMap[id] ? tMap[id].name : '').filter(Boolean).join(', ');
              return `<td class="p-1 border border-slate-200"><button type="button" data-m5-pl-key="${getPlacementKey(pl)}" class="m5-pl-btn w-full text-left p-1.5 rounded-lg border transition ${lockCls}">
                <div class="flex items-center justify-between gap-1"><span class="font-mono text-[11px] font-bold text-slate-900">${escapeHtml(pl.course_code)}</span>${lockBadge}</div>
                <div class="text-[10px] font-semibold text-slate-800 truncate">${escapeHtml(pl.course_name)}</div>
                <div class="text-[9px] text-slate-600 truncate">${escapeHtml(tNames || 'Öğretmensiz')}</div>
              </button></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  } else if (state.m5TplTab === 'teacher') {
    if (!teachers.length) {
      ctrlEl.innerHTML = ''; hintEl.innerHTML = '<span>Öğretmen şablonu için Menü 3’ten öğretmen oluşturun.</span>';
      stageEl.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Henüz öğretmen eklenmedi.</div>';
      return;
    }
    const activeT = teachers.find((t) => t.id === state.m5EntityId) || teachers[0];
    state.m5EntityId = activeT.id;
    ensureTeacherAvailabilitySize(activeT);
    const isLockedT = (state.lockedTeacherIds || []).includes(activeT.id);

    ctrlEl.innerHTML = `
      <select id="m5EntitySel" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white">${teachers.map((t) => `<option value="${t.id}" ${t.id === activeT.id ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)})</option>`).join('')}</select>
      <button type="button" id="btnM5LockActiveT" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${isLockedT ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'}">
        <i data-lucide="${isLockedT ? 'unlock' : 'lock'}" class="w-3.5 h-3.5"></i> ${isLockedT ? 'Öğretmen Kilitli (Kaldır)' : 'Öğretmeni Kilitle'}
      </button>
      <button type="button" id="btnM5RedistTeacher" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition">
        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Bu Öğretmeni Yeniden Dağıt
      </button>
    `;
    document.getElementById('m5EntitySel').addEventListener('change', (e) => { state.m5EntityId = e.target.value; saveState(); renderMenu5Templates(); });
    document.getElementById('btnM5LockActiveT').addEventListener('click', () => toggleTeacherLock(activeT.id));
    document.getElementById('btnM5RedistTeacher').addEventListener('click', () => startOrToolsSolver(true, false, { type: 'teacher', id: activeT.id }));
    hintEl.innerHTML = `<span><strong>Öğretmen Şablonu (${escapeHtml(activeT.name)}):</strong> Boş hücreye tıklayarak müsaitliği açıp kapatabilir, dolu hücreye tıklayarak ders işlemi yapabilirsiniz.</span>`;

    const cMap = {};
    placements.filter((p) => (p.teacher_ids || []).includes(activeT.id)).forEach((pl) => { for (let k = 0; k < pl.length; k++) cMap[`${pl.day_index}_${pl.start_period + k}`] = pl; });

    stageEl.innerHTML = `
      <table class="w-full border-collapse min-w-[560px]">
        <thead><tr><th class="p-2 text-left text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 w-28">Ders / Saat</th>${gridStats.activeDayIndices.map((d) => `<th class="p-2 text-center text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200">${DAY_NAMES[d]}</th>`).join('')}</tr></thead>
        <tbody>
          ${primary.map((b, pIdx) => `<tr>
            <td class="p-2 border border-slate-200 bg-slate-50/70 whitespace-nowrap"><div class="text-xs font-bold text-slate-800">${b.period}. Ders</div><div class="text-[10px] text-slate-500 font-mono">${b.start}–${b.end}</div></td>
            ${gridStats.activeDayIndices.map((origDay, cIdx) => {
              if (((state.grid.slots[origDay] && state.grid.slots[origDay][pIdx]) || 'ACTIVE') === 'BLOCKED') return `<td class="p-1.5 border border-slate-200 bg-slate-100 text-center text-[10px] text-slate-400">Okul Kapalı</td>`;
              const pl = cMap[`${cIdx}_${pIdx}`];
              if (!pl) {
                const isUnav = ((activeT.availability[origDay] && activeT.availability[origDay][pIdx]) || 'AVAILABLE') === 'UNAVAILABLE';
                return `<td class="p-1 border border-slate-200 text-center"><button type="button" data-m5-av-tid="${activeT.id}" data-m5-av-d="${origDay}" data-m5-av-p="${pIdx}" class="m5-av-toggle w-full py-2.5 rounded-lg border text-[11px] font-semibold transition ${isUnav ? 'bg-rose-50 border-rose-200 text-rose-700 line-through hover:bg-rose-100' : 'bg-emerald-50/50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}">${isUnav ? 'Kapalı (Aç)' : 'Müsait (Kapat)'}</button></td>`;
              }
              const lt = getPlacementLockType(pl);
              const lockCls = lt === 'course' || lt === 'both' ? 'locked-course-cell' : (lt === 'teacher' ? 'locked-teacher-cell' : 'bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100/60');
              return `<td class="p-1 border border-slate-200"><button type="button" data-m5-pl-key="${getPlacementKey(pl)}" class="m5-pl-btn w-full text-left p-1.5 rounded-lg border transition ${lockCls}">
                <div class="text-[11px] font-bold text-slate-900">${escapeHtml(pl.class_name)}</div>
                <div class="font-mono text-[10px] font-bold text-indigo-900">${escapeHtml(pl.course_code)}</div>
              </button></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  } else if (state.m5TplTab === 'class_sheet') {
    ctrlEl.innerHTML = `<span class="text-xs font-semibold text-indigo-700">${classes.length} şube</span>`;
    hintEl.innerHTML = `<span><strong>Sınıf Çarşaf Şablonu:</strong> Boş hücreye tıklayıp elle ders yerleştirebilir, dolu hücreye tıklayıp kilitleme/kaldırma/öğretmen değiştirme yapabilirsiniz.</span>`;
    if (!classes.length) { stageEl.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Henüz şube yok (Menü 2’den ekleyin).</div>'; return; }
    const cellMap = {};
    placements.forEach((pl) => { if (!cellMap[pl.class_id]) cellMap[pl.class_id] = {}; for (let k = 0; k < pl.length; k++) cellMap[pl.class_id][`${pl.day_index}_${pl.start_period + k}`] = pl; });

    stageEl.innerHTML = `
      <table class="carsaf-table w-full border-collapse">
        <thead>
          <tr>
            <th rowspan="2" class="sticky left-0 z-20 py-2 px-2.5 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 border-r-2 border-r-slate-400 min-w-[68px]">Şube</th>
            ${gridStats.activeDayIndices.map((od, ci) => `<th colspan="${periods}" class="py-1 px-1 text-center text-[11px] font-bold border border-slate-300 border-r-2 border-r-slate-400 ${dayPalette[ci % dayPalette.length]}">${DAY_NAMES[od]}</th>`).join('')}
          </tr>
          <tr>${gridStats.activeDayIndices.map(() => Array.from({ length: periods }, (_, p) => `<th class="py-0.5 text-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''} min-w-[38px]">${p + 1}</th>`).join('')).join('')}</tr>
        </thead>
        <tbody>
          ${classes.map((cls) => `<tr>
            <td class="sticky left-0 z-10 py-1.5 px-2 border border-slate-300 border-r-2 border-r-slate-400 bg-white font-bold text-xs text-indigo-800 whitespace-nowrap">${escapeHtml(cls.name)}</td>
            ${gridStats.activeDayIndices.map((od, ci) => Array.from({ length: periods }, (_, p) => {
              const bCls = `border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''}`;
              if (((state.grid.slots[od] && state.grid.slots[od][p]) || 'ACTIVE') === 'BLOCKED') return `<td class="${bCls} bg-slate-100 text-center text-[9px] text-slate-400">—</td>`;
              const pl = cellMap[cls.id] && cellMap[cls.id][`${ci}_${p}`];
              if (!pl) return `<td class="${bCls} p-0 text-center"><button type="button" data-m5-empty-cls="${cls.id}" data-m5-d="${ci}" data-m5-p="${p}" class="m5-empty-cls-btn w-full h-8 hover:bg-indigo-50 text-[10px] text-slate-300 hover:text-indigo-600">+</button></td>`;
              const lt = getPlacementLockType(pl);
              const lockCls = lt === 'course' || lt === 'both' ? 'locked-course-cell' : (lt === 'teacher' ? 'locked-teacher-cell' : 'bg-indigo-50/40');
              const ts = (pl.teacher_ids || []).map((id) => tMap[id] ? (tMap[id].shortCode || makeTeacherShortCode(tMap[id].name)) : '').filter(Boolean).join('/');
              return `<td class="${bCls} p-0.5 text-center ${lockCls}"><button type="button" data-m5-pl-key="${getPlacementKey(pl)}" class="m5-pl-btn w-full rounded py-0.5" title="${escapeHtml(pl.course_name)}"><div class="font-mono text-[10px] font-bold text-slate-900 leading-tight">${lt !== 'none' ? '🔒' : ''}${escapeHtml(pl.course_code)}</div><div class="text-[8px] text-indigo-800 font-semibold leading-tight">${escapeHtml(ts || '—')}</div></button></td>`;
            }).join('')).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  } else if (state.m5TplTab === 'teacher_sheet') {
    ctrlEl.innerHTML = `<span class="text-xs font-semibold text-emerald-700">${teachers.length} öğretmen</span>`;
    hintEl.innerHTML = `<span><strong>Öğretmen Çarşaf Şablonu:</strong> Boş hücreye tıklayarak müsaitlik kapat/aç, kilit düğmesiyle öğretmeni kilitle/kaldır.</span>`;
    if (!teachers.length) { stageEl.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Henüz öğretmen yok (Menü 3’ten ekleyin).</div>'; return; }
    const cellMap = {};
    placements.forEach((pl) => (pl.teacher_ids || []).forEach((tid) => { if (!cellMap[tid]) cellMap[tid] = {}; for (let k = 0; k < pl.length; k++) cellMap[tid][`${pl.day_index}_${pl.start_period + k}`] = pl; }));

    stageEl.innerHTML = `
      <table class="carsaf-table w-full border-collapse">
        <thead>
          <tr>
            <th rowspan="2" class="sticky left-0 z-20 py-2 px-2.5 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 border-r-2 border-r-slate-400 min-w-[165px]">Öğretmen / Kilit</th>
            ${gridStats.activeDayIndices.map((od, ci) => `<th colspan="${periods}" class="py-1 px-1 text-center text-[11px] font-bold border border-slate-300 border-r-2 border-r-slate-400 ${dayPalette[ci % dayPalette.length]}">${DAY_NAMES[od]}</th>`).join('')}
          </tr>
          <tr>${gridStats.activeDayIndices.map(() => Array.from({ length: periods }, (_, p) => `<th class="py-0.5 text-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''} min-w-[38px]">${p + 1}</th>`).join('')).join('')}</tr>
        </thead>
        <tbody>
          ${teachers.map((t) => {
            ensureTeacherAvailabilitySize(t);
            const tLocked = (state.lockedTeacherIds || []).includes(t.id);
            const tUnplaced = unplacedInfo.byTeacher[t.id] || [];
            const tUnplacedCnt = tUnplaced.reduce((s, u) => s + u.missingBlocks, 0);
            const tUnplacedTip = tUnplaced.length
              ? 'Boşta bekleyen dersler:\n' + tUnplaced.map((u) => `• ${u.className} ${u.courseName} (${u.missingBlocks} blok / ${u.missingHours} sa)`).join('\n')
              : `${t.name} (${t.branch}) — Tüm atanmış dersleri yerleşmiş`;
            return `<tr class="${tLocked ? 'ring-1 ring-inset ring-emerald-400' : ''}">
              <td title="${escapeHtml(tUnplacedTip)}" class="sticky left-0 z-10 py-1.5 px-2 border border-slate-300 border-r-2 border-r-slate-400 ${tLocked ? 'bg-emerald-100 border-l-4 border-l-emerald-600' : 'bg-white'} whitespace-nowrap max-w-[195px]">
                <div class="flex items-center justify-between gap-1.5">
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-slate-900 truncate flex items-center gap-1">${tLocked ? '🔒 ' : ''}${escapeHtml(t.name)}${tUnplacedCnt > 0 ? ` <span class="px-1 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-extrabold">${tUnplacedCnt} boşta</span>` : ''}</div>
                    <div class="text-[9px] ${tLocked ? 'text-emerald-800 font-bold' : 'text-slate-500'} truncate">${tLocked ? 'KİLİTLİ · ' : ''}${escapeHtml(t.branch)}</div>
                  </div>
                  <button type="button" data-m5-lock-tid="${t.id}" class="m5-lock-t-btn px-1.5 py-1 rounded text-[10px] font-bold shrink-0 transition ${tLocked ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}">${tLocked ? 'Kilitli' : 'Kilitle'}</button>
                </div>
              </td>
              ${gridStats.activeDayIndices.map((od, ci) => Array.from({ length: periods }, (_, p) => {
                const bCls = `border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''}`;
                if (((state.grid.slots[od] && state.grid.slots[od][p]) || 'ACTIVE') === 'BLOCKED') return `<td class="${bCls} bg-slate-100 text-center text-[9px] text-slate-400">—</td>`;
                const pl = cellMap[t.id] && cellMap[t.id][`${ci}_${p}`];
                if (pl) {
                  const lt = getPlacementLockType(pl);
                  const lockCls = lt === 'course' || lt === 'both' ? 'locked-course-cell' : (lt === 'teacher' ? 'locked-teacher-cell' : 'bg-emerald-50/40');
                  return `<td class="${bCls} p-0.5 text-center ${lockCls}"><button type="button" data-m5-pl-key="${getPlacementKey(pl)}" class="m5-pl-btn w-full rounded py-0.5"><div class="text-[10px] font-bold text-slate-900 leading-tight">${lt !== 'none' ? '🔒' : ''}${escapeHtml(pl.class_name)}</div><div class="font-mono text-[8px] text-emerald-900 font-semibold leading-tight">${escapeHtml(pl.course_code)}</div></button></td>`;
                }
                const isUnav = ((t.availability[od] && t.availability[od][p]) || 'AVAILABLE') === 'UNAVAILABLE';
                return `<td class="${bCls} p-0 text-center ${isUnav ? 'bg-rose-50' : 'bg-white'}"><button type="button" data-m5-av-tid="${t.id}" data-m5-av-d="${od}" data-m5-av-p="${p}" class="m5-av-toggle w-full h-8 text-[10px] font-bold ${isUnav ? 'text-rose-500 hover:bg-rose-100' : 'text-slate-300 hover:bg-emerald-50 hover:text-emerald-600'}">${isUnav ? '×' : '·'}</button></td>`;
              }).join('')).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  const togglePlacementLockByKey = (key) => {
    if (!Array.isArray(state.pinnedPlacementIds)) state.pinnedPlacementIds = [];
    const idx = state.pinnedPlacementIds.indexOf(key);
    let lockedNow = false;
    if (idx >= 0) {
      state.pinnedPlacementIds.splice(idx, 1);
      lockedNow = false;
    } else {
      state.pinnedPlacementIds.push(key);
      lockedNow = true;
    }
    saveState();
    renderMenu5Templates();
    showToast(lockedNow ? 'Ders bloğu kilitlendi 🔒' : 'Ders bloğu kilidi kaldırıldı 🔓');
  };

  stageEl.querySelectorAll('.m5-pl-btn').forEach((btn) => {
    let clickTimer = null;
    btn.addEventListener('click', () => {
      const key = btn.dataset.m5PlKey;
      if (window._m5BulkLockMode) {
        togglePlacementLockByKey(key);
        return;
      }
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const pl = placements.find((x) => getPlacementKey(x) === key);
        if (pl) openCellActionModal(pl);
      }, 220);
    });
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      togglePlacementLockByKey(btn.dataset.m5PlKey);
    });
  });
  stageEl.querySelectorAll('.m5-av-toggle').forEach((btn) => btn.addEventListener('click', () => {
    toggleTeacherAvailabilityAt(btn.dataset.m5AvTid, Number(btn.dataset.m5AvD), Number(btn.dataset.m5AvP));
  }));
  stageEl.querySelectorAll('.m5-lock-t-btn').forEach((btn) => btn.addEventListener('click', () => {
    toggleTeacherLock(btn.dataset.m5LockTid);
  }));
  stageEl.querySelectorAll('.m5-empty-cls-btn').forEach((btn) => btn.addEventListener('click', () => {
    openManualPlaceModal(btn.dataset.m5EmptyCls, Number(btn.dataset.m5D), Number(btn.dataset.m5P));
  }));

  if (window.lucide) window.lucide.createIcons();
}

function renderMenu5() {
  ensureState(state);
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  let totalBlocks = 0, unassignedCourses = 0;
  classes.forEach((cls) => (cls.courses || []).forEach((c) => {
    totalBlocks += getCourseBlocks(c).length;
    if (!c.teacherId) unassignedCourses++;
  }));
  const loadMap = computeTeacherLoads();
  let overloaded = 0;
  Object.values(loadMap).forEach((e) => { if (e.totalHours > e.teacher.maxHours) overloaded++; });

  document.getElementById('m5ReadinessGrid').innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Toplam Ders Bloğu</div>
      <div class="text-2xl font-bold text-indigo-700 mt-1">${totalBlocks}</div>
      <div class="text-xs text-slate-500 mt-0.5">${classes.length} şube · ${teachers.length} öğretmen</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Öğretmen Atama Durumu</div>
      <div class="text-2xl font-bold mt-1 ${unassignedCourses === 0 && totalBlocks > 0 ? 'text-emerald-600' : 'text-amber-600'}">${unassignedCourses === 0 ? 'Hazır' : unassignedCourses + ' eksik'}</div>
      <div class="text-xs text-slate-500 mt-0.5">${unassignedCourses === 0 ? 'Tüm dersler atanmış' : 'Menü 4’ten atanabilir'}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Yük Sınırı Kontrolü</div>
      <div class="text-2xl font-bold mt-1 ${overloaded === 0 ? 'text-emerald-600' : 'text-rose-600'}">${overloaded === 0 ? 'Uygun' : overloaded + ' aşırı'}</div>
      <div class="text-xs text-slate-500 mt-0.5">Maksimum ders yükü kontrolü</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Son Çözüm Durumu</div>
      <div class="text-lg font-bold mt-1 ${state.solution ? (state.solution.status === 'OPTIMAL' || state.solution.status === 'FEASIBLE' ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}">
        ${state.solution ? `${state.solution.placed_blocks}/${state.solution.total_blocks} blok` : 'Çalıştırılmadı'}
      </div>
      <div class="text-xs text-slate-500 mt-0.5">${state.solution ? `${state.solution.engine === 'google_ortools_cp_sat' ? 'Otomatik Dağıtım' : 'Elle düzenleme'} · ${state.solution.solve_time_sec || 0} sn` : 'Dağıtım bekleniyor'}</div>
    </div>
  `;

  const preference = document.getElementById('m5Preference');
  if (preference) preference.value = state.distributionPreference || 'balanced';

  const engineBanner = document.getElementById('m5EngineBanner');
  if (engineBanner) {
    const hasBridge = typeof (window.dersDagitimAPI && window.dersDagitimAPI.solveTimetable) === 'function';
    if (!hasBridge) {
      engineBanner.className = 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900';
      engineBanner.textContent = 'HTML önizleme modundasınız. Otomatik dağıtım Windows uygulamasında çalışır.';
    } else if (engineInfoState.checked && !engineInfoState.available) {
      engineBanner.className = 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800';
      engineBanner.textContent = `Dağıtım motoru başlatılamadı: ${engineInfoState.error || 'Bilinmeyen hata'}`;
    } else {
      engineBanner.className = 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900';
      engineBanner.innerHTML = `<span class="font-bold">Dağıtım motoru hazır</span>. Dağıtım internetsiz olarak yerel motorla çalışır.`;
    }
  }

  const statusCard = document.getElementById('m5SolveStatusCard');
  let errBanner = '';
  let resolvedDiags = [];
  if (state.lastSolveError) {
    const err = state.lastSolveError;
    const diags = Array.isArray(err.diagnostics) ? err.diagnostics : [];
    resolvedDiags = diags.slice(0, 20).map((d) => {
      const info = inferDiagnosticNav(d);
      return {
        message: (d && d.message) || String(d),
        category: info.category || (d && d.category) || null,
        nav: info.nav,
        linkLabel: info.linkLabel,
        links: info.links || []
      };
    });
    errBanner = `
      <div class="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 space-y-2">
        <div class="font-bold flex items-start gap-2">
          <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
          <span>${escapeHtml(formatFriendlyStatus(err.status))}: ${escapeHtml(err.message)}</span>
        </div>
        ${resolvedDiags.length ? `<div class="space-y-1.5 pt-1">${resolvedDiags.map((d, idx) => `
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/90 border border-rose-200/80 px-3 py-2">
            <div class="space-y-0.5 min-w-0 flex-1">
              ${d.category ? `<span class="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 mr-1.5">${escapeHtml(d.category)}</span>` : ''}
              <span class="text-slate-800">${escapeHtml(d.message)}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 shrink-0">
              <button type="button" data-diag-idx="${idx}" class="m5-diag-link px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition">${escapeHtml(d.linkLabel)}</button>
              ${(d.links || []).map((lnk, lIdx) => `<button type="button" data-diag-idx="${idx}" data-sub-idx="${lIdx}" class="m5-diag-sublink px-2.5 py-1 rounded-md bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-semibold transition">${escapeHtml(lnk.label)}</button>`).join('')}
            </div>
          </div>
        `).join('')}</div>` : ''}
        ${state.solution ? '<div class="text-[11px] text-rose-700 pt-1">Önceki geçerli ders programınız korundu.</div>' : ''}
      </div>
    `;
  }

  if (!state.solution) {
    statusCard.innerHTML = errBanner + `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><i data-lucide="calendar-check" class="w-5 h-5"></i></div>
        <div>
          <h3 class="text-sm font-bold text-slate-900">Henüz ders dağıtımı yapılmadı</h3>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">Şubeleri, dersleri ve öğretmenleri hazırladıktan sonra “Dağıtımı Başlat” düğmesine tıklayın.</p>
        </div>
      </div>
    `;
  } else {
    const sol = state.solution;
    const okAll = sol.placed_blocks === sol.total_blocks && sol.total_blocks > 0;
    const totalGaps = teachers.reduce((s, t) => s + computeTeacherGaps(t.id), 0);
    statusCard.innerHTML = errBanner + `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full ${okAll ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
          <h3 class="text-sm font-bold text-slate-900">Çözüm Özeti (${escapeHtml(sol.status)})</h3>
        </div>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">${sol.engine === 'google_ortools_cp_sat' ? 'Otomatik Dağıtım' : 'Elle düzenleme'} · ${sol.solve_time_sec || 0} sn · Toplam pencere: ${totalGaps}</span>
      </div>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-[11px] text-slate-500">Yerleşen Blok</div>
          <div class="text-lg font-bold text-emerald-600">${sol.placed_blocks}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-[11px] text-slate-500">Toplam Blok</div>
          <div class="text-lg font-bold text-slate-900">${sol.total_blocks}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-[11px] text-slate-500">Yerleşemeyen</div>
          <div class="text-lg font-bold ${(sol.unplaced && sol.unplaced.length) ? 'text-rose-600' : 'text-emerald-600'}">${sol.unplaced ? sol.unplaced.length : 0}</div>
        </div>
      </div>
      ${(sol.unplaced && sol.unplaced.length) ? `
        <div class="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-1.5">
          <div class="font-bold">Yerleşemeyen Bloklar:</div>
          ${sol.unplaced.slice(0, 12).map((u, idx) => `
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 border border-rose-200 px-2.5 py-1">
              <span>• ${escapeHtml(u.class_name)} — ${escapeHtml(u.course_name)} (${Number(u.length) || 0} sa)</span>
              <button type="button" data-unp-idx="${idx}" class="m5-unplaced-link px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold">Derse Git →</button>
            </div>
          `).join('')}
        </div>` : ''}
    `;
  }

  statusCard.querySelectorAll('.m5-diag-link').forEach((btn) => btn.addEventListener('click', () => {
    const item = resolvedDiags[Number(btn.dataset.diagIdx)];
    if (item && item.nav) navigateFromWarningLink(item.nav);
  }));
  statusCard.querySelectorAll('.m5-diag-sublink').forEach((btn) => btn.addEventListener('click', () => {
    const item = resolvedDiags[Number(btn.dataset.diagIdx)];
    const sub = item && item.links && item.links[Number(btn.dataset.subIdx)];
    if (sub && sub.nav) navigateFromWarningLink(sub.nav);
  }));
  statusCard.querySelectorAll('.m5-unplaced-link').forEach((btn) => btn.addEventListener('click', () => {
    const u = state.solution && state.solution.unplaced && state.solution.unplaced[Number(btn.dataset.unpIdx)];
    if (!u) return;
    navigateFromWarningLink({ view: 'menu4', classId: u.class_id || 'ALL', search: u.course_name || '' });
  }));

  renderMenu5Templates();
  if (window.lucide) window.lucide.createIcons();
}

/* =========================================================================
   8E. MENÜ 6: PROGRAM ÇIKTILARI, MANUEL TAŞIMA, XLSX / CSV / YAZDIRMA
   ========================================================================= */
let m6SelectedMoveKey = null;

function computeTeacherGaps(teacherId) {
  if (!state.solution || !Array.isArray(state.solution.placements)) return 0;
  const stats = getSlotStats();
  let gaps = 0;
  stats.activeDayIndices.forEach((_, cIdx) => {
    const occupied = [];
    state.solution.placements.forEach((pl) => {
      if (pl.day_index === cIdx && (pl.teacher_ids || []).includes(teacherId)) {
        for (let k = 0; k < pl.length; k++) occupied.push(pl.start_period + k);
      }
    });
    if (occupied.length >= 2) {
      const minP = Math.min(...occupied), maxP = Math.max(...occupied);
      const occSet = new Set(occupied);
      for (let p = minP + 1; p < maxP; p++) if (!occSet.has(p)) gaps++;
    }
  });
  return gaps;
}

function tryMovePlacement(pl, targetDayIdx, targetStartP) {
  const candidate = { ...pl, day_index: targetDayIdx, start_period: targetStartP };
  const check = window.DersEditorLogic.validateManualPlacementFull(state, candidate, getEditorHelpers(), [pl]);
  if (!check.valid) { showToast(check.error); return false; }

  editorHistory.push(state);
  pl.day_index = targetDayIdx;
  pl.start_period = targetStartP;
  pl.block_id = getPlacementKey(pl);
  m6SelectedMoveKey = null;
  m6SwapSourceKey = null;
  saveState(); updateUndoRedoButtons(); renderMenu6(); renderMenu5();
  if (check.warnings.length) showToast(`${pl.course_code} taşındı (Not: ${check.warnings[0]})`);
  else showToast(`${pl.course_code} taşındı`);
  return true;
}

function renderTimetableGrid(title, subtitle, filteredPlacements, interactiveMode = null) {
  const gridStats = getSlotStats();
  const { primary } = computeBellSchedule();
  const teachers = getCurrentTeachers();
  const rooms = getCurrentRooms();
  const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const rMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const isInteractive = Boolean(interactiveMode);

  const activeSourceKey = m6SelectedMoveKey || m6DraggingKey;
  const activeSourcePl = activeSourceKey && state.solution && Array.isArray(state.solution.placements)
    ? state.solution.placements.find((p) => getPlacementKey(p) === activeSourceKey)
    : null;

  const cellMap = {};
  filteredPlacements.forEach((pl) => { for (let k = 0; k < pl.length; k++) cellMap[`${pl.day_index}_${pl.start_period + k}`] = { pl, isStart: k === 0 }; });

  const rowsHtml = primary.map((b, pIdx) => {
    const tds = gridStats.activeDayIndices.map((origDay, cIdx) => {
      if (((state.grid.slots[origDay] && state.grid.slots[origDay][pIdx]) || 'ACTIVE') === 'BLOCKED') {
        return `<td class="p-1.5 border border-slate-200 bg-slate-100 text-center text-[10px] text-slate-400">—</td>`;
      }
      const entry = cellMap[`${cIdx}_${pIdx}`];
      if (!entry) {
        let cellHighlight = 'bg-white';
        let canDropHere = false;
        let reasonTitle = '';
        if (isInteractive && activeSourcePl) {
          const check = window.DersEditorLogic.validateManualPlacementFull(
            state,
            { ...activeSourcePl, day_index: cIdx, start_period: pIdx },
            getEditorHelpers(),
            [activeSourcePl]
          );
          canDropHere = check.valid;
          reasonTitle = check.valid ? 'Buraya taşınabilir' : (check.error || 'Uygun değil');
          cellHighlight = check.valid ? 'bg-emerald-50/80' : 'bg-rose-50/40';
        }
        return `<td class="m6-slot-td p-1 border border-slate-200 text-center ${cellHighlight}" data-slot-d="${cIdx}" data-slot-p="${pIdx}" title="${escapeHtml(reasonTitle)}">
          ${(isInteractive && m6SelectedMoveKey)
            ? (canDropHere
                ? `<button type="button" data-move-d="${cIdx}" data-move-p="${pIdx}" class="m6-drop-cell w-full py-2 rounded-lg border border-dashed border-emerald-500 bg-emerald-50 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition">Buraya Taşı</button>`
                : `<span class="block py-2 text-[10px] text-rose-400">Uygun Değil</span>`)
            : `<span class="text-[10px] ${canDropHere ? 'text-emerald-700 font-semibold' : 'text-slate-300'}">${canDropHere ? 'Uygun' : 'Boş'}</span>`}
        </td>`;
      }
      const { pl, isStart } = entry;
      const key = getPlacementKey(pl);
      const lockInfo = window.DersEditorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds);
      const isSelectedMove = m6SelectedMoveKey === key || m6SwapSourceKey === key;
      const tNames = (pl.teacher_ids || []).map((id) => tMap[id] ? tMap[id].name : '').filter(Boolean).join(', ');
      const rName = pl.room_id && rMap[pl.room_id] ? rMap[pl.room_id].name : '';
      const cardCls = isSelectedMove
        ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-400'
        : (lockInfo.type === 'course' || lockInfo.type === 'both'
            ? 'locked-course-cell'
            : (lockInfo.type === 'teacher' ? 'locked-teacher-cell' : 'border-indigo-200 bg-white hover:border-indigo-400'));

      return `<td class="m6-slot-td p-1 border border-slate-200 align-top ${isSelectedMove ? 'bg-amber-100/70' : 'bg-indigo-50/30'}" data-slot-d="${cIdx}" data-slot-p="${pIdx}" data-occupied-key="${key}">
        <div ${isInteractive && !lockInfo.locked ? 'draggable="true"' : ''} data-drag-key="${key}" data-card-key="${key}" class="m6-lesson-card rounded-lg p-1.5 border transition ${isInteractive ? 'cursor-pointer' : ''} ${cardCls} space-y-0.5">
          <div class="flex items-center justify-between gap-1">
            <span class="font-mono text-[11px] font-bold text-indigo-900">${lockInfo.locked ? '🔒 ' : ''}${escapeHtml(pl.course_code)}</span>
            ${isInteractive && isStart ? `<div class="inline-flex items-center gap-0.5 no-print">
              <button type="button" data-pin-key="${key}" class="m6-pin-btn p-0.5 rounded ${lockInfo.type === 'course' || lockInfo.type === 'both' ? 'text-amber-800 bg-amber-200' : 'text-slate-400 hover:text-slate-700'}" title="${lockInfo.type === 'course' || lockInfo.type === 'both' ? 'Ders kilidini kaldır' : 'Dersi kilitle'}"><i data-lucide="pin" class="w-3 h-3"></i></button>
              <button type="button" data-pick-key="${key}" class="m6-pick-btn p-0.5 rounded ${isSelectedMove ? 'text-amber-800 bg-amber-200' : 'text-slate-400 hover:text-indigo-700'}" title="Başka saate taşı"><i data-lucide="move" class="w-3 h-3"></i></button>
            </div>` : ''}
          </div>
          <div class="text-[11px] font-semibold text-slate-900 leading-tight truncate">${escapeHtml(pl.course_name)} <span class="text-[9px] text-slate-500">(${pl.length}s)</span></div>
          <div class="text-[10px] text-slate-600 truncate">${escapeHtml(state.m6Tab === 'teacher' ? pl.class_name : (tNames || 'Öğretmen yok'))}${rName ? ' · ' + escapeHtml(rName) : ''}</div>
        </div>
      </td>`;
    }).join('');
    return `<tr><td class="p-2 border border-slate-200 bg-slate-50/80 whitespace-nowrap"><div class="text-xs font-bold text-slate-800">${b.period}. Ders</div><div class="text-[10px] text-slate-500 font-mono">${b.start}–${b.end}</div></td>${tds}</tr>`;
  }).join('');

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 print-card">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div><h3 class="text-base font-bold text-slate-900">${escapeHtml(title)}</h3><p class="text-xs text-slate-500">${escapeHtml(subtitle)}${isInteractive ? ' · Dersleri sürükleyip bırakabilir veya tıklayarak işlem menüsünü açabilirsiniz.' : ''}</p></div>
        <span class="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">${filteredPlacements.reduce((s, p) => s + p.length, 0)} saat</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[600px]">
          <thead><tr><th class="p-2 text-left text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 w-28">Saat</th>${gridStats.activeDayIndices.map((d) => `<th class="p-2 text-center text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200">${DAY_NAMES[d]}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderClassCarsaf(placements) {
  const gridStats = getSlotStats();
  const periods = state.grid.periodsPerDay;
  const classes = getCurrentClasses();
  const tMap = Object.fromEntries(getCurrentTeachers().map((t) => [t.id, t]));
  const dayPalette = ['bg-indigo-50/70 text-indigo-900', 'bg-emerald-50/70 text-emerald-900', 'bg-amber-50/70 text-amber-900', 'bg-sky-50/70 text-sky-900', 'bg-violet-50/70 text-violet-900', 'bg-rose-50/70 text-rose-900'];

  const cellMap = {};
  placements.forEach((pl) => { if (!cellMap[pl.class_id]) cellMap[pl.class_id] = {}; for (let k = 0; k < pl.length; k++) cellMap[pl.class_id][`${pl.day_index}_${pl.start_period + k}`] = pl; });

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 print-card">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div><h3 class="text-base font-bold text-slate-900">Sınıf Çarşaf Programı</h3><p class="text-xs text-slate-500">${escapeHtml(state.school.name || MEB_SCHOOL_TYPES[state.school.schoolTypeId].name)} · ${escapeHtml(state.school.academicYear)}</p></div>
        <span class="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">${classes.length} şube</span>
      </div>
      <div class="overflow-x-auto">
        <table class="carsaf-table w-full border-collapse">
          <thead>
            <tr>
              <th rowspan="2" class="sticky left-0 z-20 py-2 px-2.5 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 border-r-2 border-r-slate-400 min-w-[72px]">Şube</th>
              ${gridStats.activeDayIndices.map((od, ci) => `<th colspan="${periods}" class="py-1.5 px-1 text-center text-[11px] font-bold border border-slate-300 border-r-2 border-r-slate-400 ${dayPalette[ci % dayPalette.length]}">${DAY_NAMES[od]}</th>`).join('')}
              <th rowspan="2" class="py-2 px-2 text-center text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 min-w-[44px]">Top.</th>
            </tr>
            <tr>${gridStats.activeDayIndices.map(() => Array.from({ length: periods }, (_, p) => `<th class="py-1 px-0.5 text-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''} min-w-[38px]">${p + 1}</th>`).join('')).join('')}</tr>
          </thead>
          <tbody>
            ${classes.map((cls, rIdx) => {
              let totalH = 0;
              const cells = gridStats.activeDayIndices.map((od, ci) => Array.from({ length: periods }, (_, p) => {
                const borderCls = `border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''}`;
                if (((state.grid.slots[od] && state.grid.slots[od][p]) || 'ACTIVE') === 'BLOCKED') return `<td class="${borderCls} bg-slate-100 text-center text-[9px] text-slate-400">—</td>`;
                const pl = cellMap[cls.id] && cellMap[cls.id][`${ci}_${p}`];
                if (!pl) return `<td class="${borderCls} bg-white text-center text-[9px] text-slate-300">·</td>`;
                totalH++;
                const tShort = (pl.teacher_ids || []).map((id) => tMap[id] ? (tMap[id].shortCode || makeTeacherShortCode(tMap[id].name)) : '').filter(Boolean).join('/');
                return `<td class="${borderCls} p-0.5 text-center align-middle bg-indigo-50/30"><div class="font-mono text-[10px] font-bold text-slate-900 leading-tight">${escapeHtml(pl.course_code)}</div><div class="text-[9px] text-indigo-700 leading-tight truncate">${escapeHtml(tShort || '—')}</div></td>`;
              }).join('')).join('');
              return `<tr class="${rIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}"><td class="sticky left-0 z-10 py-1.5 px-2.5 border border-slate-300 border-r-2 border-r-slate-400 bg-white font-bold text-xs text-indigo-800 whitespace-nowrap">${escapeHtml(cls.name)}</td>${cells}<td class="py-1.5 px-2 border border-slate-300 bg-slate-50 text-center font-bold text-[11px] text-slate-800 whitespace-nowrap">${totalH}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTeacherCarsaf(placements) {
  const gridStats = getSlotStats();
  const periods = state.grid.periodsPerDay;
  const teachers = getCurrentTeachers();
  const dayPalette = ['bg-indigo-50/70 text-indigo-900', 'bg-emerald-50/70 text-emerald-900', 'bg-amber-50/70 text-amber-900', 'bg-sky-50/70 text-sky-900', 'bg-violet-50/70 text-violet-900', 'bg-rose-50/70 text-rose-900'];

  const cellMap = {};
  placements.forEach((pl) => (pl.teacher_ids || []).forEach((tid) => { if (!cellMap[tid]) cellMap[tid] = {}; for (let k = 0; k < pl.length; k++) cellMap[tid][`${pl.day_index}_${pl.start_period + k}`] = pl; }));

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 print-card">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div><h3 class="text-base font-bold text-slate-900">Öğretmen Çarşaf Programı</h3><p class="text-xs text-slate-500">${escapeHtml(state.school.name || MEB_SCHOOL_TYPES[state.school.schoolTypeId].name)} · ${escapeHtml(state.school.academicYear)}</p></div>
        <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">${teachers.length} öğretmen</span>
      </div>
      <div class="overflow-x-auto">
        <table class="carsaf-table w-full border-collapse">
          <thead>
            <tr>
              <th rowspan="2" class="sticky left-0 z-20 py-2 px-2.5 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 border-r-2 border-r-slate-400 min-w-[150px]">Öğretmen / Branş</th>
              ${gridStats.activeDayIndices.map((od, ci) => `<th colspan="${periods}" class="py-1.5 px-1 text-center text-[11px] font-bold border border-slate-300 border-r-2 border-r-slate-400 ${dayPalette[ci % dayPalette.length]}">${DAY_NAMES[od]}</th>`).join('')}
              <th rowspan="2" class="py-2 px-1.5 text-center text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 min-w-[36px]">Saat</th>
              <th rowspan="2" class="py-2 px-1.5 text-center text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 min-w-[36px]">Boş</th>
            </tr>
            <tr>${gridStats.activeDayIndices.map(() => Array.from({ length: periods }, (_, p) => `<th class="py-1 px-0.5 text-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''} min-w-[38px]">${p + 1}</th>`).join('')).join('')}</tr>
          </thead>
          <tbody>
            ${teachers.map((t, rIdx) => {
              ensureTeacherAvailabilitySize(t);
              let totalH = 0;
              const gaps = computeTeacherGaps(t.id);
              const cells = gridStats.activeDayIndices.map((od, ci) => Array.from({ length: periods }, (_, p) => {
                const borderCls = `border border-slate-200 ${p === periods - 1 ? 'border-r-2 border-r-slate-400' : ''}`;
                if (((state.grid.slots[od] && state.grid.slots[od][p]) || 'ACTIVE') === 'BLOCKED') return `<td class="${borderCls} bg-slate-100 text-center text-[9px] text-slate-400">—</td>`;
                const pl = cellMap[t.id] && cellMap[t.id][`${ci}_${p}`];
                if (pl) { totalH++; return `<td class="${borderCls} p-0.5 text-center align-middle bg-emerald-50/40"><div class="text-[10px] font-bold text-slate-900 leading-tight">${escapeHtml(pl.class_name)}</div><div class="font-mono text-[9px] text-emerald-800 leading-tight">${escapeHtml(pl.course_code)}</div></td>`; }
                const isUnav = ((t.availability[od] && t.availability[od][p]) || 'AVAILABLE') === 'UNAVAILABLE';
                return `<td class="${borderCls} ${isUnav ? 'bg-rose-50/70 text-rose-400 font-bold' : 'bg-white text-slate-300'} text-center text-[10px]">${isUnav ? '×' : '·'}</td>`;
              }).join('')).join('');
              return `<tr class="${rIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}"><td class="sticky left-0 z-10 py-1.5 px-2.5 border border-slate-300 border-r-2 border-r-slate-400 bg-white whitespace-nowrap max-w-[170px]"><div class="text-[11px] font-bold text-slate-900 truncate">${escapeHtml(t.name)}</div><div class="text-[9px] text-slate-500 truncate">${escapeHtml(t.branch)}</div></td>${cells}<td class="py-1.5 px-1.5 border border-slate-300 bg-slate-50 text-center font-bold text-[11px] text-indigo-800">${totalH}</td><td class="py-1.5 px-1.5 border border-slate-300 bg-slate-50 text-center font-bold text-[11px] ${gaps === 0 ? 'text-emerald-600' : 'text-amber-600'}">${gaps}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSchoolDutyTab(contentEl) {
  const DM = window.DersDutyModule;
  const cfg = DM.ensureDutyConfig(state);
  const teachers = getCurrentTeachers();
  const gridStats = getSlotStats();
  const activeDays = gridStats.activeDayIndices;
  const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const eligible = teachers.filter((t) => !DM.isDutyExempt(t));
  const admins = teachers.filter((t) => DM.isAdministratorTeacher(t));
  const monthly = DM.buildMonthlyDutySchedule(state, teachers, activeDays, cfg.year, cfg.month, Boolean(cfg.rotateWeekly));

  const weeklyRowsHtml = cfg.locations.map((loc) => `
    <tr>
      <td class="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-800 text-xs">${escapeHtml(loc)}</td>
      ${activeDays.map((d) => {
        const ids = (cfg.weeklyAssignments[d] && cfg.weeklyAssignments[d][loc]) || [];
        const names = ids.map((id) => tMap[id]).filter((t) => t && !DM.isDutyExempt(t));
        return `<td class="p-2 border border-slate-200 text-xs align-top">
          ${names.length
            ? names.map((t) => `<div class="inline-flex items-center gap-1 px-2 py-0.5 m-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold text-[11px]">${escapeHtml(t.name)}</div>`).join('')
            : '<span class="text-slate-300 text-[11px]">—</span>'}
        </td>`;
      }).join('')}
    </tr>
  `).join('');

  contentEl.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 class="text-base font-bold text-slate-900">Okul Nöbeti Yönetimi (Haftalık & Aylık Çizelge)</h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Nöbet tutacak öğretmen: <strong>${eligible.length}</strong> · Muaf idareci (Okul Müdürü / Müdür Yrd.): <strong>${admins.length}</strong>
            <span class="text-amber-700 font-semibold">(Okul müdürleri ve müdür yardımcıları okul nöbeti tutmaz.)</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="btnDutyAutoBusiest" type="button" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition">
            En Yoğun Ders Gününe Nöbet Dağıt
          </button>
          <button id="btnDutyAutoLightest" type="button" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition">
            En Az Ders Gününe Nöbet Dağıt
          </button>
        </div>
      </div>

      <!-- Nöbet Yerleri Yönetimi -->
      <div class="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-bold text-slate-800">Nöbet Yerleri (${cfg.locations.length})</span>
          <div class="flex items-center gap-1.5">
            <input id="inpNewDutyLoc" type="text" placeholder="Yeni nöbet yeri (Örn: 3. Kat, Spor Alanı)" class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white w-56 focus:outline-none" />
            <button id="btnAddDutyLoc" type="button" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">Ekle</button>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${cfg.locations.map((loc, idx) => `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700">
              ${escapeHtml(loc)}
              ${cfg.locations.length > 1 ? `<button type="button" data-del-loc="${idx}" class="btn-del-duty-loc text-rose-500 hover:text-rose-700 font-bold" title="Sil">×</button>` : ''}
            </span>
          `).join('')}
        </div>
      </div>

      <!-- Haftalık Nöbet Tablosu -->
      <div>
        <div class="text-xs font-bold text-slate-800 mb-2">Haftalık Nöbet Çizelgesi</div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th class="p-2 border border-slate-200 bg-indigo-50 text-left text-xs font-bold text-slate-800 w-36">Nöbet Yeri</th>
                ${activeDays.map((d) => `<th class="p-2 border border-slate-200 bg-indigo-50 text-center text-xs font-bold text-slate-800">${DAY_NAMES[d]}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${weeklyRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <!-- Aylık Nöbet Takvimi & Çizelgesi -->
      <div class="pt-3 border-t border-slate-200 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-bold text-slate-900">Aylık Nöbet Takvimi ve Çizelgesi</span>
            <select id="selDutyMonth" class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white">
              ${DM.MONTH_NAMES.map((mn, i) => `<option value="${i + 1}" ${cfg.month === i + 1 ? 'selected' : ''}>${mn}</option>`).join('')}
            </select>
            <input id="inpDutyYear" type="number" min="2024" max="2035" value="${cfg.year}" class="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-center" />
            <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-1">
              <input id="chkDutyRotate" type="checkbox" ${cfg.rotateWeekly ? 'checked' : ''} class="rounded text-indigo-600" />
              <span>Haftalık Nöbet Yeri Rotasyonu</span>
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${monthly.closedCount > 0 ? `<button id="btnDutyOpenAllMonth" type="button" class="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition">Kapalı Günleri Aç (${monthly.closedCount})</button>` : ''}
            <button id="btnDutyExportPdf" type="button" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition">Aylık Nöbet PDF / Yazdır</button>
            <button id="btnDutyExportXlsx" type="button" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition">Aylık Nöbet Excel (.xlsx)</button>
          </div>
        </div>

        <!-- Etkileşimli Aylık Takvim (Gün Kapatma / Açma) -->
        <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="font-bold text-slate-800">
              ${escapeHtml(monthly.monthName)} ${monthly.year} Aylık Takvim <span class="font-normal text-slate-500">(Tatil / kapalı gün eklemek veya açmak için güne tıklayın)</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Açık (Nöbet Var)</span>
              <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800">Kapalı / Tatil</span>
              <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Kural: 1 öğretmen / hafta en fazla 1 gün</span>
            </div>
          </div>
          <div class="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500">
            <div>Pzt</div><div>Sal</div><div>Çar</div><div>Per</div><div>Cum</div><div>Cmt</div><div>Paz</div>
          </div>
          <div class="grid grid-cols-7 gap-1.5">
            ${(() => {
              const firstJs = new Date(monthly.year, monthly.month - 1, 1).getDay(); // 0=Paz..6=Cmt
              const pad = firstJs === 0 ? 6 : firstJs - 1;
              const blanks = Array.from({ length: pad }, () => `<div class="h-12 rounded-lg bg-transparent"></div>`).join('');
              const cells = (monthly.calendarDays || []).map((cd) => {
                if (!cd.isSchoolDay) {
                  return `<div class="h-12 rounded-lg border border-slate-200/70 bg-slate-100/80 p-1.5 flex flex-col justify-between text-slate-400">
                    <span class="text-[11px] font-bold">${cd.dayNum}</span>
                    <span class="text-[9px]">${cd.isWeekend ? 'Hafta Sonu' : 'Kapalı'}</span>
                  </div>`;
                }
                if (cd.isClosed) {
                  return `<button type="button" data-duty-iso="${cd.isoDate}" class="btn-duty-cal-day h-12 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 p-1.5 flex flex-col justify-between text-left transition">
                    <div class="flex items-center justify-between w-full"><span class="text-[11px] font-extrabold text-rose-700 line-through">${cd.dayNum}</span><span class="text-[9px] font-bold text-rose-600">✕</span></div>
                    <span class="text-[9px] font-bold text-rose-700 truncate">Kapalı / Tatil</span>
                  </button>`;
                }
                return `<button type="button" data-duty-iso="${cd.isoDate}" class="btn-duty-cal-day h-12 rounded-lg border border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 p-1.5 flex flex-col justify-between text-left transition">
                  <div class="flex items-center justify-between w-full"><span class="text-[11px] font-extrabold text-slate-800">${cd.dayNum}</span><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span></div>
                  <span class="text-[9px] font-semibold text-emerald-700 truncate">${cd.dutyCount > 0 ? `${cd.dutyCount} nöbetçi` : 'Açık'}</span>
                </button>`;
              }).join('');
              return blanks + cells;
            })()}
          </div>
        </div>

        <div class="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 bg-indigo-50">
              <tr>
                <th class="p-2 border border-slate-200 text-center font-bold w-24">Tarih</th>
                <th class="p-2 border border-slate-200 text-left font-bold w-28">Gün</th>
                ${monthly.locations.map((l) => `<th class="p-2 border border-slate-200 text-center font-bold">${escapeHtml(l)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${monthly.rows.map((r) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-1.5 border border-slate-200 text-center font-mono">${escapeHtml(r.dateStr)}</td>
                  <td class="p-1.5 border border-slate-200 font-semibold bg-slate-50">${escapeHtml(r.dayName)}</td>
                  ${monthly.locations.map((l) => `<td class="p-1.5 border border-slate-200 text-center">${escapeHtml((r.byLocation[l] || []).join(', ') || '—')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnDutyAutoBusiest').addEventListener('click', () => {
    try {
      const r = DM.autoAssignSchoolDuties(state, teachers, activeDays, 'busiest_day');
      saveState(); renderMenu6();
      showToast(`${r.assignedCount} öğretmene en yoğun ders gününe göre nöbet dağıtıldı (${r.skippedAdminsCount} idareci muaf).`);
    } catch (err) { showToast(err.message); }
  });
  document.getElementById('btnDutyAutoLightest').addEventListener('click', () => {
    try {
      const r = DM.autoAssignSchoolDuties(state, teachers, activeDays, 'lightest_day');
      saveState(); renderMenu6();
      showToast(`${r.assignedCount} öğretmene en az ders gününe göre nöbet dağıtıldı (${r.skippedAdminsCount} idareci muaf).`);
    } catch (err) { showToast(err.message); }
  });
  document.getElementById('btnAddDutyLoc').addEventListener('click', () => {
    const inp = document.getElementById('inpNewDutyLoc');
    const val = (inp && inp.value || '').trim();
    if (!val) return;
    if (!cfg.locations.includes(val)) cfg.locations.push(val);
    saveState(); renderMenu6();
  });
  contentEl.querySelectorAll('.btn-del-duty-loc').forEach((btn) => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.delLoc);
    if (cfg.locations.length > 1 && idx >= 0) {
      cfg.locations.splice(idx, 1);
      saveState(); renderMenu6();
    }
  }));
  document.getElementById('selDutyMonth').addEventListener('change', (e) => { cfg.month = Number(e.target.value); saveState(); renderMenu6(); });
  document.getElementById('inpDutyYear').addEventListener('change', (e) => { cfg.year = Number(e.target.value) || new Date().getFullYear(); saveState(); renderMenu6(); });
  document.getElementById('chkDutyRotate').addEventListener('change', (e) => { cfg.rotateWeekly = Boolean(e.target.checked); saveState(); renderMenu6(); });
  contentEl.querySelectorAll('.btn-duty-cal-day').forEach((btn) => btn.addEventListener('click', () => {
    const iso = btn.dataset.dutyIso;
    if (!iso) return;
    const nowClosed = DM.toggleClosedDate(state, iso);
    saveState(); renderMenu6();
    showToast(nowClosed ? `${iso} tatil/kapalı olarak işaretlendi (nöbet yazılmayacak).` : `${iso} tekrar nöbete açıldı.`);
  }));
  document.getElementById('btnDutyOpenAllMonth')?.addEventListener('click', () => {
    const prefix = `${cfg.year}-${String(cfg.month).padStart(2, '0')}-`;
    Object.keys(cfg.closedDates || {}).forEach((k) => { if (k.startsWith(prefix)) delete cfg.closedDates[k]; });
    saveState(); renderMenu6();
    showToast(`${monthly.monthName} ${monthly.year} ayındaki tüm kapalı günler açıldı.`);
  });

  document.getElementById('btnDutyExportPdf').addEventListener('click', async () => {
    const html = DM.buildMonthlyDutyPrintHtml(state, monthly);
    const api = window.dersDagitimAPI;
    const filename = `aylik_nobet_${monthly.year}_${String(monthly.month).padStart(2, '0')}.pdf`;
    if (api && typeof api.exportPdf === 'function') {
      try {
        const res = await api.exportPdf({ html, defaultFilename: filename, pdfOptions: { pageSize: 'A4', orientation: 'landscape' } });
        if (!res.canceled) showToast(`Aylık nöbet PDF kaydedildi: ${filename}`);
      } catch (err) { showToast(err.message || 'PDF oluşturulamadı.'); }
    } else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    }
  });

  document.getElementById('btnDutyExportXlsx').addEventListener('click', async () => {
    if (typeof window.XLSX === 'undefined') { showToast('Excel modülü yüklenemedi.'); return; }
    const aoa = [
      [`${(state.school && state.school.name) || 'OKUL'} — ${monthly.monthName.toUpperCase()} ${monthly.year} AYLIK NÖBET ÇİZELGESİ`],
      ['Tarih', 'Gün', ...monthly.locations],
      ...monthly.rows.map((r) => [r.dateStr, r.dayName, ...monthly.locations.map((l) => (r.byLocation[l] || []).join(', '))])
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Aylik Nobet');
    const filename = `aylik_nobet_${monthly.year}_${String(monthly.month).padStart(2, '0')}.xlsx`;
    const api = window.dersDagitimAPI;
    if (api && typeof api.saveBinaryFile === 'function') {
      try {
        const b64 = window.XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const res = await api.saveBinaryFile({
          title: 'Aylık Nöbet Excel Kaydet',
          defaultFilename: filename,
          filters: [{ name: 'Excel (.xlsx)', extensions: ['xlsx'] }],
          base64Data: b64
        });
        if (!res.canceled) showToast(`Aylık nöbet Excel kaydedildi: ${filename}`);
      } catch (err) { showToast(err.message || 'Excel kaydedilemedi.'); }
    } else {
      window.XLSX.writeFile(wb, filename);
    }
  });
}

function renderMenu6() {
  ensureState(state);
  document.querySelectorAll('.m6-tab-btn').forEach((b) => {
    const active = b.dataset.m6Tab === state.m6Tab;
    b.className = 'm6-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold border transition ' + (active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50');
  });

  const contentEl = document.getElementById('m6ContentArea');
  const pickerWrap = document.getElementById('m6EntityPickerWrap');
  const selEl = document.getElementById('m6EntitySelect');
  const moveHint = document.getElementById('m6MoveHint');

  if (state.m6Tab === 'duty' && window.DersDutyModule) {
    pickerWrap.classList.add('hidden');
    renderSchoolDutyTab(contentEl);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (!state.solution || !Array.isArray(state.solution.placements) || state.solution.placements.length === 0) {
    pickerWrap.classList.add('hidden');
    contentEl.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto"><i data-lucide="table-2" class="w-6 h-6"></i></div>
        <div>
          <h3 class="text-base font-bold text-slate-900">Henüz Çözülmüş Ders Programı Yok</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">Program tablolarını görmek için <strong>Menü 5</strong>'ten otomatik dağıtımı başlatın veya <strong>Menü 7</strong>'den kayıtlı bir çözüm yükleyin.</p>
        </div>
        <button id="btnM6EmptyGo5" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition">
          <i data-lucide="cpu" class="w-4 h-4"></i> Menü 5'e Git
        </button>
      </div>
    `;
    document.getElementById('btnM6EmptyGo5').addEventListener('click', () => { state.activeView = 'menu5'; saveState(); renderAll(); });
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const placements = state.solution.placements;
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const rooms = getCurrentRooms();

  if (m6SwapSourceKey) {
    moveHint.classList.remove('hidden');
    moveHint.textContent = 'Takas yapmak için ikinci bir derse tıklayın (İptal için seçili derse tekrar tıkla)';
  } else if (m6SelectedMoveKey) {
    moveHint.classList.remove('hidden');
    moveHint.textContent = 'Taşımak için yeşil uygun saate veya takas için dolu bir derse tıklayın';
  } else moveHint.classList.add('hidden');

  const redistBtn = document.getElementById('btnM6RedistEntity');
  const redistLbl = document.getElementById('lblM6RedistEntity');
  if (redistBtn) {
    const showRedist = (state.m6Tab === 'class' || state.m6Tab === 'teacher') && state.m6EntityId && state.m6EntityId !== 'ALL';
    redistBtn.classList.toggle('hidden', !showRedist);
    if (showRedist && redistLbl) {
      redistLbl.textContent = state.m6Tab === 'class' ? 'Bu Sınıfı Yeniden Dağıt' : 'Bu Öğretmeni Yeniden Dağıt';
    }
  }
  updateUndoRedoButtons();

  if (state.m6Tab === 'report') {
    pickerWrap.classList.add('hidden');
    const rep = window.DersExportEngine.computeDetailedReports(state, getEditorHelpers(), window.DersEditorLogic);
    const s = rep.summary;
    contentEl.innerHTML = `
      <div class="rounded-2xl border ${s.isValid ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-950'} px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div class="font-bold flex items-center gap-2">
          <i data-lucide="${s.isValid ? 'shield-check' : 'alert-triangle'}" class="w-4 h-4"></i>
          <span>${s.isValid ? 'DOĞRULANMIŞ GEÇERLİ PROGRAM — Tüm ders blokları eksiksiz ve çakışmasız yerleşmiş.' : `TASLAK / DOĞRULANMAMIŞ PROGRAM — ${s.violationCount} çakışma/kısıt ihlali, ${s.missingHoursTotal} eksik ders saati.`}</span>
        </div>
        <span class="font-semibold">${state.solution.engine === 'google_ortools_cp_sat' ? 'Otomatik Dağıtım' : 'Elle Düzenleme'}</span>
      </div>

      <!-- 1. Genel Program Kalite Raporu -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Şube ve Öğretmen</div>
          <div class="text-xl font-bold text-slate-900 mt-1">${s.totalClasses} Şube · ${s.totalTeachers} Öğr.</div>
          <div class="text-xs text-slate-500 mt-0.5">${s.totalRooms} özel derslik</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Yerleşen / Hedef Ders Saati</div>
          <div class="text-2xl font-bold text-indigo-700 mt-1">${s.totalPlacedHours} / ${s.totalTargetHours} sa</div>
          <div class="text-xs ${s.missingHoursTotal === 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold mt-0.5">${s.missingHoursTotal === 0 ? 'Eksik ders saati yok' : `${s.missingHoursTotal} saat eksik`}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Öğretmen Boş Pencere Toplamı</div>
          <div class="text-2xl font-bold ${s.totalGaps === 0 ? 'text-emerald-600' : 'text-amber-600'} mt-1">${s.totalGaps}</div>
          <div class="text-xs text-slate-500 mt-0.5">İlk ve son ders arası boş saatler</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Kilitler ve İhlaller</div>
          <div class="text-xl font-bold text-slate-900 mt-1">${s.lockedBlocksCount} Kilitli Blok</div>
          <div class="text-xs ${s.violationCount === 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold mt-0.5">${s.violationCount === 0 ? '0 çakışma / ihlal' : `${s.violationCount} çakışma / ihlal`}</div>
        </div>
      </div>

      <!-- 2. Öğretmen Yük ve Pencere Raporu -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 print-card">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900">1. Öğretmen Yük ve Boş Pencere Raporu</h3>
          <span class="text-xs text-slate-500">${rep.teacherRows.length} öğretmen</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-y border-slate-200 text-slate-500">
                <th class="py-2 px-2.5">Öğretmen</th>
                <th class="py-2 px-2.5">Branş</th>
                <th class="py-2 px-2.5 text-center">Haftalık Saat</th>
                ${s.dayShorts.map((d) => `<th class="py-2 px-1.5 text-center">${d}</th>`).join('')}
                <th class="py-2 px-2 text-center">Çalıştığı Gün</th>
                <th class="py-2 px-2 text-center">Boş Pencere</th>
                <th class="py-2 px-2 text-center">Maks. Ardışık</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rep.teacherRows.map((r) => {
                const pct = Math.min(100, Math.round((r.totalHours / Math.max(1, r.maxWeekly)) * 100));
                return `<tr>
                  <td class="py-2 px-2.5 font-semibold text-slate-900">${escapeHtml(r.name)}</td>
                  <td class="py-2 px-2.5 text-slate-600">${escapeHtml(r.branch)}</td>
                  <td class="py-2 px-2.5 text-center">
                    <div class="font-bold text-indigo-700">${r.totalHours} / ${r.maxWeekly} sa</div>
                    <div class="w-20 h-1.5 bg-slate-100 rounded-full mx-auto mt-0.5 overflow-hidden"><div class="h-full bg-indigo-600 rounded-full" style="width:${pct}%"></div></div>
                  </td>
                  ${r.dailyHours.map((dh) => `<td class="py-2 px-1.5 text-center font-mono ${dh > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'}">${dh}</td>`).join('')}
                  <td class="py-2 px-2 text-center font-semibold text-slate-700">${r.workingDays} gün</td>
                  <td class="py-2 px-2 text-center font-bold ${r.gaps === 0 ? 'text-emerald-600' : 'text-amber-600'}">${r.gaps}</td>
                  <td class="py-2 px-2 text-center font-semibold text-slate-700">${r.maxConsecutive} sa</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. Sınıf Ders Raporu -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 print-card">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900">2. Sınıf Ders ve Blok Bütünlüğü Raporu</h3>
          <span class="text-xs text-slate-500">${rep.classRows.length} şube</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-y border-slate-200 text-slate-500">
                <th class="py-2 px-2.5">Şube</th>
                <th class="py-2 px-2.5 text-center">Hedef Saat</th>
                <th class="py-2 px-2.5 text-center">Yerleşen Saat</th>
                <th class="py-2 px-2.5 text-center">Eksik Saat</th>
                ${s.dayShorts.map((d) => `<th class="py-2 px-1.5 text-center">${d}</th>`).join('')}
                <th class="py-2 px-2.5 text-center">Blok Bütünlüğü</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rep.classRows.map((c) => `
                <tr>
                  <td class="py-2 px-2.5 font-bold text-indigo-800">${escapeHtml(c.name)}</td>
                  <td class="py-2 px-2.5 text-center font-semibold">${c.targetHours} sa</td>
                  <td class="py-2 px-2.5 text-center font-bold text-slate-900">${c.placedHours} sa</td>
                  <td class="py-2 px-2.5 text-center font-bold ${c.missingHours === 0 ? 'text-emerald-600' : 'text-rose-600'}">${c.missingHours} sa</td>
                  ${c.dailyHours.map((dh) => `<td class="py-2 px-1.5 text-center font-mono">${dh}</td>`).join('')}
                  <td class="py-2 px-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${c.blockIntegrityOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${c.blockIntegrityOk ? 'Tam / Geçerli' : 'Eksik / Sorunlu'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Özel Derslik Raporu -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 print-card">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900">3. Özel Derslik Kullanım ve Kapasite Raporu</h3>
          <span class="text-xs text-slate-500">${rep.roomRows.length} mekan</span>
        </div>
        ${rep.roomRows.length === 0
          ? `<div class="py-4 text-center text-xs text-slate-400">Tanımlı özel derslik bulunmuyor.</div>`
          : `<div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-y border-slate-200 text-slate-500">
                    <th class="py-2 px-2.5">Derslik Adı</th>
                    <th class="py-2 px-2.5 text-center">Kapasite</th>
                    <th class="py-2 px-2.5 text-center">Haftalık Kullanım</th>
                    <th class="py-2 px-2.5 text-center">Boş Kapasite</th>
                    <th class="py-2 px-2.5">Kullanan Dersler</th>
                    <th class="py-2 px-2.5 text-center">Eşzamanlı İhlal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${rep.roomRows.map((rm) => `
                    <tr>
                      <td class="py-2 px-2.5 font-bold text-slate-900">${escapeHtml(rm.name)}</td>
                      <td class="py-2 px-2.5 text-center">${rm.capacity} sınıf</td>
                      <td class="py-2 px-2.5 text-center font-bold text-indigo-700">${rm.usedHours} sa</td>
                      <td class="py-2 px-2.5 text-center text-slate-600">${rm.freeCapacityHours} sa</td>
                      <td class="py-2 px-2.5 text-slate-600 truncate max-w-xs">${escapeHtml(rm.coursesList.join(', ') || '—')}</td>
                      <td class="py-2 px-2.5 text-center font-bold ${rm.violations === 0 ? 'text-emerald-600' : 'text-rose-600'}">${rm.violations}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    `;
  } else if (state.m6Tab === 'class_sheet') {
    pickerWrap.classList.add('hidden');
    contentEl.innerHTML = renderClassCarsaf(placements);
  } else if (state.m6Tab === 'teacher_sheet') {
    pickerWrap.classList.add('hidden');
    contentEl.innerHTML = renderTeacherCarsaf(placements);
  } else if (state.m6Tab === 'class') {
    pickerWrap.classList.remove('hidden');
    selEl.innerHTML = `<option value="ALL">Tüm Şubeler (${classes.length})</option>` + classes.map((c) => `<option value="${c.id}" ${state.m6EntityId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    const targetClasses = state.m6EntityId === 'ALL' ? classes : classes.filter((c) => c.id === state.m6EntityId);
    contentEl.innerHTML = targetClasses.map((cls) => renderTimetableGrid(`${cls.name} Haftalık Ders Programı`, `${state.school.name || MEB_SCHOOL_TYPES[state.school.schoolTypeId].name} · ${state.school.academicYear}`, placements.filter((p) => p.class_id === cls.id), cls.id)).join('') || `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">Şube bulunamadı.</div>`;
  } else if (state.m6Tab === 'teacher') {
    pickerWrap.classList.remove('hidden');
    selEl.innerHTML = `<option value="ALL">Tüm Öğretmenler (${teachers.length})</option>` + teachers.map((t) => `<option value="${t.id}" ${state.m6EntityId === t.id ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.branch)})</option>`).join('');
    const targetTeachers = state.m6EntityId === 'ALL' ? teachers : teachers.filter((t) => t.id === state.m6EntityId);
    contentEl.innerHTML = targetTeachers.map((t) => renderTimetableGrid(`${t.name} — Haftalık Ders Programı`, `${t.branch} · Boş pencere: ${computeTeacherGaps(t.id)}`, placements.filter((p) => (p.teacher_ids || []).includes(t.id)), 'teacher')).join('') || `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">Öğretmen bulunamadı.</div>`;
  } else if (state.m6Tab === 'room') {
    pickerWrap.classList.remove('hidden');
    selEl.innerHTML = `<option value="ALL">Tüm Özel Mekanlar (${rooms.length})</option>` + rooms.map((r) => `<option value="${r.id}" ${state.m6EntityId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
    const targetRooms = state.m6EntityId === 'ALL' ? rooms : rooms.filter((r) => r.id === state.m6EntityId);
    contentEl.innerHTML = targetRooms.map((r) => renderTimetableGrid(`${r.name} — Kullanım Programı`, `Kapasite: ${r.capacity} sınıf`, placements.filter((p) => p.room_id === r.id), null)).join('') || `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">Özel mekan tanımlı değil.</div>`;
  }

  contentEl.querySelectorAll('.m6-pin-btn').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = btn.dataset.pinKey;
    editorHistory.push(state);
    const idx = state.pinnedPlacementIds.indexOf(k);
    if (idx >= 0) { state.pinnedPlacementIds.splice(idx, 1); showToast('Ders kilidi kaldırıldı'); }
    else { state.pinnedPlacementIds.push(k); showToast('Ders kilitlendi'); }
    saveState(); updateUndoRedoButtons(); renderMenu6(); renderMenu5();
  }));
  contentEl.querySelectorAll('.m6-pick-btn').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = btn.dataset.pickKey;
    const pl = placements.find((p) => getPlacementKey(p) === k);
    if (pl) {
      const lockInfo = window.DersEditorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds);
      if (lockInfo.locked) { showToast(lockInfo.reason); return; }
    }
    m6SwapSourceKey = null;
    m6SelectedMoveKey = (m6SelectedMoveKey === k) ? null : k;
    renderMenu6();
  }));
  contentEl.querySelectorAll('.m6-drop-cell').forEach((btn) => btn.addEventListener('click', () => {
    if (!m6SelectedMoveKey) return;
    const pl = placements.find((p) => getPlacementKey(p) === m6SelectedMoveKey);
    if (pl) tryMovePlacement(pl, Number(btn.dataset.moveD), Number(btn.dataset.moveP));
  }));

  // Hücre tıklama (işlem menüsü veya takas hedefi) ve sürükle-bırak
  contentEl.querySelectorAll('.m6-lesson-card').forEach((card) => {
    card.addEventListener('click', () => {
      const k = card.dataset.cardKey;
      const pl = placements.find((p) => getPlacementKey(p) === k);
      if (!pl) return;
      if (m6SwapSourceKey) {
        if (m6SwapSourceKey === k) { m6SwapSourceKey = null; renderMenu6(); return; }
        const src = placements.find((p) => getPlacementKey(p) === m6SwapSourceKey);
        m6SwapSourceKey = null;
        if (src) openSwapModal(src, pl);
        renderMenu6();
        return;
      }
      if (m6SelectedMoveKey && m6SelectedMoveKey !== k) {
        const src = placements.find((p) => getPlacementKey(p) === m6SelectedMoveKey);
        m6SelectedMoveKey = null;
        if (src) openSwapModal(src, pl);
        renderMenu6();
        return;
      }
      openCellActionModal(pl);
    });

    card.addEventListener('dragstart', (e) => {
      const k = card.dataset.dragKey;
      const pl = placements.find((p) => getPlacementKey(p) === k);
      if (!pl) return;
      const lockInfo = window.DersEditorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds);
      if (lockInfo.locked) { e.preventDefault(); showToast(lockInfo.reason); return; }
      m6DraggingKey = k;
      e.dataTransfer.setData('text/plain', k);
      e.dataTransfer.effectAllowed = 'move';
      // Uygun hücreleri yeşil, uygun olmayanları kırmızı renklendir (DOM üzerinde hızlı işaretleme)
      contentEl.querySelectorAll('.m6-slot-td').forEach((td) => {
        const d = Number(td.dataset.slotD), p = Number(td.dataset.slotP);
        if (td.dataset.occupiedKey) return;
        const chk = window.DersEditorLogic.validateManualPlacementFull(state, { ...pl, day_index: d, start_period: p }, getEditorHelpers(), [pl]);
        td.classList.add(chk.valid ? 'bg-emerald-100' : 'bg-rose-50');
      });
    });

    card.addEventListener('dragend', () => {
      m6DraggingKey = null;
      contentEl.querySelectorAll('.m6-slot-td').forEach((td) => {
        td.classList.remove('bg-emerald-100', 'bg-rose-50', 'ring-2', 'ring-indigo-400');
      });
    });
  });

  contentEl.querySelectorAll('.m6-slot-td').forEach((td) => {
    td.addEventListener('dragover', (e) => {
      if (!m6DraggingKey) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      td.classList.add('ring-2', 'ring-indigo-400');
    });
    td.addEventListener('dragleave', () => {
      td.classList.remove('ring-2', 'ring-indigo-400');
    });
    td.addEventListener('drop', (e) => {
      e.preventDefault();
      td.classList.remove('ring-2', 'ring-indigo-400');
      const dragKey = e.dataTransfer.getData('text/plain') || m6DraggingKey;
      m6DraggingKey = null;
      if (!dragKey) return;
      const srcPl = placements.find((p) => getPlacementKey(p) === dragKey);
      if (!srcPl) return;
      const occKey = td.dataset.occupiedKey;
      if (occKey && occKey !== dragKey) {
        const targetPl = placements.find((p) => getPlacementKey(p) === occKey);
        if (targetPl) openSwapModal(srcPl, targetPl);
        return;
      }
      if (!occKey) {
        tryMovePlacement(srcPl, Number(td.dataset.slotD), Number(td.dataset.slotP));
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function checkCentralExportGate(actionName) {
  if (!state.solution || !Array.isArray(state.solution.placements) || !state.solution.placements.length) {
    showToast('Önce Menü 5’ten ders dağıtımı yapın.');
    return null;
  }
  const auth = window.DersExportEngine.EvrakPlusAuthService.checkExportPermission(actionName, state);
  if (!auth.allowed) {
    if (window.EvrakPlusUI && typeof window.EvrakPlusUI.openGateModal === 'function') {
      window.EvrakPlusUI.openGateModal(auth.message);
    } else {
      showToast(auth.message);
    }
    return null;
  }
  const validity = window.DersExportEngine.checkScheduleValidityForExport(state, getEditorHelpers(), window.DersEditorLogic);
  return { auth, validity };
}

async function exportTimetableXlsx() {
  const gate = checkCentralExportGate('export_xlsx');
  if (!gate) return;
  if (typeof window.XLSX === 'undefined') {
    showToast('Excel modülü yüklenemedi.'); return;
  }
  if (gate.validity.isDraft) {
    showToast(`Uyarı: ${gate.validity.message} Çıktı TASLAK olarak işaretlendi.`);
  }
  const { workbook } = window.DersExportEngine.buildExcelWorkbook(window.XLSX, state, getEditorHelpers(), window.DersEditorLogic);
  const safeSchool = window.DersExportEngine.sanitizeWindowsFilename(state.school.name || state.school.schoolTypeId, 'okul');
  const filename = `ders_programi_${safeSchool}.xlsx`;

  const api = window.dersDagitimAPI;
  if (api && typeof api.saveBinaryFile === 'function') {
    try {
      const b64 = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      const res = await api.saveBinaryFile({
        title: 'Excel Çalışma Kitabını Kaydet (.xlsx)',
        defaultFilename: filename,
        filters: [{ name: 'Excel Çalışma Kitabı (.xlsx)', extensions: ['xlsx'] }],
        base64Data: b64
      });
      if (!res.canceled) showToast(`Excel dosyası kaydedildi: ${filename}`);
    } catch (err) {
      showToast(err.message || 'Excel dosyası kaydedilemedi.');
    }
  } else {
    window.XLSX.writeFile(workbook, filename);
    showToast(`${filename} indirildi`);
  }
}

/* =========================================================================
   AŞAMA 4: CANLI ÇIKTI ÖNİZLEME, GERÇEK PDF VE TOPLU ÇIKTI (PDF / ZIP)
   ========================================================================= */
function buildPreviewDocumentHtml(docType, entityId) {
  const gate = checkCentralExportGate('preview_pdf');
  if (!gate) return { html: '', isDraft: true, defaultFilename: 'ders_programi.pdf' };
  const isDraft = gate.validity.isDraft;
  const helpers = getEditorHelpers();
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  let pagesHtml = '';
  let baseName = 'ders_programi';

  if (docType === 'class') {
    const list = (entityId && entityId !== 'ALL') ? classes.filter((c) => c.id === entityId) : classes;
    pagesHtml = list.map((cls, idx) => window.DersExportEngine.buildClassTimetablePageHtml(state, cls, helpers, isDraft, idx + 1, list.length)).join('');
    baseName = list.length === 1 ? `sinif_${list[0].name}` : 'tum_sinif_programlari';
  } else if (docType === 'teacher') {
    const list = (entityId && entityId !== 'ALL') ? teachers.filter((t) => t.id === entityId) : teachers;
    pagesHtml = list.map((t, idx) => window.DersExportEngine.buildTeacherTimetablePageHtml(state, t, helpers, isDraft, idx + 1, list.length)).join('');
    baseName = list.length === 1 ? `ogretmen_${list[0].name}` : 'tum_ogretmen_programlari';
  } else if (docType === 'class_sheet') {
    pagesHtml = window.DersExportEngine.buildCarsafPagesHtml(state, 'class_sheet', helpers, isDraft);
    baseName = 'sinif_carsaf_programi';
  } else if (docType === 'teacher_sheet') {
    pagesHtml = window.DersExportEngine.buildCarsafPagesHtml(state, 'teacher_sheet', helpers, isDraft);
    baseName = 'ogretmen_carsaf_programi';
  } else {
    pagesHtml = window.DersExportEngine.buildQualityReportPageHtml(state, helpers, window.DersEditorLogic, isDraft);
    baseName = 'program_kalite_raporu';
  }

  const fullHtml = window.DersExportEngine.wrapFullPrintableHtml(pagesHtml, state.exportSettings);
  const safeFile = window.DersExportEngine.sanitizeWindowsFilename(baseName) + '.pdf';
  return { html: fullHtml, isDraft, validityMessage: gate.validity.message, defaultFilename: safeFile };
}

function populateExportPreviewEntityOptions() {
  const docType = document.getElementById('epvDocType').value;
  const wrap = document.getElementById('epvEntityWrap');
  const sel = document.getElementById('epvEntitySelect');
  if (docType === 'class') {
    wrap.classList.remove('hidden');
    const classes = getCurrentClasses();
    sel.innerHTML = `<option value="ALL">Tüm Şubeler (${classes.length})</option>` + classes.map((c) => `<option value="${c.id}" ${state.m6EntityId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  } else if (docType === 'teacher') {
    wrap.classList.remove('hidden');
    const teachers = getCurrentTeachers();
    sel.innerHTML = `<option value="ALL">Tüm Öğretmenler (${teachers.length})</option>` + teachers.map((t) => `<option value="${t.id}" ${state.m6EntityId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  } else {
    wrap.classList.add('hidden');
    sel.innerHTML = `<option value="ALL">Tümü</option>`;
  }
}

function refreshExportPreviewFrame() {
  ensureState(state);
  const es = state.exportSettings;
  es.pageSize = document.getElementById('epvPageSize').value;
  es.orientation = document.getElementById('epvOrientation').value;
  es.fontSize = document.getElementById('epvFontSize').value;
  es.teacherDisplay = document.getElementById('epvTeacherDisplay').value;
  es.colorMode = document.getElementById('epvColorMode').value;
  es.coordinatorName = document.getElementById('epvCoordinator').value.trim();
  es.principalName = document.getElementById('epvPrincipal').value.trim();
  es.customTitle = document.getElementById('epvCustomTitle').value.trim();
  es.footerText = document.getElementById('epvFooterText').value.trim();
  es.showSignatures = document.getElementById('epvShowSignatures').checked;
  es.showDate = document.getElementById('epvShowDate').checked;
  es.splitA4Sheets = document.getElementById('epvSplitA4').checked;
  es.showLogo = document.getElementById('epvShowLogo').checked;
  saveState();

  const docType = document.getElementById('epvDocType').value;
  const entityId = document.getElementById('epvEntitySelect').value || 'ALL';
  const built = buildPreviewDocumentHtml(docType, entityId);
  const badge = document.getElementById('epvValidityBadge');
  if (built.isDraft) {
    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300';
    badge.textContent = `TASLAK (${built.validityMessage})`;
  } else {
    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300';
    badge.textContent = 'DOĞRULANMIŞ PROGRAM';
  }
  const frame = document.getElementById('exportPreviewFrame');
  if (frame) frame.srcdoc = built.html;
  return built;
}

function openExportPreviewModal(defaultDocType = null) {
  const gate = checkCentralExportGate('open_preview');
  if (!gate) return;
  ensureState(state);
  const es = state.exportSettings;
  const tabToDoc = { class: 'class', teacher: 'teacher', class_sheet: 'class_sheet', teacher_sheet: 'teacher_sheet', report: 'report', room: 'class' };
  const chosenDoc = defaultDocType || tabToDoc[state.m6Tab] || 'class';
  document.getElementById('epvDocType').value = chosenDoc;
  document.getElementById('epvPageSize').value = es.pageSize || 'A4';
  const defaultOrient = (chosenDoc === 'class' || chosenDoc === 'teacher') ? 'portrait' : 'landscape';
  document.getElementById('epvOrientation').value = defaultOrient;
  document.getElementById('epvFontSize').value = es.fontSize || 'medium';
  document.getElementById('epvTeacherDisplay').value = es.teacherDisplay || 'full';
  document.getElementById('epvColorMode').value = es.colorMode || 'color';
  document.getElementById('epvCoordinator').value = es.coordinatorName || state.school.coordinator || '';
  document.getElementById('epvPrincipal').value = es.principalName || '';
  document.getElementById('epvCustomTitle').value = es.customTitle || '';
  document.getElementById('epvFooterText').value = es.footerText || '';
  document.getElementById('epvShowSignatures').checked = Boolean(es.showSignatures);
  document.getElementById('epvShowDate').checked = Boolean(es.showDate);
  document.getElementById('epvSplitA4').checked = Boolean(es.splitA4Sheets);
  document.getElementById('epvShowLogo').checked = Boolean(es.showLogo);

  populateExportPreviewEntityOptions();
  refreshExportPreviewFrame();
  const m = document.getElementById('exportPreviewModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

async function saveCurrentPreviewAsPdf() {
  const built = refreshExportPreviewFrame();
  if (!built.html) return;
  const api = window.dersDagitimAPI;
  if (api && typeof api.exportPdf === 'function') {
    try {
      const res = await api.exportPdf({
        html: built.html,
        defaultFilename: built.defaultFilename,
        pdfOptions: { pageSize: state.exportSettings.pageSize, orientation: state.exportSettings.orientation }
      });
      if (!res.canceled) showToast('PDF dosyası başarıyla oluşturuldu');
    } catch (err) {
      showToast(err.message || 'PDF oluşturulamadı.');
    }
  } else {
    printCurrentPreviewDoc();
  }
}

function printCurrentPreviewDoc() {
  const frame = document.getElementById('exportPreviewFrame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } else {
    window.print();
  }
}

let batchSelectedIds = new Set();

function renderBatchPicker() {
  const scope = document.getElementById('batchScopeSelect').value;
  const fmtWrap = document.getElementById('batchFormatWrap');
  const pickWrap = document.getElementById('batchPickerWrap');
  const pickList = document.getElementById('batchPickerList');

  fmtWrap.classList.toggle('hidden', scope === 'school_excel' || scope === 'quality_reports');

  if (scope === 'selected_classes' || scope === 'selected_teachers') {
    pickWrap.classList.remove('hidden');
    const items = scope === 'selected_classes' ? getCurrentClasses() : getCurrentTeachers();
    if (batchSelectedIds.size === 0) items.forEach((it) => batchSelectedIds.add(it.id));
    pickList.innerHTML = items.map((it) => `
      <label class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white cursor-pointer text-xs">
        <input type="checkbox" data-batch-id="${it.id}" ${batchSelectedIds.has(it.id) ? 'checked' : ''} class="batch-item-chk rounded text-indigo-600" />
        <span class="truncate font-semibold">${escapeHtml(it.name)}</span>
      </label>
    `).join('');
    pickList.querySelectorAll('.batch-item-chk').forEach((chk) => chk.addEventListener('change', () => {
      if (chk.checked) batchSelectedIds.add(chk.dataset.batchId); else batchSelectedIds.delete(chk.dataset.batchId);
    }));
  } else {
    pickWrap.classList.add('hidden');
  }
}

function openBatchExportModal() {
  const gate = checkCentralExportGate('batch_export');
  if (!gate) return;
  batchSelectedIds = new Set();
  document.getElementById('batchProgressWrap').classList.add('hidden');
  renderBatchPicker();
  const m = document.getElementById('batchExportModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

async function runBatchExport() {
  const gate = checkCentralExportGate('run_batch_export');
  if (!gate) return;
  const scope = document.getElementById('batchScopeSelect').value;
  const format = document.getElementById('batchFormatSelect').value;
  const isDraft = gate.validity.isDraft;
  const helpers = getEditorHelpers();

  if (scope === 'school_excel') {
    await exportTimetableXlsx();
    return;
  }
  if (scope === 'quality_reports') {
    const page = window.DersExportEngine.buildQualityReportPageHtml(state, helpers, window.DersEditorLogic, isDraft);
    const html = window.DersExportEngine.wrapFullPrintableHtml(page, state.exportSettings);
    const api = window.dersDagitimAPI;
    if (api && typeof api.exportPdf === 'function') {
      const res = await api.exportPdf({ html, defaultFilename: 'program_kalite_raporlari.pdf', pdfOptions: state.exportSettings });
      if (!res.canceled) showToast('Kalite raporları PDF olarak kaydedildi');
    }
    return;
  }

  const isClass = scope === 'all_classes' || scope === 'selected_classes';
  let list = isClass ? getCurrentClasses() : getCurrentTeachers();
  if (scope === 'selected_classes' || scope === 'selected_teachers') {
    list = list.filter((it) => batchSelectedIds.has(it.id));
  }
  if (!list.length) { showToast('En az bir kayıt seçmelisiniz.'); return; }

  const api = window.dersDagitimAPI;
  if (!api || typeof api.exportPdf !== 'function') {
    openExportPreviewModal(isClass ? 'class' : 'teacher');
    return;
  }

  const progWrap = document.getElementById('batchProgressWrap');
  const progLbl = document.getElementById('batchProgressLabel');
  const progCnt = document.getElementById('batchProgressCount');
  const progBar = document.getElementById('batchProgressBar');
  progWrap.classList.remove('hidden');

  try {
    if (format === 'single_pdf') {
      progLbl.textContent = 'Çok sayfalı tek PDF oluşturuluyor...';
      progCnt.textContent = `${list.length} sayfa`;
      progBar.style.width = '50%';
      const pages = list.map((it, idx) => isClass
        ? window.DersExportEngine.buildClassTimetablePageHtml(state, it, helpers, isDraft, idx + 1, list.length)
        : window.DersExportEngine.buildTeacherTimetablePageHtml(state, it, helpers, isDraft, idx + 1, list.length)
      ).join('');
      const html = window.DersExportEngine.wrapFullPrintableHtml(pages, state.exportSettings);
      const defName = isClass ? 'toplu_sinif_programlari.pdf' : 'toplu_ogretmen_programlari.pdf';
      const res = await api.exportPdf({ html, defaultFilename: defName, pdfOptions: state.exportSettings });
      if (!res.canceled) showToast(`Toplu PDF kaydedildi (${list.length} sayfa)`);
    } else {
      progLbl.textContent = 'Ayrı PDF dosyaları ve ZIP arşivi hazırlanıyor...';
      const items = list.map((it) => {
        const page = isClass
          ? window.DersExportEngine.buildClassTimetablePageHtml(state, it, helpers, isDraft, 1, 1)
          : window.DersExportEngine.buildTeacherTimetablePageHtml(state, it, helpers, isDraft, 1, 1);
        const safe = window.DersExportEngine.sanitizeWindowsFilename(it.name);
        return {
          filename: `${isClass ? 'Sinif' : 'Ogretmen'}_${safe}.pdf`,
          html: window.DersExportEngine.wrapFullPrintableHtml(page, state.exportSettings)
        };
      });
      const defZip = isClass ? 'sinif_programlari_paket.zip' : 'ogretmen_programlari_paket.zip';
      const res = await api.exportBatchZip({ items, defaultFilename: defZip, pdfOptions: state.exportSettings });
      if (!res.canceled) {
        const failMsg = (res.failed && res.failed.length) ? ` (${res.failed.length} hata)` : '';
        showToast(`Toplu ZIP arşivi kaydedildi: ${res.count} PDF${failMsg}`);
      }
    }
  } catch (err) {
    showToast(err.message || 'Toplu çıktı oluşturulamadı.');
  } finally {
    progWrap.classList.add('hidden');
  }
}

function exportTimetableCsv() {
  if (!state.solution || !Array.isArray(state.solution.placements) || !state.solution.placements.length) {
    showToast('Önce Menü 5’ten dağıtım yapın'); return;
  }
  const gridStats = getSlotStats();
  const periods = state.grid.periodsPerDay;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [];
  let filename = `haftalik_ders_programi_${state.school.schoolTypeId}.csv`;

  if (state.m6Tab === 'class_sheet') {
    filename = `sinif_carsaf_${state.school.schoolTypeId}.csv`;
    const tMap = Object.fromEntries(getCurrentTeachers().map((t) => [t.id, t.shortCode || makeTeacherShortCode(t.name)]));
    const header = ['Sube'];
    gridStats.activeDayIndices.forEach((d) => { for (let p = 0; p < periods; p++) header.push(`${DAY_SHORT[d]}-${p + 1}`); });
    header.push('Toplam');
    lines.push(header.map(esc).join(';'));
    getCurrentClasses().forEach((cls) => {
      const row = [cls.name]; let tot = 0;
      gridStats.activeDayIndices.forEach((_, cIdx) => {
        for (let p = 0; p < periods; p++) {
          const pl = state.solution.placements.find((x) => x.class_id === cls.id && x.day_index === cIdx && p >= x.start_period && p < x.start_period + x.length);
          if (pl) { tot++; const ts = (pl.teacher_ids || []).map((id) => tMap[id] || '').filter(Boolean).join('/'); row.push(`${pl.course_code}${ts ? ' (' + ts + ')' : ''}`); }
          else row.push('');
        }
      });
      row.push(tot); lines.push(row.map(esc).join(';'));
    });
  } else if (state.m6Tab === 'teacher_sheet') {
    filename = `ogretmen_carsaf_${state.school.schoolTypeId}.csv`;
    const header = ['Ogretmen', 'Brans'];
    gridStats.activeDayIndices.forEach((d) => { for (let p = 0; p < periods; p++) header.push(`${DAY_SHORT[d]}-${p + 1}`); });
    header.push('Toplam', 'Bos_Pencere');
    lines.push(header.map(esc).join(';'));
    getCurrentTeachers().forEach((t) => {
      const row = [t.name, t.branch]; let tot = 0;
      gridStats.activeDayIndices.forEach((_, cIdx) => {
        for (let p = 0; p < periods; p++) {
          const pl = state.solution.placements.find((x) => (x.teacher_ids || []).includes(t.id) && x.day_index === cIdx && p >= x.start_period && p < x.start_period + x.length);
          if (pl) { tot++; row.push(`${pl.class_name} ${pl.course_code}`); } else row.push('');
        }
      });
      row.push(tot, computeTeacherGaps(t.id)); lines.push(row.map(esc).join(';'));
    });
  } else {
    const tMap = Object.fromEntries(getCurrentTeachers().map((t) => [t.id, t.name]));
    lines.push(['Sube', 'Gun', 'Ders_Saati', 'Ders_Kodu', 'Ders_Adi', 'Ogretmenler'].join(';'));
    state.solution.placements.forEach((pl) => {
      const dayName = DAY_NAMES[gridStats.activeDayIndices[pl.day_index]] || `Gun ${pl.day_index + 1}`;
      const tNames = (pl.teacher_ids || []).map((id) => tMap[id] || '').filter(Boolean).join(' / ');
      for (let k = 0; k < pl.length; k++) {
        lines.push([pl.class_name, dayName, `${pl.start_period + k + 1}. Ders`, pl.course_code, pl.course_name, tNames].map(esc).join(';'));
      }
    });
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`${filename} indirildi`);
}

/* =========================================================================
   8F. MENÜ 7: PROJE KAYIT ARŞİVİ VE JSON YEDEKLEME
   ========================================================================= */
function loadProjectArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
function saveProjectArchive(list) { try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)); } catch (e) {} }

function handleSmartJsonImport(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && Array.isArray(parsed.placements) && !parsed.app_state && !parsed.school) {
      state.solution = parsed;
      migrateSolutionAndLocks(state);
      saveState(); renderAll();
      showToast(`Çözüm yüklendi (${parsed.placements.length} blok)`);
      return;
    }
    const imp = parsed.app_state || parsed;
    if (!imp || !imp.school || !MEB_SCHOOL_TYPES[imp.school.schoolTypeId]) {
      showToast('Geçersiz proje JSON dosyası'); return;
    }
    ensureState(imp);
    state = imp;
    state.activeView = 'menu7';
    saveState(); renderAll();
    showToast('Proje yedeği başarıyla geri yüklendi');
  } catch (err) { showToast('JSON dosyası okunamadı'); }
}

function renderMenu7() {
  ensureState(state);
  const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
  const classes = getCurrentClasses();
  const teachers = getCurrentTeachers();
  const rooms = getCurrentRooms();
  const totalBlocks = classes.reduce((s, c) => s + (c.courses || []).reduce((x, co) => x + getCourseBlocks(co).length, 0), 0);
  const placed = state.solution ? state.solution.placed_blocks : 0;

  document.getElementById('m7CurrentSummary').innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Aktif Kurum</div>
      <div class="text-sm font-bold text-slate-900 mt-1 truncate">${escapeHtml(state.school.name || meta.name)}</div>
      <div class="text-xs text-indigo-600 font-medium mt-0.5">${meta.shortName} · ${escapeHtml(state.school.academicYear)}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Şube & Ders Bloğu</div>
      <div class="text-2xl font-bold text-slate-900 mt-1">${classes.length} şube</div>
      <div class="text-xs text-slate-500 mt-0.5">${totalBlocks} toplam ders bloğu</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Öğretmen & Mekan</div>
      <div class="text-2xl font-bold text-indigo-700 mt-1">${teachers.length} öğr.</div>
      <div class="text-xs text-slate-500 mt-0.5">${rooms.length} özel mekan</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="text-xs font-medium text-slate-500">Dağıtım & Kilit</div>
      <div class="text-lg font-bold ${placed > 0 ? 'text-emerald-600' : 'text-slate-400'} mt-1">${placed > 0 ? `${placed}/${totalBlocks} blok` : 'Dağıtılmadı'}</div>
      <div class="text-xs text-slate-500 mt-0.5">${(state.pinnedPlacementIds || []).length} kilitli ders · ${(state.lockedTeacherIds || []).length} kilitli öğr.</div>
    </div>
  `;

  const archive = loadProjectArchive();
  document.getElementById('m7ArchiveCount').textContent = `${archive.length} kayıt`;
  const listEl = document.getElementById('m7ArchiveList');

  if (archive.length === 0) {
    listEl.innerHTML = `<div class="py-12 text-center space-y-2"><div class="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto"><i data-lucide="archive" class="w-5 h-5"></i></div><div class="text-xs font-bold text-slate-700">Henüz Kayıtlı Proje Yok</div><p class="text-[11px] text-slate-400 max-w-xs mx-auto">Soldaki alana proje adı yazıp "Arşive Kaydet" diyebilirsiniz.</p></div>`;
  } else {
    listEl.innerHTML = archive.map((item) => `
      <div class="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/40 transition space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.title)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(item.schoolTypeLabel)} · ${escapeHtml(item.savedAt)}</div>
          </div>
          <span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">${item.classCount} şube · ${item.teacherCount} öğr.</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" data-arch-load="${item.id}" class="m7-arch-load inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition"><i data-lucide="folder-open" class="w-3 h-3"></i> Projeyi Aç</button>
          <button type="button" data-arch-dl="${item.id}" class="m7-arch-dl inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition"><i data-lucide="download" class="w-3 h-3"></i> JSON İndir</button>
          <button type="button" data-arch-del="${item.id}" class="m7-arch-del ml-auto p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition" title="Arşivden sil"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.m7-arch-load').forEach((btn) => btn.addEventListener('click', () => {
      const item = loadProjectArchive().find((x) => x.id === btn.dataset.archLoad);
      if (!item || !item.snapshot) return;
      const loaded = JSON.parse(JSON.stringify(item.snapshot));
      ensureState(loaded);
      loaded.activeView = 'menu5';
      state = loaded;
      saveState(); renderAll(); showToast(`"${item.title}" projesi açıldı`);
    }));
    listEl.querySelectorAll('.m7-arch-dl').forEach((btn) => btn.addEventListener('click', () => {
      const item = loadProjectArchive().find((x) => x.id === btn.dataset.archDl);
      if (!item) return;
      const blob = new Blob([JSON.stringify({ project_title: item.title, saved_at: item.savedAt, app_state: item.snapshot }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${item.title.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g, '_')}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast(`"${item.title}" JSON indirildi`);
    }));
    listEl.querySelectorAll('.m7-arch-del').forEach((btn) => btn.addEventListener('click', () => {
      saveProjectArchive(loadProjectArchive().filter((x) => x.id !== btn.dataset.archDel));
      renderMenu7(); showToast('Kayıt arşivden silindi');
    }));
  }
  if (window.lucide) window.lucide.createIcons();
}

function syncFormInputs() {
  document.getElementById('inputSchoolName').value = state.school.name || '';
  document.getElementById('inputAcademicYear').value = state.school.academicYear;
  document.getElementById('inputCoordinator').value = state.school.coordinator || '';
  document.getElementById('inputStartTime').value = state.bell.startTime;
  document.getElementById('inputAfternoonStart').value = state.bell.afternoonStartTime;
  document.getElementById('inputLessonMin').value = state.bell.lessonDuration;
  document.getElementById('inputBreakMin').value = state.bell.breakDuration;
  document.getElementById('inputLongBreakAfter').value = String(state.bell.longBreakAfterPeriod);
  document.getElementById('inputLongBreakMin').value = state.bell.longBreakDuration;
  document.getElementById('inputLunchAfter').value = String(state.bell.lunchAfterPeriod);
  document.getElementById('inputLunchMin').value = state.bell.lunchDuration;
  document.getElementById('inputPeriodsPerDay').value = String(state.grid.periodsPerDay);
}

function renderViewVisibility() {
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById(`view-menu${i}`);
    if (el) el.classList.toggle('hidden', state.activeView !== `menu${i}`);
  }
}

function renderAll() {
  ensureState(state);
  renderSidebar();
  renderViewVisibility();
  syncFormInputs();
  renderMenu1();
  renderMenu2();
  renderMenu3();
  renderMenu4();
  renderMenu5();
  renderMenu6();
  renderMenu7();
  if (window.lucide) window.lucide.createIcons();
}

/* =========================================================================
   9. OLAY DİNLEYİCİLERİ VE ELECTRON KÖPRÜ BAŞLATMA
   ========================================================================= */
function openMobileSidebar() { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebarBackdrop').classList.remove('hidden'); }
function closeMobileSidebar() { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebarBackdrop').classList.add('hidden'); }

function openJsonModal() {
  document.getElementById('jsonPreviewContent').textContent = JSON.stringify(buildOrToolsConfig(), null, 2);
  const jm = document.getElementById('jsonModal'); jm.classList.remove('hidden'); jm.classList.add('flex');
}
function downloadJson() {
  const blob = new Blob([JSON.stringify({ app_state: state, or_tools_config: buildOrToolsConfig() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `ders_dagitim_${state.school.schoolTypeId}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Proje JSON yedeği indirildi');
}
function copyJsonToClipboard() {
  const text = JSON.stringify(buildOrToolsConfig(), null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('JSON panoya kopyalandı')).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('JSON panoya kopyalandı'); } catch (e) {}
  document.body.removeChild(ta);
}

function initDesktopBridge() {
  const api = window.dersDagitimAPI;
  if (!api) return;
  if (typeof api.onSolveProgress === 'function') {
    api.onSolveProgress((payload) => {
      if (!solverRunning || !payload) return;
      const lbl = document.getElementById('m5ProgressLabel');
      if (lbl && payload.message) lbl.textContent = payload.message;
      if (payload.type === 'live_snapshot' && Array.isArray(payload.placements)) {
        liveWatchSolution = {
          placements: payload.placements,
          placed_blocks: payload.placed_blocks || payload.placements.length,
          total_blocks: payload.total_blocks || payload.placements.length
        };
        const pct = Math.max(0, Math.min(100, Number(payload.percent || 0)));
        const pctEl = document.getElementById('m5ProgressPct');
        const barEl = document.getElementById('m5ProgressBarFill');
        const blkEl = document.getElementById('m5LiveBlocks');
        const solEl = document.getElementById('m5LiveSolutions');
        if (pctEl) pctEl.textContent = `%${Math.round(pct)}`;
        if (barEl) {
          barEl.classList.remove('animate-pulse');
          barEl.style.width = `${Math.max(5, pct)}%`;
        }
        if (blkEl) blkEl.textContent = `${liveWatchSolution.placed_blocks}/${liveWatchSolution.total_blocks} blok`;
        if (solEl && payload.solution_count) solEl.textContent = `Çözüm #${payload.solution_count}`;
        renderMenu5Templates();
      }
    });
  }
  document.querySelectorAll('.m5-live-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-live-tab');
      if (!tab) return;
      state.m5TplTab = tab;
      document.querySelectorAll('.m5-tpl-btn').forEach((b) => {
        const active = b.dataset.m5Tpl === tab;
        b.classList.toggle('bg-indigo-600', active);
        b.classList.toggle('text-white', active);
        b.classList.toggle('border-indigo-600', active);
      });
      renderMenu5Templates();
    });
  });
  if (typeof api.onExportProgress === 'function') {
    api.onExportProgress((payload) => {
      if (!payload) return;
      const lbl = document.getElementById('batchProgressLabel');
      const cnt = document.getElementById('batchProgressCount');
      const bar = document.getElementById('batchProgressBar');
      if (lbl) lbl.textContent = `Oluşturuluyor: ${payload.filename || ''}`;
      if (cnt) cnt.textContent = `${payload.current} / ${payload.total}`;
      if (bar && payload.total > 0) bar.style.width = `${Math.round((payload.current / payload.total) * 100)}%`;
    });
  }
  if (typeof api.getEngineInfo === 'function') {
    api.getEngineInfo().then((info) => {
      engineInfoState = {
        checked: true,
        available: Boolean(info && info.available),
        version: (info && info.ortools_version) || null,
        error: (info && info.error) || null
      };
      renderMenu5();
    }).catch((err) => {
      engineInfoState = { checked: true, available: false, version: null, error: err && err.message ? err.message : 'Bilinmeyen hata' };
      renderMenu5();
    });
  }
}

function bindEvents() {
  window.addEventListener('mouseup', () => {
    if (isPainting) { isPainting = false; const w = document.getElementById('matrixWrapper'); if (w) w.classList.remove('matrix-painting'); saveState(); renderMenu1(); }
    if (isTeacherPainting) { isTeacherPainting = false; saveState(); renderMenu3(); }
  });

  document.getElementById('mobileMenuBtn').addEventListener('click', openMobileSidebar);
  document.getElementById('closeSidebarBtn').addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebarBackdrop').addEventListener('click', closeMobileSidebar);

  // Menü 1
  document.getElementById('inputSchoolName').addEventListener('input', (e) => { state.school.name = e.target.value; saveState(); });
  document.getElementById('inputAcademicYear').addEventListener('input', (e) => { state.school.academicYear = e.target.value; saveState(); });
  document.getElementById('inputCoordinator').addEventListener('input', (e) => { state.school.coordinator = e.target.value; saveState(); });

  document.getElementById('btnShiftSingle').addEventListener('click', () => {
    state.school.shiftMode = 'single'; state.bell.startTime = '08:30'; state.bell.lunchAfterPeriod = state.grid.periodsPerDay >= 7 ? 4 : 0;
    saveState(); renderAll(); showToast('Tekli öğretim aktif');
  });
  document.getElementById('btnShiftDouble').addEventListener('click', () => {
    state.school.shiftMode = 'double'; state.bell.startTime = '07:30'; state.bell.afternoonStartTime = '13:00'; state.bell.lunchAfterPeriod = 0;
    saveState(); renderAll(); showToast('İkili öğretim aktif');
  });

  ['inputStartTime', 'inputAfternoonStart', 'inputLessonMin', 'inputBreakMin', 'inputLongBreakAfter', 'inputLongBreakMin', 'inputLunchAfter', 'inputLunchMin'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      state.bell.startTime = document.getElementById('inputStartTime').value || '08:30';
      state.bell.afternoonStartTime = document.getElementById('inputAfternoonStart').value || '13:00';
      state.bell.lessonDuration = Math.max(20, Math.min(90, Number(document.getElementById('inputLessonMin').value) || 40));
      state.bell.breakDuration = Math.max(0, Math.min(45, Number(document.getElementById('inputBreakMin').value) || 10));
      state.bell.longBreakAfterPeriod = Number(document.getElementById('inputLongBreakAfter').value) || 0;
      state.bell.longBreakDuration = Math.max(10, Math.min(45, Number(document.getElementById('inputLongBreakMin').value) || 15));
      state.bell.lunchAfterPeriod = Number(document.getElementById('inputLunchAfter').value) || 0;
      state.bell.lunchDuration = Math.max(10, Math.min(120, Number(document.getElementById('inputLunchMin').value) || 45));
      saveState(); renderMenu1();
    });
  });

  document.getElementById('inputPeriodsPerDay').addEventListener('change', (e) => {
    const p = Number(e.target.value) || 7; state.grid.periodsPerDay = p;
    for (let d = 0; d < 6; d++) { if (!state.grid.slots[d]) state.grid.slots[d] = []; while (state.grid.slots[d].length < p) state.grid.slots[d].push('ACTIVE'); }
    saveState(); renderAll();
  });

  document.querySelectorAll('.brush-btn').forEach((b) => b.addEventListener('click', () => { state.brushMode = b.dataset.brush; saveState(); renderMenu1(); }));
  document.getElementById('btnAllActive').addEventListener('click', () => { for (let d = 0; d < 6; d++) state.grid.slots[d] = Array(state.grid.periodsPerDay).fill('ACTIVE'); saveState(); renderMenu1(); });
  document.getElementById('btnApplyCommon3').addEventListener('click', () => {
    const td = state.grid.activeDays[2] ? 2 : state.grid.activeDays.findIndex(Boolean);
    if (td >= 0) {
      let m = 0; for (let p = state.grid.periodsPerDay - 1; p >= 0 && m < 3; p--) if ((state.grid.slots[td][p] || 'ACTIVE') !== 'BLOCKED') { state.grid.slots[td][p] = 'COMMON_ELECTIVE'; m++; }
      saveState(); renderMenu1(); showToast(DAY_NAMES[td] + ' 3 saat ortak seçmeli işaretlendi');
    }
  });
  document.getElementById('btnResetDefaults').addEventListener('click', () => { applySchoolTypeDefaults(state.school.schoolTypeId); showToast('Varsayılanlar yüklendi'); });

  // Toplu Şube Modalı
  const bulkCreateModal = document.getElementById('bulkCreateModal');
  const closeBulkCreate = () => { bulkCreateModal.classList.add('hidden'); bulkCreateModal.classList.remove('flex'); };
  document.getElementById('btnBulkCreateClasses').addEventListener('click', openBulkCreateModal);
  document.getElementById('btnCloseBulkCreate').addEventListener('click', closeBulkCreate);
  document.getElementById('btnCancelBulkCreate').addEventListener('click', closeBulkCreate);
  bulkCreateModal.addEventListener('click', (e) => { if (e.target === bulkCreateModal) closeBulkCreate(); });
  document.getElementById('btnBulkQuickAC').addEventListener('click', () => { getActiveGrades().forEach((g) => { bulkCreateSelection[g.key] = { enabled: true, letters: new Set(['A', 'B', 'C']) }; }); renderBulkCreateRows(); });
  document.getElementById('btnBulkQuickAD').addEventListener('click', () => { getActiveGrades().forEach((g) => { bulkCreateSelection[g.key] = { enabled: true, letters: new Set(['A', 'B', 'C', 'D']) }; }); renderBulkCreateRows(); });
  document.getElementById('btnBulkClearSel').addEventListener('click', () => { getActiveGrades().forEach((g) => { bulkCreateSelection[g.key] = { enabled: false, letters: new Set() }; }); renderBulkCreateRows(); });
  document.getElementById('btnSubmitBulkCreate').addEventListener('click', () => {
    const list = getCurrentClasses();
    const existingNames = new Set(list.map((c) => c.name.toUpperCase()));
    const students = Math.max(5, Math.min(60, Number(document.getElementById('bulkDefaultStudents').value) || 25));
    const shift = document.getElementById('bulkDefaultShift').value || 'morning';
    let created = 0;
    getActiveGrades().forEach((g) => {
      const sel = bulkCreateSelection[g.key];
      if (!sel || !sel.enabled) return;
      BULK_LETTERS.forEach((L) => {
        if (!sel.letters.has(L)) return;
        const name = g.key === 'H' ? `Haz-${L}` : `${g.key}/${L}`;
        if (existingNames.has(name.toUpperCase())) return;
        const newCls = { id: 'cls_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), gradeKey: g.key, section: L, name, studentCount: students, homeRoom: '', shift, courses: [] };
        list.push(newCls); existingNames.add(name.toUpperCase());
        if (!state.selectedClassId) state.selectedClassId = newCls.id;
        created++;
      });
    });
    if (created === 0) { showToast('Oluşturulacak yeni şube seçilmedi'); return; }
    state.gradeFilter = 'ALL'; saveState(); closeBulkCreate(); renderMenu2(); showToast(`${created} şube oluşturuldu`);
  });

  // Toplu Zorunlu Ders Modalı
  const bulkMandModal = document.getElementById('bulkMandModal');
  const closeBulkMand = () => { bulkMandModal.classList.add('hidden'); bulkMandModal.classList.remove('flex'); };
  document.getElementById('btnBulkAssignMand').addEventListener('click', openBulkMandModal);
  document.getElementById('btnCloseBulkMand').addEventListener('click', closeBulkMand);
  document.getElementById('btnCancelBulkMand').addEventListener('click', closeBulkMand);
  bulkMandModal.addEventListener('click', (e) => { if (e.target === bulkMandModal) closeBulkMand(); });
  document.getElementById('btnMandSelAll').addEventListener('click', () => { getCurrentClasses().forEach((c) => bulkMandSelection.add(c.id)); renderBulkMandList(); });
  document.getElementById('btnMandSelMissing').addEventListener('click', () => { bulkMandSelection = new Set(); getCurrentClasses().forEach((c) => { if (evaluateClass(c).mand.length === 0) bulkMandSelection.add(c.id); }); renderBulkMandList(); });
  document.getElementById('btnMandSelNone').addEventListener('click', () => { bulkMandSelection = new Set(); renderBulkMandList(); });
  document.getElementById('btnSubmitBulkMand').addEventListener('click', () => {
    if (bulkMandSelection.size === 0) { showToast('En az bir şube seçmelisiniz'); return; }
    let affectedClasses = 0, totalCoursesAdded = 0;
    getCurrentClasses().forEach((cls) => {
      if (!bulkMandSelection.has(cls.id)) return;
      const templates = getMebTemplatesForGrade(state.school.schoolTypeId, cls.gradeKey, 'mandatory');
      if (!cls.courses) cls.courses = [];
      let addedHere = 0;
      templates.forEach((t) => {
        if (!findDuplicateCourseInClass(cls, t.code, t.name)) {
          cls.courses.push({ ...t, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) });
          addedHere++;
        }
      });
      if (addedHere > 0) { affectedClasses++; totalCoursesAdded += addedHere; }
    });
    saveState(); closeBulkMand(); renderMenu2();
    showToast(affectedClasses > 0 ? `${affectedClasses} şubeye ${totalCoursesAdded} zorunlu ders atandı` : 'Zorunlu dersler zaten atanmış');
  });

  // Menü 2
  document.getElementById('btnAddClass').addEventListener('click', openAddClassModal);
  document.getElementById('gradeFilter').addEventListener('change', (e) => { state.gradeFilter = e.target.value; saveState(); renderMenu2(); });
  const addClassModal = document.getElementById('addClassModal');
  const closeAddClass = () => { addClassModal.classList.add('hidden'); addClassModal.classList.remove('flex'); };
  document.getElementById('btnCloseAddClass').addEventListener('click', closeAddClass);
  document.getElementById('btnCancelAddClass').addEventListener('click', closeAddClass);
  addClassModal.addEventListener('click', (e) => { if (e.target === addClassModal) closeAddClass(); });
  document.getElementById('formAddClass').addEventListener('submit', (e) => {
    e.preventDefault();
    const gradeKey = document.getElementById('newClassGrade').value;
    const sec = document.getElementById('newClassSection').value.trim().toUpperCase();
    const students = Math.max(5, Math.min(60, Number(document.getElementById('newClassStudents').value) || 25));
    const room = document.getElementById('newClassRoom').value.trim();
    const shift = document.getElementById('newClassShift').value || 'morning';
    if (!sec) return;
    const list = getCurrentClasses();
    const name = gradeKey === 'H' ? `Haz-${sec}` : `${gradeKey}/${sec}`;
    const newCls = { id: 'cls_' + Date.now(), gradeKey, section: sec, name, studentCount: students, homeRoom: room, shift, courses: [] };
    list.push(newCls); state.selectedClassId = newCls.id; state.gradeFilter = 'ALL';
    saveState(); closeAddClass(); renderMenu2(); showToast(`${name} şubesi oluşturuldu`);
  });

  // Seçmeli Havuzu Modalı
  const epModal = document.getElementById('electivePickerModal');
  const closeEp = () => { epModal.classList.add('hidden'); epModal.classList.remove('flex'); };
  document.getElementById('btnCloseEpModal').addEventListener('click', closeEp);
  document.getElementById('btnDoneEpModal').addEventListener('click', closeEp);
  epModal.addEventListener('click', (e) => { if (e.target === epModal) closeEp(); });
  document.getElementById('inputEpSearch').addEventListener('input', renderElectivePickerList);
  document.getElementById('btnEpCreateCustom').addEventListener('click', () => { closeEp(); openCourseModal(null, 'secmeli'); });

  // Ders & Çoklu Blok Modalı
  const cModal = document.getElementById('courseModal');
  const closeCm = () => { cModal.classList.add('hidden'); cModal.classList.remove('flex'); };
  document.getElementById('btnCloseCourseModal').addEventListener('click', closeCm);
  document.getElementById('btnCancelCourseModal').addEventListener('click', closeCm);
  cModal.addEventListener('click', (e) => { if (e.target === cModal) closeCm(); });
  document.getElementById('cmHours').addEventListener('input', renderModalBlocks);
  document.getElementById('cmBlockAuto').addEventListener('change', renderModalBlocks);
  document.querySelectorAll('.cm-add-blk').forEach((b) => b.addEventListener('click', () => { document.getElementById('cmBlockAuto').checked = false; modalDraftBlocks.push(Number(b.dataset.addBlk)); renderModalBlocks(); }));
  document.getElementById('btnCmClearBlocks').addEventListener('click', () => { document.getElementById('cmBlockAuto').checked = false; modalDraftBlocks = []; renderModalBlocks(); });
  document.getElementById('formCourseModal').addEventListener('submit', (e) => {
    e.preventDefault();
    const activeCls = getSelectedClass(); if (!activeCls) return;
    const editId = document.getElementById('editCourseId').value;
    const name = document.getElementById('cmName').value.trim();
    const code = document.getElementById('cmCode').value.trim().toUpperCase();
    const category = document.getElementById('cmCategory').value;
    const group = document.getElementById('cmGroup').value;
    let hours = Math.max(1, Math.min(20, Number(document.getElementById('cmHours').value) || 1));
    const isAuto = document.getElementById('cmBlockAuto').checked;
    const maxPerDay = Number(document.getElementById('cmMaxDay').value) || 1;
    const roomType = document.getElementById('cmRoom').value;
    const splitGroups = document.getElementById('cmSplitGroups').checked;
    const useCommonSlot = document.getElementById('cmUseCommon').checked;

    let finalBlocks = isAuto ? defaultBlocksForHours(hours) : [...modalDraftBlocks];
    if (!isAuto) {
      if (finalBlocks.length === 0) finalBlocks = defaultBlocksForHours(hours);
      const sum = finalBlocks.reduce((a, b) => a + b, 0);
      if (sum !== hours) hours = sum;
    }

    if (!activeCls.courses) activeCls.courses = [];
    const dupCourse = findDuplicateCourseInClass(activeCls, code, name, editId || null);
    if (dupCourse) {
      showToast(`${activeCls.name} şubesinde "${dupCourse.name}" dersi zaten tanımlı! Bir sınıfa aynı ders birden fazla kez verilemez.`);
      return;
    }
    if (editId) {
      const item = activeCls.courses.find((x) => x.id === editId);
      if (item) Object.assign(item, { name, code, category, group, hours, blocks: finalBlocks, blockMode: isAuto ? 'auto' : 'manual', maxPerDay, roomType, splitGroups, useCommonSlot });
      showToast(`${name} güncellendi`);
    } else {
      activeCls.courses.push({ id: 'c_' + Date.now(), name, code, category, group, hours, blocks: finalBlocks, blockMode: isAuto ? 'auto' : 'manual', maxPerDay, roomType, splitGroups, useCommonSlot });
      showToast(`${name} (${hours} sa) eklendi`);
    }
    saveState(); closeCm(); renderMenu2();
    if (state.activeView === 'menu4') renderMenu4();
  });

  // Menü Geçişleri
  document.getElementById('btnGoMenu2').addEventListener('click', () => { state.activeView = 'menu2'; saveState(); renderAll(); });
  document.getElementById('btnM2BackToMenu1').addEventListener('click', () => { state.activeView = 'menu1'; saveState(); renderAll(); });
  document.getElementById('btnGoMenu3Plan').addEventListener('click', () => { state.activeView = 'menu3'; saveState(); renderAll(); });
  document.getElementById('btnM3BackToMenu2').addEventListener('click', () => { state.activeView = 'menu2'; saveState(); renderAll(); });
  document.getElementById('btnGoMenu4Plan').addEventListener('click', () => { state.activeView = 'menu4'; saveState(); renderAll(); });
  document.getElementById('btnM4BackToMenu3').addEventListener('click', () => { state.activeView = 'menu3'; saveState(); renderAll(); });
  document.getElementById('btnGoMenu5Plan').addEventListener('click', () => { state.activeView = 'menu5'; saveState(); renderAll(); });
  document.getElementById('btnM5BackToMenu4').addEventListener('click', () => { state.activeView = 'menu4'; saveState(); renderAll(); });
  document.getElementById('btnGoMenu6Plan').addEventListener('click', () => { state.activeView = 'menu6'; saveState(); renderAll(); });
  document.getElementById('btnM6BackToMenu5').addEventListener('click', () => { state.activeView = 'menu5'; saveState(); renderAll(); });

  // Menü 3
  document.getElementById('btnAddTeacher').addEventListener('click', openTeacherModal);
  const btnManageClubs = document.getElementById('btnManageClubs');
  if (btnManageClubs) {
    btnManageClubs.addEventListener('click', () => {
      const panel = document.getElementById('m3ClubManagerPanel');
      if (!panel || !window.EvrakPlusClubs) return;
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        window.EvrakPlusClubs.renderClubManagerPanel(panel, state, (msg) => {
          saveState(); renderMenu3();
          if (msg) showToast(msg);
        });
      }
    });
  }
  document.getElementById('btnBulkTeachers').addEventListener('click', openBulkTeacherModal);
  document.getElementById('m3BranchFilter').addEventListener('change', (e) => { state.teacherBranchFilter = e.target.value; saveState(); renderMenu3(); });
  document.getElementById('m3TeacherSearch').addEventListener('input', (e) => { state.teacherSearch = e.target.value; renderMenu3(); });

  const tModal = document.getElementById('teacherModal');
  const closeTm = () => { tModal.classList.add('hidden'); tModal.classList.remove('flex'); };
  document.getElementById('btnCloseTeacherModal').addEventListener('click', closeTm);
  document.getElementById('btnCancelTeacherModal').addEventListener('click', closeTm);
  tModal.addEventListener('click', (e) => { if (e.target === tModal) closeTm(); });
  document.getElementById('tmBranch').addEventListener('change', (e) => { document.getElementById('tmCustomBranchWrap').classList.toggle('hidden', e.target.value !== '__CUSTOM__'); });
  document.getElementById('btnTmAllAvail').addEventListener('click', () => { modalDraftAvail = createDefaultAvailability(); renderModalAvailGrid(); });
  document.getElementById('formAddTeacher').addEventListener('submit', (e) => {
    e.preventDefault();
    let branch = document.getElementById('tmBranch').value;
    if (branch === '__CUSTOM__') {
      branch = document.getElementById('tmCustomBranch').value.trim();
      if (!branch) { showToast('Özel branş adını yazın'); return; }
    }
    const finalName = document.getElementById('tmName').value.trim() || generateFallbackTeacherName(branch);
    const roleVal = document.getElementById('tmRole') ? document.getElementById('tmRole').value : 'ogretmen';
    const extraRaw = document.getElementById('tmExtraSubjects') ? document.getElementById('tmExtraSubjects').value : '';
    const extraSubjects = String(extraRaw || '').split(',').map((s) => s.trim()).filter(Boolean);
    const isAdmin = roleVal === 'mudur' || roleVal === 'mudur_yardimcisi';
    const defaultDaily = state.grid.periodsPerDay || 7;
    const newT = {
      id: 'tch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      name: finalName, shortCode: makeTeacherShortCode(finalName), branch,
      role: roleVal,
      extraSubjects,
      minHours: Math.max(1, Math.min(40, Number(document.getElementById('tmMinHours').value) || 1)),
      maxHours: Math.max(1, Math.min(45, Number(document.getElementById('tmMaxHours').value) || 30)),
      maxDaily: Math.max(1, Math.min(12, Number(document.getElementById('tmMaxDaily').value) || defaultDaily)),
      dutyDay: isAdmin ? -1 : Number(document.getElementById('tmDutyDay').value),
      dutyLocation: '',
      availability: JSON.parse(JSON.stringify(modalDraftAvail))
    };
    getCurrentTeachers().push(newT);
    state.selectedTeacherId = newT.id; state.teacherBranchFilter = 'ALL';
    saveState(); closeTm(); renderMenu3(); showToast(`${finalName} eklendi`);
  });

  const btModal = document.getElementById('bulkTeacherModal');
  const closeBt = () => { btModal.classList.add('hidden'); btModal.classList.remove('flex'); };
  document.getElementById('btnCloseBulkTeacher').addEventListener('click', closeBt);
  document.getElementById('btnCancelBulkTeacher').addEventListener('click', closeBt);
  btModal.addEventListener('click', (e) => { if (e.target === btModal) closeBt(); });
  document.getElementById('btnSubmitBulkTeacher').addEventListener('click', () => {
    const list = getCurrentTeachers(); let added = 0;
    Object.entries(bulkTeacherCounts).forEach(([branch, count]) => {
      for (let i = 0; i < count; i++) {
        const name = generateFallbackTeacherName(branch);
        const newT = { id: 'tch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + i, name, shortCode: makeTeacherShortCode(name), branch, role: 'ogretmen', extraSubjects: [], minHours: 1, maxHours: 30, maxDaily: state.grid.periodsPerDay || 7, dutyDay: -1, dutyLocation: '', availability: createDefaultAvailability() };
        list.push(newT); if (!state.selectedTeacherId) state.selectedTeacherId = newT.id; added++;
      }
    });
    if (added === 0) { showToast('En az bir branş için sayı seçin'); return; }
    state.teacherBranchFilter = 'ALL'; saveState(); closeBt(); renderMenu3(); showToast(`${added} öğretmen oluşturuldu`);
  });

  // Menü 4
  document.querySelectorAll('.m4-ws-tab').forEach((btn) => btn.addEventListener('click', () => {
    window._m4ActiveTab = btn.dataset.m4Tab || 'assign';
    renderMenu4();
  }));
  document.getElementById('m4KpiUnassignedCard')?.addEventListener('click', () => {
    window._m4ActiveTab = 'assign';
    state.m4ClassFilter = 'ALL';
    state.m4Search = '';
    state.m4OnlyUnassigned = true;
    saveState(); renderMenu4();
  });
  document.getElementById('m4KpiLoadsCard')?.addEventListener('click', () => {
    window._m4ActiveTab = 'loads';
    renderMenu4();
  });
  document.getElementById('m4KpiRoomsCard')?.addEventListener('click', () => {
    window._m4ActiveTab = 'rooms';
    renderMenu4();
  });
  document.getElementById('btnM4ResetFilters')?.addEventListener('click', () => {
    state.m4ClassFilter = 'ALL'; state.m4OnlyUnassigned = false; state.m4Search = '';
    saveState(); renderMenu4();
  });
  document.getElementById('btnM4GlobalAddCourse')?.addEventListener('click', () => openM4TeacherAddCourseModal(''));
  document.getElementById('btnM4SuggestElectives')?.addEventListener('click', openM4ElectiveSuggestModal);

  const m4AddModal = document.getElementById('m4TeacherAddCourseModal');
  if (m4AddModal) {
    document.getElementById('btnCloseM4AddCourse')?.addEventListener('click', closeM4TeacherAddCourseModal);
    document.getElementById('btnCancelM4AddCourse')?.addEventListener('click', closeM4TeacherAddCourseModal);
    m4AddModal.addEventListener('click', (e) => { if (e.target === m4AddModal) closeM4TeacherAddCourseModal(); });
    document.querySelectorAll('.m4-add-mode-btn').forEach((b) => b.addEventListener('click', () => setM4AddCourseMode(b.dataset.m4AddMode)));
    document.getElementById('m4AddNewClassSel')?.addEventListener('change', populateM4AddNewTemplates);
    document.getElementById('m4AddNewTemplateSel')?.addEventListener('change', (e) => {
      const opt = e.target.selectedOptions && e.target.selectedOptions[0];
      if (!opt || !opt.dataset || !opt.dataset.name) return;
      document.getElementById('m4AddNewName').value = opt.dataset.name;
      document.getElementById('m4AddNewCode').value = opt.dataset.code || '';
      document.getElementById('m4AddNewCategory').value = opt.dataset.cat || 'secmeli';
      document.getElementById('m4AddNewHours').value = opt.dataset.hrs || '2';
    });
    document.getElementById('btnSubmitM4AddCourse')?.addEventListener('click', submitM4TeacherAddCourse);
  }
  const m4SugModal = document.getElementById('m4ElectiveSuggestModal');
  if (m4SugModal) {
    document.getElementById('btnCloseM4Suggest')?.addEventListener('click', closeM4ElectiveSuggestModal);
    document.getElementById('btnCancelM4Suggest')?.addEventListener('click', closeM4ElectiveSuggestModal);
    m4SugModal.addEventListener('click', (e) => { if (e.target === m4SugModal) closeM4ElectiveSuggestModal(); });
    document.getElementById('btnConfirmM4Suggest')?.addEventListener('click', confirmM4ElectiveSuggestions);
  }

  document.getElementById('m4ClassFilter').addEventListener('change', (e) => { state.m4ClassFilter = e.target.value; saveState(); renderMenu4(); });
  document.getElementById('m4OnlyUnassigned').addEventListener('change', (e) => { state.m4OnlyUnassigned = e.target.checked; saveState(); renderMenu4(); });
  document.getElementById('m4Search').addEventListener('input', (e) => { state.m4Search = e.target.value; saveState(); renderMenu4(); });
  const m4LoadSearchEl = document.getElementById('m4LoadSearch');
  if (m4LoadSearchEl) {
    m4LoadSearchEl.addEventListener('input', (e) => { m4LoadSearchText = e.target.value; renderMenu4(); });
  }
  document.querySelectorAll('.m4-lf-btn').forEach((btn) => btn.addEventListener('click', () => {
    m4LoadFilterMode = btn.dataset.loadFilter || 'ALL';
    document.querySelectorAll('.m4-lf-btn').forEach((b) => {
      const act = b.dataset.loadFilter === m4LoadFilterMode;
      b.className = `m4-lf-btn px-2 py-1 rounded-md text-[10px] font-semibold transition ${act ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
    });
    renderMenu4();
  }));
  const m4TrModal = document.getElementById('m4TransferModal');
  if (m4TrModal) {
    document.getElementById('btnCloseM4Transfer')?.addEventListener('click', closeM4TransferModal);
    document.getElementById('btnCancelM4Transfer')?.addEventListener('click', closeM4TransferModal);
    m4TrModal.addEventListener('click', (e) => { if (e.target === m4TrModal) closeM4TransferModal(); });
    document.getElementById('m4TransferTargetSelect')?.addEventListener('change', updateM4TransferPreview);
    document.getElementById('btnConfirmM4Transfer')?.addEventListener('click', () => executeM4Transfer(false));
    document.getElementById('btnM4TransferUnassign')?.addEventListener('click', () => executeM4Transfer(true));
  }
  document.getElementById('btnM4AutoMatch').addEventListener('click', () => {
    const teachers = getCurrentTeachers(), classes = getCurrentClasses();
    if (!teachers.length || !classes.length) { showToast('Önce şube, ders ve öğretmen oluşturun'); return; }
    const loadMap = computeTeacherLoads(); let assigned = 0;
    classes.forEach((cls) => (cls.courses || []).forEach((c) => {
      if (!c.teacherId) {
        const candidates = teachers.filter((t) => isBranchMatchingCourse(t.branch, c.name)).sort((a, b) => loadMap[a.id].totalHours - loadMap[b.id].totalHours);
        const pick = candidates.find((t) => loadMap[t.id].totalHours + c.hours <= t.maxHours) || candidates[0];
        if (pick) { c.teacherId = pick.id; loadMap[pick.id].totalHours += Number(c.hours) || 0; assigned++; }
      }
    }));
    saveState(); renderMenu4(); showToast(assigned > 0 ? `${assigned} ders branşlarına göre dağıtıldı` : 'Eşleşen boş ders bulunamadı');
  });
  const btnExtraMatch = document.getElementById('btnM4AutoMatchExtra');
  if (btnExtraMatch) {
    btnExtraMatch.addEventListener('click', () => {
      const teachers = getCurrentTeachers(), classes = getCurrentClasses();
      if (!teachers.length || !classes.length) { showToast('Önce şube, ders ve öğretmen oluşturun'); return; }
      const loadMap = computeTeacherLoads(); let assigned = 0;
      classes.forEach((cls) => (cls.courses || []).forEach((c) => {
        if (!c.teacherId) {
          const candidates = teachers
            .filter((t) => window.DersDutyModule && window.DersDutyModule.doesTeacherExtraMatchCourse(t, c.name, c.code))
            .sort((a, b) => loadMap[a.id].totalHours - loadMap[b.id].totalHours);
          const pick = candidates.find((t) => loadMap[t.id].totalHours + Number(c.hours || 0) <= Number(t.maxHours || 30)) || candidates[0];
          if (pick) {
            c.teacherId = pick.id;
            loadMap[pick.id].totalHours += Number(c.hours || 0);
            assigned++;
          }
        }
      }));
      saveState(); renderMenu4();
      showToast(assigned > 0 ? `${assigned} boş ders öğretmenlerin ekstra okutabileceği derslere göre dağıtıldı` : 'Ekstra ders tanımlı uygun boş ders bulunamadı');
    });
  }
  document.getElementById('btnM4ClearAssign').addEventListener('click', () => {
    getCurrentClasses().forEach((cls) => (cls.courses || []).forEach((c) => { c.teacherId = null; c.teacherId2 = null; c.assignedRoomId = null; }));
    saveState(); renderMenu4(); showToast('Tüm ders atamaları temizlendi');
  });
  const rModal = document.getElementById('roomModal');
  const closeRm = () => { rModal.classList.add('hidden'); rModal.classList.remove('flex'); };
  document.getElementById('btnM4AddRoom').addEventListener('click', openRoomModal);
  document.getElementById('btnM4AddRoomSmall').addEventListener('click', openRoomModal);
  document.getElementById('btnCloseRoomModal').addEventListener('click', closeRm);
  document.getElementById('btnCancelRoomModal').addEventListener('click', closeRm);
  rModal.addEventListener('click', (e) => { if (e.target === rModal) closeRm(); });
  document.getElementById('formAddRoom').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('rmName').value.trim(); if (!name) return;
    getCurrentRooms().push({ id: 'rm_' + Date.now(), name, roomType: document.getElementById('rmType').value, capacity: Math.max(1, Math.min(5, Number(document.getElementById('rmCap').value) || 1)) });
    saveState(); closeRm(); renderMenu4(); showToast(`${name} mekanı eklendi`);
  });

  // Menü 5
  document.getElementById('m5Preference').addEventListener('change', (e) => { state.distributionPreference = e.target.value; saveState(); });
  document.getElementById('btnM5RunSolver').addEventListener('click', () => startOrToolsSolver(true, false));
  const btnMax = document.getElementById('btnM5MaximizeSolve');
  if (btnMax) btnMax.addEventListener('click', () => startOrToolsSolver(true, false, { mode: 'maximize_placement' }));
  document.getElementById('btnM5StopSolver').addEventListener('click', () => stopOrToolsSolver(true));
  document.getElementById('btnM5RestartSolver').addEventListener('click', () => { if (solverRunning) stopOrToolsSolver(false); startOrToolsSolver(false, false); });
  document.getElementById('btnM5PlaceUnplaced').addEventListener('click', placeUnplacedBlocks);
  document.getElementById('btnM5RepairMinChanges').addEventListener('click', () => {
    if (!state.solution || !Array.isArray(state.solution.placements) || !state.solution.placements.length) {
      showToast('Önce dağıtılmış bir ders programı olmalıdır.'); return;
    }
    startOrToolsSolver(true, false, { mode: 'repair_min_changes', preview: true });
  });
  document.getElementById('btnM5AuditSchedule').addEventListener('click', () => runScheduleAudit('m5AuditPanel'));
  const btnM6Audit = document.getElementById('btnM6AuditSchedule');
  if (btnM6Audit) btnM6Audit.addEventListener('click', () => runScheduleAudit('m6AuditPanel'));
  document.querySelectorAll('.m5-tpl-btn').forEach((btn) => btn.addEventListener('click', () => { state.m5TplTab = btn.dataset.m5Tpl; state.m5EntityId = ''; saveState(); renderMenu5Templates(); }));

  const cam = document.getElementById('cellActionModal');
  const closeCam = () => { cam.classList.add('hidden'); cam.classList.remove('flex'); activeCamPlacement = null; };
  document.getElementById('btnCloseCam').addEventListener('click', closeCam);
  cam.addEventListener('click', (e) => { if (e.target === cam) closeCam(); });

  document.getElementById('btnCamStartMove').addEventListener('click', () => {
    if (!activeCamPlacement) return;
    const lockInfo = window.DersEditorLogic.isPlacementLocked(activeCamPlacement, state.pinnedPlacementIds, state.lockedTeacherIds);
    if (lockInfo.locked) { showToast(lockInfo.reason); return; }
    const k = getPlacementKey(activeCamPlacement);
    const cid = activeCamPlacement.class_id;
    closeCam();
    state.activeView = 'menu6';
    if (state.m6Tab !== 'class' && state.m6Tab !== 'teacher') { state.m6Tab = 'class'; state.m6EntityId = cid; }
    m6SwapSourceKey = null;
    m6SelectedMoveKey = k;
    saveState(); renderAll();
  });

  document.getElementById('btnCamStartSwap').addEventListener('click', () => {
    if (!activeCamPlacement) return;
    const lockInfo = window.DersEditorLogic.isPlacementLocked(activeCamPlacement, state.pinnedPlacementIds, state.lockedTeacherIds);
    if (lockInfo.locked) { showToast(lockInfo.reason); return; }
    const k = getPlacementKey(activeCamPlacement);
    const cid = activeCamPlacement.class_id;
    closeCam();
    state.activeView = 'menu6';
    if (state.m6Tab !== 'class' && state.m6Tab !== 'teacher') { state.m6Tab = 'class'; state.m6EntityId = cid; }
    m6SelectedMoveKey = null;
    m6SwapSourceKey = k;
    saveState(); renderAll();
  });

  document.getElementById('btnCamSaveTeacher').addEventListener('click', () => {
    if (!activeCamPlacement) return;
    const newTid = document.getElementById('camTeacherSelect').value || '';
    const pl = activeCamPlacement;
    if (newTid) {
      const candidate = { ...pl, teacher_ids: [newTid] };
      const err = validateManualPlacement(candidate, pl);
      if (err) { showToast(err); return; }
    }
    editorHistory.push(state);
    pl.teacher_ids = newTid ? [newTid] : [];
    (state.solution.placements || []).forEach((o) => { if (o.assignment_id === pl.assignment_id) o.teacher_ids = newTid ? [newTid] : []; });
    const cls = getCurrentClasses().find((c) => c.id === pl.class_id);
    const crs = cls && (cls.courses || []).find((x) => x.id === pl.course_id);
    if (crs) crs.teacherId = newTid || null;
    saveState(); updateUndoRedoButtons(); closeCam(); renderMenu4(); renderMenu5(); renderMenu6(); showToast('Dersin öğretmeni güncellendi');
  });
  document.getElementById('btnCamTogglePin').addEventListener('click', () => {
    if (!activeCamPlacement) return;
    editorHistory.push(state);
    const k = getPlacementKey(activeCamPlacement);
    const idx = state.pinnedPlacementIds.indexOf(k);
    if (idx >= 0) { state.pinnedPlacementIds.splice(idx, 1); showToast('Ders kilidi kaldırıldı'); }
    else { state.pinnedPlacementIds.push(k); showToast('Ders kilitlendi'); }
    saveState(); updateUndoRedoButtons(); closeCam(); renderMenu5(); renderMenu6();
  });
  document.getElementById('btnCamToggleTeacherLock').addEventListener('click', () => {
    if (!activeCamPlacement) return;
    editorHistory.push(state);
    const tid = (activeCamPlacement.teacher_ids && activeCamPlacement.teacher_ids[0]) || '';
    if (tid) toggleTeacherLock(tid);
    updateUndoRedoButtons();
    closeCam();
  });
  document.getElementById('btnCamRemoveLesson').addEventListener('click', () => {
    if (!activeCamPlacement || !state.solution) return;
    const pl = activeCamPlacement;
    const lockInfo = window.DersEditorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds);
    if (lockInfo.locked) { showToast(lockInfo.reason); return; }
    editorHistory.push(state);
    state.solution.placements = state.solution.placements.filter((o) => o !== pl);
    if (!Array.isArray(state.solution.unplaced)) state.solution.unplaced = [];
    state.solution.unplaced.push({
      block_id: getPlacementKey(pl),
      assignment_id: pl.assignment_id, block_index: pl.block_index,
      class_id: pl.class_id, class_name: pl.class_name,
      course_id: pl.course_id, course_code: pl.course_code, course_name: pl.course_name,
      teacher_ids: pl.teacher_ids || [], room_id: pl.room_id || null, length: pl.length
    });
    state.solution.placed_blocks = state.solution.placements.length;
    state.solution.status = 'PARTIAL';
    saveState(); updateUndoRedoButtons(); closeCam(); renderMenu5(); renderMenu6();
    showToast(`${pl.class_name} ${pl.course_code} programdan kaldırıldı`);
  });

  const mpm = document.getElementById('manualPlaceModal');
  const closeMpm = () => { mpm.classList.add('hidden'); mpm.classList.remove('flex'); };
  document.getElementById('btnCloseMpm').addEventListener('click', closeMpm);
  mpm.addEventListener('click', (e) => { if (e.target === mpm) closeMpm(); });

  document.getElementById('btnM5ClearSolution').addEventListener('click', () => {
    if (solverRunning) stopOrToolsSolver(false);
    state.solution = null; state.lastSolveError = null; state.pinnedPlacementIds = [];
    saveState(); renderMenu5(); renderMenu6(); showToast('Mevcut ders dağıtımı temizlendi');
  });

  // Menü 6
  document.getElementById('btnM6Undo').addEventListener('click', () => {
    if (editorHistory.undo(state)) {
      m6SelectedMoveKey = null; m6SwapSourceKey = null;
      saveState(); updateUndoRedoButtons(); renderMenu5(); renderMenu6();
      showToast('Son işlem geri alındı');
    }
  });
  document.getElementById('btnM6Redo').addEventListener('click', () => {
    if (editorHistory.redo(state)) {
      m6SelectedMoveKey = null; m6SwapSourceKey = null;
      saveState(); updateUndoRedoButtons(); renderMenu5(); renderMenu6();
      showToast('İşlem ileri alındı');
    }
  });
  document.getElementById('btnM6RedistEntity').addEventListener('click', () => {
    if (state.m6Tab === 'class' && state.m6EntityId && state.m6EntityId !== 'ALL') {
      startOrToolsSolver(true, false, { type: 'class', id: state.m6EntityId, preview: true });
    } else if (state.m6Tab === 'teacher' && state.m6EntityId && state.m6EntityId !== 'ALL') {
      startOrToolsSolver(true, false, { type: 'teacher', id: state.m6EntityId, preview: true });
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      if (state.activeView === 'menu6' && editorHistory.canUndo()) {
        e.preventDefault();
        document.getElementById('btnM6Undo').click();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      if (state.activeView === 'menu6' && editorHistory.canRedo()) {
        e.preventDefault();
        document.getElementById('btnM6Redo').click();
      }
    }
  });

  // Takas Modalı Olayları
  const swapModal = document.getElementById('swapModal');
  const closeSwap = () => { swapModal.classList.add('hidden'); swapModal.classList.remove('flex'); pendingSwapPair = null; };
  document.getElementById('btnCloseSwapModal').addEventListener('click', closeSwap);
  document.getElementById('btnCancelSwap').addEventListener('click', closeSwap);
  swapModal.addEventListener('click', (e) => { if (e.target === swapModal) closeSwap(); });
  document.getElementById('btnConfirmSwap').addEventListener('click', () => {
    if (!pendingSwapPair) return;
    const { plA, plB } = pendingSwapPair;
    const check = window.DersEditorLogic.validateDirectSwap(state, plA, plB, getEditorHelpers());
    if (!check.valid) { showToast(check.error); return; }
    editorHistory.push(state);
    const tmpD = plA.day_index, tmpP = plA.start_period;
    plA.day_index = plB.day_index; plA.start_period = plB.start_period;
    plB.day_index = tmpD; plB.start_period = tmpP;
    saveState(); updateUndoRedoButtons(); closeSwap(); renderMenu5(); renderMenu6();
    showToast(`${plA.course_code} ile ${plB.course_code} yer değiştirildi`);
  });
  document.getElementById('btnSwapAskOrTools').addEventListener('click', () => {
    if (!pendingSwapPair) return;
    const { plA, plB } = pendingSwapPair;
    // Kullanıcının istediği hedefe plA'yı sabitleyip OR-Tools ile en az değişiklikle çözüm ara
    const desiredFixed = { ...plA, day_index: plB.day_index, start_period: plB.start_period };
    closeSwap();
    startOrToolsSolver(true, false, { mode: 'repair_min_changes', preview: true, extraFixed: [desiredFixed] });
  });

  // Değişiklik Önizleme Modalı Olayları
  const previewModal = document.getElementById('previewModal');
  const closePreview = () => { previewModal.classList.add('hidden'); previewModal.classList.remove('flex'); pendingPreviewResult = null; };
  document.getElementById('btnClosePreviewModal').addEventListener('click', closePreview);
  document.getElementById('btnDiscardPreview').addEventListener('click', () => { closePreview(); showToast('Değişiklikler iptal edildi, eski program korundu'); });
  previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closePreview(); });
  document.getElementById('btnApplyPreview').addEventListener('click', () => {
    if (!pendingPreviewResult) return;
    editorHistory.push(state);
    state.solution = pendingPreviewResult.result;
    state.lastSolveError = null;
    saveState(); updateUndoRedoButtons(); closePreview(); renderMenu5(); renderMenu6();
    showToast('Dağıtım değişiklikleri uygulandı');
  });

  // Tüm Kilitleri Kaldır Onay Modalı Olayları
  const unlockModal = document.getElementById('confirmUnlockAllModal');
  const closeUnlock = () => { unlockModal.classList.add('hidden'); unlockModal.classList.remove('flex'); };
  document.getElementById('btnCloseUnlockAll').addEventListener('click', closeUnlock);
  document.getElementById('btnCancelUnlockAll').addEventListener('click', closeUnlock);
  unlockModal.addEventListener('click', (e) => { if (e.target === unlockModal) closeUnlock(); });
  document.getElementById('btnConfirmUnlockAll').addEventListener('click', () => {
    editorHistory.push(state);
    state.pinnedPlacementIds = [];
    state.lockedTeacherIds = [];
    saveState(); updateUndoRedoButtons(); closeUnlock(); renderMenu5(); renderMenu6();
    showToast('Tüm ders ve öğretmen kilitleri kaldırıldı');
  });

  document.getElementById('btnM6CreatePdf').addEventListener('click', () => openExportPreviewModal());
  document.getElementById('btnM6OpenPreview').addEventListener('click', () => openExportPreviewModal());
  document.getElementById('btnM6BatchExport').addEventListener('click', openBatchExportModal);
  document.getElementById('btnM6OpenReports').addEventListener('click', () => {
    state.m6Tab = 'report';
    m6SelectedMoveKey = null;
    m6SwapSourceKey = null;
    saveState(); renderMenu6();
  });
  document.getElementById('btnM6Print').addEventListener('click', () => {
    const gate = checkCentralExportGate('print');
    if (!gate) return;
    openExportPreviewModal();
    setTimeout(() => printCurrentPreviewDoc(), 200);
  });
  document.getElementById('btnM6ExportXlsx').addEventListener('click', exportTimetableXlsx);

  // Canlı Çıktı Önizleme Modalı Olayları
  const epvModal = document.getElementById('exportPreviewModal');
  const closeEpv = () => { epvModal.classList.add('hidden'); epvModal.classList.remove('flex'); };
  document.getElementById('btnCloseExportPreview').addEventListener('click', closeEpv);
  epvModal.addEventListener('click', (e) => { if (e.target === epvModal) closeEpv(); });
  document.getElementById('epvDocType').addEventListener('change', () => {
    populateExportPreviewEntityOptions();
    refreshExportPreviewFrame();
  });
  ['epvEntitySelect', 'epvPageSize', 'epvOrientation', 'epvFontSize', 'epvTeacherDisplay', 'epvColorMode', 'epvShowSignatures', 'epvShowDate', 'epvSplitA4', 'epvShowLogo'].forEach((id) => {
    document.getElementById(id).addEventListener('change', refreshExportPreviewFrame);
  });
  ['epvCoordinator', 'epvPrincipal', 'epvCustomTitle', 'epvFooterText'].forEach((id) => {
    document.getElementById(id).addEventListener('input', refreshExportPreviewFrame);
  });
  document.getElementById('epvLogoFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      ensureState(state);
      state.exportSettings.logoDataUrl = ev.target.result;
      state.exportSettings.showLogo = true;
      document.getElementById('epvShowLogo').checked = true;
      saveState();
      refreshExportPreviewFrame();
      showToast('Okul logosu yüklendi');
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });
  document.getElementById('btnEpvSavePdf').addEventListener('click', saveCurrentPreviewAsPdf);
  document.getElementById('btnEpvPrintNow').addEventListener('click', printCurrentPreviewDoc);

  // Toplu Çıktı Modalı Olayları
  const batchModal = document.getElementById('batchExportModal');
  const closeBatch = () => { batchModal.classList.add('hidden'); batchModal.classList.remove('flex'); };
  document.getElementById('btnCloseBatchModal').addEventListener('click', closeBatch);
  document.getElementById('btnCancelBatchModal').addEventListener('click', closeBatch);
  batchModal.addEventListener('click', (e) => { if (e.target === batchModal) closeBatch(); });
  document.getElementById('batchScopeSelect').addEventListener('change', () => {
    batchSelectedIds = new Set();
    renderBatchPicker();
  });
  document.getElementById('btnBatchSelectAll').addEventListener('click', () => {
    const scope = document.getElementById('batchScopeSelect').value;
    const list = scope === 'selected_classes' ? getCurrentClasses() : getCurrentTeachers();
    list.forEach((it) => batchSelectedIds.add(it.id));
    renderBatchPicker();
  });
  document.getElementById('btnBatchSelectNone').addEventListener('click', () => {
    batchSelectedIds = new Set();
    renderBatchPicker();
  });
  document.getElementById('btnRunBatchExport').addEventListener('click', runBatchExport);
  document.getElementById('btnM6ExportCsv').addEventListener('click', exportTimetableCsv);
  document.getElementById('btnM6DownloadSol').addEventListener('click', () => {
    if (!state.solution) { showToast('Henüz çözüm yok'); return; }
    const blob = new Blob([JSON.stringify(state.solution, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'solution.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('solution.json indirildi');
  });
  document.querySelectorAll('.m6-tab-btn').forEach((btn) => btn.addEventListener('click', () => { state.m6Tab = btn.dataset.m6Tab; state.m6EntityId = 'ALL'; m6SelectedMoveKey = null; saveState(); renderMenu6(); }));
  document.getElementById('m6EntitySelect').addEventListener('change', (e) => { state.m6EntityId = e.target.value; m6SelectedMoveKey = null; saveState(); renderMenu6(); });

  // Menü 7
  document.getElementById('btnM7SaveProject').addEventListener('click', () => {
    const titleInp = document.getElementById('m7ProjectTitle');
    const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId];
    const title = titleInp.value.trim() || `${state.school.name || meta.shortName} (${new Date().toLocaleDateString('tr-TR')})`;
    const archive = loadProjectArchive();
    archive.unshift({ id: 'proj_' + Date.now(), title, schoolTypeLabel: meta.name, classCount: getCurrentClasses().length, teacherCount: getCurrentTeachers().length, savedAt: new Date().toLocaleString('tr-TR'), snapshot: JSON.parse(JSON.stringify(state)) });
    saveProjectArchive(archive); titleInp.value = ''; renderMenu7(); showToast(`"${title}" proje arşivine kaydedildi`);
    if (window.SystemUI && typeof window.SystemUI.triggerAutoBackup === 'function') {
      window.SystemUI.triggerAutoBackup(state, title);
    }
  });
  document.getElementById('btnM7DownloadFullJson').addEventListener('click', downloadJson);
  document.getElementById('btnM7ViewOrToolsJson').addEventListener('click', openJsonModal);
  document.getElementById('inputM7UploadJson').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => handleSmartJsonImport(ev.target.result); r.readAsText(f); e.target.value = '';
  });
  const dropZone = document.getElementById('m7DropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-indigo-500', 'bg-indigo-50/60'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/60'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/60');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => handleSmartJsonImport(ev.target.result); r.readAsText(f);
  });

  const npModal = document.getElementById('newProjectModal');
  const closeNp = () => { npModal.classList.add('hidden'); npModal.classList.remove('flex'); };
  document.getElementById('btnM7NewProject').addEventListener('click', () => { npModal.classList.remove('hidden'); npModal.classList.add('flex'); });
  document.getElementById('btnCloseNewProj').addEventListener('click', closeNp);
  document.getElementById('btnCancelNewProj').addEventListener('click', closeNp);
  npModal.addEventListener('click', (e) => { if (e.target === npModal) closeNp(); });
  document.getElementById('btnConfirmNewProj').addEventListener('click', () => {
    if (solverRunning) stopOrToolsSolver(false);
    state = createInitialState(state.school.schoolTypeId); state.activeView = 'menu1';
    saveState(); closeNp(); renderAll(); showToast('Yeni boş proje başlatıldı');
  });

  // JSON Modal & Sidebar
  const jm = document.getElementById('jsonModal');
  document.getElementById('btnCloseJsonModal').addEventListener('click', () => { jm.classList.add('hidden'); jm.classList.remove('flex'); });
  jm.addEventListener('click', (e) => { if (e.target === jm) { jm.classList.add('hidden'); jm.classList.remove('flex'); } });
  document.getElementById('btnCopyJson').addEventListener('click', copyJsonToClipboard);
  document.getElementById('btnDownloadJsonModal').addEventListener('click', downloadJson);
  document.getElementById('btnExportJsonSide').addEventListener('click', downloadJson);
  document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => handleSmartJsonImport(ev.target.result); r.readAsText(f); e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  renderAll();
  initDesktopBridge();
  if (window.EvrakPlusUI && typeof window.EvrakPlusUI.init === 'function') {
    window.EvrakPlusUI.init({
      getState: () => state,
      saveState: (opts) => saveState(opts),
      showToast: (msg) => showToast(msg),
      saveToLocalArchive: (title, snapshot) => {
        const archive = loadProjectArchive();
        const meta = MEB_SCHOOL_TYPES[state.school.schoolTypeId] || { name: 'Okul' };
        archive.unshift({
          id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title,
          schoolTypeLabel: meta.name,
          classCount: getCurrentClasses().length,
          teacherCount: getCurrentTeachers().length,
          savedAt: new Date().toLocaleString('tr-TR'),
          snapshot
        });
        saveProjectArchive(archive);
        renderMenu7();
      },
      loadExternalState: (loaded) => {
        if (!loaded || typeof loaded !== 'object') return;
        state = normalizeState(loaded);
        saveState({ skipAutoSync: true });
        renderAll();
        if (window.EvrakPlusUI) window.EvrakPlusUI.refreshSidebar();
      }
    });
  }
  if (window.SystemUI && typeof window.SystemUI.init === 'function') {
    window.SystemUI.init({
      getState: () => state,
      saveState: () => saveState(),
      showToast: (msg) => showToast(msg),
      loadExternalState: (loaded) => {
        if (!loaded || typeof loaded !== 'object') return;
        state = normalizeState(loaded);
        saveState();
        renderAll();
        if (window.EvrakPlusUI) window.EvrakPlusUI.refreshSidebar();
      }
    });
  }
  if (window.EvrakPlusPWA && typeof window.EvrakPlusPWA.init === 'function') {
    window.EvrakPlusPWA.init({
      showToast: (msg) => showToast(msg),
      navigateMobile: (target) => {
        if (target === 'duty') {
          state.activeView = 'menu6';
          state.m6Tab = 'duty';
        } else {
          state.activeView = target;
          if (target === 'menu6' && state.m6Tab === 'duty') state.m6Tab = 'class';
        }
        saveState();
        renderAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    window.EvrakPlusPWA.syncBottomNavActive(state.activeView, state.m6Tab);
  }
});
