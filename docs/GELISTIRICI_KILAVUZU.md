# EvrakPlus Ders Dağıtım — Geliştirici Kılavuzu

## 1. Proje Yapısı
- `electron/` — Electron ana süreç (`main.cjs`), güvenli preload (`preload.cjs`), EvrakPlus DPAPI istemcisi (`evrakplus_client.cjs`), güncelleme servisi (`updater_service.cjs`), yedekleme/migrasyon (`storage_and_backup.cjs`), başlangıç kontrolleri (`startup_checks.cjs`).
- `renderer/` — 7 menülü sıfır-CDN arayüz (`index.html`, `app.js`, `editor_logic.js`, `export_engine.js`, `evrakplus_ui.js`, `system_ui.js`, `manifest.webmanifest`, `sw.js`, `assets/`).
- `solver/` — Google OR-Tools CP-SAT motoru (`solver_ortools.py`), ön doğrulama (`validate_model.py`), bağımsız sonuç doğrulama (`validate_result.py`), `requirements.txt`.
- `evrakplus-ders-dagitim-bridge/` — WordPress köprü eklentisi (v1.0.0, 9 REST API uç noktası, 7 sekmeli yönetici paneli, SQL şeması).
- `tests/` — Python `pytest` (29 test) ve Node `node:test` (17 test).
- `scripts/` — PyInstaller derleyici (`build_solver_windows.ps1`), simge üretici (`generate_icon.cjs`), manifest imzalayıcı (`sign_manifest.cjs`), performans ölçer (`run_perf_benchmarks.py`).
- `.github/workflows/` — CI test (`ci-tests.yml`) ve Windows sürüm yayınlama (`windows-release.yml`).

## 2. Yerel Geliştirme Komutları
```powershell
# 1. Node bağımlılıklarını kur
npm.cmd ci

# 2. Python sanal ortamı ve OR-Tools kur
python -m venv .venv
.venv\Scripts\pip.exe install -r solver\requirements.txt

# 3. Tüm otomatik testleri çalıştır
npm.cmd run test:py
npm.cmd run test:js

# 4. Python OR-Tools motorunu PyInstaller (onedir) ile paketle
npm.cmd run build:solver

# 5. Windows NSIS EXE + WordPress ZIP + Kaynak ZIP üret
npm.cmd run build:win
npm.cmd run build:wp-zip
npm.cmd run build:source-zip
```

## 3. Mimari Kurallar
- Otomatik ders dağıtımında **yalnızca Google OR-Tools CP-SAT** kullanılır; JS tabanlı yedek çözücü eklenmez.
- Electron penceresinde `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` ve CSP zorunludur.
- Tüm IPC işleyicileri `assertIpcSender(event)` ile yalnızca `file://` kaynağını kabul eder.
- Proje verileri ve yedekler asla kurulum dizinine yazılmaz; `app.getPath('userData')` kullanılır.
