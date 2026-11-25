!macro customInstall
  ; Masaüstü ve Başlat Menüsü kısayollarının yüksek çözünürlüklü yeni simgeyi kullanmasını garantile
  IfFileExists "$DESKTOP\DersOptima Pro Haftalik Ders Dagitim Programi.lnk" 0 +2
    CreateShortCut "$DESKTOP\DersOptima Pro Haftalik Ders Dagitim Programi.lnk" "$INSTDIR\DersOptima Pro.exe" "" "$INSTDIR\resources\icon.ico" 0
  IfFileExists "$SMPROGRAMS\DersOptima Pro Haftalik Ders Dagitim Programi.lnk" 0 +2
    CreateShortCut "$SMPROGRAMS\DersOptima Pro Haftalik Ders Dagitim Programi.lnk" "$INSTDIR\DersOptima Pro.exe" "" "$INSTDIR\resources\icon.ico" 0
!macroend

!macro customUnInstall
  MessageBox MB_ICONINFORMATION|MB_OK "DersOptima Pro Haftalık Ders Dağıtım Programı kaldırılıyor.$\r$\n$\r$\nKullanıcı proje dosyalarınız, yerel yedekleriniz ve dışa aktardığınız ders programları SİLİNMEZ; bilgisayarınızda güvenle korunur."
!macroend
