'use strict';

const { app, BrowserWindow, dialog, ipcMain, net, safeStorage, session, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { EvrakPlusClient } = require('./evrakplus_client.cjs');
const { StorageAndBackupService, CURRENT_SCHEMA_VERSION } = require('./storage_and_backup.cjs');
const { UpdaterService } = require('./updater_service.cjs');
const { runStartupChecks } = require('./startup_checks.cjs');

let electronAutoUpdater = null;
try {
  ({ autoUpdater: electronAutoUpdater } = require('electron-updater'));
} catch (_err) {
  electronAutoUpdater = null;
}

let mainWindow = null;
let activeSolve = null; // { child, requestId, cancelled, tmpDir, timer }
let solveSequence = 0;
let evrakplusClient = null;
let backupService = null;
let updaterService = null;
let lastStartupReport = null;

function getBackupService() {
  if (!backupService) {
    backupService = new StorageAndBackupService(app.getPath('userData'));
  }
  return backupService;
}

function chromiumFetch(url, opts) {
  // Electron net.fetch, Chromium ag katmanini kullanir:
  // Windows Sertifika Deposu (MEB Sertifikasi dahil) ve sistem proxy ayarlarini otomatik tanir.
  return net.fetch(url, opts);
}

function getUpdaterService() {
  if (!updaterService) {
    updaterService = new UpdaterService({
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      autoUpdater: electronAutoUpdater,
      backupService: getBackupService(),
      fetchImpl: chromiumFetch,
      onStatus: (st) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:status', st);
        }
      }
    });
  }
  return updaterService;
}

function getEvrakPlusClient() {
  if (!evrakplusClient) {
    evrakplusClient = new EvrakPlusClient({
      storageDir: app.getPath('userData'),
      safeStorage,
      fetchImpl: chromiumFetch,
      allowLocalHttp: !app.isPackaged && Boolean(process.env.EVRAKPLUS_ALLOW_LOCAL_HTTP)
    });
  }
  return evrakplusClient;
}

function validateIpcSender(event) {
  if (!event || !event.senderFrame) return false;
  const frameUrl = event.senderFrame.url || '';
  return frameUrl.startsWith('file://');
}

function assertIpcSender(event) {
  if (!validateIpcSender(event)) {
    throw new Error('Yetkisiz IPC çağrı kaynağı engellendi.');
  }
}

function assertExportEntitlement() {
  const client = getEvrakPlusClient();
  const ent = client.evaluateEntitlement();
  if (!ent.exportAllowed) {
    const err = new Error(
      'Bu özellikten yararlanmak için ücretsiz EvrakPlus üyeliğinizle giriş yapmanız gerekiyor. Ders programınızı oluşturmaya ve düzenlemeye ücretsiz devam edebilirsiniz.'
    );
    err.code = ent.offlineExpired ? 'EVRAKPLUS_ENTITLEMENT_EXPIRED' : 'EVRAKPLUS_AUTH_REQUIRED';
    throw err;
  }
}

function buildBundledEngineEnv() {
  const baseRoot = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  const resRoot = app.isPackaged ? process.resourcesPath : path.join(baseRoot, 'resources');
  return {
    ...process.env,
    EVRAKPLUS_JAVA_EXE: path.join(resRoot, 'runtime', 'java', 'bin', 'java.exe'),
    EVRAKPLUS_TIMEFOLD_JAR: path.join(resRoot, 'engines', 'timefold', 'timefold-solver-runner.jar'),
    EVRAKPLUS_CHOCO_JAR: path.join(resRoot, 'engines', 'choco', 'choco-solver-runner.jar'),
    EVRAKPLUS_MINIZINC_EXE: path.join(resRoot, 'engines', 'minizinc', 'minizinc.exe'),
    EVRAKPLUS_MZN_MODEL: path.join(resRoot, 'models', 'timetable.mzn')
  };
}

