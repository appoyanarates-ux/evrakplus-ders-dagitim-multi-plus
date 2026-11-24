% EvrakPlus Ders Dagitim Multi Plus - MiniZinc Standart Ders Dagitim Modeli
% Gecode ve Chuffed gibi CP cozuculerle dogrudan uyumludur.
include "globals.mzn";

int: D;
int: P;
int: B;
int: numTeachers;
bool: diffDaysHard;

array[1..B] of int: lengths;
array[1..B] of int: teacherOf;       % 0 = ogretmen yok, 1..numTeachers
array[1..B] of int: classOf;         % 1..numClasses
array[1..B] of int: studentGroupOf;  % 0 = tam sinif, >0 = alt ogrenci grubu
array[1..B] of int: assignmentOf;
array[1..B] of int: blockCountOf;
array[1..B] of bool: allowMultiSameDay;
array[1..B] of set of int: validSlots;

array[1..numTeachers] of int: teacherDmax;

int: numParallelPairs;
array[1..numParallelPairs, 1..2] of int: parallelPairs;

int: numSubjectPairs;
array[1..numSubjectPairs, 1..2] of int: subjectPairs;

% Karar degiskenleri: her blok icin baslangic slotu (d*P + p)
array[1..B] of var 0..(D * P - 1): start;
array[1..B] of var 0..(D - 1): day;

% 1. Gecerli domain ve gun baglantisi
constraint forall(b in 1..B)(
    start[b] in validSlots[b] /\
    day[b] = start[b] div P
);

% 2. Ogretmen cakismasizligi
constraint forall(i, j in 1..B where i < j /\ teacherOf[i] > 0 /\ teacherOf[i] = teacherOf[j])(
    start[i] + lengths[i] <= start[j] \/ start[j] + lengths[j] <= start[i]
);

% 3. Sinif / ogrenci grubu cakismasizligi
constraint forall(i, j in 1..B where i < j /\ classOf[i] = classOf[j] /\
    (studentGroupOf[i] = 0 \/ studentGroupOf[j] = 0 \/ studentGroupOf[i] = studentGroupOf[j]))(
    start[i] + lengths[i] <= start[j] \/ start[j] + lengths[j] <= start[i]
);

% 4. Paralel grup senkronizasyonu
constraint forall(k in 1..numParallelPairs)(
    start[parallelPairs[k, 1]] = start[parallelPairs[k, 2]]
);

% 5. Ayni dersin bloklari farkli gunlerde
constraint if diffDaysHard then
    forall(i, j in 1..B where i < j /\ assignmentOf[i] = assignmentOf[j] /\
        not allowMultiSameDay[i] /\ blockCountOf[i] <= D)(
        day[i] != day[j]
    )
else true endif;

% 6. Iki ders ayni gune dusmesin
constraint forall(k in 1..numSubjectPairs)(
    day[subjectPairs[k, 1]] != day[subjectPairs[k, 2]]
);

% 7. Ogretmen gunluk maks ders (dmax)
constraint forall(t in 1..numTeachers where teacherDmax[t] < P)(
    forall(d in 0..(D - 1))(
        sum(b in 1..B where teacherOf[b] = t)(lengths[b] * bool2int(day[b] = d)) <= teacherDmax[t]
    )
);

solve :: int_search(start, first_fail, indomain_min) satisfy;

output ["{\"starts\":[", join(",", [show(start[b]) | b in 1..B]), "]}\n"];
