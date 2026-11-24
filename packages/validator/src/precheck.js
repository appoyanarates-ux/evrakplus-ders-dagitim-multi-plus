import { DAYS_TR } from '../../core-schema/src/constants.js';

/**
 * PASS 0: Veri ve Model Ön Kontrolü.
 * Eski Çarşaf'taki Hall koşulu gün grubu kapasite kontrolü dahil tüm ön kontrolleri çalıştırır.
 */
export function runPrecheck(solverInput) {
  const issues = [];
  const D = solverInput.school.daysPerWeek;
  const P = solverInput.school.periodsPerDay;

  const teacherLoad = new Map();
  const classLoad = new Map();

  for (const b of solverInput.blocks) {
    if (b.teacherId) teacherLoad.set(b.teacherId, (teacherLoad.get(b.teacherId) || 0) + b.length);
    else {
      issues.push({
        level: 'error',
        code: 'NO_TEACHER',
        message: `Öğretmen atanmamış ders bloğu var (${b.blockId}).`,
        blockId: b.blockId
      });
    }
    if (!b.studentGroupId) {
      classLoad.set(b.classId, (classLoad.get(b.classId) || 0) + b.length);
    }
  }

  // Öğretmen kapasite kontrolü
  const teacherOpenPerDay = new Map();
  for (const t of solverInput.teachers) {
    const load = teacherLoad.get(t.id) || 0;
    const closed = new Set(t.closedSlots || []);
    const per = [];
    let openTot = 0;
    for (let d = 0; d < D; d++) {
      let o = 0;
      for (let p = 0; p < P; p++) if (!closed.has(`${d}-${p}`)) o++;
      const eff = Math.min(o, t.dmax || P);
      per.push(eff);
      openTot += eff;
    }
    teacherOpenPerDay.set(t.id, per);

    if (load > openTot) {
      issues.push({
        level: 'error',
        code: 'TEACHER_OVERLOAD',
        message: `${t.name}: ${load} saat dersi var ancak açık kapasitesi ${openTot} saat.`,
        teacherId: t.id
      });
    } else if (load > 0 && load === openTot) {
      issues.push({
        level: 'warning',
        code: 'TEACHER_TIGHT',
        message: `${t.name}: ${load}/${openTot} saat — hiç boşluk esnekliği yok.`,
        teacherId: t.id
      });
    }
  }

  // Sınıf kapasite kontrolü
  const classOpenPerDay = new Map();
  for (const c of solverInput.classes) {
    const load = classLoad.get(c.id) || 0;
    const closed = new Set(c.closedSlots || []);
    const per = [];
    let openTot = 0;
    for (let d = 0; d < D; d++) {
      let o = 0;
      for (let p = 0; p < P; p++) if (!closed.has(`${d}-${p}`)) o++;
      const eff = Math.min(o, c.dmax || P);
      per.push(eff);
      openTot += eff;
    }
    classOpenPerDay.set(c.id, per);

    if (load > openTot) {
      issues.push({
        level: 'error',
        code: 'CLASS_OVERLOAD',
        message: `${c.name}: ${load} saat dersi var ancak sınıfın açık saati ${openTot}.`,
        classId: c.id
      });
    }
  }

  // Hall Koşulu: Gün grubu toplam arz-talep kontrolü (D <= 6 için 2^D - 1 alt küme)
  if (D <= 6 && solverInput.classes.length > 0 && solverInput.teachers.length > 0) {
    const foundMasks = [];
    for (let mask = 1; mask < (1 << D); mask++) {
      if (foundMasks.some(f => (f & mask) === f)) continue;

      let demand = 0;
      let room = 0;
      for (const c of solverInput.classes) {
        const per = classOpenPerDay.get(c.id) || [];
        let inD = 0, outD = 0;
        for (let d = 0; d < D; d++) {
          if ((mask >> d) & 1) inD += per[d];
          else outD += per[d];
        }
        room += inD;
        demand += Math.max(0, (classLoad.get(c.id) || 0) - outD);
      }

      let supply = 0;
      let teacherNeed = 0;
      for (const t of solverInput.teachers) {
        const load = teacherLoad.get(t.id) || 0;
        if (!load) continue;
        const per = teacherOpenPerDay.get(t.id) || [];
        let inD = 0, outD = 0;
        for (let d = 0; d < D; d++) {
          if ((mask >> d) & 1) inD += per[d];
          else outD += per[d];
        }
        supply += Math.min(load, inD);
        teacherNeed += Math.max(0, load - outD);
      }

      const dayNames = [];
      for (let d = 0; d < D; d++) if ((mask >> d) & 1) dayNames.push(DAYS_TR[d] || `Gün ${d + 1}`);

      if (demand > supply) {
        foundMasks.push(mask);
        issues.push({
          level: 'error',
          code: 'HALL_DAY_GROUP_SHORTAGE',
          message: `${dayNames.join(', ')}: Sınıfların en az ${demand} saat derse ihtiyacı var, ancak açık öğretmen kapasitesi ${supply} saat (${demand - supply} saat eksik).`
        });
      } else if (teacherNeed > room) {
        foundMasks.push(mask);
        issues.push({
          level: 'error',
          code: 'HALL_TEACHER_OVERFLOW',
          message: `${dayNames.join(', ')}: Öğretmenler bu günlere en az ${teacherNeed} saat koymak zorunda, ancak sınıfların toplam açık saati ${room}.`
        });
      }
    }
  }

  return {
    passed: !issues.some(i => i.level === 'error'),
    errorCount: issues.filter(i => i.level === 'error').length,
    warningCount: issues.filter(i => i.level === 'warning').length,
    issues
  };
}
