package com.evrakplus.timefold;

import ai.timefold.solver.core.api.score.buildin.hardmediumsoft.HardMediumSoftScore;
import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import ai.timefold.solver.core.config.solver.termination.TerminationConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class Main {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String TIMEFOLD_VERSION = "1.17.0";

    private static synchronized void emit(String type, Map<String, Object> payload) {
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", type);
            msg.putAll(payload);
            System.out.println(MAPPER.writeValueAsString(msg));
            System.out.flush();
        } catch (Exception ignored) {}
    }

    private static Map<String, Object> extractPlacements(ScheduleSolution sol) {
        Map<String, Object> placements = new LinkedHashMap<>();
        if (sol == null || sol.getBlocks() == null) return placements;
        for (LessonBlock b : sol.getBlocks()) {
            if (b.getTimeslot() != null) {
                Map<String, Object> pl = new LinkedHashMap<>();
                pl.put("day", b.getTimeslot().getDay());
                pl.put("period", b.getTimeslot().getPeriod());
                pl.put("roomId", b.getRoomId());
                placements.put(b.getBlockId(), pl);
            }
        }
        return placements;
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0 && "--version".equals(args[0])) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("engine", "timefold");
            info.put("version", TIMEFOLD_VERSION);
            info.put("java", System.getProperty("java.version"));
            System.out.println(MAPPER.writeValueAsString(info));
            return;
        }

        long t0 = System.currentTimeMillis();
        InputStream in = System.in;
        String raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        if (raw.isBlank()) {
            emit("FINAL_RESULT", Map.of("status", "ERROR", "rawStatus", "EMPTY_INPUT", "placements", Map.of()));
            System.exit(1);
        }

        JsonNode root = MAPPER.readTree(raw);
        JsonNode school = root.get("school");
        int D = school.get("daysPerWeek").asInt(5);
        int P = school.get("periodsPerDay").asInt(7);
        int lunchAfter = school.path("lunchAfterPeriod").asInt(0);

        Map<String, JsonNode> teacherMap = new HashMap<>();
        for (JsonNode t : root.path("teachers")) teacherMap.put(t.get("id").asText(), t);

        Map<String, JsonNode> classMap = new HashMap<>();
        for (JsonNode c : root.path("classes")) classMap.put(c.get("id").asText(), c);

        boolean diffDaysHard = false;
        boolean lunchHard = false;
        Map<String, Set<Integer>> forbidMap = new HashMap<>();
        Map<String, Set<String>> pairMap = new HashMap<>();

        for (JsonNode c : root.path("constraints")) {
            String type = c.path("type").asText();
            String level = c.path("level").asText("HARD");
            if ("subject_diff_days".equals(type) && "HARD".equals(level)) diffDaysHard = true;
            if ("block_no_across_lunch".equals(type) && "HARD".equals(level)) lunchHard = true;
            if ("subject_forbid_periods".equals(type) && "HARD".equals(level)) {
                String sk = c.path("params").path("subjectKey").asText();
                Set<Integer> ps = forbidMap.computeIfAbsent(sk, k -> new HashSet<>());
                for (JsonNode p : c.path("params").path("periods")) ps.add(p.asInt());
            }
            if ("subject_pair_diff_day".equals(type) && "HARD".equals(level)) {
                String sa = c.path("params").path("subjectA").asText();
                String sb = c.path("params").path("subjectB").asText();
                if (!sa.isEmpty() && !sb.isEmpty()) {
                    pairMap.computeIfAbsent(sa, k -> new HashSet<>()).add(sb);
                    pairMap.computeIfAbsent(sb, k -> new HashSet<>()).add(sa);
                }
            }
        }

        List<Timeslot> timeslots = new ArrayList<>();
        Map<String, Timeslot> slotMap = new HashMap<>();
        for (int d = 0; d < D; d++) {
            for (int p = 0; p < P; p++) {
                Timeslot ts = new Timeslot(d, p);
                timeslots.add(ts);
                slotMap.put(ts.getId(), ts);
            }
        }

        boolean useHints = root.path("options").path("useHints").asBoolean(true);
        List<LessonBlock> blocks = new ArrayList<>();

        for (JsonNode bNode : root.path("blocks")) {
            LessonBlock lb = new LessonBlock();
            lb.setBlockId(bNode.get("blockId").asText());
            lb.setAssignmentId(bNode.get("assignmentId").asText());
            lb.setBlockCount(bNode.path("blockCount").asInt(1));
            lb.setClassId(bNode.get("classId").asText());
            lb.setStudentGroupId(bNode.path("studentGroupId").isNull() ? null : bNode.path("studentGroupId").asText(null));
            lb.setParallelGroupId(bNode.path("parallelGroupId").isNull() ? null : bNode.path("parallelGroupId").asText(null));
            lb.setSubjectKey(bNode.get("subjectKey").asText());
            lb.setTeacherId(bNode.path("teacherId").isNull() ? null : bNode.path("teacherId").asText(null));
            lb.setLength(bNode.path("length").asInt(1));
            lb.setRoomId(bNode.path("roomId").isNull() ? null : bNode.path("roomId").asText(null));
            lb.setAllowMultipleSameDay(bNode.path("allowMultipleSameDay").asBoolean(false));
            lb.setForbidAcrossLunch(bNode.path("forbidAcrossLunch").asBoolean(true));
            lb.setPeriodsPerDay(P);
            lb.setLunchAfterPeriod(lunchAfter);
            lb.setLunchHard(lunchHard);
            lb.setDiffDaysHard(diffDaysHard && lb.getBlockCount() <= D);

            Set<String> forbidden = new HashSet<>();
            JsonNode cls = classMap.get(lb.getClassId());
            if (cls != null) {
                lb.setClassDmax(cls.path("dmax").asInt(P));
                for (JsonNode s : cls.path("closedSlots")) forbidden.add(s.asText());
                if (lb.getRoomId() == null && !cls.path("homeRoomId").isNull()) {
                    lb.setRoomId(cls.path("homeRoomId").asText(null));
                }
            } else {
                lb.setClassDmax(P);
            }

            Set<String> prefFree = new HashSet<>();
            Set<Integer> avoidDays = new HashSet<>();
            JsonNode tch = lb.getTeacherId() != null ? teacherMap.get(lb.getTeacherId()) : null;
            if (tch != null) {
                lb.setTeacherDmax(tch.path("dmax").asInt(P));
                lb.setTeacherCmax(tch.path("cmax").asInt(0));
                for (JsonNode s : tch.path("closedSlots")) forbidden.add(s.asText());
                for (JsonNode s : tch.path("preferredFreeSlots")) prefFree.add(s.asText());
                for (JsonNode d : tch.path("avoidDays")) avoidDays.add(d.asInt());
            } else {
                lb.setTeacherDmax(P);
                lb.setTeacherCmax(0);
            }

            Set<Integer> forbidP = forbidMap.getOrDefault(lb.getSubjectKey(), Collections.emptySet());
            for (int d = 0; d < D; d++) {
                for (int fp : forbidP) forbidden.add(d + "-" + fp);
            }

            lb.setForbiddenSlots(forbidden);
            lb.setPreferredFreeSlots(prefFree);
            lb.setAvoidDays(avoidDays);
            lb.setPairConflictSubjects(pairMap.getOrDefault(lb.getSubjectKey(), Collections.emptySet()));

            // Kilitli dersler (@PlanningPin) veya mevcut gecerli cizelgeden baslangic cozumu (hint)
            if (bNode.path("locked").asBoolean(false) && !bNode.path("lockedPlacement").isNull()) {
                JsonNode lp = bNode.get("lockedPlacement");
                Timeslot ts = slotMap.get(lp.get("day").asInt() + "-" + lp.get("period").asInt());
                if (ts != null) {
                    lb.setTimeslot(ts);
                    lb.setPinned(true);
                }
            } else if (useHints && !bNode.path("hintPlacement").isNull()) {
                JsonNode hp = bNode.get("hintPlacement");
                Timeslot ts = slotMap.get(hp.get("day").asInt() + "-" + hp.get("period").asInt());
                if (ts != null) {
                    lb.setTimeslot(ts);
                }
            }

            blocks.add(lb);
        }

        long timeLimitSec = Math.max(1, root.path("options").path("timeLimitSeconds").asLong(15));
        SolverConfig config = new SolverConfig()
            .withSolutionClass(ScheduleSolution.class)
            .withEntityClasses(LessonBlock.class)
            .withConstraintProviderClass(ScheduleConstraintProvider.class)
            .withTerminationConfig(new TerminationConfig()
                .withSpentLimit(Duration.ofSeconds(timeLimitSec))
                .withUnimprovedSpentLimit(Duration.ofSeconds(Math.max(3, Math.min(8, timeLimitSec / 2)))));

        SolverFactory<ScheduleSolution> factory = SolverFactory.create(config);
        Solver<ScheduleSolution> solver = factory.buildSolver();

        AtomicInteger solCount = new AtomicInteger(0);
        AtomicReference<ScheduleSolution> bestRef = new AtomicReference<>();

        solver.addEventListener(event -> {
            ScheduleSolution best = event.getNewBestSolution();
            bestRef.set(best);
            int n = solCount.incrementAndGet();
            HardMediumSoftScore sc = best.getScore();
            if (sc != null && sc.hardScore() >= 0) {
                Map<String, Object> ev = new LinkedHashMap<>();
                ev.put("solutionsFound", n);
                ev.put("elapsedMs", System.currentTimeMillis() - t0);
                ev.put("hardScore", sc.hardScore());
                ev.put("mediumScore", sc.mediumScore());
                ev.put("softScore", sc.softScore());
                ev.put("placements", extractPlacements(best));
                emit("INTERMEDIATE_SOLUTION", ev);
            }
        });

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (solver.isSolving()) {
                solver.terminateEarly();
            }
        }));

        ScheduleSolution initial = new ScheduleSolution(timeslots, blocks);
        ScheduleSolution solved = solver.solve(initial);
        long elapsedMs = System.currentTimeMillis() - t0;

        HardMediumSoftScore finalScore = solved.getScore();
        boolean feasible = finalScore != null && finalScore.hardScore() >= 0;

        Map<String, Object> res = new LinkedHashMap<>();
        // Timefold metaheuristik oldugu icin OPTIMAL iddia etmez, hardScore >= 0 ise FEASIBLE, degilse INFEASIBLE/PARTIAL
        res.put("status", feasible ? "FEASIBLE" : "INFEASIBLE");
        res.put("rawStatus", finalScore != null ? finalScore.toString() : "UNKNOWN");
        res.put("elapsedMs", elapsedMs);
        res.put("solutionsFound", solCount.get());
        res.put("hardScore", finalScore != null ? finalScore.hardScore() : -1);
        res.put("mediumScore", finalScore != null ? finalScore.mediumScore() : 0);
        res.put("softScore", finalScore != null ? finalScore.softScore() : 0);
        res.put("placements", feasible ? extractPlacements(solved) : Map.of());
        emit("FINAL_RESULT", res);
    }
}
