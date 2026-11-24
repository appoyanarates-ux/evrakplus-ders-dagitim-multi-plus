# EvrakPlus Ders Dağıtım — Kullanım Kılavuzu (v1.0.0)

Bu kılavuz, **EvrakPlus Ders Dağıtım** Windows masaüstü uygulamasının gerçek ekran ve düğme adlarına göre hazırlanmıştır.

---

## 1. Program Kurulumu
1. `EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe` dosyasını çift tıklayarak çalıştırın.
2. Türkçe kurulum sihirbazında kurulum konumunu seçin (normal kullanıcı hesabıyla yönetici izni gerekmeden kurulabilir).
3. İsteğe bağlı olarak **Masaüstü kısayolu** ve **Başlat Menüsü kısayolu** seçeneklerini işaretleyin.
4. Kurulum tamamlandığında **EvrakPlus Ders Dağıtım** otomatik başlatılabilir. Python veya Google OR-Tools kurmanıza gerek yoktur; çözücü motor pakete gömülüdür.

## 2. İlk Okul Projesini Oluşturma (Menü 1 – Kurum ve Zaman Çizelgesi)
1. Sol menüden **1. Kurum ve Zaman Çizelgesi** bölümünü açın.
2. **Okul Adı**, **Eğitim-Öğretim Yılı** ve **MEB 2026-2027 Okul Türü** (İlkokul, Ortaokul, İHO, Anadolu Lisesi, Fen Lisesi, SBL, AİHL) seçimlerini yapın.
3. **Öğretim Şekli** (Tekli / İkili Öğretim) ve **Zil Saatleri** ile açık/kapalı ders saatlerini ayarlayın.

## 3. Sınıf ve Şube Ekleme (Menü 2 – Şubeler ve Özel Derslikler)
1. **2. Şubeler ve Özel Derslikler** ekranında sınıf düzeyine göre şubelerinizi (ör. `5/A`, `7/B`) tek tek veya toplu ekleyin.
2. Laboratuvar, Bilişim Sınıfı, Spor Salonu gibi özel derslikleri ve eşzamanlı kapasitelerini tanımlayın.

## 4. Öğretmen Ekleme (Menü 3 – Öğretmenler ve Uygunluklar)
1. **3. Öğretmenler ve Uygunluklar** ekranında öğretmen adı, branş, günlük/haftalık maksimum ders saati ve çalışma günü sınırlarını girin.
2. Öğretmenin kapalı günlerini veya müsait olmadığı saatleri uygunluk matrisinden işaretleyin.

## 5. Ders Atama ve 6. Blok Ders Düzenleme (Menü 4 – Ders Programı ve Bloklar)
1. **4. Ders Programı ve Bloklar** ekranında her şubenin haftalık derslerini ve öğretmen eşleştirmelerini yapın.
2. Blok yapısını dilediğiniz gibi düzenleyin (ör. 6 saatlik ders için `2+2+2`, 5 saatlik ders için `2+2+1` veya `3+2`).
3. Ortak seçmeli dersler veya özel mekan gerektiren dersleri ilgili alanlardan işaretleyin.

## 7. OR-Tools ile Dağıtım (Menü 5 – Otomatik Ders Dağıtımı)
1. **5. Otomatik Ders Dağıtımı** ekranına geçin.
2. Dağıtım modunu (**Tam Dağıtım**, **Boştakileri Yerleştir**, **En Az Değişiklikle Onar**), tercih profilini (**Dengeli**, **Daha Az Pencere**, **Günlere Yay**) ve süre sınırını seçin.
3. **Dağıtımı Başlat** düğmesine basın. Google OR-Tools CP-SAT motoru tamamen çevrimdışı çalışır ve sonuç bağımsız doğrulayıcıdan geçtikten sonra ekrana yansıtılır. Gerekirse **Durdur** düğmesiyle işlemi iptal edebilirsiniz.

## 8. Manuel Ders Taşıma ve 9. Kilitleme (Menü 6 – Program Çıktıları ve Raporlar)
1. **Sınıf Programı** veya **Öğretmen Programı** sekmesinde herhangi bir ders hücresini fareyle tutup başka bir saate sürükleyip bırakabilirsiniz.
2. Uygun saatler yeşil, çakışan/kapalı saatler kırmızı gösterilir. 2 saatlik bloklar tek parça taşınır.
3. Hücreye tıklayarak açılan işlem menüsünden **Dersi Kilitle / Kilidi Kaldır**, **Başka Saate Taşı**, **Yer Değiştir** veya **Öğretmen Değiştir** işlemlerini yapabilirsiniz.
4. Üst araç çubuğundaki **Geri Al** / **İleri Al** düğmeleriyle son 40 değişikliği geri alabilirsiniz.

