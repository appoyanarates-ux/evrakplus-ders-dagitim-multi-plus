/**
 * EvrakPlus Multi Solver Merkezi (multi_solver_ui.js)
 * 6 gerçek optimizasyon motorunun sağlık, sürüm, donanım kaynakları,
 * dağıtım modu, süre bütçesi ve alternatif çizelge karşılaştırma ekranını yönetir.
 */
(function (global) {
  'use strict';

  const ENGINE_META = [
    { key: 'ortools', id: 'google_ortools_cp_sat', name: 'Google OR-Tools CP-SAT', role: 'Ana optimizasyon motoru', badge: 'CP-SAT' },
    { key: 'timefold', id: 'timefold_solver', name: 'Timefold Solver', role: 'Çözüm ve kalite optimizasyonu', badge: 'Java 21' },
    { key: 'choco', id: 'choco_solver', name: 'Choco Solver', role: 'Karmaşık kısıt çözümü', badge: 'Java 21 CP' },
    { key: 'minizinc', id: 'minizinc', name: 'MiniZinc (Gecode / Chuffed)', role: 'Alternatif CP modelleme altyapısı', badge: 'MiniZinc' },
    { key: 'scip', id: 'scip', name: 'SCIP Optimization Suite', role: 'Tamsayılı matematiksel optimizasyon', badge: 'MILP' },
    { key: 'highs', id: 'highs', name: 'HiGHS MILP Solver', role: 'Yüksek performanslı MILP çözücü', badge: 'MILP' }
  ];

  const VALID_ENGINES = new Set([
    'google_ortools_cp_sat',
    'timefold_solver',
    'choco_solver',
    'minizinc',
    'minizinc_gecode',
    'minizinc_chuffed',
    'scip',
    'highs',
    'multi_solver'
  ]);

  const multiState = {
    mode: 'auto', // auto | single | sequential | parallel | hybrid | ultimate
    selectedEngines: ['ortools', 'timefold', 'highs'],
    singleEngine: 'ortools',
    timePreset: '60', // 30, 120, 300, 600, 1800, 3600, custom, manual
    customTimeSec: 90,
    performanceMode: 'balanced', // low | balanced | high
    minizincBackend: 'gecode', // gecode | chuffed
    sameTeacherClassMultiCourseMode: 'soft', // soft | hard | off
    allowBlockAlternatives: false,
    health: null,
    lastCandidates: [],
    lastPassLog: [],
    lastRelaxations: []
  };

  function getTimeLimitSec() {
    if (multiState.timePreset === 'manual') return 0;
    if (multiState.timePreset === 'custom') return Math.max(5, Number(multiState.customTimeSec) || 60);
    return Math.max(5, Number(multiState.timePreset) || 60);
  }

  function getMultiSolverRequestOptions() {
    const engines = multiState.mode === 'single'
      ? [multiState.singleEngine]
      : (multiState.selectedEngines.length ? multiState.selectedEngines.slice() : ['ortools']);
    return {
      multi_mode: multiState.mode,
      engines,
      time_limit_sec: getTimeLimitSec(),
      performance_mode: multiState.performanceMode,
      minizinc_backend: multiState.minizincBackend,
      same_teacher_class_multi_course_mode: multiState.sameTeacherClassMultiCourseMode,
      allow_block_alternatives: Boolean(multiState.allowBlockAlternatives),
      enable_multipass: true
    };
  }

  function isAcceptedEngine(engineId) {
    return VALID_ENGINES.has(String(engineId || ''));
  }

  async function refreshHealth() {
    const api = global.dersDagitimAPI;
    const statusEl = document.getElementById('msSystemSummary');
    if (statusEl) statusEl.textContent = 'Motor sağlık kontrolleri yapılıyor...';
    if (api && typeof api.getMultiSolverHealth === 'function') {
      try {
        multiState.health = await api.getMultiSolverHealth();
      } catch (err) {
        multiState.health = { available_engines: 0, total_engines: 6, engines: {}, error: err.message };
      }
    } else {
      multiState.health = {
        available_engines: 0,
        total_engines: 6,
        engines: {},
        previewMode: true
      };
    }
    renderMultiSolverCenter();
  }

  function renderMultiSolverCenter() {
    const container = document.getElementById('m5MultiSolverCenter');
    if (!container) return;

    const h = multiState.health;
    const sys = h && h.system ? h.system : null;
    const sysText = sys
      ? `CPU: ${sys.cpu_cores} çekirdek · Kullanılabilir RAM: ${Math.round(sys.available_ram_mb / 1024 * 10) / 10} / ${Math.round(sys.total_ram_mb / 1024 * 10) / 10} GB · Aktif Motor: ${h.available_engines}/${h.total_engines}`
      : (h && h.previewMode
        ? 'Web / Önizleme Modu — 6 native motor Windows masaüstü uygulamasında veya harici Solver Server üzerinden çalışır.'
        : 'Motor durumu kontrol edilmedi.');

    const modeOptions = [
      ['auto', 'Akıllı Otomatik Mod'],
      ['single', 'Tek Motor Modu'],
      ['sequential', 'Sıralı Motor Modu'],
      ['parallel', 'Paralel Motor Modu'],
      ['hybrid', 'Hibrit Optimizasyon (OR-Tools + Timefold + Diğerleri)'],
      ['ultimate', 'Ultimate Optimizasyon Modu']
    ];

    const timeOptions = [
      ['30', '30 saniye (Hızlı)'],
      ['120', '2 dakika (Normal)'],
      ['300', '5 dakika (Gelişmiş)'],
      ['600', '10 dakika (Derin)'],
      ['1800', '30 dakika (Profesyonel)'],
      ['3600', '60 dakika (Ultimate)'],
      ['custom', 'Özel süre'],
      ['manual', 'Manuel durdurulana kadar']
    ];

    const candByEngine = {};
    (multiState.lastCandidates || []).forEach((c) => {
      if (c && c.engine_key) candByEngine[c.engine_key] = c;
    });

    const cardsHtml = ENGINE_META.map((em) => {
      const info = h && h.engines && h.engines[em.key] ? h.engines[em.key] : null;
      const avail = Boolean(info && info.available);
      const checked = multiState.mode === 'single'
        ? multiState.singleEngine === em.key
        : multiState.selectedEngines.includes(em.key);
      const cand = candByEngine[em.key];
      const badgeCls = avail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200';
      const statusTxt = avail ? 'Hazır' : (h && h.previewMode ? 'Masaüstü/Sunucu' : 'Kurulu Değil');
      const verTxt = info && info.version ? info.version : '—';
      const metricsHtml = cand
        ? `<div class="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
            <span>Durum: <strong class="${cand.valid ? 'text-emerald-700' : 'text-rose-700'}">${cand.status}</strong></span>
            <span>Kalite: <strong class="text-indigo-700">${cand.quality_score}/100</strong></span>
            <span>Süre: <strong>${cand.solve_time_sec} sn</strong></span>
            <span>Blok: <strong>${cand.placed_blocks}/${cand.total_blocks}</strong></span>
            <span>Zorunlu İhlal: <strong>${cand.hard_violations}</strong></span>
            <span>Esnek İhlal: <strong>${cand.soft_violations}</strong></span>
          </div>`
        : '';

      return `
        <div class="rounded-xl border ${checked ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'} p-3 flex flex-col justify-between transition">
          <div class="flex items-start justify-between gap-2">
            <label class="flex items-start gap-2 cursor-pointer">
              <input type="${multiState.mode === 'single' ? 'radio' : 'checkbox'}"
                name="msEngineSelect"
                value="${em.key}"
                ${checked ? 'checked' : ''}
                class="ms-engine-toggle mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <div>
                <div class="text-xs font-bold text-slate-900">${em.name}</div>
                <div class="text-[11px] text-slate-500">${em.role}</div>
              </div>
            </label>
            <span class="px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badgeCls}">${statusTxt}</span>
          </div>
          <div class="mt-1.5 text-[10px] text-slate-500 truncate" title="${verTxt}">Sürüm: ${verTxt}</div>
          ${metricsHtml}
        </div>
      `;
    }).join('');

    const comparisonHtml = (multiState.lastCandidates && multiState.lastCandidates.length > 0)
      ? `
        <div class="mt-4 pt-4 border-t border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Alternatif Çizelge Karşılaştırması (Bağımsız Doğrulama & 100'lük Ortak Kalite Puanı)</h4>
            <span class="text-[11px] text-slate-500">${multiState.lastCandidates.length} motor sonucu</span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead class="bg-slate-50 text-slate-700">
                <tr>
                  <th class="px-2.5 py-2 text-left">Motor</th>
                  <th class="px-2.5 py-2 text-left">Durum</th>
                  <th class="px-2.5 py-2 text-center">Geçerli</th>
                  <th class="px-2.5 py-2 text-center">Atanan Blok</th>
                  <th class="px-2.5 py-2 text-center">Zorunlu / Esnek İhlal</th>
                  <th class="px-2.5 py-2 text-center">Süre (sn)</th>
                  <th class="px-2.5 py-2 text-center">Kalite Puanı</th>
                  <th class="px-2.5 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                ${multiState.lastCandidates.map((c, idx) => `
                  <tr class="${idx === 0 && c.valid ? 'bg-emerald-50/40' : ''}">
                    <td class="px-2.5 py-2 font-semibold text-slate-900">
                      ${c.engine_key || c.engine}${c.backend_solver ? ` (${c.backend_solver})` : ''}
                      <div class="text-[10px] font-normal text-slate-500">${c.engine_version || ''}</div>
                    </td>
                    <td class="px-2.5 py-2">${c.status}</td>
                    <td class="px-2.5 py-2 text-center">${c.valid ? '<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">GEÇERLİ</span>' : '<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">GEÇERSİZ</span>'}</td>
                    <td class="px-2.5 py-2 text-center">${c.placed_blocks}/${c.total_blocks}</td>
                    <td class="px-2.5 py-2 text-center">${c.hard_violations} / ${c.soft_violations}</td>
                    <td class="px-2.5 py-2 text-center">${c.solve_time_sec}</td>
                    <td class="px-2.5 py-2 text-center font-bold text-indigo-700">${c.quality_score} / 100</td>
                    <td class="px-2.5 py-2 text-right">
                      ${c.valid && Array.isArray(c.placements) && c.placements.length
                        ? `<button type="button" data-ms-apply="${idx}" class="ms-apply-candidate px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold">Bu Çizelgeyi Uygula</button>`
                        : '<span class="text-[11px] text-slate-400">Uygulanamaz</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${multiState.lastRelaxations && multiState.lastRelaxations.length
            ? `<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900"><strong>Multi-Pass Esnetme Raporu:</strong> ${multiState.lastRelaxations.join(' · ')}</div>`
            : ''}
        </div>
      `
      : '';

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">EvrakPlus Multi Solver Optimization Engine</div>
            <h3 class="text-base font-bold text-slate-900 mt-1">Multi Solver Merkezi (6 Gerçek Optimizasyon Altyapısı)</h3>
            <p id="msSystemSummary" class="text-xs text-slate-500 mt-0.5">${sysText}</p>
          </div>
          <button id="btnMsRefreshHealth" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700">
            Sağlık Kontrolünü Yenile
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label class="block text-xs font-semibold text-slate-700">
            Çalışma Modu
            <select id="msModeSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium">
              ${modeOptions.map(([v, l]) => `<option value="${v}" ${multiState.mode === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Optimizasyon Süresi
            <select id="msTimeSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium">
              ${timeOptions.map(([v, l]) => `<option value="${v}" ${multiState.timePreset === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            ${multiState.timePreset === 'custom'
              ? `<input id="msCustomTimeInput" type="number" min="5" max="7200" value="${multiState.customTimeSec}" class="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs" placeholder="Saniye" />`
              : ''}
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Performans & Kaynak Modu
            <select id="msPerfSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium">
              <option value="low" ${multiState.performanceMode === 'low' ? 'selected' : ''}>Düşük (Tek çekirdek / az RAM)</option>
              <option value="balanced" ${multiState.performanceMode === 'balanced' ? 'selected' : ''}>Dengeli (Önerilen)</option>
              <option value="high" ${multiState.performanceMode === 'high' ? 'selected' : ''}>Yüksek Performans</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            MiniZinc Arka Uç Motoru
            <select id="msMznBackend" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium">
              <option value="gecode" ${multiState.minizincBackend === 'gecode' ? 'selected' : ''}>Gecode 6.6 (Varsayılan CP)</option>
              <option value="chuffed" ${multiState.minizincBackend === 'chuffed' ? 'selected' : ''}>Chuffed 0.14 (LCG CP)</option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          <label class="block text-xs font-semibold text-slate-700 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5">
            Aynı Öğretmen + Aynı Sınıf Farklı Ders Kuralı (Kendi Branşı + Branş Dışı)
            <select id="msTcMultiCourseSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
              <option value="soft" ${multiState.sameTeacherClassMultiCourseMode === 'soft' ? 'selected' : ''}>Ayrı günlere yay (Önerilen — öğretmen ve sınıfı yormaz)</option>
              <option value="hard" ${multiState.sameTeacherClassMultiCourseMode === 'hard' ? 'selected' : ''}>Aynı gün kesinlikle yasak (Sert kural)</option>
              <option value="off" ${multiState.sameTeacherClassMultiCourseMode === 'off' ? 'selected' : ''}>Kapalı (Aynı gün girebilir)</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
            <input id="msAllowBlockAlt" type="checkbox" ${multiState.allowBlockAlternatives ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 shrink-0" />
            <span>Multi-Pass PASS 2: Kesin çözüm çıkmazsa uzun blokları (3-4 saat) alternatif alt bloklara bölmeme izin ver (izinsiz asla bölünmez)</span>
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${cardsHtml}
        </div>

        ${comparisonHtml}
      </div>
    `;

    // Olay dinleyicileri
    const btnRef = document.getElementById('btnMsRefreshHealth');
    if (btnRef) btnRef.addEventListener('click', refreshHealth);

    const modeSel = document.getElementById('msModeSelect');
    if (modeSel) modeSel.addEventListener('change', (e) => { multiState.mode = e.target.value; renderMultiSolverCenter(); });

    const timeSel = document.getElementById('msTimeSelect');
    if (timeSel) timeSel.addEventListener('change', (e) => { multiState.timePreset = e.target.value; renderMultiSolverCenter(); });

    const customInp = document.getElementById('msCustomTimeInput');
    if (customInp) customInp.addEventListener('change', (e) => { multiState.customTimeSec = Math.max(5, Number(e.target.value) || 60); });

    const perfSel = document.getElementById('msPerfSelect');
    if (perfSel) perfSel.addEventListener('change', (e) => { multiState.performanceMode = e.target.value; });

    const mznSel = document.getElementById('msMznBackend');
    if (mznSel) mznSel.addEventListener('change', (e) => { multiState.minizincBackend = e.target.value; });

    const tcMultiSel = document.getElementById('msTcMultiCourseSelect');
    if (tcMultiSel) tcMultiSel.addEventListener('change', (e) => { multiState.sameTeacherClassMultiCourseMode = e.target.value; });

    const blkChk = document.getElementById('msAllowBlockAlt');
    if (blkChk) blkChk.addEventListener('change', (e) => { multiState.allowBlockAlternatives = Boolean(e.target.checked); });

    container.querySelectorAll('.ms-engine-toggle').forEach((inp) => {
      inp.addEventListener('change', () => {
        if (multiState.mode === 'single') {
          multiState.singleEngine = inp.value;
        } else {
          if (inp.checked) {
            if (!multiState.selectedEngines.includes(inp.value)) multiState.selectedEngines.push(inp.value);
          } else {
            multiState.selectedEngines = multiState.selectedEngines.filter((k) => k !== inp.value);
          }
        }
        renderMultiSolverCenter();
      });
    });

    container.querySelectorAll('.ms-apply-candidate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-ms-apply'));
        const cand = multiState.lastCandidates[idx];
        if (!cand || !cand.valid || !Array.isArray(cand.placements)) return;
        if (typeof global.applyMultiSolverCandidate === 'function') {
          global.applyMultiSolverCandidate(cand);
        }
      });
    });
  }

  function recordSolveResult(result) {
    if (!result) return;
    multiState.lastCandidates = Array.isArray(result.candidates) ? result.candidates : [];
    multiState.lastPassLog = Array.isArray(result.pass_log) ? result.pass_log : [];
    multiState.lastRelaxations = Array.isArray(result.relaxations) ? result.relaxations : [];
    renderMultiSolverCenter();
  }

  global.EvrakPlusMultiSolverUI = {
    getRequestOptions: getMultiSolverRequestOptions,
    isAcceptedEngine,
    refreshHealth,
    render: renderMultiSolverCenter,
    recordSolveResult,
    state: multiState
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderMultiSolverCenter();
    setTimeout(() => { refreshHealth(); }, 500);
  });
})(window);
