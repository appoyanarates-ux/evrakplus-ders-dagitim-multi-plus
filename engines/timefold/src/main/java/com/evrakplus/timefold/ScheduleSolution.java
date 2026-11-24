package com.evrakplus.timefold;

import ai.timefold.solver.core.api.domain.solution.PlanningEntityCollectionProperty;
import ai.timefold.solver.core.api.domain.solution.PlanningScore;
import ai.timefold.solver.core.api.domain.solution.PlanningSolution;
import ai.timefold.solver.core.api.domain.valuerange.ValueRangeProvider;
import ai.timefold.solver.core.api.score.buildin.hardmediumsoft.HardMediumSoftScore;

import java.util.List;

@PlanningSolution
public class ScheduleSolution {
    @ValueRangeProvider(id = "timeslotRange")
    private List<Timeslot> timeslots;

    @PlanningEntityCollectionProperty
    private List<LessonBlock> blocks;

    @PlanningScore
    private HardMediumSoftScore score;

    public ScheduleSolution() {}

    public ScheduleSolution(List<Timeslot> timeslots, List<LessonBlock> blocks) {
        this.timeslots = timeslots;
        this.blocks = blocks;
    }

    public List<Timeslot> getTimeslots() { return timeslots; }
    public void setTimeslots(List<Timeslot> timeslots) { this.timeslots = timeslots; }

    public List<LessonBlock> getBlocks() { return blocks; }
    public void setBlocks(List<LessonBlock> blocks) { this.blocks = blocks; }

    public HardMediumSoftScore getScore() { return score; }
    public void setScore(HardMediumSoftScore score) { this.score = score; }
}
