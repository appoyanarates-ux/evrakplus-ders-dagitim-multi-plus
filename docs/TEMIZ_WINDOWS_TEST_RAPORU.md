# Temiz Windows Kurulum ve Kabul Testi Raporu (v1.0.0)

**Önemli Dürüstlük Beyanı (Bölüm 16 & 21):**
Bu rapor, **mevcut Windows 10 x64 geliştirme makinesinde gerçekten doğrulanan** maddeler ile **ayrı bir temiz Windows 10/11 sanal makinesi, kod imzalama sertifikası ve canlı dış sunucu hesapları gerektiren** maddeleri kesin biçimde ayırır. Gerçekleştirilmemiş hiçbir dış ortam testi tamamlanmış gibi gösterilmemiştir.

---

## 1. Bu Makinede Gerçekten Doğrulanan Maddeler

| Test Maddesi | Sonuç | Kanıt / Detay |
|---|---|---|
| NSIS x64 kurulum dosyasının üretilmesi | **GEÇTİ** | `release/EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe` (SHA-256: `B4A04FFFDDCBA63C0AFD67D8E8318B737B2D3FE9E95F1602BBFAA773426909C0`) |
| Özel uygulama simgesi (`build/icon.ico`) gömülmesi | **GEÇTİ** | `electron-builder` çıktısında varsayılan simge uyarısı kalmadı |
| Gömülü OR-Tools EXE'nin **boş `PATH` (`PATH=""`)** ile çalışması | **GEÇTİ** | `release/win-unpacked/resources/solver_ortools/solver_ortools.exe --info` çıkış kodu `0`, OR-Tools `9.14.6206`, Python `3.12.10`, **21 DLL** pakette mevcut |
| Gerçek OR-Tools CP-SAT çözümü ve bağımsız doğrulama | **GEÇTİ** | `pytest` **29/29**, 4 okul profili (10/5 → 120/50) **%100 `verified: true`** |
| Manuel taşıma, blok bütünlüğü, kilitleme, 35 adımlı Undo/Redo | **GEÇTİ** | `tests/test_import_export.mjs` geçti |
| Gerçek 7 sayfalı `.xlsx` üretimi ve PDF/A3-A4 çarşaf şablonları | **GEÇTİ** | `tests/test_export_engine.mjs` geçti |
| EvrakPlus cihaz eşleştirme, 7 günlük çevrimdışı yetki, 409 çakışma, DPAPI | **GEÇTİ** | `tests/test_evrakplus_sync.mjs` yerel mock REST API ile geçti |
| Ed25519 manifest imza doğrulama, onaylı güncelleme, yedekleme/migrasyon | **GEÇTİ** | `tests/test_release_v6.mjs` geçti |
| Kaldırma sırasında kullanıcı verilerini koruma yapılandırması | **GEÇTİ** | `deleteAppDataOnUninstall: false` + `build/installer.nsh` Türkçe bildirim |

---

## 2. Harici Temiz Windows 10/11 VM ve Canlı Servis Gerektiren Maddeler (BEKLİYOR)

Aşağıdaki kabul adımları, Python/Node hiç kurulmamış ayrı bir temiz Windows 10/11 ortamı, geçerli kod imzalama sertifikası ve canlı GitHub/cPanel erişimi sağlandığında tamamlanmalıdır:

1. **Temiz Windows 10/11 VM üzerinde 20 adımlı kurulum & kaldırma testi** (İnternet kapalıyken kurulum, sıfırdan proje, OR-Tools dağıtım, yeniden başlatma, kaldırma sonrası proje dosyalarının korunduğunun gözlemlenmesi).
2. **Geçerli Kod İmzalama Sertifikası (`CSC_LINK`) ve Windows SmartScreen / Defender taraması** (Mevcut yerel EXE imzasız geliştirme/aday paketidir; imzasız paket kararlı üretim sürümü olarak yayınlanmamalıdır).
3. **Canlı GitHub Releases (`1.0.0 → 1.1.0`) güncelleme akışı** (Ed25519 imzalı `latest.yml.sig` + imzalı kurulum dosyasının gerçek GitHub Releases'tan indirilip onaylı kurulması).
4. **Canlı `https://www.evrakplus.com/` cPanel/WordPress kurulumu** (`evrakplus-ders-dagitim-bridge-1.0.0.zip` aktivasyonu, gerçek WordPress üyesiyle giriş, canlı PDF/Excel çıktısı ve canlı bulut senkronizasyonu).
