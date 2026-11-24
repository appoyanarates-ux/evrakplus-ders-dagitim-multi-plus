# EvrakPlus Ders Dağıtım Multi Plus — v1.0.0
## AŞAMA 1: Mevcut HTML Analizi ve Mimari Tasarım Raporu

### 1. Mevcut HTML Belgesi Analizi (`Çarşaf · Ders Dağıtım`)

Kaynak belge tek dosyalık (~500 satır), sıfır bağımlılıklı, istemci taraflı bir SPA (Single Page Application) olarak yazılmıştır.

#### 1.1 Mevcut Menü ve Ekranlar (9 Adım)
1. **Okul ve zaman (`okul`)**: Okul adı, eğitim yılı, okul türü (6 MEB türü), gün/ders sayısı, zil saatleri, müdür ve müdür yardımcıları, dönem tarihleri.
2. **Ders havuzu (`havuz`)**: 4 sekme — Zorunlu dersler (TTKB çizelgeleri), Seçmeli ders havuzu, Ders blokları (genel/ders/sınıf düzeyi sabit veya çoklu otomatik blok), Okulun ders listesi (özel zorunlu/seçmeli ders ekleme).
3. **Sınıflar (`sinif`)**: Toplu/tek şube ekleme, fazla ders saatlerini otomatik kapatma, sınıf rehber öğretmeni atama/dağıtma, sınıf kapalı saat matrisi.
4. **Öğretmenler (`ogretmen`)**: Ad, kısa ad, branş, günlük maks ders (`dmax`), maks ardışık ders (`cmax`), nöbet günü/yeri, sosyal kulüp, branş dışı okutabileceği dersler (tekli/toplu), sınıf başına ders sınırı kuralları, 3 durumlu müsaitlik matrisi (`Müsait / Kapalı / Tercihen boş`).
5. **Sınıf dersleri (`dersler`)**: Sınıf bazında ve tüm ders kartları görünümü; zorunlu/seçmeli/ek ders yönetimi; branş/branş dışı otomatik öğretmen atama (`brans_ek`, `brans`, `off`).
6. **Kurallar (`kural`)**: Farklı gün kuralı (`diff`), ders bazlı saat yasağı (`forbid`), aynı gün olmasın (`pair`), sınıf başına öğretmen ders sınırı (`tclass`).
7. **Dağıtım ve program (`dagitim`)**: Web Worker tabanlı arama motoru (Baştan dağıt, Dağıtılmayanları dağıt, İyileştir, Durdur, Maksimumda bitir, Dağıtımı temizle, Kontrol et), ön kontrol (Hall koşulu gün grubu kapasitesi dahil), "Hangi öğretmeni açarsam çözülür?" (`relax`), sınıf/öğretmen tekli ve çarşaf görünümü, sürükle-bırak, sağ tık ders ekleme/yerleştirme menüsü, kilitli ders koruma (`lockImpact`, `guardLock`), dağıtılamayan ders nedenleri.
8. **Raporlar ve çıktılar (`rapor`)**: Resmi düzende Sınıf Programı, Sınıf Çarşaf, Öğretmen Programı, Öğretmen Çarşaf, Okul Nöbeti (otomatik nöbet dağıtımı dahil), Kalite Raporu; HTML (A4 dikey/yatay), CSV ve PNG çıktıları.
9. **Proje ve yedek (`proje`)**: `.json` indir/aç/kopyala, boş proje / örnek okul / çakışmalı örnek, `localStorage` otomatik kayıt ve 8 noktalı geçmiş, `BroadcastChannel` çoklu sekme uyarısı, Ctrl+Z/Y geri al/yinele (40 adım).

