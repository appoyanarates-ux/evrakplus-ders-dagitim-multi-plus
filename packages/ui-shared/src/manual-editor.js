import { buildSolverInput, expandAssignments, SolverStatus } from '../../core-schema/src/index.js';
import { evaluateSolution } from '../../validator/src/index.js';

/**
 * EvrakPlus Profesyonel Manuel Ders Dağıtımı Motoru
 * Sürükle-bırak taşıma/takas, çoklu seçim, öğretmen/sınıf/gün/saat bazlı kilitleme,
 * geri al/yinele, anlık çakışma ön kontrolü, kısmi yeniden dağıtım ve çizelge karşılaştırma.
 */
export class ManualScheduleEditor {
  constructor(project) {
    this.project = structuredClone(project);
    this.selectedBlockIds = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.history = [];
    this.maxUndo = 60;
  }

  getProject() {
    return this.project;
  }

  getPlacements() {
    return this.project.placements || {};
  }

  _snapshot(actionLabel) {
    this.undoStack.push({
      label: actionLabel,
      at: new Date().toISOString(),
      placements: structuredClone(this.project.placements || {})
    });
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
    this.history.unshift({
      at: new Date().toISOString(),
      action: actionLabel,
      placedCount: Object.keys(this.project.placements || {}).length
    });
    if (this.history.length > 100) this.history.pop();
  }

