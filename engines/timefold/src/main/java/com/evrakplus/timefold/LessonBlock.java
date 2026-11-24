package com.evrakplus.timefold;

import ai.timefold.solver.core.api.domain.entity.PlanningEntity;
import ai.timefold.solver.core.api.domain.entity.PlanningPin;
import ai.timefold.solver.core.api.domain.lookup.PlanningId;
import ai.timefold.solver.core.api.domain.variable.PlanningVariable;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

@PlanningEntity
public class LessonBlock {
    @PlanningId
    private String blockId;
    private String assignmentId;
    private int blockCount;
    private String classId;
    private String studentGroupId;
    private String parallelGroupId;
    private String subjectKey;
    private String teacherId;
    private int length;
    private String roomId;
    private boolean allowMultipleSameDay;
    private boolean forbidAcrossLunch;

    // Problem fact metadata for fast constraint checks
    private int periodsPerDay;
    private int lunchAfterPeriod;
    private boolean lunchHard;
    private boolean diffDaysHard;
    private int teacherDmax;
    private int teacherCmax;
    private int classDmax;
    private Set<String> forbiddenSlots = Collections.emptySet();
    private Set<String> preferredFreeSlots = Collections.emptySet();
    private Set<Integer> avoidDays = Collections.emptySet();
    private Set<String> pairConflictSubjects = Collections.emptySet();

    @PlanningPin
    private boolean pinned;

    @PlanningVariable(valueRangeProviderRefs = "timeslotRange")
    private Timeslot timeslot;

    public LessonBlock() {}

    public String getBlockId() { return blockId; }
    public void setBlockId(String blockId) { this.blockId = blockId; }

    public String getAssignmentId() { return assignmentId; }
    public void setAssignmentId(String assignmentId) { this.assignmentId = assignmentId; }

    public int getBlockCount() { return blockCount; }
    public void setBlockCount(int blockCount) { this.blockCount = blockCount; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getStudentGroupId() { return studentGroupId; }
    public void setStudentGroupId(String studentGroupId) { this.studentGroupId = studentGroupId; }

    public String getParallelGroupId() { return parallelGroupId; }
    public void setParallelGroupId(String parallelGroupId) { this.parallelGroupId = parallelGroupId; }

    public String getSubjectKey() { return subjectKey; }
    public void setSubjectKey(String subjectKey) { this.subjectKey = subjectKey; }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public int getLength() { return length; }
    public void setLength(int length) { this.length = length; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public boolean isAllowMultipleSameDay() { return allowMultipleSameDay; }
    public void setAllowMultipleSameDay(boolean allowMultipleSameDay) { this.allowMultipleSameDay = allowMultipleSameDay; }

    public boolean isForbidAcrossLunch() { return forbidAcrossLunch; }
    public void setForbidAcrossLunch(boolean forbidAcrossLunch) { this.forbidAcrossLunch = forbidAcrossLunch; }

    public int getPeriodsPerDay() { return periodsPerDay; }
    public void setPeriodsPerDay(int periodsPerDay) { this.periodsPerDay = periodsPerDay; }

    public int getLunchAfterPeriod() { return lunchAfterPeriod; }
    public void setLunchAfterPeriod(int lunchAfterPeriod) { this.lunchAfterPeriod = lunchAfterPeriod; }

    public boolean isLunchHard() { return lunchHard; }
    public void setLunchHard(boolean lunchHard) { this.lunchHard = lunchHard; }

    public boolean isDiffDaysHard() { return diffDaysHard; }
    public void setDiffDaysHard(boolean diffDaysHard) { this.diffDaysHard = diffDaysHard; }

    public int getTeacherDmax() { return teacherDmax; }
    public void setTeacherDmax(int teacherDmax) { this.teacherDmax = teacherDmax; }

    public int getTeacherCmax() { return teacherCmax; }
    public void setTeacherCmax(int teacherCmax) { this.teacherCmax = teacherCmax; }

    public int getClassDmax() { return classDmax; }
    public void setClassDmax(int classDmax) { this.classDmax = classDmax; }

    public Set<String> getForbiddenSlots() { return forbiddenSlots; }
    public void setForbiddenSlots(Set<String> forbiddenSlots) { this.forbiddenSlots = forbiddenSlots; }

    public Set<String> getPreferredFreeSlots() { return preferredFreeSlots; }
    public void setPreferredFreeSlots(Set<String> preferredFreeSlots) { this.preferredFreeSlots = preferredFreeSlots; }

    public Set<Integer> getAvoidDays() { return avoidDays; }
    public void setAvoidDays(Set<Integer> avoidDays) { this.avoidDays = avoidDays; }

    public Set<String> getPairConflictSubjects() { return pairConflictSubjects; }
    public void setPairConflictSubjects(Set<String> pairConflictSubjects) { this.pairConflictSubjects = pairConflictSubjects; }

    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }

    public Timeslot getTimeslot() { return timeslot; }
    public void setTimeslot(Timeslot timeslot) { this.timeslot = timeslot; }

    public boolean overlapsWith(LessonBlock other) {
        if (this.timeslot == null || other.timeslot == null) return false;
        if (this.timeslot.getDay() != other.timeslot.getDay()) return false;
        int aStart = this.timeslot.getPeriod();
        int aEnd = aStart + this.length;
        int bStart = other.timeslot.getPeriod();
        int bEnd = bStart + other.length;
        return aStart < bEnd && bStart < aEnd;
    }

    public int countUnavailableViolations() {
        if (timeslot == null) return 0;
        int d = timeslot.getDay();
        int p = timeslot.getPeriod();
        int v = 0;
        if (p + length > periodsPerDay) return 10;
        if (lunchHard && forbidAcrossLunch && lunchAfterPeriod > 0 && p < lunchAfterPeriod && p + length > lunchAfterPeriod) {
            v += 1;
        }
        for (int k = 0; k < length; k++) {
            if (forbiddenSlots.contains(d + "-" + (p + k))) v += 1;
        }
        return v;
    }

    public int countPreferredFreeViolations() {
        if (timeslot == null || preferredFreeSlots.isEmpty()) return 0;
        int d = timeslot.getDay();
        int p = timeslot.getPeriod();
        int v = 0;
        for (int k = 0; k < length; k++) {
            if (preferredFreeSlots.contains(d + "-" + (p + k))) v += 1;
        }
        return v;
    }

    public boolean conflictsClassGroup(LessonBlock other) {
        if (this.studentGroupId == null || other.studentGroupId == null) return true;
        return this.studentGroupId.equals(other.studentGroupId);
    }
}
