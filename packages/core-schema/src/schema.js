import crypto from 'node:crypto';
import {
  SCHEMA_VERSION,
  APP_VERSION,
  ConstraintLevel,
  DEFAULT_CONSTRAINT_WEIGHTS,
  EducationMode,
  ShiftType,
  RoomType,
  parseBlockPattern
} from './constants.js';

export function newUuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeEntityMeta(overrides = {}) {
  return {
    id: overrides.id || newUuid(),
    revision: Number.isInteger(overrides.revision) ? overrides.revision : 1,
    updatedAt: overrides.updatedAt || nowIso(),
    deletedAt: overrides.deletedAt ?? null
  };
}

/**
 * 4 seviyeli kısıt oluşturucu.
 * Desteklenen kural tipleri:
 * - Öğretmen: teacher_no_conflict, teacher_closed_slot, teacher_weekly_hours, teacher_daily_hours,
 *   teacher_max_consecutive, teacher_max_daily_gaps, teacher_max_weekly_gaps, teacher_preferred_days,
 *   teacher_avoid_days, teacher_first_last_pref, teacher_compact_days, teacher_building_transition,
 *   teacher_max_daily_building_changes, teacher_max_weekly_building_changes, teacher_class_limit
 * - Sınıf/Şube: class_no_conflict, class_closed_slot, class_daily_hours, class_max_daily_gaps,
 *   class_max_weekly_gaps, class_balanced_days, class_no_subject_cluster, parallel_group_sync
 * - Ders/Blok: block_consecutive, subject_diff_days, subject_forbid_periods, subject_pair_diff_day,
 *   block_no_across_lunch, subject_min_day_gap, subject_preferred_periods
 * - Derslik/Bina: room_no_conflict, room_capacity, room_type_match, class_home_room
 */
export function createConstraint({
  id,
  type,
  level = ConstraintLevel.HARD,
  weight,
  enabled = true,
  params = {},
  description = ''
}) {
  const validLevel = Object.values(ConstraintLevel).includes(level)
    ? level
    : ConstraintLevel.NORMAL;
  return {
    ...makeEntityMeta({ id }),
    type,
    level: validLevel,
    weight: typeof weight === 'number' ? weight : DEFAULT_CONSTRAINT_WEIGHTS[validLevel],
    enabled: Boolean(enabled),
    params,
    description
  };
}

/** Yeni boş EvrakPlus Ders Dağıtım Multi Plus v3 projesi */
export function createBlankProject(overrides = {}) {
  const projectId = overrides.id || newUuid();
  const mainBuildingId = newUuid();
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    id: projectId,
    revision: 1,
    updatedAt: nowIso(),
    school: {
      name: 'Yeni Okul',
      institutionCode: '',
      year: '2026-2027',
      term: '1. Dönem',
      termStart: '',
      termEnd: '',
      schoolType: 'ortaokul',
      educationMode: EducationMode.FULL_DAY,
      principal: '',
      vicePrincipals: [],
      daysPerWeek: 5,
      periodsPerDay: 7,
      bellSchedule: {
        full: { start: '08:30', lessonMinutes: 40, breakMinutes: 10, lunchAfterPeriod: 5, lunchMinutes: 40 },
        morning: { start: '07:30', lessonMinutes: 40, breakMinutes: 10, lunchAfterPeriod: 0, lunchMinutes: 0 },
        afternoon: { start: '13:00', lessonMinutes: 40, breakMinutes: 10, lunchAfterPeriod: 0, lunchMinutes: 0 }
      },
      customPeriods: [],
      logoDataUrl: '',
      ...(overrides.school || {})
    },
    buildings: [
      {
        ...makeEntityMeta({ id: mainBuildingId }),
        name: 'Ana Bina',
        code: 'B1',
        transitionPeriods: {} // { [otherBuildingId]: minGapPeriods }
      }
    ],
    rooms: [],      // { ...meta, name, code, type: RoomType, buildingId, capacity, closed: ['d-p'] }
    teachers: [],   // { ...meta, name, short, branch, dmin, dmax, wmin, wmax, cmax, maxDailyGaps, maxWeeklyGaps, maxDailyBuildingChanges, maxWeeklyBuildingChanges, preferredDays[], avoidDays[], compactDays, firstLastPref, av: {'d-p': 1|2}, extra[], dutyD, dutyP, kulup }
    classes: [],    // { ...meta, name, grade, shift: ShiftType, studentCount, homeRoomId, dmin, dmax, maxDailyGaps, maxWeeklyGaps, closed: ['d-p'], rehber, studentGroups: [{ id, name, studentCount }] }
    subjects: {},   // { [key]: { key, name, short, branch, requiredRoomType, allowSplit, forbidAcrossLunch, minDayGap, preferredPeriods[] } }
    customSubjects: [],
    blockRules: {}, // { ['SubjectName|hours']: { mode: 'fixed'|'auto', patterns: ['2+2'] } }
    blockMode: 'fixed',
    assignments: [], // { ...meta, classId, studentGroupId, parallelGroupId, subjectKey, hours, pattern, bmode, bpats[], teacherId, coTeacherIds[], roomId, requiredRoomType, kind: 'zorunlu'|'secmeli'|'ek', allowMultipleSameDay }
    constraints: [
      createConstraint({
        type: 'subject_diff_days',
        level: ConstraintLevel.HARD,
        description: 'Aynı dersin blokları farklı günlere dağılsın'
      }),
      createConstraint({
        type: 'block_no_across_lunch',
        level: ConstraintLevel.HIGH,
        enabled: true,
        description: 'Blok dersler öğle arasından bölünerek geçmesin'
      })
    ],
    placements: {}, // { [blockId]: { day, period, roomId, lock, lockScope } }
    solutions: [],  // Alternatif çözüm geçmişi (motor bazlı)
    report: { kurum: '', gecerli: '', sayi: '', myId: '' },
    duty: { places: ['Bahçe', 'Koridor'], admin: {} },
    sync: {
      deviceId: null,
      lastSyncAt: null,
      tombstones: [] // { entityType, id, deletedAt, revision }
    },
    ui: {
      prio: 'gaps',
      timeSeconds: 120,
      solverMode: 'smart',
      view: 'sinif',
      amode: 'brans_ek'
    }
  };
}

