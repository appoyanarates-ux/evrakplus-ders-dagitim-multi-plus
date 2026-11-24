% EvrakPlus Ders Dagitim Multi Plus - Gercek MiniZinc CP Modeli (timetable.mzn)
% Gecode ve Chuffed arka uc cozuculeriyle tam uyumludur.

int: NUM_TASKS;
int: NUM_CANDS;
int: NUM_CONFLICT_PAIRS;
int: NUM_DAILY_GROUPS;
int: NUM_CAP_GROUPS;

set of int: TASKS = 1..NUM_TASKS;
set of int: CANDS = 1..NUM_CANDS;

% Her gorevin aday araligi (1-tabanli indeksler)
array[TASKS] of int: task_cand_start;
array[TASKS] of int: task_cand_end;

% Her adayin gun, baslangic periyodu ve maliyet (tercih cezasi) bilgisi
array[CANDS] of int: cand_day;
array[CANDS] of int: cand_period;
array[CANDS] of int: cand_cost;
array[CANDS] of int: cand_task;

% Ikili catisma ciftleri (sube, ogretmen, bina gecis suresi, kapasite=1 derslik)
array[1..NUM_CONFLICT_PAIRS] of int: conflict_a;
array[1..NUM_CONFLICT_PAIRS] of int: conflict_b;

% Ogretmen gunluk maksimum ders / ayni ders gunluk max blok kisitlari (agirlikli toplam <= limit)
int: NUM_DG_ITEMS;
array[1..NUM_DAILY_GROUPS] of int: dg_start;
array[1..NUM_DAILY_GROUPS] of int: dg_end;
array[1..NUM_DAILY_GROUPS] of int: dg_limit;
array[1..NUM_DG_ITEMS] of int: dg_cand;
array[1..NUM_DG_ITEMS] of int: dg_weight;

% Ozel derslik kapasite gruplari (kapasite > 1)
int: NUM_CG_ITEMS;
array[1..NUM_CAP_GROUPS] of int: cg_start;
array[1..NUM_CAP_GROUPS] of int: cg_end;
array[1..NUM_CAP_GROUPS] of int: cg_cap;
array[1..NUM_CG_ITEMS] of int: cg_cand;

% Karar degiskenleri: her gorev icin secilen aday indeksi
array[TASKS] of var CANDS: chosen;

% 1. Her gorev kendi gecerli aday araligindan tam 1 aday secer
constraint forall(t in TASKS)(
  chosen[t] >= task_cand_start[t] /\ chosen[t] <= task_cand_end[t]
);

% 2. Ikili catisma ciftleri ayni anda secilemez
constraint forall(i in 1..NUM_CONFLICT_PAIRS)(
  let {
    int: a = conflict_a[i],
    int: b = conflict_b[i],
    int: ta = cand_task[a],
    int: tb = cand_task[b]
  } in
  (chosen[ta] != a \/ chosen[tb] != b)
);

% 3. Gunluk limit kisitlari (ogretmen gunluk max saat, ayni ders gunluk max blok, ardisik max)
constraint forall(g in 1..NUM_DAILY_GROUPS)(
  sum(k in dg_start[g]..dg_end[g])(
    dg_weight[k] * bool2int(chosen[cand_task[dg_cand[k]]] == dg_cand[k])
  ) <= dg_limit[g]
);

% 4. Derslik kapasite gruplari (kapasite > 1)
constraint forall(g in 1..NUM_CAP_GROUPS)(
  sum(k in cg_start[g]..cg_end[g])(
    bool2int(chosen[cand_task[cg_cand[k]]] == cg_cand[k])
  ) <= cg_cap[g]
);

% Hedef: tercih ve yayma maliyetini minimize et
var int: total_cost = sum(t in TASKS)(cand_cost[chosen[t]]);
solve :: int_search(chosen, first_fail, indomain_min, complete) minimize total_cost;

output [
  "{\"chosen\":[" ++ join(",", [show(chosen[t]) | t in TASKS]) ++ "],\"total_cost\":" ++ show(total_cost) ++ "}"
];
