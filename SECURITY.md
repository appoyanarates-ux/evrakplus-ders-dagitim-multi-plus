# Güvenlik ve KVKK Politikası

## Gizlilik ve Veri Güvenliği
- **Şifre ve Token Güvenliği:** WordPress kullanıcı şifreleri hiçbir zaman yerel uygulamada veya JSON yedeklerinde saklanmaz. Masaüstü oturum belirteçleri Windows DPAPI (`safeStorage`) ile şifrelenir.
- **KVKK Uyumu:** Öğretmen, sınıf ve okul verileri yerel olarak kullanıcının bilgisayarında tutulur. Bulut senkronizasyonu yalnızca kullanıcının açık onayı ve EvrakPlus üyeliğiyle etkinleşir.
- **İzolasyon:** Her optimizasyon motoru bağımsız bir alt süreç (`child_process.spawn`, `shell: false`) olarak çalışır; Electron penceresi `nodeIntegration: false`, `contextIsolation: true` ve `sandbox: true` ile yalıtılmıştır.
- **Private Depo Politikası:** Özel GitHub erişim belirteçleri asla EXE paketlerine gömülmez.

## Güvenlik Açığı Bildirimi
Güvenlik açığı tespiti durumunda lütfen https://www.evrakplus.com/ iletişim kanallarından bildirimde bulununuz.
