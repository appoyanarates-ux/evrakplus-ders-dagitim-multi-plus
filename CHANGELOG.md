# Sürüm Geçmişi (CHANGELOG)

## [1.0.5] — 2026-11-25
### Marka Düzeltmesi
- Program adı **DersOptima Pro Haftalık Ders Dağıtım Programı** olarak güncellendi (masaüstü kurulum/taşınabilir EXE, kısayol, pencere başlığı, kenar çubuğu, Mobil PWA ve cPanel Web paketi).

## [1.0.4] — 2026-11-25
### Marka Güncellemesi
- **Yeni Ürün Adı:** Program adı **DersOptime Haftalık Ders Dağıtım Programı** olarak güncellendi (pencere başlığı, kenar çubuğu, mobil PWA, kurulum sihirbazı, masaüstü kısayolu, Setup/Portable EXE ve cPanel/Web paketleri). Mevcut EvrakPlus üyelik sistemi ve kayıtlı okul projeleriyle %100 geriye uyumludur.

## [1.0.3] — 2026-11-24
### Canlı Dağıtım İzleme (Live Watch)
- **Gerçek Zamanlı Dağıtım Yüzdesi ve İlerleme Paneli:** OR-Tools CP-SAT `CpSolverSolutionCallback` ve Multi Solver motorlarından gelen gerçek ara çözümlerle yerleşen blok sayısı, gerçek dağıtım yüzdesi (`%0`–`%100`), bulunan çözüm sayısı ve geçen süre canlı olarak gösterilir.
- **4 Görünümde Canlı Seyretme:** Dağıtım devam ederken **Sınıf Bazında**, **Öğretmen Bazında**, **Sınıf Çarşafı** ve **Öğretmen Çarşafı** görünümleri arasında tek tıkla geçiş yapılarak derslerin çizelgeye canlı yerleşmesi ve iyileşmesi izlenebilir (önceki kayıtlı program doğrulanmış sonuç gelene kadar güvenle korunur).

## [1.0.2] — 2026-11-24
### Kritik Düzeltme ve Kullanıcı Deneyimi İyileştirmeleri
- **Çok Motorlu İmza Hatası Düzeltildi:** `electron/main.cjs` içindeki eski tek-motor imza kontrolü (`Çözücü beklenen google_ortools_cp_sat imzasını döndürmedi`) tüm 6 gerçek motoru (`ortools`, `timefold`, `choco`, `minizinc`, `scip`, `highs`, `multi_solver`) kabul edecek şekilde düzeltildi.
- **%100 Tam Otomatik Dağıtım Ekranı:** Menü 5'teki teknik motor kartları ve mod seçiciler kapalı **"Gelişmiş Motor Ayarları"** çekmecesine alındı; ön planda yalnızca anlaşılır pedagojik kurallar (**Aynı Öğretmen + Aynı Sınıf Farklı Ders**, **Otomatik Alternatif Bloklar [varsayılan açık]**, **Akıllı Esnek Limit Kurtarma**) bırakıldı.
- **Öğretmen Değişince Otomatik Boşa Düşme & Hover Gösterimi:** Menü 4'te bir dersin öğretmeni değiştirildiğinde mevcut programdaki yerleşmiş blokları otomatik boşa düşer; Menü 5 şablonlarında hem üst özet çubuğunda hem de Öğretmen Çarşafı'nda öğretmen isminin üzerinde rozet ve üzerine gelince detaylı liste olarak görünür.
- **5 Eksenli Tam Kök Neden & Alternatif Öğretmen Analizi:** Yerleşemeyen dersler için öğretmen gün/saat kısıtı, haftalık ders yükü aşımı, blok uzunluğu, özel derslik doluluğu ve **branş/branş dışı boş kapasiteli alternatif öğretmen önerisi** ile tek tıkla ilgili ekrana götüren bağlantılar eklendi.

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
