import { ConstraintLevel } from '../../core-schema/src/constants.js';
import { validateSchedule } from './validator.js';

/**
 * Ortak 100 Puan Kalite Puanlama Sistemi.
 * Öncelik sırası:
 * 1. Sıfır zorunlu kural ihlali (geçersiz çizelge ASLA geçerli çizelgenin önüne geçemez)
 * 2. Bütün gerekli derslerin atanması
 * 3. Kullanıcı tercihlerinin karşılanması
 * 4. Öğretmen boşluklarının azaltılması
 * 5. Derslerin dengeli dağıtılması
 * 6. Bina geçişlerinin azaltılması
 * 7. Diğer esnek kuralların optimizasyonu
 */
export function evaluateSolution(solverInput, placements, rawStatus) {
  const validation = validateSchedule(solverInput, placements, rawStatus);
  const m = validation.metrics;

  // Geçersiz (zorunlu kural ihlalli) çözüm asla yüksek kalite puanı alamaz
  if (!validation.isHardValid) {
    return {
      validation,
      qualityScore: 0,
      rankTier: 0, // 0 = geçersiz, 1 = kısmi geçerli, 2 = tam geçerli
      breakdown: {
        completionScore: 0,
        preferenceScore: 0,
        teacherGapScore: 0,
        balanceScore: 0,
        buildingScore: 0,
        softConstraintScore: 0
      }
    };
  }

  // Tamamlanma oranı (40 puan taban; kısmi çözümler tier 1'de kalır)
  const completionRatio = m.totalBlocks > 0 ? m.assignedBlocks / m.totalBlocks : 0;
  const completionScore = completionRatio * 40;

  // Esnek ihlal cezaları
  let prefViolations = 0;
  let highSoftViolations = 0;
  let normalSoftViolations = 0;
  for (const v of validation.softViolations) {
    if (v.level === ConstraintLevel.HIGH) highSoftViolations++;
    else if (v.level === ConstraintLevel.NORMAL) normalSoftViolations++;
    else prefViolations++;
  }

  // Tercihler: 15 puan
  const preferenceScore = Math.max(0, 15 - prefViolations * 2);

  // Öğretmen boşlukları: 20 puan
  const teacherCount = Math.max(1, solverInput.teachers.length);
  const avgGapsPerTeacher = m.totalTeacherGaps / teacherCount;
  const teacherGapScore = Math.max(0, 20 - avgGapsPerTeacher * 5);

  // Günlere dengeli dağılım: 10 puan (öğretmenlerin günlük ders saatlerinin dengesi)
  const balanceScore = computeBalanceScore(solverInput, placements);

  // Bina geçişleri: 5 puan
  const buildingScore = Math.max(0, 5 - m.totalBuildingChanges * 0.5);

  // Diğer esnek kurallar (HIGH/NORMAL): 10 puan
  const softConstraintScore = Math.max(0, 10 - highSoftViolations * 3 - normalSoftViolations * 1);

  const rawTotal = completionScore + preferenceScore + teacherGapScore + balanceScore + buildingScore + softConstraintScore;
  const qualityScore = Math.round(Math.min(100, Math.max(0, rawTotal)) * 100) / 100;

  return {
    validation,
    qualityScore,
    rankTier: validation.isValid ? 2 : 1,
    breakdown: {
      completionScore: round2(completionScore),
      preferenceScore: round2(preferenceScore),
      teacherGapScore: round2(teacherGapScore),
      balanceScore: round2(balanceScore),
      buildingScore: round2(buildingScore),
      softConstraintScore: round2(softConstraintScore)
    }
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeBalanceScore(solverInput, placements) {
  const D = solverInput.school.daysPerWeek;
  if (!solverInput.teachers.length || D <= 1) return 10;

  const perTeacherDay = new Map();
  for (const b of solverInput.blocks) {
    const pl = placements?.[b.blockId];
    if (!pl || !b.teacherId) continue;
    const arr = perTeacherDay.get(b.teacherId) || new Array(D).fill(0);
    if (pl.day >= 0 && pl.day < D) arr[pl.day] += b.length;
    perTeacherDay.set(b.teacherId, arr);
  }

  let sumStd = 0;
  let count = 0;
  for (const arr of perTeacherDay.values()) {
    const active = arr.filter(x => x > 0);
    if (active.length <= 1) continue;
    const mean = active.reduce((a, b) => a + b, 0) / active.length;
    const variance = active.reduce((a, b) => a + (b - mean) ** 2, 0) / active.length;
    sumStd += Math.sqrt(variance);
    count++;
  }
  if (!count) return 10;
  const avgStd = sumStd / count;
  return Math.max(0, 10 - avgStd * 2.5);
}

/**
 * İki değerlendirilmiş çözümü karşılaştırır (>0 ise `a` daha iyi, <0 ise `b` daha iyi).
 * Geçersiz çözüm ASLA geçerli çözümün önüne geçemez.
 */
export function compareEvaluations(a, b) {
  if (a.rankTier !== b.rankTier) return a.rankTier - b.rankTier;
  if (a.validation.metrics.hardViolationCount !== b.validation.metrics.hardViolationCount) {
    return b.validation.metrics.hardViolationCount - a.validation.metrics.hardViolationCount;
  }
  if (a.validation.metrics.assignedBlocks !== b.validation.metrics.assignedBlocks) {
    return a.validation.metrics.assignedBlocks - b.validation.metrics.assignedBlocks;
  }
  return a.qualityScore - b.qualityScore;
}
