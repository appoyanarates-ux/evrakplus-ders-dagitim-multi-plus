import { DAYS_TR, buildSolverInput, expandAssignments, SolverStatus } from '../../core-schema/src/index.js';
import { evaluateSolution } from '../../validator/src/index.js';
import { verifyOfflineEntitlement, getMembershipPromptSpec } from '../../auth-client/src/index.js';

export const REPORT_TYPES = Object.freeze([
  'teacher_weekly',
  'class_weekly',
  'room_weekly',
  'school_master',
  'daily_teacher',
  'daily_class',
  'batch_teachers',
  'batch_classes',
  'teacher_load',
  'teacher_gaps',
  'unassigned',
  'rule_violations',
  'quality_report',
  'engine_comparison',
  'building_changes',
  'duty_schedule'
]);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Korumalı çıktı yetki kapısı:
 * Geçerli Ed25519 imzalı çevrimdışı belge VEYA sunucu doğrulaması olmadan çıktı üretimine izin vermez.
 */
export function checkExportAuthorization(authContext = {}) {
  if (authContext.serverVerified === true && authContext.canExport === true) {
    return { authorized: true, mode: 'server' };
  }
  if (authContext.signedToken && authContext.publicKeyPem) {
    const res = verifyOfflineEntitlement(authContext.signedToken, authContext.publicKeyPem, {
      expectedDeviceId: authContext.deviceId || null,
      nowSec: authContext.nowSec
    });
    if (res.valid && res.canExport) {
      return { authorized: true, mode: 'offline_signed', expiresAt: res.expiresAt };
    }
    return { authorized: false, reason: res.reason, prompt: getMembershipPromptSpec() };
  }
  return { authorized: false, reason: 'MEMBERSHIP_REQUIRED', prompt: getMembershipPromptSpec() };
}

/**
 * Proje + yerleşim verisinden tüm raporlar için ortak analiz verisini hesaplar.
 */
export function buildReportData(project, { engineComparison = [] } = {}) {
  const input = buildSolverInput(project);
  const evaluation = evaluateSolution(input, project.placements || {}, SolverStatus.FEASIBLE);
  const D = project.school.daysPerWeek || 5;
  const P = project.school.periodsPerDay || 7;
  const blocks = expandAssignments(project);

  const teacherMap = new Map(project.teachers.map(t => [t.id, t]));
  const classMap = new Map(project.classes.map(c => [c.id, c]));
  const roomMap = new Map((project.rooms || []).map(r => [r.id, r]));

  const teacherGrid = {};
  const classGrid = {};
  const roomGrid = {};
  const teacherStats = new Map(project.teachers.map(t => [t.id, {
    teacher: t,
    weeklyHours: 0,
    perDay: new Array(D).fill(0),
    gaps: 0,
    buildingChanges: 0
  }]));

  for (const b of blocks) {
    const pl = (project.placements || {})[b.blockId];
    if (!pl) continue;
    const subj = (project.subjects || {})[b.subjectKey] || { name: b.subjectKey, short: b.subjectKey };
    const cls = classMap.get(b.classId);
    const tch = teacherMap.get(b.teacherId);
    const roomId = pl.roomId || b.roomId || cls?.homeRoomId || null;
    const room = roomId ? roomMap.get(roomId) : null;

    for (let k = 0; k < b.length; k++) {
      const slot = `${pl.day}-${pl.period + k}`;
      const cell = { blockId: b.blockId, subject: subj, cls, tch, room, k, length: b.length };
      if (cls) (classGrid[cls.id] = classGrid[cls.id] || {})[slot] = cell;
      if (tch) (teacherGrid[tch.id] = teacherGrid[tch.id] || {})[slot] = cell;
      if (room) (roomGrid[room.id] = roomGrid[room.id] || {})[slot] = cell;
    }

    if (tch && teacherStats.has(tch.id)) {
      const st = teacherStats.get(tch.id);
      st.weeklyHours += b.length;
      if (pl.day >= 0 && pl.day < D) st.perDay[pl.day] += b.length;
    }
  }

  // Boşluklar ve bina değişimi
  for (const [tid, st] of teacherStats.entries()) {
    const G = teacherGrid[tid] || {};
    for (let d = 0; d < D; d++) {
      let first = -1, last = -1, cnt = 0, prevB = null;
      for (let p = 0; p < P; p++) {
        const cell = G[`${d}-${p}`];
        if (cell) {
          if (first < 0) first = p;
          last = p;
          cnt++;
          const bId = cell.room?.buildingId || null;
          if (prevB && bId && prevB !== bId) st.buildingChanges++;
          if (bId) prevB = bId;
        }
      }
      if (cnt > 0) st.gaps += (last - first + 1) - cnt;
    }
  }

  return {
    D, P, evaluation, teacherGrid, classGrid, roomGrid,
    teacherStats: [...teacherStats.values()],
    engineComparison
  };
}

