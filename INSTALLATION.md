# Kurulum Kılavuzu (INSTALLATION)

## 1. Windows Masaüstü (Kurulum ve Taşınabilir Sürüm)
- **Kurulum (Setup):** `EvrakPlus-Ders-Dagitim-Multi-Plus-1.0.0-Setup.exe` dosyasını çalıştırın. Yönetici yetkisi, Python veya Java kurulumu gerekmez; altı optimizasyon motoru ve çalışma ortamları pakete gömülüdür.
- **Taşınabilir (Portable):** `EvrakPlus-Ders-Dagitim-Multi-Plus-1.0.0-Portable.exe` dosyasını doğrudan çalıştırabilirsiniz.

## 2. cPanel Web Sürümü
1. `EvrakPlus-Ders-Dagitim-Multi-Plus-1.0.0-cPanel.zip` paketini `public_html/ders-dagitim-multi-plus/` dizinine çıkarın.
2. Tarayıcıdan `https://www.evrakplus.com/ders-dagitim-multi-plus/install.php` adresini açarak kurulum sihirbazını tamamlayın (PHP, MySQL/MariaDB, dizin izinleri, HTTPS, EvrakPlus üyelik ve optimizasyon servisi kontrolleri otomatik yapılır).
3. Kurulum tamamlandıktan sonra güvenlik için `install.php` dosyasını silin veya erişime kapatın.

## 3. Mobil PWA Kurulumu
- Android Chrome: `https://www.evrakplus.com/ders-dagitim-multi-plus/` adresini açın ve "Uygulamayı Yükle" düğmesine dokunun.
- iOS Safari: Paylaş menüsünden "Ana Ekrana Ekle" seçeneğini kullanın.

## 4. WordPress Üyelik Bağlantı Eklentisi
- `EvrakPlus-Multi-Plus-Connect-1.0.0.zip` eklentisini WordPress Yönetim Paneli > Eklentiler > Yeni Ekle > Eklenti Yükle üzerinden etkinleştirin.

## 5. Bağımsız Linux/VPS Solver Server (İsteğe Bağlı)
1. `EvrakPlus-Ders-Dagitim-Multi-Plus-1.0.0-Solver-Server.zip` dosyasını sunucunuza çıkarın.
2. `.env.example` dosyasını `.env` olarak kopyalayıp `SOLVER_SERVER_API_KEY` değerini tanımlayın.
3. `docker compose up -d --build` komutu ile servisi başlatın.
