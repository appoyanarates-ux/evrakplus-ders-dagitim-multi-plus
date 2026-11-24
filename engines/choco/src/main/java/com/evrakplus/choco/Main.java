package com.evrakplus.choco;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.chocosolver.solver.Model;
import org.chocosolver.solver.Solver;
import org.chocosolver.solver.exception.ContradictionException;
import org.chocosolver.solver.search.strategy.Search;
import org.chocosolver.solver.variables.BoolVar;
import org.chocosolver.solver.variables.IntVar;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * EvrakPlus Ders Dagitim Multi Plus - Choco Solver 4.10.18 Gercek CP Motoru
 * Karmasik bloklar, derslik, bina gecis suresi, kisit etki raporu ve alternatif cozum uretimi.
 */
public class Main {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String CHOCO_VERSION = "4.10.18";

    private static synchronized void emit(String type, Map<String, Object> payload) {
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", type);
            msg.putAll(payload);
            System.out.println(MAPPER.writeValueAsString(msg));
            System.out.flush();
        } catch (Exception ignored) {}
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0 && "--version".equals(args[0])) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("engine", "choco");
            info.put("version", CHOCO_VERSION);
            info.put("java", System.getProperty("java.version"));
            System.out.println(MAPPER.writeValueAsString(info));
            return;
        }

        long t0 = System.currentTimeMillis();
        String raw = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
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

        List<JsonNode> roomList = new ArrayList<>();
        Map<String, Integer> roomIdxMap = new HashMap<>();
        for (JsonNode r : root.path("rooms")) {
            roomIdxMap.put(r.get("id").asText(), roomList.size());
            roomList.add(r);
        }

        // Bina gecis matrisi: buildingId -> (otherBuildingId -> minGap)
        Map<String, Map<String, Integer>> transMap = new HashMap<>();
        for (JsonNode b : root.path("buildings")) {
            Map<String, Integer> m = new HashMap<>();
            JsonNode tp = b.path("transitionPeriods");
            if (tp.isObject()) {
                Iterator<Map.Entry<String, JsonNode>> it = tp.fields();
                while (it.hasNext()) {
                    Map.Entry<String, JsonNode> en = it.next();
                    m.put(en.getKey(), en.getValue().asInt(0));
                }
            }
            transMap.put(b.get("id").asText(), m);
        }

        boolean diffDaysHard = false;
        boolean lunchHard = false;
        Map<String, Set<Integer>> forbidMap = new HashMap<>();
        List<String[]> pairRules = new ArrayList<>();

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
                if (!sa.isEmpty() && !sb.isEmpty()) pairRules.add(new String[]{sa, sb});
            }
        }

        List<JsonNode> blocks = new ArrayList<>();
        for (JsonNode b : root.path("blocks")) blocks.add(b);
        int B = blocks.size();

        Model model = new Model("EvrakPlus-Choco");
        IntVar[] startVars = new IntVar[B];
        IntVar[] dayVars = new IntVar[B];
        IntVar[] periodVars = new IntVar[B];
        IntVar[] roomVars = new IntVar[B]; // null if no room assignment needed
        int[] lengths = new int[B];

        Map<String, Integer> constraintCounts = new LinkedHashMap<>();
        int initialDomainSum = 0;

        // 1. Degiskenler ve domain filtreleme
        for (int i = 0; i < B; i++) {
            JsonNode b = blocks.get(i);
            int len = b.path("length").asInt(1);
            lengths[i] = len;

            String cid = b.get("classId").asText();
            JsonNode cls = classMap.get(cid);
            Set<String> closed = new HashSet<>();
            if (cls != null) for (JsonNode s : cls.path("closedSlots")) closed.add(s.asText());

            List<String> tids = new ArrayList<>();
            if (!b.path("teacherId").isNull() && !b.path("teacherId").asText("").isEmpty()) {
                tids.add(b.path("teacherId").asText());
            }
            for (JsonNode ct : b.path("coTeacherIds")) tids.add(ct.asText());
            for (String tid : tids) {
                JsonNode t = teacherMap.get(tid);
                if (t != null) for (JsonNode s : t.path("closedSlots")) closed.add(s.asText());
            }

            Set<Integer> forbidP = forbidMap.getOrDefault(b.get("subjectKey").asText(), Collections.emptySet());
            boolean locked = b.path("locked").asBoolean(false) && !b.path("lockedPlacement").isNull();
            int lockDay = locked ? b.path("lockedPlacement").get("day").asInt() : -1;
            int lockPer = locked ? b.path("lockedPlacement").get("period").asInt() : -1;

            List<Integer> validSlots = new ArrayList<>();
            for (int d = 0; d < D; d++) {
                for (int p = 0; p + len <= P; p++) {
                    if (locked && (d != lockDay || p != lockPer)) continue;
                    if (lunchHard && b.path("forbidAcrossLunch").asBoolean(true) && lunchAfter > 0
                        && p < lunchAfter && p + len > lunchAfter) continue;
                    boolean ok = true;
                    for (int k = 0; k < len; k++) {
                        if (closed.contains(d + "-" + (p + k)) || forbidP.contains(p + k)) {
                            ok = false;
                            break;
                        }
                    }
                    if (ok) validSlots.add(d * P + p);
                }
            }

            if (validSlots.isEmpty()) {
                emit("FINAL_RESULT", Map.of(
                    "status", "INFEASIBLE",
                    "rawStatus", "EMPTY_DOMAIN",
                    "elapsedMs", System.currentTimeMillis() - t0,
                    "message", "Blok " + b.get("blockId").asText() + " icin uygun saat yok.",
                    "placements", Map.of()
                ));
                return;
            }

            int[] dom = validSlots.stream().mapToInt(Integer::intValue).toArray();
            initialDomainSum += dom.length;
            startVars[i] = model.intVar("s_" + i, dom);
            dayVars[i] = model.intVar("d_" + i, 0, D - 1);
            periodVars[i] = model.intVar("p_" + i, 0, P - 1);
            model.div(startVars[i], model.intVar(P), dayVars[i]).post();
            model.mod(startVars[i], P, periodVars[i]).post();

            // Derslik degiskeni
            if (!roomList.isEmpty()) {
                String reqType = b.path("requiredRoomType").isNull() ? null : b.path("requiredRoomType").asText(null);
                String fixedRoom = b.path("roomId").isNull() ? null : b.path("roomId").asText(null);
                if (fixedRoom == null && reqType == null && cls != null && !cls.path("homeRoomId").isNull()) {
                    fixedRoom = cls.path("homeRoomId").asText(null);
                }
                if (fixedRoom != null || reqType != null) {
                    int stuCount = cls != null ? cls.path("studentCount").asInt(0) : 0;
                    List<Integer> elig = new ArrayList<>();
                    for (int ri = 0; ri < roomList.size(); ri++) {
                        JsonNode r = roomList.get(ri);
                        if (fixedRoom != null && !r.get("id").asText().equals(fixedRoom)) continue;
                        if (reqType != null && !reqType.equals(r.path("type").asText())) continue;
                        if (stuCount > r.path("capacity").asInt(999)) continue;
                        elig.add(ri);
                    }
                    if (elig.isEmpty()) {
                        emit("FINAL_RESULT", Map.of(
                            "status", "INFEASIBLE",
                            "rawStatus", "NO_ELIGIBLE_ROOM",
                            "elapsedMs", System.currentTimeMillis() - t0,
                            "placements", Map.of()
                        ));
                        return;
                    }
                    roomVars[i] = model.intVar("r_" + i, elig.stream().mapToInt(Integer::intValue).toArray());
                    // Derslik kapali saatleri
                    for (int ri : elig) {
                        JsonNode r = roomList.get(ri);
                        Set<String> rClosed = new HashSet<>();
                        for (JsonNode s : r.path("closedSlots")) rClosed.add(s.asText());
                        if (!rClosed.isEmpty()) {
                            for (int slot : dom) {
                                int dd = slot / P, pp = slot % P;
                                boolean clash = false;
                                for (int k = 0; k < len; k++) if (rClosed.contains(dd + "-" + (pp + k))) clash = true;
                                if (clash) {
                                    model.ifThen(model.arithm(roomVars[i], "=", ri), model.arithm(startVars[i], "!=", slot));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Ogretmen ve Sinif Cakismasizligi + Bina Gecis Suresi
        int cTeacher = 0, cClass = 0, cRoom = 0, cBuilding = 0;
        for (int i = 0; i < B; i++) {
            JsonNode bi = blocks.get(i);
            String ti = bi.path("teacherId").asText("");
            String ci = bi.get("classId").asText();
            String sgi = bi.path("studentGroupId").isNull() ? null : bi.path("studentGroupId").asText(null);
            String pgi = bi.path("parallelGroupId").isNull() ? null : bi.path("parallelGroupId").asText(null);

            for (int j = i + 1; j < B; j++) {
                JsonNode bj = blocks.get(j);
                String tj = bj.path("teacherId").asText("");
                String cj = bj.get("classId").asText();
                String sgj = bj.path("studentGroupId").isNull() ? null : bj.path("studentGroupId").asText(null);
                String pgj = bj.path("parallelGroupId").isNull() ? null : bj.path("parallelGroupId").asText(null);

                // Paralel grup senkronizasyonu
                if (pgi != null && pgi.equals(pgj)) {
                    model.arithm(startVars[i], "=", startVars[j]).post();
                }

                // Ogretmen cakismasi
                if (!ti.isEmpty() && ti.equals(tj)) {
                    model.or(
                        model.arithm(startVars[i], "-", startVars[j], "<=", -lengths[i]),
                        model.arithm(startVars[j], "-", startVars[i], "<=", -lengths[j])
                    ).post();
                    cTeacher++;

                    // Bina gecis suresi (her iki blok derslik/bina kullaniyorsa)
                    if (roomVars[i] != null && roomVars[j] != null && !transMap.isEmpty()) {
                        for (int ri = roomVars[i].getLB(); ri <= roomVars[i].getUB(); ri = roomVars[i].nextValue(ri)) {
                            String b1 = roomList.get(ri).path("buildingId").asText("");
                            Map<String, Integer> tm = transMap.getOrDefault(b1, Collections.emptyMap());
                            for (int rj = roomVars[j].getLB(); rj <= roomVars[j].getUB(); rj = roomVars[j].nextValue(rj)) {
                                String b2 = roomList.get(rj).path("buildingId").asText("");
                                if (!b1.isEmpty() && !b2.isEmpty() && !b1.equals(b2)) {
                                    int gap = tm.getOrDefault(b2, 0);
                                    if (gap > 0) {
                                        model.ifThen(
                                            model.and(
                                                model.arithm(roomVars[i], "=", ri),
                                                model.arithm(roomVars[j], "=", rj),
                                                model.arithm(dayVars[i], "=", dayVars[j])
                                            ),
                                            model.or(
                                                model.arithm(periodVars[i], "-", periodVars[j], "<=", -(lengths[i] + gap)),
                                                model.arithm(periodVars[j], "-", periodVars[i], "<=", -(lengths[j] + gap))
                                            )
                                        );
                                        cBuilding++;
                                    }
                                }
                            }
                        }
                    }
                }

                // Sinif cakismasi (farkli alt ogrenci gruplari haric)
                if (ci.equals(cj) && (sgi == null || sgj == null || sgi.equals(sgj))) {
                    model.or(
                        model.arithm(startVars[i], "-", startVars[j], "<=", -lengths[i]),
                        model.arithm(startVars[j], "-", startVars[i], "<=", -lengths[j])
                    ).post();
                    cClass++;
                }

                // Derslik cakismasi
                if (roomVars[i] != null && roomVars[j] != null) {
                    model.ifThen(
                        model.arithm(roomVars[i], "=", roomVars[j]),
                        model.or(
                            model.arithm(startVars[i], "-", startVars[j], "<=", -lengths[i]),
                            model.arithm(startVars[j], "-", startVars[i], "<=", -lengths[j])
                        )
                    );
                    cRoom++;
                }
            }
        }
        constraintCounts.put("teacherNoConflict", cTeacher);
        constraintCounts.put("classNoConflict", cClass);
        constraintCounts.put("roomNoConflict", cRoom);
        constraintCounts.put("buildingTransition", cBuilding);

        // 3. Ayni dersin bloklari farkli gunlerde
        int cDiffDays = 0;
        if (diffDaysHard) {
            Map<String, List<Integer>> byAssign = new HashMap<>();
            for (int i = 0; i < B; i++) {
                JsonNode b = blocks.get(i);
                if (!b.path("allowMultipleSameDay").asBoolean(false) && b.path("blockCount").asInt(1) <= D) {
                    byAssign.computeIfAbsent(b.get("assignmentId").asText(), k -> new ArrayList<>()).add(i);
                }
            }
            for (List<Integer> idxs : byAssign.values()) {
                if (idxs.size() > 1) {
                    IntVar[] dvs = idxs.stream().map(idx -> dayVars[idx]).toArray(IntVar[]::new);
                    model.allDifferent(dvs).post();
                    cDiffDays++;
                }
            }
        }
        constraintCounts.put("subjectDiffDays", cDiffDays);

        // 4. Iki ders ayni gune dusmesin
        int cPairs = 0;
        for (String[] pr : pairRules) {
            for (int i = 0; i < B; i++) {
                for (int j = i + 1; j < B; j++) {
                    JsonNode bi = blocks.get(i), bj = blocks.get(j);
                    if (!bi.get("classId").asText().equals(bj.get("classId").asText())) continue;
                    String si = bi.get("subjectKey").asText(), sj = bj.get("subjectKey").asText();
                    if ((si.equals(pr[0]) && sj.equals(pr[1])) || (si.equals(pr[1]) && sj.equals(pr[0]))) {
                        model.arithm(dayVars[i], "!=", dayVars[j]).post();
                        cPairs++;
                    }
                }
            }
        }
        constraintCounts.put("subjectPairDiffDay", cPairs);

        // 5. Ogretmen gunluk maks ders (dmax)
        int cDmax = 0;
        Map<String, List<Integer>> byTeacher = new HashMap<>();
        for (int i = 0; i < B; i++) {
            String tid = blocks.get(i).path("teacherId").asText("");
            if (!tid.isEmpty()) byTeacher.computeIfAbsent(tid, k -> new ArrayList<>()).add(i);
        }
        for (Map.Entry<String, List<Integer>> en : byTeacher.entrySet()) {
            JsonNode t = teacherMap.get(en.getKey());
            int dmax = t != null ? t.path("dmax").asInt(P) : P;
            if (dmax < P) {
                List<Integer> idxs = en.getValue();
                for (int d = 0; d < D; d++) {
                    BoolVar[] onDay = new BoolVar[idxs.size()];
                    int[] weights = new int[idxs.size()];
                    for (int k = 0; k < idxs.size(); k++) {
                        onDay[k] = model.arithm(dayVars[idxs.get(k)], "=", d).reify();
                        weights[k] = lengths[idxs.get(k)];
                    }
                    model.scalar(onDay, weights, "<=", dmax).post();
                    cDmax++;
                }
            }
        }
        constraintCounts.put("teacherDailyMax", cDmax);

        // Ilk yayilim (propagation) ile kisit etki olcumu
        Solver solver = model.getSolver();
        int afterPropDomainSum = initialDomainSum;
        try {
            solver.propagate();
            afterPropDomainSum = 0;
            for (IntVar v : startVars) afterPropDomainSum += v.getDomainSize();
        } catch (ContradictionException ce) {
            emit("FINAL_RESULT", Map.of(
                "status", "INFEASIBLE",
                "rawStatus", "PROPAGATION_CONTRADICTION",
                "elapsedMs", System.currentTimeMillis() - t0,
                "constraintImpact", Map.of(
                    "constraintCounts", constraintCounts,
                    "initialDomainSum", initialDomainSum,
                    "afterPropagationDomainSum", 0,
                    "contradiction", ce.getMessage() != null ? ce.getMessage() : "Contradiction"
                ),
                "placements", Map.of()
            ));
            return;
        }

        long timeLimitSec = Math.max(1, root.path("options").path("timeLimitSeconds").asLong(15));
        int maxAlternatives = Math.max(1, root.path("options").path("maxAlternatives").asInt(3));
        solver.limitTime(timeLimitSec + "s");
        solver.setSearch(Search.domOverWDegSearch(startVars));

        List<Map<String, Object>> alternatives = new ArrayList<>();
        while (alternatives.size() < maxAlternatives && solver.solve()) {
            Map<String, Object> plMap = new LinkedHashMap<>();
            for (int i = 0; i < B; i++) {
                int s = startVars[i].getValue();
                String rid = roomVars[i] != null ? roomList.get(roomVars[i].getValue()).get("id").asText() : null;
                Map<String, Object> cell = new LinkedHashMap<>();
                cell.put("day", s / P);
                cell.put("period", s % P);
                cell.put("roomId", rid);
                plMap.put(blocks.get(i).get("blockId").asText(), cell);
            }
            alternatives.add(plMap);
            emit("INTERMEDIATE_SOLUTION", Map.of(
                "solutionsFound", alternatives.size(),
                "elapsedMs", System.currentTimeMillis() - t0,
                "placements", plMap
            ));
        }

        long elapsedMs = System.currentTimeMillis() - t0;
        String status;
        if (!alternatives.isEmpty()) {
            status = "FEASIBLE";
        } else if (solver.isStopCriterionMet()) {
            status = "TIME_LIMIT";
        } else {
            status = "INFEASIBLE";
        }

        Map<String, Object> impact = new LinkedHashMap<>();
        impact.put("constraintCounts", constraintCounts);
        impact.put("initialDomainSum", initialDomainSum);
        impact.put("afterPropagationDomainSum", afterPropDomainSum);
        impact.put("domainReductionPercent", initialDomainSum > 0
            ? Math.round((1.0 - (double) afterPropDomainSum / initialDomainSum) * 10000.0) / 100.0
            : 0.0);
        impact.put("fails", solver.getFailCount());
        impact.put("backtracks", solver.getBackTrackCount());
        impact.put("nodes", solver.getNodeCount());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("status", status);
        res.put("rawStatus", solver.getSearchState().name());
        res.put("elapsedMs", elapsedMs);
        res.put("solutionsFound", alternatives.size());
        res.put("constraintImpact", impact);
        res.put("placements", alternatives.isEmpty() ? Map.of() : alternatives.get(0));
        res.put("alternatives", alternatives);
        emit("FINAL_RESULT", res);
    }
}
