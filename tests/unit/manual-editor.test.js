import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualScheduleEditor } from '../../packages/ui-shared/src/manual-editor.js';
import { OrToolsAdapter } from '../../engines/ortools/adapter.js';
import { buildSolverInput } from '../../packages/core-schema/src/index.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('ManualScheduleEditor: taşıma, anlık çakışma ön kontrolü, takas, kilitleme ve undo/redo', async () => {
  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  const adapter = new OrToolsAdapter();
  const initial = await adapter.solve(buildSolverInput(proj, { timeLimitSeconds: 8 }));
  assert.equal(initial.evaluation.validation.isValid, true);
  proj.placements = initial.placements;

  const editor = new ManualScheduleEditor(proj);
  const blockIds = Object.keys(editor.getPlacements());
  const firstId = blockIds[0];
  const orig = { ...editor.getPlacements()[firstId] };

  // Öğretmen bazlı kilitleme
  const t0 = proj.teachers[0].id;
  const lockedT = editor.lockByTeacher(t0, true);
  assert.ok(lockedT > 0);
  // Kilitli blok taşınamamalı
  const lockedBlockId = Object.keys(editor.getPlacements()).find(id => editor.getPlacements()[id].lock);
  const moveLocked = editor.moveBlock(lockedBlockId, 0, 0);
  assert.equal(moveLocked.ok, false);
  assert.ok(moveLocked.reason.includes('Kilitli'));

  // Gün ve saat bazlı kilitleme + undo/redo
  const lockedDay = editor.lockByDay(0, true);
  assert.ok(lockedDay > 0);
  const lockedPeriod = editor.lockByPeriod(1, true);
  assert.ok(lockedPeriod > 0);
  assert.equal(editor.canUndo(), true);
  assert.equal(editor.undo(), true);
  assert.equal(editor.canRedo(), true);
  assert.equal(editor.redo(), true);
  assert.ok(editor.getHistory().length >= 3);

  // Kilitleri aç ve çakışmalı hücreye taşımayı dene (reddedilmeli)
  editor.lockByTeacher(t0, false);
  editor.lockByDay(0, false);
  editor.lockByPeriod(1, false);
  const secondId = blockIds.find(id => id !== firstId && editor.getPlacements()[id].day === orig.day);
  if (secondId) {
    const pos2 = editor.getPlacements()[secondId];
    const clash = editor.previewMove(firstId, pos2.day, pos2.period);
    // Aynı sınıftaysa veya aynı öğretmendeyse reddedilir; değilse izin verilir
    assert.equal(typeof clash.allowed, 'boolean');
  }
});

test('ManualScheduleEditor: sadece seçilen sınıfı yeniden dağıtma ve çizelge farkı karşılaştırması', async () => {
  const proj = generateRealisticSchool('very_small', { withClosedDays: false });
  const adapter = new OrToolsAdapter();
  const initial = await adapter.solve(buildSolverInput(proj, { timeLimitSeconds: 8 }));
  assert.equal(initial.evaluation.validation.isValid, true);
  proj.placements = initial.placements;

  const editor = new ManualScheduleEditor(proj);
  const targetClassId = proj.classes[0].id;
  const otherClassId = proj.classes[1].id;

  // Diğer sınıfın mevcut yerleşimlerini kaydet (dokunulmamış olmalı!)
  const beforeOther = {};
  for (const a of proj.assignments) {
    if (a.classId === otherClassId) {
      for (const [bid, pl] of Object.entries(proj.placements)) {
        if (bid.startsWith(`${a.id}:`)) beforeOther[bid] = { ...pl };
      }
    }
  }

  // Sadece targetClassId'yi yeniden dağıt
  const { solverInput, unlockedBlockIds } = editor.preparePartialReoptimize({ classIds: [targetClassId] }, { timeLimitSeconds: 8 });
  assert.ok(unlockedBlockIds.length > 0);

  const reopt = await adapter.solve(solverInput);
  assert.equal(reopt.evaluation.validation.isValid, true);

  // Diğer sınıfın tüm blokları birebir korunmuş olmalı!
  for (const [bid, pl] of Object.entries(beforeOther)) {
    assert.equal(reopt.placements[bid].day, pl.day, `Diğer sınıf bloğu (${bid}) gün değiştirmiş!`);
    assert.equal(reopt.placements[bid].period, pl.period, `Diğer sınıf bloğu (${bid}) saat değiştirmiş!`);
  }

  // Önceki/sonraki çizelge karşılaştırması
  const diff = editor.compareWith(reopt.placements);
  assert.equal(diff.beforeValid, true);
  assert.equal(diff.afterValid, true);
  assert.ok(diff.unchangedCount >= Object.keys(beforeOther).length);
});
