package com.evrakplus.timefold;

import ai.timefold.solver.core.api.domain.entity.PlanningEntity;
import ai.timefold.solver.core.api.domain.entity.PlanningPin;
import ai.timefold.solver.core.api.domain.lookup.PlanningId;
import ai.timefold.solver.core.api.domain.solution.PlanningEntityCollectionProperty;
import ai.timefold.solver.core.api.domain.solution.PlanningScore;
import ai.timefold.solver.core.api.domain.solution.PlanningSolution;
import ai.timefold.solver.core.api.domain.solution.ProblemFactCollectionProperty;
import ai.timefold.solver.core.api.domain.valuerange.ValueRangeProvider;
import ai.timefold.solver.core.api.domain.variable.PlanningVariable;
import ai.timefold.solver.core.api.score.buildin.hardsoft.HardSoftScore;
import ai.timefold.solver.core.api.score.calculator.EasyScoreCalculator;
import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import ai.timefold.solver.core.config.solver.termination.TerminationConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.File;
import java.time.Duration;
import java.util.*;

public class TimefoldTimetableApp {

    public static class CandidateSlot {
        public int id;
        public int taskIndex;
        public int dayIndex;
        public int startPeriod;
        public int startMin;
        public int endMin;
        public int avoidCost;

        public CandidateSlot() {}
        public CandidateSlot(int id, int taskIndex, int dayIndex, int startPeriod, int startMin, int endMin, int avoidCost) {
            this.id = id;
            this.taskIndex = taskIndex;
            this.dayIndex = dayIndex;
            this.startPeriod = startPeriod;
            this.startMin = startMin;
            this.endMin = endMin;
            this.avoidCost = avoidCost;
        }
    }

    @PlanningEntity
    public static class LessonBlockTask {
        @PlanningId
        public Integer id;
        public String assignmentId;
        public int blockIndex;
        public String classId;
        public String courseId;
        public List<String> teacherIds;
        public String roomId;
        public String roomType;
        public String building;
        public int length;
        public int maxBlocksPerDay;
        public boolean pinned;
        public List<CandidateSlot> allowedSlots;

        @PlanningVariable(valueRangeProviderRefs = {"slotRange"})
        public CandidateSlot chosenSlot;

        public LessonBlockTask() {}

        @PlanningPin
        public boolean isPinned() {
            return pinned;
        }

        @ValueRangeProvider(id = "slotRange")
        public List<CandidateSlot> getAllowedSlots() {
            return allowedSlots;
        }
    }

    public static class ProblemContext {
        public int numDays;
        public int periodsPerDay;
        public int travelMin;
        public Map<String, Integer> teacherMaxDaily = new HashMap<>();
        public Map<String, Integer> teacherMaxConsec = new HashMap<>();
        public Map<String, Integer> roomCap = new HashMap<>();
        public Map<String, Integer> roomTypeCap = new HashMap<>();
        public int gapWeight = 10;
        public int spreadWeight = 8;
        public int avoidWeight = 6;
    }

    @PlanningSolution
    public static class TimetableSolution {
        @PlanningEntityCollectionProperty
        public List<LessonBlockTask> tasks;

        @ProblemFactCollectionProperty
        public List<ProblemContext> contexts;

        @PlanningScore
        public HardSoftScore score;

        public TimetableSolution() {}
    }