#### 1.2 Mevcut Veri Modeli (`S` nesnesi, `v: 2`)
- `school`: `{ name, year, mudur, myard[], donem, donemBas, donemBit, type, D, P, start, len, brk, lunchAfter, lunchLen }`
- `classes[]`: `{ id, name, grade, closed[], rehber }`
- `teachers[]`: `{ id, name, short, branch, dmax, cmax, av{}, extra[], dutyD, dutyP, kulup }`
- `cards[]`: `{ id, classId, subj, hours, pattern, teacherId, kind, bmode, bpats[] }`
- `subjects{}`: `{ [key]: [name, short, branch] }`, `custom[]`, `blk{}`, `blkMode`
- `rules[]`: `diff`, `forbid`, `pair`, `tclass`
- `place{}`: `{ [cardId:blockIdx]: { d, p, lock } }`
- `report{}`, `duty{ places[], admin{} }`, `last`, `ui{}`

#### 1.3 Mevcut Dağıtım Algoritması (`CORE()`)
- Web Worker üzerinde çalışan tek motorlu JavaScript çözücü:
  - **Faz 1 (DFS + MRV + Forward Checking + Restart)**: `slotPick` (tam dolu sınıflarda en kısıtlı slot seçimi), rastgeleleştirilmiş skorlama, üstel artan backtrack bütçesi.
  - **Faz 2 (Onarım / Min-Conflicts + Tabu)**: Yerleşemeyen bloklar için en az çakışan hücreyi seçip mevcut blokları geçici çıkararak yeniden yerleştirme.
  - **Faz 3 (`solveAuto`)**: Otomatik blok modu açık kartlarda sığmayan derslerin alternatif blok düzenlerine (`pats`) kademeli geçişi.
  - **Faz 4 (`improve`)**: Yerel arama (tek blok taşıma + aynı sınıfta aynı uzunlukta blok takası) ile öğretmen boşlukları ve tercih ihlallerini azaltma.
- **Sınırlılıkları**: Tek çekirdekli JS, 50+ öğretmen / 25+ şube ve derslik/bina/grup kısıtlarında ölçeklenmez; matematiksel optimallik kanıtı (OPTIMAL) veremez; derslik, bina, ikili eğitim, öğrenci grubu, min/maks haftalık saat, yemek arası blok engeli gibi ileri MEB kısıtlarını modellemez.

---

### 2. Korunacak, İyileştirilecek ve Yeni Eklenecek Özellikler

| Kategori | Özellikler |
|---|---|
| **Korunacak (Sıfır Kayıp)** | Tüm 9 ekranın çalışan işlevleri (yeni 18 menülü yapıya haritalanacak), Hall koşulu gün grubu ön kontrolü, `relax` öneri bulucu, sürükle-bırak + sağ tık hücre ekleme menüsü, kilitli ders etki denetimi (`lockImpact`), 3 durumlu müsaitlik matrisi, branş/branş dışı otomatik atama, ortak rehberlik saati, resmi nöbet ve A4/çarşaf belge formatları, `v: 2` JSON projelerinin tam geriye dönük içe aktarımı (`migrateV2ToV3`). |
| **Değiştirilecek / İyileştirilecek** | Sabit gömülü TTKB dizileri → sürümlü, güncellenebilir JSON şablon dosyaları (doğrulanmamış şablonlarda resmi onay ibaresi yok); `localStorage` → Electron SQLite + Web MySQL/MariaDB + PWA IndexedDB; tek `CORE()` motoru → 6 gerçek optimizasyon motoru + sınırlı tarayıcı içi yardımcı çözücü (açık etiketli); `window.claude.use('downloads')` → standart tarayıcı/Electron dosya kaydetme + üyelik kontrollü PDF/Excel/Word/PNG/Yazdırma. |
| **Yeni Eklenecek** | 18 menülü ortak arayüz; 11 MEB kurum türü şablonları; derslikler, laboratuvarlar, atölyeler, spor salonları, binalar ve bina geçiş süreleri; ikili eğitim / sabahçı-öğlenci; öğrenci grupları ve paralel seçmeli dersler; 4 seviyeli öncelik/ağırlık kısıt sistemi; **EvrakPlus Independent Schedule Validator**; 100 üzerinden ortak kalite puanlama; **EvrakPlus Multi Solver Optimization Engine** (OR-Tools CP-SAT, Timefold, Choco, MiniZinc, SCIP, HiGHS); Multi-Pass (PASS 0–7) çözüm hattı; 6 çalışma modu (Akıllı, Tek, Sıralı, Paralel, Hibrit, Ultimate); Electron Windows Setup/Portable EXE (gömülü runtime); PHP/cPanel web + kurulum sihirbazı; Linux FastAPI/Docker Solver Server; **EvrakPlus Multi Plus Connect** WP eklentisi (PKCE + imzalı çevrimdışı yetki); UUID/revision tabanlı bulut senkronizasyonu; Mobil PWA; GitHub Release & otomatik güncelleme. |

