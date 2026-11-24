# Test ve Doğrulama Raporu — Okul Ders Dağıtım Programı (v1.3.0 — Aşama 4)

**Tarih:** 22.11.2026  
**Ortam:** Windows 10/11 (x64), Python 3.12.10, Google OR-Tools 9.14.6206, Node.js v24.22.1, Electron 35.7.5  
**Çözücü Motoru:** Yalnızca `google_ortools_cp_sat` (PyInstaller `onedir` gömülü Windows EXE)

## 1. Aşama 4 Kabul Kriterleri (16 Madde)

| # | Kabul Kriteri | Test Yeri | Sonuç |
| --- | --- | --- | --- |
| 1 | Tek şube PDF çıktı şablonu | `test_export_engine.mjs` | **BAŞARILI** |
| 2 | Tek öğretmen PDF çıktı şablonu | `test_export_engine.mjs` | **BAŞARILI** |
| 3 | 50 şubelik toplu PDF şablonu (50 sayfa) | `test_export_engine.mjs` | **BAŞARILI** |
| 4 | 100 öğretmenlik toplu PDF şablonu (100 sayfa) | `test_export_engine.mjs` | **BAŞARILI** |
| 5 | Gerçek 7 sayfalı `.xlsx` üretimi, diske yazım ve `XLSX.readFile` ile geri okuma + formül enjeksiyon koruması | `test_export_engine.mjs` | **BAŞARILI** |
| 6 | Çarşaf programlarının A3 yatay tek sayfa çıktısı | `test_export_engine.mjs` | **BAŞARILI** |
| 7 | Çok sayfalı A4 çıktıda satır/sütun kaybı olmadan gün bölme | `test_export_engine.mjs` | **BAŞARILI** |
| 8 | Türkçe karakterlerin (`ĞÜŞİÖÇğüşıöç`) doğru görünmesi | `test_export_engine.mjs` | **BAŞARILI** |
| 9 | Tekli ve ikili öğretim saatlerinin (`07:30` / `13:00`) doğru gösterilmesi | `test_export_engine.mjs` | **BAŞARILI** |
| 10 | Kilitli derslerin çıktıda ve Excel'de doğru görünmesi | `test_export_engine.mjs` | **BAŞARILI** |
| 11 | Manuel taşınan derslerin güncel konumlarıyla yazdırılması | `test_import_export.mjs` + ortak `state.solution.placements` kaynağı | **BAŞARILI** |
| 12 | Öğretmen boş pencere sayılarının doğru hesaplanması (yalnızca ilk ve son ders arası) | `test_export_engine.mjs` | **BAŞARILI** |
| 13 | Geçersiz program uyarıları ve `TASLAK – DOĞRULANMAMIŞ` ibaresi | `test_export_engine.mjs` | **BAŞARILI** |
| 14 | PDF, XLSX ve ZIP üretiminin internet bağlantısı olmadan çalışması | `test_import_export.mjs` (sıfır CDN) + `electron/main.cjs` | **BAŞARILI** |
| 15 | Önizleme (`iframe srcdoc`) ve oluşturulan PDF'nin birebir aynı HTML kaynağını kullanması | `app.js` (`buildPreviewDocumentHtml`) | **BAŞARILI** |
| 16 | Yeni çıktı özelliklerinin mevcut 7 menüyü ve OR-Tools motorunu bozmaması | `pytest` (29/29) + `node --test` (10/10) | **BAŞARILI** |

## 2. EvrakPlus Üyelik Altyapısı Durumu (Bölüm 13 — Geliştirici Raporu)
- Merkezi yetkilendirme kapısı `DersExportEngine.EvrakPlusAuthService.checkExportPermission(action, state)` üzerinden tüm PDF, Excel (`.xlsx`), toplu ZIP ve uygulama içi yazdırma işlemleri tek noktadan geçecek şekilde tasarlandı ve test edildi.
- **Mevcut Durum:** Canlı `https://www.evrakplus.com/` üyelik API uç noktası henüz bağlanmadığı için sahte oturum veya sahte doğrulama **üretilmemiştir**. Varsayılan mod `development_open` olarak bırakılmıştır; sunucu imzalı, süresi sınırlı çevrimdışı yetki kaydı (`strict_evrakplus`: `{ token, expiresAt }`) hazır olup gerçek API sağlandığında tek ayarla etkinleştirilebilir.

## 3. Toplam Otomatik Test Özeti
- **Python OR-Tools CP-SAT Testleri (`pytest -v tests`):** **29 / 29 BAŞARILI**
- **Node Çevrimdışı / Güvenlik / Editör / Çıktı / EXE Testleri (`node --test`):** **10 / 10 BAŞARILI**
- **Toplam:** **39 / 39 Otomatik Test BAŞARILI (0 Başarısız)**

