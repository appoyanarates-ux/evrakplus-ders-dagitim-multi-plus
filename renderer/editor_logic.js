'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DersEditorLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  function ensureBlockId(pl) {
    if (!pl) return '';
    if (pl.block_id && typeof pl.block_id === 'string') return pl.block_id;
    if (pl.block_index !== undefined && pl.block_index !== null) {
      pl.block_id = `${pl.assignment_id}__b${pl.block_index}`;
      return pl.block_id;
    }
    return `${pl.assignment_id}__d${pl.day_index}_p${pl.start_period}`;
  }

  function isPlacementLocked(pl, pinnedIds, lockedTeacherIds) {
    if (!pl) return { locked: false, type: 'none', reason: '' };
    const key = ensureBlockId(pl);
    const courseLocked = Array.isArray(pinnedIds) && pinnedIds.includes(key);
    const teacherLocked = Array.isArray(lockedTeacherIds) && (pl.teacher_ids || []).some((tid) => lockedTeacherIds.includes(tid));
    if (courseLocked && teacherLocked) {
      return { locked: true, type: 'both', reason: 'Bu ders bloğu ve öğretmeni kilitli. İşlem yapmak için önce kilidi kaldırın.' };
    }
    if (courseLocked) {
      return { locked: true, type: 'course', reason: 'Bu ders bloğu kilitli. Taşımak veya kaldırmak için önce ders kilidini kaldırın.' };
    }
    if (teacherLocked) {
      return { locked: true, type: 'teacher', reason: 'Bu dersin öğretmeni kilitli. Taşımak veya kaldırmak için önce öğretmen kilidini kaldırın.' };
    }
    return { locked: false, type: 'none', reason: '' };
  }

  function createHistoryManager(maxSteps = 40) {
    let undoStack = [];
    let redoStack = [];

    function capture(state) {
      return JSON.stringify({
        solution: state.solution || null,
        pinnedPlacementIds: state.pinnedPlacementIds || [],
        lockedTeacherIds: state.lockedTeacherIds || []
      });
    }

    function applySnap(state, raw) {
      const snap = JSON.parse(raw);
      state.solution = snap.solution;
      state.pinnedPlacementIds = Array.isArray(snap.pinnedPlacementIds) ? snap.pinnedPlacementIds : [];
      state.lockedTeacherIds = Array.isArray(snap.lockedTeacherIds) ? snap.lockedTeacherIds : [];
    }

    return {
      push(state) {
        undoStack.push(capture(state));
        if (undoStack.length > maxSteps) undoStack.shift();
        redoStack = [];
      },
      undo(state) {
        if (!undoStack.length) return false;
        redoStack.push(capture(state));
        const prev = undoStack.pop();
        applySnap(state, prev);
        return true;
      },
      redo(state) {
        if (!redoStack.length) return false;
        undoStack.push(capture(state));
        const next = redoStack.pop();
        applySnap(state, next);
        return true;
      },
      clear() {
        undoStack = [];
        redoStack = [];
      },
      canUndo() { return undoStack.length > 0; },
      canRedo() { return redoStack.length > 0; },
      counts() { return { undo: undoStack.length, redo: redoStack.length }; }
    };
  }

  function getBuildingForPlacement(pl, classes, rooms) {
    if (pl.room_id) {
      const rm = (rooms || []).find((r) => r.id === pl.room_id);
      if (rm && rm.building) return String(rm.building).trim();
    }
    const cls = (classes || []).find((c) => c.id === pl.class_id);
    if (cls && cls.building) return String(cls.building).trim();
    return null;
  }

  function validateManualPlacementFull(state, candidate, helpers, ignorePlacements = [], extraPlacements = []) {
    const warnings = [];
    const periods = state.grid.periodsPerDay;

    // 1. Kilit kontrolü (taşınan kaynak blok kilitli mi?)
    if (ignorePlacements.length === 1 && ignorePlacements[0]) {
      const lockInfo = isPlacementLocked(ignorePlacements[0], state.pinnedPlacementIds, state.lockedTeacherIds);
      if (lockInfo.locked) return { valid: false, error: lockInfo.reason, warnings };
    }

    // 2. Blok bütünlüğü ve zaman sınırı
    if (candidate.day_index < 0 || candidate.start_period < 0 || candidate.start_period + candidate.length > periods) {
      return { valid: false, error: `${candidate.length} saatlik blok bu saate sığmıyor.`, warnings };
    }

    const gridStats = helpers.getSlotStats();
    const origDay = gridStats.activeDayIndices[candidate.day_index];
    if (origDay === undefined) {
      return { valid: false, error: 'Seçilen gün okul zaman çizelgesinde kapalı.', warnings };
    }

    // 3. Öğle arası ve uzun teneffüs kontrolü
    const shift = helpers.getClassShift(candidate.class_id);
    const lunchAfter = shift === 'full_day' ? (Number(state.bell.lunchAfterPeriod) || 0) : 0;
    if (lunchAfter > 0 && candidate.length > 1 && candidate.start_period < lunchAfter && candidate.start_period + candidate.length > lunchAfter) {
      return { valid: false, error: 'Ders bloğu öğle arasını bölemez.', warnings };
    }

    const classes = helpers.getCurrentClasses();
    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const cls = classes.find((c) => c.id === candidate.class_id);
    const crs = cls && (cls.courses || []).find((x) => x.id === candidate.course_id);
    const useCommon = Boolean(crs && crs.useCommonSlot);

    // 4. Okul kapalı saat ve ortak seçmeli slot kontrolü
    for (let k = 0; k < candidate.length; k++) {
      const slotVal = (state.grid.slots[origDay] && state.grid.slots[origDay][candidate.start_period + k]) || 'ACTIVE';
      if (slotVal === 'BLOCKED') {
        return { valid: false, error: 'Hedef saat okul zaman çizelgesinde kapalı.', warnings };
      }
      if (useCommon && slotVal !== 'COMMON_ELECTIVE') {
        return { valid: false, error: 'Bu ders yalnızca Ortak Seçmeli saatlerine yerleştirilebilir.', warnings };
      }
    }

    // 5. Öğretmen müsaitliği ve tercih uyarıları
    for (const tid of (candidate.teacher_ids || [])) {
      const t = teachers.find((x) => x.id === tid);
      if (!t) continue;
      if (helpers.ensureTeacherAvailabilitySize) helpers.ensureTeacherAvailabilitySize(t);
      for (let k = 0; k < candidate.length; k++) {
        const av = (t.availability && t.availability[origDay] && t.availability[origDay][candidate.start_period + k]) || 'AVAILABLE';
        if (av === 'UNAVAILABLE') {
          return { valid: false, error: `${t.name} öğretmeni bu saatte kapalı görünüyor.`, warnings };
        }
        if (av === 'PREFER_AVOID') {
          warnings.push(`${t.name} öğretmeni bu saati tercihen boş bırakmak istemiş.`);
        }
      }
    }

    const existing = ((state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [])
      .filter((p) => !ignorePlacements.includes(p))
      .concat(extraPlacements);

    const candSpan = helpers.getBlockPhysicalSpan(candidate.class_id, candidate.start_period, candidate.length);

    // 6. Aynı dersin günlük blok sınırı
    if (crs && Number(crs.maxPerDay || 1) > 0) {
      const sameDayCount = existing.filter((o) => o.assignment_id === candidate.assignment_id && o.day_index === candidate.day_index).length;
      if (sameDayCount >= Number(crs.maxPerDay || 1)) {
        return { valid: false, error: `${crs.name} dersi aynı günde en fazla ${crs.maxPerDay} blok olabilir.`, warnings };
      }
    }

    // 7. Fiziksel zaman çakışmaları (şube, öğretmen, özel mekan, bina geçiş süresi)
    const roomObj = candidate.room_id ? rooms.find((r) => r.id === candidate.room_id) : null;
    const roomCap = roomObj ? (Number(roomObj.capacity) || 1) : 1;
    let roomConcurrent = 0;
    const travelMin = Number((state.school && state.school.buildingTravelMinutes) || 0);
    const candBuilding = travelMin > 0 ? getBuildingForPlacement(candidate, classes, rooms) : null;

    for (const other of existing) {
      if (other.day_index !== candidate.day_index) continue;
      const otherSpan = helpers.getBlockPhysicalSpan(other.class_id, other.start_period, other.length);
      const overlaps = helpers.physicalSpansOverlap(candSpan, otherSpan);

      if (overlaps) {
        if (other.class_id === candidate.class_id) {
          return { valid: false, error: `${candidate.class_name} şubesinde bu saatte ${other.course_code} dersi var.`, warnings };
        }
        for (const tid of (candidate.teacher_ids || [])) {
          if ((other.teacher_ids || []).includes(tid)) {
            const tObj = teachers.find((t) => t.id === tid);
            return { valid: false, error: `Çakışma: ${tObj ? tObj.name : 'Öğretmen'} bu saatte ${other.class_name} dersinde.`, warnings };
          }
        }
        if (candidate.room_id && other.room_id === candidate.room_id) {
          roomConcurrent++;
          if (roomConcurrent >= roomCap) {
            return { valid: false, error: `Özel mekan dolu: ${roomObj ? roomObj.name : 'Mekan'} kapasitesi (${roomCap}) dolmuş.`, warnings };
          }
        }
      } else if (travelMin > 0 && candBuilding) {
        const sharedT = (candidate.teacher_ids || []).find((tid) => (other.teacher_ids || []).includes(tid));
        if (sharedT) {
          const otherBuilding = getBuildingForPlacement(other, classes, rooms);
          if (otherBuilding && otherBuilding !== candBuilding) {
            const gapMin = candSpan[0] >= otherSpan[1] ? (candSpan[0] - otherSpan[1]) : (otherSpan[0] - candSpan[1]);
            if (gapMin < travelMin) {
              const tObj = teachers.find((t) => t.id === sharedT);
              return { valid: false, error: `Bina geçiş süresi yetersiz: ${tObj ? tObj.name : 'Öğretmen'} (${otherBuilding} -> ${candBuilding}, ${gapMin} dk < ${travelMin} dk).`, warnings };
            }
          }
        }
      }
    }

    // 8. Öğretmen günlük maks saat, ardışık maks saat, günlük boşluk ve haftalık gün sınırı
    for (const tid of (candidate.teacher_ids || [])) {
      const t = teachers.find((x) => x.id === tid);
      if (!t) continue;
      const tPlacements = existing.filter((o) => (o.teacher_ids || []).includes(tid)).concat([candidate]);
      const dayPlacements = tPlacements.filter((o) => o.day_index === candidate.day_index);

      const dayHours = dayPlacements.reduce((s, o) => s + Number(o.length || 0), 0);
      if (t.maxDaily && dayHours > Number(t.maxDaily)) {
        return { valid: false, error: `${t.name} öğretmeni için günlük maksimum ders sınırı (${t.maxDaily} sa) aşılıyor.`, warnings };
      }

      const maxConsec = Number(t.maxConsecutive || 0);
      const maxGaps = Number(t.maxDailyGaps || 0);
      if (maxConsec > 0 || maxGaps > 0) {
        const occ = [];
        dayPlacements.forEach((o) => { for (let k = 0; k < o.length; k++) occ.push(o.start_period + k); });
        const uniq = Array.from(new Set(occ)).sort((a, b) => a - b);
        if (maxConsec > 0) {
          let run = 0, prev = -2;
          for (const pp of uniq) {
            run = (pp === prev + 1) ? run + 1 : 1;
            prev = pp;
            if (run > maxConsec) {
              return { valid: false, error: `${t.name} öğretmeni için günlük ardışık ders sınırı (${maxConsec} sa) aşılıyor.`, warnings };
            }
          }
        }
        if (maxGaps > 0 && uniq.length >= 2) {
          const gaps = (uniq[uniq.length - 1] - uniq[0] + 1) - uniq.length;
          if (gaps > maxGaps) {
            return { valid: false, error: `${t.name} öğretmeni için günlük boş ders sınırı (${maxGaps}) aşılıyor.`, warnings };
          }
        }
      }

      const maxWorkDays = Number(t.maxWorkingDays || 0);
      if (maxWorkDays > 0) {
        const workedDays = new Set(tPlacements.map((o) => o.day_index));
        if (workedDays.size > maxWorkDays) {
          return { valid: false, error: `${t.name} öğretmeni için haftalık çalışılabilir gün sınırı (${maxWorkDays} gün) aşılıyor.`, warnings };
        }
      }
    }

    return { valid: true, error: null, warnings };
  }

  function validateDirectSwap(state, plA, plB, helpers) {
    if (!plA || !plB || plA === plB) {
      return { valid: false, error: 'Takas için iki farklı ders seçilmelidir.', warnings: [] };
    }
    const lockA = isPlacementLocked(plA, state.pinnedPlacementIds, state.lockedTeacherIds);
    if (lockA.locked) return { valid: false, error: `${plA.course_name}: ${lockA.reason}`, warnings: [] };
    const lockB = isPlacementLocked(plB, state.pinnedPlacementIds, state.lockedTeacherIds);
    if (lockB.locked) return { valid: false, error: `${plB.course_name}: ${lockB.reason}`, warnings: [] };

    const candA = { ...plA, day_index: plB.day_index, start_period: plB.start_period };
    const candB = { ...plB, day_index: plA.day_index, start_period: plA.start_period };

    const checkA = validateManualPlacementFull(state, candA, helpers, [plA, plB], [candB]);
    if (!checkA.valid) return checkA;
    const checkB = validateManualPlacementFull(state, candB, helpers, [plA, plB], [candA]);
    if (!checkB.valid) return checkB;

    return { valid: true, error: null, warnings: [...checkA.warnings, ...checkB.warnings] };
  }

  function computeSolutionDiff(oldPlacements, newPlacements, pinnedIds, lockedTeacherIds) {
    const oldMap = {};
    (oldPlacements || []).forEach((pl) => { oldMap[ensureBlockId(pl)] = pl; });

    const changes = [];
    const affectedTeacherIds = new Set();
    const affectedClassIds = new Set();
    let preservedLockedCount = 0;

    (newPlacements || []).forEach((npl) => {
      const bid = ensureBlockId(npl);
      const opl = oldMap[bid];
      const lockInfo = isPlacementLocked(npl, pinnedIds, lockedTeacherIds);
      if (opl && opl.day_index === npl.day_index && opl.start_period === npl.start_period) {
        if (lockInfo.locked) preservedLockedCount++;
        return;
      }
      changes.push({
        block_id: bid,
        class_id: npl.class_id,
        class_name: npl.class_name,
        course_code: npl.course_code,
        course_name: npl.course_name,
        teacher_ids: npl.teacher_ids || [],
        oldDay: opl ? opl.day_index : null,
        oldPeriod: opl ? opl.start_period : null,
        newDay: npl.day_index,
        newPeriod: npl.start_period,
        length: npl.length
      });
      affectedClassIds.add(npl.class_id);
      (npl.teacher_ids || []).forEach((tid) => affectedTeacherIds.add(tid));
    });

    return {
      changedCount: changes.length,
      affectedTeacherCount: affectedTeacherIds.size,
      affectedClassCount: affectedClassIds.size,
      preservedLockedCount,
      changes
    };
  }

  function auditScheduleLocal(state, helpers) {
    const issues = [];
    const placements = (state.solution && Array.isArray(state.solution.placements)) ? state.solution.placements : [];
    const classes = helpers.getCurrentClasses();
    const teachers = helpers.getCurrentTeachers();
    const rooms = helpers.getCurrentRooms();
    const gridStats = helpers.getSlotStats();
    const tMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const rMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

    if (!placements.length) {
      issues.push({ severity: 'info', category: 'Boş Program', message: 'Henüz dağıtılmış bir ders programı bulunmuyor.' });
      return issues;
    }

    // 1. Eksik blok / saat kontrolü
    const placedByAsgn = {};
    placements.forEach((pl) => {
      placedByAsgn[pl.assignment_id] = (placedByAsgn[pl.assignment_id] || 0) + Number(pl.length || 0);
    });
    classes.forEach((cls) => {
      (cls.courses || []).forEach((c) => {
        const aid = `${cls.id}__${c.id}`;
        const placedH = placedByAsgn[aid] || 0;
        if (placedH !== Number(c.hours || 0)) {
          issues.push({
            severity: 'error',
            category: 'Eksik Ders Saati',
            message: `${cls.name} ${c.name} dersinde ${c.hours} saat yerine ${placedH} saat yerleşmiş.`,
            class_id: cls.id
          });
        }
      });
    });

    // 2. Kapalı saat, öğle arası ve öğretmen uygunluk kontrolleri
    placements.forEach((pl) => {
      const origDay = gridStats.activeDayIndices[pl.day_index];
      const dayName = DAY_NAMES[origDay] || `Gün ${pl.day_index + 1}`;
      for (let k = 0; k < pl.length; k++) {
        if (origDay === undefined || ((state.grid.slots[origDay] && state.grid.slots[origDay][pl.start_period + k]) || 'ACTIVE') === 'BLOCKED') {
          issues.push({
            severity: 'error',
            category: 'Kapalı Saat İhlali',
            message: `${pl.class_name} ${pl.course_name} dersi ${dayName} ${pl.start_period + k + 1}. kapalı saatte yer alıyor.`,
            class_id: pl.class_id,
            placement_key: ensureBlockId(pl)
          });
          break;
        }
      }
      (pl.teacher_ids || []).forEach((tid) => {
        const t = tMap[tid];
        if (!t) return;
        for (let k = 0; k < pl.length; k++) {
          if (origDay !== undefined && t.availability && t.availability[origDay] && t.availability[origDay][pl.start_period + k] === 'UNAVAILABLE') {
            issues.push({
              severity: 'error',
              category: 'Öğretmen Uygunluk İhlali',
              message: `${t.name}, ${dayName} ${pl.start_period + k + 1}. derste kapalı olduğu halde ${pl.class_name} ${pl.course_name} dersine atanmış.`,
              class_id: pl.class_id,
              teacher_id: tid,
              placement_key: ensureBlockId(pl)
            });
            break;
          }
        }
      });
    });

    // 3. Öğretmen, şube ve derslik çakışmaları
    for (let i = 0; i < placements.length; i++) {
      const a = placements[i];
      const spanA = helpers.getBlockPhysicalSpan(a.class_id, a.start_period, a.length);
      const origDay = gridStats.activeDayIndices[a.day_index];
      const dayName = DAY_NAMES[origDay] || `Gün ${a.day_index + 1}`;

      for (let j = i + 1; j < placements.length; j++) {
        const b = placements[j];
        if (a.day_index !== b.day_index) continue;
        const spanB = helpers.getBlockPhysicalSpan(b.class_id, b.start_period, b.length);
        if (!helpers.physicalSpansOverlap(spanA, spanB)) continue;

        if (a.class_id === b.class_id) {
          issues.push({
            severity: 'error',
            category: 'Sınıf Çakışması',
            message: `${a.class_name} sınıfında ${dayName} ${a.start_period + 1}. derste hem ${a.course_name} hem ${b.course_name} dersi var.`,
            class_id: a.class_id
          });
        }
        for (const tid of (a.teacher_ids || [])) {
          if ((b.teacher_ids || []).includes(tid)) {
            const tName = tMap[tid] ? tMap[tid].name : tid;
            issues.push({
              severity: 'error',
              category: 'Öğretmen Çakışması',
              message: `${tName}, ${dayName} ${a.start_period + 1}. derste hem ${a.class_name} hem ${b.class_name} sınıfına atanmış.`,
              teacher_id: tid,
              class_id: a.class_id
            });
          }
        }
        if (a.room_id && a.room_id === b.room_id) {
          const rm = rMap[a.room_id];
          if (!rm || Number(rm.capacity || 1) <= 1) {
            issues.push({
              severity: 'error',
              category: 'Derslik Çakışması',
              message: `${rm ? rm.name : a.room_id} mekanı ${dayName} ${a.start_period + 1}. derste hem ${a.class_name} hem ${b.class_name} için kullanılıyor.`,
              class_id: a.class_id
            });
          }
        }
      }
    }

    // 4. Öğretmen günlük boşlukları (bilgilendirme)
    teachers.forEach((t) => {
      const g = helpers.computeTeacherGaps ? helpers.computeTeacherGaps(t.id) : 0;
      if (g > 0) {
        issues.push({
          severity: 'info',
          category: 'Öğretmen Boşluğu',
          message: `${t.name} öğretmeni için haftalık ${g} boş pencere bulunuyor.`,
          teacher_id: t.id
        });
      }
    });

    return issues;
  }

  return {
    ensureBlockId,
    isPlacementLocked,
    createHistoryManager,
    validateManualPlacementFull,
    validateDirectSwap,
    computeSolutionDiff,
    auditScheduleLocal
  };
});