---

### 3. Monorepo ve Sistem Mimarisi

```text
evrakplus-ders-dagitim-multi-plus/
  packages/
    core-schema/          # Ortak veri modeli v3, JSON şema, v2->v3 migrasyon, MEB şablonları
    validator/            # EvrakPlus Independent Schedule Validator + 100 puan kalite motoru
    multi-solver/         # EvrakPlus Multi Solver Optimization Engine + PASS 0-7 orkestratörü
    ui-shared/            # 18 menülü ortak arayüz (Electron, Web ve PWA ortak tasarım dili)
  engines/
    ortools/              # Python OR-Tools CP-SAT gerçek adaptörü
    timefold/             # Java Timefold Solver bağımsız CLI/servis adaptörü
    choco/                # Java Choco Solver bağımsız CLI adaptörü
    minizinc/             # MiniZinc .mzn/.dzn üreteci + Gecode/Chuffed/OR-Tools adaptörü
    scip/                 # SCIP MILP adaptörü (PySCIPOpt / SCIP CLI)
    highs/                # HiGHS MILP adaptörü (highspy / HiGHS CLI)
  apps/
    desktop-electron/     # Windows 64-bit Electron (SQLite, gömülü motorlar, auto-update)
    web-php-cpanel/       # public_html/ders-dagitim-multi-plus/ (PHP, MySQL, PWA, installer)
    solver-server/        # Linux FastAPI + Redis/Queue + Docker Compose optimizasyon sunucusu
    wp-connect-plugin/    # EvrakPlus Multi Plus Connect (WordPress REST API + PKCE + Sync)
  tests/
    profiles/             # 6 ölçekli gerçekçi okul üreteci (10..250 öğretmen)
    unit/                 # Birim, doğrulayıcı, motor ve entegrasyon testleri
  docs/                   # Mimari, kurulum, test raporları, CHANGELOG
```

---

### 4. Geliştirme Ortamı Tespiti (Mevcut Makine)

| Bileşen | Durum | Not |
|---|---|---|
| Git | `2.56.0` | Hazır |
| Node.js | `v24.22.1` | Hazır (`npm.cmd` ile PowerShell kısıtı aşılır) |
| Python | `3.12.10` | Hazır (`ortools`, `highspy`, `pyscipopt` sanal ortamda kurulacak) |
| Java | `JRE 1.8.0_192` | Eski; Timefold 1.x ve Choco 4.10+ için taşınabilir **Temurin JDK 21** `resources/runtime/java` içine indirilecek |
| MiniZinc | Kurulu değil | Portable MiniZinc Windows paketi `resources/engines/minizinc` içine indirilecek |
| PHP / Docker | Kurulu değil | PHP web uygulaması ve Docker Solver Server standartlara uygun yazılacak; yerel PHP/Docker yoksa bu açıkça raporlanacak |

---

### 5. Sürüm ve Güvenlik İlkeleri
- Tüm motorlar izole alt süreçler (`child_process.spawn`) olarak çalışır; JSON stdin/stdout veya geçici iş dizini protokolü kullanır.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, sıkı CSP, IPC doğrulaması.
- Üyelik doğrulama: PKCE + kısa ömürlü JWT erişim tokeni + güvenli refresh token + sunucu imzalı süreli çevrimdışı yetki belgesi (yerel JS bayrağına güvenilmez).
- Hiçbir zorunlu kural (öğretmen/sınıf/derslik çakışması, kapalı saat, kilitli ders) hiçbir PASS aşamasında esnetilmez.
