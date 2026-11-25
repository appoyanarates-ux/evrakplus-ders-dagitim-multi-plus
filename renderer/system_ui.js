'use strict';

(function (root) {
  let hooks = null;
  let lastUpdateState = null;

  function el(id) { return document.getElementById(id); }

  function showModal(id) {
    const m = el(id);
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
  }

  function hideModal(id) {
    const m = el(id);
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
  }

  function formatDateTr(iso) {
    if (!iso) return 'Henüz yapılmadı';
    try { return new Date(iso).toLocaleString('tr-TR'); } catch (_e) { return String(iso); }
  }

  function renderUpdateState(st) {
    if (!st) return;
    lastUpdateState = st;
    const statusText = el('aboutUpdateStatusText');
    if (statusText && st.message) statusText.textContent = st.message;

    if (st.status === 'available') {
      if (el('updModalSubtitle')) el('updModalSubtitle').textContent = `DersOptima Pro Haftalık Ders Dağıtım Programı ${st.availableVersion || ''}`;
      if (el('updCurrentVer')) el('updCurrentVer').textContent = st.currentVersion || '1.0.0';
      if (el('updNewVer')) el('updNewVer').textContent = st.availableVersion || '—';
      if (el('updReleaseNotesBox')) {
        el('updReleaseNotesBox').textContent = st.releaseNotes || 'Performans iyileştirmeleri ve hata düzeltmeleri.';
      }
      if (el('updProgressWrap')) el('updProgressWrap').classList.add('hidden');
      if (el('updReadyQuestion')) el('updReadyQuestion').classList.add('hidden');
      if (el('updActionsAvailable')) el('updActionsAvailable').classList.remove('hidden');
      if (el('updActionsReady')) el('updActionsReady').classList.add('hidden');
      showModal('updateAvailableModal');
    } else if (st.status === 'downloading') {
      if (el('updProgressWrap')) el('updProgressWrap').classList.remove('hidden');
      if (el('updProgressText')) el('updProgressText').textContent = st.message || 'İndiriliyor...';
      if (el('updProgressPct')) el('updProgressPct').textContent = `${st.progressPercent || 0}%`;
      if (el('updProgressBar')) el('updProgressBar').style.width = `${st.progressPercent || 0}%`;
    } else if (st.status === 'downloaded') {
      if (el('updProgressWrap')) el('updProgressWrap').classList.add('hidden');
      if (el('updReadyQuestion')) el('updReadyQuestion').classList.remove('hidden');
      if (el('updActionsAvailable')) el('updActionsAvailable').classList.add('hidden');
      if (el('updActionsReady')) el('updActionsReady').classList.remove('hidden');
      showModal('updateAvailableModal');
    }
  }

  async function refreshAboutModal() {
    const api = window.dersDagitimAPI;
    if (!api || typeof api.getAboutInfo !== 'function') return;
    try {
      const info = await api.getAboutInfo();
      if (el('aboutAppVersion')) el('aboutAppVersion').textContent = `v${info.appVersion} (Şema ${info.schemaVersion})`;
      if (el('sidebarVersionTag')) el('sidebarVersionTag').textContent = `v${info.appVersion}`;
      if (el('aboutEngineVersion')) {
        el('aboutEngineVersion').textContent = info.engineInfo && info.engineInfo.available
          ? `Hazır (v${info.engineInfo.ortools_version || '1.0'})`
          : 'Bulunamadı';
      }
      if (el('aboutLastCheck')) el('aboutLastCheck').textContent = formatDateTr(info.lastUpdateCheckAt);
      if (el('inpMaxBackups')) el('inpMaxBackups').value = info.maxBackups || 10;

      const histWrap = el('aboutUpdateHistoryWrap');
      if (histWrap) {
        const list = info.updateHistory || [];
        histWrap.textContent = list.length
          ? `Güncelleme geçmişi: ${list.slice(0, 3).map((h) => `v${h.fromVersion} → v${h.toVersion}`).join(', ')}`
          : 'Güncelleme geçmişi: İlk kararlı sürüm (v1.0.0).';
      }

      await refreshLocalBackupsList();
      const checks = await api.getStartupChecks();
      const checksEl = el('aboutStartupChecksList');
      if (checksEl && checks && Array.isArray(checks.checks)) {
        checksEl.innerHTML = '';
        checks.checks.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'flex items-center justify-between gap-2 text-[11px] py-1 border-b border-slate-100 last:border-0';
          const badge = c.ok
            ? '<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">OK</span>'
            : '<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">UYARI</span>';
          row.innerHTML = `<span class="font-semibold text-slate-700"></span><span class="flex items-center gap-1.5 text-slate-500 truncate"><span class="detail-txt truncate"></span>${badge}</span>`;
          row.querySelector('.font-semibold').textContent = c.label;
          row.querySelector('.detail-txt').textContent = c.detail;
          checksEl.appendChild(row);
        });
      }
    } catch (_err) {}
  }

  async function refreshLocalBackupsList() {
    const api = window.dersDagitimAPI;
    const listEl = el('aboutLocalBackupsList');
    if (!listEl || !api || typeof api.listLocalBackups !== 'function') return;
    try {
      const backups = await api.listLocalBackups();
      if (!backups.length) {
        listEl.innerHTML = '<div class="text-[11px] text-slate-500">Henüz yerel otomatik yedek oluşturulmadı.</div>';
        return;
      }
      listEl.innerHTML = '';
      backups.forEach((b) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]';
        row.innerHTML = `
          <div class="min-w-0">
            <div class="font-semibold text-slate-800 truncate"></div>
            <div class="text-[10px] text-slate-500">${formatDateTr(b.createdAt)} · ${b.reason} · ${Math.max(1, Math.round((b.sizeBytes || 0) / 1024))} KB</div>
          </div>
          <button type="button" class="btn-restore shrink-0 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px]">Geri Yükle</button>
        `;
        row.querySelector('.font-semibold').textContent = b.label || b.backupId;
        row.querySelector('.btn-restore').addEventListener('click', async () => {
          if (!window.confirm('Seçili yerel yedeği geri yüklemek istiyor musunuz?')) return;
          try {
            const restored = await api.restoreLocalBackup(b.backupId);
            if (restored && restored.payload && hooks) {
              hooks.loadExternalState(restored.payload);
              hideModal('settingsAboutModal');
              hooks.showToast(`Yedek geri yüklendi: ${restored.label}`);
            }
          } catch (err) {
            if (hooks) hooks.showToast(err.message || 'Yedek geri yüklenemedi.');
          }
        });
        listEl.appendChild(row);
      });
    } catch (_e) {}
  }

  async function runBackgroundStartupAndRecovery() {
    const api = window.dersDagitimAPI;
    if (!api) return;
    try {
      if (typeof api.getAboutInfo === 'function') {
        const info = await api.getAboutInfo();
        if (el('sidebarVersionTag') && info.appVersion) el('sidebarVersionTag').textContent = `v${info.appVersion}`;
      }
      if (typeof api.getStartupChecks === 'function') {
        const report = await api.getStartupChecks();
        const failed = (report && report.checks || []).filter((c) => !c.ok);
        if (failed.length && hooks) {
          hooks.showToast(`Sistem uyarısı (${failed[0].label}): ${failed[0].detail}`);
        }
      }
      if (typeof api.getCrashRecovery === 'function') {
        const snap = await api.getCrashRecovery();
        if (snap && snap.payload && hooks) {
          if (window.confirm(`Önceki oturum beklenmedik şekilde kapanmış (${formatDateTr(snap.savedAt)}). Kurtarma yedeğini geri yüklemek ister misiniz?`)) {
            hooks.loadExternalState(snap.payload);
            hooks.showToast('Beklenmedik kapanma kurtarma yedeği yüklendi.');
          }
          await api.clearCrashRecovery();
        }
      }
    } catch (_e) {}
  }

  function bindEvents() {
    const on = (id, ev, fn) => { const n = el(id); if (n) n.addEventListener(ev, fn); };
    const api = window.dersDagitimAPI;

    on('btnSidebarSettingsAbout', 'click', async () => {
      showModal('settingsAboutModal');
      await refreshAboutModal();
    });
    on('btnCloseSettingsAbout', 'click', () => hideModal('settingsAboutModal'));

    on('btnCheckUpdatesNow', 'click', async () => {
      if (!api || typeof api.checkForUpdates !== 'function') return;
      if (el('aboutUpdateStatusText')) el('aboutUpdateStatusText').textContent = 'Güncellemeler kontrol ediliyor...';
      const st = await api.checkForUpdates();
      renderUpdateState(st);
      if (hooks && st && st.message) hooks.showToast(st.message);
    });

    on('inpMaxBackups', 'change', async (e) => {
      if (!api || typeof api.saveBackupPrefs !== 'function') return;
      const val = Math.max(3, Math.min(50, parseInt(e.target.value, 10) || 10));
      await api.saveBackupPrefs({ maxBackups: val });
      if (hooks) hooks.showToast(`Yerel yedek saklama sayısı ${val} olarak güncellendi.`);
    });

    on('btnCreateManualBackup', 'click', async () => {
      if (!api || typeof api.createLocalBackup !== 'function' || !hooks) return;
      const st = hooks.getState();
      await api.createLocalBackup({
        projectData: st,
        reason: 'manual',
        label: (st.school && st.school.name) || 'Manuel Proje Yedeği'
      });
      await refreshLocalBackupsList();
      hooks.showToast('Manuel yerel yedek oluşturuldu.');
    });

    on('btnAboutEvrakPlusSite', 'click', () => {
      if (api && typeof api.evrakplusOpenUrl === 'function') {
        api.evrakplusOpenUrl('https://www.evrakplus.com/');
      }
    });

    on('btnAboutExportErrorReport', 'click', async () => {
      if (!api || typeof api.exportErrorReport !== 'function') return;
      const res = await api.exportErrorReport();
      if (!res.canceled && hooks) {
        hooks.showToast('Hassas verilerden arındırılmış hata raporu kaydedildi.');
      }
    });

    on('btnAboutUserGuide', 'click', () => {
      const box = el('aboutExtraInfoBox');
      if (!box) return;
      box.textContent =
        'Kısa Kullanım Özeti (Tam kılavuz: KULLANIM_KILAVUZU.md)\n' +
        '1. Menü 1: Okul türünü, zil saatlerini ve açık/kapalı saatleri belirleyin.\n' +
        '2. Menü 2-4: Şubeleri, öğretmenleri, uygunluk matrislerini ve ders bloklarını tanımlayın.\n' +
        '3. Menü 5: Otomatik dağıtımı başlatın (tamamen internetsiz ve ücretsiz).\n' +
        '4. Menü 6: Sürükle-bırak taşıma, kilitleme, bölgesel yeniden dağıtım ve EvrakPlus üyeliğiyle PDF/Excel çıktısı alın.\n' +
        '5. Menü 7: Yerel yedek veya isteğe bağlı EvrakPlus bulut senkronizasyonu yapın.';
      box.classList.remove('hidden');
    });

    on('btnAboutLicenses', 'click', () => {
      const box = el('aboutExtraInfoBox');
      if (!box) return;
      box.textContent =
        'Üçüncü Taraf Açık Kaynak Bildirimleri:\n' +
        '• Açık Kaynak Optimizasyon Motoru (Apache-2.0 License)\n' +
        '• Electron & electron-updater (MIT License)\n' +
        '• Tailwind CSS & Lucide Icons (MIT / ISC License)\n' +
        '• SheetJS / xlsx (Apache-2.0 License)\n' +
        '• Python 3.12 Runtime (PSF License)';
      box.classList.remove('hidden');
    });

    // Güncelleme Modalı düğmeleri
    on('btnCloseUpdateModal', 'click', () => hideModal('updateAvailableModal'));
    on('btnUpdLater', 'click', () => hideModal('updateAvailableModal'));
    on('btnUpdInstallLater', 'click', () => hideModal('updateAvailableModal'));
    on('btnUpdToggleNotes', 'click', () => {
      const nb = el('updReleaseNotesBox');
      if (nb) nb.classList.toggle('hidden');
    });
    on('btnUpdDownload', 'click', async () => {
      if (!api || typeof api.downloadUpdate !== 'function') return;
      try {
        await api.downloadUpdate();
      } catch (err) {
        if (hooks) hooks.showToast(err.message || 'Güncelleme indirilemedi.');
      }
    });
    on('btnUpdInstallNow', 'click', async () => {
      if (!api || typeof api.installUpdate !== 'function') return;
      try {
        if (hooks) hooks.saveState();
        const snap = hooks ? hooks.getState() : null;
        await api.installUpdate(snap);
      } catch (err) {
        if (hooks) hooks.showToast(err.message || 'Güncelleme başlatılamadı.');
      }
    });

    if (api && typeof api.onUpdateStatus === 'function') {
      api.onUpdateStatus((st) => renderUpdateState(st));
    }

    // Beklenmedik JS hatalarını hassas verilerden arındırılmış yerel günlüğe yaz
    window.addEventListener('error', (ev) => {
      if (api && typeof api.logAppError === 'function') {
        api.logAppError({
          errorType: 'RendererError',
          section: 'ui',
          code: 'WINDOW_ERROR',
          message: ev && ev.message ? ev.message : 'Bilinmeyen arayüz hatası'
        }).catch(() => {});
      }
    });
  }

  root.SystemUI = {
    init(appHooks) {
      hooks = appHooks;
      bindEvents();
      runBackgroundStartupAndRecovery();
    },
    triggerAutoBackup(projectData, label) {
      const api = window.dersDagitimAPI;
      if (api && typeof api.createLocalBackup === 'function') {
        api.createLocalBackup({ projectData, reason: 'auto', label }).catch(() => {});
      }
      if (api && typeof api.saveCrashRecovery === 'function') {
        api.saveCrashRecovery(projectData).catch(() => {});
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
