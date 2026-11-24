'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dersDagitimAPI', Object.freeze({
  // OR-Tools CP-SAT & Doğrulama
  solveTimetable: (config) => ipcRenderer.invoke('ortools:solve', config),
  validateTimetable: (config, solution) => ipcRenderer.invoke('ortools:validate', { config, solution }),
  cancelSolve: () => ipcRenderer.invoke('ortools:cancel'),
  getEngineInfo: () => ipcRenderer.invoke('ortools:info'),

  // Çıktı & Dosya Kaydetme
  exportPdf: (payload) => ipcRenderer.invoke('ortools:export-pdf', payload),
  exportBatchZip: (payload) => ipcRenderer.invoke('ortools:export-batch-zip', payload),
  saveBinaryFile: (payload) => ipcRenderer.invoke('ortools:save-binary', payload),

  // EvrakPlus Üyelik, Cihaz Eşleştirme ve Bulut Senkronizasyonu (Aşama 5)
  evrakplusGetSession: () => ipcRenderer.invoke('evrakplus:get-session'),
  evrakplusStartLogin: (opts) => ipcRenderer.invoke('evrakplus:start-login', opts),
  evrakplusPollLogin: (deviceCode) => ipcRenderer.invoke('evrakplus:poll-login', deviceCode),
  evrakplusRefreshEntitlements: () => ipcRenderer.invoke('evrakplus:refresh-entitlements'),
  evrakplusLogout: () => ipcRenderer.invoke('evrakplus:logout'),
  evrakplusListProjects: () => ipcRenderer.invoke('evrakplus:list-projects'),
  evrakplusGetProject: (projectUuid) => ipcRenderer.invoke('evrakplus:get-project', projectUuid),
  evrakplusDeleteProject: (projectUuid) => ipcRenderer.invoke('evrakplus:delete-project', projectUuid),
  evrakplusSyncProject: (payload) => ipcRenderer.invoke('evrakplus:sync-project', payload),
  evrakplusProjectHistory: (projectUuid) => ipcRenderer.invoke('evrakplus:project-history', projectUuid),
  evrakplusOpenUrl: (url) => ipcRenderer.invoke('evrakplus:open-url', url),

  // Başlangıç Kontrolleri, Yedekleme, Kurtarma, Hata Raporu ve Güncelleme (Aşama 6)
  getStartupChecks: () => ipcRenderer.invoke('system:startup-checks'),
  getAboutInfo: () => ipcRenderer.invoke('system:get-about'),
  logAppError: (payload) => ipcRenderer.invoke('system:log-error', payload),
  exportErrorReport: () => ipcRenderer.invoke('system:export-error-report'),

  createLocalBackup: (payload) => ipcRenderer.invoke('backup:create', payload),
  listLocalBackups: () => ipcRenderer.invoke('backup:list'),
  restoreLocalBackup: (backupId) => ipcRenderer.invoke('backup:restore', backupId),
  getBackupPrefs: () => ipcRenderer.invoke('backup:prefs-get'),
  saveBackupPrefs: (prefs) => ipcRenderer.invoke('backup:prefs-save', prefs),

  saveCrashRecovery: (projectData) => ipcRenderer.invoke('recovery:save', projectData),
  getCrashRecovery: () => ipcRenderer.invoke('recovery:get'),
  clearCrashRecovery: () => ipcRenderer.invoke('recovery:clear'),

  getUpdaterState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: (currentProjectSnapshot) => ipcRenderer.invoke('updater:install', currentProjectSnapshot),

  // İlerleme & Güncelleme Olayları
  onSolveProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => {
      try { callback(payload); } catch (_err) {}
    };
    ipcRenderer.on('ortools:progress', listener);
    return () => { ipcRenderer.removeListener('ortools:progress', listener); };
  },
  onExportProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => {
      try { callback(payload); } catch (_err) {}
    };
    ipcRenderer.on('ortools:export-progress', listener);
    return () => { ipcRenderer.removeListener('ortools:export-progress', listener); };
  },
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => {
      try { callback(payload); } catch (_err) {}
    };
    ipcRenderer.on('updater:status', listener);
    return () => { ipcRenderer.removeListener('updater:status', listener); };
  }
}));
