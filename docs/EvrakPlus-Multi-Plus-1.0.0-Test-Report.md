# EvrakPlus Ders Dağıtım Multi Plus — v1.0.0 Gerçek Test Raporu

- **Tarih:** 2026-11-24
- **İşletim Sistemi / Mimari:** Windows 64-bit (`x64`)
- **Çalışma Ortamları:** Node.js `v24.22.1`, Python `3.12.10` (`.venv`), Gömülü Eclipse Temurin OpenJDK `21.0.13.1 LTS`, Gömülü MiniZinc `2.11.0`
- **Doğrulayıcı:** Tüm çizelgeler **EvrakPlus Independent Schedule Validator** tarafından bağımsız olarak doğrulanmıştır.

---

## 1. Altı Optimizasyon Motoru Sağlık ve Sürüm Doğrulaması

| Motor | Sürüm | Lisans | Sağlık | Görevi / Not |
|---|---|---|---|---|
| **Google OR-Tools CP-SAT** | `9.15.6755` | Apache-2.0 | Sağlıklı | Ana dağıtım motoru (çok çekirdek, solution hint) |
| **Timefold Solver** | `1.17.0` | Apache-2.0 | Sağlıklı | Alternatif çözüm ve kalite iyileştirme (gömülü JDK 21) |
| **Choco Solver** | `4.10.18` | BSD-4-Clause | Sağlıklı | Karmaşık kısıtlar, bina geçişi, çoklu alternatifler (gömülü JDK 21) |
| **MiniZinc** | `2.11.0` (`Gecode 6.6.0` / `Chuffed 0.14.0`) | MPL-2.0 | Sağlıklı | Modelleme katmanı + bağımsız Gecode/Chuffed çözücüleri |
| **SCIP** | `9.02` (`PySCIPOpt 5.7.1`) | Apache-2.0 | Sağlıklı | Karma tamsayılı matematiksel optimizasyon (MILP) |
| **HiGHS** | `1.16.0` | MIT | Sağlıklı | Karma tamsayılı doğrusal optimizasyon (MIP/MILP) |

---

## 2. Altı Ölçekli Gerçek Okul Performans Test Sonuçları (`tests/benchmarks/run-benchmarks.js`)

| Okul Profili (Öğr / Şube) | Blok | Motor | Durum | Geçerli | Süre (ms) | Atanan / Toplam | Zorunlu İhlal | Öğr. Boşluk | Kalite (/100) |
|---|---:|---|---|---|---:|---:|---:|---:|---:|
| Çok Küçük Okul (10 / 5) | 85 | `ortools` | **OPTIMAL** | Evet | 855 | 85 / 85 | 0 | 0 | **87.39** |
| Çok Küçük Okul (10 / 5) | 85 | `timefold` | **FEASIBLE** | Evet | 15.688 | 85 / 85 | 0 | 0 | **88.16** |
| Çok Küçük Okul (10 / 5) | 85 | `choco` | **FEASIBLE** | Evet | 617 | 85 / 85 | 0 | 11 | **69.22** |
| Çok Küçük Okul (10 / 5) | 85 | `minizinc` (Gecode) | **FEASIBLE** | Evet | 1.571 | 85 / 85 | 0 | 8 | **71.04** |
| Çok Küçük Okul (10 / 5) | 85 | `scip` | **FEASIBLE** | Evet | 14.189 | 85 / 85 | 0 | 28 | **74.94** |
| Çok Küçük Okul (10 / 5) | 85 | `highs` | **OPTIMAL** | Evet | 14.704 | 85 / 85 | 0 | 30 | **74.38** |
| Küçük Okul (25 / 12, kapalı günlü) | 204 | `ortools` | **OPTIMAL** | Evet | 7.052 | 204 / 204 | 0 | 0 | **87.22** |
| Küçük Okul (25 / 12, kapalı günlü) | 204 | `timefold` (sıfırdan, 20 sn) | **INFEASIBLE** | Hayır | 20.949 | 0 / 204 | 0 | 0 | **0.00** *(Not 1)* |
| Küçük Okul (25 / 12, kapalı günlü) | 204 | `choco` | **FEASIBLE** | Evet | 1.507 | 204 / 204 | 0 | 43 | **63.28** |
| Küçük Okul (25 / 12, kapalı günlü) | 204 | `minizinc` (Gecode) | **FEASIBLE** | Evet | 2.127 | 204 / 204 | 0 | 52 | **62.32** |
| Küçük Okul (25 / 12, kapalı günlü) | 204 | `highs` | **FEASIBLE** | Evet | 20.232 | 204 / 204 | 0 | 97 | **67.20** |
| Orta Okul (50 / 24, kapalı günlü) | 408 | `ortools` | **OPTIMAL** | Evet | 10.123 | 408 / 408 | 0 | 0 | **86.69** |
| Orta Okul (50 / 24, kapalı günlü) | 408 | `choco` | **FEASIBLE** | Evet | 2.673 | 408 / 408 | 0 | 106 | **61.62** |
| Büyük Okul (100 / 45, kapalı günlü) | 765 | `ortools` | **OPTIMAL** | Evet | 37.423 | 765 / 765 | 0 | 0 | **86.88** |
| Çok Büyük Okul (150 / 65, kapalı günlü) | 1.105 | `ortools` | **FEASIBLE** | Evet | 52.532 | 1.105 / 1.105 | 0 | 82 | **69.31** |
| **Ultimate Okul (250 / 100, kapalı günlü)** | **1.700** | `ortools` | **FEASIBLE** | **Evet** | **63.888** | **1.700 / 1.700** | **0** | **161** | **69.19** |

