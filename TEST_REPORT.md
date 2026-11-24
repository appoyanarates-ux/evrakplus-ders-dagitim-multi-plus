# EvrakPlus Ders Dağıtım Multi Plus v1.0.0 — Gerçek Test ve Performans Raporu

**Tarih:** 2026-11-24  
**Test Ortamı:** Windows 10 x64, 4 CPU Çekirdeği, 4 GB RAM  
**Bağımsız Doğrulayıcı:** `EvrakPlus Independent Schedule Validator`

---

## 1. Altı Optimizasyon Altyapısı Gerçek Sürüm ve Sağlık Kontrolü

Gömülü `multi_solver_engine.exe --health-all` gerçek çıktısı (`available_engines: 6/6`):

| # | Motor | Gerçek Sürüm | Durum |
|---|---|---|---|
| 1 | Google OR-Tools CP-SAT | `Google OR-Tools 9.15.6755` | ✅ Aktif (`available: true`) |
| 2 | Timefold Solver | `Timefold Solver 1.17.0 (Java 21.0.13.1)` | ✅ Aktif (`available: true`, paylaşımlı gömülü `jlink` JRE) |
| 3 | Choco Solver | `Choco Solver 4.10.14 (Java 21.0.13.1)` | ✅ Aktif (`available: true`, paylaşımlı gömülü `jlink` JRE) |
| 4 | MiniZinc | `MiniZinc 2.11.0 (Gecode 6.6.0 & Chuffed 0.14.0)` | ✅ Aktif (`available: true`) |
| 5 | SCIP | `SCIP 10.0.0 [LP solver: SoPlex 8.0.0]` | ✅ Aktif (`available: true`) |
| 6 | HiGHS | `HiGHS 1.16.0 (highspy 1.16.0)` | ✅ Aktif (`available: true`) |

---

## 2. Otomatik Test Sonuçları (70 / 70 BAŞARILI)

- **Python Test Paketi (`pytest -v tests`):** **43 / 43 PASSED**
  - `tests/test_multi_solver.py`: 11/11 PASSED (6 motorun tekil sağlık + gerçek çözüm + bağımsız doğrulama, MiniZinc Chuffed arka ucu, Hibrit [OR-Tools + Timefold warm-start + HiGHS], Paralel, Sıralı, geçersiz çizelge asla geçerliyi geçemez).
  - `tests/test_solver.py`: 20/20 PASSED (1/1, 50+, 100+ öğretmen, ikili öğretim fiziksel zaman çakışması, kapalı gün/saat, özel derslik, iki öğretmenli alt grup, ortak seçmeli, kilitli ders/öğretmen, bina geçiş süresi, en az değişiklikle onarım).
  - `tests/test_constraints.py`: 10/10 PASSED (INFEASIBLE UNSAT çekirdek tespiti, bozulmuş çözüm yakalama).
  - `tests/test_import_export.py`: 2/2 PASSED (eski JSON/kilit göçü, gün indeksi eşlemesi).
- **JavaScript / Electron / PWA / Sync Test Paketi (`npm run test:js`):** **27 / 27 PASSED**
  - Gömülü `multi_solver_engine.exe` uçtan uca çözüm + gerçek alt süreç iptali (`cancel/kill`)
  - 7 sayfalı gerçek `.xlsx` ve toplu PDF şablonları, formül enjeksiyon koruması
  - EvrakPlus cihaz eşleştirme, 7 günlük çevrimdışı çıktı yetkisi, 409 çakışma korumalı bulut senkronizasyonu
  - Okul Nöbeti, Programı Kontrol Et tam adres denetimi, Mobil PWA (Manifest/SW/PNG ikonlar)
  - Ed25519 güncelleme manifesti doğrulaması, otomatik yerel yedekleme ve kurtarma.

---

## 3. Altı Okul Profili Gerçek Performans Karşılaştırması

Bütün çözümler **EvrakPlus Independent Schedule Validator** ile doğrulanmış ve **100 üzerinden ortak kalite puanı** ile ölçülmüştür.

