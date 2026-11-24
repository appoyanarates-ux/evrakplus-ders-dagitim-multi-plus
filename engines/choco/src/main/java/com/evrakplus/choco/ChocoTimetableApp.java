package com.evrakplus.choco;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.chocosolver.solver.Model;
import org.chocosolver.solver.Solution;
import org.chocosolver.solver.Solver;
import org.chocosolver.solver.search.strategy.Search;
import org.chocosolver.solver.variables.BoolVar;
import org.chocosolver.solver.variables.IntVar;

import java.io.File;
import java.util.*;

public class ChocoTimetableApp {

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

        Package chocoPkg = Model.class.getPackage();
        String chocoVer = (chocoPkg != null && chocoPkg.getImplementationVersion() != null)
            ? chocoPkg.getImplementationVersion() : "4.10.14";

        if (health) {
            Model m = new Model("health");
            IntVar x = m.intVar("x", 0, 1);
            m.arithm(x, "=", 1).post();
            boolean ok = m.getSolver().solve() && x.getValue() == 1;
            ObjectNode res = mapper.createObjectNode();
            res.put("available", ok);
            res.put("engine", "choco_solver");
            res.put("display_name", "Choco Solver");
            res.put("version", "Choco Solver " + chocoVer + " (Java " + System.getProperty("java.version") + ")");
            ObjectNode caps = res.putObject("capabilities");
            caps.put("dual_shift", true);
            caps.put("building_travel", true);
            caps.put("common_elective", true);
            caps.put("multi_teacher", true);
            caps.put("special_rooms", true);
            caps.put("max_consecutive", true);
            caps.put("warm_start", false);
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
        int travelMin = root.path("travel_min").asInt(0);
        int periodsPerDay = root.path("periods_per_day").asInt(8);

        Map<String, Integer> teacherMaxDaily = new HashMap<>();
        root.path("teacher_max_daily").fields().forEachRemaining(e -> teacherMaxDaily.put(e.getKey(), e.getValue().asInt()));
        Map<String, Integer> teacherMaxConsec = new HashMap<>();
        root.path("teacher_max_consec").fields().forEachRemaining(e -> teacherMaxConsec.put(e.getKey(), e.getValue().asInt()));
        Map<String, Integer> roomCap = new HashMap<>();
        root.path("room_cap").fields().forEachRemaining(e -> roomCap.put(e.getKey(), e.getValue().asInt()));
        Map<String, Integer> roomTypeCap = new HashMap<>();
        root.path("room_type_cap").fields().forEachRemaining(e -> roomTypeCap.put(e.getKey(), e.getValue().asInt()));

        Model model = new Model("EvrakPlus-Choco-Timetable");
        JsonNode tasksNode = root.path("tasks");
        int nTasks = tasksNode.size();

        List<List<BoolVar>> taskCandVars = new ArrayList<>();
        List<JsonNode> taskList = new ArrayList<>();

        // Grouping maps for constraints
        Map<String, List<int[]>> classDayItems = new HashMap<>(); // [startMin, endMin, taskIdx, candIdx]
        Map<String, List<int[]>> teacherDayItems = new HashMap<>(); // [startMin, endMin, taskIdx, candIdx, blen]
        Map<String, List<BoolVar>> teacherDayPerVars = new HashMap<>();
        Map<String, List<Object[]>> teacherBldgItems = new HashMap<>(); // [startMin, endMin, building, BoolVar]
        Map<String, List<Object[]>> roomDayItems = new HashMap<>(); // [startMin, endMin, BoolVar]
        Map<String, List<Object[]>> rtypeDayItems = new HashMap<>(); // [startMin, endMin, BoolVar]
        Map<String, List<BoolVar>> asgnDayVars = new HashMap<>();
        List<BoolVar> costVars = new ArrayList<>();
        List<Integer> costWeights = new ArrayList<>();

        for (int ti = 0; ti < nTasks; ti++) {
            JsonNode tn = tasksNode.get(ti);
            taskList.add(tn);
            JsonNode cands = tn.path("candidates");
            int nc = cands.size();
            List<BoolVar> bvars = new ArrayList<>(nc);

            String aid = tn.path("assignment_id").asText();
            String cid = tn.path("class_id").asText();
            String rid = tn.path("room_id").isNull() ? null : tn.path("room_id").asText(null);
            String rtype = tn.path("room_type").asText("standard");
            String bldg = tn.path("building").isNull() ? null : tn.path("building").asText(null);
            int blen = tn.path("length").asInt(1);

            List<String> tids = new ArrayList<>();
            for (JsonNode tnode : tn.path("teacher_ids")) tids.add(tnode.asText());

            for (int ci = 0; ci < nc; ci++) {
                JsonNode cn = cands.get(ci);
                int d = cn.path("day_index").asInt();
                int p = cn.path("start_period").asInt();
                int sMin = cn.path("start_min").asInt();
                int eMin = cn.path("end_min").asInt();
                int avoidCost = cn.path("avoid_cost").asInt(0);

                BoolVar bv = model.boolVar("x_" + ti + "_" + ci);
                bvars.add(bv);

                if (avoidCost > 0) {
                    costVars.add(bv);
                    costWeights.add(avoidCost);
                }

                classDayItems.computeIfAbsent(cid + ":" + d, k -> new ArrayList<>()).add(new int[]{sMin, eMin, ti, ci});
                asgnDayVars.computeIfAbsent(aid + ":" + d, k -> new ArrayList<>()).add(bv);

                for (String tid : tids) {
                    teacherDayItems.computeIfAbsent(tid + ":" + d, k -> new ArrayList<>()).add(new int[]{sMin, eMin, ti, ci, blen});
                    for (int k = 0; k < blen; k++) {
                        teacherDayPerVars.computeIfAbsent(tid + ":" + d + ":" + (p + k), k2 -> new ArrayList<>()).add(bv);
                    }
                    if (bldg != null && !bldg.isEmpty()) {
                        teacherBldgItems.computeIfAbsent(tid + ":" + d, k -> new ArrayList<>()).add(new Object[]{sMin, eMin, bldg, bv});
                    }
                }
                if (rid != null && !rid.isEmpty()) {
                    roomDayItems.computeIfAbsent(rid + ":" + d, k -> new ArrayList<>()).add(new Object[]{sMin, eMin, bv});
                } else if (!"standard".equals(rtype) && roomTypeCap.containsKey(rtype)) {
                    rtypeDayItems.computeIfAbsent(rtype + ":" + d, k -> new ArrayList<>()).add(new Object[]{sMin, eMin, bv});
                }
            }
            taskCandVars.add(bvars);
            model.sum(bvars.toArray(new BoolVar[0]), "=", 1).post();
        }

        // 1. Class overlaps (sweep time points)
        for (List<int[]> items : classDayItems.values()) {
            Set<Integer> tps = new HashSet<>();
            for (int[] it : items) tps.add(it[0]);
            for (int tp : tps) {
                List<BoolVar> ov = new ArrayList<>();
                for (int[] it : items) {
                    if (it[0] <= tp && tp < it[1]) ov.add(taskCandVars.get(it[2]).get(it[3]));
                }
                if (ov.size() > 1) model.sum(ov.toArray(new BoolVar[0]), "<=", 1).post();
            }
        }

        // 2. Teacher overlaps & daily max
        for (Map.Entry<String, List<int[]>> entry : teacherDayItems.entrySet()) {
            String tid = entry.getKey().split(":")[0];
            List<int[]> items = entry.getValue();
            Set<Integer> tps = new HashSet<>();
            for (int[] it : items) tps.add(it[0]);
            for (int tp : tps) {
                List<BoolVar> ov = new ArrayList<>();
                for (int[] it : items) {
                    if (it[0] <= tp && tp < it[1]) ov.add(taskCandVars.get(it[2]).get(it[3]));
                }
                if (ov.size() > 1) model.sum(ov.toArray(new BoolVar[0]), "<=", 1).post();
            }
            int maxD = teacherMaxDaily.getOrDefault(tid, periodsPerDay);
            if (!items.isEmpty()) {
                BoolVar[] vars = new BoolVar[items.size()];
                int[] wts = new int[items.size()];
                for (int i = 0; i < items.size(); i++) {
                    vars[i] = taskCandVars.get(items.get(i)[2]).get(items.get(i)[3]);
                    wts[i] = items.get(i)[4];
                }
                model.scalar(vars, wts, "<=", maxD).post();
            }
        }

        // 3. Max consecutive hours
        for (Map.Entry<String, Integer> entry : teacherMaxConsec.entrySet()) {
            String tid = entry.getKey();
            int maxC = entry.getValue();
            if (maxC <= 0 || maxC >= periodsPerDay) continue;
            int numDays = root.path("num_days").asInt(5);
            for (int d = 0; d < numDays; d++) {
                for (int p0 = 0; p0 < periodsPerDay - maxC; p0++) {
                    List<BoolVar> win = new ArrayList<>();
                    for (int k = 0; k <= maxC; k++) {
                        List<BoolVar> pv = teacherDayPerVars.get(tid + ":" + d + ":" + (p0 + k));
                        if (pv != null) win.addAll(pv);
                    }
                    if (win.size() > maxC) {
                        model.sum(win.toArray(new BoolVar[0]), "<=", maxC).post();
                    }
                }
            }
        }

        // 4. Building travel time
        if (travelMin > 0) {
            for (List<Object[]> items : teacherBldgItems.values()) {
                int n = items.size();
                for (int i = 0; i < n; i++) {
                    int s1 = (int) items.get(i)[0], e1 = (int) items.get(i)[1];
                    String b1 = (String) items.get(i)[2];
                    BoolVar v1 = (BoolVar) items.get(i)[3];
                    for (int j = i + 1; j < n; j++) {
                        int s2 = (int) items.get(j)[0], e2 = (int) items.get(j)[1];
                        String b2 = (String) items.get(j)[2];
                        BoolVar v2 = (BoolVar) items.get(j)[3];
                        if (b1.equals(b2) || (s1 < e2 && s2 < e1)) continue;
                        int gap = e1 <= s2 ? (s2 - e1) : (s1 - e2);
                        if (gap < travelMin) {
                            model.arithm(v1, "+", v2, "<=", 1).post();
                        }
                    }
                }
            }
        }

        // 5. Room capacities
        for (Map.Entry<String, List<Object[]>> e : roomDayItems.entrySet()) {
            String rid = e.getKey().split(":")[0];
            int cap = roomCap.getOrDefault(rid, 1);
            postCapConstraint(model, e.getValue(), cap);
        }
        for (Map.Entry<String, List<Object[]>> e : rtypeDayItems.entrySet()) {
            String rt = e.getKey().split(":")[0];
            int cap = roomTypeCap.getOrDefault(rt, 1);
            postCapConstraint(model, e.getValue(), cap);
        }

        // 6. Max blocks per day
        Map<String, Integer> maxBMap = new HashMap<>();
        for (JsonNode tn : taskList) {
            maxBMap.put(tn.path("assignment_id").asText(), tn.path("max_blocks_per_day").asInt(1));
        }
        for (Map.Entry<String, List<BoolVar>> e : asgnDayVars.entrySet()) {
            String aid = e.getKey().split(":")[0];
            int maxB = maxBMap.getOrDefault(aid, 1);
            List<BoolVar> list = e.getValue();
            if (maxB > 0 && list.size() > maxB) {
                model.sum(list.toArray(new BoolVar[0]), "<=", maxB).post();
            }
        }

        Solver solver = model.getSolver();
        solver.limitTime(Math.round(Math.max(1000.0, timeLimitSec * 1000.0)) + "ms");

        Solution best = null;
        if (!costVars.isEmpty()) {
            int maxObj = costWeights.stream().mapToInt(Integer::intValue).sum();
            IntVar obj = model.intVar("obj", 0, Math.max(1, maxObj));
            model.scalar(costVars.toArray(new BoolVar[0]), costWeights.stream().mapToInt(Integer::intValue).toArray(), "=", obj).post();
            model.setObjective(Model.MINIMIZE, obj);
            while (solver.solve()) {
                best = new Solution(model).record();
            }
        } else {
            if (solver.solve()) {
                best = new Solution(model).record();
            }
        }

        double elapsed = Math.round(((System.nanoTime() - t0) / 1e9) * 1000.0) / 1000.0;
        ObjectNode out = mapper.createObjectNode();
        out.put("engine", "choco_solver");
        out.put("engine_version", "Choco Solver " + chocoVer + " (Java " + System.getProperty("java.version") + ")");
        out.put("solve_time_sec", elapsed);
        out.put("total_blocks", nTasks);

        ArrayNode plArr = out.putArray("placements");
        if (best != null) {
            boolean provedOptimal = !solver.isStopCriterionMet();
            out.put("status", provedOptimal ? "OPTIMAL" : "FEASIBLE");
            for (int ti = 0; ti < nTasks; ti++) {
                JsonNode tn = taskList.get(ti);
                List<BoolVar> bvars = taskCandVars.get(ti);
                JsonNode cands = tn.path("candidates");
                for (int ci = 0; ci < bvars.size(); ci++) {
                    if (best.getIntVal(bvars.get(ci)) == 1) {
                        JsonNode cn = cands.get(ci);
                        ObjectNode p = plArr.addObject();
                        p.put("assignment_id", tn.path("assignment_id").asText());
                        p.put("block_index", tn.path("block_index").asInt());
                        p.put("class_id", tn.path("class_id").asText());
                        p.put("course_id", tn.path("course_id").asText(""));
                        ArrayNode tids = p.putArray("teacher_ids");
                        for (JsonNode tidNode : tn.path("teacher_ids")) tids.add(tidNode.asText());
                        if (!tn.path("room_id").isNull()) p.put("room_id", tn.path("room_id").asText()); else p.putNull("room_id");
                        p.put("day_index", cn.path("day_index").asInt());
                        p.put("start_period", cn.path("start_period").asInt());
                        p.put("length", tn.path("length").asInt(1));
                        break;
                    }
                }
            }
        } else {
            out.put("status", solver.isStopCriterionMet() ? "TIME_LIMIT" : "INFEASIBLE");
        }
        out.put("placed_blocks", plArr.size());

        String json = mapper.writeValueAsString(out);
        if (outputPath != null) {
            mapper.writeValue(new File(outputPath), out);
        } else {
            System.out.println(json);
        }
    }

    private static void postCapConstraint(Model model, List<Object[]> items, int cap) {
        Set<Integer> tps = new HashSet<>();
        for (Object[] it : items) tps.add((int) it[0]);
        for (int tp : tps) {
            List<BoolVar> ov = new ArrayList<>();
            for (Object[] it : items) {
                int s = (int) it[0], e = (int) it[1];
                if (s <= tp && tp < e) ov.add((BoolVar) it[2]);
            }
            if (ov.size() > cap) {
                model.sum(ov.toArray(new BoolVar[0]), "<=", cap).post();
            }
        }
    }
}
