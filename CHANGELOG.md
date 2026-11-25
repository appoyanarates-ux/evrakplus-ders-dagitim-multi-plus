# Sürüm Geçmişi (CHANGELOG)

## [1.0.8] — 2026-11-25
### Menü 4 Geniş Öğretmen Ders Yükleri, Akıllı Seçmeli Öner & Ata ve Filtre Düzeltmesi
- **Modern Tam Genişlik Sekmeli Menü 4:** Menü 4 üç geniş sekmeye ayrıldı (**Şube–Ders Atama Tablosu**, **Öğretmen Ders Yükleri — Geniş Yönetim Merkezi**, **Özel Derslikler**); Öğretmen Ders Yükleri dar yan panelden çıkıp 2 sütunlu tam genişlik kart ızgarasına taşındı.
- **Öğretmen Ders Yükleri Üzerinde Tam Yönetim:** Her ders satırında **Düzelt** (saat/blok/ad düzenleme), **Değiştir** (öğretmen aktarma), **Al** (öğretmenden çıkarma) ve **Sil** (şubeden silme) düğmeleri; ayrıca her öğretmen kartında **`+ Ders Ekle / Ata`** penceresi (mevcut atanmamış dersi atama veya şubeye yeni ders ekleyip bu ya da başka bir öğretmene atama) eklendi.
- **Akıllı Seçmeli Ders Öner ve Ata:** Haftalık ders saati eksik şubeler için MEB/TTKB kurallarına (3 seçmeli grup + bir sınıfa bir ders kuralı) uygun seçmeli dersleri ve boş kapasiteli öğretmenleri otomatik öneren, tek tek düzenlenip tek tıkla eklenebilen **Seçmeli Ders Öner ve Ata** aracı eklendi.
- **Atanmamış Ders Filtre Hatası Düzeltildi:** Menü 4'te eski/gizli kalan şube/arama filtrelerinin 56 atanmamış dersten yalnızca 1'ini göstermesi sorunu giderildi; filtre girdileri durumla senkronize edildi, aktif filtre uyarı şeridi + **Tüm Dersleri Göster** düğmesi eklendi ve **Atanmamış Ders** KPI kartı tek tıkla tüm atanmamış dersleri açacak şekilde bağlandı.

## [1.0.7] — 2026-11-25
### Resmî MEB / TTKB 2025–2026 ve 2026–2027 Haftalık Ders Çizelgeleri & Okul Türü Gruplandırması
- **5 Resmî Kurum Grubunda 19 Okul Türü (`renderer/meb_curriculum.js`):**
  1. **Temel Eğitim (TTKB 23/09/2026 — 113, 114, 115):** İlkokul, Ortaokul, Güzel Sanatlar Müzik İlkokulu, Güzel Sanatlar Müzik Ortaokulu, Spor Ortaokulu.
  2. **Din Öğretimi (TTKB 23/09/2026 — 117 & 23/07/2025 — 26):** İmam Hatip Ortaokulu (28 standart + 12 Müzik/Spor Programı seçmeli), Anadolu İmam Hatip Lisesi (Ortak + Meslek + A ve B Grubu seçmeliler).
  3. **Genel Ortaöğretim (TTKB 09/05/2025 — 05):** Anadolu Lisesi, Fen Lisesi, Sosyal Bilimler Lisesi (Hazırlık sınıfı saatleri düzeltildi, eksik 25+ seçmeli ders tamamlandı).
  4. **Güzel Sanatlar ve Spor Liseleri (TTKB 09/05/2025 — 06, 07 & 02/09/2026 — 102, 103):** GSL Görsel Sanatlar, GSL Tiyatro, GSL Müzik, GSL Türk Müziği (43 saat), Spor Lisesi, Tematik Program Uygulayan Spor Lisesi (40 saat).
  5. **Özel Program Uygulayan Proje Liseleri (TTKB 23/07/2025 — 24, 25 & 02/09/2026 — 104):** Özel Program Uygulayan Hazırlıklı Anadolu Lisesi, Fen Lisesi ve Sosyal Bilimler Lisesi (45 saat, tüm tematik alan ve çok yönlü gelişim dersleri).
- **Matematiksel Saat Doğrulaması:** Tüm 19 okul türünün her sınıf seviyesindeki Ortak + Alan/Meslek + Rehberlik + Serbest Etkinlik ders toplamlarının resmî TTKB çizelge toplamlarıyla birebir örtüştüğü otomatik testle doğrulandı.

## [1.0.6] — 2026-11-25
### Profesyonel Öğretmen Ders Yükleri & Mükerrer Ders Koruması
- **Menü 4 — Gelişmiş Öğretmen Ders Yükleri Paneli:** Her öğretmenin isminin altında atanan tüm dersler, şubeler, saatler ve **ders blokları (`Blok: 2+2+1`)** varsayılan olarak açık listelenir.
- **Tekli ve Toplu Ders Alma / Değiştirme / Aktarma:** Her ders satırında `Değiştir` ve `Al` düğmeleri, öğretmen kartında `Tümünü Seç`, `Tümünü Aktar` ve `Tümünü Al` düğmeleri, ayrıca çoklu seçim (`checkbox`) yapıldığında açılan yapışkan toplu işlem çubuğuyla seçili dersleri tek tıkla başka bir öğretmene aktarma veya öğretmenlerden alma eklendi. Değiştirilen/alınan derslerin mevcut programdaki yerleşimleri otomatik olarak boşa düşürülür.
- **Bir Sınıfa Bir Ders Kuralı (Mükerrer Ders Engeli):** Aynı şubeye aynı dersin (aynı ders kodu veya adı) birden fazla kez eklenmesi hem Menü 2'deki tüm ekleme/düzenleme ekranlarında hem de dağıtım öncesi doğrulamada (`DUPLICATE_COURSE_IN_CLASS`) engellendi.

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
