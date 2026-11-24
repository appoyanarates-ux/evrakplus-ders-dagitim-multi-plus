# EVRAKPLUS DERS DAĞITIM — SON YAYIN KABUL KONTROLÜ RAPORU

**Tarih:** 23 Kasım 2026  
**Değerlendirilen Sürüm:** `1.0.0` (Aday Derleme — **Üretim Yayınına Henüz Hazır Değildir**)  
**Sonuç Kararı:** **KOŞULLU GEÇTİ / KARARLI YAYIN ENGELLİ** *(Yerel mühendislik, OR-Tools doğrulama ve paketleme gereksinimleri tamamlandı; ancak aşağıdaki 4 dış bağımlılık ve kabul testi tamamlanmadan `Kararlı Sürüm 1.0.0 Yayına Hazır` verilemez.)*

---

## 1. Bu Kontrol Sırasında Tespit Edilip Düzeltilen Gerçek Teknik Eksikler

1. **WordPress ZIP Linux/cPanel Uyumsuzluğu (DÜZELTİLDİ):** Önceki PowerShell `Compress-Archive` çıktısında 7 giriş Windows ters eğik çizgisi (`\`) içeriyordu; Linux cPanel WordPress yükleyicisinde klasör yapısını bozma riski vardı. Saf Node.js POSIX (`/`) ZIP paketleyici (`scripts/create_zip.cjs`) yazıldı ve `evrakplus-ders-dagitim-bridge-1.0.0.zip` **0 ters eğik çizgi** ile yeniden üretildi.
2. **WordPress `dbDelta` & CORS İyileştirmesi (DÜZELTİLDİ):** `includes/class-db.php` içinde `PRIMARY KEY  (id)` (WordPress `dbDelta` kuralı gereği çift boşluk) düzeltildi; `includes/class-rest-api.php` içine yalnızca `/evrakplus-dd/v1/` ve ayarlardaki `allow_pwa_origins` kökenleri için kesin CORS filtresi eklendi.
3. **Ed25519 Manifest İmzalama vs. Windows Kod İmzalama Ayrımı & Fail-Closed Kapı (DÜZELTİLDİ):**
   - `node_modules/electron-updater` (`v6.8.11`) incelemesinde Windows'ta `NsisUpdater.verifySignature()` metodunun yalnızca **Authenticode (.exe)** doğrulaması yaptığı ve `app-update.yml` içinde `publisherName` yoksa imzayı sessizce atladığı; ayrıca `latest.yml.sig` Ed25519 manifest doğrulamasını yerleşik olarak yapmadığı saptandı.
   - `electron/updater_service.cjs` fail-closed hale getirildi: `downloadUpdate()` önce uzak `latest.yml` + `latest.yml.sig` dosyalarını **Ed25519 açık anahtarıyla** doğrular, ardından `electron-updater` indirilen `.exe` için **SHA-512 + Windows Authenticode (`publisherName`)** doğrulaması yapar.
   - `electron-builder.yml` içindeki varsayılan `owner: evrakplus` kaldırılıp `REPLACE_WITH_AUTHORIZED_GITHUB_OWNER` güvenlik işaretçisine çevrildi; `windows-release.yml` gerçek `${{ github.repository_owner }}`, `${{ secrets.WIN_PUBLISHER_NAME }}` ve `${{ secrets.EPDD_ED25519_PUBLIC_KEY }}` değerlerini yalnızca imzalı üretim derlemesinde enjekte eder.
4. **120 Öğretmenli Sert Kısıt Testi & Gerçek OS RAM Ölçümü (DÜZELTİLDİ):** 120 öğretmen / 50 şube testine **20 kilitli ders**, **30 engelli öğretmen** ve **8 özel derslik** eklendi; Python heap (`tracemalloc`) yanında Windows `GetProcessMemoryInfo` ile **gerçek OS süreç pik RAM (RSS)** ayrı ölçüldü.

---

## 2. Gerçekten Test Edilen ve Doğrulanan İşlevler

| Alan | Test Yöntemi | Sonuç |
|---|---|---|
| Python OR-Tools CP-SAT + Bağımsız Doğrulama | `.venv\Scripts\pytest.exe -v tests` | **29 / 29 GEÇTİ** |
| Electron / Çıktı / EvrakPlus / Güncelleme / Yedekleme | `npm run test:js` (`tests/test_*.mjs`) | **17 / 17 GEÇTİ** (`8.45 s`) |
| Paketlenmiş `solver_ortools.exe` Boş `PATH` Çözümü | `release/win-unpacked/resources/solver_ortools/solver_ortools.exe` (`PATH=""`, `PYTHONHOME=""`, `PYTHONPATH=""`) → `--input/--output` + `--validate` | **GEÇTİ** (kilit korundu, `valid: true`, 21 gömülü DLL) |
| 120 Öğretmen / 50 Şube Sert Kısıtlı Dağıtım | `scripts/run_perf_benchmarks.py` (1050 blok, 20 kilit, 30 engelli öğretmen, 8 özel derslik) | **1050/1050 yerleşti**, `locks_preserved: true`, `verified: true`, `114.91 s`, Model `241.0 KB`, Python Heap `34.17 MB`, OS Peak RSS `285.41 MB` |
| Çözülemez & 1 sn Zaman Sınırı Senaryoları | `scripts/run_perf_benchmarks.py` | Doğru biçimde `INFEASIBLE` (`0.19 s`) ve `UNKNOWN` (`verified: false`) döndü |
| Ed25519 Manifest Kapısı (Geçerli + Sahte) | `tests/test_release_v6.mjs` | Geçerli imzada onay, bozuk imzada indirme öncesi blokaj doğrulandı |
| WordPress Köprü REST Sözleşmesi (9 Uç Nokta) | `tests/test_evrakplus_sync.mjs` (yerel mock HTTP sunucu + DPAPI + 409 çakışma + kullanıcı izolasyonu) | **GEÇTİ** (`BACKSLASH_COUNT=0` POSIX ZIP dahil) |
| Aday Kurulum Paketi Üretimi | `electron-builder 25.1.8` + `latest.yml` | `EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe` (`123.53 MB`, SHA-256: `F0595A8732EF5DA0EA5C5ECDFAD58187C1B01A2C55CFD99940BE74611C8E9384`) |

---

## 3. Erişim, Sertifika veya Harici Ortam Gerektiren İşlemler (Tamamlanmadı)

1. **Temiz Windows 10/11 Sanal Makine (VM) 20 Adımlı Kabul Testi:** Python ve Node.js hiç kurulmamış temiz bir Windows makinesinde kurulum, çevrimdışı dağıtım, yeniden açma, güncelleme ve kaldırma testi bu ortamda ayrı VM erişimi olmadığı için **yapılmamıştır**.
2. **Canlı `https://www.evrakplus.com/` WordPress / cPanel Kurulumu ve PHP Doğrulaması:** Canlı sunucu erişimi ve yerel PHP CLI bulunmadığı için `evrakplus-ders-dagitim-bridge-1.0.0.zip` gerçek WordPress üzerinde (tam yedek + test/staging ortamı sonrası) kurulup gerçek üye ile test **edilmemiştir**.
3. **Yetkilendirilmiş GitHub Deposu ve Canlı Releases Akışı:** GitHub hesabı yetkilendirilmediği için depo oluşturulmamış, kod yüklenmemiş ve canlı `1.0.0 → 1.1.0` GitHub güncelleme döngüsü **çalıştırılmamıştır**.
4. **Windows Kod İmzalama Sertifikası (`CSC_LINK`, `WIN_PUBLISHER_NAME`) ve Ed25519 Üretim Anahtarları (`EPDD_ED25519_PRIVATE_KEY` / `PUBLIC_KEY`):** Mevcut yerel `.exe` **imzasız geliştirme/aday paketidir** ve Windows SmartScreen / Defender itibar testinden geçirilmemiştir.

---

## 4. Yayına Engel Olan Sorunlar (Release Blockers)

Aşağıdaki 4 engel giderilmeden `EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe` son kullanıcılara kararlı sürüm olarak **yayımlanmamalıdır**:

- **[ENGEL-1] İmzasız Kurulum Dosyası:** Kod imzalama sertifikası olmadan paket SmartScreen uyarısı verir ve `electron-updater` Authenticode doğrulaması üretimde çalışmaz.
- **[ENGEL-2] Yapılandırılmamış GitHub Yayın Sahibi & Ed25519 Açık Anahtarı:** `app-update.yml` şu an `REPLACE_WITH_AUTHORIZED_GITHUB_OWNER` ve `electron/update_security.json` boş anahtarla fail-closed durumdadır; üretim yayını `windows-release.yml` üzerinden gerçek GitHub Secrets ile yapılmalıdır.
- **[ENGEL-3] Temiz Windows 10/11 VM Testi Eksik:** Gerçek temiz makinede NSIS kurulum + ilk açılış + kaldırma döngüsü doğrulanmalıdır.
- **[ENGEL-4] Canlı EvrakPlus WordPress Köprü Aktivasyonu Eksik:** `evrakplus-ders-dagitim-bridge-1.0.0.zip` canlı/staging sunucuda PHP hata günlüğü ve gerçek WordPress üyesiyle doğrulanmalıdır.
