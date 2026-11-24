!macro customInstall
  ; Masaüstü ve Başlat Menüsü kısayollarının yüksek çözünürlüklü yeni simgeyi kullanmasını garantile
  IfFileExists "$DESKTOP\EvrakPlus Ders Dagitim Multi Plus.lnk" 0 +2
    CreateShortCut "$DESKTOP\EvrakPlus Ders Dagitim Multi Plus.lnk" "$INSTDIR\EvrakPlus Ders Dagitim Multi Plus.exe" "" "$INSTDIR\resources\icon.ico" 0
  IfFileExists "$SMPROGRAMS\EvrakPlus Ders Dagitim Multi Plus.lnk" 0 +2
    CreateShortCut "$SMPROGRAMS\EvrakPlus Ders Dagitim Multi Plus.lnk" "$INSTDIR\EvrakPlus Ders Dagitim Multi Plus.exe" "" "$INSTDIR\resources\icon.ico" 0
!macroend

!macro customUnInstall
  MessageBox MB_ICONINFORMATION|MB_OK "EvrakPlus Ders Dağıtım Multi Plus kaldırılıyor.$\r$\n$\r$\nKullanıcı proje dosyalarınız, yerel yedekleriniz ve dışa aktardığınız ders programları SİLİNMEZ; bilgisayarınızda güvenle korunur."
!macroend