function resolveMultiSolverLaunch() {
  if (app.isPackaged) {
    const multiExe = path.join(process.resourcesPath, 'engines', 'ortools', 'multi_solver_engine.exe');
    if (fs.existsSync(multiExe)) {
      return { command: multiExe, baseArgs: [], mode: 'bundled_multi_exe', executablePath: multiExe };
    }
  }
  const projectRoot = path.resolve(__dirname, '..');
  const distMultiExe = path.join(projectRoot, 'dist', 'multi_solver_engine', 'multi_solver_engine.exe');
  if (fs.existsSync(distMultiExe)) {
    return { command: distMultiExe, baseArgs: [], mode: 'bundled_multi_exe_dev', executablePath: distMultiExe };
  }
  const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const multiScript = path.join(projectRoot, 'solver', 'multi_solver_engine.py');
  if (fs.existsSync(venvPython) && fs.existsSync(multiScript)) {
    return { command: venvPython, baseArgs: [multiScript], mode: 'venv_python_multi', executablePath: venvPython };
  }
  return resolveSolverLaunch();
}

function resolveSolverLaunch() {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, 'solver_ortools', 'solver_ortools.exe');
    if (fs.existsSync(exePath)) {
      return { command: exePath, baseArgs: [], mode: 'bundled_exe', executablePath: exePath };
    }
    return { command: null, baseArgs: [], mode: 'missing', executablePath: exePath };
  }

  const projectRoot = path.resolve(__dirname, '..');
  const distExe = path.join(projectRoot, 'dist', 'solver_ortools', 'solver_ortools.exe');
  if (fs.existsSync(distExe)) {
    return { command: distExe, baseArgs: [], mode: 'bundled_exe_dev', executablePath: distExe };
  }

  const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const solverScript = path.join(projectRoot, 'solver', 'solver_ortools.py');
  if (fs.existsSync(venvPython) && fs.existsSync(solverScript)) {
    return { command: venvPython, baseArgs: [solverScript], mode: 'venv_python', executablePath: venvPython };
  }

  return { command: null, baseArgs: [], mode: 'missing', executablePath: distExe };
}

function killProcessTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        shell: false,
        windowsHide: true
      });
      killer.on('error', () => {
        try { child.kill('SIGKILL'); } catch (_e) {}
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch (_err) {
    try { child.kill(); } catch (_e) {}
  }
}

function cleanupTmpDir(tmpDir) {
  if (!tmpDir) return;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_err) {
    // Sessizce geç
  }
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ortools:progress', payload);
  }
}

function getEngineInfo() {
  return new Promise((resolve) => {
    const launch = resolveMultiSolverLaunch();
    if (!launch.command) {
      resolve({
        available: false,
        engine: 'google_ortools_cp_sat',
        mode: launch.mode,
        error: `Multi Solver motoru bulunamadı (${launch.executablePath}).`
      });
      return;
    }

    const child = spawn(launch.command, [...launch.baseArgs, '--health-all'], {
      shell: false,
      windowsHide: true,
      env: buildBundledEngineEnv()
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve({
        available: false,
        engine: 'google_ortools_cp_sat',
        mode: launch.mode,
        error: 'Motor bilgisi kontrolü zaman aşımına uğradı.'
      });
    }, 25000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        available: false,
        engine: 'google_ortools_cp_sat',
        mode: launch.mode,
        error: `Dağıtım motoru başlatılamadı: ${err.message}`
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          available: false,
          engine: 'google_ortools_cp_sat',
          mode: launch.mode,
          error: `Motor bilgi komutu hata verdi (kod ${code}): ${stderr.trim()}`
        });
        return;
      }
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const lastJson = lines.reverse().find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
        const parsed = JSON.parse(lastJson || '{}');
        const ort = parsed.engines && parsed.engines.ortools ? parsed.engines.ortools : null;
        resolve({
          available: Boolean(parsed.available_engines > 0 || (ort && ort.available)),
          engine: 'google_ortools_cp_sat',
          ortools_version: (ort && ort.version) || null,
          available_engines: parsed.available_engines || 0,
          total_engines: parsed.total_engines || 6,
          mode: launch.mode
        });
      } catch (err) {
        resolve({
          available: false,
          engine: 'google_ortools_cp_sat',
          mode: launch.mode,
          error: `Motor yanıtı çözümlenemedi: ${err.message}`
        });
      }
    });
  });
}

