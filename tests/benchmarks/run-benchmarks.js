import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSolverInput, SolverStatus, validateProjectSchema } from '../../packages/core-schema/src/index.js';
import { MultiSolverEngine } from '../../packages/multi-solver/src/index.js';
import { generateRealisticSchool, SCHOOL_PROFILES } from '../profiles/school-generator.js';

/**
 * EvrakPlus Ders Dagitim Multi Plus v1.0.0 — Gercek Performans ve Senaryo Test Kosucusu
 * Hicbir metrik uydurulmaz; her satir gercek motor calistirmasi + EvrakPlus Independent Schedule Validator sonucudur.
 */
async function main() {
  const engine = new MultiSolverEngine();
  const health = await engine.healthCheckAll();

  const plan = [
    { profile: 'very_small', engines: ['ortools', 'timefold', 'choco', 'minizinc', 'scip', 'highs'], timeLimit: 15, closed: false },
    { profile: 'small', engines: ['ortools', 'timefold', 'choco', 'minizinc', 'highs'], timeLimit: 20, closed: true },
    { profile: 'medium', engines: ['ortools', 'choco'], timeLimit: 25, closed: true },
    { profile: 'large', engines: ['ortools'], timeLimit: 40, closed: true },
    { profile: 'xlarge', engines: ['ortools'], timeLimit: 50, closed: true },
    { profile: 'ultimate', engines: ['ortools'], timeLimit: 60, closed: true }
  ];

  const rows = [];
  console.log('=== EvrakPlus Multi Plus v1.0.0 — Gerçek Performans Ölçümleri ===');

  for (const item of plan) {
    const meta = SCHOOL_PROFILES[item.profile];
    const proj = generateRealisticSchool(item.profile, { withClosedDays: item.closed });
    const input = buildSolverInput(proj, { timeLimitSeconds: item.timeLimit, numWorkers: Math.min(8, os.cpus().length || 4) });

    for (const eid of item.engines) {
      const adapter = engine.getAdapter(eid);
      const memBefore = process.memoryUsage().rss;
      console.log(`> Running ${item.profile} (${meta.teacherCount}/${meta.classCount}, ${input.blocks.length} blocks) on [${eid}] (limit=${item.timeLimit}s)...`);
      const res = await adapter.solve(input);
      const memAfter = process.memoryUsage().rss;
      const m = res.evaluation.validation.metrics;
      const row = {
        profile: `${meta.name} (${meta.teacherCount}/${meta.classCount})`,
        teachers: meta.teacherCount,
        classes: meta.classCount,
        totalBlocks: m.totalBlocks,
        engine: eid,
        version: health[eid]?.version || '?',
        status: res.status,
        isValid: res.evaluation.validation.isValid,
        elapsedMs: res.elapsedMs,
        assignedBlocks: m.assignedBlocks,
        unassignedBlocks: m.unassignedBlocksCount,
        hardViolations: m.hardViolationCount,
        softViolations: m.softViolationCount,
        teacherGaps: m.totalTeacherGaps,
        qualityScore: res.evaluation.qualityScore,
        rssMB: Math.round(Math.max(memBefore, memAfter) / (1024 * 1024))
      };
      rows.push(row);
      console.log(`  Result: status=${row.status} valid=${row.isValid} time=${row.elapsedMs}ms assigned=${row.assignedBlocks}/${row.totalBlocks} hard=${row.hardViolations} gaps=${row.teacherGaps} quality=${row.qualityScore}/100`);
    }
  }

  // Ek dayaniklilik senaryolari (motor iptali, bozuk JSON, motor cokmesi)
  const scenarioResults = [];

  // Senaryo A: Bozuk JSON
  const badJson = validateProjectSchema({ broken: true });
  scenarioResults.push({ scenario: 'Bozuk JSON reddi', passed: badJson.valid === false, detail: badJson.errors.join('; ') });

  // Senaryo B: Kullanici iptali (cancel)
  const cancelAdapter = engine.getAdapter('timefold');
  const cancelProj = generateRealisticSchool('small', { withClosedDays: false });
  const cancelInput = buildSolverInput(cancelProj, { timeLimitSeconds: 30 });
  const solvePromise = cancelAdapter.solve(cancelInput);
  setTimeout(() => cancelAdapter.cancel(), 1200);
  const cancelRes = await solvePromise;
  scenarioResults.push({ scenario: 'Kullanıcı iptali (Timefold cancel)', passed: cancelRes.status === SolverStatus.CANCELLED, detail: `status=${cancelRes.status}, elapsed=${cancelRes.elapsedMs}ms` });

  // Senaryo C: Motor cokme izolasyonu (olmayan binary ile hata yakalama, ana surec cokmez)
  const { OrToolsAdapter } = await import('../../engines/ortools/adapter.js');
  const brokenAdapter = new OrToolsAdapter({ pythonBin: 'NON_EXISTENT_PYTHON_BINARY_XYZ' });
  const crashRes = await brokenAdapter.solve(buildSolverInput(generateRealisticSchool('very_small')));
  scenarioResults.push({ scenario: 'Motor çökme/başlatma hatası izolasyonu', passed: crashRes.status === SolverStatus.ERROR, detail: `status=${crashRes.status}, ana süreç korundu` });

  // Markdown Test Raporu olustur
  const md = [
    '# EvrakPlus Ders Dağıtım Multi Plus — v1.0.0 Gerçek Test Raporu',
    '',
    `- **Tarih:** ${new Date().toISOString()}`,
    `- **İşletim Sistemi / Mimari:** ${os.platform()} ${os.release()} (${os.arch()})`,
    `- **İşlemci / Bellek:** ${os.cpus()[0]?.model || 'CPU'} (${os.cpus().length} çekirdek) · ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB RAM`,
    `- **Node.js:** ${process.version}`,
    '',
    '## 1. Altı Motor Sağlık ve Gerçek Sürüm Durumu',
    '',
    '| Motor | Sürüm | Sağlık | Not |',
    '|---|---|---|---|',
    ...Object.entries(health).map(([id, h]) => `| \`${id}\` | \`${h.version || '-'}\` | ${h.healthy ? 'Sağlıklı' : 'Hata'} | ${h.backendDisclosure?.displayLabel || h.capabilities?.role || ''} |`),
    '',
    '## 2. Altı Ölçekli Gerçek Okul Performans Test Sonuçları',
    '',
    '> Tüm sonuçlar **EvrakPlus Independent Schedule Validator** tarafından bağımsız olarak doğrulanmıştır.',
    '',
    '| Okul Profili (Öğr/Şube) | Blok | Motor | Durum | Geçerli | Süre (ms) | Atanan/Toplam | Zorunlu İhlal | Esnek İhlal | Öğr. Boşluk | Kalite (/100) |',
    '|---|---:|---|---|---|---:|---:|---:|---:|---:|---:|',
    ...rows.map(r => `| ${r.profile} | ${r.totalBlocks} | \`${r.engine}\` | **${r.status}** | ${r.isValid ? 'Evet' : 'Hayır'} | ${r.elapsedMs} | ${r.assignedBlocks}/${r.totalBlocks} | ${r.hardViolations} | ${r.softViolations} | ${r.teacherGaps} | **${r.qualityScore}** |`),
    '',
    '## 3. Güvenlik ve Dayanıklılık Senaryoları',
    '',
    '| Senaryo | Sonuç | Detay |',
    '|---|---|---|',
    ...scenarioResults.map(s => `| ${s.scenario} | ${s.passed ? 'GEÇTİ' : 'BAŞARISIZ'} | ${s.detail} |`),
    '',
    '## 4. Test Kapsamı Dışı / Harici Ortam Gerektiren Kontroller',
    '',
    '- Temiz Windows VM üzerinde Python/Java kurulu değilken nihai EXE kurulum testi (Aşama 21 paketleri üretildikten sonra temiz Windows ortamında yürütülmelidir).',
    '- Canlı Apache/PHP/MySQL cPanel ve canlı WordPress sunucusu üzerinde uçtan uca ağ testi (bu makinede PHP/MySQL/Docker kurulu olmadığı için statik + FastAPI canlı HTTP + bellek-içi sync testleri çalıştırılmıştır).'
  ].join('\n');

  const outPath = path.resolve('docs/EvrakPlus-Multi-Plus-1.0.0-Test-Report.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\nRapor yazıldı: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
