# EvrakPlus Ders Dağıtım Multi Plus

MEB'e bağlı okullar için geliştirilmiş, **6 gerçek optimizasyon motorunu** (Google OR-Tools CP-SAT, Timefold Solver, Choco Solver, MiniZinc [Gecode/Chuffed], SCIP, HiGHS) tek ortak veri modeli, bağımsız doğrulayıcı ve ortak 100 üzerinden kalite puanlama sistemiyle birleştiren profesyonel haftalık ders dağıtım yazılımı.

## Ürün Bilgileri
- **Program Adı:** EvrakPlus Ders Dağıtım Multi Plus
- **Sürüm:** 1.0.0
- **Geliştirici:** EvrakPlus
- **Ana Site:** https://www.evrakplus.com/
- **Web Uygulaması:** https://www.evrakplus.com/ders-dagitim-multi-plus/
- **Üyelik ve Giriş:** https://www.evrakplus.com/giris
- **Platformlar:** Windows 10/11 (x64 Setup & Portable EXE), cPanel Web (HTML5/PHP/MySQL), Mobil PWA (Android/iOS/Tablet)

## Altı Optimizasyon Altyapısı
1. **Google OR-Tools CP-SAT** — Ana CP-SAT optimizasyon motoru
2. **Timefold Solver** — Yerel arama + kısıt akışı kalite optimizasyonu (Java 21 JRE gömülü)
3. **Choco Solver** — Kısıt programlama (CP) çözücüsü (Java 21 JRE paylaşımlı)
4. **MiniZinc (Gecode / Chuffed)** — Bildirimsel CP modelleme ve çözücü paketi
5. **SCIP** — Tamsayılı matematiksel programlama (MILP/MINLP) çözücüsü
6. **HiGHS** — Yüksek performanslı açık kaynak MILP çözücüsü

## Mimari Özeti
- `engines/` — Altı motorun kaynak kodları ve adaptörleri (`ortools`, `timefold`, `choco`, `minizinc`, `scip`, `highs`)
- `solver/` — Ortak veri/kısıt modeli, `EvrakPlus Independent Schedule Validator`, ortak 100'lük kalite puanlama ve Multi-Pass orkestratörü
- `electron/` — Güvenli Electron masaüstü uygulaması, Multi Solver Engine yöneticisi, yerel SQLite/yedekleme, EvrakPlus DPAPI oturumu ve otomatik güncelleme
- `renderer/` — 7 ana menülü arayüz + Multi Solver Merkezi + Okul Nöbeti + Mobil PWA
- `web/` — cPanel PHP/MySQL/REST API web uygulaması ve kurulum sihirbazı
- `solver-server/` — Docker Compose destekli bağımsız Linux/VPS optimizasyon servisi
- `evrakplus-multi-plus-connect/` — WordPress üyelik, cihaz eşleştirme ve bulut senkronizasyon köprü eklentisi

## Dokümantasyon
- [INSTALLATION.md](INSTALLATION.md) — Windows, cPanel, PWA ve Solver Server kurulum talimatları
- [BUILD.md](BUILD.md) — Kaynaktan derleme ve paketleme rehberi
- [TEST_REPORT.md](TEST_REPORT.md) — Gerçek test ve performans karşılaştırma raporu
- [SECURITY.md](SECURITY.md) — Güvenlik ve KVKK politikası
- [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) — Üçüncü parti açık kaynak lisansları
- [CHANGELOG.md](CHANGELOG.md) — Sürüm geçmişi