function pageCss(pageSize = 'A4', orientation = 'portrait') {
  const validSize = pageSize === 'A3' ? 'A3' : 'A4';
  const validOri = orientation === 'landscape' ? 'landscape' : 'portrait';
  return `@page{size:${validSize} ${validOri};margin:10mm}
  body{font:12px/1.3 "Times New Roman",Times,serif;color:#111;background:#fff;margin:0}
  .doc{page-break-after:always;padding:6mm}.doc:last-child{page-break-after:auto}
  .hdr{display:flex;align-items:center;justify-content:center;gap:14px;text-align:center;margin-bottom:10px}
  .hdr img{max-height:54px;max-width:54px}.ttl{font-weight:700;font-size:14px;line-height:1.35}
  table{border-collapse:collapse;width:100%;margin-top:8px}
  th,td{border:1px solid #222;padding:4px 5px;text-align:center;vertical-align:middle}
  th{background:#dde3fb;font-weight:700}td.l{text-align:left}
  .sig{display:flex;justify-content:space-between;margin-top:22px;padding:0 16px;font-size:12px}
  .sig div{text-align:center;min-width:150px}`;
}

function headerBlock(project, subtitle, opts = {}) {
  const logo = opts.logoDataUrl || project.school.logoDataUrl || '';
  const schoolName = opts.schoolName || project.school.name || 'Okul';
  const year = opts.year || project.school.year || '';
  const term = opts.term || project.school.term || '';
  return `<div class="hdr">${logo ? `<img src="${esc(logo)}" alt="Logo">` : ''}<div class="ttl">${esc(schoolName)}<br>${esc(year)} ${esc(term)} · ${esc(subtitle)}</div></div>`;
}

function signatureBlock(project, opts = {}) {
  const principal = opts.principal || project.school.principal || '…………………………';
  const vice = opts.vicePrincipal || (project.school.vicePrincipals?.[0]?.name) || '';
  return `<div class="sig"><div>${vice ? `${esc(vice)}<br>Müdür Yardımcısı` : ''}</div><div>${esc(principal)}<br>Okul Müdürü</div></div>`;
}

function renderWeeklyTable(D, P, grid, labelFn) {
  let html = `<table><thead><tr><th style="width:70px">Saat</th>${DAYS_TR.slice(0, D).map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>`;
  for (let p = 0; p < P; p++) {
    html += `<tr><th>${p + 1}. ders</th>`;
    for (let d = 0; d < D; d++) {
      const c = grid[`${d}-${p}`];
      html += `<td>${c ? labelFn(c) : ''}</td>`;
    }
    html += '</tr>';
  }
  return html + '</tbody></table>';
}

/**
 * Üyelik kontrollü çıktı üretici (HTML/PDF, Excel, Word, CSV).
 */
