import { createBlankProject, RoomType } from '../../packages/core-schema/src/index.js';

/**
 * Gerçekçi MEB okul profili üreteci (Performans ve motor doğrulama testleri için).
 * Profiller:
 * - very_small: 10 öğretmen, 5 şube
 * - small:      25 öğretmen, 12 şube
 * - medium:     50 öğretmen, 24 şube
 * - large:      100 öğretmen, 45 şube
 * - xlarge:     150 öğretmen, 65 şube
 * - ultimate:   250 öğretmen, 100 şube
 */
export const SCHOOL_PROFILES = Object.freeze({
  very_small: { name: 'Çok Küçük Okul', teacherCount: 10, classCount: 5, D: 5, P: 7 },
  small: { name: 'Küçük Okul', teacherCount: 25, classCount: 12, D: 5, P: 7 },
  medium: { name: 'Orta Okul', teacherCount: 50, classCount: 24, D: 5, P: 7 },
  large: { name: 'Büyük Okul', teacherCount: 100, classCount: 45, D: 5, P: 7 },
  xlarge: { name: 'Çok Büyük Okul', teacherCount: 150, classCount: 65, D: 5, P: 7 },
  ultimate: { name: 'Ultimate Okul', teacherCount: 250, classCount: 100, D: 5, P: 7 }
});

const CURRICULUM = [
  { key: 'TRK', name: 'Türkçe', short: 'TRK', branch: 'Türkçe', hours: 6, pattern: '2+2+2' },
  { key: 'MAT', name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: 5, pattern: '2+2+1' },
  { key: 'FEN', name: 'Fen Bilimleri', short: 'FEN', branch: 'Fen Bilimleri', hours: 4, pattern: '2+2' },
  { key: 'SOS', name: 'Sosyal Bilgiler', short: 'SOS', branch: 'Sosyal Bilgiler', hours: 3, pattern: '2+1' },
  { key: 'ING', name: 'İngilizce', short: 'İNG', branch: 'İngilizce', hours: 4, pattern: '2+2' },
  { key: 'DKB', name: 'Din Kültürü', short: 'DKB', branch: 'Din Kültürü', hours: 2, pattern: '2' },
  { key: 'BES', name: 'Beden Eğitimi', short: 'BES', branch: 'Beden Eğitimi', hours: 2, pattern: '2' },
  { key: 'BTY', name: 'Bilişim', short: 'BTY', branch: 'Bilişim', hours: 2, pattern: '2' },
  { key: 'GRS', name: 'Görsel Sanatlar', short: 'GRS', branch: 'Görsel Sanatlar', hours: 1, pattern: '1' },
  { key: 'MZK', name: 'Müzik', short: 'MZK', branch: 'Müzik', hours: 1, pattern: '1' }
]; // Toplam 30 saat / şube (5 gün x 7 saat = 35 slot içinde gerçekçi yoğunluk)

