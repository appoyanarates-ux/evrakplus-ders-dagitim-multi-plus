# Bilinen Sorunlar ve Üretim Öncesi Gereksinimler (v1.0.0)

## 1. Dış Hizmet / Sertifika / Ortam Gerektiren Maddeler (Üretim Yayını Öncesi Zorunlu)
1. **Windows Kod İmzalama Sertifikası Eksikliği:** Yerel ortamda üretilen `EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe` geliştirme/aday paketi imzasızdır. Kararlı üretim dağıtımı ve `electron-updater` canlı güncelleme doğrulaması için geçerli bir Windows kod imzalama sertifikası (`CSC_LINK`) ve Ed25519 manifest anahtarı (`EPDD_ED25519_PRIVATE_KEY`) gereklidir.
2. **GitHub Deposu ve Canlı Releases Akışı:** Yerel ortamdan GitHub hesabına yetkili erişim olmadığı için `windows-release.yml` iş akışı ve canlı `1.0.0 -> 1.1.0` GitHub Releases indirme/güncelleme testi henüz gerçek GitHub üzerinde çalıştırılmamıştır.
3. **Canlı EvrakPlus WordPress Sunucusu (`https://www.evrakplus.com/`):** `evrakplus-ders-dagitim-bridge-1.0.0.zip` eklentisi gerçek REST sözleşmesine karşı yerel mock sunucuda uçtan uca test edilmiştir; ancak yerel makinede PHP CLI bulunmadığından ve canlı cPanel/WordPress erişimi olmadığından canlı sunucu aktivasyon ve gerçek üye eşleştirme testi kurulum sonrasında yapılmalıdır.
4. **Ayrı Temiz Windows 10/11 Sanal Makine Testi:** Gömülü `solver_ortools.exe` bağımsız yürütme ve Windows NSIS paketleme mevcut Windows 10 host üzerinde doğrulanmıştır; ancak Python ve Node hiç kurulmamış **temiz bir Windows 10/11 VM** üzerinde 20 adımlı tam kurulum/kaldırma kabul testi henüz harici VM'de yürütülmemiştir.

## 2. Teknik Sınırlar (Tasarım Gereği)
- **Web/PWA Otomatik Dağıtım:** Sunucu tarafında uzak bir Python OR-Tools servisi tanımlanmadıkça Web/PWA sürümü otomatik ders dağıtımı yapmaz (JavaScript çözücü kesinlikle kullanılmaz).
- **İşletim Sistemi Ekran Görüntüsü Koruması:** PDF/Excel/Yazdırma kapısı hem arayüzde hem Electron ana sürecinde (IPC) denetlenir; ancak işletim sistemi düzeyindeki ekran görüntüsü araçları yazılım tarafından engellenemez.
- **Çok Büyük Okul Çözüm Süresi:** 120+ öğretmen ve yoğun kısıtlı senaryolarda OR-Tools CP-SAT çözüm süresi modele göre değişebilir; zaman sınırı dolduğunda bulunan en iyi geçerli çözüm (`FEASIBLE`) veya tanı raporu döndürülür.
