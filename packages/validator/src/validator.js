import { SolverStatus, ConstraintLevel } from '../../core-schema/src/constants.js';

/**
 * EvrakPlus Independent Schedule Validator
 * Optimizasyon motorlarından tamamen bağımsız sonuç doğrulama motoru.
 * Motorun kendi "başarılı" veya "OPTIMAL" iddiası tek başına kabul edilmez.
 */
export function validateSchedule(solverInput, placements = {}, rawStatus = SolverStatus.FEASIBLE) {
  const D = solverInput.school.daysPerWeek;
  const P = solverInput.school.periodsPerDay;
  const lunchAfter = solverInput.school.lunchAfterPeriod || 0;

  const teacherMap = new Map(solverInput.teachers.map(t => [t.id, t]));
  const classMap = new Map(solverInput.classes.map(c => [c.id, c]));
  const roomMap = new Map(solverInput.rooms.map(r => [r.id, r]));
  const buildingMap = new Map(solverInput.buildings.map(b => [b.id, b]));
  const blockMap = new Map(solverInput.blocks.map(b => [b.blockId, b]));

  const hardViolations = [];
  const softViolations = [];
  const unassignedBlocks = [];

  const addViolation = (level, code, message, meta = {}) => {
    const entry = { level, code, message, ...meta };
    if (level === ConstraintLevel.HARD) hardViolations.push(entry);
    else softViolations.push(entry);
  };

  // 1. Fazladan / bilinmeyen yerleşim kontrolü
  for (const blockId of Object.keys(placements || {})) {
    if (!blockMap.has(blockId)) {
      addViolation(ConstraintLevel.HARD, 'EXTRA_PLACEMENT', `Tanımsız blok yerleşimi: ${blockId}`, { blockId });
    }
  }

  // Zaman dilimi doluluk tabloları
  const teacherOcc = new Map(); // `${teacherId}|${d}-${p}` -> blockId
  const classOcc = new Map();   // `${classId}|${d}-${p}` -> [{ blockId, studentGroupId }]
  const roomOcc = new Map();    // `${roomId}|${d}-${p}` -> blockId

  const teacherDayHours = new Map();  // `${teacherId}|${d}` -> count
  const teacherWeekHours = new Map(); // teacherId -> count
  const classDayHours = new Map();    // `${classId}|${d}` -> count
  const assignmentDays = new Map();   // assignmentId -> Map(day -> count)
  const classSubjDays = new Map();    // `${classId}|${subjectKey}|${d}` -> count
  const teacherDaySlots = new Map();  // `${teacherId}|${d}` -> Array<{ p, buildingId, blockId }>
  const parallelPlacements = new Map(); // parallelGroupId -> Array<{ blockId, day, period }>

  // Aktif kuralları indeksle
  const constraints = solverInput.constraints || [];
  const diffDayRule = constraints.find(c => c.type === 'subject_diff_days');
  const lunchRule = constraints.find(c => c.type === 'block_no_across_lunch');
  const forbidRules = constraints.filter(c => c.type === 'subject_forbid_periods');
  const pairRules = constraints.filter(c => c.type === 'subject_pair_diff_day');

  // 2. Her bloğu doğrula
  let assignedBlocks = 0;
  let assignedHours = 0;
  let totalHours = 0;

  for (const b of solverInput.blocks) {
    totalHours += b.length;
    const pl = placements ? placements[b.blockId] : null;

    if (!pl || !Number.isInteger(pl.day) || !Number.isInteger(pl.period)) {
      unassignedBlocks.push(b.blockId);
      if (b.locked && b.lockedPlacement) {
        addViolation(ConstraintLevel.HARD, 'LOCKED_VIOLATION', `Kilitli blok yerleştirilmemiş: ${b.blockId}`, { blockId: b.blockId });
      }
      continue;
    }

    assignedBlocks++;
    assignedHours += b.length;
    const { day: d, period: p } = pl;
    const roomId = pl.roomId ?? b.roomId ?? classMap.get(b.classId)?.homeRoomId ?? null;

    // Kilitli blok kontrolü
    if (b.locked && b.lockedPlacement) {
      if (b.lockedPlacement.day !== d || b.lockedPlacement.period !== p ||
          (b.lockedPlacement.roomId && b.lockedPlacement.roomId !== roomId)) {
        addViolation(ConstraintLevel.HARD, 'LOCKED_VIOLATION', `Kilitli blok (${b.blockId}) kilitli konumundan oynatılmış.`, { blockId: b.blockId });
      }
    }

    // Sınır kontrolü
    if (d < 0 || d >= D || p < 0 || p + b.length > P) {
      addViolation(ConstraintLevel.HARD, 'OUT_OF_BOUNDS', `Blok (${b.blockId}) geçersiz gün/saat aralığında: gün=${d}, saat=${p}, uzunluk=${b.length}`, { blockId: b.blockId });
      continue;
    }

    // Öğle arası bölünme kontrolü
    if (lunchRule && b.forbidAcrossLunch && lunchAfter > 0 && p < lunchAfter && p + b.length > lunchAfter) {
      addViolation(lunchRule.level, 'ACROSS_LUNCH', `Blok (${b.blockId}) öğle arasından bölünerek geçiyor.`, { blockId: b.blockId });
    }

    // Ders saat yasağı kontrolü
    for (const fr of forbidRules) {
      if (fr.params?.subjectKey === b.subjectKey) {
        const forbidden = new Set((fr.params.periods || []).map(Number));
        for (let k = 0; k < b.length; k++) {
          if (forbidden.has(p + k)) {
            addViolation(fr.level, 'SUBJECT_FORBID_PERIOD', `Yasaklı ders saati ihlali (${b.subjectKey}, saat=${p + k + 1}).`, { blockId: b.blockId });
          }
        }
      }
    }

    const cls = classMap.get(b.classId);
    const allTeacherIds = [b.teacherId, ...(b.coTeacherIds || [])].filter(Boolean);
    const room = roomId ? roomMap.get(roomId) : null;

    // Derslik türü ve kapasite kontrolü
    if (room) {
      if (b.requiredRoomType && room.type !== b.requiredRoomType) {
        addViolation(ConstraintLevel.HARD, 'ROOM_TYPE_MISMATCH', `Derslik türü uyumsuz (${b.blockId}): beklenen ${b.requiredRoomType}, atanan ${room.type}.`, { blockId: b.blockId, roomId });
      }
      if (cls && cls.studentCount > room.capacity) {
        addViolation(ConstraintLevel.HARD, 'ROOM_CAPACITY', `Derslik kapasitesi yetersiz (${room.name}: ${room.capacity} < ${cls.studentCount}).`, { blockId: b.blockId, roomId });
      }
    } else if (b.requiredRoomType && solverInput.rooms.length > 0) {
      addViolation(ConstraintLevel.HARD, 'ROOM_REQUIRED_MISSING', `Gerekli derslik türü (${b.requiredRoomType}) atanmamış: ${b.blockId}.`, { blockId: b.blockId });
    }

    // Her saat dilimini kontrol et
    for (let k = 0; k < b.length; k++) {
      const slot = `${d}-${p + k}`;

      // Sınıf kapalı saat & çakışma
      if (cls) {
        if ((cls.closedSlots || []).includes(slot)) {
          addViolation(ConstraintLevel.HARD, 'CLASS_CLOSED', `${cls.name} sınıfının kapalı saatine ders atanmış (${slot}).`, { blockId: b.blockId, classId: cls.id, slot });
        }
        const cKey = `${cls.id}|${slot}`;
        const existingList = classOcc.get(cKey) || [];
        for (const ex of existingList) {
          // Aynı öğrenci grubu veya tam sınıf ise çakışma! Farklı alt öğrenci grupları paralel olabilir.
          if (!b.studentGroupId || !ex.studentGroupId || b.studentGroupId === ex.studentGroupId) {
            addViolation(ConstraintLevel.HARD, 'CLASS_CONFLICT', `${cls.name} sınıfında aynı saatte (${slot}) çakışan dersler: ${ex.blockId} ve ${b.blockId}.`, { blockId: b.blockId, otherBlockId: ex.blockId, classId: cls.id, slot });
          }
        }
        existingList.push({ blockId: b.blockId, studentGroupId: b.studentGroupId });
        classOcc.set(cKey, existingList);
      }

      // Öğretmen kapalı saat & çakışma
      for (const tid of allTeacherIds) {
        const t = teacherMap.get(tid);
        if (t && (t.closedSlots || []).includes(slot)) {
          addViolation(ConstraintLevel.HARD, 'TEACHER_CLOSED', `${t.name} kapalı saatinde (${slot}) görevlendirilmiş.`, { blockId: b.blockId, teacherId: tid, slot });
        }
        if (t && (t.preferredFreeSlots || []).includes(slot)) {
          addViolation(ConstraintLevel.PREFERENCE, 'TEACHER_PREFERRED_FREE', `${t.name} tercihen boş saatinde (${slot}) derse atanmış.`, { blockId: b.blockId, teacherId: tid, slot });
        }
        const tKey = `${tid}|${slot}`;
        if (teacherOcc.has(tKey)) {
          addViolation(ConstraintLevel.HARD, 'TEACHER_CONFLICT', `${t ? t.name : tid} aynı saatte (${slot}) iki derste çakışıyor: ${teacherOcc.get(tKey)} ve ${b.blockId}.`, { blockId: b.blockId, otherBlockId: teacherOcc.get(tKey), teacherId: tid, slot });
        } else {
          teacherOcc.set(tKey, b.blockId);
        }

        // Öğretmen günlük slot kaydı (bina geçişi ve ardışık ders için)
        const tdKey = `${tid}|${d}`;
        const list = teacherDaySlots.get(tdKey) || [];
        list.push({ p: p + k, buildingId: room?.buildingId || null, blockId: b.blockId });
        teacherDaySlots.set(tdKey, list);
      }

      // Derslik kapalı saat & çakışma
      if (room) {
        if ((room.closedSlots || []).includes(slot)) {
          addViolation(ConstraintLevel.HARD, 'ROOM_CLOSED', `${room.name} dersliği kapalı saatinde (${slot}) kullanılmış.`, { blockId: b.blockId, roomId: room.id, slot });
        }
        const rKey = `${room.id}|${slot}`;
        if (roomOcc.has(rKey)) {
          addViolation(ConstraintLevel.HARD, 'ROOM_CONFLICT', `${room.name} dersliğinde aynı saatte (${slot}) çakışma: ${roomOcc.get(rKey)} ve ${b.blockId}.`, { blockId: b.blockId, otherBlockId: roomOcc.get(rKey), roomId: room.id, slot });
        } else {
          roomOcc.set(rKey, b.blockId);
        }
      }
    }

    // Günlük / haftalık sayaçlar
    for (const tid of allTeacherIds) {
      teacherDayHours.set(`${tid}|${d}`, (teacherDayHours.get(`${tid}|${d}`) || 0) + b.length);
      teacherWeekHours.set(tid, (teacherWeekHours.get(tid) || 0) + b.length);
    }
    if (cls && !b.studentGroupId) {
      classDayHours.set(`${cls.id}|${d}`, (classDayHours.get(`${cls.id}|${d}`) || 0) + b.length);
    }

    // Aynı ders farklı gün kontrolü için sayım
    if (!assignmentDays.has(b.assignmentId)) assignmentDays.set(b.assignmentId, new Map());
    const dMap = assignmentDays.get(b.assignmentId);
    dMap.set(d, (dMap.get(d) || 0) + 1);

    const csKey = `${b.classId}|${b.subjectKey}|${d}`;
    classSubjDays.set(csKey, (classSubjDays.get(csKey) || 0) + 1);

    if (b.parallelGroupId) {
      const pList = parallelPlacements.get(b.parallelGroupId) || [];
      pList.push({ blockId: b.blockId, day: d, period: p });
      parallelPlacements.set(b.parallelGroupId, pList);
    }
  }

  // 3. Aynı ders farklı gün kontrolü
  if (diffDayRule) {
    for (const [assignmentId, dMap] of assignmentDays.entries()) {
      const sampleBlock = solverInput.blocks.find(b => b.assignmentId === assignmentId);
      if (!sampleBlock || sampleBlock.allowMultipleSameDay || sampleBlock.blockCount > D) continue;
      for (const [d, cnt] of dMap.entries()) {
        if (cnt > 1) {
          addViolation(diffDayRule.level, 'SUBJECT_SAME_DAY', `Aynı dersin (${assignmentId}) ${cnt} bloğu aynı güne (${d}) atanmış.`, { assignmentId, day: d });
        }
      }
    }
  }

  // 4. İki ders aynı güne düşmesin kuralı
  for (const pr of pairRules) {
    const a = pr.params?.subjectA;
    const b = pr.params?.subjectB;
    if (!a || !b) continue;
    for (const cls of solverInput.classes) {
      for (let d = 0; d < D; d++) {
        if ((classSubjDays.get(`${cls.id}|${a}|${d}`) || 0) > 0 &&
            (classSubjDays.get(`${cls.id}|${b}|${d}`) || 0) > 0) {
          addViolation(pr.level, 'SUBJECT_PAIR_SAME_DAY', `${cls.name} sınıfında ${a} ve ${b} aynı güne (${d}) atanmış.`, { classId: cls.id, day: d });
        }
      }
    }
  }

  // 5. Paralel seçmeli / öğrenci grupları senkronizasyonu
  for (const [pgId, list] of parallelPlacements.entries()) {
    if (list.length < 2) continue;
    const ref = list[0];
    for (const item of list.slice(1)) {
      if (item.day !== ref.day || item.period !== ref.period) {
        addViolation(ConstraintLevel.HARD, 'PARALLEL_GROUP_DESYNC', `Paralel grup (${pgId}) dersleri aynı zaman diliminde değil.`, { parallelGroupId: pgId });
        break;
      }
    }
  }

  // 6. Öğretmen limitleri, ardışık ders, boşluk ve bina geçiş kontrolleri
  let totalTeacherGaps = 0;
  let totalBuildingChanges = 0;

  for (const t of solverInput.teachers) {
    const wHrs = teacherWeekHours.get(t.id) || 0;
    if (wHrs > 0) {
      if (t.wmax > 0 && wHrs > t.wmax) {
        addViolation(ConstraintLevel.HARD, 'TEACHER_WEEKLY_MAX', `${t.name} haftalık ders sınırı aşıldı (${wHrs} > ${t.wmax}).`, { teacherId: t.id });
      }
      if (t.wmin > 0 && wHrs < t.wmin) {
        addViolation(ConstraintLevel.NORMAL, 'TEACHER_WEEKLY_MIN', `${t.name} haftalık minimum dersin altında (${wHrs} < ${t.wmin}).`, { teacherId: t.id });
      }
    }

    let weeklyGaps = 0;
    let weeklyBuildingChanges = 0;

    for (let d = 0; d < D; d++) {
      const dh = teacherDayHours.get(`${t.id}|${d}`) || 0;
      if (dh > t.dmax) {
        addViolation(ConstraintLevel.HARD, 'TEACHER_DAILY_MAX', `${t.name} günlük maks ders aşıldı (gün=${d}: ${dh} > ${t.dmax}).`, { teacherId: t.id, day: d });
      }
      if (dh > 0 && t.dmin > 0 && dh < t.dmin) {
        addViolation(ConstraintLevel.NORMAL, 'TEACHER_DAILY_MIN', `${t.name} günlük min dersin altında (gün=${d}: ${dh} < ${t.dmin}).`, { teacherId: t.id, day: d });
      }
      if (dh > 0 && (t.avoidDays || []).includes(d)) {
        addViolation(ConstraintLevel.PREFERENCE, 'TEACHER_AVOID_DAY', `${t.name} tercih etmediği günde (${d}) derse atanmış.`, { teacherId: t.id, day: d });
      }

      const slots = (teacherDaySlots.get(`${t.id}|${d}`) || []).sort((a, b) => a.p - b.p);
      if (!slots.length) continue;

      // Boşluklar ve ardışık ders
      const firstP = slots[0].p;
      const lastP = slots[slots.length - 1].p;
      const uniquePs = [...new Set(slots.map(s => s.p))];
      const dayGaps = (lastP - firstP + 1) - uniquePs.length;
      weeklyGaps += dayGaps;
      totalTeacherGaps += dayGaps;

      if (t.maxDailyGaps !== null && dayGaps > t.maxDailyGaps) {
        addViolation(ConstraintLevel.HIGH, 'TEACHER_DAILY_GAPS', `${t.name} günlük boşluk sınırı aşıldı (gün=${d}: ${dayGaps} > ${t.maxDailyGaps}).`, { teacherId: t.id, day: d });
      }

      // Ardışık ders kontrolü
      if (t.cmax > 0) {
        let run = 1;
        let maxRun = 1;
        for (let i = 1; i < uniquePs.length; i++) {
          if (uniquePs[i] === uniquePs[i - 1] + 1) {
            run++;
            if (run > maxRun) maxRun = run;
          } else {
            run = 1;
          }
        }
        if (maxRun > t.cmax) {
          addViolation(ConstraintLevel.HARD, 'TEACHER_CONSECUTIVE_MAX', `${t.name} ardışık ders sınırı aşıldı (gün=${d}: ${maxRun} > ${t.cmax}).`, { teacherId: t.id, day: d });
        }
      }

      // Bina geçiş süresi ve bina değişim sayısı
      let dayBuildingChanges = 0;
      for (let i = 1; i < slots.length; i++) {
        const prev = slots[i - 1];
        const curr = slots[i];
        if (prev.buildingId && curr.buildingId && prev.buildingId !== curr.buildingId) {
          dayBuildingChanges++;
          weeklyBuildingChanges++;
          totalBuildingChanges++;
          const gapBetween = curr.p - prev.p - 1;
          const bObj = buildingMap.get(prev.buildingId);
          const reqGap = Number(bObj?.transitionPeriods?.[curr.buildingId] || 0);
          if (gapBetween < reqGap) {
            addViolation(ConstraintLevel.HARD, 'BUILDING_TRANSITION', `${t.name} bina geçiş süresi yetersiz (gün=${d}: gereken=${reqGap}, boşluk=${gapBetween}).`, { teacherId: t.id, day: d });
          }
        }
      }
      if (t.maxDailyBuildingChanges !== null && dayBuildingChanges > t.maxDailyBuildingChanges) {
        addViolation(ConstraintLevel.HIGH, 'BUILDING_CHANGE_DAILY_LIMIT', `${t.name} günlük bina değişim sınırı aşıldı (${dayBuildingChanges} > ${t.maxDailyBuildingChanges}).`, { teacherId: t.id, day: d });
      }
    }

    if (t.maxWeeklyGaps !== null && weeklyGaps > t.maxWeeklyGaps) {
      addViolation(ConstraintLevel.HIGH, 'TEACHER_WEEKLY_GAPS', `${t.name} haftalık boşluk sınırı aşıldı (${weeklyGaps} > ${t.maxWeeklyGaps}).`, { teacherId: t.id });
    }
    if (t.maxWeeklyBuildingChanges !== null && weeklyBuildingChanges > t.maxWeeklyBuildingChanges) {
      addViolation(ConstraintLevel.HIGH, 'BUILDING_CHANGE_WEEKLY_LIMIT', `${t.name} haftalık bina değişim sınırı aşıldı (${weeklyBuildingChanges} > ${t.maxWeeklyBuildingChanges}).`, { teacherId: t.id });
    }
  }

  // 7. Sınıf günlük limitleri ve boşlukları
  let totalClassGaps = 0;
  for (const cls of solverInput.classes) {
    for (let d = 0; d < D; d++) {
      const dh = classDayHours.get(`${cls.id}|${d}`) || 0;
      if (dh > cls.dmax) {
        addViolation(ConstraintLevel.HARD, 'CLASS_DAILY_MAX', `${cls.name} günlük maks ders aşıldı (gün=${d}: ${dh} > ${cls.dmax}).`, { classId: cls.id, day: d });
      }
      let firstP = -1, lastP = -1, occupied = 0;
      for (let p = 0; p < P; p++) {
        if ((classOcc.get(`${cls.id}|${d}-${p}`) || []).length > 0) {
          if (firstP < 0) firstP = p;
          lastP = p;
          occupied++;
        }
      }
      if (occupied > 0) {
        const gaps = (lastP - firstP + 1) - occupied;
        totalClassGaps += gaps;
        if (cls.maxDailyGaps !== null && gaps > cls.maxDailyGaps) {
          addViolation(ConstraintLevel.HIGH, 'CLASS_DAILY_GAPS', `${cls.name} günlük boş ders sınırı aşıldı (gün=${d}: ${gaps} > ${cls.maxDailyGaps}).`, { classId: cls.id, day: d });
        }
      }
    }
  }

  // 8. Nihai geçerlilik ve durum kararı
  const totalBlocks = solverInput.blocks.length;
  const isHardValid = hardViolations.length === 0;
  const isComplete = unassignedBlocks.length === 0 && totalBlocks > 0;
  const isValidSchedule = isHardValid && isComplete;

  let verifiedStatus = rawStatus;
  if (!isHardValid) {
    verifiedStatus = SolverStatus.ERROR;
  } else if (!isComplete) {
    if (rawStatus === SolverStatus.OPTIMAL || rawStatus === SolverStatus.FEASIBLE) {
      verifiedStatus = SolverStatus.PARTIAL;
    }
  } else {
    // OPTIMAL yalnızca motor gerçekten OPTIMAL kanıtladıysa korunur
    verifiedStatus = rawStatus === SolverStatus.OPTIMAL ? SolverStatus.OPTIMAL : SolverStatus.FEASIBLE;
  }

  return {
    isValid: isValidSchedule,
    isHardValid,
    isComplete,
    verifiedStatus,
    rawStatus,
    metrics: {
      totalBlocks,
      assignedBlocks,
      unassignedBlocksCount: unassignedBlocks.length,
      totalHours,
      assignedHours,
      hardViolationCount: hardViolations.length,
      softViolationCount: softViolations.length,
      totalTeacherGaps,
      totalClassGaps,
      totalBuildingChanges
    },
    hardViolations,
    softViolations,
    unassignedBlocks
  };
}
