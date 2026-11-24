import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverInput, SolverStatus, validateProjectSchema } from '../../packages/core-schema/src/index.js';
import { evaluateSolution } from '../../packages/validator/src/index.js';
import { OrToolsAdapter } from '../../engines/ortools/adapter.js';
import { TimefoldAdapter } from '../../engines/timefold/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('Motor çökmesi / eksik ikili dosya hatası ana uygulamayı çökertmeden ERROR dönmeli', async () => {
  const broken = new OrToolsAdapter({ pythonBin: 'NON_EXISTENT_PYTHON_BINARY_XYZ' });
  const input = buildSolverInput(generateRealisticSchool('very_small'));
  const res = await broken.solve(input);
  assert.equal(res.status, SolverStatus.ERROR);
  assert.equal(res.evaluation.qualityScore, 0);
  assert.equal(res.evaluation.validation.isValid, false);
});

test('Kullanıcı iptali (cancel) çalışan Java motorunu güvenli sonlandırmalı', async () => {
  const tf = new TimefoldAdapter();
  const input = buildSolverInput(generateRealisticSchool('small', { withClosedDays: false }), { timeLimitSeconds: 30 });
  const p = tf.solve(input);
  setTimeout(() => tf.cancel(), 1000);
  const res = await p;
  assert.equal(res.status, SolverStatus.CANCELLED);
  assert.ok(res.elapsedMs < 15000, 'İptal sonrası süreç hızlı sonlanmalı');
});

test('0 blok atanmış boş çözüm 0 kalite puanı almalı (asla yüksek puan almamalı)', () => {
  const input = buildSolverInput(generateRealisticSchool('very_small'));
  const ev = evaluateSolution(input, {}, SolverStatus.INFEASIBLE);
  assert.equal(ev.validation.isValid, false);
  assert.equal(ev.qualityScore, 0);
  assert.equal(ev.rankTier, 0);
});

test('Bozuk JSON dosyası şema doğrulamasından geçmemeli', () => {
  const res = validateProjectSchema({ broken: true, school: { daysPerWeek: -1 } });
  assert.equal(res.valid, false);
  assert.ok(res.errors.length >= 1);
});
