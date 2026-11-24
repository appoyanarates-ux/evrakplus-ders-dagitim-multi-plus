# Sürüm Geçmişi (CHANGELOG)

## [1.0.1] — 2026-11-24
### Yenilikler ve İyileştirmeler
- **Okul Kulüpleri Modülü:** 32 varsayılan MEB okul kulübü eklendi; Menü 3'te öğretmenlere kulüp atama, manuel yeni kulüp ekleme, kulüp silme ve öğretmen ders programı çıktılarında okul kulübü gösterimi eklendi.
- **Aynı Öğretmen + Aynı Sınıf Farklı Ders Kuralı:** Bir öğretmenin aynı sınıfa hem kendi branşı hem de branş dışı dersiyle aynı gün girmesini önleyen 3 seçenekli kural (`Ayrı günlere yay`, `Aynı gün yasak`, `Kapalı`) eklendi.
- **Maksimumda Bitir Özelliği:** Tüm derslerin sığmadığı yoğun durumlarda çakışmasız mümkün olan en fazla dersi yerleştiren mod ve yerleşemeyen her blok için Türkçe kök neden + çözüm önerisi + tek tıkla ilgili menüye götüren bağlantılar eklendi.
- **Yeni Modern Masaüstü ve PWA Simgesi:** 16–256 px çoklu çözünürlüklü şeffaf köşeli yeni simge (masaüstü kısayolu, görev çubuğu, kurulum sihirbazı ve PWA).
- **Motor Durum Şeridi Düzeltmesi:** Gömülü `multi_solver_engine.exe` üzerinden 6/6 motorun doğru algılanması sağlandı.

## [1.0.0] — 2026-11-24
### İlk Kararlı Sürüm — EvrakPlus Ders Dağıtım Multi Plus
- **Altı Gerçek Optimizasyon Motoru:** Google OR-Tools CP-SAT, Timefold Solver, Choco Solver, MiniZinc (Gecode / Chuffed), SCIP ve HiGHS entegrasyonu.
- **EvrakPlus Multi Solver Optimization Engine:** Akıllı Otomatik, Tek Motor, Sıralı, Paralel, Hibrit ve Ultimate çalışma modları; CPU/RAM kaynak yönetimi ve gerçek iptal desteği.
- **Multi-Pass (PASS 0–7) Dağıtım Sistemi:** Ön kontrol, kesin kurallarla çözüm, kontrollü esnetme raporlaması ve kalite iyileştirme.
- **EvrakPlus Independent Schedule Validator & Ortak 100'lük Kalite Puanlama:** Tüm motorların sonuçlarını bağımsız doğrulama ve tek ölçekte karşılaştırma.
- **Multi Solver Merkezi Arayüzü:** Motor sağlık kontrolü, canlı kaynak/durum takibi ve alternatif çizelge karşılaştırma.
- **Windows Setup & Portable EXE:** Python, Java ve tüm native kütüphaneler gömülü, tamamen çevrimdışı kurulum.
- **cPanel Web & Mobil PWA:** PHP/MySQL REST API, kurulum sihirbazı, IndexedDB + Service Worker çevrimdışı çalışma.
- **EvrakPlus Multi Plus Connect (WordPress) & 3-Platform Senkronizasyon:** Çıktı yetkisi doğrulama, cihaz eşleştirme, çakışma tespiti ve güvenli bulut eşitleme.
- **Bağımsız Docker Solver Server:** Paylaşımlı cPanel ortamları için harici asenkron optimizasyon servisi.
