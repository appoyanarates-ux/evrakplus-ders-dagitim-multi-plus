=== EvrakPlus Ders Dağıtım Köprüsü ===
Contributors: evrakplus
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

EvrakPlus – Okul Ders Dağıtım Programı (Windows EXE & Web/PWA) için WordPress üyelik, cihaz eşleştirme, 7 günlük çevrimdışı çıktı yetkisi ve bulut proje senkronizasyon eklentisi.

== Kurulum (cPanel / WordPress) ==
1. Kurulumdan önce mevcut WordPress dosyalarınızın ve veritabanınızın tam yedeğini alın.
2. WordPress Yönetim Paneli > Eklentiler > Yeni Ekle > Eklenti Yükle bölümünden `evrakplus-ders-dagitim-bridge-1.0.0.zip` dosyasını yükleyin ve etkinleştirin.
3. Eklenti etkinleştirildiğinde `wp_epdd_*` tabloları otomatik oluşturulur; mevcut tema ve eklentiler değiştirilmez.
4. Ayarlar > Kalıcı Bağlantılar (Permalinks) sayfasını açıp "Değişiklikleri Kaydet"e basarak `/evrakplus-ders-dagitim-giris/` adresinin aktif olduğunu doğrulayın.
5. Sol menüdeki "Ders Dağıtım Yönetimi" bölümünden sistem durumunu ve ayarları yönetebilirsiniz.

== Güvenlik ve KVKK ==
* İkinci bir kullanıcı veritabanı oluşturulmaz; mevcut `wp_users` hesapları kullanılır.
* Refresh token'lar yalnızca SHA-256 hash olarak saklanır.
* Eklenti devre dışı bırakıldığında kullanıcı verileri silinmez.
* Yönetici panelindeki Bulut Projeleri listesi öğretmen adlarını veya ders programı içeriklerini göstermez.
