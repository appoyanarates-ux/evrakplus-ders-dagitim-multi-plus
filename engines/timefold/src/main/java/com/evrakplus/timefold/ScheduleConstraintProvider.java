package com.evrakplus.timefold;

import ai.timefold.solver.core.api.score.buildin.hardmediumsoft.HardMediumSoftScore;
import ai.timefold.solver.core.api.score.stream.Constraint;
import ai.timefold.solver.core.api.score.stream.ConstraintCollectors;
import ai.timefold.solver.core.api.score.stream.ConstraintFactory;
import ai.timefold.solver.core.api.score.stream.ConstraintProvider;
import ai.timefold.solver.core.api.score.stream.Joiners;

import java.util.List;

public class ScheduleConstraintProvider implements ConstraintProvider {

    @Override
    public Constraint[] defineConstraints(ConstraintFactory cf) {
        return new Constraint[] {
            // HARD constraints
            slotUnavailable(cf),
            teacherConflict(cf),
            classConflict(cf),
            roomConflict(cf),
            subjectDiffDays(cf),
            subjectPairDiffDay(cf),
            parallelGroupSync(cf),
            teacherDailyMax(cf),
            teacherConsecutiveMax(cf),
            classDailyMax(cf),
            // MEDIUM constraints
            lunchAcrossSoft(cf),
            // SOFT constraints
            teacherPreferredFree(cf),
            teacherAvoidDay(cf),
            teacherDailyGaps(cf),
            classDailyGaps(cf)
        };
    }