function getMultiSolverHealth() {
  return new Promise((resolve) => {
    const launch = resolveMultiSolverLaunch();
    if (!launch.command) {
      resolve({
        orchestrator: 'EvrakPlus Multi Solver Optimization Engine',
        available_engines: 0,
        total_engines: 6,
        engines: {},
        error: 'Multi Solver motoru bulunamadı.'
      });
      return;
    }
    const child = spawn(launch.command, [...launch.baseArgs, '--health-all'], {
      shell: false,
      windowsHide: true,
      env: buildBundledEngineEnv()
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve({ orchestrator: 'EvrakPlus Multi Solver Optimization Engine', available_engines: 0, total_engines: 6, engines: {}, error: 'Sağlık kontrolü zaman aşımına uğradı.' });
    }, 30000);
    child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ orchestrator: 'EvrakPlus Multi Solver Optimization Engine', available_engines: 0, total_engines: 6, engines: {}, error: err.message });
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const lastJson = lines.reverse().find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
        resolve(lastJson ? JSON.parse(lastJson) : { orchestrator: 'EvrakPlus Multi Solver Optimization Engine', available_engines: 0, total_engines: 6, engines: {}, error: stderr.slice(-300) });
      } catch (err) {
        resolve({ orchestrator: 'EvrakPlus Multi Solver Optimization Engine', available_engines: 0, total_engines: 6, engines: {}, error: err.message });
      }
    });
  });
}

