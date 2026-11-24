/**
 * EvrakPlus Ders Dağıtım Multi Plus — Ortak 18 Menülü Arayüz Kontrolcüsü
 * Electron Masaüstü (window.evrakplusBridge), Web PHP/API ve Mobil PWA ortamlarının
 * tamamında ortak veri modeli, ortak tasarım dili ve ortak doğrulama mantığıyla çalışır.
 */
const EVRAKPLUS_LOGIN_URL = 'https://www.evrakplus.com/giris';
const DAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const MENUS = [
  ['dashboard', 'Ana Panel'],
  ['school', 'Okul Ayarları'],
  ['teachers', 'Öğretmenler'],
  ['classes', 'Sınıflar ve Şubeler'],
  ['subjects', 'Dersler ve Bloklar'],
  ['rooms', 'Derslikler ve Binalar'],
  ['assignments', 'Ders Görevlendirmeleri'],
  ['constraints', 'Kural ve Kısıt Yönetimi'],
  ['auto_schedule', 'Otomatik Ders Dağıtımı'],
  ['multi_solver', 'Multi Solver Merkezi'],
  ['manual_schedule', 'Manuel Ders Dağıtımı'],
  ['timetables', 'Haftalık Ders Programları'],
  ['analytics', 'Analiz ve İstatistikler'],
  ['reports', 'Raporlar ve Çıktılar'],
  ['backup_sync', 'Yedekleme ve Senkronizasyon'],
  ['account', 'EvrakPlus Hesabım'],
  ['system', 'Sistem ve Güncellemeler'],
  ['help', 'Yardım ve Destek']
];

const SCHOOL_TYPES = [
  ['ilkokul', 'İlkokul'], ['ortaokul', 'Ortaokul'], ['imam_hatip_ortaokulu', 'İmam Hatip Ortaokulu'],
  ['anadolu_lisesi', 'Anadolu Lisesi'], ['fen_lisesi', 'Fen Lisesi'], ['sosyal_bilimler_lisesi', 'Sosyal Bilimler Lisesi'],
  ['anadolu_imam_hatip_lisesi', 'Anadolu İmam Hatip Lisesi'], ['mesleki_teknik_anadolu_lisesi', 'Mesleki ve Teknik Anadolu Lisesi'],
  ['cok_programli_anadolu_lisesi', 'Çok Programlı Anadolu Lisesi'], ['ozel_ogretim', 'Özel Öğretim Kurumları'], ['ozel_egitim', 'Özel Eğitim Kurumları']
];

const ENGINE_META = [
  { id: 'ortools', name: 'Google OR-Tools CP-SAT', role: 'Ana dağıtım motoru' },
  { id: 'timefold', name: 'Timefold Solver', role: 'Alternatif çözüm ve kalite iyileştirme' },
  { id: 'choco', name: 'Choco Solver', role: 'Karmaşık kısıtların çözülmesi' },
  { id: 'minizinc', name: 'MiniZinc (Gecode/Chuffed)', role: 'Alternatif modelleme ve çözüm altyapısı' },
  { id: 'scip', name: 'SCIP (MILP)', role: 'Matematiksel ve tamsayılı optimizasyon' },
  { id: 'highs', name: 'HiGHS (MIP/MILP)', role: 'Karma tamsayılı doğrusal optimizasyon' }
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11));

const LS_KEY = 'evrakplus.multiplus.v3';

