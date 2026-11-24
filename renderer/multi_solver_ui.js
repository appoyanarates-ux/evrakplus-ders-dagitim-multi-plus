/**
 * EvrakPlus Multi Solver Merkezi (multi_solver_ui.js)
 * Varsayılan olarak %100 TAM OTOMATİK çalışır: kullanıcı teknik motor ayarlarıyla uğraşmaz.
 * Ön planda yalnızca öğretmen ve ders bloğu bazlı anlaşılır pedagojik kurallar yer alır.
 * İleri düzey motor seçimi ve donanım ayarları kapalı "Gelişmiş Motor Ayarları" çekmecesindedir.
 */
(function (global) {
  'use strict';

  const ENGINE_META = [
    { key: 'ortools', id: 'google_ortools_cp_sat', name: 'Google OR-Tools CP-SAT', role: 'Ana optimizasyon motoru' },
    { key: 'timefold', id: 'timefold_solver', name: 'Timefold Solver', role: 'Çözüm ve kalite optimizasyonu' },
    { key: 'choco', id: 'choco_solver', name: 'Choco Solver', role: 'Karmaşık kısıt çözümü' },
    { key: 'minizinc', id: 'minizinc', name: 'MiniZinc (Gecode / Chuffed)', role: 'Alternatif CP modelleme altyapısı' },
    { key: 'scip', id: 'scip', name: 'SCIP Optimization Suite', role: 'Tamsayılı matematiksel optimizasyon' },
    { key: 'highs', id: 'highs', name: 'HiGHS MILP Solver', role: 'Yüksek performanslı MILP çözücü' }
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
    mode: 'auto', // Varsayılan %100 Tam Otomatik
    selectedEngines: ['ortools', 'timefold', 'highs'],
    singleEngine: 'ortools',
    timePreset: '60',
    customTimeSec: 90,
    performanceMode: 'balanced',
    minizincBackend: 'gecode',
    // Pedagojik kurallar (kullanıcı dostu)
    sameTeacherClassMultiCourseMode: 'soft', // soft | hard | off
    allowBlockAlternatives: true,            // Varsayılan AÇIK: sıkışık durumda otomatik 3-4 sa blokları bölerek kurtarır
    autoRelaxSoftLimitsOnStuck: true,        // PASS 3-4: çözüm çıkmazsa esnek boşluk/ardışık limitlerini kontrollü esnet
    showAdvanced: false,
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
      : (multiState.mode === 'auto' ? [] : (multiState.selectedEngines.length ? multiState.selectedEngines.slice() : ['ortools']));
    return {
      multi_mode: multiState.mode,
      engines,
      time_limit_sec: getTimeLimitSec(),
      performance_mode: multiState.performanceMode,
      minizinc_backend: multiState.minizincBackend,
      same_teacher_class_multi_course_mode: multiState.sameTeacherClassMultiCourseMode,
      allow_block_alternatives: Boolean(multiState.allowBlockAlternatives),
      enable_multipass: Boolean(multiState.autoRelaxSoftLimitsOnStuck || multiState.allowBlockAlternatives)
    };
  }

  function isAcceptedEngine(engineId) {
    return VALID_ENGINES.has(String(engineId || ''));
  }

  async function refreshHealth() {
    const api = global.dersDagitimAPI;
    if (api && typeof api.getMultiSolverHealth === 'function') {
      try {
        multiState.health = await api.getMultiSolverHealth();
      } catch (err) {
        multiState.health = { available_engines: 0, total_engines: 6, engines: {}, error: err.message };
      }
    } else {
      multiState.health = { available_engines: 0, total_engines: 6, engines: {}, previewMode: true };
    }
    renderMultiSolverCenter();
  }

  function renderMultiSolverCenter() {
    const container = document.getElementById('m5MultiSolverCenter');
    if (!container) return;

    const h = multiState.health;
    const availCount = h && typeof h.available_engines === 'number' ? h.available_engines : 0;
    const totalCount = h && typeof h.total_engines === 'number' ? h.total_engines : 6;
    const autoBadge = availCount > 0
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">Tam Otomatik Aktif · ${availCount}/${totalCount} Motor Hazır</span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">Tam Otomatik Mod</span>`;

    const modeOptions = [
      ['auto', 'Tam Otomatik (Önerilen — okul büyüklüğüne göre en iyi motorları seçer)'],
      ['hybrid', 'Hibrit Kalite İyileştirme'],
      ['single', 'Tek Motor'],
      ['sequential', 'Sıralı Motor'],
      ['parallel', 'Paralel Motor'],
      ['ultimate', 'Ultimate Optimizasyon']
    ];

    const timeOptions = [
      ['30', '30 saniye (Hızlı)'],
      ['60', '1 dakika (Otomatik)'],
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

    const validCands = (multiState.lastCandidates || []).filter((c) => c && c.valid && Array.isArray(c.placements) && c.placements.length);
    const comparisonHtml = validCands.length > 1
      ? `
        <div class="mt-3 pt-3 border-t border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-900">Alternatif Geçerli Çizelgeler (En Yüksek Kalite Puanlısı Otomatik Seçildi)</h4>
            <span class="text-[11px] text-slate-500">${validCands.length} alternatif</span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead class="bg-slate-50 text-slate-700">
                <tr>
                  <th class="px-2.5 py-1.5 text-left">Çözüm</th>
                  <th class="px-2.5 py-1.5 text-center">Atanan Blok</th>
                  <th class="px-2.5 py-1.5 text-center">Süre (sn)</th>
                  <th class="px-2.5 py-1.5 text-center">Kalite Puanı</th>
                  <th class="px-2.5 py-1.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                ${validCands.map((c, idx) => `
                  <tr class="${idx === 0 ? 'bg-emerald-50/40' : ''}">
                    <td class="px-2.5 py-1.5 font-semibold text-slate-900">Alternatif #${idx + 1} <span class="text-[10px] text-slate-500 font-normal">(${c.engine_key || c.engine})</span></td>
                    <td class="px-2.5 py-1.5 text-center">${c.placed_blocks}/${c.total_blocks}</td>
                    <td class="px-2.5 py-1.5 text-center">${c.solve_time_sec}</td>
                    <td class="px-2.5 py-1.5 text-center font-bold text-indigo-700">${c.quality_score} / 100</td>
                    <td class="px-2.5 py-1.5 text-right">
                      <button type="button" data-ms-apply="${multiState.lastCandidates.indexOf(c)}" class="ms-apply-candidate px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold">Bu Çizelgeyi Uygula</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      : '';

    const relaxHtml = multiState.lastRelaxations && multiState.lastRelaxations.length
      ? `<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900"><strong>Otomatik Kurtarma Raporu:</strong> ${multiState.lastRelaxations.join(' · ')}</div>`
      : '';

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Akıllı Dağıtım Kuralları</h3>
            <p class="text-xs text-slate-500 mt-0.5">Sistem okul büyüklüğüne göre en uygun motorları otomatik çalıştırır; siz yalnızca okulunuzun pedagojik kurallarını belirleyin.</p>
          </div>
          <div class="flex items-center gap-2">
            ${autoBadge}
            <button id="btnMsToggleAdvanced" type="button" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 transition">
              ${multiState.showAdvanced ? 'Gelişmiş Ayarları Gizle ▲' : 'Gelişmiş Motor Ayarları ▼'}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label class="block text-xs font-semibold text-slate-700 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            Aynı Öğretmen + Aynı Sınıf Farklı Ders Kuralı
            <span class="block text-[10px] font-normal text-slate-500 mt-0.5">Kendi branşı + branş dışı dersi aynı gün aynı sınıfa koyma</span>
            <select id="msTcMultiCourseSelect" class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
              <option value="soft" ${multiState.sameTeacherClassMultiCourseMode === 'soft' ? 'selected' : ''}>Ayrı günlere yay (Önerilen)</option>
              <option value="hard" ${multiState.sameTeacherClassMultiCourseMode === 'hard' ? 'selected' : ''}>Aynı gün kesinlikle yasak</option>
              <option value="off" ${multiState.sameTeacherClassMultiCourseMode === 'off' ? 'selected' : ''}>Kapalı</option>
            </select>
          </label>

          <label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <input id="msAllowBlockAlt" type="checkbox" ${multiState.allowBlockAlternatives ? 'checked' : ''} class="mt-0.5 rounded border-slate-300 text-emerald-600 shrink-0" />
            <div>
              <div class="font-semibold text-slate-800">Otomatik Alternatif Bloklar</div>
              <div class="text-[10px] text-slate-500 mt-0.5">Kesin çözüm çıkmazsa 3–4 saatlik uzun blokları otomatik 2+1 / 2+2 alt bloklara bölerek dağıtımı kurtarır.</div>
            </div>
          </label>

          <label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer rounded-xl border border-amber-100 bg-amber-50/40 p-3">
            <input id="msAutoRelaxSoft" type="checkbox" ${multiState.autoRelaxSoftLimitsOnStuck ? 'checked' : ''} class="mt-0.5 rounded border-slate-300 text-amber-600 shrink-0" />
            <div>
              <div class="font-semibold text-slate-800">Akıllı Esnek Limit Kurtarma</div>
              <div class="text-[10px] text-slate-500 mt-0.5">Program kilitlenirse çakışma/kapalı saatleri bozmadan yalnızca öğretmen boşluk veya ardışık saat limitini +1 esneterek çözüm arar.</div>
            </div>
          </label>
        </div>

        ${relaxHtml}
        ${comparisonHtml}

        <div id="msAdvancedDrawer" class="${multiState.showAdvanced ? '' : 'hidden'} pt-3 border-t border-slate-200 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-bold text-slate-700">Gelişmiş Motor ve Süre Ayarları (Yalnızca uzman müdahalesi gerekirse değiştirin)</div>
            <button id="btnMsRefreshHealth" type="button" class="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700">Sağlık Kontrolünü Yenile</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label class="block text-xs font-semibold text-slate-700">
              Çalışma Modu
              <select id="msModeSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
                ${modeOptions.map(([v, l]) => `<option value="${v}" ${multiState.mode === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <label class="block text-xs font-semibold text-slate-700">
              Optimizasyon Süresi
              <select id="msTimeSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
                ${timeOptions.map(([v, l]) => `<option value="${v}" ${multiState.timePreset === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              ${multiState.timePreset === 'custom'
                ? `<input id="msCustomTimeInput" type="number" min="5" max="7200" value="${multiState.customTimeSec}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs" placeholder="Saniye" />`
                : ''}
            </label>
            <label class="block text-xs font-semibold text-slate-700">
              Performans Modu
              <select id="msPerfSelect" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
                <option value="low" ${multiState.performanceMode === 'low' ? 'selected' : ''}>Düşük</option>
                <option value="balanced" ${multiState.performanceMode === 'balanced' ? 'selected' : ''}>Dengeli (Önerilen)</option>
                <option value="high" ${multiState.performanceMode === 'high' ? 'selected' : ''}>Yüksek</option>
              </select>
            </label>
            <label class="block text-xs font-semibold text-slate-700">
              MiniZinc Arka Uç
              <select id="msMznBackend" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium">
                <option value="gecode" ${multiState.minizincBackend === 'gecode' ? 'selected' : ''}>Gecode 6.6</option>
                <option value="chuffed" ${multiState.minizincBackend === 'chuffed' ? 'selected' : ''}>Chuffed 0.14</option>
              </select>
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;

    const btnAdv = document.getElementById('btnMsToggleAdvanced');
    if (btnAdv) btnAdv.addEventListener('click', () => { multiState.showAdvanced = !multiState.showAdvanced; renderMultiSolverCenter(); });

    const btnRef = document.getElementById('btnMsRefreshHealth');
    if (btnRef) btnRef.addEventListener('click', refreshHealth);

    const tcMultiSel = document.getElementById('msTcMultiCourseSelect');
    if (tcMultiSel) tcMultiSel.addEventListener('change', (e) => { multiState.sameTeacherClassMultiCourseMode = e.target.value; });

    const blkChk = document.getElementById('msAllowBlockAlt');
    if (blkChk) blkChk.addEventListener('change', (e) => { multiState.allowBlockAlternatives = Boolean(e.target.checked); });

    const relChk = document.getElementById('msAutoRelaxSoft');
    if (relChk) relChk.addEventListener('change', (e) => { multiState.autoRelaxSoftLimitsOnStuck = Boolean(e.target.checked); });

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
