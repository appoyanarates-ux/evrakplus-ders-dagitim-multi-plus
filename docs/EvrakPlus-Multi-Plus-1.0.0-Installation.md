# EvrakPlus Ders Dağıtım Multi Plus — v1.0.0 Kurulum Kılavuzu

- **Program:** EvrakPlus Ders Dağıtım Multi Plus (`v1.0.0`)
- **Platform:** EvrakPlus ([https://www.evrakplus.com/](https://www.evrakplus.com/))
- **Uygulama Adresi:** [https://www.evrakplus.com/ders-dagitim-multi-plus/](https://www.evrakplus.com/ders-dagitim-multi-plus/)
- **Üyelik ve Giriş:** [https://www.evrakplus.com/giris](https://www.evrakplus.com/giris)

---

## 1. Windows Masaüstü Kurulumu (Windows 10 / 11 — 64-bit)

### A. Kurulabilir Sürüm (`EvrakPlus-Multi-Plus-1.0.0-Setup.exe`)
1. `SHA256SUMS.txt` ile dosya bütünlüğünü doğrulayın.
2. `EvrakPlus-Multi-Plus-1.0.0-Setup.exe` dosyasını çalıştırın ve kurulum dizinini seçin.
3. Python, Java veya MiniZinc kurmanıza gerek yoktur; 6 optimizasyon motoru ve uyumlu çalışma ortamları (`resources/runtime/python`, `resources/runtime/java`, `resources/engines/*`) paket içinde gömülüdür.
4. Uygulamayı başlatın. Yerel veri girişi, otomatik dağıtım ve JSON yedekleme **internet ve üyelik olmadan** çalışır.

### B. Taşınabilir Sürüm (`EvrakPlus-Multi-Plus-1.0.0-Portable.exe`)
1. Kurulum gerektirmez; herhangi bir klasörden veya USB bellekten doğrudan çalıştırılabilir.

---

## 2. cPanel Web & Mobil PWA Kurulumu (`EvrakPlus-Multi-Plus-1.0.0-cPanel.zip`)

1. cPanel Dosya Yöneticisi üzerinden `public_html/ders-dagitim-multi-plus/` dizinini oluşturun (WordPress ana sitesi `public_html/` klasörünü etkilemez).
2. `EvrakPlus-Multi-Plus-1.0.0-cPanel.zip` arşivini bu dizine çıkarın.
3. cPanel → MySQL Veri Tabanları bölümünden yeni bir veri tabanı ve kullanıcı oluşturun.
4. Tarayıcıdan `https://www.evrakplus.com/ders-dagitim-multi-plus/installer/` adresine gidin.
5. Sistem gereksinimlerini (PHP >= 8.1, `pdo_mysql`, `curl`, `openssl`, HTTPS) kontrol edip MySQL ve varsa Linux Solver Server bilgilerini girin.
6. Kurulum tamamlandığında `installer/INSTALL.LOCK` otomatik oluşur ve sihirbaz kilitlenir.
7. *(Önerilen ek güvenlik)*: `config/config.php` dosyasını `public_html` dışına `/home/<cpanel_user>/evrakplus_multiplus_config.php` olarak taşıyabilirsiniz.

---

## 3. Linux Optimizasyon Sunucusu (`EvrakPlus-Multi-Plus-1.0.0-Solver-Server.zip`)

Paylaşımlı cPanel sunucularında uzun süreli native optimizasyon çalıştırılamayacağından web ve mobil PWA kullanıcıları için ayrı Linux VPS önerilir:

```bash
unzip EvrakPlus-Multi-Plus-1.0.0-Solver-Server.zip -d /opt/evrakplus-solver
cd /opt/evrakplus-solver/apps/solver-server
export EVRAKPLUS_SOLVER_TOKEN="GUCLU_RASTGELE_ANAHTAR"
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

Ters vekil (Nginx/Caddy) arkasında HTTPS ile `https://solver.evrakplus.com` olarak yayınlayın ve cPanel yapılandırmasına girin.

---

## 4. WordPress Üyelik ve Senkronizasyon Eklentisi (`EvrakPlus-Multi-Plus-Connect-1.0.0.zip`)

1. WordPress Yönetici Paneli → **Eklentiler → Yeni Ekle → Eklenti Yükle** ekranına gidin.
2. `EvrakPlus-Multi-Plus-Connect-1.0.0.zip` dosyasını yükleyip etkinleştirin.
3. Eklenti mevcut WordPress kullanıcı tablosunu (`wp_users`) kullanır, yeni kullanıcı tablosu oluşturmaz ve ana sitenizi bozmaz.
4. Etkinleştirme sonrası `/wp-json/evrakplus/v1/auth/*`, `/entitlements` ve `/sync/*` uç noktaları HTTPS üzerinden aktif olur.

---

## 5. Mobil PWA Kurulumu (Android / iOS / Tablet)

- **Android (Chrome/Edge):** Uygulama adresini açın ve üst çubuktaki **Uygulamayı Yükle** butonuna dokunun.
- **iOS (Safari):** Uygulama adresini açın → Paylaş → **Ana Ekrana Ekle**.
- İnternet kesildiğinde değişiklikler IndexedDB kuyruğunda saklanır; bağlantı geldiğinde otomatik senkronize edilir.