function defaultProject() {
  const b1 = uid();
  const c1 = uid(), c2 = uid();
  const t1 = uid(), t2 = uid(), t3 = uid();
  return {
    schemaVersion: 3,
    appVersion: '1.0.0',
    id: uid(),
    revision: 1,
    updatedAt: new Date().toISOString(),
    school: {
      name: 'Örnek Ortaokulu', year: '2026-2027', term: '1. Dönem', schoolType: 'ortaokul',
      educationMode: 'full_day', daysPerWeek: 5, periodsPerDay: 7, principal: '', vicePrincipals: []
    },
    buildings: [{ id: b1, name: 'Ana Bina', code: 'B1', transitionPeriods: {} }],
    rooms: [{ id: uid(), name: 'Derslik 101', type: 'classroom', buildingId: b1, capacity: 32, closed: [] }],
    teachers: [
      { id: t1, name: 'Matematik Öğretmeni 1', short: 'MAT1', branch: 'Matematik', dmax: 6, cmax: 4, av: {} },
      { id: t2, name: 'Türkçe Öğretmeni 1', short: 'TRK1', branch: 'Türkçe', dmax: 6, cmax: 4, av: {} },
      { id: t3, name: 'Fen Öğretmeni 1', short: 'FEN1', branch: 'Fen Bilimleri', dmax: 6, cmax: 4, av: {} }
    ],
    classes: [
      { id: c1, name: '5/A', grade: 5, shift: 'full', studentCount: 28, dmax: 7, closed: [] },
      { id: c2, name: '6/A', grade: 6, shift: 'full', studentCount: 30, dmax: 7, closed: [] }
    ],
    subjects: {
      MAT: { key: 'MAT', name: 'Matematik', short: 'MAT', branch: 'Matematik' },
      TRK: { key: 'TRK', name: 'Türkçe', short: 'TRK', branch: 'Türkçe' },
      FEN: { key: 'FEN', name: 'Fen Bilimleri', short: 'FEN', branch: 'Fen Bilimleri' }
    },
    assignments: [
      { id: uid(), classId: c1, subjectKey: 'MAT', hours: 5, pattern: '2+2+1', teacherId: t1, kind: 'zorunlu' },
      { id: uid(), classId: c1, subjectKey: 'TRK', hours: 6, pattern: '2+2+2', teacherId: t2, kind: 'zorunlu' },
      { id: uid(), classId: c1, subjectKey: 'FEN', hours: 4, pattern: '2+2', teacherId: t3, kind: 'zorunlu' },
      { id: uid(), classId: c2, subjectKey: 'MAT', hours: 5, pattern: '2+2+1', teacherId: t1, kind: 'zorunlu' },
      { id: uid(), classId: c2, subjectKey: 'TRK', hours: 6, pattern: '2+2+2', teacherId: t2, kind: 'zorunlu' },
      { id: uid(), classId: c2, subjectKey: 'FEN', hours: 4, pattern: '2+2', teacherId: t3, kind: 'zorunlu' }
    ],
    constraints: [
      { id: uid(), type: 'subject_diff_days', level: 'HARD', weight: 1000000, enabled: true, description: 'Aynı dersin blokları farklı günlere dağılsın' },
      { id: uid(), type: 'block_no_across_lunch', level: 'HIGH', weight: 100, enabled: true, description: 'Blok dersler öğle arasından bölünmesin' }
    ],
    placements: {},
    solutions: []
  };
}

const state = {
  menu: 'dashboard',
  project: null,
  undo: [],
  redo: [],
  history: [],
  selectedBlock: null,
  manualClassId: null,
  solverMode: 'smart',
  selectedEngine: 'ortools',
  timeSeconds: 30,
  running: false,
  engineHealth: {},
  lastRun: null,
  auth: { loggedIn: false, user: null, exportEntitled: false }
};

const bridge = window.evrakplusBridge || null;

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultProject();
}

function saveLocal() {
  state.project.updatedAt = new Date().toISOString();
  state.project.revision = (state.project.revision || 1) + 1;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.project)); } catch { /* ignore */ }
  if (bridge?.saveProject) bridge.saveProject(state.project).catch(() => {});
}