## 10. Yeniden Dağıtma
- Yalnızca tek bir şubeyi veya öğretmeni bozmadan yeniden yerleştirmek için Menü 6'daki **Seçili Sınıfı Yeniden Dağıt** veya **Seçili Öğretmeni Yeniden Dağıt** düğmesini kullanın. Diğer kilitli ve mevcut yerleşimler korunarak yalnızca OR-Tools ile bölgesel çözüm üretilir.

## 11. PDF ve Excel Çıktıları
1. Menü 6'daki çıktı araç çubuğundan **Çıktı Önizleme**, **PDF Oluştur**, **Excel İndir (.xlsx)**, **Toplu Çıktı (PDF/ZIP)** veya **Yazdır** düğmelerini kullanın.
2. Önizleme penceresinde A4/A3, yatay/dikey, yazı boyutu, okul logosu, hazırlayan/onaylayan imza alanları ve siyah-beyaz modunu anlık görebilirsiniz.

## 12. EvrakPlus Üyelik Sistemi
- Ders dağıtımı, düzenleme, kilitleme ve yerel `.json` yedekleme **tamamen ücretsiz ve üyeliksiz** çalışır.
- PDF, Excel, Toplu Çıktı ve Yazdırma için sol menünün altındaki **Giriş Yap** veya **Ücretsiz Üye Ol** düğmelerini kullanın.
- **Tarayıcıda EvrakPlus ile Giriş Yap** akışı mevcut `evrakplus.com` hesabınızla cihaz eşleştirir; şifreniz asla bilgisayara kaydedilmez. Giriş sonrası **7 gün boyunca internetsiz** çıktı alabilirsiniz.

## 13. Bulut Senkronizasyonu (Menü 7 – Proje Kayıt ve Yedekleme)
- Bulut senkronizasyonu KVKK gereği varsayılan olarak kapalıdır.
- **Menü 7** içinde **"Bu proje için bulut senkronizasyonunu etkinleştir"** kutusunu işaretleyip **Buluta Kaydet / Eşitle** düğmesine basın.
- Farklı bir cihazda aynı proje güncellendiyse **Senkronizasyon Çakışması** penceresi açılır; program her iki sürümü otomatik yedekledikten sonra size *Yerel sürümü koru*, *Bulut sürümünü aç* veya *İkisini ayrı proje olarak sakla* seçeneklerini sunar.

## 14. Güncelleme (Ayarlar ve Hakkında)
1. Sol menünün en altındaki **Ayarlar ve Hakkında** düğmesine tıklayın.
2. **Güncellemeleri Kontrol Et** düğmesine basın. Yeni sürüm varsa **Yeni Güncelleme Var** penceresi açılır.
3. Onayınız olmadan hiçbir güncelleme indirilmez veya kurulmaz. **Şimdi Güncelle** dediğinizde mevcut projeniz otomatik yedeklenir ve kurulum başlar.

## 15. Yedekleme ve Geri Yükleme
- **Menü 7** üzerinden tam proje yedeğini `.json` olarak indirebilir veya sürükle-bırak ile geri yükleyebilirsiniz.
- **Ayarlar ve Hakkında** penceresindeki **Otomatik Yerel Yedekleme** alanından saklanacak yedek sayısını (varsayılan 10) değiştirebilir, tek tıkla önceki yedeğe dönebilirsiniz.
- Uygulama kaldırıldığında proje dosyalarınız ve yedekleriniz silinmez.

## 16. Sık Karşılaşılan Hatalar
- **"Model çözülemez (INFEASIBLE)":** Öğretmen haftalık ders yükünün müsait saatlerini aşması veya bloğun öğle arasına sığmaması durumunda oluşur. Menü 5'teki Türkçe tanı listesini inceleyip ilgili kısıtı esnetin.
- **"İnternet bağlantısı bulunamadı":** Ders dağıtımı ve düzenleme internetsiz çalışır. Çıktı için 7 günlük çevrimdışı yetkiniz dolmuşsa internet bağlantısı ile oturumunuzu yenileyin.
- **Beklenmedik kapanma:** Program yeniden açıldığında otomatik kurtarma yedeğini geri yüklemenizi önerir. Gerekirse **Ayarlar ve Hakkında → Hata Raporu Oluştur** ile kişisel verilerden arındırılmış teknik rapor alabilirsiniz.