    public static class TimetableEasyScoreCalculator implements EasyScoreCalculator<TimetableSolution, HardSoftScore> {
        @Override
        public HardSoftScore calculateScore(TimetableSolution sol) {
            ProblemContext ctx = (sol.contexts != null && !sol.contexts.isEmpty()) ? sol.contexts.get(0) : new ProblemContext();
            int hard = 0;
            int soft = 0;

            Map<String, List<LessonBlockTask>> classDay = new HashMap<>();
            Map<String, List<LessonBlockTask>> teacherDay = new HashMap<>();
            Map<String, List<LessonBlockTask>> roomDay = new HashMap<>();
            Map<String, List<LessonBlockTask>> rtypeDay = new HashMap<>();
            Map<String, Integer> asgnDayCount = new HashMap<>();

            for (LessonBlockTask t : sol.tasks) {
                if (t.chosenSlot == null) {
                    hard -= 100;
                    continue;
                }
                int d = t.chosenSlot.dayIndex;
                soft -= t.chosenSlot.avoidCost;

                classDay.computeIfAbsent(t.classId + ":" + d, k -> new ArrayList<>()).add(t);
                String adKey = t.assignmentId + ":" + d;
                asgnDayCount.put(adKey, asgnDayCount.getOrDefault(adKey, 0) + 1);

                for (String tid : t.teacherIds) {
                    teacherDay.computeIfAbsent(tid + ":" + d, k -> new ArrayList<>()).add(t);
                }
                if (t.roomId != null && !t.roomId.isEmpty()) {
                    roomDay.computeIfAbsent(t.roomId + ":" + d, k -> new ArrayList<>()).add(t);
                } else if (t.roomType != null && !"standard".equals(t.roomType) && ctx.roomTypeCap.containsKey(t.roomType)) {
                    rtypeDay.computeIfAbsent(t.roomType + ":" + d, k -> new ArrayList<>()).add(t);
                }
            }

            // 1. Class overlaps (physical time)
            for (List<LessonBlockTask> list : classDay.values()) {
                int n = list.size();
                for (int i = 0; i < n; i++) {
                    CandidateSlot a = list.get(i).chosenSlot;
                    for (int j = i + 1; j < n; j++) {
                        CandidateSlot b = list.get(j).chosenSlot;
                        if (a.startMin < b.endMin && b.startMin < a.endMin) {
                            hard -= 10;
                        }
                    }
                }
            }

            // 2. Teacher overlaps, daily max, consecutive max, building travel, gaps
            for (Map.Entry<String, List<LessonBlockTask>> entry : teacherDay.entrySet()) {
                String[] parts = entry.getKey().split(":");
                String tid = parts[0];
                List<LessonBlockTask> list = entry.getValue();
                int dayHours = 0;
                int n = list.size();
                BitSet periods = new BitSet(ctx.periodsPerDay + 2);
                int minP = Integer.MAX_VALUE;
                int maxP = Integer.MIN_VALUE;

                for (int i = 0; i < n; i++) {
                    LessonBlockTask ti = list.get(i);
                    CandidateSlot a = ti.chosenSlot;
                    dayHours += ti.length;
                    for (int k = 0; k < ti.length; k++) {
                        int p = a.startPeriod + k;
                        periods.set(p);
                        if (p < minP) minP = p;
                        if (p > maxP) maxP = p;
                    }
                    for (int j = i + 1; j < n; j++) {
                        LessonBlockTask tj = list.get(j);
                        CandidateSlot b = tj.chosenSlot;
                        if (a.startMin < b.endMin && b.startMin < a.endMin) {
                            hard -= 10;
                        } else if (ctx.travelMin > 0 && ti.building != null && tj.building != null && !ti.building.equals(tj.building)) {
                            int gap = a.endMin <= b.startMin ? (b.startMin - a.endMin) : (a.startMin - b.endMin);
                            if (gap < ctx.travelMin) {
                                hard -= 10;
                            } else {
                                soft -= 3;
                            }
                        }
                    }
                }

                int maxD = ctx.teacherMaxDaily.getOrDefault(tid, ctx.periodsPerDay);
                if (dayHours > maxD) {
                    hard -= (dayHours - maxD) * 5;
                }

                int maxConsec = ctx.teacherMaxConsec.getOrDefault(tid, 0);
                if (maxConsec > 0 && minP <= maxP) {
                    int run = 0;
                    for (int p = minP; p <= maxP; p++) {
                        if (periods.get(p)) {
                            run++;
                            if (run > maxConsec) hard -= 5;
                        } else {
                            run = 0;
                        }
                    }
                }

                if (minP < maxP) {
                    int active = periods.cardinality();
                    int gaps = (maxP - minP + 1) - active;
                    if (gaps > 0) {
                        soft -= gaps * ctx.gapWeight;
                    }
                }
            }

            // 3. Room & roomType capacities
            for (Map.Entry<String, List<LessonBlockTask>> e : roomDay.entrySet()) {
                String rid = e.getKey().split(":")[0];
                int cap = ctx.roomCap.getOrDefault(rid, 1);
                hard -= countCapViolations(e.getValue(), cap) * 10;
            }
            for (Map.Entry<String, List<LessonBlockTask>> e : rtypeDay.entrySet()) {
                String rt = e.getKey().split(":")[0];
                int cap = ctx.roomTypeCap.getOrDefault(rt, 1);
                hard -= countCapViolations(e.getValue(), cap) * 10;
            }

            // 4. Max blocks per day & spread
            Map<String, Integer> maxBMap = new HashMap<>();
            for (LessonBlockTask t : sol.tasks) {
                maxBMap.put(t.assignmentId, t.maxBlocksPerDay);
            }
            for (Map.Entry<String, Integer> e : asgnDayCount.entrySet()) {
                String aid = e.getKey().split(":")[0];
                int cnt = e.getValue();
                int maxB = maxBMap.getOrDefault(aid, 1);
                if (maxB > 0 && cnt > maxB) {
                    hard -= (cnt - maxB) * 5;
                }
                if (cnt > 1) {
                    soft -= (cnt - 1) * ctx.spreadWeight;
                }
            }

            return HardSoftScore.of(hard, soft);
        }

