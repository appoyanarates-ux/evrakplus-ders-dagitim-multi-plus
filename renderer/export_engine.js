'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DersExportEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function sanitizeWindowsFilename(name, fallback = 'cikti') {
    const clean = String(name || fallback)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[._]+|[._]+$/g, '');
    return (clean || fallback).slice(0, 120);
  }

  function sanitizeExcelCell(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return "'" + str;
    }
    return str;
  }

  function createDefaultExportSettings() {
    return {
      principalName: '',
      coordinatorName: '',
      customTitle: '',
      footerText: '',
      showDate: true,
      showSignatures: true,
      showLogo: false,
      logoDataUrl: '',
      pageSize: 'A4',
      orientation: 'landscape',
      fontSize: 'medium',
      fitToPage: true,
      colorMode: 'color',
      teacherDisplay: 'full', // 'full' | 'code' | 'hidden'
      splitA4Sheets: false,
      showTeacherTotals: true,
      evrakPlusEnforcement: 'development_open' // 'development_open' | 'strict_evrakplus'
    };
  }

  /* =========================================================================
     1. EVRAKPLUS YETKİLENDİRME SERVİSİ (AŞAMA 4 + AŞAMA 5)
     ========================================================================= */
  const EVRAKPLUS_GATE_MESSAGE =
    'Bu özellikten yararlanmak için ücretsiz EvrakPlus üyeliğinizle giriş yapmanız gerekiyor. Ders programınızı oluşturmaya ve düzenlemeye ücretsiz devam edebilirsiniz.';

  const EvrakPlusAuthService = {
    GATE_MESSAGE: EVRAKPLUS_GATE_MESSAGE,
    checkExportPermission(action, state) {
      // Aşama 5: Canlı EvrakPlus masaüstü / web oturumu varsa doğrudan sunucu imzalı yetkiyi kontrol et
      if (state && state.evrakPlusSession && typeof state.evrakPlusSession === 'object') {
        const sess = state.evrakPlusSession;
        const ent = sess.entitlement || {};
        if (sess.loggedIn && ent.exportAllowed) {
          return {
            allowed: true,
            mode: 'evrakplus_session',
            status: 'verified',
            action,
            user: sess.user || null,
            expiresAt: ent.expiresAt || null,
            offlineRemainingDays: ent.offlineRemainingDays || 0
          };
        }
        return {
          allowed: false,
          mode: 'evrakplus_session',
          status: ent.offlineExpired ? 'expired_license' : 'auth_required',
          action,
          message: ent.offlineExpired
            ? 'EvrakPlus çevrimdışı çıktı yetkinizin (7 gün) süresi doldu. Lütfen internet bağlantısı ile oturumunuzu yenileyin.'
            : EVRAKPLUS_GATE_MESSAGE
        };
      }

      const settings = (state && state.exportSettings) || {};
      const mode = settings.evrakPlusEnforcement || 'development_open';
      const license = state && state.evrakPlusLicense;

      if (mode === 'development_open') {
        return {
          allowed: true,
          mode: 'development_open',
          status: 'not_configured_dev_mode',
          action,
          message: 'EvrakPlus üyelik API bağlantısı henüz etkinleştirilmedi (geliştirme/test ortamı açık).'
        };
      }

      if (!license || typeof license !== 'object' || !license.token || !license.expiresAt) {
        return {
          allowed: false,
          mode: 'strict_evrakplus',
          status: 'missing_license',
          action,
          message: EVRAKPLUS_GATE_MESSAGE
        };
      }

      const expMs = Date.parse(license.expiresAt);
      if (Number.isNaN(expMs) || expMs <= Date.now()) {
        return {
          allowed: false,
          mode: 'strict_evrakplus',
          status: 'expired_license',
          action,
          message: 'EvrakPlus çevrimdışı çıktı yetki süreniz dolmuş. Lütfen bağlantınızı yenileyin.'
        };
      }

      return {
        allowed: true,
        mode: 'strict_evrakplus',
        status: 'verified',
        action,
        user: license.user || null,
        expiresAt: license.expiresAt
      };
    }
  };

  /* =========================================================================
     2. ÇIKTI ÖNCESİ GEÇERLİLİK VE KALİTE RAPORU HESAPLAYICI (BÖLÜM 10 & 11)
     ========================================================================= */
  function computeTeacherDayMetrics(teacherId, placements, numDays) {
    const dailyHours = Array(numDays).fill(0);
    let workingDays = 0;
    let totalGaps = 0;
    let maxConsecutive = 0;

    for (let d = 0; d < numDays; d++) {
      const occupied = [];
      (placements || []).forEach((pl) => {
        if (pl.day_index === d && (pl.teacher_ids || []).includes(teacherId)) {
          dailyHours[d] += Number(pl.length || 0);
          for (let k = 0; k < pl.length; k++) occupied.push(pl.start_period + k);
        }
      });
      if (occupied.length > 0) {
        workingDays++;
        const uniq = Array.from(new Set(occupied)).sort((a, b) => a - b);
        if (uniq.length >= 2) {
          const minP = uniq[0];
          const maxP = uniq[uniq.length - 1];
          const occSet = new Set(uniq);
          for (let p = minP + 1; p < maxP; p++) {
            if (!occSet.has(p)) totalGaps++;
          }
        }
        let run = 0, prev = -2;
        for (const p of uniq) {
          run = (p === prev + 1) ? run + 1 : 1;
          prev = p;
          if (run > maxConsecutive) maxConsecutive = run;
        }
      }
    }

    return {
      totalHours: dailyHours.reduce((a, b) => a + b, 0),
      dailyHours,
      workingDays,
      totalGaps,
      maxConsecutive
    };
  }

  function computeDetailedReports(state, helpers, editorLogic) {
    const classes = helpers.getCurrentClasses();
    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const gridStats = helpers.getSlotStats();
    const numDays = gridStats.activeDayIndices.length;
    const periods = state.grid.periodsPerDay;
    const openSlotsPerWeek = gridStats.openTotal || (numDays * periods);
    const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];

    const auditIssues = editorLogic ? editorLogic.auditScheduleLocal(state, helpers) : [];
    const errorIssues = auditIssues.filter((i) => i.severity === 'error');

    // 1. Öğretmen Yük Raporu
    const teacherRows = teachers.map((t) => {
      const m = computeTeacherDayMetrics(t.id, placements, numDays);
      return {
        id: t.id,
        name: t.name,
        shortCode: t.shortCode || t.name.slice(0, 3).toUpperCase(),
        branch: t.branch,
        maxWeekly: t.maxHours || 30,
        totalHours: m.totalHours,
        dailyHours: m.dailyHours,
        workingDays: m.workingDays,
        gaps: m.totalGaps,
        maxConsecutive: m.maxConsecutive
      };
    });

    // 2. Sınıf Ders Raporu
    let totalTargetHours = 0;
    let totalPlacedHours = 0;
    const classRows = classes.map((cls) => {
      const courses = cls.courses || [];
      const targetH = courses.reduce((s, c) => s + Number(c.hours || 0), 0);
      const clsPl = placements.filter((p) => p.class_id === cls.id);
      const placedH = clsPl.reduce((s, p) => s + Number(p.length || 0), 0);
      const daily = Array(numDays).fill(0);
      let brokenBlocks = 0;
      clsPl.forEach((p) => {
        if (p.day_index >= 0 && p.day_index < numDays) daily[p.day_index] += Number(p.length || 0);
        if (p.start_period < 0 || p.start_period + p.length > periods) brokenBlocks++;
      });
      totalTargetHours += targetH;
      totalPlacedHours += placedH;
      return {
        id: cls.id,
        name: cls.name,
        gradeKey: cls.gradeKey,
        shift: cls.shift || 'full_day',
        targetHours: targetH,
        placedHours: placedH,
        missingHours: Math.max(0, targetH - placedH),
        dailyHours: daily,
        blockIntegrityOk: brokenBlocks === 0 && placedH === targetH
      };
    });

    // 3. Özel Derslik Raporu
    const roomRows = rooms.map((rm) => {
      const rmPl = placements.filter((p) => p.room_id === rm.id);
      const usedHours = rmPl.reduce((s, p) => s + Number(p.length || 0), 0);
      const cap = Number(rm.capacity || 1);
      const totalCapHours = openSlotsPerWeek * cap;
      const usedCourses = Array.from(new Set(rmPl.map((p) => `${p.class_name} ${p.course_code}`)));

      // Eşzamanlı kullanım ihlali sayısı
      let violations = 0;
      for (let d = 0; d < numDays; d++) {
        const dayPl = rmPl.filter((p) => p.day_index === d);
        for (let p = 0; p < periods; p++) {
          const active = dayPl.filter((x) => p >= x.start_period && p < x.start_period + x.length).length;
          if (active > cap) violations++;
        }
      }
      return {
        id: rm.id,
        name: rm.name,
        roomType: rm.roomType,
        capacity: cap,
        usedHours,
        freeCapacityHours: Math.max(0, totalCapHours - usedHours),
        coursesList: usedCourses,
        violations
      };
    });

    const totalGaps = teacherRows.reduce((s, r) => s + r.gaps, 0);
    const lockedBlocksCount = placements.filter((pl) => {
      if (!editorLogic) return false;
      return editorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds).locked;
    }).length;

    const teacherOverlapCount = errorIssues.filter((e) => e.category === 'Öğretmen Çakışması').length;
    const classOverlapCount = errorIssues.filter((e) => e.category === 'Sınıf Çakışması').length;
    const missingHoursTotal = classRows.reduce((s, r) => s + r.missingHours, 0);

    const summary = {
      totalTeachers: teachers.length,
      totalClasses: classes.length,
      totalRooms: rooms.length,
      totalTargetHours,
      totalPlacedHours,
      missingHoursTotal,
      totalGaps,
      lockedBlocksCount,
      violationCount: errorIssues.length,
      teacherOverlapCount,
      classOverlapCount,
      isValid: placements.length > 0 && errorIssues.length === 0 && missingHoursTotal === 0,
      errorIssues,
      dayNames: gridStats.activeDayIndices.map((d) => DAY_NAMES[d]),
      dayShorts: gridStats.activeDayIndices.map((d) => DAY_SHORT[d])
    };

    return { summary, teacherRows, classRows, roomRows };
  }

  function checkScheduleValidityForExport(state, helpers, editorLogic) {
    const rep = computeDetailedReports(state, helpers, editorLogic);
    const s = rep.summary;
    if (s.isValid) {
      return {
        isValid: true,
        isDraft: false,
        validatedAt: new Date().toLocaleString('tr-TR'),
        message: 'Program doğrulandı: çakışma veya eksik ders saati bulunmuyor.',
        report: rep
      };
    }
    const parts = [];
    if (s.teacherOverlapCount > 0) parts.push(`${s.teacherOverlapCount} öğretmen çakışması`);
    if (s.classOverlapCount > 0) parts.push(`${s.classOverlapCount} sınıf çakışması`);
    if (s.missingHoursTotal > 0) parts.push(`${s.missingHoursTotal} eksik ders saati`);
    const otherErrs = s.violationCount - s.teacherOverlapCount - s.classOverlapCount;
    if (otherErrs > 0) parts.push(`${otherErrs} kısıt/uygunluk ihlali`);
    const detail = parts.length ? parts.join(' ve ') : 'eksik/doğrulanmamış yerleşim';

    return {
      isValid: false,
      isDraft: true,
      validatedAt: new Date().toLocaleString('tr-TR'),
      message: `Programda ${detail} bulundu.`,
      report: rep
    };
  }

  /* =========================================================================
     3. PROFESYONEL HTML / PDF ŞABLON ÜRETİCİLERİ (BÖLÜM 2, 3, 4, 5, 6, 8, 12)
     ========================================================================= */
  function getPrintCss(opts = {}) {
    const pageSize = opts.pageSize === 'A3' ? 'A3' : 'A4';
    const orient = opts.orientation === 'portrait' ? 'portrait' : 'landscape';
    const fontMap = { small: '9.5px', medium: '11px', large: '12.5px' };
    const baseFont = fontMap[opts.fontSize] || '11px';
    const isBw = opts.colorMode === 'bw';

    return `
      @page { size: ${pageSize} ${orient}; margin: 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        margin: 0; padding: 0;
        font-family: "Times New Roman", Times, Georgia, serif;
        font-size: ${baseFont};
        color: #000000;
        background: #ffffff;
      }
      .doc-page {
        page-break-after: always;
        break-after: page;
        padding: 4mm 3mm;
        position: relative;
      }
      .doc-page:last-child { page-break-after: auto; break-after: auto; }
      .draft-banner {
        border: 2px dashed ${isBw ? '#000' : '#dc2626'};
        background: ${isBw ? '#f1f5f9' : '#fef2f2'};
        color: ${isBw ? '#000' : '#991b1b'};
        text-align: center;
        font-weight: 700;
        font-size: 12px;
        padding: 4px 10px;
        margin-bottom: 8px;
        letter-spacing: 0.8px;
      }
      /* Resmi MEB / BİLSA Tarzı Üst Başlık */
      .meb-top-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        text-align: center;
        margin-bottom: 10px;
      }
      .meb-school-title {
        font-size: 1.28em;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: #000000;
        line-height: 1.3;
      }
      .meb-sub-title {
        font-size: 1.12em;
        font-weight: 700;
        color: #000000;
        margin-top: 2px;
      }
      .meb-meta-grid {
        margin-bottom: 8px;
        font-size: 1.02em;
        line-height: 1.45;
      }
      .meb-meta-table {
        border-collapse: collapse;
        width: auto;
      }
      .meb-meta-table td {
        border: none;
        padding: 1px 8px 1px 0;
        vertical-align: top;
      }
      .meb-meta-label { min-width: 96px; }
      .meb-info-strip {
        margin: 6px 0 8px 0;
        font-size: 0.96em;
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
      }
      /* Ana Program ve Çarşaf Tablosu (Siyah İnce Çerçeve + Açık Mavi Saat Başlığı + Gri Gün Sütunu) */
      table.meb-grid {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 12px;
      }
      table.meb-grid th, table.meb-grid td {
        border: 1px solid #000000;
        padding: 3px 3px;
        vertical-align: middle;
        text-align: center;
        word-wrap: break-word;
        overflow-wrap: break-word;
        line-height: 1.2;
      }
      table.meb-grid th.meb-corner {
        border-top: none;
        border-left: none;
        background: transparent;
      }
      table.meb-grid th.meb-period-th {
        background: ${isBw ? '#e5e7eb' : '#d9e1f8'};
        color: #000000;
        font-weight: 400;
        padding: 3px 2px;
      }
      .meb-p-num { font-weight: 700; font-size: 1.02em; }
      .meb-p-time { font-size: 0.88em; white-space: nowrap; }
      table.meb-grid td.meb-day-td {
        background: ${isBw ? '#e5e7eb' : '#d9d9d9'};
        color: #000000;
        font-weight: 700;
        text-align: left;
        padding: 6px 6px;
        white-space: nowrap;
      }
      table.meb-grid td.meb-cell {
        background: #ffffff;
        height: 36px;
        padding: 3px 3px;
      }
      table.meb-grid td.meb-cell-blocked {
        background: #f3f4f6;
        color: #6b7280;
        font-size: 0.85em;
      }
      .meb-cell-top {
        font-weight: 700;
        font-size: 0.96em;
        color: #000000;
      }
      .meb-cell-bottom {
        font-weight: 400;
        font-size: 0.92em;
        color: #000000;
        margin-top: 1px;
      }
      .meb-cell-room {
        font-size: 0.78em;
        color: #374151;
        margin-top: 1px;
      }
      /* Alt Ders Listesi Tablosu */
      .meb-list-heading {
        font-weight: 700;
        font-size: 1.02em;
        margin: 8px 0 3px 0;
      }
      table.meb-course-list {
        width: 88%;
        border-collapse: collapse;
        margin-bottom: 10px;
        font-size: 0.92em;
      }
      table.meb-course-list th, table.meb-course-list td {
        border: 1px solid #000000;
        padding: 2.5px 5px;
        vertical-align: middle;
        line-height: 1.22;
      }
      table.meb-course-list thead th {
        background: ${isBw ? '#e5e7eb' : '#d9e1f8'};
        color: #000000;
        font-weight: 700;
        text-align: center;
      }
      /* Çarşaf Program Stili (Yatay Kompakt) */
      table.meb-carsaf {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 0.76em;
      }
      table.meb-carsaf th, table.meb-carsaf td {
        border: 1px solid #000000;
        padding: 2px 1.5px;
        vertical-align: middle;
        text-align: center;
        word-wrap: break-word;
        overflow-wrap: break-word;
        line-height: 1.12;
      }
      table.meb-carsaf th.meb-day-group {
        background: ${isBw ? '#e5e7eb' : '#d9d9d9'};
        color: #000000;
        font-weight: 700;
        font-size: 1.15em;
        padding: 3px 2px;
      }
      table.meb-carsaf th.meb-carsaf-p {
        background: ${isBw ? '#f3f4f6' : '#c9d7f5'};
        color: #000000;
        font-weight: 400;
        font-size: 0.86em;
        padding: 2px 1px;
      }
      table.meb-carsaf td.meb-entity-td {
        background: ${isBw ? '#e5e7eb' : '#d1d5db'};
        color: #000000;
        font-weight: 700;
        text-align: left;
        padding: 3px 4px;
        font-size: 0.96em;
      }
      table.meb-carsaf td.meb-entity-class {
        text-align: center;
        font-size: 1.12em;
      }
      .meb-day-sep-left { border-left: 2px solid #000000 !important; }
      .meb-day-sep-right { border-right: 2px solid #000000 !important; }
      .meb-carsaf-top { font-weight: 700; font-size: 0.94em; color: #000000; }
      .meb-carsaf-bot { font-weight: 400; font-size: 0.88em; color: #000000; }
      /* Resmi Alt Metin ve İmza Düzeni */
      .meb-effective-line {
        margin: 10px 0 14px 0;
        font-size: 0.98em;
      }
      .meb-sig-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0 18px 0 36px;
        font-size: 0.98em;
        line-height: 1.45;
      }
      .meb-sig-left { text-align: left; min-width: 190px; }
      .meb-sig-right { text-align: center; min-width: 180px; margin-top: 26px; }
      .meb-metrics-note {
        margin-top: 6px;
        font-size: 0.82em;
        color: #374151;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      /* Raporlar için standart tablo */
      .doc-header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 10px;
      }
      .doc-header-center { text-align: center; flex: 1; }
      .doc-school { font-size: 1.25em; font-weight: 700; text-transform: uppercase; }
      .doc-year { font-size: 0.95em; font-weight: 600; margin-top: 2px; }
      .doc-title { font-size: 1.1em; font-weight: 700; margin-top: 2px; }
      table.tt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      table.tt-table th, table.tt-table td { border: 1px solid #000000; padding: 3.5px 5px; vertical-align: middle; word-wrap: break-word; }
      table.tt-table thead th { background: ${isBw ? '#e5e7eb' : '#d9e1f8'}; color: #000000; font-weight: 700; text-align: center; }
      .summary-strip {
        margin-top: 8px; display: flex; flex-wrap: wrap; gap: 12px;
        font-size: 0.88em; border: 1px solid #000000; padding: 5px 8px; background: #f9fafb;
      }
      .doc-footer {
        margin-top: 10px; font-size: 0.78em; color: #4b5563;
        display: flex; justify-content: space-between; border-top: 1px solid #d1d5db; padding-top: 4px;
      }
    `;
  }

  function renderHeaderBlock(state, titleText, isDraft) {
    const es = { ...createDefaultExportSettings(), ...(state.exportSettings || {}) };
    const schoolName = (state.school && state.school.name) || 'OKUL DERS DAĞITIM PROGRAMI';
    const year = (state.school && state.school.academicYear) || '2026–2027';
    const dateStr = es.showDate ? new Date().toLocaleDateString('tr-TR') : '';
    const logoHtml = (es.showLogo && es.logoDataUrl)
      ? `<img src="${es.logoDataUrl}" alt="Logo" style="height:44px;width:auto;object-fit:contain;" />`
      : `<div style="width:44px;"></div>`;

    return `
      ${isDraft ? `<div class="draft-banner">TASLAK – DOĞRULANMAMIŞ PROGRAM</div>` : ''}
      <div class="doc-header">
        ${logoHtml}
        <div class="doc-header-center">
          <div class="doc-school">${escapeHtml(schoolName)}</div>
          <div class="doc-year">${escapeHtml(year)} Eğitim Öğretim Yılı</div>
          <div class="doc-title">${escapeHtml(es.customTitle ? `${es.customTitle} — ${titleText}` : titleText)}</div>
        </div>
        <div style="min-width:75px;text-align:right;font-size:0.84em;">${escapeHtml(dateStr)}</div>
      </div>
    `;
  }

  function renderFooterBlock(state, isDraft, pageNum, totalPages) {
    const es = { ...createDefaultExportSettings(), ...(state.exportSettings || {}) };
    const left = es.footerText ? escapeHtml(es.footerText) : (isDraft ? 'TASLAK ÇIKTI' : '');
    const right = totalPages && totalPages > 1 ? `Sayfa ${pageNum} / ${totalPages}` : '';
    if (!left && !right) return '';
    return `<div class="doc-footer"><span>${left}</span><span>${right}</span></div>`;
  }

  function getTeacherInitials(t) {
    if (!t) return '';
    if (t.shortCode && String(t.shortCode).trim()) return String(t.shortCode).trim();
    const parts = String(t.name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return parts.map((p) => p[0]).join('').toLocaleUpperCase('tr-TR');
    }
    return String(t.name || '').slice(0, 3).toLocaleUpperCase('tr-TR');
  }

  function formatTeacherForCell(teacherIds, tMap, mode) {
    if (mode === 'hidden') return '';
    return (teacherIds || []).map((id) => {
      const t = tMap[id];
      if (!t) return '';
      return mode === 'code' ? getTeacherInitials(t) : t.name;
    }).filter(Boolean).join(', ');
  }

  function formatSchoolDirectorateTitle(schoolName) {
    const raw = String(schoolName || 'OKUL DERS DAĞITIM PROGRAMI').trim();
    if (/müdürlüğü$/i.test(raw)) return raw;
    return `${raw} MÜDÜRLÜĞÜ`;
  }

  function formatDateSlashTr(dateObj) {
    const d = dateObj || new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Aynı gün içinde ardışık blokları colspan ile yatay birleştirir (örnek şablonlardaki gibi).
   */
  function renderMergedDayCells(periods, origDay, cIdx, state, lookupFn, renderCellFn, renderEmptyFn, extraDayBoundary = false) {
    let html = '';
    let p = 0;
    while (p < periods) {
      const isFirst = p === 0;
      const slotStatus = (state.grid.slots[origDay] && state.grid.slots[origDay][p]) || 'ACTIVE';
      if (slotStatus === 'BLOCKED') {
        const clsBorder = extraDayBoundary && isFirst ? ' meb-day-sep-left' : '';
        html += `<td class="meb-cell meb-cell-blocked${clsBorder}">Kapalı</td>`;
        p += 1;
        continue;
      }
      const pl = lookupFn(cIdx, p);
      if (!pl) {
        const clsBorder = extraDayBoundary && isFirst ? ' meb-day-sep-left' : '';
        html += renderEmptyFn(origDay, p, clsBorder);
        p += 1;
        continue;
      }
      // Aynı yerleştirme bloğunun (veya aynı ders+sınıf+öğretmen ardışık saatinin) süresini hesapla
      let span = 1;
      while (p + span < periods) {
        const nextStatus = (state.grid.slots[origDay] && state.grid.slots[origDay][p + span]) || 'ACTIVE';
        if (nextStatus === 'BLOCKED') break;
        const nextPl = lookupFn(cIdx, p + span);
        if (!nextPl) break;
        const sameBlock = (nextPl === pl) || (
          nextPl.assignment_id && pl.assignment_id && nextPl.assignment_id === pl.assignment_id && nextPl.block_index === pl.block_index
        );
        if (!sameBlock) break;
        span += 1;
      }
      const clsBorder = extraDayBoundary && isFirst ? ' meb-day-sep-left' : '';
      html += renderCellFn(pl, span, clsBorder);
      p += span;
    }
    return html;
  }

  function buildPlacementSummaryRows(placements, groupByKeyFn) {
    const map = new Map();
    (placements || []).forEach((pl) => {
      const key = groupByKeyFn(pl);
      if (!map.has(key)) {
        map.set(key, {
          courseCode: pl.course_code || '',
          courseName: pl.course_name || pl.course_code || '',
          className: pl.class_name || '',
          teacherIds: new Set(pl.teacher_ids || []),
          blocks: [],
          totalHours: 0
        });
      }
      const rec = map.get(key);
      (pl.teacher_ids || []).forEach((tid) => rec.teacherIds.add(tid));
      const len = Number(pl.length || 0);
      if (len > 0) {
        rec.blocks.push(len);
        rec.totalHours += len;
      }
    });
    return Array.from(map.values()).map((r) => {
      r.blocks.sort((a, b) => b - a);
      return {
        ...r,
        placementPattern: r.blocks.join('+'),
        teacherIds: Array.from(r.teacherIds)
      };
    }).sort((a, b) => (b.totalHours - a.totalHours) || a.className.localeCompare(b.className, 'tr') || a.courseName.localeCompare(b.courseName, 'tr'));
  }

  /* =========================================================================
     ŞABLON 1: SINIF DERS PROGRAMI (Örnek MEB Şablonu: Günler Satır, Saatler Sütun + Alt Ders Listesi)
     ========================================================================= */
  function buildClassTimetablePageHtml(state, cls, helpers, isDraft, pageIdx, totalPages) {
    const es = { ...createDefaultExportSettings(), ...(state.exportSettings || {}) };
    const gridStats = helpers.getSlotStats();
    const periods = state.grid.periodsPerDay;
    const bell = helpers.computeBellSchedule ? helpers.computeBellSchedule() : { primary: [], afternoon: null, isDouble: false };
    const isAfternoon = bell.isDouble && cls.shift === 'afternoon' && bell.afternoon;
    const scheduleArr = isAfternoon ? bell.afternoon : bell.primary;
    const shiftLabel = bell.isDouble ? (cls.shift === 'afternoon' ? 'Öğlenci Devresi' : 'Sabahçı Devresi') : '';

    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const rMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const placements = ((state.solution && state.solution.placements) || []).filter((p) => p.class_id === cls.id);

    const cellMap = {};
    let totalHours = 0;
    placements.forEach((pl) => {
      totalHours += Number(pl.length || 0);
      for (let k = 0; k < pl.length; k++) cellMap[`${pl.day_index}_${pl.start_period + k}`] = pl;
    });

    const periodHeadersHtml = Array.from({ length: periods }, (_, pIdx) => {
      const b = scheduleArr[pIdx] || { period: pIdx + 1, start: '', end: '' };
      return `
        <th class="meb-period-th">
          <div class="meb-p-num">${b.period}</div>
          <div class="meb-p-time">${escapeHtml(b.start)}</div>
          <div class="meb-p-time">${escapeHtml(b.end)}</div>
          <span style="display:none;">${escapeHtml(b.start)}–${escapeHtml(b.end)}</span>
        </th>
      `;
    }).join('');

    const dayRowsHtml = gridStats.activeDayIndices.map((origDay, cIdx) => {
      const cells = renderMergedDayCells(
        periods,
        origDay,
        cIdx,
        state,
        (dIdx, pIdx) => cellMap[`${dIdx}_${pIdx}`],
        (pl, span) => {
          const tShort = formatTeacherForCell(pl.teacher_ids, tMap, es.teacherDisplay === 'hidden' ? 'hidden' : (es.teacherDisplay === 'full' ? 'code' : es.teacherDisplay));
          const rText = pl.room_id && rMap[pl.room_id] ? rMap[pl.room_id].name : '';
          return `
            <td class="meb-cell"${span > 1 ? ` colspan="${span}"` : ''}>
              <div class="meb-cell-top">${escapeHtml(pl.course_code || pl.course_name)}</div>
              ${tShort ? `<div class="meb-cell-bottom">${escapeHtml(tShort)}</div>` : ''}
              ${rText ? `<div class="meb-cell-room">${escapeHtml(rText)}</div>` : ''}
            </td>
          `;
        },
        () => `<td class="meb-cell"></td>`,
        false
      );
      return `<tr><td class="meb-day-td">${DAY_NAMES[origDay]}</td>${cells}</tr>`;
    }).join('');

    const summaryRows = buildPlacementSummaryRows(placements, (pl) => pl.assignment_id || `${pl.course_code}__${pl.course_name}`);
    const summaryTableHtml = `
      <table class="meb-course-list">
        <thead>
          <tr>
            <th style="width:28px;">S</th>
            <th style="width:70px;">Ders</th>
            <th>Ders Adı</th>
            <th style="width:170px;">Öğretmenler</th>
            <th style="width:74px;">Yerleşim</th>
            <th style="width:42px;">Saat</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map((row, idx) => {
            const fullTeachers = formatTeacherForCell(row.teacherIds, tMap, es.teacherDisplay === 'hidden' ? 'hidden' : 'full');
            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td style="text-align:center;">${escapeHtml(row.courseCode)}</td>
                <td>${escapeHtml(row.courseName)}</td>
                <td>${escapeHtml(fullTeachers || '-')}</td>
                <td style="text-align:center;">${escapeHtml(row.placementPattern)}</td>
                <td style="text-align:center;">${row.totalHours}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const schoolName = (state.school && state.school.name) || 'OKUL DERS DAĞITIM PROGRAMI';
    const advisorName = cls.advisorTeacher || '-';
    const principal = (es.principalName || '').trim();
    const dateStr = formatDateSlashTr(new Date());
    const logoHtml = (es.showLogo && es.logoDataUrl)
      ? `<img src="${es.logoDataUrl}" alt="Logo" style="height:40px;width:auto;object-fit:contain;" />`
      : '';

    return `
      <div class="doc-page">
        ${isDraft ? `<div class="draft-banner">TASLAK – DOĞRULANMAMIŞ PROGRAM</div>` : ''}
        <div class="meb-top-header">
          ${logoHtml}
          <div>
            <div class="meb-school-title">${escapeHtml(schoolName)}</div>
            <div class="meb-sub-title">${escapeHtml(es.customTitle || 'Sınıflar Ders Programı')}</div>
          </div>
        </div>
        <div class="meb-meta-grid">
          <table class="meb-meta-table">
            <tr><td class="meb-meta-label">Sınıf/Grup</td><td>: ${escapeHtml(cls.name)}${cls.homeRoom ? ` (${escapeHtml(cls.homeRoom)})` : ''}${shiftLabel ? ` — ${escapeHtml(shiftLabel)}` : ''}</td></tr>
            <tr><td class="meb-meta-label">Toplam Saat</td><td>: ${totalHours}</td></tr>
            <tr><td class="meb-meta-label">Sınıf Rehber Öğretmeni</td><td>: ${escapeHtml(advisorName)}</td></tr>
          </table>
        </div>
        <table class="meb-grid">
          <thead>
            <tr>
              <th class="meb-corner" style="width:90px;"></th>
              ${periodHeadersHtml}
            </tr>
          </thead>
          <tbody>${dayRowsHtml}</tbody>
        </table>
        ${summaryTableHtml}
        ${es.showDate ? `<div class="meb-effective-line">Yukarıdaki program ${escapeHtml(dateStr)} tarihinden itibaren geçerli olacaktır.</div>` : ''}
        ${es.showSignatures ? `
          <div class="meb-sig-wrap">
            <div class="meb-sig-left"></div>
            <div class="meb-sig-right">
              <div>${principal ? escapeHtml(principal) : '................................'}</div>
              <div>Okul Müdürü</div>
            </div>
          </div>
        ` : ''}
        ${renderFooterBlock(state, isDraft, pageIdx, totalPages)}
      </div>
    `;
  }

  /* =========================================================================
     ŞABLON 2: ÖĞRETMEN DERS PROGRAMI (Örnek MEB Şablonu: Günler Satır + Ders Listesi + Aslını Aldım)
     ========================================================================= */
  function buildTeacherTimetablePageHtml(state, teacher, helpers, isDraft, pageIdx, totalPages) {
    const es = { ...createDefaultExportSettings(), ...(state.exportSettings || {}) };
    const gridStats = helpers.getSlotStats();
    const periods = state.grid.periodsPerDay;
    const bell = helpers.computeBellSchedule ? helpers.computeBellSchedule() : { primary: [], afternoon: null, isDouble: false };
    const rooms = helpers.getCurrentRooms();
    const rMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const allPl = (state.solution && state.solution.placements) || [];
    const placements = allPl.filter((p) => (p.teacher_ids || []).includes(teacher.id));
    const metrics = computeTeacherDayMetrics(teacher.id, allPl, gridStats.activeDayIndices.length);

    const cellMap = {};
    placements.forEach((pl) => {
      for (let k = 0; k < pl.length; k++) cellMap[`${pl.day_index}_${pl.start_period + k}`] = pl;
    });

    const periodHeadersHtml = Array.from({ length: periods }, (_, pIdx) => {
      const b = bell.primary[pIdx] || { period: pIdx + 1, start: '', end: '' };
      return `
        <th class="meb-period-th">
          <div class="meb-p-num">${b.period}</div>
          <div class="meb-p-time">${escapeHtml(b.start)}</div>
          <div class="meb-p-time">${escapeHtml(b.end)}</div>
        </th>
      `;
    }).join('');

    const dayRowsHtml = gridStats.activeDayIndices.map((origDay, cIdx) => {
      const cells = renderMergedDayCells(
        periods,
        origDay,
        cIdx,
        state,
        (dIdx, pIdx) => cellMap[`${dIdx}_${pIdx}`],
        (pl, span) => {
          const rText = pl.room_id && rMap[pl.room_id] ? rMap[pl.room_id].name : '';
          return `
            <td class="meb-cell"${span > 1 ? ` colspan="${span}"` : ''}>
              <div class="meb-cell-top">${escapeHtml(pl.class_name)}</div>
              <div class="meb-cell-bottom">${escapeHtml(pl.course_code || pl.course_name)}</div>
              ${rText ? `<div class="meb-cell-room">${escapeHtml(rText)}</div>` : ''}
            </td>
          `;
        },
        () => `<td class="meb-cell"></td>`,
        false
      );
      return `<tr><td class="meb-day-td">${DAY_NAMES[origDay]}</td>${cells}</tr>`;
    }).join('');

    const summaryRows = buildPlacementSummaryRows(placements, (pl) => `${pl.class_name}__${pl.assignment_id || pl.course_code}`);
    const summaryTableHtml = `
      <div class="meb-list-heading">Ders Listesi:</div>
      <table class="meb-course-list">
        <thead>
          <tr>
            <th style="width:28px;">S</th>
            <th style="width:72px;">Ders</th>
            <th>Ders Adı</th>
            <th style="width:76px;">Sınıflar</th>
            <th style="width:74px;">Yerleşim</th>
            <th style="width:42px;">Saat</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map((row, idx) => `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td style="text-align:center;">${escapeHtml(row.courseCode)}</td>
              <td>${escapeHtml(row.courseName)}</td>
              <td style="text-align:center;">${escapeHtml(row.className)}</td>
              <td style="text-align:center;">${escapeHtml(row.placementPattern)}</td>
              <td style="text-align:center;">${row.totalHours}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const schoolTitle = formatSchoolDirectorateTitle((state.school && state.school.name) || 'OKUL DERS DAĞITIM PROGRAMI');
    const principal = (es.principalName || '').trim();
    const dateStr = formatDateSlashTr(new Date());
    const isAdmin = teacher.role === 'mudur' || teacher.role === 'mudur_yardimcisi';
    let dutyText = '-';
    if (!isAdmin && typeof teacher.dutyDay === 'number' && teacher.dutyDay >= 0 && DAY_NAMES[teacher.dutyDay]) {
      dutyText = DAY_NAMES[teacher.dutyDay].toLocaleUpperCase('tr-TR') + (teacher.dutyLocation ? ` / ${teacher.dutyLocation}` : '');
    } else if (!isAdmin && typeof teacher.dutyDay === 'string' && teacher.dutyDay.trim() && teacher.dutyDay !== '-1') {
      dutyText = teacher.dutyDay.trim();
    }
    const guidanceClass = teacher.guidanceClass || '-';
    const clubText = teacher.socialClub || '-';
    const logoHtml = (es.showLogo && es.logoDataUrl)
      ? `<img src="${es.logoDataUrl}" alt="Logo" style="height:40px;width:auto;object-fit:contain;" />`
      : '';

    return `
      <div class="doc-page">
        ${isDraft ? `<div class="draft-banner">TASLAK – DOĞRULANMAMIŞ PROGRAM</div>` : ''}
        <div class="meb-top-header">
          ${logoHtml}
          <div class="meb-school-title">${escapeHtml(schoolTitle)}</div>
        </div>
        <div class="meb-meta-grid">
          <table class="meb-meta-table">
            <tr><td class="meb-meta-label">Sayı</td><td>:</td></tr>
            <tr><td class="meb-meta-label">Öğretmen</td><td>: ${escapeHtml(teacher.name)}</td></tr>
            <tr><td class="meb-meta-label">Toplam Saat</td><td>: ${metrics.totalHours}</td></tr>
          </table>
        </div>
        <div class="meb-info-strip">
          <span>Nöbet Günü: ${escapeHtml(dutyText)}</span>
          <span>Sınıf Rehberliği: ${escapeHtml(guidanceClass)}</span>
          <span>Sosyal Kulüp: ${escapeHtml(clubText)}</span>
        </div>
        <table class="meb-grid">
          <thead>
            <tr>
              <th class="meb-corner" style="width:90px;"></th>
              ${periodHeadersHtml}
            </tr>
          </thead>
          <tbody>${dayRowsHtml}</tbody>
        </table>
        ${summaryTableHtml}
        ${es.showDate ? `<div class="meb-effective-line">Yukarıdaki dersler ${escapeHtml(dateStr)} tarihinden itibaren uygulanacaktır. Bilgilerinizi rica ederim.</div>` : ''}
        ${es.showSignatures ? `
          <div class="meb-sig-wrap">
            <div class="meb-sig-left">
              <div>${escapeHtml(dateStr)}</div>
              <div>Aslını Aldım</div>
              <div>${escapeHtml(teacher.name)}</div>
            </div>
            <div class="meb-sig-right">
              <div>${principal ? escapeHtml(principal) : '................................'}</div>
              <div>Okul Müdürü</div>
            </div>
          </div>
        ` : ''}
        ${es.showTeacherTotals ? `
          <div class="meb-metrics-note">
            <span>Çalışma Günü: ${metrics.workingDays}</span>
            <span>Haftalık Boş Pencere: ${metrics.totalGaps}</span>
            <span>Maks. Ardışık: ${metrics.maxConsecutive} sa</span>
          </div>
        ` : ''}
        ${renderFooterBlock(state, isDraft, pageIdx, totalPages)}
      </div>
    `;
  }

  /* =========================================================================
     ŞABLON 3 & 4: SINIF ÇARŞAF VE ÖĞRETMEN ÇARŞAF PROGRAMI (Yatay MEB Çarşaf + Blok Colspan)
     ========================================================================= */
  function buildCarsafPagesHtml(state, mode, helpers, isDraft, filterOpts = {}) {
    const es = { ...createDefaultExportSettings(), ...(state.exportSettings || {}) };
    const gridStats = helpers.getSlotStats();
    const periods = state.grid.periodsPerDay;
    const bell = helpers.computeBellSchedule ? helpers.computeBellSchedule() : { primary: [], afternoon: null, isDouble: false };
    const placements = (state.solution && state.solution.placements) || [];
    const teachers = helpers.getCurrentTeachers();
    const classes = helpers.getCurrentClasses();
    const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const schoolName = (state.school && state.school.name) || '';

    const allDays = gridStats.activeDayIndices.map((origDay, cIdx) => ({ origDay, cIdx, name: DAY_NAMES[origDay] }));
    const dayChunks = (es.pageSize === 'A4' && es.splitA4Sheets && allDays.length > 3)
      ? [allDays.slice(0, 3), allDays.slice(3)]
      : [allDays];

    function buildPeriodSubheaders(dChunk) {
      return dChunk.map(() =>
        Array.from({ length: periods }, (_, p) => {
          const b = bell.primary[p] || { period: p + 1, start: '', end: '' };
          return `
            <th class="meb-carsaf-p${p === 0 ? ' meb-day-sep-left' : ''}">
              <div style="font-weight:700;">${b.period}</div>
              <div>${escapeHtml(b.start)}</div>
              <div>${escapeHtml(b.end)}</div>
            </th>
          `;
        }).join('')
      ).join('');
    }

    if (mode === 'class_sheet') {
      let targetClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      if (filterOpts.gradeKey && filterOpts.gradeKey !== 'ALL') {
        targetClasses = targetClasses.filter((c) => c.gradeKey === filterOpts.gradeKey);
      }
      if (Array.isArray(filterOpts.selectedIds) && filterOpts.selectedIds.length) {
        targetClasses = targetClasses.filter((c) => filterOpts.selectedIds.includes(c.id));
      }

      const cellMap = {};
      placements.forEach((pl) => {
        if (!cellMap[pl.class_id]) cellMap[pl.class_id] = {};
        for (let k = 0; k < pl.length; k++) cellMap[pl.class_id][`${pl.day_index}_${pl.start_period + k}`] = pl;
      });

      const pages = [];
      dayChunks.forEach((dChunk, chunkIdx) => {
        const dayTitle = dayChunks.length > 1 ? ` (${dChunk.map((d) => d.name).join(' - ')})` : '';
        const rowsHtml = targetClasses.map((cls) => {
          const tds = dChunk.map(({ origDay, cIdx }) =>
            renderMergedDayCells(
              periods,
              origDay,
              cIdx,
              state,
              (dIdx, pIdx) => cellMap[cls.id] && cellMap[cls.id][`${dIdx}_${pIdx}`],
              (pl, span, clsBorder) => {
                const tCode = formatTeacherForCell(pl.teacher_ids, tMap, es.teacherDisplay === 'hidden' ? 'hidden' : 'code');
                return `
                  <td class="${clsBorder.trim()}"${span > 1 ? ` colspan="${span}"` : ''}>
                    <div class="meb-carsaf-top">${escapeHtml(pl.course_code || pl.course_name)}</div>
                    ${tCode ? `<div class="meb-carsaf-bot">${escapeHtml(tCode)}</div>` : ''}
                  </td>
                `;
              },
              (_origDay, _p, clsBorder) => `<td class="${clsBorder.trim()}"></td>`,
              true
            )
          ).join('');
          return `<tr><td class="meb-entity-td meb-entity-class">${escapeHtml(cls.name)}</td>${tds}</tr>`;
        }).join('');

        pages.push(`
          <div class="doc-page">
            ${isDraft ? `<div class="draft-banner">TASLAK – DOĞRULANMAMIŞ PROGRAM</div>` : ''}
            <div class="meb-top-header" style="margin-bottom:6px;">
              <div class="meb-sub-title">${escapeHtml(schoolName ? `${schoolName} - Sınıflar Ders Programı${dayTitle}` : `Sınıflar Ders Programı${dayTitle}`)}</div>
            </div>
            <table class="meb-carsaf">
              <thead>
                <tr>
                  <th class="meb-corner" rowspan="2" style="width:44px;border-top:none;border-left:none;"></th>
                  ${dChunk.map((d) => `<th class="meb-day-group meb-day-sep-left" colspan="${periods}">${d.name}</th>`).join('')}
                </tr>
                <tr>
                  ${buildPeriodSubheaders(dChunk)}
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            ${renderFooterBlock(state, isDraft, chunkIdx + 1, dayChunks.length)}
          </div>
        `);
      });
      return pages.join('');
    }

    // Öğretmen Çarşaf Programı
    let targetTeachers = [...teachers];
    if (filterOpts.branch && filterOpts.branch !== 'ALL') {
      targetTeachers = targetTeachers.filter((t) => t.branch === filterOpts.branch);
    }
    if (Array.isArray(filterOpts.selectedIds) && filterOpts.selectedIds.length) {
      targetTeachers = targetTeachers.filter((t) => filterOpts.selectedIds.includes(t.id));
    }

    const cellMap = {};
    placements.forEach((pl) => {
      (pl.teacher_ids || []).forEach((tid) => {
        if (!cellMap[tid]) cellMap[tid] = {};
        for (let k = 0; k < pl.length; k++) cellMap[tid][`${pl.day_index}_${pl.start_period + k}`] = pl;
      });
    });

    const pages = [];
    dayChunks.forEach((dChunk, chunkIdx) => {
      const dayTitle = dayChunks.length > 1 ? ` (${dChunk.map((d) => d.name).join(' - ')})` : '';
      const rowsHtml = targetTeachers.map((t) => {
        const tds = dChunk.map(({ origDay, cIdx }) =>
          renderMergedDayCells(
            periods,
            origDay,
            cIdx,
            state,
            (dIdx, pIdx) => cellMap[t.id] && cellMap[t.id][`${dIdx}_${pIdx}`],
            (pl, span, clsBorder) => `
              <td class="${clsBorder.trim()}"${span > 1 ? ` colspan="${span}"` : ''}>
                <div class="meb-carsaf-top">${escapeHtml(pl.class_name)}</div>
                <div class="meb-carsaf-bot">${escapeHtml(pl.course_code || pl.course_name)}</div>
              </td>
            `,
            (_origDay, _p, clsBorder) => `<td class="${clsBorder.trim()}"></td>`,
            true
          )
        ).join('');
        return `<tr><td class="meb-entity-td">${escapeHtml(t.name)}</td>${tds}</tr>`;
      }).join('');

      pages.push(`
        <div class="doc-page">
          ${isDraft ? `<div class="draft-banner">TASLAK – DOĞRULANMAMIŞ PROGRAM</div>` : ''}
          ${dayTitle || schoolName ? `<div class="meb-top-header" style="margin-bottom:5px;"><div class="meb-sub-title">${escapeHtml(schoolName ? `${schoolName} - Öğretmen Çarşaf Programı${dayTitle}` : `Öğretmen Çarşaf Programı${dayTitle}`)}</div></div>` : ''}
          <table class="meb-carsaf">
            <thead>
              <tr>
                <th class="meb-corner" rowspan="2" style="width:105px;border-top:none;border-left:none;"></th>
                ${dChunk.map((d) => `<th class="meb-day-group meb-day-sep-left" colspan="${periods}">${d.name}</th>`).join('')}
              </tr>
              <tr>
                ${buildPeriodSubheaders(dChunk)}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${renderFooterBlock(state, isDraft, chunkIdx + 1, dayChunks.length)}
        </div>
      `);
    });
    return pages.join('');
  }

  function buildQualityReportPageHtml(state, helpers, editorLogic, isDraft) {
    const rep = computeDetailedReports(state, helpers, editorLogic);
    const s = rep.summary;

    return `
      <div class="doc-page">
        ${renderHeaderBlock(state, 'Genel Program Kalite ve Yük Raporu', isDraft)}
        <div class="summary-strip">
          <span><strong>Toplam Şube:</strong> ${s.totalClasses}</span>
          <span><strong>Toplam Öğretmen:</strong> ${s.totalTeachers}</span>
          <span><strong>Yerleşen / Hedef Saat:</strong> ${s.totalPlacedHours} / ${s.totalTargetHours} sa</span>
          <span><strong>Eksik Saat:</strong> ${s.missingHoursTotal} sa</span>
          <span><strong>Toplam Boş Pencere:</strong> ${s.totalGaps}</span>
          <span><strong>Kilitli Blok:</strong> ${s.lockedBlocksCount}</span>
          <span><strong>Çakışma / İhlal:</strong> ${s.violationCount}</span>
        </div>

        <h4 style="margin:12px 0 4px;font-size:1em;">1. Öğretmen Yük ve Pencere Raporu</h4>
        <table class="tt-table">
          <thead>
            <tr>
              <th>Öğretmen</th><th>Branş</th><th>Haftalık Saat</th>
              ${s.dayShorts.map((ds) => `<th style="width:38px;">${ds}</th>`).join('')}
              <th>Çalıştığı Gün</th><th>Boş Pencere</th><th>Maks. Ardışık</th>
            </tr>
          </thead>
          <tbody>
            ${rep.teacherRows.map((r) => `
              <tr>
                <td style="font-weight:700;">${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.branch)}</td>
                <td style="text-align:center;font-weight:700;">${r.totalHours} / ${r.maxWeekly}</td>
                ${r.dailyHours.map((dh) => `<td style="text-align:center;">${dh}</td>`).join('')}
                <td style="text-align:center;">${r.workingDays}</td>
                <td style="text-align:center;font-weight:700;">${r.gaps}</td>
                <td style="text-align:center;">${r.maxConsecutive}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h4 style="margin:12px 0 4px;font-size:1em;">2. Sınıf Ders Dağılım Raporu</h4>
        <table class="tt-table">
          <thead>
            <tr>
              <th>Şube</th><th>Hedef Saat</th><th>Yerleşen Saat</th><th>Eksik Saat</th>
              ${s.dayShorts.map((ds) => `<th style="width:38px;">${ds}</th>`).join('')}
              <th>Blok Bütünlüğü</th>
            </tr>
          </thead>
          <tbody>
            ${rep.classRows.map((c) => `
              <tr>
                <td style="font-weight:700;">${escapeHtml(c.name)}</td>
                <td style="text-align:center;">${c.targetHours}</td>
                <td style="text-align:center;font-weight:700;">${c.placedHours}</td>
                <td style="text-align:center;">${c.missingHours}</td>
                ${c.dailyHours.map((dh) => `<td style="text-align:center;">${dh}</td>`).join('')}
                <td style="text-align:center;font-weight:700;">${c.blockIntegrityOk ? 'Tam' : 'Eksik/Sorunlu'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${renderSignatureBlock(state)}
        ${renderFooterBlock(state, isDraft, 1, 1)}
      </div>
    `;
  }

  function wrapFullPrintableHtml(pagesHtml, exportSettings = {}) {
    return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8" /><title>Ders Programı Çıktısı</title><style>${getPrintCss(exportSettings)}</style></head><body>${pagesHtml}</body></html>`;
  }

  /* =========================================================================
     4. GERÇEK EXCEL (.XLSX) 7 SAYFALI ÇALIŞMA KİTABI ÜRETİCİ (BÖLÜM 7)
     ========================================================================= */
  function applySheetFormatting(ws, colWidths, hasAutoFilter = true) {
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
    if (hasAutoFilter && ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }
    ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
    return ws;
  }

  function buildExcelWorkbook(XLSX, state, helpers, editorLogic) {
    const valInfo = checkScheduleValidityForExport(state, helpers, editorLogic);
    const rep = valInfo.report;
    const gridStats = helpers.getSlotStats();
    const periods = state.grid.periodsPerDay;
    const classes = helpers.getCurrentClasses();
    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
    const tNameMap = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
    const tShortMap = Object.fromEntries(teachers.map((t) => [t.id, t.shortCode || t.name.slice(0, 3).toUpperCase()]));
    const rNameMap = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
    const bell = helpers.computeBellSchedule ? helpers.computeBellSchedule() : { primary: [] };

    const wb = XLSX.utils.book_new();
    const draftPrefix = valInfo.isDraft ? ' [TASLAK - DOGRULANMAMIS]' : '';

    // 1. Sınıf Programları
    const s1Rows = [['Şube', 'Gün', 'Ders Sırası', 'Saat Aralığı', 'Ders Kodu', 'Ders Adı', 'Öğretmen', 'Özel Derslik', 'Kilit Durumu'].map(sanitizeExcelCell)];
    placements.forEach((pl) => {
      const origDay = gridStats.activeDayIndices[pl.day_index];
      const dayName = DAY_NAMES[origDay] || `Gün ${pl.day_index + 1}`;
      const tNames = (pl.teacher_ids || []).map((id) => tNameMap[id] || '').filter(Boolean).join(' / ');
      const rName = pl.room_id ? (rNameMap[pl.room_id] || '') : '';
      const locked = editorLogic && editorLogic.isPlacementLocked(pl, state.pinnedPlacementIds, state.lockedTeacherIds).locked ? 'Kilitli' : 'Normal';
      for (let k = 0; k < pl.length; k++) {
        const pIdx = pl.start_period + k;
        const b = bell.primary[pIdx] || { start: '', end: '' };
        s1Rows.push([
          pl.class_name,
          dayName,
          `${pIdx + 1}. Ders`,
          b.start ? `${b.start}-${b.end}` : '',
          pl.course_code,
          pl.course_name,
          tNames,
          rName,
          locked
        ].map(sanitizeExcelCell));
      }
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s1Rows), [12, 14, 12, 14, 12, 28, 26, 18, 12]), 'Sinif Programlari');

    // 2. Öğretmen Programları
    const s2Rows = [['Öğretmen', 'Branş', 'Gün', 'Ders Sırası', 'Şube', 'Ders Kodu', 'Ders Adı', 'Özel Derslik'].map(sanitizeExcelCell)];
    teachers.forEach((t) => {
      const tPl = placements.filter((p) => (p.teacher_ids || []).includes(t.id));
      tPl.forEach((pl) => {
        const origDay = gridStats.activeDayIndices[pl.day_index];
        const dayName = DAY_NAMES[origDay] || `Gün ${pl.day_index + 1}`;
        const rName = pl.room_id ? (rNameMap[pl.room_id] || '') : '';
        for (let k = 0; k < pl.length; k++) {
          s2Rows.push([t.name, t.branch, dayName, `${pl.start_period + k + 1}. Ders`, pl.class_name, pl.course_code, pl.course_name, rName].map(sanitizeExcelCell));
        }
      });
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s2Rows), [24, 22, 14, 12, 10, 12, 28, 18]), 'Ogretmen Programlari');

    // 3. Sınıf Çarşaf
    const s3Header = ['Şube'];
    gridStats.activeDayIndices.forEach((d) => { for (let p = 0; p < periods; p++) s3Header.push(`${DAY_SHORT[d]}-${p + 1}`); });
    s3Header.push('Toplam Saat');
    const s3Rows = [s3Header.map(sanitizeExcelCell)];
    classes.forEach((cls) => {
      const row = [cls.name];
      let tot = 0;
      gridStats.activeDayIndices.forEach((_, cIdx) => {
        for (let p = 0; p < periods; p++) {
          const pl = placements.find((x) => x.class_id === cls.id && x.day_index === cIdx && p >= x.start_period && p < x.start_period + x.length);
          if (pl) {
            tot++;
            const ts = (pl.teacher_ids || []).map((id) => tShortMap[id] || '').filter(Boolean).join('/');
            row.push(`${pl.course_code}${ts ? ' (' + ts + ')' : ''}`);
          } else row.push('');
        }
      });
      row.push(tot);
      s3Rows.push(row.map(sanitizeExcelCell));
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s3Rows), [12, ...Array(gridStats.activeDayIndices.length * periods).fill(11), 12]), 'Sinif Carsaf');

    // 4. Öğretmen Çarşaf
    const s4Header = ['Öğretmen', 'Branş'];
    gridStats.activeDayIndices.forEach((d) => { for (let p = 0; p < periods; p++) s4Header.push(`${DAY_SHORT[d]}-${p + 1}`); });
    s4Header.push('Toplam Saat', 'Boş Pencere');
    const s4Rows = [s4Header.map(sanitizeExcelCell)];
    rep.teacherRows.forEach((tr) => {
      const row = [tr.name, tr.branch];
      gridStats.activeDayIndices.forEach((_, cIdx) => {
        for (let p = 0; p < periods; p++) {
          const pl = placements.find((x) => (x.teacher_ids || []).includes(tr.id) && x.day_index === cIdx && p >= x.start_period && p < x.start_period + x.length);
          row.push(pl ? `${pl.class_name} ${pl.course_code}` : '');
        }
      });
      row.push(tr.totalHours, tr.gaps);
      s4Rows.push(row.map(sanitizeExcelCell));
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s4Rows), [24, 20, ...Array(gridStats.activeDayIndices.length * periods).fill(10), 12, 12]), 'Ogretmen Carsaf');

    // 5. Özel Derslikler
    const s5Rows = [['Derslik Adı', 'Tür', 'Kapasite (Sınıf)', 'Haftalık Kullanım (Saat)', 'Boş Kapasite (Saat)', 'Kullanan Dersler', 'İhlal Sayısı'].map(sanitizeExcelCell)];
    rep.roomRows.forEach((rm) => {
      s5Rows.push([rm.name, rm.roomType, rm.capacity, rm.usedHours, rm.freeCapacityHours, rm.coursesList.join(', '), rm.violations].map(sanitizeExcelCell));
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s5Rows), [22, 18, 16, 22, 20, 42, 14]), 'Ozel Derslikler');

    // 6. Öğretmen Ders Yükleri
    const s6Header = ['Öğretmen Adı', 'Branş', 'Haftalık Ders', 'Maks. Yük', ...rep.summary.dayShorts.map((d) => `${d} (Saat)`), 'Çalıştığı Gün', 'Boş Pencere', 'Maks. Ardışık'].map(sanitizeExcelCell);
    const s6Rows = [s6Header];
    rep.teacherRows.forEach((tr) => {
      s6Rows.push([tr.name, tr.branch, tr.totalHours, tr.maxWeekly, ...tr.dailyHours, tr.workingDays, tr.gaps, tr.maxConsecutive].map(sanitizeExcelCell));
    });
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s6Rows), [24, 22, 14, 12, ...Array(rep.summary.dayShorts.length).fill(10), 14, 14, 14]), 'Ogretmen Ders Yukleri');

    // 7. Program Kalite Raporu
    const s7Rows = [
      ['Gösterge', 'Değer', 'Açıklama'].map(sanitizeExcelCell),
      ['Program Durumu', (valInfo.isValid ? 'DOĞRULANMIŞ GEÇERLİ PROGRAM' : 'TASLAK – DOĞRULANMAMIŞ') + draftPrefix, valInfo.message].map(sanitizeExcelCell),
      ['Doğrulama Zamanı', valInfo.validatedAt, 'Otomatik Dağıtım Motoru'].map(sanitizeExcelCell),
      ['Toplam Şube Sayısı', rep.summary.totalClasses, ''].map(sanitizeExcelCell),
      ['Toplam Öğretmen Sayısı', rep.summary.totalTeachers, ''].map(sanitizeExcelCell),
      ['Haftalık Hedef Ders Yükü', rep.summary.totalTargetHours, 'Saat'].map(sanitizeExcelCell),
      ['Yerleşen Ders Saati', rep.summary.totalPlacedHours, 'Saat'].map(sanitizeExcelCell),
      ['Eksik Ders Saati', rep.summary.missingHoursTotal, 'Saat'].map(sanitizeExcelCell),
      ['Toplam Öğretmen Boş Pencere', rep.summary.totalGaps, 'İlk ve son ders arası boş saatler'].map(sanitizeExcelCell),
      ['Kilitli Ders Bloğu Sayısı', rep.summary.lockedBlocksCount, ''].map(sanitizeExcelCell),
      ['Çakışma ve Kısıt İhlali Sayısı', rep.summary.violationCount, ''].map(sanitizeExcelCell)
    ];
    XLSX.utils.book_append_sheet(wb, applySheetFormatting(XLSX.utils.aoa_to_sheet(s7Rows), [30, 32, 46], false), 'Program Kalite Raporu');

    return { workbook: wb, validation: valInfo };
  }

  return {
    escapeHtml,
    sanitizeWindowsFilename,
    sanitizeExcelCell,
    createDefaultExportSettings,
    EvrakPlusAuthService,
    computeTeacherDayMetrics,
    computeDetailedReports,
    checkScheduleValidityForExport,
    buildClassTimetablePageHtml,
    buildTeacherTimetablePageHtml,
    buildCarsafPagesHtml,
    buildQualityReportPageHtml,
    wrapFullPrintableHtml,
    buildExcelWorkbook
  };
});