function runOrToolsSolve(config) {
  return new Promise((resolve, reject) => {
    if (activeSolve) {
      reject(new Error('Devam eden bir dağıtım işlemi var. Önce bitmesini bekleyin veya Durdur düğmesine basın.'));
      return;
    }

    if (!config || typeof config !== 'object') {
      reject(new Error('Geçersiz ders dağıtım model verisi.'));
      return;
    }

    const launch = resolveMultiSolverLaunch();
    if (!launch.command) {
      reject(new Error('Gömülü Multi Solver optimizasyon motoru bulunamadı. Uygulamayı yeniden kurun.'));
      return;
    }

    const requestId = ++solveSequence;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ders-dagitim-'));
    const inputPath = path.join(tmpDir, 'model.json');
    const outputPath = path.join(tmpDir, 'solution.json');

    try {
      const serialized = JSON.stringify(config);
      if (serialized.length > 50 * 1024 * 1024) {
        cleanupTmpDir(tmpDir);
        reject(new Error('Model verisi izin verilen boyut sınırını aşıyor.'));
        return;
      }
      fs.writeFileSync(inputPath, serialized, 'utf8');
    } catch (err) {
      cleanupTmpDir(tmpDir);
      reject(new Error(`Model verisi hazırlanamadı: ${err.message}`));
      return;
    }

    sendProgress({ phase: 'validating', message: 'PASS 0: Model kontrol ediliyor' });

    const child = spawn(launch.command, [...launch.baseArgs, '--input', inputPath, '--output', outputPath], {
      shell: false,
      windowsHide: true,
      env: buildBundledEngineEnv()
    });

    const reqTime = Number(config.solution_request?.time_limit_sec ?? config.solver_config?.max_time_seconds ?? config.solver_config?.timeLimitSec ?? 60);
    const maxTimeSec = reqTime <= 0 ? 3600 : reqTime;
    const watchdogMs = Math.max(30000, Math.min(7200000, (maxTimeSec + 45) * 1000));

    const solveRecord = {
      child,
      requestId,
      cancelled: false,
      timedOut: false,
      tmpDir,
      timer: null
    };

    solveRecord.timer = setTimeout(() => {
      solveRecord.timedOut = true;
      killProcessTree(child);
    }, watchdogMs);

    activeSolve = solveRecord;

    let stderrBuf = '';
    let stderrAll = '';

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stderrAll += text;
      stderrBuf += text;
      const lines = stderrBuf.split(/\r?\n/);
      stderrBuf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg && activeSolve && activeSolve.requestId === requestId) {
            if (msg.type === 'progress' || msg.type === 'pass' || msg.type === 'engine_start' || msg.type === 'engine_done') {
              sendProgress(msg);
            }
          }
        } catch (_e) {
          // JSON olmayan stderr satırı
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(solveRecord.timer);
      if (activeSolve && activeSolve.requestId === requestId) activeSolve = null;
      cleanupTmpDir(tmpDir);
      reject(new Error(`OR-Tools süreci başlatılamadı: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(solveRecord.timer);
      const wasActive = activeSolve && activeSolve.requestId === requestId;
      if (wasActive) activeSolve = null;

      if (solveRecord.cancelled) {
        cleanupTmpDir(tmpDir);
        resolve({
          engine: 'google_ortools_cp_sat',
          status: 'CANCELLED',
          solve_time_sec: 0,
          placed_blocks: 0,
          total_blocks: 0,
          placements: [],
          unplaced: [],
          diagnostics: [],
          message: 'Dağıtım kullanıcı tarafından durduruldu.'
        });
        return;
      }

      if (solveRecord.timedOut) {
        cleanupTmpDir(tmpDir);
        resolve({
          engine: 'google_ortools_cp_sat',
          status: 'UNKNOWN',
          solve_time_sec: maxTimeSec,
          placed_blocks: 0,
          total_blocks: 0,
          placements: [],
          unplaced: [],
          diagnostics: [{ code: 'TIMEOUT', message: 'OR-Tools zaman aşımına uğradı.' }],
          message: 'OR-Tools belirlenen süre içinde yanıt veremedi.'
        });
        return;
      }

      try {
        if (!fs.existsSync(outputPath)) {
          throw new Error(`OR-Tools çıktı dosyası oluşturulamadı (çıkış kodu: ${code}). ${stderrAll.slice(-400).trim()}`);
        }
        const rawOut = fs.readFileSync(outputPath, 'utf8');
        const parsed = JSON.parse(rawOut);
        if (!parsed || parsed.engine !== 'google_ortools_cp_sat') {
          throw new Error('Çözücü beklenen google_ortools_cp_sat imzasını döndürmedi.');
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`OR-Tools sonucu okunamadı: ${err.message}`));
      } finally {
        cleanupTmpDir(tmpDir);
      }
    });
  });
}

function cancelActiveSolve() {
  if (!activeSolve) return { cancelled: false };
  activeSolve.cancelled = true;
  clearTimeout(activeSolve.timer);
  const child = activeSolve.child;
  killProcessTree(child);
  return { cancelled: true };
}

function createMainWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: `EvrakPlus Ders Dağıtım Multi Plus v${app.getVersion()} — MEB 2026-2027`,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Program açıldığında arka planda yeni sürüm kontrolü yap (3 sn sonra, çevrimdışı uyumlu, kullanıcı onaysız indirmez)
  mainWindow.webContents.once('did-finish-load', () => {
    if (app.isPackaged) {
      setTimeout(() => {
        getUpdaterService().checkForUpdates().catch(() => {});
      }, 3000);
    }
  });

  mainWindow.on('closed', () => {
    cancelActiveSolve();
    mainWindow = null;
  });
}

function runOrToolsValidate(payload) {
  return new Promise((resolve, reject) => {
    const launch = resolveSolverLaunch();
    if (!launch.command) {
      reject(new Error('Gömülü OR-Tools doğrulama motoru bulunamadı.'));
      return;
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ders-dagitim-val-'));
    const inputPath = path.join(tmpDir, 'val_in.json');
    const outputPath = path.join(tmpDir, 'val_out.json');
    try {
      fs.writeFileSync(inputPath, JSON.stringify(payload || {}), 'utf8');
    } catch (err) {
      cleanupTmpDir(tmpDir);
      reject(err);
      return;
    }
    const child = spawn(launch.command, [...launch.baseArgs, '--validate', '--input', inputPath, '--output', outputPath], {
      shell: false,
      windowsHide: true
    });
    const timer = setTimeout(() => {
      killProcessTree(child);
      cleanupTmpDir(tmpDir);
      reject(new Error('Program doğrulama zaman aşımına uğradı.'));
    }, 15000);
    child.on('error', (err) => {
      clearTimeout(timer);
      cleanupTmpDir(tmpDir);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const raw = fs.readFileSync(outputPath, 'utf8');
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Doğrulama sonucu okunamadı: ${err.message}`));
      } finally {
        cleanupTmpDir(tmpDir);
      }
    });
  });
}