export function generateRealisticSchool(profileKey = 'very_small', opts = {}) {
  const cfg = SCHOOL_PROFILES[profileKey] || SCHOOL_PROFILES.very_small;
  const p = createBlankProject({
    school: {
      name: `${cfg.name} (${cfg.teacherCount} Öğr / ${cfg.classCount} Şube)`,
      daysPerWeek: cfg.D,
      periodsPerDay: cfg.P
    }
  });

  // Dersler
  for (const s of CURRICULUM) {
    p.subjects[s.key] = {
      key: s.key,
      name: s.name,
      short: s.short,
      branch: s.branch,
      requiredRoomType: null,
      forbidAcrossLunch: true
    };
  }

  // Sınıflar
  for (let i = 0; i < cfg.classCount; i++) {
    const grade = 5 + (i % 4);
    const letter = String.fromCharCode(65 + Math.floor(i / 4) % 26);
    p.classes.push({
      id: `c_${i}`,
      revision: 1,
      updatedAt: '',
      deletedAt: null,
      name: `${grade}/${letter}${i >= 104 ? i : ''}`,
      grade,
      shift: 'full',
      studentCount: 30,
      homeRoomId: null,
      dmin: 0,
      dmax: cfg.P,
      maxDailyGaps: 0,
      maxWeeklyGaps: 0,
      closed: [],
      rehber: '',
      studentGroups: []
    });
  }

  // Öğretmenleri branş ağırlıklarına göre dağıt (en az 1 öğretmen / branş)
  const branchLoads = {};
  for (const s of CURRICULUM) {
    branchLoads[s.branch] = (branchLoads[s.branch] || 0) + s.hours * cfg.classCount;
  }
  const branches = Object.keys(branchLoads);
  const teacherIdsByBranch = Object.fromEntries(branches.map(b => [b, []]));

  // Her branşa en az gerekli sayıda (maks 28 saat) öğretmen aç
  let tIdx = 0;
  for (const br of branches) {
    const needed = Math.max(1, Math.ceil(branchLoads[br] / 24));
    for (let k = 0; k < needed && tIdx < cfg.teacherCount; k++) {
      const av = {};
      if (opts.withClosedDays) {
        // Haftada 1 kapalı gün (deterministik)
        const closedDay = tIdx % cfg.D;
        for (let pr = 0; pr < cfg.P; pr++) av[`${closedDay}-${pr}`] = 1;
      }
      // 1 adet tercihen boş saat
      av[`${(tIdx + 1) % cfg.D}-0`] = 2;

      const tid = `t_${tIdx}`;
      p.teachers.push({
        id: tid,
        revision: 1,
        updatedAt: '',
        deletedAt: null,
        name: `${br} Öğretmeni ${k + 1}`,
        short: `${br.slice(0, 2).toUpperCase()}${k + 1}`,
        branch: br,
        dmin: 0,
        dmax: cfg.P,
        wmin: 0,
        wmax: 30,
        cmax: opts.cmax || 0,
        maxDailyGaps: null,
        maxWeeklyGaps: null,
        maxDailyBuildingChanges: null,
        maxWeeklyBuildingChanges: null,
        preferredDays: [],
        avoidDays: [],
        av,
        extra: []
      });
      teacherIdsByBranch[br].push(tid);
      tIdx++;
    }
  }

  // Kalan öğretmen sayısını en yoğun branşlara ekle
  const sortedBranches = [...branches].sort((a, b) => branchLoads[b] - branchLoads[a]);
  while (tIdx < cfg.teacherCount) {
    const br = sortedBranches[tIdx % sortedBranches.length];
    const tid = `t_${tIdx}`;
    p.teachers.push({
      id: tid,
      revision: 1,
      updatedAt: '',
      deletedAt: null,
      name: `${br} Öğretmeni Ek ${tIdx}`,
      short: `E${tIdx}`,
      branch: br,
      dmin: 0,
      dmax: cfg.P,
      wmin: 0,
      wmax: 30,
      cmax: opts.cmax || 0,
      maxDailyGaps: null,
      maxWeeklyGaps: null,
      maxDailyBuildingChanges: null,
      maxWeeklyBuildingChanges: null,
      preferredDays: [],
      avoidDays: [],
      av: {},
      extra: []
    });
    teacherIdsByBranch[br].push(tid);
    tIdx++;
  }

  // Görevlendirmeleri dengeli dağıt
  const tLoad = {};
  let aIdx = 0;
  for (const cls of p.classes) {
    for (const s of CURRICULUM) {
      const pool = teacherIdsByBranch[s.branch];
      pool.sort((a, b) => (tLoad[a] || 0) - (tLoad[b] || 0));
      const tid = pool[0];
      tLoad[tid] = (tLoad[tid] || 0) + s.hours;
      p.assignments.push({
        id: `a_${aIdx++}`,
        revision: 1,
        updatedAt: '',
        deletedAt: null,
        classId: cls.id,
        studentGroupId: null,
        parallelGroupId: null,
        subjectKey: s.key,
        hours: s.hours,
        pattern: s.pattern,
        bmode: null,
        bpats: [],
        teacherId: tid,
        coTeacherIds: [],
        roomId: null,
        requiredRoomType: null,
        kind: 'zorunlu',
        allowMultipleSameDay: false
      });
    }
  }

  return p;
}