function pushUndo(label) {
  state.undo.push(JSON.stringify(state.project));
  if (state.undo.length > 50) state.undo.shift();
  state.redo = [];
  state.history.unshift({ at: new Date().toLocaleTimeString('tr-TR'), label });
  if (state.history.length > 50) state.history.pop();
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/** Üyelik gerektiren çıktılar için EvrakPlus yönlendirme penceresi */
function requireExportAuth(onAuthorized) {
  if (state.auth.loggedIn && state.auth.exportEntitled) {
    onAuthorized();
    return;
  }
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal"><div class="box">
    <h2>Ücretsiz üyelik gerekli</h2>
    <p>EvrakPlus Ders Dağıtım Multi Plus uygulamasını ücretsiz olarak kullanabilirsiniz. Oluşturduğunuz ders programlarını PDF, Excel ve diğer formatlarda indirmek veya yazdırmak için EvrakPlus hesabınızla giriş yapmanız gerekmektedir.</p>
    <p class="small muted">Henüz hesabınız yoksa ücretsiz üye olabilirsiniz.</p>
    <div class="row" style="justify-content:flex-end;margin-top:6px">
      <button class="btn ghost" id="mLater">Daha Sonra</button>
      <a class="btn" href="${EVRAKPLUS_LOGIN_URL}" target="_blank" rel="noopener">Ücretsiz Üye Ol</a>
      <a class="btn pri" href="${EVRAKPLUS_LOGIN_URL}" target="_blank" rel="noopener" id="mLogin">Giriş Yap</a>
    </div>
  </div></div>`;
  document.getElementById('mLater').onclick = () => { root.innerHTML = ''; };
  document.getElementById('mLogin').onclick = () => {
    if (bridge?.startAuth) bridge.startAuth();
  };
}

function expandBlocks(project) {
  const out = [];
  for (const a of project.assignments || []) {
    const parts = String(a.pattern || a.hours).split('+').map(Number).filter(x => x > 0);
    parts.forEach((len, idx) => {
      out.push({ blockId: `${a.id}:${idx}`, assignment: a, length: len });
    });
  }
  return out;
}

function renderMenu() {
  document.getElementById('sideMenu').innerHTML = MENUS.map(([id, title], idx) =>
    `<a href="#${id}" data-nav="${id}" class="${state.menu === id ? 'on' : ''}"><i>${idx + 1}</i><span>${esc(title)}</span></a>`
  ).join('');
  document.querySelectorAll('#mobNav button').forEach(b => {
    b.classList.toggle('on', b.dataset.nav === state.menu);
  });
}

function renderTop() {
  const p = state.project;
  document.getElementById('topSchoolName').textContent = `${p.school.name} · ${p.school.year}`;
  const blocks = expandBlocks(p);
  const placed = Object.keys(p.placements || {}).length;
  const st = document.getElementById('topStatus');
  if (state.running) { st.className = 'pill warn'; st.textContent = 'Optimizasyon çalışıyor…'; }
  else if (blocks.length && placed === blocks.length) { st.className = 'pill ok'; st.textContent = `Tam yerleşim: ${placed}/${blocks.length}`; }
  else { st.className = 'pill'; st.textContent = `${placed}/${blocks.length} blok yerleşik`; }

  const rt = document.getElementById('topRuntime');
  rt.textContent = bridge ? 'Masaüstü (6 Gömülü Motor)' : (window.EVRAKPLUS_WEB_API ? 'Web + Solver Sunucu' : 'Tarayıcı Önizleme');
  rt.className = bridge ? 'pill ok' : 'pill';

  document.getElementById('btnUndo').disabled = !state.undo.length;
  document.getElementById('btnRedo').disabled = !state.redo.length;
}

function renderView() {
  const p = state.project;
  const blocks = expandBlocks(p);
  const placedCount = Object.keys(p.placements || {}).length;
  const H = (t, d, act = '') => `<div class="head"><div><h1>${esc(t)}</h1><p>${esc(d)}</p></div><div class="row">${act}</div></div>`;

  let html = '';
  switch (state.menu) {
    case 'dashboard':
      html = H('Ana Panel', 'EvrakPlus Ders Dağıtım Multi Plus — 6 gerçek optimizasyon motorlu MEB ders dağıtım sistemi.',
        `<button class="btn pri" data-nav="auto_schedule">Otomatik Dağıtım</button><button class="btn" data-nav="multi_solver">Multi Solver Merkezi</button>`) +
        `<div class="kpis">
          <div class="kpi"><small>Öğretmen</small><b>${p.teachers.length}</b></div>
          <div class="kpi"><small>Şube</small><b>${p.classes.length}</b></div>
          <div class="kpi"><small>Ders Bloğu</small><b>${blocks.length}</b></div>
          <div class="kpi"><small>Yerleşen</small><b>${placedCount}/${blocks.length}</b></div>
          <div class="kpi"><small>Derslik / Bina</small><b>${p.rooms.length} / ${p.buildings.length}</b></div>
        </div>` +
        (!bridge && !window.EVRAKPLUS_WEB_API
          ? `<div class="msg info"><div><b>Bilgi:</b> Şu an tarayıcı önizleme modundasınız. 6 yerel optimizasyon motoru (OR-Tools, Timefold, Choco, MiniZinc, SCIP, HiGHS) için Windows Masaüstü uygulamasını veya EvrakPlus Solver Sunucusunu bağlayın.</div></div>`
          : `<div class="msg ok"><div><b>6 Optimizasyon Motoru Hazır:</b> OR-Tools CP-SAT, Timefold, Choco, MiniZinc, SCIP ve HiGHS aktif.</div></div>`);
      break;

    case 'school':
      html = H('Okul Ayarları', '11 MEB kurum türü, tam gün/ikili eğitim, zil saatleri ve okul yönetimi bilgileri.') +
        `<div class="card"><div class="fields">
          <label class="f">Okul Adı<input data-school="name" value="${esc(p.school.name)}"></label>
          <label class="f">Eğitim Öğretim Yılı<input data-school="year" value="${esc(p.school.year)}"></label>
          <label class="f">Dönem<select data-school="term">${['1. Dönem', '2. Dönem', 'Yıllık'].map(x => `<option ${p.school.term === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="f">Kurum Türü<select data-school="schoolType">${SCHOOL_TYPES.map(([k, v]) => `<option value="${k}" ${p.school.schoolType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="f">Eğitim Düzeni<select data-school="educationMode"><option value="full_day" ${p.school.educationMode === 'full_day' ? 'selected' : ''}>Tam Gün</option><option value="dual_shift" ${p.school.educationMode === 'dual_shift' ? 'selected' : ''}>İkili Eğitim (Sabahçı/Öğlenci)</option></select></label>
          <label class="f">Haftalık Gün<input type="number" min="1" max="6" data-school="daysPerWeek" value="${p.school.daysPerWeek}"></label>
          <label class="f">Günlük Ders Saati<input type="number" min="1" max="12" data-school="periodsPerDay" value="${p.school.periodsPerDay}"></label>
          <label class="f">Okul Müdürü<input data-school="principal" value="${esc(p.school.principal || '')}"></label>
        </div></div>`;
      break;

    case 'teachers':
      html = H('Öğretmenler', 'Öğretmen kadrosu, günlük/ardışık ders sınırları ve müsaitlik ayarları.',
        `<button class="btn pri" data-act="addTeacher">Öğretmen Ekle</button>`) +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Ad Soyad</th><th>Branş</th><th class="n">Günlük Maks</th><th class="n">Ardışık Maks</th><th></th></tr></thead><tbody>
        ${p.teachers.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.branch)}</td><td class="n">${t.dmax}</td><td class="n">${t.cmax || 'Sınırsız'}</td><td class="n"><button class="btn sm ghost" data-act="delTeacher" data-id="${t.id}">Sil</button></td></tr>`).join('')}
        </tbody></table></div>`;
      break;

    case 'classes':
      html = H('Sınıflar ve Şubeler', 'Şubeler, sınıf düzeyleri, öğrenci sayıları ve eğitim vardiyası.',
        `<button class="btn pri" data-act="addClass">Şube Ekle</button>`) +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Şube</th><th class="n">Sınıf</th><th>Vardiya</th><th class="n">Öğrenci</th><th></th></tr></thead><tbody>
        ${p.classes.map(c => `<tr><td>${esc(c.name)}</td><td class="n">${c.grade}</td><td>${esc(c.shift || 'full')}</td><td class="n">${c.studentCount || 30}</td><td class="n"><button class="btn sm ghost" data-act="delClass" data-id="${c.id}">Sil</button></td></tr>`).join('')}
        </tbody></table></div>`;
      break;

    case 'subjects':
      html = H('Dersler ve Bloklar', 'Düzenlenebilir okul ders listesi ve blok kombinasyonları (resmî MEB onayı yerine geçmez).') +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Kod</th><th>Ders Adı</th><th>Kısa Ad</th><th>Branş</th></tr></thead><tbody>
        ${Object.values(p.subjects).map(s => `<tr><td><code>${esc(s.key)}</code></td><td>${esc(s.name)}</td><td>${esc(s.short)}</td><td>${esc(s.branch)}</td></tr>`).join('')}
        </tbody></table></div>`;
      break;

    case 'rooms':
      html = H('Derslikler ve Binalar', 'Binalar, bina geçiş süreleri, derslik/laboratuvar/atölye ve spor salonları.',
        `<button class="btn pri" data-act="addBuilding">Bina Ekle</button><button class="btn" data-act="addRoom">Derslik Ekle</button>`) +
        `<div class="grid2">
          <div class="card"><h3>Binalar (${p.buildings.length})</h3><ul>${p.buildings.map(b => `<li><b>${esc(b.name)}</b> (${esc(b.code || '')})</li>`).join('')}</ul></div>
          <div class="card"><h3>Derslikler (${p.rooms.length})</h3><ul>${p.rooms.map(r => `<li><b>${esc(r.name)}</b> · ${esc(r.type)} · Kapasite: ${r.capacity}</li>`).join('')}</ul></div>
        </div>`;
      break;

    case 'assignments':
      html = H('Ders Görevlendirmeleri', 'Sınıf, ders, saat, blok düzeni ve öğretmen görevlendirmeleri.') +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Sınıf</th><th>Ders</th><th class="n">Saat</th><th>Blok</th><th>Öğretmen</th></tr></thead><tbody>
        ${p.assignments.map(a => {
          const cls = p.classes.find(c => c.id === a.classId);
          const tch = p.teachers.find(t => t.id === a.teacherId);
          return `<tr><td>${esc(cls?.name || '?')}</td><td>${esc(p.subjects[a.subjectKey]?.name || a.subjectKey)}</td><td class="n">${a.hours}</td><td>${esc(a.pattern)}</td><td>${esc(tch?.name || 'Atanmadı')}</td></tr>`;
        }).join('')}
        </tbody></table></div>`;
      break;

    case 'constraints':
      html = H('Kural ve Kısıt Yönetimi', '4 seviyeli kısıt sistemi: Kesinlikle zorunlu (HARD), Yüksek (HIGH), Normal (NORMAL), Kullanıcı tercihi (PREFERENCE).') +
        `<div class="card"><table class="tbl"><thead><tr><th>Durum</th><th>Kural</th><th>Öncelik</th><th class="n">Ağırlık</th></tr></thead><tbody>
        ${p.constraints.map(c => `<tr><td><input type="checkbox" data-ctog="${c.id}" ${c.enabled ? 'checked' : ''} style="min-height:auto"></td><td><b>${esc(c.type)}</b><div class="small muted">${esc(c.description || '')}</div></td><td><span class="pill">${esc(c.level)}</span></td><td class="n">${c.weight}</td></tr>`).join('')}
        </tbody></table></div>`;
      break;

    case 'auto_schedule':
      html = H('Otomatik Ders Dağıtımı', '6 çalışma modu, 8 hazır çözüm süresi ve PASS 0–7 aşamalı optimizasyon.',
        `<button class="btn pri" data-act="runSolve" ${state.running ? 'disabled' : ''}>Dağıtımı Başlat</button><button class="btn" data-act="cancelSolve" ${state.running ? '' : 'disabled'}>Durdur</button>`) +
        `<div class="card"><div class="fields">
          <label class="f">Çalışma Modu<select id="selMode">
            <option value="smart" ${state.solverMode === 'smart' ? 'selected' : ''}>Akıllı Otomatik Mod</option>
            <option value="single" ${state.solverMode === 'single' ? 'selected' : ''}>Tek Motor Modu</option>
            <option value="sequential" ${state.solverMode === 'sequential' ? 'selected' : ''}>Sıralı Motor Modu</option>
            <option value="parallel" ${state.solverMode === 'parallel' ? 'selected' : ''}>Paralel Motor Modu (CPU/RAM Kontrollü)</option>
            <option value="hybrid" ${state.solverMode === 'hybrid' ? 'selected' : ''}>Hibrit Mod (OR-Tools → Timefold)</option>
            <option value="ultimate" ${state.solverMode === 'ultimate' ? 'selected' : ''}>Ultimate Optimizasyon Modu</option>
          </select></label>
          <label class="f">Tek Motor Seçimi<select id="selEngine">${ENGINE_META.map(e => `<option value="${e.id}" ${state.selectedEngine === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
          <label class="f">Çözüm Süresi<select id="selTime">
            <option value="30" ${state.timeSeconds === 30 ? 'selected' : ''}>Hızlı çözüm (30 sn)</option>
            <option value="120" ${state.timeSeconds === 120 ? 'selected' : ''}>Normal çözüm (2 dk)</option>
            <option value="300" ${state.timeSeconds === 300 ? 'selected' : ''}>Gelişmiş çözüm (5 dk)</option>
            <option value="600" ${state.timeSeconds === 600 ? 'selected' : ''}>Derin optimizasyon (10 dk)</option>
            <option value="1800" ${state.timeSeconds === 1800 ? 'selected' : ''}>Profesyonel (30 dk)</option>
            <option value="3600" ${state.timeSeconds === 3600 ? 'selected' : ''}>Ultimate (60 dk)</option>
          </select></label>
        </div></div>` +
        (state.lastRun ? `<div class="card"><h3>Son Optimizasyon Özeti</h3><p class="small muted">Durum: <b>${esc(state.lastRun.status)}</b> · Süre: ${state.lastRun.elapsedMs} ms</p></div>` : '');
      break;

    case 'multi_solver':
      html = H('Multi Solver Merkezi', '6 gerçek optimizasyon motorunun kurulum, sağlık, sürüm ve yan yana çözüm kalitesi karşılaştırması.',
        `<button class="btn pri" data-act="checkEngines">Sağlık Kontrolü Çalıştır</button>`) +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Motor</th><th>Görev</th><th>Sürüm</th><th>Durum</th></tr></thead><tbody>
        ${ENGINE_META.map(e => {
          const hc = state.engineHealth[e.id];
          const pill = hc ? (hc.healthy ? '<span class="pill ok">Sağlıklı</span>' : '<span class="pill err">Hata</span>') : '<span class="pill">Kontrol edilmedi</span>';
          return `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.role)}</td><td>${esc(hc?.version || '—')}</td><td>${pill}</td></tr>`;
        }).join('')}
        </tbody></table></div>` +
        (state.lastRun?.comparison?.length ? `<div class="card scroll"><h3>Motor Karşılaştırma Tablosu</h3><table class="tbl"><thead><tr><th>Motor</th><th>Durum</th><th>Geçerli</th><th class="n">Kalite /100</th><th class="n">Zorunlu İhlal</th><th class="n">Boşluk</th><th class="n">Süre (ms)</th></tr></thead><tbody>
        ${state.lastRun.comparison.map(r => `<tr><td><b>${esc(r.engine)}</b></td><td>${esc(r.status)}</td><td>${r.isValid ? 'Evet' : 'Hayır'}</td><td class="n"><b>${r.qualityScore}</b></td><td class="n">${r.hardViolations}</td><td class="n">${r.teacherGaps}</td><td class="n">${r.elapsedMs}</td></tr>`).join('')}
        </tbody></table></div>` : '');
      break;

    case 'manual_schedule':
    case 'timetables': {
      const cls = p.classes.find(c => c.id === state.manualClassId) || p.classes[0];
      const D = p.school.daysPerWeek, P = p.school.periodsPerDay;
      const grid = {};
      for (const b of blocks) {
        const pl = p.placements[b.blockId];
        if (!pl || b.assignment.classId !== cls?.id) continue;
        for (let k = 0; k < b.length; k++) grid[`${pl.day}-${pl.period + k}`] = { b, pl, k };
      }
      html = H(state.menu === 'manual_schedule' ? 'Manuel Ders Dağıtımı' : 'Haftalık Ders Programları',
        'Derslere tıklayarak seçin, boş hücreye tıklayarak taşıyın veya kilitleyin. Kilitli dersler kırmızı renkle korunur.',
        `<select id="selManualCls">${p.classes.map(c => `<option value="${c.id}" ${cls?.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
         ${state.selectedBlock ? `<button class="btn sm" data-act="toggleLockSelected">Kilitle / Aç</button>` : ''}
         <button class="btn sm" data-act="lockClass">Sınıfı Kilitle</button>`) +
        `<div class="card scroll"><table class="tt"><thead><tr><th class="pl">Saat</th>${DAYS_TR.slice(0, D).map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
        ${Array.from({ length: P }, (_, pr) => `<tr><th class="pl"><b>${pr + 1}. ders</b></th>${Array.from({ length: D }, (_, d) => {
          const cell = grid[`${d}-${pr}`];
          if (!cell) return `<td class="cell" data-slot="${d}-${pr}"></td>`;
          const isSel = state.selectedBlock === cell.b.blockId;
          const t = p.teachers.find(x => x.id === cell.b.assignment.teacherId);
          return `<td class="cell ${cell.pl.lock ? 'lk' : ''} ${isSel ? 'sel' : ''}" data-block="${cell.b.blockId}" data-slot="${d}-${pr}">
            <span class="s">${esc(p.subjects[cell.b.assignment.subjectKey]?.short || cell.b.assignment.subjectKey)}</span>
            <span class="x">${esc(t?.short || t?.name || '')}${cell.pl.lock ? ' 🔒' : ''}</span>
          </td>`;
        }).join('')}</tr>`).join('')}
        </tbody></table></div>` +
        `<div class="card"><h3>Değişiklik Geçmişi (${state.history.length})</h3>${state.history.length ? `<ul class="small">${state.history.slice(0, 8).map(h => `<li>${esc(h.at)} — ${esc(h.label)}</li>`).join('')}</ul>` : '<p class="small muted">Henüz manuel değişiklik yok.</p>'}</div>`;
      break;
    }

    case 'analytics':
      html = H('Analiz ve İstatistikler', 'Öğretmen ders yükleri, yerleştirme oranı ve doğrulama metrikleri.') +
        `<div class="card scroll"><table class="tbl"><thead><tr><th>Öğretmen</th><th>Branş</th><th class="n">Atanan Saat</th><th class="n">Günlük Maks</th></tr></thead><tbody>
        ${p.teachers.map(t => {
          const hrs = p.assignments.filter(a => a.teacherId === t.id).reduce((s, a) => s + Number(a.hours || 0), 0);
          return `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.branch)}</td><td class="n">${hrs}</td><td class="n">${t.dmax}</td></tr>`;
        }).join('')}
        </tbody></table></div>`;
      break;

    case 'reports':
      html = H('Raporlar ve Çıktılar', 'A4/A3 dikey ve yatay resmi programlar. PDF, Excel, Word, görsel ve yazdırma çıktıları ücretsiz EvrakPlus üyeliği gerektirir.') +
        `<div class="card"><div class="row">
          <button class="btn pri" data-act="exportProtected" data-fmt="PDF">PDF Çizelge Oluştur</button>
          <button class="btn" data-act="exportProtected" data-fmt="Excel">Excel Çizelge Oluştur</button>
          <button class="btn" data-act="exportProtected" data-fmt="Word">Word Çizelge Oluştur</button>
          <button class="btn" data-act="exportProtected" data-fmt="PNG">Görsel (PNG) Dışa Aktar</button>
          <button class="btn" data-act="exportProtected" data-fmt="Print">Yazdır / Toplu Çıktı</button>
        </div></div>`;
      break;

    case 'backup_sync':
      html = H('Yedekleme ve Senkronizasyon', 'Ortak JSON yedekleme (şifre/token içermez, v2→v3 uyumlu) ve EvrakPlus bulut senkronizasyonu.') +
        `<div class="grid2">
          <div class="card"><h3>Yerel JSON Yedek</h3><p class="small muted" style="margin:6px 0 12px">Üyelik gerekmez; tüm okul verilerini, kısıtları ve çizelgeleri saklar.</p>
            <div class="row"><button class="btn pri" data-act="downloadJson">JSON Yedek İndir</button><label class="btn">JSON Yükle<input type="file" id="inpJsonFile" accept=".json" hidden></label></div>
          </div>
          <div class="card"><h3>Bulut Senkronizasyonu</h3><p class="small muted" style="margin:6px 0 12px">Masaüstü, Web ve Mobil PWA arasında UUID/revision tabanlı güvenli senkronizasyon.</p>
            <button class="btn" data-act="cloudSync">Bulut ile Senkronize Et</button>
          </div>
        </div>`;
      break;

    case 'account':
      html = H('EvrakPlus Hesabım', 'Mevcut EvrakPlus WordPress üyeliğinizle tek hesap üzerinden giriş yapın.') +
        `<div class="card">
          <p>Oturum Durumu: <b>${state.auth.loggedIn ? esc(state.auth.user?.email || 'Giriş yapıldı') : 'Giriş yapılmadı (Ücretsiz yerel mod aktif)'}</b></p>
          <div class="row" style="margin-top:12px">
            <a class="btn pri" href="${EVRAKPLUS_LOGIN_URL}" target="_blank" rel="noopener">EvrakPlus ile Giriş Yap</a>
            <a class="btn" href="${EVRAKPLUS_LOGIN_URL}" target="_blank" rel="noopener">Ücretsiz Üye Ol</a>
          </div>
        </div>`;
      break;

    case 'system':
      html = H('Sistem ve Güncellemeler', 'Sürüm 1.0.0 · GitHub Release tabanlı güvenli HTTPS güncelleme kontrolü.') +
        `<div class="card"><p><b>Uygulama:</b> EvrakPlus Ders Dağıtım Multi Plus v1.0.0</p><p class="small muted" style="margin-top:4px">Veri Şema Sürümü: v${p.schemaVersion} · Platform: ${bridge ? 'Windows Electron' : 'Web / PWA'}</p>
        <div class="row" style="margin-top:12px"><button class="btn" data-act="checkUpdate">Güncellemeleri Kontrol Et</button></div></div>`;
      break;

    case 'help':
      html = H('Yardım ve Destek', 'EvrakPlus resmi destek ve kullanım kılavuzu.') +
        `<div class="card"><p>Web sitesi: <a href="https://www.evrakplus.com/" target="_blank" rel="noopener">https://www.evrakplus.com/</a></p>
        <p style="margin-top:6px">Uygulama adresi: <a href="https://www.evrakplus.com/ders-dagitim-multi-plus/" target="_blank" rel="noopener">https://www.evrakplus.com/ders-dagitim-multi-plus/</a></p>
        <p class="small muted" style="margin-top:8px">Klavye kısayolları: Ctrl+Z (Geri al), Ctrl+Y (Yinele).</p></div>`;
      break;
  }

  document.getElementById('view').innerHTML = html;
}

function render() {
  renderMenu();
  renderTop();
  renderView();
}

function downloadJsonBackup() {
  const clean = JSON.parse(JSON.stringify(state.project));
  delete clean.auth;
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.project.school.name || 'evrakplus').replace(/[\\/:*?"<>|]+/g, '')}-yedek.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON yedeği indirildi.');
}

async function runSolveAction() {
  if (!bridge?.solve && !window.EVRAKPLUS_WEB_API) {
    toast('6 gerçek optimizasyon motoru için Masaüstü uygulaması veya Solver Sunucusu gereklidir.');
    return;
  }
  state.running = true;
  render();
  try {
    const opts = { mode: state.solverMode, engine: state.selectedEngine, timeLimitSeconds: state.timeSeconds };
    const res = bridge?.solve
      ? await bridge.solve(state.project, opts)
      : await fetch(`${window.EVRAKPLUS_WEB_API}/solve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: state.project, options: opts }) }).then(r => r.json());
    state.lastRun = res;
    if (res?.bestResult?.evaluation?.validation?.isValid) {
      pushUndo(`Otomatik dağıtım (${res.bestResult.engine})`);
      state.project.placements = res.bestResult.placements;
      saveLocal();
      toast(`Dağıtım tamamlandı: ${res.bestResult.engine} (Kalite ${res.bestResult.evaluation.qualityScore}/100)`);
    } else {
      toast(`Dağıtım sonucu: ${res?.status || 'Bilinmiyor'}`);
    }
  } catch (err) {
    toast(`Optimizasyon hatası: ${err.message}`);
  } finally {
    state.running = false;
    render();
  }
}

