package com.evrakplus.timefold;

import ai.timefold.solver.core.api.domain.lookup.PlanningId;
import java.util.Objects;

public class Timeslot {
    @PlanningId
    private String id;
    private int day;
    private int period;

    public Timeslot() {}

    public Timeslot(int day, int period) {
        this.day = day;
        this.period = period;
        this.id = day + "-" + period;
    }

    public String getId() { return id; }
    public int getDay() { return day; }
    public int getPeriod() { return period; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Timeslot t)) return false;
        return day == t.day && period == t.period;
    }

    @Override
    public int hashCode() { return Objects.hash(day, period); }

    @Override
    public String toString() { return id; }
}