        private int countCapViolations(List<LessonBlockTask> list, int cap) {
            if (list.size() <= cap) return 0;
            int viol = 0;
            for (LessonBlockTask t : list) {
                int tp = t.chosenSlot.startMin;
                int active = 0;
                for (LessonBlockTask o : list) {
                    if (o.chosenSlot.startMin <= tp && tp < o.chosenSlot.endMin) {
                        active++;
                    }
                }
                if (active > cap) viol += (active - cap);
            }
            return viol;
        }
    }

    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String inputPath = null;
        String outputPath = null;
        boolean health = false;
        for (int i = 0; i < args.length; i++) {
            if ("--health".equals(args[i])) health = true;
            else if (("--input".equals(args[i]) || "-i".equals(args[i])) && i + 1 < args.length) inputPath = args[++i];
            else if (("--output".equals(args[i]) || "-o".equals(args[i])) && i + 1 < args.length) outputPath = args[++i];
        }

        String version = TimefoldTimetableApp.class.getPackage().getImplementationVersion();
        Package tfPkg = SolverFactory.class.getPackage();
        String tfVer = (tfPkg != null && tfPkg.getImplementationVersion() != null) ? tfPkg.getImplementationVersion() : "1.17.0";

        if (health) {
            ObjectNode res = mapper.createObjectNode();
            res.put("available", true);
            res.put("engine", "timefold_solver");
            res.put("display_name", "Timefold Solver");
            res.put("version", "Timefold Solver " + tfVer + " (Java " + System.getProperty("java.version") + ")");
            ObjectNode caps = res.putObject("capabilities");
            caps.put("dual_shift", true);
            caps.put("building_travel", true);
            caps.put("common_elective", true);
            caps.put("multi_teacher", true);
            caps.put("special_rooms", true);
            caps.put("max_consecutive", true);
            caps.put("warm_start", true);
            System.out.println(mapper.writeValueAsString(res));
            return;
        }

        if (inputPath == null) {
            System.err.println("{\"type\":\"error\",\"message\":\"Missing --input\"}");
            System.exit(1);
        }

        long t0 = System.nanoTime();
        JsonNode root = mapper.readTree(new File(inputPath));
        double timeLimitSec = root.path("time_limit_sec").asDouble(15.0);
        ProblemContext ctx = new ProblemContext();
        ctx.numDays = root.path("num_days").asInt(5);
        ctx.periodsPerDay = root.path("periods_per_day").asInt(8);
        ctx.travelMin = root.path("travel_min").asInt(0);
        String pref = root.path("preference").asText("balanced");
        if ("fewer_gaps".equals(pref)) { ctx.gapWeight = 24; ctx.spreadWeight = 4; }
        else if ("spread_days".equals(pref)) { ctx.gapWeight = 6; ctx.spreadWeight = 20; }

        root.path("teacher_max_daily").fields().forEachRemaining(e -> ctx.teacherMaxDaily.put(e.getKey(), e.getValue().asInt()));
        root.path("teacher_max_consec").fields().forEachRemaining(e -> ctx.teacherMaxConsec.put(e.getKey(), e.getValue().asInt()));
        root.path("room_cap").fields().forEachRemaining(e -> ctx.roomCap.put(e.getKey(), e.getValue().asInt()));
        root.path("room_type_cap").fields().forEachRemaining(e -> ctx.roomTypeCap.put(e.getKey(), e.getValue().asInt()));

