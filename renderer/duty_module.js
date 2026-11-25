'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DersDutyModule = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function normalizeTr(s) {
    return String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  }

  /**
   * Okul Müdürü ve Müdür Yardımcıları okul nöbeti tutmaz.
   */
  function isAdministratorTeacher(teacher) {
    if (!teacher || typeof teacher !== 'object') return false;
    const role = String(teacher.role || 'ogretmen').toLowerCase();
    if (role === 'mudur' || role === 'mudur_yardimcisi') return true;
    const combined = normalizeTr(`${teacher.branch || ''} ${teacher.title || ''}`);
    if (/müdür|idareci|yönetici/.test(combined)) return true;
    return false;
  }

  function isDutyExempt(teacher) {
    if (!teacher) return true;
    return isAdministratorTeacher(teacher) || Boolean(teacher.dutyExempt);
  }

  function createDefaultDutyConfig() {
    const now = new Date();
    return {
      locations: ['Bahçe', 'Zemin Kat', '1. Kat', '2. Kat'],
      strategy: 'busiest_day', // 'busiest_day' | 'lightest_day'
      rotateWeekly: true,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      closedDates: {}, // { 'YYYY-MM-DD': true }
      weeklyAssignments: {} // { [dayIndex]: { [location]: [teacherId, ...] } }
    };
  }

  function ensureDutyConfig(state) {
    if (!state.dutyConfig || typeof state.dutyConfig !== 'object') {
      state.dutyConfig = createDefaultDutyConfig();
    }
    if (!Array.isArray(state.dutyConfig.locations) || !state.dutyConfig.locations.length) {
      state.dutyConfig.locations = ['Bahçe', 'Zemin Kat', '1. Kat', '2. Kat'];
    }
    if (!state.dutyConfig.weeklyAssignments || typeof state.dutyConfig.weeklyAssignments !== 'object') {
      state.dutyConfig.weeklyAssignments = {};
    }
    if (!state.dutyConfig.closedDates || typeof state.dutyConfig.closedDates !== 'object') {
      state.dutyConfig.closedDates = {};
    }
    if (!state.dutyConfig.month) state.dutyConfig.month = new Date().getMonth() + 1;
    if (!state.dutyConfig.year) state.dutyConfig.year = new Date().getFullYear();
    return state.dutyConfig;
  }

  function isDateClosed(state, isoDate) {
    const cfg = ensureDutyConfig(state);
    return Boolean(cfg.closedDates && cfg.closedDates[isoDate]);
  }

  function toggleClosedDate(state, isoDate) {
    const cfg = ensureDutyConfig(state);
    if (cfg.closedDates[isoDate]) {
      delete cfg.closedDates[isoDate];
      return false;
    }
    cfg.closedDates[isoDate] = true;
    return true;
  }

  /**
   * Öğretmen ekstra okutabileceği ders/branş eşleştirmesi
   */
  function doesTeacherExtraMatchCourse(teacher, courseName, courseCode) {
    const extras = Array.isArray(teacher && teacher.extraSubjects) ? teacher.extraSubjects : [];
    if (!extras.length) return false;
    const cName = normalizeTr(courseName);
    const cCode = normalizeTr(courseCode);
    return extras.some((ex) => {
      const n = normalizeTr(ex);
      if (!n) return false;
      if (cName === n || cCode === n) return true;
      if (cName.includes(n) || n.includes(cName)) return true;
      return false;
    });
  }

  /**
   * Öğretmenin her aktif gündeki ders saatini hesaplar (çözüm yoksa müsaitlik sayısına bakar).
   */
  function computeTeacherDailyHoursMap(state, teachers, activeDayIndices) {
    const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
    const hasSolution = placements.length > 0;
    const result = {};

    teachers.forEach((t) => {
      const dayHours = {};
      activeDayIndices.forEach((origDay) => { dayHours[origDay] = 0; });

      if (hasSolution) {
        placements.forEach((pl) => {
          if ((pl.teacher_ids || []).includes(t.id)) {
            const origDay = activeDayIndices[pl.day_index];
            if (origDay !== undefined) {
              dayHours[origDay] = (dayHours[origDay] || 0) + Number(pl.length || 0);
            }
          }
        });
      } else {
        const periods = (state.grid && state.grid.periodsPerDay) || 7;
        activeDayIndices.forEach((origDay) => {
          let openCnt = 0;
          for (let p = 0; p < periods; p++) {
            const av = t.availability && t.availability[origDay] && t.availability[origDay][p];
            if (av !== 'UNAVAILABLE') openCnt++;
          }
          dayHours[origDay] = openCnt;
        });
      }
      result[t.id] = dayHours;
    });

    return { hasSolution, map: result };
  }

  /**
   * Otomatik Okul Nöbeti Dağıtımı
   * strategy: 'busiest_day' (En yoğun ders gününe) | 'lightest_day' (En az ders gününe)
   * Okul müdürü ve müdür yardımcıları kesinlikle hariç tutulur.
   */
  function autoAssignSchoolDuties(state, teachers, activeDayIndices, strategy = 'busiest_day') {
    const cfg = ensureDutyConfig(state);
    cfg.strategy = strategy;
    const locations = cfg.locations.filter((l) => String(l || '').trim());
    if (!locations.length) {
      throw new Error('En az bir nöbet yeri tanımlanmalıdır.');
    }

    const eligible = teachers.filter((t) => !isDutyExempt(t));
    const skippedAdmins = teachers.filter((t) => isAdministratorTeacher(t));
    const { map: hoursMap } = computeTeacherDailyHoursMap(state, eligible, activeDayIndices);

    // Temiz haftalık çizelge oluştur
    const weekly = {};
    const dayCounts = {};
    const cellCounts = {};
    activeDayIndices.forEach((d) => {
      weekly[d] = {};
      dayCounts[d] = 0;
      locations.forEach((loc) => {
        weekly[d][loc] = [];
        cellCounts[`${d}__${loc}`] = 0;
      });
    });

    // İdarecilerin eski nöbet kayıtlarını temizle
    teachers.forEach((t) => {
      if (isDutyExempt(t)) {
        t.dutyDay = -1;
        t.dutyLocation = '';
      }
    });

    const maxPerDay = Math.max(1, Math.ceil(eligible.length / Math.max(1, activeDayIndices.length)));

    // Öğretmenleri önce daha belirgin yoğunluk farkına göre sırala
    const ordered = [...eligible].sort((a, b) => {
      const aVals = activeDayIndices.map((d) => hoursMap[a.id][d] || 0);
      const bVals = activeDayIndices.map((d) => hoursMap[b.id][d] || 0);
      const aSpread = Math.max(...aVals) - Math.min(...aVals);
      const bSpread = Math.max(...bVals) - Math.min(...bVals);
      return bSpread - aSpread;
    });

    // KURAL: Bir öğretmen bir haftada EN FAZLA 1 gün nöbet tutabilir (kesinlikle birden fazla tutamaz)
    const assignedTeachers = new Set();

    ordered.forEach((t) => {
      if (assignedTeachers.has(t.id)) return;
      const dMap = hoursMap[t.id] || {};
      const hasAnyLessonDay = activeDayIndices.some((d) => (dMap[d] || 0) > 0);
      const candidates = [...activeDayIndices].sort((d1, d2) => {
        const h1 = dMap[d1] || 0;
        const h2 = dMap[d2] || 0;
        // Ders programı varsa öğretmenin okulda bulunduğu (>0 saat) günleri önceliklendir
        if (hasAnyLessonDay) {
          const present1 = h1 > 0 ? 0 : 1;
          const present2 = h2 > 0 ? 0 : 1;
          if (present1 !== present2) return present1 - present2;
        }
        const over1 = dayCounts[d1] >= maxPerDay ? 1 : 0;
        const over2 = dayCounts[d2] >= maxPerDay ? 1 : 0;
        if (over1 !== over2) return over1 - over2;

        if (strategy === 'busiest_day') {
          if (h2 !== h1) return h2 - h1;
        } else {
          if (h1 !== h2) return h1 - h2;
        }
        return dayCounts[d1] - dayCounts[d2];
      });

      const chosenDay = candidates[0];
      // Seçilen günde en az öğretmeni olan nöbet yerini seç
      const chosenLoc = [...locations].sort((l1, l2) => cellCounts[`${chosenDay}__${l1}`] - cellCounts[`${chosenDay}__${l2}`])[0];

      weekly[chosenDay][chosenLoc].push(t.id);
      assignedTeachers.add(t.id);
      dayCounts[chosenDay]++;
      cellCounts[`${chosenDay}__${chosenLoc}`]++;

      t.dutyDay = chosenDay;
      t.dutyLocation = chosenLoc;
    });

    cfg.weeklyAssignments = weekly;
    return {
      assignedCount: assignedTeachers.size,
      skippedAdminsCount: skippedAdmins.length,
      strategy,
      weeklyAssignments: weekly
    };
  }

  /**
   * Seçilen ay ve yıl için Aylık Okul Nöbeti Çizelgesi ve Etkileşimli Aylık Takvim üretir.
   * KURAL 1: Aylık takvimde kapatılan (tatil/kapalı) günlere nöbet yazılmaz.
   * KURAL 2: Bir öğretmen aynı hafta içinde EN FAZLA 1 gün nöbet tutabilir.
   */
  function buildMonthlyDutySchedule(state, teachers, activeDayIndices, year, month1To12, rotateWeekly = true) {
    const cfg = ensureDutyConfig(state);
    const locations = cfg.locations;
    const weekly = cfg.weeklyAssignments || {};
    const closedDates = cfg.closedDates || {};
    const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const activeSet = new Set(activeDayIndices);

    const daysInMonth = new Date(year, month1To12, 0).getDate();
    const rows = [];
    const calendarDays = [];
    let weekIndex = 0;
    let lastJsDay = -1;
    let usedInCurrentWeek = new Set();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dt = new Date(year, month1To12 - 1, dayNum);
      const jsDay = dt.getDay(); // 0=Pazar, 1=Pzt..6=Cmt
      const mm = String(month1To12).padStart(2, '0');
      const dd = String(dayNum).padStart(2, '0');
      const isoDate = `${year}-${mm}-${dd}`;
      const dateStr = `${dd}.${mm}.${year}`;

      if (jsDay === 0) {
        calendarDays.push({
          dayNum, isoDate, dateStr, jsDay, dayIndex: -1, dayName: 'Pazar',
          isWeekend: true, isSchoolDay: false, isClosed: true, dutyCount: 0
        });
        continue;
      }
      const appDayIdx = jsDay - 1; // 0=Pzt..5=Cmt
      if (lastJsDay !== -1 && jsDay < lastJsDay) {
        weekIndex++;
        usedInCurrentWeek = new Set();
      }
      lastJsDay = jsDay;

      const isActiveSchoolDay = activeSet.has(appDayIdx);
      const isManuallyClosed = Boolean(closedDates[isoDate]);

      if (!isActiveSchoolDay) {
        calendarDays.push({
          dayNum, isoDate, dateStr, jsDay, dayIndex: appDayIdx, dayName: DAY_NAMES[appDayIdx],
          isWeekend: appDayIdx === 5, isSchoolDay: false, isClosed: true, dutyCount: 0
        });
        continue;
      }

      if (isManuallyClosed) {
        calendarDays.push({
          dayNum, isoDate, dateStr, jsDay, dayIndex: appDayIdx, dayName: DAY_NAMES[appDayIdx],
          isWeekend: false, isSchoolDay: true, isClosed: true, dutyCount: 0
        });
        continue;
      }

      const dayAssignments = weekly[appDayIdx] || {};
      const byLocation = {};
      let dayDutyCount = 0;
      locations.forEach((loc, locIdx) => {
        const srcLocIdx = rotateWeekly ? ((locIdx - (weekIndex % locations.length) + locations.length) % locations.length) : locIdx;
        const srcLoc = locations[srcLocIdx];
        const rawIds = (dayAssignments[srcLoc] || []).filter((id) => tMap[id] && !isDutyExempt(tMap[id]));
        // Kesin kural: Aynı hafta içinde 1 öğretmen en fazla 1 gün nöbet tutabilir
        const allowedIds = [];
        rawIds.forEach((id) => {
          if (!usedInCurrentWeek.has(id)) {
            usedInCurrentWeek.add(id);
            allowedIds.push(id);
          }
        });
        dayDutyCount += allowedIds.length;
        byLocation[loc] = allowedIds.map((id) => tMap[id].name);
      });

      calendarDays.push({
        dayNum, isoDate, dateStr, jsDay, dayIndex: appDayIdx, dayName: DAY_NAMES[appDayIdx],
        isWeekend: false, isSchoolDay: true, isClosed: false, dutyCount: dayDutyCount
      });

      rows.push({
        isoDate,
        dateStr,
        dayIndex: appDayIdx,
        dayName: DAY_NAMES[appDayIdx],
        weekIndex,
        byLocation
      });
    }

    const closedCount = calendarDays.filter((d) => d.isSchoolDay && d.isClosed).length;
    return {
      year,
      month: month1To12,
      monthName: MONTH_NAMES[month1To12 - 1] || String(month1To12),
      locations,
      rows,
      calendarDays,
      closedCount
    };
  }

  function buildMonthlyDutyPrintHtml(state, monthly) {
    const schoolName = (state.school && state.school.name) || 'OKUL MÜDÜRLÜĞÜ';
    const es = (state.exportSettings) || {};
    const principal = (es.principalName || '').trim();
    const locs = monthly.locations;

    return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Aylık Nöbet Çizelgesi</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: "Times New Roman", Times, serif; color: #000; font-size: 11px; margin: 0; }
        h2 { text-align: center; margin: 0 0 4px 0; text-transform: uppercase; font-size: 15px; }
        h3 { text-align: center; margin: 0 0 10px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #000; padding: 3px 4px; text-align: center; vertical-align: middle; word-wrap: break-word; }
        thead th { background: #d9e1f8; font-weight: 700; }
        td.day-col { background: #e5e7eb; font-weight: 700; text-align: left; }
        .sig { margin-top: 16px; text-align: right; padding-right: 32px; font-size: 12px; }
      </style></head><body>
      <h2>${escapeHtml(schoolName)}</h2>
      <h3>${escapeHtml(monthly.monthName.toUpperCase())} ${monthly.year} AYLIK ÖĞRETMEN NÖBET ÇİZELGESİ</h3>
      <table>
        <thead>
          <tr>
            <th style="width:78px;">Tarih</th>
            <th style="width:82px;">Gün</th>
            ${locs.map((l) => `<th>${escapeHtml(l)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${monthly.rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.dateStr)}</td>
              <td class="day-col">${escapeHtml(r.dayName)}</td>
              ${locs.map((l) => `<td>${escapeHtml((r.byLocation[l] || []).join(', ') || '—')}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="sig">
        <div>${principal ? escapeHtml(principal) : '................................'}</div>
        <div><strong>Okul Müdürü</strong></div>
      </div>
    </body></html>`;
  }

  /**
   * TAM ADRESLİ PROGRAM KONTROLÜ (Bölüm 5)
   * Her hatayı Menü / Sekme / Şube / Öğretmen / Gün / Ders Saati tam adresiyle raporlar.
   */
  function runFullAddressAudit(state, helpers, editorLogic) {
    const errors = [];
    const warnings = [];
    const classes = helpers.getCurrentClasses();
    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const gridStats = helpers.getSlotStats();
    const bell = helpers.computeBellSchedule ? helpers.computeBellSchedule() : { primary: [] };
    const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const cMap = Object.fromEntries(classes.map((c) => [c.id, c]));
    const rMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

    function slotTimeText(pIdx) {
      const b = bell.primary && bell.primary[pIdx];
      return b ? `${b.period}. Ders (${b.start}–${b.end})` : `${pIdx + 1}. Ders`;
    }

    // 1. Menü 4: Öğretmensiz dersler ve şube toplam saat uyumsuzluğu
    const teacherAssignedHours = {};
    teachers.forEach((t) => { teacherAssignedHours[t.id] = 0; });

    classes.forEach((cls) => {
      let clsTotal = 0;
      (cls.courses || []).forEach((c) => {
        const hrs = Number(c.hours || 0);
        clsTotal += hrs;
        if (!c.teacherId) {
          errors.push({
            severity: 'error',
            category: 'Öğretmen Atanmamış Ders',
            address: `Menü 4 → Ders Atama → ${cls.name} → ${c.name}`,
            message: `${cls.name} şubesindeki "${c.name}" (${hrs} saat) dersine henüz öğretmen atanmamış.`,
            nav: { view: 'menu4', classId: cls.id }
          });
        } else {
          teacherAssignedHours[c.teacherId] = (teacherAssignedHours[c.teacherId] || 0) + hrs;
          if (c.teacherId2) {
            teacherAssignedHours[c.teacherId2] = (teacherAssignedHours[c.teacherId2] || 0) + hrs;
          }
        }
      });

      if (gridStats.openSlots > 0 && clsTotal > gridStats.openSlots) {
        errors.push({
          severity: 'error',
          category: 'Şube Ders Saati Kapasite Aşımı',
          address: `Menü 2 / Menü 4 → ${cls.name}`,
          message: `${cls.name} şubesine tanımlanan toplam ders saati (${clsTotal} sa), okuldaki açık zaman slotu sayısını (${gridStats.openSlots} sa) aşıyor.`,
          nav: { view: 'menu4', classId: cls.id }
        });
      }
    });

    // 2. Menü 3: Öğretmen haftalık yük sınırları (Min / Maks) ve müsait slot kontrolü
    teachers.forEach((t) => {
      const assigned = teacherAssignedHours[t.id] || 0;
      const maxH = Number(t.maxHours || 30);
      const minH = Number(t.minHours || 1);
      if (assigned > maxH) {
        errors.push({
          severity: 'error',
          category: 'Öğretmen Maksimum Yük Aşımı',
          address: `Menü 3 → Öğretmenler → ${t.name} (${t.branch})`,
          message: `${t.name} öğretmenine ${assigned} saat ders atanmış, ancak haftalık maksimum sınırı ${maxH} saat.`,
          nav: { view: 'menu3', teacherId: t.id }
        });
      } else if (assigned > 0 && assigned < minH) {
        warnings.push({
          severity: 'warning',
          category: 'Öğretmen Minimum Saat Altı',
          address: `Menü 3 → Öğretmenler → ${t.name} (${t.branch})`,
          message: `${t.name} öğretmenine ${assigned} saat ders atanmış (haftalık alt sınır: ${minH} saat).`,
          nav: { view: 'menu3', teacherId: t.id }
        });
      }
    });

    // 3. Menü 6: Çözülmüş program üzerindeki çakışmalar, kapalı saat ve yerleşmeyen bloklar
    const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
    if (placements.length > 0 && editorLogic && typeof editorLogic.auditScheduleLocal === 'function') {
      const rawIssues = editorLogic.auditScheduleLocal(state, helpers);
      rawIssues.forEach((iss) => {
        if (iss.severity !== 'error') return;
        let addr = 'Menü 6 → Program Çıktıları';
        let nav = { view: 'menu6', tab: 'report' };
        if (iss.teacher_id && tMap[iss.teacher_id]) {
          const dayTxt = iss.day_index !== undefined && gridStats.activeDayIndices[iss.day_index] !== undefined
            ? ` → ${DAY_NAMES[gridStats.activeDayIndices[iss.day_index]]}` : '';
          const pTxt = iss.period !== undefined ? `, ${slotTimeText(iss.period)}` : '';
          addr = `Menü 6 → Öğretmen Programı → ${tMap[iss.teacher_id].name}${dayTxt}${pTxt}`;
          nav = { view: 'menu6', tab: 'teacher', entityId: iss.teacher_id };
        } else if (iss.class_id && cMap[iss.class_id]) {
          const dayTxt = iss.day_index !== undefined && gridStats.activeDayIndices[iss.day_index] !== undefined
            ? ` → ${DAY_NAMES[gridStats.activeDayIndices[iss.day_index]]}` : '';
          const pTxt = iss.period !== undefined ? `, ${slotTimeText(iss.period)}` : '';
          addr = `Menü 6 → Sınıf Programı → ${cMap[iss.class_id].name}${dayTxt}${pTxt}`;
          nav = { view: 'menu6', tab: 'class', entityId: iss.class_id };
        } else if (iss.room_id && rMap[iss.room_id]) {
          addr = `Menü 6 → Özel Mekanlar → ${rMap[iss.room_id].name}`;
          nav = { view: 'menu6', tab: 'room' };
        }
        errors.push({
          severity: 'error',
          category: iss.category || 'Yerleşim Hatası',
          address: addr,
          message: iss.message,
          class_id: iss.class_id,
          teacher_id: iss.teacher_id,
          nav
        });
      });
    }

    // Yerleşmemiş bloklar
    const unplaced = (state.solution && Array.isArray(state.solution.unplaced)) ? state.solution.unplaced : [];
    unplaced.forEach((u) => {
      errors.push({
        severity: 'error',
        category: 'Yerleşmeyen Ders Bloğu',
        address: `Menü 5 → Otomatik Dağıtım → ${u.class_name || u.class_id || 'Şube'} → ${u.course_name || u.course_code || 'Ders'}`,
        message: `${u.class_name || ''} şubesindeki ${u.course_name || u.course_code || ''} (${u.length || ''} saatlik blok) yerleştirilemedi.`,
        nav: { view: 'menu5' }
      });
    });

    // 4. Okul Nöbeti: Okul Müdürü / Müdür Yardımcısı nöbete yazılmış mı kontrol et
    const dutyCfg = ensureDutyConfig(state);
    Object.entries(dutyCfg.weeklyAssignments || {}).forEach(([dayIdxStr, locMap]) => {
      const dIdx = Number(dayIdxStr);
      const dayName = DAY_NAMES[dIdx] || `Gün ${dIdx + 1}`;
      Object.entries(locMap || {}).forEach(([loc, ids]) => {
        (ids || []).forEach((tid) => {
          const t = tMap[tid];
          if (t && isAdministratorTeacher(t)) {
            errors.push({
              severity: 'error',
              category: 'İdareci Nöbet İhlali',
              address: `Menü 6 → Okul Nöbeti → ${dayName} / ${loc} → ${t.name}`,
              message: `${t.name} (Okul Müdürü / Müdür Yardımcısı) okul nöbeti tutamaz.`,
              teacher_id: t.id,
              nav: { view: 'menu6', tab: 'duty' }
            });
          }
        });
      });
    });

    return {
      isClean: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings
    };
  }

  return {
    DAY_NAMES,
    MONTH_NAMES,
    isAdministratorTeacher,
    isDutyExempt,
    createDefaultDutyConfig,
    ensureDutyConfig,
    isDateClosed,
    toggleClosedDate,
    doesTeacherExtraMatchCourse,
    computeTeacherDailyHoursMap,
    autoAssignSchoolDuties,
    buildMonthlyDutySchedule,
    buildMonthlyDutyPrintHtml,
    runFullAddressAudit
  };
});