## 4. Manuel Görsel Doğrulama Bekleyen Maddeler
- **Python/Node kurulu olmayan temiz bir Windows bilgisayarda internet kesilerek `Okul-Ders-Dagitim-Setup-1.3.0.exe` kurulum ve gerçek yazıcı/PDF görsel baskı testi:** Geliştirme ortamında Python/Node kurulu olduğundan temiz hedef bilgisayarda görsel onay yapılmalıdır.


---

## Aşama 5 (v1.4.0) — EvrakPlus Üyelik, Güvenli Masaüstü Oturumu, Bulut Senkronizasyonu ve WordPress Köprüsü

- **Python OR-Tools CP-SAT Testleri (`.venv\Scripts\pytest.exe -v tests`):** **29 / 29 BAŞARILI** (264.24s) — Aşama 1–4'teki tüm kısıt, 100+ öğretmen yük, ikili öğretim, kilit, bölgesel yeniden dağıtım ve doğrulama testleri eksiksiz korundu.
- **JavaScript / Electron / EvrakPlus Entegrasyon Testleri (`npm run test:js`):** **13 / 13 BAŞARILI** (3.94s):
  - `tests/test_evrakplus_sync.mjs`: HTTPS zorunluluğu ve dış URL izin listesi, cihaz eşleştirme (`POST /auth/device` → `202` → `POST /auth/token`), Windows DPAPI (`safeStorage`) şifreli oturum kaydı, ham belirteç sızıntısı önleme, giriş yapmadan çıktı kapısının engellenmesi, giriş sonrası 7 günlük çevrimdışı çıktı yetkisi ve 8. günde süre dolumu reddi, 120 öğretmenlik büyük okul bulut senkronizasyonu (<3s), iyimser kilitleme `409 Conflict` tespiti, kullanıcı izolasyonu (User B → User A projesi 404), refresh token rotation, logout sonrası sunucu+yerel oturum silme, WordPress eklentisi 9 REST uç noktası ve statik SQL/CSRF/veri koruma kontrolü.
  - `tests/test_export_engine.mjs` & `tests/test_import_export.mjs`: Tüm Aşama 1–4 testleri geçti.
- **Üretilen Dağıtım Paketleri:**
  - `release/Okul-Ders-Dagitim-Setup-1.4.0.exe`
  - `release/evrakplus-ders-dagitim-bridge-1.0.0.zip`
- **Canlı Sunucu Notu:** `https://www.evrakplus.com/` cPanel/WordPress sunucusuna doğrudan erişim bulunmadığından ve yerel makinede PHP CLI kurulu olmadığından, WordPress eklentisinin canlı PHP çalıştırma ve gerçek EvrakPlus hesabı eşleştirme doğrulaması eklenti canlı siteye yüklendikten sonra yapılmalıdır.


---

## Aşama 6 (v1.0.0 Kararlı Sürüm Adayı) — Windows EXE, GitHub Güncelleme, Yedekleme ve Performans

- **Python OR-Tools CP-SAT Testleri (`pytest -v tests`):** **29 / 29 BAŞARILI**
- **JavaScript / Electron / EvrakPlus / Güncelleme / Yedekleme Testleri (`npm run test:js`):** **17 / 17 BAŞARILI** (`3.49s`):
  - `tests/test_release_v6.mjs`: Ed25519 manifest imza/doğrulama ve sahte manifest reddi, `UpdaterService` kullanıcı onayı kuralları (`autoDownload=false`, `autoInstallOnAppQuit=false`, `allowPrerelease=false`), güncelleme öncesi otomatik yedek, çevrimdışı mesajı, yerel yedek saklama sınırı + hassas alan temizliği, sürümlü şema migrasyonu, crash recovery, arındırılmış hata raporu, başlangıç kontrolleri, `.gitignore` ve `electron-builder.yml` doğrulamaları.
- **4 Okul Profili Performans Ölçümü (`scripts/run_perf_benchmarks.py`):** 10/5, 30/15, 70/30 ve 120/50 okulların tamamı **%100 bağımsız doğrulamadan geçti**; çözülemez ve 1 sn zaman sınırı senaryoları doğru biçimde reddedildi (`docs/PERFORMANS_RAPORU.md`).
- **Bağımsız Gömülü EXE Doğrulaması:** `release/win-unpacked/resources/solver_ortools/solver_ortools.exe --info` boş `PATH=""` ile çıkış kodu `0` döndürdü (`21` DLL dahil).
- **Üretim Öncesi Kalan Dış Bağımlılıklar:** Kod imzalama sertifikası (`CSC_LINK`), canlı GitHub Releases yayını, canlı `evrakplus.com` WordPress eklenti kurulumu ve ayrı temiz Windows 10/11 VM 20 adımlı kurulum testi (`docs/TEMIZ_WINDOWS_TEST_RAPORU.md` ve `docs/BILINEN_SORUNLAR.md`).
