# GitHub Dağıtım, Kod İmzalama, SmartScreen ve Geri Dönüş Yönergesi

## 1. GitHub Deposu Bağlantısı (Manuel Adımlar)
Bu geliştirme ortamında GitHub hesabına doğrudan erişim veya yükleme yetkisi bulunmamaktadır. Kendi yetkilendirdiğiniz GitHub hesabınızda `evrakplus-ders-dagitim` deposunu (mevcut depo varsa onu) kullanın:

```powershell
git init
git add .
git commit -m "Release v1.0.0: EvrakPlus Ders Dagitim"
git branch -M main
git remote add origin https://github.com/<KULLANICI_VEYA_ORG>/evrakplus-ders-dagitim.git
git push -u origin main
```

> **Önemli:** `.gitignore` dosyası tüm `.pfx`, `.p12`, `.pem`, `.key`, `.env`, `evrakplus_session.enc` ve kullanıcı proje verilerini hariç tutar. Yine de ilk `git push` öncesi `git status` ile gizli dosya olmadığını doğrulayın.
> Ayrıca `electron-builder.yml` içindeki `publish[0].owner` alanını kendi GitHub kullanıcı adınız veya organizasyon adınızla güncelleyin.

## 2. Kod İmzalama ve Ed25519 Manifest İmzalama (GitHub Secrets)
Kararlı üretim sürümü yayınlamadan önce GitHub deposunda **Settings → Secrets and variables → Actions** altında şu gizli anahtarları tanımlayın (asla depoya dosya olarak yüklemeyin):

1. `CSC_LINK` — Güvenilir CA (DigiCert, Sectigo, SSL.com, Azure Trusted Signing vb.) tarafından verilmiş Windows kod imzalama sertifikasının (`.pfx` / `.p12`) Base64 metni veya güvenli KMS bağlantısı.
2. `CSC_KEY_PASSWORD` — Sertifika parolası.
3. `EPDD_ED25519_PRIVATE_KEY` — Güncelleme manifestini (`latest.yml`) imzalamak için Ed25519 PKCS#8 özel anahtarı. Karşılık gelen açık anahtar (`publicKey`) istemcide gömülü doğrulama için kullanılır.

Ed25519 anahtar çifti üretmek için (güvenli çevrimdışı makinede):
```powershell
node -e "const c=require('crypto'); const k=c.generateKeyPairSync('ed25519'); console.log(k.publicKey.export({type:'spki',format:'pem'})); console.log(k.privateKey.export({type:'pkcs8',format:'pem'}));"
```

## 3. Windows SmartScreen ve Güvenlik Politikası
- Kullanıcılara SmartScreen veya Windows Defender'ı kapatmaları **asla önerilmez**.
- Üretim kurulum paketleri geçerli bir EV veya OV kod imzalama sertifikasıyla (veya Azure Trusted Signing ile) imzalanmalıdır. İmzalı yeni sürümlerde bile Microsoft itibar sistemi oluşana kadar kısa süreli uyarı görülebilir; Microsoft Security Intelligence portalına dosya gönderimiyle itibar hızlandırılabilir.
- `electron-builder.yml` içinde `verifyUpdateCodeSignature: true` etkindir; imzasız veya değiştirilmiş paketler güncelleme olarak yüklenmez.
- Özel (private) kaynak kod deposu kullanılacaksa, EXE içerisine **asla** GitHub PAT gömmeyin; kaynak kodu özel depoda tutup yalnızca derlenmiş imzalı kurulum paketlerini herkese açık bir dağıtım deposuna (`evrakplus-ders-dagitim-releases`) yayınlayın.

## 4. Kontrollü Sürüm Geri Dönüşü (Rollback)
1. Güncelleme öncesi `StorageAndBackupService` otomatik olarak `pre_update` yedeği alır.
2. Yeni sürümde kritik bir hata saptanırsa GitHub Releases'tan hatalı sürüm yayından kaldırılır (`draft` / `pre-release` yapılır) ve bir önceki kararlı kurulum paketi indirilir.
3. Veri şeması yükseldiyse eski sürüme dönmeden önce `userData/backups/` içindeki `pre_update` yedeğinin geri yüklenmesi zorunludur.