// =========================================================================
// AŞAMA 4: GERÇEK PDF, TOPLU ZIP VE GÜVENLİ DOSYA KAYIT SERVİSLERİ
// =========================================================================
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(String(entry.name || 'dosya.pdf').replace(/\\/g, '/'), 'utf8');
    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const compressed = zlib.deflateRawSync(rawData);
    const crc = crc32(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8
    localHeader.writeUInt16LE(8, 8);      // Deflate
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

async function renderHtmlToPdfBuffer(html, pdfOpts = {}, reuseWin = null) {
  const ownWin = !reuseWin;
  const win = reuseWin || new BrowserWindow({
    show: false,
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-pdf-'));
  const htmlPath = path.join(tmpDir, 'doc.html');
  try {
    fs.writeFileSync(htmlPath, String(html || ''), 'utf8');
    await win.loadFile(htmlPath);
    const pdfBuf = await win.webContents.printToPDF({
      pageSize: pdfOpts.pageSize === 'A3' ? 'A3' : 'A4',
      landscape: pdfOpts.orientation !== 'portrait',
      printBackground: true,
      preferCSSPageSize: true
    });
    return Buffer.from(pdfBuf);
  } finally {
    if (ownWin && !win.isDestroyed()) win.destroy();
    cleanupTmpDir(tmpDir);
  }
}

async function handleExportPdf(payload) {
  if (!payload || !payload.html) {
    throw new Error('PDF içeriği boş.');
  }
  let targetPath = payload.savePath || null;
  if (!targetPath && mainWindow) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'PDF Olarak Kaydet',
      defaultPath: payload.defaultFilename || 'ders_programi.pdf',
      filters: [{ name: 'PDF Dosyası', extensions: ['pdf'] }]
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    targetPath = res.filePath;
  }
  const buf = await renderHtmlToPdfBuffer(payload.html, payload.pdfOptions || {});
  try {
    fs.writeFileSync(targetPath, buf);
  } catch (err) {
    throw new Error(`Dosya kaydedilemedi (${path.basename(targetPath)} başka bir programda açık olabilir): ${err.message}`);
  }
  return { canceled: false, filePath: targetPath, sizeBytes: buf.length };
}

async function handleExportBatchZip(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  if (!items.length) throw new Error('Toplu çıktı için en az bir öğe seçilmelidir.');

  let targetPath = payload.savePath || null;
  if (!targetPath && mainWindow) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Toplu Çıktı ZIP Kaydet',
      defaultPath: payload.defaultFilename || 'toplu_ders_programlari.zip',
      filters: [{ name: 'ZIP Arşivi', extensions: ['zip'] }]
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    targetPath = res.filePath;
  }

  const workerWin = new BrowserWindow({
    show: false,
    width: 1200,
    height: 850,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });

  const zipEntries = [];
  const failed = [];
  try {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ortools:export-progress', {
          current: i + 1,
          total: items.length,
          filename: it.filename
        });
      }
      try {
        const pdfBuf = await renderHtmlToPdfBuffer(it.html, payload.pdfOptions || {}, workerWin);
        zipEntries.push({ name: it.filename, data: pdfBuf });
      } catch (err) {
        failed.push({ filename: it.filename, error: err.message });
      }
    }
    if (payload.extraFiles && Array.isArray(payload.extraFiles)) {
      for (const ef of payload.extraFiles) {
        if (ef && ef.filename && ef.base64Data) {
          zipEntries.push({ name: ef.filename, data: Buffer.from(ef.base64Data, 'base64') });
        }
      }
    }
    const zipBuf = createZipBuffer(zipEntries);
    fs.writeFileSync(targetPath, zipBuf);
    return { canceled: false, filePath: targetPath, count: zipEntries.length, failed, sizeBytes: zipBuf.length };
  } finally {
    if (!workerWin.isDestroyed()) workerWin.destroy();
  }
}

async function handleSaveBinary(payload) {
  if (!payload || !payload.base64Data) throw new Error('Kaydedilecek veri bulunamadı.');
  let targetPath = payload.savePath || null;
  if (!targetPath && mainWindow) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: payload.title || 'Dosyayı Kaydet',
      defaultPath: payload.defaultFilename || 'ders_programi.xlsx',
      filters: payload.filters || [{ name: 'Excel Çalışma Kitabı', extensions: ['xlsx'] }]
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    targetPath = res.filePath;
  }
  const buf = Buffer.from(payload.base64Data, 'base64');
  try {
    fs.writeFileSync(targetPath, buf);
  } catch (err) {
    throw new Error(`Dosya kaydedilemedi (${path.basename(targetPath)} başka bir programda açık olabilir): ${err.message}`);
  }
  return { canceled: false, filePath: targetPath, sizeBytes: buf.length };
}

