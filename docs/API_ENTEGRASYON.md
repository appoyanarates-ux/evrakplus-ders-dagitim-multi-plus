# EvrakPlus – Ders Dağıtım Köprüsü REST API & Entegrasyon Dokümanı (v1.0.0)

**Taban URL:** `https://www.evrakplus.com/wp-json/evrakplus-dd/v1`  
**Kimlik Doğrulama:** Kısa ömürlü HMAC-SHA256 JWT (`Authorization: Bearer <access_token>`) + Dönen (Rotating) Refresh Token  
**Kullanıcı Veritabanı:** Mevcut WordPress `wp_users` tablosu (ikinci kullanıcı veritabanı oluşturulmaz).

---

## 1. Cihaz Eşleştirme (Device Pairing) Akışı

1. Masaüstü uygulaması `POST /auth/device` isteği gönderir.
2. Sunucu tek kullanımlık `device_code`, kullanıcı kodu (`EP-XXXX-XXXX`) ve `verification_url` (`https://www.evrakplus.com/evrakplus-ders-dagitim-giris/?code=...`) döndürür.
3. Electron, sistemin varsayılan tarayıcısında yalnızca güvenilir `https://www.evrakplus.com` adresini açar.
4. Kullanıcı mevcut WordPress hesabıyla giriş yapar ve **"Bu Cihazı Onayla"** düğmesine basar.
5. Masaüstü uygulaması `POST /auth/token` (`grant_type: "device_code"`) ile onay durumunu sorgular. Onaylandığında `access_token`, `refresh_token`, `user` ve **sunucu imzalı 7 günlük çevrimdışı çıktı yetkisi** (`entitlement`) döner.
6. Belirteçler Windows üzerinde `electron.safeStorage` (**Windows DPAPI**) ile şifrelenerek `evrakplus_session.enc` dosyasında saklanır. WordPress şifresi asla kaydedilmez.

---

## 2. Uç Nokta Özeti (9 Uç Nokta)

| # | Metod | Uç Nokta | Yetki | Açıklama |
|---|---|---|---|---|
| 1 | `POST` | `/auth/device` | Açık (Rate Limited) | Tek kullanımlık cihaz eşleştirme kodu ve onay URL'si üretir |
| 2 | `POST` | `/auth/token` | Açık (Rate Limited) | `device_code` veya `refresh_token` karşılığında JWT + yeni refresh token + 7 günlük yetki verir |
| 3 | `GET` | `/auth/me` | Bearer JWT | Oturum açmış WordPress kullanıcısının özet profilini döndürür |
| 4 | `POST` | `/auth/logout` | Bearer JWT | Cihaz oturumunu sunucu tarafında iptal eder |
| 5 | `GET` | `/entitlements` | Bearer JWT | Sunucu imzalı 7 günlük çevrimdışı PDF/Excel/Yazdırma yetkisini yeniler |
| 6 | `GET`, `POST` | `/projects` | Bearer JWT | Kullanıcının yalnızca kendi bulut projelerini listeler veya yeni proje oluşturur |
| 7 | `GET`, `DELETE` | `/projects/{id}` | Bearer JWT | Kullanıcının kendi projesini indirir veya siler (`user_id` izolasyonu zorunlu) |
| 8 | `POST` | `/projects/{id}/sync` | Bearer JWT | İyimser kilitleme (`base_version`) ile senkronizasyon; sürüm uyuşmazsa `409 Conflict` + sunucu kopyası döner |
| 9 | `GET` | `/projects/{id}/history` | Bearer JWT | Projenin son 30 sürüm geçmişini listeler |

---

## 3. Çakışma Çözümü (HTTP 409 Conflict)

`POST /projects/{id}/sync` çağrısında istemcinin gönderdiği `base_version`, sunucudaki `version` değerinden farklıysa (`force: true` değilse) sunucu `409 Conflict` ve `server_project` yedeğini döndürür. Masaüstü uygulaması veri kaybını önlemek için **önce hem yerel hem bulut kopyasını yerel proje arşivine yedekler**, ardından kullanıcıya şu 3 seçeneği sunar:

1. **Yerel sürümü koru ve bulutu güncelle** (`force: true`)
2. **Bulut sürümünü aç**
3. **İkisini ayrı proje olarak sakla** (yeni `project_uuid` ile kayıt)

---

## 4. Çıktı Yetkilendirme ve Çevrimdışı Çalışma

- Ders dağıtımı (Google OR-Tools CP-SAT), manuel düzenleme, kilitleme, görüntüleme ve yerel `.json` yedekleme **tamamen ücretsiz ve üyeliksiz** çalışır.
- PDF, Excel (`.xlsx`), Toplu Çıktı (PDF/ZIP) ve Yazdırma için ücretsiz EvrakPlus üyeliği gereklidir.
- Giriş sonrası alınan sunucu imzalı yetki **7 gün boyunca internetsiz** çalışır (süre WordPress yönetim panelinden değiştirilebilir).
- **Önemli Not (İşletim Sistemi Sınırı):** Uygulama içi PDF/Excel/Yazdırma kapısı hem arayüz hem Electron ana sürecinde (IPC) denetlenir; ancak işletim sistemi düzeyindeki ekran görüntüsü alma araçları (PrintScreen / Ekran Alıntısı) yazılım tarafından engellenemez.