export function generateProtectedExport(project, options = {}, authContext = {}) {
  const auth = checkExportAuthorization(authContext);
  if (!auth.authorized) {
    return {
      authorized: false,
      reason: auth.reason,
      prompt: auth.prompt,
      content: null
    };
  }

  const reportType = REPORT_TYPES.includes(options.reportType) ? options.reportType : 'batch_classes';
  const format = options.format || 'html_pdf'; // html_pdf | excel | word | csv
  const pageSize = options.pageSize || 'A4';
  const orientation = options.orientation || (reportType === 'school_master' ? 'landscape' : 'portrait');
  const data = buildReportData(project, { engineComparison: options.engineComparison || [] });

  let sections = [];
  if (reportType === 'teacher_weekly' || reportType === 'batch_teachers') {
    const list = options.entityId ? project.teachers.filter(t => t.id === options.entityId) : project.teachers;
    sections = list.map(t => `<section class="doc">${headerBlock(project, `Öğretmen Ders Programı — ${t.name}`, options)}${renderWeeklyTable(data.D, data.P, data.teacherGrid[t.id] || {}, c => `<b>${esc(c.cls?.name || '')}</b><br>${esc(c.subject.short)}`)}${signatureBlock(project, options)}</section>`);
  } else if (reportType === 'class_weekly' || reportType === 'batch_classes') {
    const list = options.entityId ? project.classes.filter(c => c.id === options.entityId) : project.classes;
    sections = list.map(cl => `<section class="doc">${headerBlock(project, `Sınıf Ders Programı — ${cl.name}`, options)}${renderWeeklyTable(data.D, data.P, data.classGrid[cl.id] || {}, c => `<b>${esc(c.subject.short)}</b><br>${esc(c.tch?.short || c.tch?.name || '')}`)}${signatureBlock(project, options)}</section>`);
  } else if (reportType === 'room_weekly') {
    const list = options.entityId ? (project.rooms || []).filter(r => r.id === options.entityId) : (project.rooms || []);
    sections = list.map(rm => `<section class="doc">${headerBlock(project, `Derslik Programı — ${rm.name}`, options)}${renderWeeklyTable(data.D, data.P, data.roomGrid[rm.id] || {}, c => `<b>${esc(c.cls?.name || '')}</b><br>${esc(c.subject.short)}`)}${signatureBlock(project, options)}</section>`);
  } else if (reportType === 'teacher_load' || reportType === 'teacher_gaps' || reportType === 'building_changes') {
    const rows = data.teacherStats.map(s => `<tr><td class="l">${esc(s.teacher.name)}</td><td>${esc(s.teacher.branch)}</td><td>${s.weeklyHours}</td>${s.perDay.map(n => `<td>${n}</td>`).join('')}<td>${s.gaps}</td><td>${s.buildingChanges}</td></tr>`).join('');
    sections = [`<section class="doc">${headerBlock(project, 'Öğretmen Yük, Boş Ders ve Bina Değişim Raporu', options)}<table><thead><tr><th>Öğretmen</th><th>Branş</th><th>Toplam</th>${DAYS_TR.slice(0, data.D).map(d => `<th>${d.slice(0, 3)}</th>`).join('')}<th>Boş Ders</th><th>Bina Değişimi</th></tr></thead><tbody>${rows}</tbody></table>${signatureBlock(project, options)}</section>`];
  } else if (reportType === 'quality_report' || reportType === 'rule_violations' || reportType === 'unassigned') {
    const m = data.evaluation.validation.metrics;
    const viols = [...data.evaluation.validation.hardViolations, ...data.evaluation.validation.softViolations];
    sections = [`<section class="doc">${headerBlock(project, 'Doğrulama ve Optimizasyon Kalite Raporu', options)}
      <p><b>Geçerli Program:</b> ${data.evaluation.validation.isValid ? 'Evet' : 'Hayır'} · <b>Kalite Puanı:</b> ${data.evaluation.qualityScore} / 100 · <b>Atanan Blok:</b> ${m.assignedBlocks}/${m.totalBlocks} · <b>Zorunlu İhlal:</b> ${m.hardViolationCount} · <b>Esnek İhlal:</b> ${m.softViolationCount}</p>
      <table><thead><tr><th>Seviye</th><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${viols.length ? viols.map(v => `<tr><td>${esc(v.level)}</td><td>${esc(v.code)}</td><td class="l">${esc(v.message)}</td></tr>`).join('') : '<tr><td colspan="3">Kural ihlali bulunmadı.</td></tr>'}</tbody></table>${signatureBlock(project, options)}</section>`];
  } else if (reportType === 'engine_comparison') {
    const rows = (data.engineComparison || []).map(r => `<tr><td class="l">${esc(r.engine)}</td><td>${esc(r.status)}</td><td>${r.isValid ? 'Evet' : 'Hayır'}</td><td>${r.qualityScore}</td><td>${r.hardViolations}</td><td>${r.teacherGaps}</td><td>${r.elapsedMs} ms</td></tr>`).join('');
    sections = [`<section class="doc">${headerBlock(project, 'Multi Solver Motor Karşılaştırma Raporu', options)}<table><thead><tr><th>Motor</th><th>Durum</th><th>Geçerli</th><th>Kalite /100</th><th>Zorunlu İhlal</th><th>Boşluk</th><th>Süre</th></tr></thead><tbody>${rows}</tbody></table>${signatureBlock(project, options)}</section>`];
  } else {
    // school_master, daily_teacher, daily_class, duty_schedule
    const rows = project.classes.map(cl => {
      const G = data.classGrid[cl.id] || {};
      let cells = '';
      for (let d = 0; d < data.D; d++) for (let p = 0; p < data.P; p++) cells += `<td>${G[`${d}-${p}`] ? esc(G[`${d}-${p}`].subject.short) : ''}</td>`;
      return `<tr><td class="l"><b>${esc(cl.name)}</b></td>${cells}</tr>`;
    }).join('');
    sections = [`<section class="doc">${headerBlock(project, 'Okul Genel Çarşaf Ders Programı', options)}<table><thead><tr><th>Şube</th>${DAYS_TR.slice(0, data.D).map(d => `<th colspan="${data.P}">${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>${signatureBlock(project, options)}</section>`];
  }

  const bodyHtml = sections.join('\n');
  const title = `${project.school.name || 'EvrakPlus'} - ${reportType}`;

  if (format === 'csv') {
    const header = ['Öğretmen', 'Branş', 'Haftalık Saat', 'Boş Ders', 'Bina Değişimi'];
    const lines = [header.join(';'), ...data.teacherStats.map(s => [s.teacher.name, s.teacher.branch, s.weeklyHours, s.gaps, s.buildingChanges].join(';'))];
    return { authorized: true, format: 'csv', mimeType: 'text/csv;charset=utf-8', filename: `${reportType}.csv`, content: '\uFEFF' + lines.join('\r\n') };
  }

  if (format === 'excel') {
    // Excel uyumlu SpreadsheetML XML (.xls)
    const rowsXml = data.teacherStats.map(s =>
      `<Row><Cell><Data ss:Type="String">${esc(s.teacher.name)}</Data></Cell><Cell><Data ss:Type="String">${esc(s.teacher.branch)}</Data></Cell><Cell><Data ss:Type="Number">${s.weeklyHours}</Data></Cell><Cell><Data ss:Type="Number">${s.gaps}</Data></Cell><Cell><Data ss:Type="Number">${s.buildingChanges}</Data></Cell></Row>`
    ).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="EvrakPlus Rapor"><Table>
<Row><Cell><Data ss:Type="String">Öğretmen</Data></Cell><Cell><Data ss:Type="String">Branş</Data></Cell><Cell><Data ss:Type="String">Haftalık Saat</Data></Cell><Cell><Data ss:Type="String">Boş Ders</Data></Cell><Cell><Data ss:Type="String">Bina Değişimi</Data></Cell></Row>
${rowsXml}
</Table></Worksheet></Workbook>`;
    return { authorized: true, format: 'excel', mimeType: 'application/vnd.ms-excel', filename: `${reportType}.xls`, content: xml };
  }

  if (format === 'word') {
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${pageCss(pageSize, orientation)}</style></head><body>${bodyHtml}</body></html>`;
    return { authorized: true, format: 'word', mimeType: 'application/msword', filename: `${reportType}.doc`, content: doc };
  }

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${pageCss(pageSize, orientation)}</style></head><body>${bodyHtml}</body></html>`;
  return { authorized: true, format: 'html_pdf', pageSize, orientation, mimeType: 'text/html;charset=utf-8', filename: `${reportType}-${pageSize}-${orientation}.html`, content: html };
}