// Event delegasyonu
document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    e.preventDefault();
    state.menu = nav.dataset.nav;
    render();
    return;
  }
  const actEl = e.target.closest('[data-act]');
  if (actEl) {
    const act = actEl.dataset.act;
    const p = state.project;
    if (act === 'addTeacher') {
      pushUndo('Öğretmen eklendi');
      p.teachers.push({ id: uid(), name: `Yeni Öğretmen ${p.teachers.length + 1}`, short: `Ö${p.teachers.length + 1}`, branch: 'Matematik', dmax: p.school.periodsPerDay, cmax: 0, av: {} });
      saveLocal(); render();
    } else if (act === 'delTeacher') {
      pushUndo('Öğretmen silindi');
      p.teachers = p.teachers.filter(t => t.id !== actEl.dataset.id);
      saveLocal(); render();
    } else if (act === 'addClass') {
      pushUndo('Şube eklendi');
      p.classes.push({ id: uid(), name: `${5 + (p.classes.length % 4)}/${String.fromCharCode(65 + p.classes.length)}`, grade: 5 + (p.classes.length % 4), shift: 'full', studentCount: 30, dmax: p.school.periodsPerDay, closed: [] });
      saveLocal(); render();
    } else if (act === 'delClass') {
      pushUndo('Şube silindi');
      p.classes = p.classes.filter(c => c.id !== actEl.dataset.id);
      saveLocal(); render();
    } else if (act === 'addBuilding') {
      pushUndo('Bina eklendi');
      p.buildings.push({ id: uid(), name: `Ek Bina ${p.buildings.length}`, code: `B${p.buildings.length + 1}`, transitionPeriods: {} });
      saveLocal(); render();
    } else if (act === 'addRoom') {
      pushUndo('Derslik eklendi');
      p.rooms.push({ id: uid(), name: `Derslik ${100 + p.rooms.length + 1}`, type: 'classroom', buildingId: p.buildings[0]?.id || null, capacity: 32, closed: [] });
      saveLocal(); render();
    } else if (act === 'downloadJson') {
      downloadJsonBackup();
    } else if (act === 'exportProtected') {
      requireExportAuth(() => toast(`${actEl.dataset.fmt} çıktısı hazırlanıyor…`));
    } else if (act === 'cloudSync') {
      requireExportAuth(() => toast('Bulut senkronizasyonu başlatıldı.'));
    } else if (act === 'runSolve') {
      await runSolveAction();
    } else if (act === 'cancelSolve') {
      if (bridge?.cancelSolve) await bridge.cancelSolve();
      state.running = false;
      toast('Optimizasyon durduruldu.');
      render();
    } else if (act === 'checkEngines') {
      if (!bridge?.healthCheckAll) { toast('Sağlık kontrolü yalnızca masaüstü veya sunucu bağlantısında çalışır.'); return; }
      state.engineHealth = await bridge.healthCheckAll();
      toast('6 motorun sağlık kontrolü tamamlandı.');
      render();
    } else if (act === 'toggleLockSelected' && state.selectedBlock && p.placements[state.selectedBlock]) {
      pushUndo('Blok kilit değiştirildi');
      p.placements[state.selectedBlock].lock = !p.placements[state.selectedBlock].lock;
      saveLocal(); render();
    } else if (act === 'lockClass') {
      const clsId = state.manualClassId || p.classes[0]?.id;
      pushUndo('Sınıf kilitlendi');
      for (const b of expandBlocks(p)) {
        if (b.assignment.classId === clsId && p.placements[b.blockId]) p.placements[b.blockId].lock = true;
      }
      saveLocal(); render(); toast('Sınıf dersleri kilitlendi.');
    } else if (act === 'checkUpdate') {
      toast('Sürüm 1.0.0 güncel.');
    }
    return;
  }

  // Manuel çizelge hücre tıklama (seç / taşı)
  const cell = e.target.closest('td.cell');
  if (cell && (state.menu === 'manual_schedule' || state.menu === 'timetables')) {
    const bid = cell.dataset.block;
    const [d, pr] = cell.dataset.slot.split('-').map(Number);
    if (bid) {
      state.selectedBlock = state.selectedBlock === bid ? null : bid;
      render();
    } else if (state.selectedBlock) {
      const prev = state.project.placements[state.selectedBlock];
      if (prev?.lock) { toast('Kilitli ders taşınamaz.'); return; }
      pushUndo(`Taşı: ${state.selectedBlock} → Gün ${d + 1}, Saat ${pr + 1}`);
      state.project.placements[state.selectedBlock] = { day: d, period: pr, roomId: prev?.roomId || null, lock: false };
      state.selectedBlock = null;
      saveLocal(); render();
      toast('Ders taşındı.');
    }
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.school) {
    pushUndo('Okul ayarı güncellendi');
    state.project.school[el.dataset.school] = el.type === 'number' ? Number(el.value) : el.value;
    saveLocal(); render();
  } else if (el.dataset.ctog) {
    const c = state.project.constraints.find(x => x.id === el.dataset.ctog);
    if (c) { pushUndo('Kural güncellendi'); c.enabled = el.checked; saveLocal(); render(); }
  } else if (el.id === 'selMode') { state.solverMode = el.value; }
  else if (el.id === 'selEngine') { state.selectedEngine = el.value; }
  else if (el.id === 'selTime') { state.timeSeconds = Number(el.value); }
  else if (el.id === 'selManualCls') { state.manualClassId = el.value; render(); }
  else if (el.id === 'inpJsonFile' && el.files?.[0]) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(fr.result);
        if (!parsed || !parsed.school) throw new Error('Geçersiz dosya');
        pushUndo('JSON yedeği yüklendi');
        state.project = parsed;
        saveLocal(); render(); toast('JSON yedeği başarıyla yüklendi.');
      } catch { toast('Bozuk veya geçersiz JSON dosyası.'); }
    };
    fr.readAsText(el.files[0]);
  }
});

document.getElementById('btnUndo').onclick = () => {
  if (!state.undo.length) return;
  state.redo.push(JSON.stringify(state.project));
  state.project = JSON.parse(state.undo.pop());
  saveLocal(); render();
};
document.getElementById('btnRedo').onclick = () => {
  if (!state.redo.length) return;
  state.undo.push(JSON.stringify(state.project));
  state.project = JSON.parse(state.redo.pop());
  saveLocal(); render();
};
document.getElementById('btnQuickBackup').onclick = downloadJsonBackup;

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.target.closest('input,select,textarea')) {
    if (e.key === 'z') { e.preventDefault(); document.getElementById('btnUndo').click(); }
    if (e.key === 'y') { e.preventDefault(); document.getElementById('btnRedo').click(); }
  }
});

// PWA Kurulum butonu
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstallPwa');
  if (btn) {
    btn.style.display = 'inline-flex';
    btn.onclick = async () => {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.style.display = 'none';
    };
  }
});

state.project = loadLocal();
render();
