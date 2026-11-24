# EvrakPlus – Ders Dağıtım Programı Kurulum, Güvenlik ve KVKK Raporu (v1.4.0)

## 1. Teslim Edilen Paketler

1. **Windows Masaüstü Kurulum Paketi (NSIS):** `release/Okul-Ders-Dagitim-Setup-1.4.0.exe`
   - Gömülü Google OR-Tools CP-SAT motoru (`solver_ortools.exe`, 100% internetsiz çalışır).
   - EvrakPlus üyelik alanı, cihaz eşleştirme, 7 günlük çevrimdışı çıktı yetkisi, bulut senkronizasyonu ve çakışma çözümü.
2. **WordPress Köprü Eklentisi (cPanel / WP Yüklenebilir ZIP):** `release/evrakplus-ders-dagitim-bridge-1.0.0.zip`
   - Mevcut WordPress tema ve eklentilerine dokunmaz.
   - Eklenti devre dışı bırakıldığında kullanıcı verilerini silmez.
3. **Web / PWA Desteği:** `renderer/manifest.webmanifest` ve `renderer/sw.js` (çevrimdışı kabuk önbelleği).
   - Web sürümünde otomatik ders dağıtımı yalnızca WordPress ayarlarında uzak bir Python OR-Tools servis URL'si tanımlandığında etkinleşir; **JavaScript çözücü kesinlikle kullanılmaz**.

---

## 2. cPanel / WordPress Canlı Kurulum Adımları

> **ÖNEMLİ:** Canlı `https://www.evrakplus.com/` sitesine yükleme yapmadan önce mutlaka tam dosya + MySQL veritabanı yedeği alın.

1. WordPress Yönetim Paneli → **Eklentiler → Yeni Ekle → Eklenti Yükle** ekranından `evrakplus-ders-dagitim-bridge-1.0.0.zip` dosyasını yükleyin ve **Etkinleştir**'e tıklayın.
2. Etkinleştirme sırasında `wp_epdd_device_codes`, `wp_epdd_tokens`, `wp_epdd_projects`, `wp_epdd_project_history` ve `wp_epdd_audit_logs` tabloları `dbDelta` ile otomatik oluşturulur. (Manuel referans SQL: `evrakplus-ders-dagitim-bridge/migrations/001_initial_schema.sql`).
3. **Ayarlar → Kalıcı Bağlantılar** sayfasını açıp **Değişiklikleri Kaydet** düğmesine basarak `/evrakplus-ders-dagitim-giris/` adresini etkinleştirin.
4. Sol menüdeki **Ders Dağıtım Yönetimi** ekranından 7 alt bölümü (Genel Durum, Üyelik ve Yetkiler, Bulut Projeleri, Cihaz Oturumları, Senkronizasyon Durumu, Sistem Günlükleri, Ayarlar) doğrulayın.
5. Tarayıcıdan `https://www.evrakplus.com/wp-json/evrakplus-dd/v1/` uç noktasının 200 JSON döndürdüğünü kontrol edin.

---

## 3. Güvenlik ve KVKK Kontrol Listesi

| Kontrol | Durum | Açıklama |
|---|---|---|
| Electron Sandbox & Isolation | Doğrulandı | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` |
| IPC Kaynak Doğrulaması | Doğrulandı | Tüm `ipcMain.handle` çağrıları `file://` kökenini doğrular |
| Content Security Policy (CSP) | Doğrulandı | Yalnızca `'self'` script ve `https://www.evrakplus.com` bağlantısı |
| Dış Bağlantı İzin Listesi | Doğrulandı | `shell.openExternal` yalnızca güvenilir EvrakPlus alan adını açar |
| Şifre Güvenliği | Doğrulandı | WordPress şifreleri masaüstü EXE içine asla kaydedilmez |
| OS Anahtar Deposu (DPAPI) | Doğrulandı | Belirteçler `electron.safeStorage` ile şifrelenir, loglara yazılmaz |
| SQL Enjeksiyon & CSRF | Doğrulandı | Tüm WP sorguları `$wpdb->prepare`, formlar `wp_nonce_field` / `check_admin_referer` kullanır |
| KVKK Opt-in Bulut Senkronizasyonu | Doğrulandı | Varsayılan kapalıdır (`cloudSyncEnabled: false`); kullanıcı onayı olmadan veri gönderilmez |
| Yönetici Gizliliği | Doğrulandı | WP Bulut Projeleri tablosu öğretmen adlarını ve ders programı içeriklerini göstermez |

---

## 4. Canlı Sunucu Doğrulaması Gerektiren Maddeler

Bu çalışma yerel Windows geliştirme ortamında üretilmiş ve otomatik testlerden geçirilmiştir. `https://www.evrakplus.com/` cPanel/WordPress sunucusuna doğrudan erişim olmadığı için aşağıdaki maddeler eklenti canlı siteye yüklendikten sonra doğrulanmalıdır:

1. `evrakplus-ders-dagitim-bridge-1.0.0.zip` dosyasının canlı WordPress PHP sürümünde etkinleştirilmesi ve `php -l` / hata günlüğü kontrolü (yerel makinede PHP CLI kurulu değildir).
2. Gerçek EvrakPlus WordPress üyesiyle tarayıcı cihaz eşleştirme (`/evrakplus-ders-dagitim-giris/`) ve canlı HTTPS senkronizasyonu testi.
3. Mevcut EvrakPlus kayıt, e-posta doğrulama ve şifre sıfırlama akışlarıyla canlı doğrulama.
