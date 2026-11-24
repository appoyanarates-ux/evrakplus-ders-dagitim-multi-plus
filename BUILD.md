# Derleme ve Paketleme Kılavuzu (BUILD)

## Gereksinimler (Geliştirici Ortamı)
- Windows 10/11 x64
- Node.js 20+ (önerilen: 24 LTS)
- Python 3.12+
- JDK 21 (Eclipse Temurin) + Apache Maven 3.9+ (Timefold & Choco derlemesi ve `jlink` özel JRE üretimi için)
- MiniZinc Windows x64 paketi (Gecode & Chuffed dahil)

## Adım Adım Derleme
1. Bağımlılıkları kurun:
   ```powershell
   npm ci
   python -m venv .venv
   .\.venv\Scripts\pip.exe install -r solver\requirements.txt
   ```
2. Python motorlarını (`ortools`, `scip`, `highs`) paketleyin:
   ```powershell
   npm run build:engines:py
   ```
3. Java motorlarını (`timefold`, `choco`) ve paylaşımlı özel JRE'yi oluşturun:
   ```powershell
   npm run build:engines:java
   ```
4. Tüm testleri çalıştırın:
   ```powershell
   npm test
   ```
5. Windows Setup EXE, Portable EXE, cPanel ZIP, Solver Server ZIP, WordPress Connect ZIP, HTML Preview ve SHA-256 dosyalarını üretin:
   ```powershell
   npm run build:all
   ```
