/**
 * EvrakPlus Ders Dağıtım Multi Plus — Okul Kulüpleri Modülü (clubs_module.js)
 * 32 varsayılan MEB okul kulübü, manuel kulüp ekleme/silme ve öğretmen kulüp atama yardımcıları.
 */
(function (global) {
  'use strict';

  const DEFAULT_SCHOOL_CLUBS = [
    'Kültür ve Edebiyat Kulübü',
    'Yayın ve İletişim Kulübü',
    'Müzik Kulübü',
    'Resim/Görsel Sanatlar Kulübü',
    'Bilişim ve İnternet Kulübü',
    'Halk Oyunları Kulübü',
    'Tiyatro Kulübü',
    'Kütüphanecilik Kulübü',
    'Sivil Savunma Kulübü',
    'Gezi, Tanıtma ve Turizm Kulübü',
    'Çevre Koruma Kulübü',
    'Satranç Kulübü',
    'Hayvanları Sevme ve Koruma Kulübü',
    'Sosyal Dayanışma ve Yardımlaşma, Çocuk Esirgeme, Kızılay ve Benzeri Kulüpler',
    'Sağlık, Temizlik, Beslenme ve Yeşilay Kulübü',
    'Spor Kulübü',
    'Havacılık Kulübü',
    'Bilim-Fen ve Teknoloji Kulübü',
    'Fotoğrafçılık Kulübü',
    'Trafik Güvenliği ve İlkyardım Kulübü',
    'Kültür ve Tabiat Varlıklarını Koruma ve Okul Müzesi Kulübü',
    'İzcilik Kulübü',
    'Bilinçli Tüketici Kulübü',
    'Kooperatifçilik Kulübü',
    'Meslek Tanıtma Kulübü',
    'Demokrasi, İnsan Hakları ve Yurttaşlık Kulübü',
    'Engellilerle Dayanışma Kulübü',
    'Yeşili Koruma Kulübü',
    'Çocuk Hakları Kulübü',
    'Felsefe veya Düşünce Eğitimi Kulübü',
    'Denizcilik Kulübü',
    'Pulculuk Kulübü'
  ];

  function escapeHtmlLocal(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSchoolClubs(state) {
    if (!state) return DEFAULT_SCHOOL_CLUBS.slice();
    if (!Array.isArray(state.schoolClubs)) {
      state.schoolClubs = DEFAULT_SCHOOL_CLUBS.slice();
    }
    return state.schoolClubs;
  }

  function addSchoolClub(state, clubName) {
    const clean = String(clubName || '').replace(/\s+/g, ' ').trim();
    if (!clean) return { ok: false, error: 'Kulüp adı boş olamaz.' };
    const list = getSchoolClubs(state);
    const exists = list.some((c) => c.toLocaleLowerCase('tr-TR') === clean.toLocaleLowerCase('tr-TR'));
    if (exists) return { ok: false, error: 'Bu kulüp zaten listede var.' };
    list.push(clean);
    return { ok: true, name: clean, count: list.length };
  }

  function removeSchoolClub(state, clubName) {
    const target = String(clubName || '').trim();
    const list = getSchoolClubs(state);
    const idx = list.indexOf(target);
    if (idx < 0) return { ok: false, error: 'Kulüp bulunamadı.' };
    list.splice(idx, 1);
    // Bu kulübe atanmış öğretmenlerden de temizle
    const tMap = state && state.teachersBySchool ? state.teachersBySchool : {};
    Object.values(tMap).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        if (t && t.club === target) t.club = '';
      });
    });
    return { ok: true, removed: target, count: list.length };
  }

  function resetDefaultSchoolClubs(state) {
    if (!state) return DEFAULT_SCHOOL_CLUBS.slice();
    const existing = getSchoolClubs(state);
    DEFAULT_SCHOOL_CLUBS.forEach((c) => {
      if (!existing.some((x) => x.toLocaleLowerCase('tr-TR') === c.toLocaleLowerCase('tr-TR'))) {
        existing.push(c);
      }
    });
    return existing;
  }

  function renderClubManagerPanel(container, state, onChange) {
    if (!container) return;
    const clubs = getSchoolClubs(state);
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Okul Kulüpleri Yönetimi (${clubs.length} kulüp)</h3>
            <p class="text-xs text-slate-500">Yeni kulüp ekleyebilir veya kullanmadığınız kulüpleri silebilirsiniz. Öğretmen detayından kulüp atayabilirsiniz.</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnResetDefaultClubs" type="button" class="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700">Varsayılan 32 Kulübü Geri Yükle</button>
            <button id="btnCloseClubManager" type="button" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700">Kapat</button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input id="inpNewSchoolClub" type="text" placeholder="Yeni kulüp adı yazın (örn: Robotik Kodlama Kulübü)" class="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button id="btnAddSchoolClub" type="button" class="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition">+ Kulüp Ekle</button>
        </div>
        <div class="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pt-1">
          ${clubs.map((c, idx) => `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900">
              <span>${escapeHtmlLocal(c)}</span>
              <button type="button" data-del-club-idx="${idx}" title="Kulübü Sil" class="club-del-btn text-rose-600 hover:text-rose-800 font-bold leading-none px-0.5">&times;</button>
            </span>
          `).join('')}
        </div>
      </div>
    `;

    const inp = document.getElementById('inpNewSchoolClub');
    const doAdd = () => {
      if (!inp) return;
      const res = addSchoolClub(state, inp.value);
      if (!res.ok) {
        if (typeof global.showToast === 'function') global.showToast(res.error);
        return;
      }
      inp.value = '';
      if (typeof onChange === 'function') onChange(`"${res.name}" kulübü eklendi`);
    };

    const btnAdd = document.getElementById('btnAddSchoolClub');
    if (btnAdd) btnAdd.addEventListener('click', doAdd);
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });

    const btnReset = document.getElementById('btnResetDefaultClubs');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        resetDefaultSchoolClubs(state);
        if (typeof onChange === 'function') onChange('Varsayılan 32 MEB kulübü listeye eklendi');
      });
    }

    const btnClose = document.getElementById('btnCloseClubManager');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        container.classList.add('hidden');
      });
    }

    container.querySelectorAll('.club-del-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-del-club-idx'));
        const name = clubs[idx];
        if (!name) return;
        removeSchoolClub(state, name);
        if (typeof onChange === 'function') onChange(`"${name}" kulübü silindi`);
      });
    });
  }

  const api = {
    DEFAULT_SCHOOL_CLUBS,
    getSchoolClubs,
    addSchoolClub,
    removeSchoolClub,
    resetDefaultSchoolClubs,
    renderClubManagerPanel
  };

  global.EvrakPlusClubs = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