        List<LessonBlockTask> tasks = new ArrayList<>();
        int idx = 0;
        for (JsonNode tn : root.path("tasks")) {
            LessonBlockTask t = new LessonBlockTask();
            t.id = idx;
            t.assignmentId = tn.path("assignment_id").asText();
            t.blockIndex = tn.path("block_index").asInt();
            t.classId = tn.path("class_id").asText();
            t.courseId = tn.path("course_id").asText("");
            t.teacherIds = new ArrayList<>();
            for (JsonNode tid : tn.path("teacher_ids")) t.teacherIds.add(tid.asText());
            t.roomId = tn.path("room_id").isNull() ? null : tn.path("room_id").asText(null);
            t.roomType = tn.path("room_type").asText("standard");
            t.building = tn.path("building").isNull() ? null : tn.path("building").asText(null);
            t.length = tn.path("length").asInt(1);
            t.maxBlocksPerDay = tn.path("max_blocks_per_day").asInt(1);
            t.pinned = tn.path("pinned").asBoolean(false);
            t.allowedSlots = new ArrayList<>();
            int cidx = 0;
            for (JsonNode cn : tn.path("candidates")) {
                CandidateSlot cs = new CandidateSlot(
                    cidx++, idx,
                    cn.path("day_index").asInt(),
                    cn.path("start_period").asInt(),
                    cn.path("start_min").asInt(),
                    cn.path("end_min").asInt(),
                    cn.path("avoid_cost").asInt(0)
                );
                t.allowedSlots.add(cs);
            }
            // Warm-start: if initial placement provided, pre-assign matching candidate
            if (tn.has("init_day") && tn.has("init_period")) {
                int iday = tn.path("init_day").asInt();
                int iper = tn.path("init_period").asInt();
                for (CandidateSlot cs : t.allowedSlots) {
                    if (cs.dayIndex == iday && cs.startPeriod == iper) {
                        t.chosenSlot = cs;
                        break;
                    }
                }
            }
            if (t.pinned && t.chosenSlot == null && !t.allowedSlots.isEmpty()) {
                t.chosenSlot = t.allowedSlots.get(0);
            }
            tasks.add(t);
            idx++;
        }

        TimetableSolution problem = new TimetableSolution();
        problem.tasks = tasks;
        problem.contexts = Collections.singletonList(ctx);

        SolverConfig solverConfig = new SolverConfig()
            .withSolutionClass(TimetableSolution.class)
            .withEntityClasses(LessonBlockTask.class)
            .withEasyScoreCalculatorClass(TimetableEasyScoreCalculator.class)
            .withTerminationConfig(new TerminationConfig()
                .withSpentLimit(Duration.ofMillis((long) Math.max(1000, timeLimitSec * 1000)))
                .withUnimprovedSpentLimit(Duration.ofMillis((long) Math.max(1500, Math.min(8000, timeLimitSec * 400)))));

        SolverFactory<TimetableSolution> factory = SolverFactory.create(solverConfig);
        Solver<TimetableSolution> solver = factory.buildSolver();
        TimetableSolution solved = solver.solve(problem);

        double elapsed = Math.round(((System.nanoTime() - t0) / 1e9) * 1000.0) / 1000.0;
        boolean feasible = solved.score != null && solved.score.hardScore() == 0;

        ObjectNode out = mapper.createObjectNode();
        out.put("engine", "timefold_solver");
        out.put("engine_version", "Timefold Solver " + tfVer + " (Java " + System.getProperty("java.version") + ")");
        out.put("status", feasible ? "FEASIBLE" : "TIME_LIMIT");
        out.put("solve_time_sec", elapsed);
        out.put("hard_score", solved.score != null ? solved.score.hardScore() : -1);
        out.put("soft_score", solved.score != null ? solved.score.softScore() : 0);
        out.put("total_blocks", solved.tasks.size());

        ArrayNode plArr = out.putArray("placements");
        if (feasible) {
            for (LessonBlockTask t : solved.tasks) {
                if (t.chosenSlot == null) continue;
                ObjectNode p = plArr.addObject();
                p.put("assignment_id", t.assignmentId);
                p.put("block_index", t.blockIndex);
                p.put("class_id", t.classId);
                p.put("course_id", t.courseId);
                ArrayNode tids = p.putArray("teacher_ids");
                for (String tid : t.teacherIds) tids.add(tid);
                if (t.roomId != null) p.put("room_id", t.roomId); else p.putNull("room_id");
                p.put("day_index", t.chosenSlot.dayIndex);
                p.put("start_period", t.chosenSlot.startPeriod);
                p.put("length", t.length);
            }
        }
        out.put("placed_blocks", plArr.size());

        String json = mapper.writeValueAsString(out);
        if (outputPath != null) {
            mapper.writeValue(new File(outputPath), out);
        } else {
            System.out.println(json);
        }
    }
}