ipcMain.handle('ortools:info', async (event) => {
  assertIpcSender(event);
  return getEngineInfo();
});
ipcMain.handle('multi:health', async (event) => {
  assertIpcSender(event);
  return getMultiSolverHealth();
});
ipcMain.handle('ortools:solve', async (event, config) => {
  assertIpcSender(event);
  return runOrToolsSolve(config);
});
ipcMain.handle('ortools:validate', async (event, payload) => {
  assertIpcSender(event);
  return runOrToolsValidate(payload);
});
ipcMain.handle('ortools:cancel', async (event) => {
  assertIpcSender(event);
  return cancelActiveSolve();
});
ipcMain.handle('ortools:export-pdf', async (event, payload) => {
  assertIpcSender(event);
  assertExportEntitlement();
  return handleExportPdf(payload);
});
ipcMain.handle('ortools:export-batch-zip', async (event, payload) => {
  assertIpcSender(event);
  assertExportEntitlement();
  return handleExportBatchZip(payload);
});
ipcMain.handle('ortools:save-binary', async (event, payload) => {
  assertIpcSender(event);
  if (!payload || payload.exportKind !== 'json_backup') {
    assertExportEntitlement();
  }
  return handleSaveBinary(payload);
});

// =========================================================================
// AŞAMA 5: EVRAKPLUS ÜYELİK, CİHAZ EŞLEŞTİRME VE BULUT SENKRONİZASYON IPC
// =========================================================================
ipcMain.handle('evrakplus:get-session', async (event) => {
  assertIpcSender(event);
  return getEvrakPlusClient().getPublicSession();
});
ipcMain.handle('evrakplus:start-login', async (event, opts) => {
  assertIpcSender(event);
  const client = getEvrakPlusClient();
  const res = await client.startDeviceLogin({
    deviceName: (opts && opts.deviceName) || `${os.hostname()} (Windows)`,
    appVersion: app.getVersion()
  });
  if (opts && opts.openBrowser !== false && client.isUrlAllowedForExternalOpen(res.verificationUrl)) {
    await shell.openExternal(res.verificationUrl);
  }
  return res;
});
ipcMain.handle('evrakplus:poll-login', async (event, deviceCode) => {
  assertIpcSender(event);
  return getEvrakPlusClient().pollDeviceLogin(String(deviceCode || ''));
});
ipcMain.handle('evrakplus:refresh-entitlements', async (event) => {
  assertIpcSender(event);
  return getEvrakPlusClient().refreshEntitlements();
});
ipcMain.handle('evrakplus:logout', async (event) => {
  assertIpcSender(event);
  return getEvrakPlusClient().logout();
});
ipcMain.handle('evrakplus:list-projects', async (event) => {
  assertIpcSender(event);
  return getEvrakPlusClient().listProjects();
});
ipcMain.handle('evrakplus:get-project', async (event, projectUuid) => {
  assertIpcSender(event);
  return getEvrakPlusClient().getProject(String(projectUuid || ''));
});
ipcMain.handle('evrakplus:delete-project', async (event, projectUuid) => {
  assertIpcSender(event);
  return getEvrakPlusClient().deleteProject(String(projectUuid || ''));
});
ipcMain.handle('evrakplus:sync-project', async (event, payload) => {
  assertIpcSender(event);
  return getEvrakPlusClient().syncProject(payload || {});
});
ipcMain.handle('evrakplus:project-history', async (event, projectUuid) => {
  assertIpcSender(event);
  return getEvrakPlusClient().getProjectHistory(String(projectUuid || ''));
});
ipcMain.handle('evrakplus:open-url', async (event, targetUrl) => {
  assertIpcSender(event);
  const client = getEvrakPlusClient();
  if (!client.isUrlAllowedForExternalOpen(targetUrl)) {
    throw new Error('Yalnızca güvenilir EvrakPlus bağlantıları açılabilir.');
  }
  await shell.openExternal(targetUrl);
  return { opened: true };
});

// =========================================================================
// AŞAMA 6: BAŞLANGIÇ KONTROLLERİ, YEDEKLEME, KURTARMA, HATA RAPORU VE GÜNCELLEME
// =========================================================================
ipcMain.handle('system:startup-checks', async (event) => {
  assertIpcSender(event);
  lastStartupReport = await runStartupChecks({
    appVersion: app.getVersion(),
    userDataDir: app.getPath('userData'),
    getEngineInfo,
    evrakplusClient: getEvrakPlusClient(),
    updaterService: getUpdaterService()
  });
  return lastStartupReport;
});