    private Constraint slotUnavailable(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.countUnavailableViolations() > 0)
            .penalize(HardMediumSoftScore.ONE_HARD, LessonBlock::countUnavailableViolations)
            .asConstraint("slotUnavailable");
    }

    private Constraint teacherConflict(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getTeacherId),
                Joiners.equal(b -> b.getTimeslot().getDay()))
            .filter((a, b) -> a.getTeacherId() != null && !a.getTeacherId().isEmpty() && a.overlapsWith(b))
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("teacherConflict");
    }

    private Constraint classConflict(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getClassId),
                Joiners.equal(b -> b.getTimeslot().getDay()))
            .filter((a, b) -> a.conflictsClassGroup(b) && a.overlapsWith(b))
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("classConflict");
    }

    private Constraint roomConflict(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getRoomId),
                Joiners.equal(b -> b.getTimeslot().getDay()))
            .filter((a, b) -> a.getRoomId() != null && !a.getRoomId().isEmpty() && a.overlapsWith(b))
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("roomConflict");
    }

    private Constraint subjectDiffDays(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getAssignmentId),
                Joiners.equal(b -> b.getTimeslot().getDay()))
            .filter((a, b) -> a.isDiffDaysHard() && !a.isAllowMultipleSameDay())
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("subjectDiffDays");
    }

    private Constraint subjectPairDiffDay(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getClassId),
                Joiners.equal(b -> b.getTimeslot().getDay()))
            .filter((a, b) -> a.getPairConflictSubjects().contains(b.getSubjectKey()))
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("subjectPairDiffDay");
    }

    private Constraint parallelGroupSync(ConstraintFactory cf) {
        return cf.forEachUniquePair(LessonBlock.class,
                Joiners.equal(LessonBlock::getParallelGroupId))
            .filter((a, b) -> a.getParallelGroupId() != null && !a.getParallelGroupId().isEmpty()
                && !a.getTimeslot().equals(b.getTimeslot()))
            .penalize(HardMediumSoftScore.ONE_HARD)
            .asConstraint("parallelGroupSync");
    }

    private Constraint teacherDailyMax(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getTeacherId() != null && !b.getTeacherId().isEmpty())
            .groupBy(LessonBlock::getTeacherId,
                     b -> b.getTimeslot().getDay(),
                     ConstraintCollectors.toList())
            .filter((tid, day, list) -> {
                int dmax = list.get(0).getTeacherDmax();
                int sum = 0;
                for (LessonBlock b : list) sum += b.getLength();
                return sum > dmax;
            })
            .penalize(HardMediumSoftScore.ONE_HARD, (tid, day, list) -> {
                int dmax = list.get(0).getTeacherDmax();
                int sum = 0;
                for (LessonBlock b : list) sum += b.getLength();
                return sum - dmax;
            })
            .asConstraint("teacherDailyMax");
    }

    private Constraint teacherConsecutiveMax(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getTeacherId() != null && !b.getTeacherId().isEmpty() && b.getTeacherCmax() > 0)
            .groupBy(LessonBlock::getTeacherId,
                     b -> b.getTimeslot().getDay(),
                     ConstraintCollectors.toList())
            .penalize(HardMediumSoftScore.ONE_HARD, (tid, day, list) -> {
                int cmax = list.get(0).getTeacherCmax();
                int P = list.get(0).getPeriodsPerDay();
                boolean[] occ = new boolean[P];
                for (LessonBlock b : list) {
                    int st = b.getTimeslot().getPeriod();
                    for (int k = 0; k < b.getLength() && st + k < P; k++) occ[st + k] = true;
                }
                int run = 0, excess = 0;
                for (int p = 0; p < P; p++) {
                    if (occ[p]) {
                        run++;
                        if (run > cmax) excess++;
                    } else {
                        run = 0;
                    }
                }
                return excess;
            })
            .asConstraint("teacherConsecutiveMax");
    }

    private Constraint classDailyMax(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getStudentGroupId() == null)
            .groupBy(LessonBlock::getClassId,
                     b -> b.getTimeslot().getDay(),
                     ConstraintCollectors.toList())
            .filter((cid, day, list) -> {
                int dmax = list.get(0).getClassDmax();
                int sum = 0;
                for (LessonBlock b : list) sum += b.getLength();
                return sum > dmax;
            })
            .penalize(HardMediumSoftScore.ONE_HARD, (cid, day, list) -> {
                int dmax = list.get(0).getClassDmax();
                int sum = 0;
                for (LessonBlock b : list) sum += b.getLength();
                return sum - dmax;
            })
            .asConstraint("classDailyMax");
    }

    private Constraint lunchAcrossSoft(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> !b.isLunchHard() && b.isForbidAcrossLunch() && b.getLunchAfterPeriod() > 0
                && b.getTimeslot().getPeriod() < b.getLunchAfterPeriod()
                && b.getTimeslot().getPeriod() + b.getLength() > b.getLunchAfterPeriod())
            .penalize(HardMediumSoftScore.ONE_MEDIUM)
            .asConstraint("lunchAcrossSoft");
    }

    private Constraint teacherPreferredFree(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.countPreferredFreeViolations() > 0)
            .penalize(HardMediumSoftScore.ofSoft(20), LessonBlock::countPreferredFreeViolations)
            .asConstraint("teacherPreferredFree");
    }

    private Constraint teacherAvoidDay(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getAvoidDays().contains(b.getTimeslot().getDay()))
            .penalize(HardMediumSoftScore.ofSoft(8))
            .asConstraint("teacherAvoidDay");
    }

    private Constraint teacherDailyGaps(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getTeacherId() != null && !b.getTeacherId().isEmpty())
            .groupBy(LessonBlock::getTeacherId,
                     b -> b.getTimeslot().getDay(),
                     ConstraintCollectors.toList())
            .penalize(HardMediumSoftScore.ofSoft(10), (tid, day, list) -> computeGaps(list))
            .asConstraint("teacherDailyGaps");
    }

    private Constraint classDailyGaps(ConstraintFactory cf) {
        return cf.forEach(LessonBlock.class)
            .filter(b -> b.getStudentGroupId() == null)
            .groupBy(LessonBlock::getClassId,
                     b -> b.getTimeslot().getDay(),
                     ConstraintCollectors.toList())
            .penalize(HardMediumSoftScore.ofSoft(4), (cid, day, list) -> computeGaps(list))
            .asConstraint("classDailyGaps");
    }

    private static int computeGaps(List<LessonBlock> list) {
        if (list.isEmpty()) return 0;
        int P = list.get(0).getPeriodsPerDay();
        boolean[] occ = new boolean[P];
        int first = P, last = -1, cnt = 0;
        for (LessonBlock b : list) {
            int st = b.getTimeslot().getPeriod();
            for (int k = 0; k < b.getLength() && st + k < P; k++) {
                if (!occ[st + k]) {
                    occ[st + k] = true;
                    cnt++;
                    if (st + k < first) first = st + k;
                    if (st + k > last) last = st + k;
                }
            }
        }
        return last < first ? 0 : (last - first + 1) - cnt;
    }
}