> **Not 1:** Timefold Solver metaheuristik tabanlı olduğu için sıkı kapalı günlü 25/12 probleminde 20 sn limitinde sıfırdan 0 hard ihlale inemedi; bu nedenle Akıllı/Hibrit modda önce **OR-Tools CP-SAT** geçerli çözüm üretir, ardından **Timefold** warm-start ile kaliteyi iyileştirir.  
> **Not 2 (Testte Yakalanan ve Düzeltilen 2 Gerçek Hata):** (a) 0 blok atanmış boş çizelgenin puanlaması `0.00` olacak şekilde `scorer.js` düzeltildi. (b) Eksik/çöken motor alt sürecinde `proc.stdin` yazma hatası (`write EOF`) tüm adaptörlerde `proc.stdin.on('error', () => {})` ile izole edildi.

---

## 3. Güvenlik, Dayanıklılık ve Özellik Testleri Özeti

| Test Grubu | Dosya | Kapsam | Sonuç |
|---|---|---|---|
| Ortak Veri Modeli & Migrasyon | `core-schema.test.js` | 11 MEB türü, 18 menü, v2→v3 migrasyon, şema reddi, token temizleme | **GEÇTİ** |
| Bağımsız Doğrulayıcı & PASS 0 | `validator.test.js` | Çakışma reddi, bina geçişi, paralel grup, Hall gün grubu kontrolü | **GEÇTİ** |
| 6 Optimizasyon Motoru & Orkestratör | `ortools/timefold/choco/minizinc/scip/highs/multi-solver.test.js` | 6 gerçek motor + Paralel/Hibrit/Akıllı modlar | **GEÇTİ** |
| Manuel Ders Dağıtımı | `manual-editor.test.js` | Kilitleme kapsamları, undo/redo, kısmi yeniden dağıtım, çizelge farkı | **GEÇTİ** |
| Electron Masaüstü & SQLite | `desktop-electron.test.js` | Yerel SQLite CRUD, KVKK token temizliği, `contextIsolation/sandbox/CSP` | **GEÇTİ** |
| cPanel PHP & Mobil PWA | `web-php-cpanel.test.js`, `pwa.test.js` | `.htaccess` izolasyonu, PDO/CSRF, `INSTALL.LOCK`, PWA yetenekleri | **GEÇTİ** |
| Linux FastAPI Solver Server | `solver-server.test.js` | Canlı HTTP `/health`, `/engines`, `/jobs`, `/progress`, `/result`, `/cancel` | **GEÇTİ** |
| WordPress PKCE & Ed25519 Yetki | `wp-auth.test.js`, `reports.test.js` | PKCE S256, Ed25519 imza/tahrifat/süre/cihaz reddi, yetkisiz çıktı engeli | **GEÇTİ** |
| Bulut Senkronizasyonu | `sync-engine.test.js` | 3 cihaz akışı, çevrimdışı kuyruk, 409 Conflict + `keep_both`, tombstone | **GEÇTİ** |
| Güncelleyici & Dayanıklılık | `updater.test.js`, `resilience.test.js` | HTTPS zorunluluğu, SHA-256 reddi, otomatik rollback, motor çökme/iptal | **GEÇTİ** |

---

## 4. Harici Ortam Gerektiren Kontroller (Şeffaf Beyan)

- **Temiz Windows Sanal Makinesi (Python & Java kurulu değilken)**: Final EXE paketleri üretildikten sonra temiz Windows 10/11 VM üzerinde doğrulanmalıdır.
- **Canlı Apache/PHP/MySQL cPanel & Canlı WordPress Sitesi**: Geliştirme makinesinde `php`, `mysql` ve `docker` kurulu olmadığından canlı cPanel/WordPress ve Docker imaj derleme testleri hedef sunucuda yürütülmelidir.