ipcMain.handle('system:get-about', async (event) => {
  assertIpcSender(event);
  const engineInfo = await getEngineInfo();
  const prefs = getBackupService().getPrefs();
  return {
    productName: 'EvrakPlus Ders Dağıtım',
    appVersion: app.getVersion(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineInfo,
    userDataDir: app.getPath('userData'),
    lastUpdateCheckAt: prefs.lastUpdateCheckAt,
    updateHistory: prefs.updateHistory || [],
    maxBackups: prefs.maxBackups,
    websiteUrl: 'https://www.evrakplus.com/'
  };
});

ipcMain.handle('system:log-error', async (event, payload) => {
  assertIpcSender(event);
  return getBackupService().logError({
    appVersion: app.getVersion(),
    ...(payload || {})
  });
});

ipcMain.handle('system:export-error-report', async (event) => {
  assertIpcSender(event);
  const engineInfo = await getEngineInfo();
  const report = getBackupService().buildSanitizedErrorReport({
    appVersion: app.getVersion(),
    engineInfo,
    startupChecks: lastStartupReport
  });
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Hassas Verilerden Arındırılmış Hata Raporunu Kaydet',
    defaultPath: `evrakplus_hata_raporu_v${app.getVersion()}.json`,
    filters: [{ name: 'JSON Hata Raporu', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(report, null, 2), 'utf8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('backup:create', async (event, { projectData, reason, label } = {}) => {
  assertIpcSender(event);
  return getBackupService().createBackup(projectData, { reason, label });
});
ipcMain.handle('backup:list', async (event) => {
  assertIpcSender(event);
  return getBackupService().listBackups();
});
ipcMain.handle('backup:restore', async (event, backupId) => {
  assertIpcSender(event);
  return getBackupService().restoreBackup(backupId);
});
ipcMain.handle('backup:prefs-get', async (event) => {
  assertIpcSender(event);
  return getBackupService().getPrefs();
});
ipcMain.handle('backup:prefs-save', async (event, prefs) => {
  assertIpcSender(event);
  return getBackupService().savePrefs(prefs);
});

ipcMain.handle('recovery:save', async (event, projectData) => {
  assertIpcSender(event);
  return getBackupService().writeCrashRecoverySnapshot(projectData);
});
ipcMain.handle('recovery:get', async (event) => {
  assertIpcSender(event);
  return getBackupService().getCrashRecoverySnapshot();
});
ipcMain.handle('recovery:clear', async (event) => {
  assertIpcSender(event);
  getBackupService().clearCrashRecoverySnapshot();
  return { cleared: true };
});

ipcMain.handle('updater:get-state', async (event) => {
  assertIpcSender(event);
  return getUpdaterService().getState();
});
ipcMain.handle('updater:check', async (event) => {
  assertIpcSender(event);
  return getUpdaterService().checkForUpdates();
});
ipcMain.handle('updater:download', async (event) => {
  assertIpcSender(event);
  return getUpdaterService().downloadUpdate();
});
ipcMain.handle('updater:install', async (event, currentProjectSnapshot) => {
  assertIpcSender(event);
  return getUpdaterService().installDownloadedUpdate(currentProjectSnapshot);
});

process.on('uncaughtException', (err) => {
  try {
    getBackupService().logError({
      appVersion: app.getVersion(),
      errorType: 'UncaughtException',
      section: 'main_process',
      code: err && err.code ? String(err.code) : 'UNCAUGHT',
      message: err && err.message ? err.message : String(err)
    });
  } catch (_e) {}
});

app.whenReady().then(() => {
  // Güvenli Content Security Policy (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob: data:; connect-src 'self' https://www.evrakplus.com;"
        ]
      }
    });
  });

  createMainWindow();
  // Arka planda engelleyici olmayan başlangıç kontrolü
  runStartupChecks({
    appVersion: app.getVersion(),
    userDataDir: app.getPath('userData'),
    getEngineInfo,
    evrakplusClient: getEvrakPlusClient(),
    updaterService: getUpdaterService()
  }).then((rep) => { lastStartupReport = rep; }).catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  cancelActiveSolve();
  try { getBackupService().clearCrashRecoverySnapshot(); } catch (_e) {}
});

app.on('window-all-closed', () => {
  cancelActiveSolve();
  if (process.platform !== 'darwin') app.quit();
});
