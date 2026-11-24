/**
 * Standart SolverInput JSON verisinden otomatik MiniZinc .dzn veri dosyasi uretir.
 */
export function generateDzn(solverInput) {
  const D = solverInput.school.daysPerWeek;
  const P = solverInput.school.periodsPerDay;
  const lunchAfter = solverInput.school.lunchAfterPeriod || 0;
  const blocks = solverInput.blocks || [];
  const B = blocks.length;

  const teacherIdx = new Map();
  const teachers = solverInput.teachers || [];
  teachers.forEach((t, i) => teacherIdx.set(t.id, i + 1));

  const classIdx = new Map();
  const classMap = new Map();
  (solverInput.classes || []).forEach((c, i) => {
    classIdx.set(c.id, i + 1);
    classMap.set(c.id, c);
  });
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  const sgIdx = new Map();
  let nextSg = 1;
  const assignIdx = new Map();
  let nextAssign = 1;

  const constraints = solverInput.constraints || [];
  const diffDaysHard = constraints.some(c => c.type === 'subject_diff_days' && c.level === 'HARD');
  const lunchHard = constraints.some(c => c.type === 'block_no_across_lunch' && c.level === 'HARD');

  const forbidMap = new Map();
  const pairRules = [];
  for (const c of constraints) {
    if (c.type === 'subject_forbid_periods' && c.level === 'HARD') {
      const sk = c.params?.subjectKey;
      if (!forbidMap.has(sk)) forbidMap.set(sk, new Set());
      for (const pp of c.params?.periods || []) forbidMap.get(sk).add(Number(pp));
    } else if (c.type === 'subject_pair_diff_day' && c.level === 'HARD') {
      if (c.params?.subjectA && c.params?.subjectB) pairRules.push([c.params.subjectA, c.params.subjectB]);
    }
  }

  const lengths = [];
  const teacherOf = [];
  const classOf = [];
  const studentGroupOf = [];
  const assignmentOf = [];
  const blockCountOf = [];
  const allowMultiSameDay = [];
  const validSlots = [];

  for (let i = 0; i < B; i++) {
    const b = blocks[i];
    const len = Number(b.length || 1);
    lengths.push(len);
    teacherOf.push(b.teacherId && teacherIdx.has(b.teacherId) ? teacherIdx.get(b.teacherId) : 0);
    classOf.push(classIdx.get(b.classId) || 1);

    if (b.studentGroupId) {
      if (!sgIdx.has(b.studentGroupId)) sgIdx.set(b.studentGroupId, nextSg++);
      studentGroupOf.push(sgIdx.get(b.studentGroupId));
    } else {
      studentGroupOf.push(0);
    }

    if (!assignIdx.has(b.assignmentId)) assignIdx.set(b.assignmentId, nextAssign++);
    assignmentOf.push(assignIdx.get(b.assignmentId));
    blockCountOf.push(Number(b.blockCount || 1));
    allowMultiSameDay.push(Boolean(b.allowMultipleSameDay));

    const cls = classMap.get(b.classId);
    const closed = new Set(cls?.closedSlots || []);
    const t = b.teacherId ? teacherMap.get(b.teacherId) : null;
    if (t) for (const s of t.closedSlots || []) closed.add(s);
    const forbidP = forbidMap.get(b.subjectKey) || new Set();

    const locked = Boolean(b.locked && b.lockedPlacement);
    const lockD = locked ? b.lockedPlacement.day : -1;
    const lockP = locked ? b.lockedPlacement.period : -1;

    const slots = [];
    for (let d = 0; d < D; d++) {
      for (let p = 0; p + len <= P; p++) {
        if (locked && (d !== lockD || p !== lockP)) continue;
        if (lunchHard && b.forbidAcrossLunch && lunchAfter > 0 && p < lunchAfter && p + len > lunchAfter) continue;
        let ok = true;
        for (let k = 0; k < len; k++) {
          if (closed.has(`${d}-${p + k}`) || forbidP.has(p + k)) {
            ok = false;
            break;
          }
        }
        if (ok) slots.push(d * P + p);
      }
    }
    if (slots.length === 0) {
      return { infeasible: true, reason: `Blok ${b.blockId} icin uygun saat yok.` };
    }
    validSlots.push(`{${slots.join(',')}}`);
  }

  // Paralel ciftler
  const parallelPairs = [];
  const byPg = new Map();
  blocks.forEach((b, i) => {
    if (b.parallelGroupId) {
      if (!byPg.has(b.parallelGroupId)) byPg.set(b.parallelGroupId, []);
      byPg.get(b.parallelGroupId).push(i + 1);
    }
  });
  for (const list of byPg.values()) {
    for (let k = 1; k < list.length; k++) parallelPairs.push([list[0], list[k]]);
  }

  // Iki ders ayni gun ciftleri
  const subjectPairs = [];
  for (const [sa, sb] of pairRules) {
    for (let i = 0; i < B; i++) {
      for (let j = i + 1; j < B; j++) {
        if (blocks[i].classId !== blocks[j].classId) continue;
        const si = blocks[i].subjectKey;
        const sj = blocks[j].subjectKey;
        if ((si === sa && sj === sb) || (si === sb && sj === sa)) {
          subjectPairs.push([i + 1, j + 1]);
        }
      }
    }
  }

  const numTeachers = Math.max(1, teachers.length);
  const teacherDmax = teachers.length
    ? teachers.map(t => Number(t.dmax || P))
    : [P];

  const formatPairs = pairs =>
    pairs.length === 0
      ? 'array2d(1..0, 1..2, [])'
      : `array2d(1..${pairs.length}, 1..2, [${pairs.flat().join(',')}])`;

  const lines = [
    `D = ${D};`,
    `P = ${P};`,
    `B = ${B};`,
    `numTeachers = ${numTeachers};`,
    `diffDaysHard = ${diffDaysHard ? 'true' : 'false'};`,
    `lengths = [${lengths.join(',')}];`,
    `teacherOf = [${teacherOf.join(',')}];`,
    `classOf = [${classOf.join(',')}];`,
    `studentGroupOf = [${studentGroupOf.join(',')}];`,
    `assignmentOf = [${assignmentOf.join(',')}];`,
    `blockCountOf = [${blockCountOf.join(',')}];`,
    `allowMultiSameDay = [${allowMultiSameDay.map(v => (v ? 'true' : 'false')).join(',')}];`,
    `validSlots = [${validSlots.join(', ')}];`,
    `teacherDmax = [${teacherDmax.join(',')}];`,
    `numParallelPairs = ${parallelPairs.length};`,
    `parallelPairs = ${formatPairs(parallelPairs)};`,
    `numSubjectPairs = ${subjectPairs.length};`,
    `subjectPairs = ${formatPairs(subjectPairs)};`
  ];

  return { infeasible: false, dzn: lines.join('\n') + '\n' };
}