| Okul Profili | Öğretmen / Şube | Motor | Durum | Geçerli | Atanan Blok | Süre (sn) | Ortak Kalite Puanı |
|---|---:|---|---|:---:|---:|---:|---:|
| Küçük | 10 / 5 | SCIP 10.0 | OPTIMAL | ✅ | 60/60 | 4.56 | **99.20 / 100** |
| Küçük | 10 / 5 | MiniZinc (Gecode 6.6) | OPTIMAL | ✅ | 60/60 | 7.33 | **95.20 / 100** |
| Küçük | 10 / 5 | Google OR-Tools 9.15 | OPTIMAL | ✅ | 60/60 | 11.26 | **82.40 / 100** |
| Küçük | 10 / 5 | Timefold 1.17 | FEASIBLE | ✅ | 60/60 | 14.44 | **82.40 / 100** |
| Küçük | 10 / 5 | Choco 4.10 | OPTIMAL | ✅ | 60/60 | 6.08 | **68.00 / 100** |
| Küçük | 10 / 5 | HiGHS 1.16 | OPTIMAL | ✅ | 60/60 | 4.14 | **66.40 / 100** |
| Normal | 25 / 12 | SCIP 10.0 | OPTIMAL | ✅ | 144/144 | 7.49 | **88.48 / 100** |
| Normal | 25 / 12 | Google OR-Tools 9.15 | OPTIMAL | ✅ | 144/144 | 13.19 | **80.00 / 100** |
| Normal | 25 / 12 | Timefold 1.17 | FEASIBLE | ✅ | 144/144 | 22.46 | **77.49 / 100** |
| Normal | 25 / 12 | Choco 4.10 | OPTIMAL | ✅ | 144/144 | 13.70 | **71.36 / 100** |
| Normal | 25 / 12 | HiGHS 1.16 | OPTIMAL | ✅ | 144/144 | 5.99 | **71.20 / 100** |
| Normal | 25 / 12 | MiniZinc (Gecode 6.6) | TIME_LIMIT | ❌ | 0/144 | 18.87 | 0.00 / 100 |
| Orta | 50 / 24 | Google OR-Tools 9.15 | OPTIMAL | ✅ | 288/288 | 36.76 | **81.33 / 100** |
| Orta | 50 / 24 | Timefold 1.17 | FEASIBLE | ✅ | 288/288 | 23.86 | **78.81 / 100** |
| Orta | 50 / 24 | HiGHS 1.16 | OPTIMAL | ✅ | 288/288 | 8.36 | **73.00 / 100** |
| Büyük | 100 / 45 | Timefold 1.17 | FEASIBLE | ✅ | 540/540 | 34.57 | **89.62 / 100** |
| Büyük | 100 / 45 | Google OR-Tools 9.15 | FEASIBLE | ✅ | 540/540 | 68.31 | **81.51 / 100** |
| Çok Büyük | 150 / 65 | Google OR-Tools 9.15 | FEASIBLE | ✅ | 780/780 | 64.39 | **80.00 / 100** |
| Ultimate | 250 / 100 | Google OR-Tools 9.15 | FEASIBLE | ✅ | 1200/1200 | 68.95 | **83.12 / 100** |

---

## 4. Bilinen Sınırlamalar ve Harici Ortam Doğrulama Notları

- **MiniZinc (Gecode):** Küçük okullarda (10T/5C) yüksek kalite puanıyla (95.2/100) OPTIMAL çözüme ulaşır; 25+ öğretmenli yoğun modellerde 15 sn bütçede `TIME_LIMIT` verebilir. Bu nedenle `Akıllı Otomatik Mod` büyük okullarda OR-Tools + Timefold + HiGHS kombinasyonunu önceliklendirir.
- **Harici Ortam Testleri (Bu makine dışında doğrulama gerektirir):**
  - Python ve Java kurulu olmayan **harici temiz Windows 10/11 sanal makinesinde** kurulum testi (yerelde gömülü `multi_solver_engine.exe` + `resources/runtime/java` ile boş `PATH` testi başarıyla geçti).
  - Canlı `evrakplus.com` cPanel sunucusunda `install.php` + canlı WordPress üyelik akışı + canlı Android/iOS fiziksel cihaz PWA kurulum testi.
  - Private GitHub deposu kullanıldığı için son kullanıcı otomatik güncellemelerinin çalışması için public dağıtım deposu veya `evrakplus.com` üzerinden yayın yansıtması önerilir (private token asla EXE içerisine gömülmez).