  getHistory() {
    return [...this.history];
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.undoStack.length) return false;
    const prev = this.undoStack.pop();
    this.redoStack.push({
      label: prev.label,
      at: new Date().toISOString(),
      placements: structuredClone(this.project.placements || {})
    });
    this.project.placements = prev.placements;
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    const next = this.redoStack.pop();
    this.undoStack.push({
      label: next.label,
      at: new Date().toISOString(),
      placements: structuredClone(this.project.placements || {})
    });
    this.project.placements = next.placements;
    return true;
  }

  // Çoklu seçim
  selectBlocks(blockIds) {
    this.selectedBlockIds = new Set(blockIds);
  }

  toggleSelection(blockId) {
    if (this.selectedBlockIds.has(blockId)) this.selectedBlockIds.delete(blockId);
    else this.selectedBlockIds.add(blockId);
  }

  clearSelection() {
    this.selectedBlockIds.clear();
  }

  /** Anlık çakışma ve kural ihlali ön kontrolü (taşıma) */
  previewMove(blockId, day, period, roomId = undefined) {
    const testPlacements = structuredClone(this.project.placements || {});
    const prev = testPlacements[blockId];
    if (prev && prev.lock) {
      return {
        allowed: false,
        reason: 'Kilitli ders taşınamaz; önce kilidi açın.',
        hardViolations: [{ code: 'LOCKED_VIOLATION', message: 'Blok kilitli.' }],
        softViolations: []
      };
    }
    testPlacements[blockId] = {
      day,
      period,
      roomId: roomId !== undefined ? roomId : (prev?.roomId ?? null),
      lock: false
    };
    const input = buildSolverInput(this.project);
    const ev = evaluateSolution(input, testPlacements, SolverStatus.FEASIBLE);
    const hardV = ev.validation.hardViolations;
    return {
      allowed: hardV.length === 0,
      reason: hardV.length ? hardV[0].message : 'Uygun',
      hardViolations: hardV,
      softViolations: ev.validation.softViolations,
      qualityScore: ev.qualityScore
    };
  }

  /** Dersi yeni hücreye taşı */
  moveBlock(blockId, day, period, roomId = undefined, { force = false } = {}) {
    const check = this.previewMove(blockId, day, period, roomId);
    if (!check.allowed && !force) return { ok: false, ...check };
    this._snapshot(`Taşı: ${blockId} → Gün ${day + 1}, Saat ${period + 1}`);
    const prev = this.project.placements[blockId];
    this.project.placements[blockId] = {
      day,
      period,
      roomId: roomId !== undefined ? roomId : (prev?.roomId ?? null),
      lock: Boolean(prev?.lock)
    };
    return { ok: true, ...check };
  }

  /** İki dersin yerini değiştir (takas) ön kontrolü */
  previewSwap(blockIdA, blockIdB) {
    const plA = this.project.placements[blockIdA];
    const plB = this.project.placements[blockIdB];
    if (!plA || !plB) {
      return { allowed: false, reason: 'Her iki blok da yerleşik olmalıdır.', hardViolations: [] };
    }
    if (plA.lock || plB.lock) {
      return { allowed: false, reason: 'Kilitli derslerle takas yapılamaz.', hardViolations: [{ code: 'LOCKED_VIOLATION' }] };
    }
    const testPlacements = structuredClone(this.project.placements);
    testPlacements[blockIdA] = { ...plA, day: plB.day, period: plB.period };
    testPlacements[blockIdB] = { ...plB, day: plA.day, period: plA.period };
    const input = buildSolverInput(this.project);
    const ev = evaluateSolution(input, testPlacements, SolverStatus.FEASIBLE);
    return {
      allowed: ev.validation.hardViolations.length === 0,
      reason: ev.validation.hardViolations[0]?.message || 'Takas uygun',
      hardViolations: ev.validation.hardViolations,
      softViolations: ev.validation.softViolations,
      qualityScore: ev.qualityScore
    };
  }

  swapBlocks(blockIdA, blockIdB) {
    const check = this.previewSwap(blockIdA, blockIdB);
    if (!check.allowed) return { ok: false, ...check };
    this._snapshot(`Takas: ${blockIdA} ↔ ${blockIdB}`);
    const plA = this.project.placements[blockIdA];
    const plB = this.project.placements[blockIdB];
    this.project.placements[blockIdA] = { ...plA, day: plB.day, period: plB.period };
    this.project.placements[blockIdB] = { ...plB, day: plA.day, period: plA.period };
    return { ok: true, ...check };
  }

  /** Blok bazlı kilitleme */
  setLock(blockIds, locked = true, lockScope = 'block') {
    const ids = Array.isArray(blockIds) ? blockIds : [blockIds];
    let changed = 0;
    this._snapshot(`${locked ? 'Kilitle' : 'Kilit aç'} (${lockScope}): ${ids.length} blok`);
    for (const id of ids) {
      if (this.project.placements[id]) {
        this.project.placements[id].lock = Boolean(locked);
        this.project.placements[id].lockScope = locked ? lockScope : null;
        changed++;
      }
    }
    return changed;
  }

  lockByTeacher(teacherId, locked = true) {
    const blocks = expandAssignments(this.project).filter(b => b.teacherId === teacherId);
    return this.setLock(blocks.map(b => b.blockId), locked, 'teacher');
  }

  lockByClass(classId, locked = true) {
    const blocks = expandAssignments(this.project).filter(b => b.classId === classId);
    return this.setLock(blocks.map(b => b.blockId), locked, 'class');
  }

  lockByDay(day, locked = true) {
    const ids = Object.entries(this.project.placements || {})
      .filter(([, pl]) => pl.day === day)
      .map(([id]) => id);
    return this.setLock(ids, locked, 'day');
  }

  lockByPeriod(period, locked = true) {
    const ids = Object.entries(this.project.placements || {})
      .filter(([, pl]) => pl.period === period)
      .map(([id]) => id);
    return this.setLock(ids, locked, 'period');
  }

  /**
   * Sadece seçilen bölümü (örn. belirli bir sınıf, öğretmen veya seçili bloklar) yeniden dağıtmak için
   * seçilmeyen diğer tüm yerleşimleri kilitli olarak işaretleyen bir SolverInput üretir.
   */
  preparePartialReoptimize({ blockIds = null, classIds = null, teacherIds = null } = {}, solverOptions = {}) {
    const clone = structuredClone(this.project);
    const allBlocks = expandAssignments(clone);

    const unlockedSet = new Set();
    for (const b of allBlocks) {
      const inSelectedBlocks = blockIds && blockIds.includes(b.blockId);
      const inSelectedClass = classIds && classIds.includes(b.classId);
      const inSelectedTeacher = teacherIds && teacherIds.includes(b.teacherId);
      const existing = clone.placements[b.blockId];
      // Kullanıcının zaten kilitlediği dersler ASLA açılmaz
      if (existing?.lock) continue;
      if (inSelectedBlocks || inSelectedClass || inSelectedTeacher) {
        unlockedSet.add(b.blockId);
      }
    }

    // Seçilen bölüm dışındaki mevcut yerleşimleri geçici olarak sabitle (lock: true)
    for (const [bid, pl] of Object.entries(clone.placements || {})) {
      if (!unlockedSet.has(bid)) {
        pl.lock = true;
      } else {
        delete clone.placements[bid];
      }
    }

    return {
      solverInput: buildSolverInput(clone, solverOptions),
      unlockedBlockIds: [...unlockedSet]
    };
  }

  /** Önceki ve sonraki çizelgeyi karşılaştırır */
  compareWith(otherPlacements) {
    const current = this.project.placements || {};
    const moved = [];
    const added = [];
    const removed = [];
    const unchanged = [];

    const allIds = new Set([...Object.keys(current), ...Object.keys(otherPlacements || {})]);
    for (const id of allIds) {
      const a = current[id];
      const b = otherPlacements?.[id];
      if (!a && b) added.push({ blockId: id, to: b });
      else if (a && !b) removed.push({ blockId: id, from: a });
      else if (a.day !== b.day || a.period !== b.period || a.roomId !== b.roomId) {
        moved.push({ blockId: id, from: a, to: b });
      } else {
        unchanged.push(id);
      }
    }

    const input = buildSolverInput(this.project);
    const evCurrent = evaluateSolution(input, current, SolverStatus.FEASIBLE);
    const evOther = evaluateSolution(input, otherPlacements || {}, SolverStatus.FEASIBLE);

    return {
      moved,
      added,
      removed,
      unchangedCount: unchanged.length,
      beforeQuality: evCurrent.qualityScore,
      afterQuality: evOther.qualityScore,
      qualityDelta: Math.round((evOther.qualityScore - evCurrent.qualityScore) * 100) / 100,
      beforeValid: evCurrent.validation.isValid,
      afterValid: evOther.validation.isValid
    };
  }
}