/** Proje JSON şemasını doğrular; bozuk veya eksik dosyaları reddeder */
export function validateProjectSchema(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Proje verisi geçerli bir JSON nesnesi değil.'] };
  }
  if (!obj.school || typeof obj.school !== 'object') {
    errors.push('Eksik veya geçersiz `school` alanı.');
  } else {
    const D = Number(obj.school.daysPerWeek ?? obj.school.D);
    const P = Number(obj.school.periodsPerDay ?? obj.school.P);
    if (!Number.isInteger(D) || D < 1 || D > 7) errors.push(`Geçersiz gün sayısı: ${D}`);
    if (!Number.isInteger(P) || P < 1 || P > 16) errors.push(`Geçersiz günlük ders sayısı: ${P}`);
  }
  const arrayFields = ['teachers', 'classes'];
  for (const f of arrayFields) {
    if (!Array.isArray(obj[f])) errors.push(`\`${f}\` bir dizi olmalıdır.`);
  }
  const isV3 = Number(obj.schemaVersion) === SCHEMA_VERSION;
  if (isV3) {
    for (const f of ['buildings', 'rooms', 'assignments', 'constraints']) {
      if (!Array.isArray(obj[f])) errors.push(`v3 şemasında \`${f}\` bir dizi olmalıdır.`);
    }
    if (obj.placements && typeof obj.placements !== 'object') {
      errors.push('`placements` bir nesne olmalıdır.');
    }
    // Ders görevlendirmeleri referans kontrolü
    const classIds = new Set((obj.classes || []).map(c => c.id));
    for (const a of obj.assignments || []) {
      if (!a.id) errors.push('Kimliği (id) olmayan ders görevlendirmesi var.');
      if (!classIds.has(a.classId)) errors.push(`Görevlendirme (${a.id}) bulunmayan sınıfa referans veriyor: ${a.classId}`);
      if (!Number.isFinite(Number(a.hours)) || Number(a.hours) < 1) {
        errors.push(`Geçersiz ders saati (${a.id}): ${a.hours}`);
      }
      const parts = parseBlockPattern(a.pattern, a.hours);
      if (parts.reduce((x, y) => x + y, 0) !== Number(a.hours)) {
        errors.push(`Blok düzeni toplamı ders saatiyle uyuşmuyor (${a.id}): ${a.pattern} != ${a.hours}`);
      }
    }
  } else if (!Array.isArray(obj.cards)) {
    errors.push('Eski şema dosyasında `cards` dizisi eksik.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Yedek JSON dosyasından hassas alanları (şifre, token, API anahtarı) temizler.
 * Güvenlik ve KVKK gereği hiçbir JSON yedekte kimlik doğrulama sırrı bulunamaz.
 */
const SECRET_KEY_RE = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|privatekey|refresh_token|access_token)/i;

export function sanitizeBackupJson(project) {
  function walk(val) {
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        if (SECRET_KEY_RE.test(k)) continue;
        out[k] = walk(v);
      }
      return out;
    }
    return val;
  }
  return walk(project);
}

export { RoomType, ShiftType, EducationMode, ConstraintLevel };
