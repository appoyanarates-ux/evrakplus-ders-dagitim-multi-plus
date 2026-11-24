import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signOfflineEntitlement, EVRAKPLUS_LOGIN_URL } from '../../packages/auth-client/src/index.js';
import { REPORT_TYPES, generateProtectedExport } from '../../packages/reports/src/index.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

test('Yetkisiz çıktı girişimi kesinlikle reddedilmeli ve EvrakPlus üyelik penceresi dönmeli', () => {
  const proj = generateRealisticSchool('very_small');
  const denied = generateProtectedExport(proj, { reportType: 'batch_classes', format: 'html_pdf' }, {});
  assert.equal(denied.authorized, false);
  assert.equal(denied.content, null);
  assert.equal(denied.prompt.title, 'Ücretsiz üyelik gerekli');
  assert.equal(denied.prompt.buttons[0].url, EVRAKPLUS_LOGIN_URL);
});

test('Ed25519 imzalı yetki belgesi ile A4/A3 PDF-HTML, Excel ve Word çıktıları üretilmeli ve MEB onaylı ibaresi içermemeli', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const now = Math.floor(Date.now() / 1000);
  const signedToken = signOfflineEntitlement({ sub: 7, deviceId: 'pc-1', canExport: true, iat: now, exp: now + 3600 }, privPem);

  const authCtx = { signedToken, publicKeyPem: pubPem, deviceId: 'pc-1', nowSec: now + 5 };
  const proj = generateRealisticSchool('very_small');
  proj.school.principal = 'Mehmet Demir';
  proj.placements['a_0:0'] = { day: 0, period: 0 };

  assert.equal(REPORT_TYPES.length, 16);

  // A3 Yatay Genel Çarşaf (PDF-HTML)
  const pdfHtml = generateProtectedExport(proj, { reportType: 'school_master', format: 'html_pdf', pageSize: 'A3', orientation: 'landscape' }, authCtx);
  assert.equal(pdfHtml.authorized, true);
  assert.ok(pdfHtml.content.includes('size:A3 landscape'));
  assert.ok(pdfHtml.content.includes('Mehmet Demir'));
  assert.equal(/MEB onayl/i.test(pdfHtml.content), false, 'Resmî onay olmadan MEB onaylı ibaresi konulamaz');

  // Excel (.xls SpreadsheetML)
  const xls = generateProtectedExport(proj, { reportType: 'teacher_load', format: 'excel' }, authCtx);
  assert.equal(xls.authorized, true);
  assert.ok(xls.content.includes('Excel.Sheet'));

  // Word (.doc)
  const doc = generateProtectedExport(proj, { reportType: 'batch_teachers', format: 'word', pageSize: 'A4', orientation: 'portrait' }, authCtx);
  assert.equal(doc.authorized, true);
  assert.ok(doc.content.includes('urn:schemas-microsoft-com:office:word'));

  // Motor karşılaştırma raporu
  const cmp = generateProtectedExport(proj, {
    reportType: 'engine_comparison',
    format: 'html_pdf',
    engineComparison: [{ engine: 'ortools', status: 'OPTIMAL', isValid: true, qualityScore: 87.4, hardViolations: 0, teacherGaps: 0, elapsedMs: 750 }]
  }, authCtx);
  assert.equal(cmp.authorized, true);
  assert.ok(cmp.content.includes('ortools'));
});
