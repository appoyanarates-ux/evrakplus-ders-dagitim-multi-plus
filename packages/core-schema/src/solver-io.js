import { parseBlockPattern, ConstraintLevel } from './constants.js';

/**
 * Görevlendirmeleri (assignments) tekil yerleştirilebilir bloklara (blocks) genişletir.
 * Her blok benzersiz `${assignment.id}:${blockIndex}` kimliğine sahiptir.
 */
export function expandAssignments(project) {
  const blocks = [];
  const P = Number(project.school.periodsPerDay || 7);

  for (const a of project.assignments || []) {
    if (a.deletedAt) continue;
    const parts = parseBlockPattern(a.pattern, a.hours);
    const subj = (project.subjects || {})[a.subjectKey] || {};

    parts.forEach((len, idx) => {
      const blockId = `${a.id}:${idx}`;
      const existing = (project.placements || {})[blockId];
      blocks.push({
        blockId,
        assignmentId: a.id,
        blockIndex: idx,
        blockCount: parts.length,
        classId: a.classId,
        studentGroupId: a.studentGroupId || null,
        parallelGroupId: a.parallelGroupId || null,
        subjectKey: a.subjectKey,
        teacherId: a.teacherId || null,
        coTeacherIds: Array.isArray(a.coTeacherIds) ? a.coTeacherIds : [],
        length: Math.min(len, P),
        roomId: a.roomId || null,
        requiredRoomType: a.requiredRoomType || subj.requiredRoomType || null,
        allowMultipleSameDay: Boolean(a.allowMultipleSameDay),
        forbidAcrossLunch: subj.forbidAcrossLunch !== false,
        locked: Boolean(existing && existing.lock),
        lockedPlacement: existing && existing.lock
          ? { day: existing.day, period: existing.period, roomId: existing.roomId || null }
          : null,
        hintPlacement: existing && !existing.lock
          ? { day: existing.day, period: existing.period, roomId: existing.roomId || null }
          : null
      });
    });
  }
  return blocks;
}

/**
 * Tüm 6 optimizasyon motorunun (OR-Tools, Timefold, Choco, MiniZinc, SCIP, HiGHS)
 * ve bağımsız doğrulayıcının kullanacağı standart SolverInput JSON nesnesini üretir.
 */
export function buildSolverInput(project, options = {}) {
  const D = Number(project.school.daysPerWeek || 5);
  const P = Number(project.school.periodsPerDay || 7);
  const lunchAfter = Number(project.school.bellSchedule?.full?.lunchAfterPeriod || 0);
  const blocks = expandAssignments(project);

  const activeTeachers = (project.teachers || []).filter(t => !t.deletedAt);
  const activeClasses = (project.classes || []).filter(c => !c.deletedAt);
  const activeRooms = (project.rooms || []).filter(r => !r.deletedAt);
  const activeBuildings = (project.buildings || []).filter(b => !b.deletedAt);
  const activeConstraints = (project.constraints || []).filter(c => !c.deletedAt && c.enabled);

  return {
    protocolVersion: '1.0.0',
    projectId: project.id,
    school: {
      name: project.school.name,
      daysPerWeek: D,
      periodsPerDay: P,
      totalSlots: D * P,
      educationMode: project.school.educationMode,
      lunchAfterPeriod: lunchAfter
    },
    buildings: activeBuildings.map(b => ({
      id: b.id,
      name: b.name,
      transitionPeriods: b.transitionPeriods || {}
    })),
    rooms: activeRooms.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      buildingId: r.buildingId || null,
      capacity: Number(r.capacity || 30),
      closedSlots: r.closed || []
    })),
    teachers: activeTeachers.map(t => ({
      id: t.id,
      name: t.name,
      branch: t.branch,
      dmin: Number(t.dmin || 0),
      dmax: Number(t.dmax || P),
      wmin: Number(t.wmin || 0),
      wmax: Number(t.wmax || D * P),
      cmax: Number(t.cmax || 0),
      maxDailyGaps: t.maxDailyGaps ?? null,
      maxWeeklyGaps: t.maxWeeklyGaps ?? null,
      maxDailyBuildingChanges: t.maxDailyBuildingChanges ?? null,
      maxWeeklyBuildingChanges: t.maxWeeklyBuildingChanges ?? null,
      preferredDays: t.preferredDays || [],
      avoidDays: t.avoidDays || [],
      closedSlots: Object.entries(t.av || {}).filter(([, v]) => v === 1).map(([k]) => k),
      preferredFreeSlots: Object.entries(t.av || {}).filter(([, v]) => v === 2).map(([k]) => k)
    })),
    classes: activeClasses.map(c => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      shift: c.shift || 'full',
      studentCount: Number(c.studentCount || 30),
      homeRoomId: c.homeRoomId || null,
      dmin: Number(c.dmin || 0),
      dmax: Number(c.dmax || P),
      maxDailyGaps: c.maxDailyGaps ?? 0,
      maxWeeklyGaps: c.maxWeeklyGaps ?? 0,
      closedSlots: c.closed || []
    })),
    blocks,
    constraints: activeConstraints.map(c => ({
      id: c.id,
      type: c.type,
      level: c.level || ConstraintLevel.HARD,
      weight: c.weight,
      params: c.params || {}
    })),
    options: {
      timeLimitSeconds: Number(options.timeLimitSeconds ?? project.ui?.timeSeconds ?? 120),
      numWorkers: Number(options.numWorkers || 0), // 0 = auto CPU cores
      seed: Number(options.seed ?? 42),
      useHints: options.useHints !== false,
      objectivePriority: options.objectivePriority || project.ui?.prio || 'gaps',
      passLevel: Number(options.passLevel ?? 1)
    }
  };
}
