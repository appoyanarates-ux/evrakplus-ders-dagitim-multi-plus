'use strict';

/* =========================================================================
   MEB 2025-2026 / 2026-2027 RESMÎ TTKB HAFTALIK DERS ÇİZELGELERİ
   19 Okul Türü · 5 Resmî Kurum Grubu · Tüm Zorunlu, Alan/Meslek ve Seçmeli Dersler
   ========================================================================= */

const MEB_SCHOOL_GROUPS = [
  {
    id: 'temel_egitim',
    title: 'Temel Eğitim (İlkokul ve Ortaokullar)',
    subtitle: 'Temel Eğitim Genel Müdürlüğü · TTKB 23/09/2026 (113, 114, 115)',
    schoolIds: ['ilkokul', 'ortaokul', 'muzik_ilkokul', 'muzik_ortaokul', 'spor_ortaokul']
  },
  {
    id: 'din_ogretimi',
    title: 'Din Öğretimi (İmam Hatip Okulları)',
    subtitle: 'Din Öğretimi Genel Müdürlüğü · TTKB 23/09/2026-117 & 23/07/2025-26',
    schoolIds: ['iho', 'aihl']
  },
  {
    id: 'genel_ortaogretim',
    title: 'Genel Ortaöğretim (Anadolu, Fen ve Sosyal Bilimler)',
    subtitle: 'Ortaöğretim Genel Müdürlüğü · TTKB 09/05/2025-05',
    schoolIds: ['anadolu', 'fen', 'sosyal']
  },
  {
    id: 'gsl_spor',
    title: 'Güzel Sanatlar ve Spor Liseleri',
    subtitle: 'Ortaöğretim Genel Müdürlüğü · TTKB 09/05/2025 (06, 07) & 02/09/2026 (102, 103)',
    schoolIds: ['gsl_gorsel', 'gsl_tiyatro', 'gsl_muzik', 'gsl_turk_muzigi', 'spor_lisesi', 'tematik_spor_lisesi']
  },
  {
    id: 'ozel_program',
    title: 'Özel Program Uygulayan Liseler (45 Saat · Hazırlık + 9–12)',
    subtitle: 'Ortaöğretim Genel Müdürlüğü · TTKB 23/07/2025 (24, 25) & 02/09/2026-104',
    schoolIds: ['ozel_anadolu', 'ozel_fen', 'ozel_sosyal']
  }
];

const MEB_SCHOOL_TYPES = {
  /* ---------------- 1. TEMEL EĞİTİM ---------------- */
  ilkokul: {
    id: 'ilkokul', groupId: 'temel_egitim',
    name: 'İlkokul (1-4. Sınıf)', shortName: 'İlkokul',
    decision: 'TTKB 23/09/2026 - 115', defaultPeriods: 6, defaultTargetHours: 30,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '1', grade: '1. Sınıf', core: 26, elective: 4, guidance: 0, total: 30 },
      { key: '2', grade: '2. Sınıf', core: 28, elective: 2, guidance: 0, total: 30 },
      { key: '3', grade: '3. Sınıf', core: 28, elective: 2, guidance: 0, total: 30 },
      { key: '4', grade: '4. Sınıf', core: 30, elective: 0, guidance: 0, total: 30 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 115 sayılı İlköğretim Kurumları Haftalık Ders Çizelgesi.',
      '1. sınıfta Serbest Etkinliklerin 2 saati, 2–3. sınıflarda 1 saati masal ve geleneksel oyun saati olarak değerlendirilir.'
    ]
  },
  ortaokul: {
    id: 'ortaokul', groupId: 'temel_egitim',
    name: 'Ortaokul (5-8. Sınıf)', shortName: 'Ortaokul',
    decision: 'TTKB 23/09/2026 - 115', defaultPeriods: 7, defaultTargetHours: 35,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '5', grade: '5. Sınıf', core: 30, elective: 5, guidance: 0, total: 35 },
      { key: '6', grade: '6. Sınıf', core: 30, elective: 5, guidance: 0, total: 35 },
      { key: '7', grade: '7. Sınıf', core: 30, elective: 5, guidance: 0, total: 35 },
      { key: '8', grade: '8. Sınıf', core: 29, elective: 6, guidance: 0, total: 35 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 115 sayılı İlköğretim Kurumları Haftalık Ders Çizelgesi (35 saat).',
      'İnsan, Toplum ve Bilim; Din, Ahlak ve Değer; Kültür, Sanat ve Spor gruplarının her birinden her yıl en az birer ders seçilmesi zorunludur.'
    ]
  },
  muzik_ilkokul: {
    id: 'muzik_ilkokul', groupId: 'temel_egitim',
    name: 'Güzel Sanatlar Müzik İlkokulu (1-4. Sınıf)', shortName: 'G.S. Müzik İlkokulu',
    decision: 'TTKB 23/09/2026 - 114', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Müzik Alan',
    grades: [
      { key: '1', grade: '1. Sınıf', core: 25, meslek: 6, elective: 4, guidance: 0, total: 35 },
      { key: '2', grade: '2. Sınıf', core: 27, meslek: 6, elective: 2, guidance: 0, total: 35 },
      { key: '3', grade: '3. Sınıf', core: 27, meslek: 11, elective: 2, guidance: 0, total: 40 },
      { key: '4', grade: '4. Sınıf', core: 29, meslek: 11, elective: 0, guidance: 0, total: 40 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 114 sayılı Güzel Sanatlar Müzik İlkokulu ve Ortaokulu Çizelgesi.',
      '1–2. sınıflar 35 saat (25/27 ortak + 6 müzik alan + 4/2 serbest etkinlik), 3–4. sınıflar 40 saattir.'
    ]
  },
  muzik_ortaokul: {
    id: 'muzik_ortaokul', groupId: 'temel_egitim',
    name: 'Güzel Sanatlar Müzik Ortaokulu (5-8. Sınıf)', shortName: 'G.S. Müzik Ortaokulu',
    decision: 'TTKB 23/09/2026 - 114', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Müzik Alan',
    grades: [
      { key: '5', grade: '5. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '6', grade: '6. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '7', grade: '7. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '8', grade: '8. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 114 sayılı Çizelge: 27 ortak + 10 Müzik Alan + 3 seçmeli = 40 saat.',
      'Her 3 seçmeli ders grubundan her yıl en az 1’er ders (haftada 1’er saat) seçilmesi zorunludur.'
    ]
  },
  spor_ortaokul: {
    id: 'spor_ortaokul', groupId: 'temel_egitim',
    name: 'Spor Ortaokulu (5-8. Sınıf)', shortName: 'Spor Ortaokulu',
    decision: 'TTKB 23/09/2026 - 113', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Spor Alan',
    grades: [
      { key: '5', grade: '5. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '6', grade: '6. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '7', grade: '7. Sınıf', core: 27, meslek: 10, elective: 3, guidance: 0, total: 40 },
      { key: '8', grade: '8. Sınıf', core: 26, meslek: 11, elective: 3, guidance: 0, total: 40 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 113 sayılı Spor Ortaokulu Haftalık Ders Çizelgesi (40 saat).',
      'Her 3 seçmeli ders grubundan her yıl en az 1’er ders (haftada 1’er saat) seçilmesi zorunludur.'
    ]
  },

  /* ---------------- 2. DİN ÖĞRETİMİ ---------------- */
  iho: {
    id: 'iho', groupId: 'din_ogretimi',
    name: 'İmam Hatip Ortaokulu (5-8. Sınıf)', shortName: 'İmam Hatip Ortaokulu',
    decision: 'TTKB 23/09/2026 - 117', defaultPeriods: 8, defaultTargetHours: 36,
    hasPrepOption: false, hasIhoModes: true, hasMeslekCol: false,
    grades: [
      { key: '5', grade: '5. Sınıf', core: 35, elective: 1, guidance: 0, total: 36 },
      { key: '6', grade: '6. Sınıf', core: 35, elective: 1, guidance: 0, total: 36 },
      { key: '7', grade: '7. Sınıf', core: 35, elective: 1, guidance: 0, total: 36 },
      { key: '8', grade: '8. Sınıf', core: 34, elective: 2, guidance: 0, total: 36 }
    ],
    notes: [
      'TTKB 23/09/2026 tarihli ve 117 sayılı İHO Haftalık Ders Çizelgesi (Standart 36 saat; Bakanlık onaylı 40 saat, Müzik/Spor Programı 40 saat, Hafızlık Projesi 27 saat).',
      'Seçmeli havuzunda tüm 28 standart seçmeli ders ile Müzik ve Spor Programı seçmeli dersleri yer alır.'
    ]
  },
  aihl: {
    id: 'aihl', groupId: 'din_ogretimi',
    name: 'Anadolu İmam Hatip Lisesi', shortName: 'Anadolu İHL',
    decision: 'TTKB 23/07/2025 - 26', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: true, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Meslek',
    prepGrade: { key: 'H', grade: 'Hazırlık', core: 35, meslek: 4, elective: 0, guidance: 1, total: 40 },
    grades: [
      { key: '9', grade: '9. Sınıf', core: 33, meslek: 6, elective: 0, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 29, meslek: 11, elective: 0, guidance: 0, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 12, meslek: 12, elective: 16, guidance: 0, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 9, meslek: 10, elective: 21, guidance: 0, total: 40 }
    ],
    notes: [
      'TTKB 23/07/2025 tarihli ve 26 sayılı AİHL ve Hazırlık Sınıfı Bulunan AİHL Haftalık Ders Çizelgesi.',
      'Seçmeli havuzunda tüm A Grubu (Temel İslam Bilimleri, Türk İslam Sanatları, Akademik, İnsan/Toplum, Kültür/Sanat) ve B Grubu (Spor, Musiki, Görsel Sanatlar, Fen-Teknoloji, Çocuk Gelişimi, Hafızlık) dersleri bulunur.'
    ]
  },

  /* ---------------- 3. GENEL ORTAÖĞRETİM ---------------- */
  anadolu: {
    id: 'anadolu', groupId: 'genel_ortaogretim',
    name: 'Anadolu Lisesi', shortName: 'Anadolu Lisesi',
    decision: 'TTKB 09/05/2025 - 05', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: true, hasIhoModes: false, hasMeslekCol: false,
    prepGrade: { key: 'H', grade: 'Hazırlık', core: 39, elective: 0, guidance: 1, total: 40 },
    grades: [
      { key: '9', grade: '9. Sınıf', core: 32, elective: 7, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 33, elective: 6, guidance: 1, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 19, elective: 20, guidance: 1, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 15, elective: 24, guidance: 1, total: 40 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 05 sayılı Anadolu Lisesi ve Hazırlık Sınıfı Bulunan Anadolu Lisesi Çizelgesi.',
      '9–10. sınıflarda 3 seçmeli gruptan (İnsan-Toplum-Bilim, Din-Ahlak-Değer, Kültür-Sanat-Spor) her birinden en az 1’er ders; 11–12. sınıflarda en az 2 gruptan 1’er ders seçilmesi zorunludur.'
    ]
  },
  fen: {
    id: 'fen', groupId: 'genel_ortaogretim',
    name: 'Fen Lisesi', shortName: 'Fen Lisesi',
    decision: 'TTKB 09/05/2025 - 05', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: true, hasIhoModes: false, hasMeslekCol: false,
    prepGrade: { key: 'H', grade: 'Hazırlık', core: 39, elective: 0, guidance: 1, total: 40 },
    grades: [
      { key: '9', grade: '9. Sınıf', core: 34, elective: 5, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 35, elective: 4, guidance: 1, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 35, elective: 4, guidance: 1, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 8, guidance: 1, total: 40 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 05 sayılı Fen Lisesi ve Hazırlık Sınıfı Bulunan Fen Lisesi Çizelgesi.',
      'Matematik tüm sınıflarda 6 saat; Fizik, Kimya, Biyoloji 11–12. sınıflarda 4’er saat ortaktır. Hazırlık bulunan Fen Lisesinde 9–10. sınıfta Bilişim Teknolojileri zorunlu değildir (seçmeli 7/6 saate çıkar).'
    ]
  },
  sosyal: {
    id: 'sosyal', groupId: 'genel_ortaogretim',
    name: 'Sosyal Bilimler Lisesi', shortName: 'Sosyal Bilimler L.',
    decision: 'TTKB 09/05/2025 - 05', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: true, hasIhoModes: false, hasMeslekCol: false,
    prepGrade: { key: 'H', grade: 'Hazırlık', core: 35, elective: 4, guidance: 1, total: 40 },
    grades: [
      { key: '9', grade: '9. Sınıf', core: 32, elective: 7, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 35, elective: 4, guidance: 1, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 37, elective: 3, guidance: 0, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 8, guidance: 1, total: 40 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 05 sayılı Sosyal Bilimler Lisesi ve Hazırlık Sınıfı Bulunan SBL Çizelgesi.',
      'Hazırlık sınıfında 35 ortak + 4 seçmeli + 1 rehberlik = 40 saat; 11. sınıfta 37 ortak + 3 seçmeli = 40 saattir.'
    ]
  },

  /* ---------------- 4. GÜZEL SANATLAR VE SPOR LİSELERİ ---------------- */
  gsl_gorsel: {
    id: 'gsl_gorsel', groupId: 'gsl_spor',
    name: 'Güzel Sanatlar Lisesi — Görsel Sanatlar', shortName: 'GSL Görsel Sanatlar',
    decision: 'TTKB 09/05/2025 - 06', defaultPeriods: 9, defaultTargetHours: 43,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 39, elective: 3, guidance: 1, total: 43 },
      { key: '10', grade: '10. Sınıf', core: 41, elective: 2, guidance: 0, total: 43 },
      { key: '11', grade: '11. Sınıf', core: 39, elective: 4, guidance: 0, total: 43 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 11, guidance: 1, total: 43 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 06 sayılı Güzel Sanatlar Lisesi Görsel Sanatlar Çizelgesi (43 saat).',
      '9–12. sınıflarda İnsan-Toplum-Bilim ve Din-Ahlak-Değer seçmeli gruplarından en az 1’er ders seçilmesi zorunludur.'
    ]
  },
  gsl_tiyatro: {
    id: 'gsl_tiyatro', groupId: 'gsl_spor',
    name: 'Güzel Sanatlar Lisesi — Tiyatro', shortName: 'GSL Tiyatro',
    decision: 'TTKB 09/05/2025 - 06', defaultPeriods: 9, defaultTargetHours: 43,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 39, elective: 3, guidance: 1, total: 43 },
      { key: '10', grade: '10. Sınıf', core: 40, elective: 2, guidance: 1, total: 43 },
      { key: '11', grade: '11. Sınıf', core: 35, elective: 7, guidance: 1, total: 43 },
      { key: '12', grade: '12. Sınıf', core: 33, elective: 9, guidance: 1, total: 43 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 06 sayılı Güzel Sanatlar Lisesi Tiyatro Çizelgesi (43 saat).',
      'Oyunculuk, Hareket, Ses ve Konuşma, Oyun Çalışması dersleri grup dersi olarak işlenebilir.'
    ]
  },
  gsl_muzik: {
    id: 'gsl_muzik', groupId: 'gsl_spor',
    name: 'Güzel Sanatlar Lisesi — Müzik', shortName: 'GSL Müzik',
    decision: 'TTKB 09/05/2025 - 07', defaultPeriods: 9, defaultTargetHours: 43,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 39, elective: 3, guidance: 1, total: 43 },
      { key: '10', grade: '10. Sınıf', core: 40, elective: 2, guidance: 1, total: 43 },
      { key: '11', grade: '11. Sınıf', core: 34, elective: 8, guidance: 1, total: 43 },
      { key: '12', grade: '12. Sınıf', core: 33, elective: 9, guidance: 1, total: 43 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 07 sayılı Güzel Sanatlar Lisesi Müzik Haftalık Ders Çizelgesi (43 saat).',
      'Türk Dili ve Edebiyatı ile Batı Müziği Teori ve Uygulaması yıl sonu ortalamasıyla geçilemeyecek derslerdir.'
    ]
  },
  gsl_turk_muzigi: {
    id: 'gsl_turk_muzigi', groupId: 'gsl_spor',
    name: 'Güzel Sanatlar Lisesi — Türk Müziği', shortName: 'GSL Türk Müziği',
    decision: 'TTKB 09/05/2025 - 07', defaultPeriods: 9, defaultTargetHours: 43,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 39, elective: 3, guidance: 1, total: 43 },
      { key: '10', grade: '10. Sınıf', core: 40, elective: 2, guidance: 1, total: 43 },
      { key: '11', grade: '11. Sınıf', core: 32, elective: 10, guidance: 1, total: 43 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 11, guidance: 1, total: 43 }
    ],
    notes: [
      'TTKB 09/05/2025 tarihli ve 07 sayılı Güzel Sanatlar Lisesi Türk Müziği Haftalık Ders Çizelgesi (43 saat).',
      'Türk Dili ve Edebiyatı ile Türk Müziği Teori ve Uygulaması yıl sonu ortalamasıyla geçilemeyecek derslerdir.'
    ]
  },
  spor_lisesi: {
    id: 'spor_lisesi', groupId: 'gsl_spor',
    name: 'Spor Lisesi', shortName: 'Spor Lisesi',
    decision: 'TTKB 02/09/2026 - 102', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 37, elective: 2, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 37, elective: 2, guidance: 1, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 35, elective: 4, guidance: 1, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 8, guidance: 1, total: 40 }
    ],
    notes: [
      'TTKB 02/09/2026 tarihli ve 102 sayılı Spor Lisesi Haftalık Ders Çizelgesi (40 saat).',
      '9–12. sınıflarda İnsan-Toplum-Bilim ve Din-Ahlak-Değer seçmeli gruplarından en az 1’er ders seçilmesi zorunludur.'
    ]
  },
  tematik_spor_lisesi: {
    id: 'tematik_spor_lisesi', groupId: 'gsl_spor',
    name: 'Tematik Program Uygulayan Spor Lisesi', shortName: 'Tematik Spor L.',
    decision: 'TTKB 02/09/2026 - 103', defaultPeriods: 8, defaultTargetHours: 40,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: false,
    grades: [
      { key: '9', grade: '9. Sınıf', core: 37, elective: 2, guidance: 1, total: 40 },
      { key: '10', grade: '10. Sınıf', core: 37, elective: 2, guidance: 1, total: 40 },
      { key: '11', grade: '11. Sınıf', core: 35, elective: 4, guidance: 1, total: 40 },
      { key: '12', grade: '12. Sınıf', core: 31, elective: 8, guidance: 1, total: 40 }
    ],
    notes: [
      'TTKB 02/09/2026 tarihli ve 103 sayılı Tematik Program Uygulayan Spor Lisesi Çizelgesi (40 saat).',
      'Okul için belirlenen spor dalı doğrultusunda 1 branş seçilir (10–12. sınıfta 8 saat Takım/Bireysel Sporlar); Spor Basını ve Hukuku ile Atletik Gelişim ve Performans seçmelileri eklenmiştir.'
    ]
  },

  /* ---------------- 5. ÖZEL PROGRAM UYGULAYAN PROJE LİSELERİ (45 SAAT) ---------------- */
  ozel_anadolu: {
    id: 'ozel_anadolu', groupId: 'ozel_program',
    name: 'Özel Program Uygulayan Hazırlıklı Anadolu Lisesi', shortName: 'Özel Prog. Anadolu L.',
    decision: 'TTKB 02/09/2026 - 104', defaultPeriods: 9, defaultTargetHours: 45,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Tematik',
    grades: [
      { key: 'H', grade: 'Hazırlık', core: 40, meslek: 4, elective: 0, guidance: 1, total: 45 },
      { key: '9', grade: '9. Sınıf', core: 34, meslek: 6, elective: 4, guidance: 1, total: 45 },
      { key: '10', grade: '10. Sınıf', core: 33, meslek: 6, elective: 5, guidance: 1, total: 45 },
      { key: '11', grade: '11. Sınıf', core: 21, meslek: 8, elective: 15, guidance: 1, total: 45 },
      { key: '12', grade: '12. Sınıf', core: 21, meslek: 8, elective: 15, guidance: 1, total: 45 }
    ],
    notes: [
      'TTKB 02/09/2026 tarihli ve 104 sayılı Özel Program Uygulayan Hazırlık Sınıfı Bulunan Anadolu Lisesi Çizelgesi (45 saat).',
      'Tematik Alan Dersleri (Temel Bilimler / Sosyal Bilimler) ve Çok Yönlü Gelişim Dersleri seçmeli havuzunda eksiksiz tanımlıdır.'
    ]
  },
  ozel_fen: {
    id: 'ozel_fen', groupId: 'ozel_program',
    name: 'Özel Program Uygulayan Fen Lisesi', shortName: 'Özel Prog. Fen L.',
    decision: 'TTKB 23/07/2025 - 24', defaultPeriods: 9, defaultTargetHours: 45,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Tematik',
    grades: [
      { key: 'H', grade: 'Hazırlık', core: 30, meslek: 10, elective: 4, guidance: 1, total: 45 },
      { key: '9', grade: '9. Sınıf', core: 32, meslek: 8, elective: 4, guidance: 1, total: 45 },
      { key: '10', grade: '10. Sınıf', core: 33, meslek: 8, elective: 4, guidance: 0, total: 45 },
      { key: '11', grade: '11. Sınıf', core: 37, meslek: 4, elective: 4, guidance: 0, total: 45 },
      { key: '12', grade: '12. Sınıf', core: 31, meslek: 4, elective: 9, guidance: 1, total: 45 }
    ],
    notes: [
      'TTKB 23/07/2025 tarihli ve 24 sayılı Özel Program Uygulayan Fen Lisesi Çizelgesi (45 saat · Hazırlık + 9–12).',
      'Bilişim Teknolojileri ve Yazılım, Havacılık ve Uzay Teknolojileri ile Temel Bilimler tematik alan dersleri havuzda yer alır.'
    ]
  },
  ozel_sosyal: {
    id: 'ozel_sosyal', groupId: 'ozel_program',
    name: 'Özel Program Uygulayan Sosyal Bilimler Lisesi', shortName: 'Özel Prog. SBL',
    decision: 'TTKB 23/07/2025 - 25', defaultPeriods: 9, defaultTargetHours: 45,
    hasPrepOption: false, hasIhoModes: false, hasMeslekCol: true, extraColLabel: 'Tematik',
    grades: [
      { key: 'H', grade: 'Hazırlık', core: 38, meslek: 6, elective: 0, guidance: 1, total: 45 },
      { key: '9', grade: '9. Sınıf', core: 35, meslek: 6, elective: 4, guidance: 0, total: 45 },
      { key: '10', grade: '10. Sınıf', core: 32, meslek: 8, elective: 4, guidance: 1, total: 45 },
      { key: '11', grade: '11. Sınıf', core: 28, meslek: 8, elective: 8, guidance: 1, total: 45 },
      { key: '12', grade: '12. Sınıf', core: 18, meslek: 8, elective: 18, guidance: 1, total: 45 }
    ],
    notes: [
      'TTKB 23/07/2025 tarihli ve 25 sayılı Özel Program Uygulayan Sosyal Bilimler Lisesi Çizelgesi (45 saat · Hazırlık + 9–12).',
      'Medya ve İletişim, Siyaset Bilimi ve Uluslararası İlişkiler, İktisat ve İşletme, Edebiyat-Tarih-Kültür ve Yabancı Diller tematik alanları tanımlıdır.'
    ]
  }
};

const _BASE_LISE_BRANCHES = [
  'Türk Dili ve Edebiyatı', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
  'Tarih', 'Coğrafya', 'Felsefe Grubu', 'İngilizce', 'Almanca / 2. Yabancı Dil',
  'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Beden Eğitimi',
  'Görsel Sanatlar', 'Müzik', 'Rehberlik (PDR)', 'Sağlık Bilgisi'
];

const MEB_BRANCHES_BY_SCHOOL_TYPE = {
  ilkokul: ['Sınıf Öğretmenliği', 'İngilizce', 'Din Kültürü ve Ahlak Bilgisi', 'Rehberlik (PDR)', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi', 'Özel Eğitim'],
  ortaokul: ['Türkçe', 'İlköğretim Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce', 'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi', 'Rehberlik (PDR)', 'Almanca / 2. Yabancı Dil'],
  muzik_ilkokul: ['Sınıf Öğretmenliği', 'Müzik', 'Türk Müziği / Çalgı Eğitimi', 'İngilizce', 'Din Kültürü ve Ahlak Bilgisi', 'Görsel Sanatlar', 'Beden Eğitimi', 'Rehberlik (PDR)'],
  muzik_ortaokul: ['Türkçe', 'İlköğretim Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce', 'Müzik', 'Türk Müziği / Çalgı Eğitimi', 'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Beden Eğitimi', 'Rehberlik (PDR)'],
  spor_ortaokul: ['Türkçe', 'İlköğretim Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce', 'Beden Eğitimi', 'Antrenörlük / Spor Branşları', 'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Müzik', 'Rehberlik (PDR)'],
  iho: ['Türkçe', 'İlköğretim Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce', 'İHL Meslek Dersleri', 'Arapça', 'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi', 'Rehberlik (PDR)'],
  aihl: ['Türk Dili ve Edebiyatı', 'Matematik', 'İHL Meslek Dersleri', 'Arapça', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih', 'Coğrafya', 'Felsefe Grubu', 'İngilizce', 'Din Kültürü ve Ahlak Bilgisi', 'Bilişim Teknolojileri', 'Beden Eğitimi', 'Görsel Sanatlar', 'Müzik', 'Çocuk Gelişimi ve Eğitimi', 'Rehberlik (PDR)'],
  anadolu: _BASE_LISE_BRANCHES,
  fen: _BASE_LISE_BRANCHES,
  sosyal: _BASE_LISE_BRANCHES,
  gsl_gorsel: [..._BASE_LISE_BRANCHES, 'Görsel Sanatlar / Resim', 'Grafik ve Fotoğraf', 'Geleneksel Türk Sanatları', 'Sanat Tarihi'],
  gsl_tiyatro: [..._BASE_LISE_BRANCHES, 'Tiyatro / Oyunculuk', 'Sahne Sanatları / Dramaturji'],
  gsl_muzik: [..._BASE_LISE_BRANCHES, 'Müzik / Batı Müziği', 'Türk Müziği / Çalgı Eğitimi', 'Piyano / Ses Eğitimi'],
  gsl_turk_muzigi: [..._BASE_LISE_BRANCHES, 'Türk Müziği / Çalgı Eğitimi', 'Müzik / Batı Müziği', 'Ses Eğitimi'],
  spor_lisesi: [..._BASE_LISE_BRANCHES, 'Beden Eğitimi / Spor Bilimleri', 'Antrenörlük / Spor Branşları'],
  tematik_spor_lisesi: [..._BASE_LISE_BRANCHES, 'Beden Eğitimi / Spor Bilimleri', 'Antrenörlük / Spor Branşları'],
  ozel_anadolu: [..._BASE_LISE_BRANCHES, 'Ekonomi / İşletme', 'Hukuk / Siyaset Bilimi'],
  ozel_fen: [..._BASE_LISE_BRANCHES, 'Elektrik-Elektronik', 'Havacılık ve Uzay Teknolojileri', 'Yazılım / Yapay Zekâ'],
  ozel_sosyal: [..._BASE_LISE_BRANCHES, 'Medya ve İletişim', 'Siyaset Bilimi / Hukuk', 'İktisat ve İşletme', 'Üçüncü Yabancı Dil']
};

/* ---------- Yardımcı: Ortaokul Ortak Seçmeli Havuzu (1 veya 2 saatlik) ---------- */
function _addOrtaokulElectives(add, singleHour = false, excludeMuzik = false) {
  const h2 = singleHour ? 1 : 2;
  const h12 = singleHour ? 1 : [1, 2];
  const g1 = 'İnsan, Toplum ve Bilim';
  add('MBU', 'Matematik ve Bilim Uygulamaları', 'secmeli', g1, { '6': h2, '7': h2 });
  add('OKB', 'Okuma Becerileri', 'secmeli', g1, { '5': h2, '6': h2 });
  add('YZB', 'Yazarlık ve Yazma Becerileri', 'secmeli', g1, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('YDL', 'Yaşayan Diller ve Lehçeler', 'secmeli', g1, { '5': h2, '6': h2, '7': h2, '8': h2 });
  add('SYD', 'Yabancı Dil (Seçmeli)', 'secmeli', g1, { '5': h2, '6': h2, '7': h2, '8': h2 });
  add('CEV', 'Çevre Eğitimi ve İklim Değişikliği', 'secmeli', g1, { '6': h2, '7': h2, '8': h2 });
  add('SHR', '“Şehrimiz…”', 'secmeli', g1, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('HUK', 'Hukuk ve Adalet', 'secmeli', g1, { '6': h2, '7': h2, '8': h2 });
  add('DSN', 'Düşünme Eğitimi', 'secmeli', g1, { '7': h12, '8': h2 });
  add('ROB', 'Robotik Kodlama', 'secmeli', g1, { '5': h2, '6': h2 });
  add('YZU', 'Yapay Zekâ Uygulamaları', 'secmeli', g1, { '7': h2, '8': h2 });
  add('PRJ', 'Proje Tasarımı ve Uygulamaları', 'secmeli', g1, { '5': h12, '6': h12, '7': h12 });
  add('OSS', 'Okul Temelli Sosyal Sorumluluk Çalışmaları', 'secmeli', g1, { '6': h2, '7': h2, '8': h2 });
  add('MED', 'Medya Okuryazarlığı', 'secmeli', g1, { '7': h2, '8': h2 });
  add('AFT', 'Afet Bilinci', 'secmeli', g1, { '5': h12, '6': h12, '7': h12 });
  add('TYB', 'Temel Yaşam Becerileri', 'secmeli', g1, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('TSA', 'Türk Sosyal Hayatında Aile', 'secmeli', g1, { '5': h2, '6': h2, '7': h2, '8': h2 });

  const g2 = 'Din, Ahlak ve Değer';
  add('KUR', "Kur'an-ı Kerim", 'secmeli', g2, { '5': h2, '6': h2, '7': h2, '8': h2 }, { canSplit: true });
  add('PEY', 'Peygamberimizin Hayatı', 'secmeli', g2, { '5': h2, '6': h2, '7': h2, '8': h2 });
  add('TDB', 'Temel Dinî Bilgiler', 'secmeli', g2, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('KMV', 'Kültür ve Medeniyetimize Yön Verenler', 'secmeli', g2, { '5': h2, '6': h2, '7': h2, '8': h2 });
  add('AVE', 'Ahlak ve Vatandaşlık Eğitimi', 'secmeli', g2, { '5': h12, '6': h12, '7': h12, '8': h2 });

  const g3 = 'Kültür, Sanat ve Spor';
  add('GRG', 'Görgü Kuralları ve Nezaket', 'secmeli', g3, { '5': h2, '6': h2, '7': h2, '8': h2 });
  if (!excludeMuzik) add('SMZ', 'Müzik (Seçmeli)', 'secmeli', g3, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('SFE', 'Spor ve Fiziki Etkinlikler', 'secmeli', g3, { '5': h2, '6': h2, '7': h2, '8': h2 });
  add('OYN', 'Oyun ve Oyun Etkinlikleri', 'secmeli', g3, { '5': h12, '6': h12, '7': h12 });
  add('DJS', 'Dijital Sanatlar', 'secmeli', g3, { '6': h12, '7': h12 });
  add('MSL', 'Masal ve Destanlarımız', 'secmeli', g3, { '5': h12, '6': h12, '7': h12, '8': h2 });
  add('GLN', 'Geleneksel Sanatlar', 'secmeli', g3, { '6': h12, '7': h12 });
  add('HLK', 'Halk Oyunları', 'secmeli', g3, { '5': h2, '6': h2, '7': h2, '8': h2 });
}

/* ---------- Yardımcı: Lise Ortak İnsan/Din/Kültür Seçmeli Havuzu ---------- */
function _addLiseCommonElectives(add, opts = {}) {
  const gI = 'İnsan, Toplum ve Bilim';
  const gD = 'Din, Ahlak ve Değer';
  const gK = 'Kültür, Sanat ve Spor';
  const isGsl = Boolean(opts.isGsl);
  const isSpor = Boolean(opts.isSpor);
  const hasPrep = Boolean(opts.hasPrepElectives);

  if (!opts.skipFenMatUyg) {
    add('FBU', 'Fen Bilimleri Uygulamaları', 'secmeli', gI, isSpor ? { '11': 2, '12': [2, 3] } : (opts.sbl ? { '11': [1, 2], '12': [2, 3] } : { '11': [2, 3], '12': [2, 3] }));
    if (!isSpor) add('MTU', 'Matematik Uygulamaları', 'secmeli', gI, opts.sbl ? { '11': [1, 2], '12': [2, 3] } : { '11': [2, 3], '12': [2, 3] });
  }
  if (!opts.skipAstro) {
    add('AST', 'Astronomi ve Uzay Bilimleri', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  }
  if (!opts.skipSbc) {
    add('SSBC', 'Sosyal Bilim Çalışmaları', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': 2, '12': [2, 3, 4] } : (isGsl ? { '9': 2, '10': 1, '11': [2, 3], '12': [2, 3] } : { '9': [2, 3], '10': [2, 3], '11': [2, 3], '12': [2, 3] }));
  }
  add('SBTY', 'Bilişim Teknolojileri ve Yazılım', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2, 3] } : (isGsl ? { '9': 1, '10': 1, '11': [1, 2, 3], '12': [1, 2, 3] } : { ...(hasPrep ? { 'H': 1 } : {}), '9': 1, '10': [1, 2, 3], '11': [1, 2, 3], '12': [1, 2, 3] }));
  add('PRJ', 'Proje Tasarımı ve Uygulamaları', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': 2, '12': [2, 3, 4] } : (isGsl ? { '9': 2, '10': 1, '11': [2, 3], '12': [2, 3, 4] } : { ...(hasPrep ? { 'H': [2, 3] } : {}), '9': [2, 3, 4], '10': [2, 3, 4], '11': [2, 3, 4], '12': [2, 3, 4] }));
  add('DSN', 'Düşünme Eğitimi', 'secmeli', gI, isSpor ? { '9': 1, '10': 1 } : (isGsl ? { '9': [1, 2], '10': 1 } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2] }));
  add('DIH', 'Demokrasi ve İnsan Hakları', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('STG', 'Sürdürülebilir Tarım ve Gıda Güvenliği', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '10': 1, '11': [1, 2] } : { '10': [1, 2], '11': [1, 2] }));
  add('ICY', 'İklim, Çevre ve Yenilikçi Çözümler', 'secmeli', gI, isSpor ? { '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '10': 1, '11': [1, 2] } : { '10': [1, 2], '11': [1, 2] }));
  add('THB', 'Temel Hukuk Bilgisi', 'secmeli', gI, isSpor ? { '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '10': 1, '11': [1, 2], '12': [1, 2] } : { '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('GRS_C', 'Girişimcilik', 'secmeli', gI, { '11': [1, 2], '12': [1, 2] });
  add('MTH', 'Metin Tahlilleri', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2] }));
  add('SYD2', 'Seçmeli İkinci Yabancı Dil', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [2, 4] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [2, 4], '12': [2, 4] } : { ...(hasPrep ? { 'H': [1, 2, 3] } : {}), '9': [1, 2, 4], '10': [1, 2, 4], '11': [1, 2, 4], '12': [1, 2, 4] }));
  if (!opts.skipOsm) add('SOSM', 'Osmanlı Türkçesi', 'secmeli', gI, isSpor ? { '9': 1, '10': 1, '11': 2, '12': 2 } : (isGsl ? { '9': 2, '10': 1, '11': 2, '12': 2 } : { '9': 2, '10': 2, '11': 2, '12': 2 }));
  add('TDC', 'Türk Dünyası Coğrafyası', 'secmeli', gI, isSpor || isGsl ? { '10': 1, '11': [1, 2] } : { '10': [1, 2], '11': [1, 2] });
  add('OTE', 'Ortak Türk Edebiyatı', 'secmeli', gI, isSpor || isGsl ? { '10': 1, '11': [1, 2] } : { '10': [1, 2], '11': [1, 2] });
  add('OTT', 'Ortak Türk Tarihi', 'secmeli', gI, isSpor || isGsl ? { '10': 1, '11': [1, 2] } : { '10': [1, 2], '11': [1, 2] });

  // Din, Ahlak ve Değer
  add('KUR', "Kur'an-ı Kerim", 'secmeli', gD, isSpor ? { '9': 1, '10': 1, '11': 2, '12': 2 } : (isGsl ? { '9': 2, '10': 1, '11': 2, '12': 2 } : { ...(hasPrep ? { 'H': 2 } : {}), '9': 2, '10': 2, '11': 2, '12': 2 }), { canSplit: true });
  add('KAD', "Kur'an-ı Kerim'in Anlam Dünyası", 'secmeli', gD, { '11': 2, '12': 2 });
  add('PEY', 'Peygamberimizin Hayatı', 'secmeli', gD, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('TDB', 'Temel Dinî Bilgiler', 'secmeli', gD, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('TDT', 'Türk Düşünce Tarihi', 'secmeli', gD, isSpor || isGsl ? { '10': 1, '11': [1, 2], '12': [1, 2] } : { '10': [1, 2], '11': [1, 2], '12': [1, 2] });
  add('KAM', 'Klasik Ahlak Metinleri', 'secmeli', gD, isSpor ? { '9': 1, '10': 1, '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': [1, 2], '10': 1, '11': [1, 2], '12': [1, 2] } : { '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));

  // Kültür, Sanat ve Spor
  add('ADB', 'Adabımuaşeret', 'secmeli', gK, isSpor ? { '11': 1 } : (isGsl ? { '9': 1, '11': 1 } : { '9': 1, '10': 1 }));
  add('TSA', 'Türk Sosyal Hayatında Aile', 'secmeli', gK, isSpor ? { '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('IBT', 'İslam Bilim Tarihi', 'secmeli', gK, isSpor ? { '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  if (!opts.skipTkm) add('STKM', 'Türk Kültür ve Medeniyet Tarihi', 'secmeli', gK, isSpor ? { '11': 2, '12': 2 } : (isGsl ? { '9': 1, '11': 2, '12': 2 } : { '9': 2, '10': 2, '11': 2, '12': 2 }));
  add('IKM', 'İslam Kültür ve Medeniyeti', 'secmeli', gK, isSpor ? { '11': [1, 2], '12': [1, 2] } : (isGsl ? { '9': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2] } : {}), '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }));
  add('SPE', 'Spor Eğitimi', 'secmeli', gK, isSpor ? { '11': [1, 2], '12': [1, 2, 3] } : (isGsl ? { '9': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2, 3] } : {}), '9': [1, 2, 3], '10': [1, 2, 3], '11': [1, 2], '12': [1, 2] }));
  add('SNE', 'Sanat Eğitimi', 'secmeli', gK, isSpor ? { '11': [1, 2], '12': [1, 2, 3] } : (isGsl ? { '9': 1, '11': [1, 2], '12': [1, 2] } : { ...(hasPrep ? { 'H': [1, 2, 3] } : {}), '9': [1, 2, 3], '10': [1, 2, 3], '11': [1, 2], '12': [1, 2] }));
}

function getMebTemplatesForGrade(schoolTypeId, gradeKey, onlyType) {
  const list = [];
  const add = (code, name, cat, grp, spec, opts = {}) => {
    const isMand = (cat === 'zorunlu' || cat === 'meslek' || cat === 'serbest');
    if (onlyType === 'mandatory' && !isMand) return;
    if (onlyType === 'elective' && isMand) return;
    const val = spec[gradeKey];
    if (!val) return;
    const hourOpts = Array.isArray(val) ? val : [val];
    const hrs = hourOpts[hourOpts.length - 1];
    list.push({
      code, name, category: cat, group: grp, hours: hrs, hourOptions: hourOpts,
      blocks: typeof defaultBlocksForHours === 'function' ? defaultBlocksForHours(hrs) : [hrs],
      blockMode: 'auto',
      maxPerDay: opts.maxPerDay || 1,
      roomType: opts.roomType || (typeof inferRoomType === 'function' ? inferRoomType(name) : 'standard'),
      splitGroups: Boolean(opts.canSplit),
      useCommonSlot: false
    });
  };

  /* ---------------- 1. İLKOKUL (TTKB 23/09/2026 - 115) ---------------- */
  if (schoolTypeId === 'ilkokul') {
    add('TRK', 'Türkçe', 'zorunlu', 'Ortak', { '1': 10, '2': 10, '3': 8, '4': 8 }, { maxPerDay: 2 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '1': 5, '2': 5, '3': 5, '4': 5 });
    add('HYB', 'Hayat Bilgisi', 'zorunlu', 'Ortak', { '1': 4, '2': 4, '3': 3 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Ortak', { '3': 3, '4': 3 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Ortak', { '4': 3 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Ortak', { '2': 2, '3': 2, '4': 2 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '4': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Ortak', { '1': 1, '2': 1, '3': 1, '4': 1 });
    add('MZK', 'Müzik', 'zorunlu', 'Ortak', { '1': 1, '2': 1, '3': 1, '4': 1 });
    add('BEO', 'Beden Eğitimi ve Oyun', 'zorunlu', 'Ortak', { '1': 5, '2': 5, '3': 5, '4': 2 });
    add('TRF', 'Trafik Güvenliği', 'zorunlu', 'Ortak', { '4': 1 });
    add('IHD', 'İnsan Hakları, Vatandaşlık ve Demokrasi', 'zorunlu', 'Ortak', { '4': 2 });
    add('SRB', 'Serbest Etkinlikler', 'serbest', 'Serbest Etkinlik', { '1': 4, '2': 2, '3': 2 });

  /* ---------------- 2. ORTAOKUL (TTKB 23/09/2026 - 115) ---------------- */
  } else if (schoolTypeId === 'ortaokul') {
    add('TRK', 'Türkçe', 'zorunlu', 'Ortak', { '5': 6, '6': 6, '7': 5, '8': 5 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '5': 5, '6': 5, '7': 5, '8': 5 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Ortak', { '5': 4, '6': 4, '7': 4, '8': 4 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 3 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '8': 2 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 4, '8': 4 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('MZK', 'Müzik', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('BES', 'Beden Eğitimi ve Spor', 'zorunlu', 'Ortak', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('TKT', 'Teknoloji ve Tasarım', 'zorunlu', 'Ortak', { '7': 2, '8': 2 });
    add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Ortak', { '5': 2, '6': 2 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    _addOrtaokulElectives(add, false, false);

  /* ---------------- 3. GÜZEL SANATLAR MÜZİK İLKOKULU (TTKB 23/09/2026 - 114) ---------------- */
  } else if (schoolTypeId === 'muzik_ilkokul') {
    add('TRK', 'Türkçe', 'zorunlu', 'Ortak', { '1': 10, '2': 10, '3': 8, '4': 8 }, { maxPerDay: 2 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '1': 5, '2': 5, '3': 5, '4': 5 });
    add('HYB', 'Hayat Bilgisi', 'zorunlu', 'Ortak', { '1': 4, '2': 4, '3': 3 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Ortak', { '3': 3, '4': 3 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Ortak', { '4': 3 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Ortak', { '2': 2, '3': 2, '4': 2 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '4': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Ortak', { '1': 1, '2': 1, '3': 1, '4': 1 });
    add('BEOM', 'Beden Eğitimi, Oyun ve Müzik', 'zorunlu', 'Ortak', { '1': 5, '2': 5, '3': 5, '4': 2 });
    add('TRF', 'Trafik Güvenliği', 'zorunlu', 'Ortak', { '4': 1 });
    add('IHD', 'İnsan Hakları, Vatandaşlık ve Demokrasi', 'zorunlu', 'Ortak', { '4': 2 });
    // Müzik Alan Dersleri
    add('MIOY', 'Müziksel İşitme, Okuma ve Yazma', 'meslek', 'Müzik Alan', { '1': 1, '2': 1, '3': 2, '4': 2 }, { roomType: 'muzik_odasi' });
    add('TMTU', 'Türk Müziği Teori ve Uygulaması', 'meslek', 'Müzik Alan', { '1': 1, '2': 1, '3': 1, '4': 1 }, { roomType: 'muzik_odasi' });
    add('KORO', 'Koro ve Repertuvar', 'meslek', 'Müzik Alan', { '1': 2, '2': 2, '3': 2, '4': 2 }, { roomType: 'muzik_odasi' });
    add('BCE', 'Bireysel Çalgı Eğitimi', 'meslek', 'Müzik Alan', { '1': 1, '2': 1, '3': 2, '4': 2 }, { roomType: 'muzik_odasi' });
    add('BSE', 'Bireysel Ses Eğitimi', 'meslek', 'Müzik Alan', { '1': 1, '2': 1, '3': 1, '4': 1 }, { roomType: 'muzik_odasi' });
    add('CTO', 'Çalgı Toplulukları', 'meslek', 'Müzik Alan', { '3': 2, '4': 2 }, { roomType: 'muzik_odasi' });
    add('MZK_K', 'Müzik Kültürü', 'meslek', 'Müzik Alan', { '3': 1, '4': 1 }, { roomType: 'muzik_odasi' });
    add('SRB', 'Serbest Etkinlikler', 'serbest', 'Serbest Etkinlik', { '1': 4, '2': 2, '3': 2 });

  /* ---------------- 4. GÜZEL SANATLAR MÜZİK ORTAOKULU (TTKB 23/09/2026 - 114) ---------------- */
  } else if (schoolTypeId === 'muzik_ortaokul') {
    add('TRK', 'Türkçe', 'zorunlu', 'Ortak', { '5': 6, '6': 6, '7': 5, '8': 5 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '5': 5, '6': 5, '7': 5, '8': 5 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Ortak', { '5': 4, '6': 4, '7': 4, '8': 4 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 3 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '8': 2 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 4, '8': 4 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('BEOM', 'Beden Eğitimi, Oyun ve Müzik', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 2 });
    add('TKT', 'Teknoloji ve Tasarım', 'zorunlu', 'Ortak', { '7': 1, '8': 1 });
    add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Ortak', { '5': 1, '6': 1 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    // Müzik Alan Dersleri (10 sa/hafta)
    add('MIOY', 'Müziksel İşitme, Okuma ve Yazma', 'meslek', 'Müzik Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'muzik_odasi' });
    add('TMTU', 'Türk Müziği Teori ve Uygulaması', 'meslek', 'Müzik Alan', { '5': 1, '6': 1, '7': 1, '8': 1 }, { roomType: 'muzik_odasi' });
    add('KORO', 'Koro ve Repertuvar', 'meslek', 'Müzik Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'muzik_odasi' });
    add('BCE', 'Bireysel Çalgı Eğitimi', 'meslek', 'Müzik Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'muzik_odasi' });
    add('BSE', 'Bireysel Ses Eğitimi', 'meslek', 'Müzik Alan', { '5': 1, '6': 1, '7': 1, '8': 1 }, { roomType: 'muzik_odasi' });
    add('CTO', 'Çalgı Toplulukları', 'meslek', 'Müzik Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'muzik_odasi' });
    // Seçmeli dersler (tümü 1 saat, Müzik hariç)
    _addOrtaokulElectives(add, true, true);

  /* ---------------- 5. SPOR ORTAOKULU (TTKB 23/09/2026 - 113) ---------------- */
  } else if (schoolTypeId === 'spor_ortaokul') {
    add('TRK', 'Türkçe', 'zorunlu', 'Ortak', { '5': 6, '6': 6, '7': 5, '8': 5 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '5': 5, '6': 5, '7': 5, '8': 5 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Ortak', { '5': 4, '6': 4, '7': 4, '8': 4 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 3 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '8': 2 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Ortak', { '5': 3, '6': 3, '7': 4, '8': 4 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('MZK', 'Müzik', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('TKT', 'Teknoloji ve Tasarım', 'zorunlu', 'Ortak', { '7': 1, '8': 1 });
    add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Ortak', { '5': 1, '6': 1 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '5': 1, '6': 1, '7': 1, '8': 1 });
    // Spor Alan Dersleri (10/10/10/11)
    add('BEST', 'Beden Eğitimi ve Sporun Temelleri', 'meslek', 'Spor Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'spor_salonu' });
    add('REHO', 'Ritim Eğitimi ve Halk Oyunları', 'meslek', 'Spor Alan', { '5': 1, '6': 1, '7': 1, '8': 2 }, { roomType: 'spor_salonu' });
    add('OTF', 'Oyun ve Taktiksel Farkındalık', 'meslek', 'Spor Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'spor_salonu' });
    add('CAPU', 'Çocuklarda Atletik Performans Uygulamaları', 'meslek', 'Spor Alan', { '5': 2, '6': 2, '7': 2, '8': 2 }, { roomType: 'spor_salonu' });
    add('KSE', 'Kapsamlı Spor Eğitimi', 'meslek', 'Spor Alan', { '5': 3, '6': 3, '7': 3, '8': 3 }, { roomType: 'spor_salonu' });
    // Seçmeli dersler (tümü 1 saat)
    _addOrtaokulElectives(add, true, false);

  /* ---------------- 6. İMAM HATİP ORTAOKULU (TTKB 23/09/2026 - 117) ---------------- */
  } else if (schoolTypeId === 'iho') {
    add('TRK', 'Türkçe', 'zorunlu', 'Zorunlu', { '5': 6, '6': 6, '7': 5, '8': 5 });
    add('MAT', 'Matematik', 'zorunlu', 'Zorunlu', { '5': 5, '6': 5, '7': 5, '8': 5 });
    add('FEN', 'Fen Bilimleri', 'zorunlu', 'Zorunlu', { '5': 4, '6': 4, '7': 4, '8': 4 });
    add('SOS', 'Sosyal Bilgiler', 'zorunlu', 'Zorunlu', { '5': 3, '6': 3, '7': 3 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Zorunlu', { '8': 2 });
    add('ING', 'Yabancı Dil', 'zorunlu', 'Zorunlu', { '5': 3, '6': 3, '7': 4, '8': 4 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Zorunlu', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('GRS', 'Görsel Sanatlar', 'zorunlu', 'Zorunlu', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('MZK', 'Müzik', 'zorunlu', 'Zorunlu', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('BES', 'Beden Eğitimi ve Spor', 'zorunlu', 'Zorunlu', { '5': 2, '6': 1, '7': 1, '8': 1 });
    add('TKT', 'Teknoloji ve Tasarım', 'zorunlu', 'Zorunlu', { '7': 1, '8': 2 });
    add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Zorunlu', { '5': 1, '6': 1 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Zorunlu', { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('KUR', "Kur'an-ı Kerim", 'zorunlu', 'Zorunlu', { '5': 2, '6': 2, '7': 2, '8': 2 }, { canSplit: true });
    add('ARP', 'Arapça', 'zorunlu', 'Zorunlu', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('PEY', 'Peygamberimizin Hayatı', 'zorunlu', 'Zorunlu', { '5': 2, '6': 2, '7': 2, '8': 2 });
    add('TDB', 'Temel Dinî Bilgiler', 'zorunlu', 'Zorunlu', { '6': 1, '7': 1 });

    // Standart İHO Seçmeli Dersler (TTKB 117 Sayfa 3)
    const g1 = 'İnsan, Toplum ve Bilim';
    add('MBU', 'Matematik ve Bilim Uygulamaları', 'secmeli', g1, { '6': 1, '7': 1 });
    add('OKB', 'Okuma Becerileri', 'secmeli', g1, { '5': 1, '6': 1 });
    add('YZB', 'Yazarlık ve Yazma Becerileri', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('YDL', 'Yaşayan Diller ve Lehçeler', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': [1, 2] });
    add('SYD', 'Yabancı Dil (Seçmeli)', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': [1, 2] });
    add('CEV', 'Çevre Eğitimi ve İklim Değişikliği', 'secmeli', g1, { '6': 1, '7': 1, '8': 1 });
    add('SHR', '“Şehrimiz…”', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('HUK', 'Hukuk ve Adalet', 'secmeli', g1, { '6': 1, '7': 1, '8': 1 });
    add('DSN', 'Düşünme Eğitimi', 'secmeli', g1, { '7': 1, '8': 1 });
    add('ROB', 'Robotik Kodlama', 'secmeli', g1, { '5': 1, '6': 1 });
    add('YZU', 'Yapay Zekâ Uygulamaları', 'secmeli', g1, { '7': 1, '8': [1, 2] });
    add('PRJ', 'Proje Tasarımı ve Uygulamaları', 'secmeli', g1, { '5': 1, '6': 1, '7': 1 });
    add('OSS', 'Okul Temelli Sosyal Sorumluluk Çalışmaları', 'secmeli', g1, { '6': 1, '7': 1, '8': [1, 2] });
    add('MED', 'Medya Okuryazarlığı', 'secmeli', g1, { '7': 1, '8': 1 });
    add('AFT', 'Afet Bilinci', 'secmeli', g1, { '5': 1, '6': 1, '7': 1 });
    add('TYB', 'Temel Yaşam Becerileri', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('TSA', 'Türk Sosyal Hayatında Aile', 'secmeli', g1, { '5': 1, '6': 1, '7': 1, '8': 1 });

    const g2 = 'Din, Ahlak ve Değer';
    add('SKUR', "Kur'an-ı Kerim (Seçmeli)", 'secmeli', g2, { '5': 1, '6': 1, '7': 1, '8': [1, 2] }, { canSplit: true });
    add('KMV', 'Kültür ve Medeniyetimize Yön Verenler', 'secmeli', g2, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('AVE', 'Ahlak ve Vatandaşlık Eğitimi', 'secmeli', g2, { '5': 1, '6': 1, '7': 1, '8': 1 });

    const g3 = 'Kültür, Sanat ve Spor';
    add('GRG', 'Görgü Kuralları ve Nezaket', 'secmeli', g3, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('SMZ', 'Müzik (Seçmeli)', 'secmeli', g3, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('SFE', 'Spor ve Fiziki Etkinlikler', 'secmeli', g3, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('OYN', 'Oyun ve Oyun Etkinlikleri', 'secmeli', g3, { '5': 1, '6': 1, '7': 1 });
    add('DJS', 'Dijital Sanatlar', 'secmeli', g3, { '6': 1, '7': 1 });
    add('MSL', 'Masal ve Destanlarımız', 'secmeli', g3, { '5': 1, '6': 1, '7': 1, '8': 1 });
    add('GLN', 'Geleneksel Sanatlar', 'secmeli', g3, { '6': 1, '7': 1 });
    add('HLK', 'Halk Oyunları', 'secmeli', g3, { '5': 1, '6': 1, '7': 1, '8': 1 });

    // İHO Müzik & Spor Programı Seçmeli Dersleri (TTKB 117 Sayfa 4)
    const gM = 'Müzik Programı Seçmeli';
    add('IHO_BEOM', 'Beden Eğitimi, Oyun ve Müzik', 'secmeli', gM, { '5': 1, '6': 1, '7': 1, '8': [1, 2] });
    add('IHO_MIOY', 'Müziksel İşitme, Okuma ve Yazma', 'secmeli', gM, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'muzik_odasi' });
    add('IHO_TMTU', 'Türk Müziği Teori ve Uygulaması', 'secmeli', gM, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'muzik_odasi' });
    add('IHO_KORO', 'Koro ve Repertuvar', 'secmeli', gM, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'muzik_odasi' });
    add('IHO_BCE', 'Bireysel Çalgı Eğitimi', 'secmeli', gM, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'muzik_odasi' });
    add('IHO_BSE', 'Bireysel Ses Eğitimi', 'secmeli', gM, { '5': 1, '6': 1, '7': 1, '8': 1 }, { roomType: 'muzik_odasi' });
    add('IHO_CTO', 'Çalgı Toplulukları', 'secmeli', gM, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'muzik_odasi' });

    const gS = 'Spor Programı Seçmeli';
    add('IHO_BEST', 'Beden Eğitimi ve Sporun Temelleri', 'secmeli', gS, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'spor_salonu' });
    add('IHO_REHO', 'Ritim Eğitimi ve Halk Oyunları', 'secmeli', gS, { '5': 1, '6': 1, '7': 1, '8': [1, 2] }, { roomType: 'spor_salonu' });
    add('IHO_OTF', 'Oyun ve Taktiksel Farkındalık', 'secmeli', gS, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'spor_salonu' });
    add('IHO_CAPU', 'Çocuklarda Atletik Performans Uygulamaları', 'secmeli', gS, { '5': [1, 2], '6': [1, 2], '7': [1, 2], '8': [1, 2] }, { roomType: 'spor_salonu' });
    add('IHO_KSE', 'Kapsamlı Spor Eğitimi', 'secmeli', gS, { '5': 3, '6': 3, '7': 3, '8': 3 }, { roomType: 'spor_salonu' });

  /* ---------------- 7. ANADOLU / FEN / SOSYAL BİLİMLER LİSELERİ (TTKB 09/05/2025 - 05) ---------------- */
  } else if (schoolTypeId === 'anadolu' || schoolTypeId === 'fen' || schoolTypeId === 'sosyal') {
    // Hazırlık Sınıfı Ortak Dersleri
    add('HTDE', 'Hazırlık Sınıfı Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { 'H': 4 });
    add('HMAT', 'Hazırlık Sınıfı Matematik', 'zorunlu', 'Ortak', { 'H': 3 });
    add('HYD1', 'Birinci Yabancı Dil (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 20 }, { maxPerDay: 2 });
    add('HYD2', 'İkinci Yabancı Dil (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 4 });
    if (schoolTypeId === 'sosyal') {
      add('HBGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 4 });
    } else {
      add('HBTY', 'Bilişim Teknolojileri ve Yazılım (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 4 });
      add('HBES', 'Beden Eğitimi ve Spor (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 2 });
      add('HGMZ', 'Görsel Sanatlar / Müzik (Hazırlık)', 'zorunlu', 'Ortak', { 'H': 2 });
    }

    // 9–12 Ortak Dersler
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });

    const gA = 'Akademik Çalışmalar';
    if (schoolTypeId === 'anadolu') {
      add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6 });
      add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
      add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 4, '12': 4 });
      add('BES', 'Beden Eğitimi ve Spor', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
      add('GMZ', 'Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
      add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { '12': 2 });
      add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1, '10': 1, '11': 1, '12': 1 });

      // Anadolu Lisesi Akademik Seçmeliler
      add('SMAT', 'Seçmeli Matematik', 'secmeli', gA, { '11': 6, '12': 6 });
      add('TMAT', 'Temel Matematik', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SFIZ', 'Seçmeli Fizik', 'secmeli', gA, { '11': 4, '12': 4 });
      add('SKIM', 'Seçmeli Kimya', 'secmeli', gA, { '11': 4, '12': 4 });
      add('SBIY', 'Seçmeli Biyoloji', 'secmeli', gA, { '11': 4, '12': 4 });
      add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': [3, 5], '12': [3, 5] });
      add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
      add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
      add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
      add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SMNT', 'Mantık', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': [2, 10, 12], '12': [2, 10, 12] });
      add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
      _addLiseCommonElectives(add, {});
    } else if (schoolTypeId === 'fen') {
      add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6, '11': 6, '12': 6 });
      add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
      add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
      add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
      add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
      add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 4, '12': 4 });
      add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('BES', 'Beden Eğitimi ve Spor', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
      add('GMZ', 'Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1, '10': 1, '11': 1, '12': 1 });

      // Fen Lisesi Akademik Seçmeliler
      add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': [2, 3], '12': [3, 4] });
      add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': [2, 3], '12': [2, 4] });
      add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
      add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': [2, 3], '12': [2, 4] });
      add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SMNT', 'Mantık', 'secmeli', gA, { '11': 2, '12': 2 });
      add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': [2, 3], '12': [2, 3, 4] });
      add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
      // Fen Lisesine Özgü İnsan, Toplum ve Bilim dersleri
      add('GEN', 'Genetik Bilimine Giriş', 'secmeli', 'İnsan, Toplum ve Bilim', { '11': [2, 3], '12': [2, 3] });
      add('TIP', 'Tıp Bilimine Giriş', 'secmeli', 'İnsan, Toplum ve Bilim', { '11': [2, 3], '12': [2, 3] });
      _addLiseCommonElectives(add, {});
    } else {
      // Sosyal Bilimler Lisesi
      add('TKM', 'Türk Kültür ve Medeniyet Tarihi', 'zorunlu', 'Ortak', { '11': 2 });
      add('CTD', 'Çağdaş Türk ve Dünya Tarihi', 'zorunlu', 'Ortak', { '12': 2 });
      add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
      add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6, '11': 6, '12': 6 });
      add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
      add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 2, '12': 2 });
      add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
      add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
      add('SBC', 'Sosyal Bilim Çalışmaları', 'zorunlu', 'Ortak', { '10': 2, '11': 2, '12': 2 });
      add('PSK', 'Psikoloji', 'zorunlu', 'Ortak', { '11': 2 });
      add('SYJ', 'Sosyoloji', 'zorunlu', 'Ortak', { '11': 2, '12': 2 });
      add('SNT', 'Sanat Tarihi', 'zorunlu', 'Ortak', { '12': 2 });
      add('MNT', 'Mantık', 'zorunlu', 'Ortak', { '11': 2 });
      add('OSM', 'Osmanlı Türkçesi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1, '10': 1, '12': 1 });

      // SBL Seçmeliler (Hazırlık dahil)
      add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': 1, '12': [2, 3] });
      add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': 1, '12': [2, 3] });
      add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
      add('EDU', 'Edebiyat Uygulamaları', 'secmeli', 'İnsan, Toplum ve Bilim', { '9': 2, '10': 2, '11': [1, 2], '12': 2 });
      _addLiseCommonElectives(add, { sbl: true, hasPrepElectives: true, skipAstro: true, skipSbc: true, skipOsm: true, skipTkm: true });
    }

  /* ---------------- 8. ANADOLU İMAM HATİP LİSESİ (TTKB 23/07/2025 - 26) ---------------- */
  } else if (schoolTypeId === 'aihl') {
    // Ortak Dersler
    add('HTDE', 'Hazırlık Sınıfı Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { 'H': 3 });
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('HMAT', 'Hazırlık Sınıfı Matematik', 'zorunlu', 'Ortak', { 'H': 3 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
    add('YD1', 'Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 20, '9': 5, '10': 2, '11': 2, '12': 2 }, { maxPerDay: 2 });
    add('BTY', 'Bilişim Teknolojileri ve Yazılım', 'zorunlu', 'Ortak', { 'H': 3 });
    add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 1, '11': 1 });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
    add('ARP', 'Arapça', 'zorunlu', 'Ortak', { '9': 4, '10': 3 });
    add('YD2', 'İkinci Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 4 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1 });
    // Meslek Dersleri
    add('KUR', "Kur'an-ı Kerim", 'meslek', 'Meslek', { 'H': 4, '9': 5, '10': 4, '11': 4, '12': 3 }, { canSplit: true });
    add('MARP', 'Mesleki Arapça', 'meslek', 'Meslek', { '11': 3, '12': 2 });
    add('TDB', 'Temel Dinî Bilgiler', 'meslek', 'Meslek', { '9': 1 });
    add('SIY', 'Siyer', 'meslek', 'Meslek', { '10': 2 });
    add('FIK', 'Fıkıh', 'meslek', 'Meslek', { '10': 2 });
    add('TEF', 'Tefsir', 'meslek', 'Meslek', { '11': 2 });
    add('DIN', 'Dinler Tarihi', 'meslek', 'Meslek', { '12': 1 });
    add('HAD', 'Hadis', 'meslek', 'Meslek', { '10': 2 });
    add('AKA', 'Akaid', 'meslek', 'Meslek', { '11': 1 });
    add('KEL', 'Kelam', 'meslek', 'Meslek', { '12': 2 });
    add('HIT', 'Hitabet ve Mesleki Uygulama', 'meslek', 'Meslek', { '11': 2 });
    add('IKM', 'İslam Kültür ve Medeniyeti', 'meslek', 'Meslek', { '12': 2 });
    add('OSM', 'Osmanlı Türkçesi', 'meslek', 'Meslek', { '10': 1 });

    // A GRUBU SEÇMELİLER — Temel İslam Bilimleri
    const gTIB = 'A Grubu · Temel İslam Bilimleri';
    add('ARPM', 'Arapça (Metin–Mükâleme)', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('FIKO', 'Fıkıh Okumaları', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('HADM', 'Hadis Metinleri', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('IAHL', 'İslam Ahlakı', 'secmeli', gTIB, { '11': 1, '12': 1 });
    add('IBT', 'İslam Bilim Tarihi', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('IFEL', 'İslam Felsefesi', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('ITAR', 'İslam Tarihi', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('KOT', "Kur'an Okuma Teknikleri", 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('KAK', "Kur'an'ın Ana Konuları", 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('MUYG', 'Mesleki Uygulama', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('TASV', 'Tasavvuf Kültürü', 'secmeli', gTIB, { '11': 1, '12': 1 });
    add('TEFO', 'Tefsir Okumaları', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });
    add('KAM', 'Klasik Ahlak Metinleri', 'secmeli', gTIB, { '11': [1, 2], '12': [1, 2] });

    // A GRUBU SEÇMELİLER — Türk İslam Sanatları
    const gTIS = 'A Grubu · Türk İslam Sanatları';
    add('DMUS', 'Dinî Musiki', 'secmeli', gTIS, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
    add('EBRU', 'Ebru', 'secmeli', gTIS, { '11': [1, 2], '12': [1, 2] }, { roomType: 'gorsel_atolye' });
    add('HSNH', 'Hüsnühat', 'secmeli', gTIS, { '11': [1, 2], '12': [1, 2] }, { roomType: 'gorsel_atolye' });
    add('TEZH', 'Tezhip', 'secmeli', gTIS, { '11': [1, 2], '12': [1, 2] }, { roomType: 'gorsel_atolye' });

    // A GRUBU SEÇMELİLER — Akademik Çalışmalar
    const gAA = 'A Grubu · Akademik Çalışmalar';
    add('SMAT', 'Seçmeli Matematik', 'secmeli', gAA, { '11': [3, 4, 5, 6], '12': [3, 4, 5, 6] });
    add('TMAT', 'Temel Matematik', 'secmeli', gAA, { '11': 2, '12': 2 });
    add('SBIY', 'Seçmeli Biyoloji', 'secmeli', gAA, { '11': [2, 3, 4], '12': [2, 3, 4] });
    add('SFIZ', 'Seçmeli Fizik', 'secmeli', gAA, { '11': [3, 4], '12': [3, 4] });
    add('SKIM', 'Seçmeli Kimya', 'secmeli', gAA, { '11': [3, 4], '12': [3, 4] });
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gAA, { '11': [2, 3, 4, 5], '12': [2, 3, 4, 5] });
    add('STAR', 'Seçmeli Tarih', 'secmeli', gAA, { '12': [2, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gAA, { '12': [2, 4] });
    add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gAA, { '11': [2, 4], '12': [2, 4] });
    add('SPSK', 'Psikoloji', 'secmeli', gAA, { '11': 2, '12': 2 });
    add('SSYJ', 'Sosyoloji', 'secmeli', gAA, { '11': 2, '12': 2 });
    add('SMNT', 'Mantık', 'secmeli', gAA, { '11': 2, '12': 2 });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gAA, { '11': [2, 10, 12], '12': [2, 10, 12] });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gAA, { '12': [3, 4, 5, 6] });

    // A GRUBU SEÇMELİLER — İnsan, Toplum ve Bilim & Kültür, Sanat ve Spor
    const gAI = 'A Grubu · İnsan, Toplum ve Bilim';
    add('FBU', 'Fen Bilimleri Uygulamaları', 'secmeli', gAI, { '11': [2, 3], '12': [2, 3] });
    add('AST', 'Astronomi ve Uzay Bilimleri', 'secmeli', gAI, { '10': 1, '11': [1, 2], '12': [1, 2] });
    add('SSBC', 'Sosyal Bilim Çalışmaları', 'secmeli', gAI, { '10': [1, 2], '11': [2, 3, 4], '12': [2, 3, 4] });
    add('SBTY', 'Bilişim Teknolojileri ve Yazılım', 'secmeli', gAI, { '9': [1, 2], '10': [1, 2], '11': [1, 2, 3], '12': [1, 2, 3] });
    add('PRJ', 'Proje Tasarımı ve Uygulamaları', 'secmeli', gAI, { '10': 1, '11': [2, 3, 4], '12': [2, 3, 4] });
    add('DSN', 'Düşünme Eğitimi', 'secmeli', gAI, { '10': 1, '11': 1, '12': 1 });
    add('DIH', 'Demokrasi ve İnsan Hakları', 'secmeli', gAI, { '11': 1, '12': 1 });
    add('STG', 'Sürdürülebilir Tarım ve Gıda Güvenliği', 'secmeli', gAI, { '10': 1, '11': [1, 2], '12': [1, 2] });
    add('ICY', 'İklim, Çevre ve Yenilikçi Çözümler', 'secmeli', gAI, { '10': 1, '11': [1, 2], '12': [1, 2] });
    add('THB', 'Temel Hukuk Bilgisi', 'secmeli', gAI, { '10': 1, '11': [1, 2], '12': [1, 2] });
    add('GRS_C', 'Girişimcilik', 'secmeli', gAI, { '11': [1, 2], '12': [1, 2] });
    add('MTH', 'Metin Tahlilleri', 'secmeli', gAI, { '11': [1, 2], '12': [1, 2] });
    add('SYD2', 'Seçmeli İkinci Yabancı Dil', 'secmeli', gAI, { '9': [1, 2], '10': [1, 2], '11': [2, 4], '12': [2, 4] });
    add('SOSM', 'Osmanlı Türkçesi (Seçmeli)', 'secmeli', gAI, { '10': [1, 2], '11': 2, '12': 2 });
    add('TDC', 'Türk Dünyası Coğrafyası', 'secmeli', gAI, { '11': [1, 2] });
    add('OTE', 'Ortak Türk Edebiyatı', 'secmeli', gAI, { '11': [1, 2] });
    add('OTT', 'Ortak Türk Tarihi', 'secmeli', gAI, { '11': [1, 2] });
    add('TDT', 'Türk Düşünce Tarihi', 'secmeli', gAI, { '10': 1, '11': [1, 2], '12': [1, 2] });

    const gAK = 'A Grubu · Kültür, Sanat ve Spor';
    add('STKM', 'Türk Kültür ve Medeniyeti Tarihi', 'secmeli', gAK, { '11': [2, 4], '12': [2, 4] });
    add('ADB', 'Adabımuaşeret', 'secmeli', gAK, { '11': [1, 2], '12': [1, 2] });
    add('TSA', 'Türk Sosyal Hayatında Aile', 'secmeli', gAK, { '11': [1, 2], '12': [1, 2] });
    add('SPE', 'Spor Eğitimi', 'secmeli', gAK, { '10': [1, 2], '11': [1, 2, 3], '12': [1, 2, 3] });
    add('SNE', 'Sanat Eğitimi', 'secmeli', gAK, { '10': [1, 2], '11': [1, 2, 3], '12': [1, 2, 3] });

    // B GRUBU PROJE/PROGRAM SEÇMELİLERİ (Özet + Ana Dersler)
    const gBS = 'B Grubu · Spor Programı';
    add('B_ATL', 'Atletizm', 'secmeli', gBS, { '11': 2, '12': 2 }, { roomType: 'spor_salonu' });
    add('B_TAK', 'Takım Sporları', 'secmeli', gBS, { '9': [1, 2], '10': 2, '11': [2, 3], '12': [2, 3] }, { roomType: 'spor_salonu' });
    add('B_BIR', 'Bireysel Sporlar', 'secmeli', gBS, { '10': 2, '11': [2, 3], '12': [2, 3] }, { roomType: 'spor_salonu' });
    add('B_SPU', 'Spor Uygulamaları', 'secmeli', gBS, { '10': [1, 2], '11': [2, 3], '12': [2, 3] }, { roomType: 'spor_salonu' });
    const gBM = 'B Grubu · Musiki Programı';
    add('B_CLG', 'Çalgı Eğitimi', 'secmeli', gBM, { '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
    add('B_TSM', 'Türk Sanat Müziği Teori ve Uygulaması', 'secmeli', gBM, { '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
    add('B_THM', 'Türk Halk Müziği Teori ve Uygulaması', 'secmeli', gBM, { '9': [1, 2], '10': [1, 2], '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
    const gBG = 'B Grubu · Görsel Sanatlar';
    add('B_DSN', 'Desen', 'secmeli', gBG, { '9': 2, '10': [2, 3], '11': [2, 3], '12': [2, 3] }, { roomType: 'gorsel_atolye' });
    add('B_IBS', 'İki Boyutlu Sanat Atölye', 'secmeli', gBG, { '10': [2, 3], '11': [2, 3], '12': [2, 3] }, { roomType: 'gorsel_atolye' });
    const gBF = 'B Grubu · Fen ve Teknoloji';
    add('B_ROB', 'Robotik ve Kodlama', 'secmeli', gBF, { 'H': 2, '9': 2, '10': [1, 2] }, { roomType: 'bilisim_lab' });
    add('B_YZM', 'Yapay Zekâ ve Makine Öğrenmesi', 'secmeli', gBF, { '11': [2, 3], '12': [2, 3] }, { roomType: 'bilisim_lab' });
    add('B_SIB', 'Siber Güvenlik Temelleri', 'secmeli', gBF, { '10': [1, 2], '11': 2 }, { roomType: 'bilisim_lab' });
    const gBC = 'B Grubu · Çocuk Gelişimi';
    add('B_CG', 'Çocuk Gelişimi', 'secmeli', gBC, { '10': [2, 3] });
    add('B_ECP', 'Erken Çocukluk ve Özel Eğitimde Program Atölyesi', 'secmeli', gBC, { '11': 6, '12': 6 });

  /* ---------------- 9. GÜZEL SANATLAR LİSESİ (4 BÖLÜM: TTKB 06 & 07) ---------------- */
  } else if (schoolTypeId === 'gsl_gorsel' || schoolTypeId === 'gsl_tiyatro' || schoolTypeId === 'gsl_muzik' || schoolTypeId === 'gsl_turk_muzigi') {
    // Ortak Genel Kültür Dersleri
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
    add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 4, '12': 4 });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });

    const gA = 'Akademik Çalışmalar';
    if (schoolTypeId === 'gsl_gorsel') {
      add('BESM', 'Beden Eğitimi ve Spor / Müzik', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });
      add('DES', 'Desen', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 4, '12': 5 }, { roomType: 'gorsel_atolye' });
      add('IBSA', 'İki Boyutlu Sanat Atölye', 'zorunlu', 'Ortak', { '10': 4, '11': 4, '12': 5 }, { roomType: 'gorsel_atolye' });
      add('UBSA', 'Üç Boyutlu Sanat Atölye', 'zorunlu', 'Ortak', { '11': 4 }, { roomType: 'gorsel_atolye' });
      add('IMGR', 'İmgesel Resim', 'zorunlu', 'Ortak', { '11': 3, '12': 5 }, { roomType: 'gorsel_atolye' });
      add('EST', 'Estetik', 'zorunlu', 'Ortak', { '11': 2 });
      add('TSE', 'Temel Sanat Eğitimi', 'zorunlu', 'Ortak', { '9': 4 }, { roomType: 'gorsel_atolye' });
      add('GST', 'Genel Sanat Tarihi', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('TIST', 'Türk İslam Sanatı Tarihi', 'zorunlu', 'Ortak', { '11': 2 });
      add('SEI', 'Sanat Eserlerini İnceleme', 'zorunlu', 'Ortak', { '12': 2 });
      add('GRT', 'Grafik Tasarım', 'zorunlu', 'Ortak', { '11': 4 }, { roomType: 'gorsel_atolye' });
      add('GTS', 'Geleneksel Türk Sanatları', 'zorunlu', 'Ortak', { '10': 1 }, { roomType: 'gorsel_atolye' });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '9': 1, '12': 1 });

      // GSL Görsel Sanatlar Seçmeli
      add('TDES', 'Temel Desen', 'secmeli', gA, { '9': 1 }, { roomType: 'gorsel_atolye' });
      add('DESC', 'Desen Çalışmaları', 'secmeli', gA, { '11': [2, 3], '12': [2, 3, 4] }, { roomType: 'gorsel_atolye' });
      add('DGRF', 'Dijital Grafik', 'secmeli', gA, { '11': 2, '12': 2 }, { roomType: 'bilisim_lab' });
      add('SGTS', 'Geleneksel Türk Sanatları (Seçmeli)', 'secmeli', gA, { '11': 2, '12': 2 }, { roomType: 'gorsel_atolye' });
      add('ENDT', 'Endüstriyel Tasarım', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
      add('FOT', 'Fotoğraf', 'secmeli', gA, { '11': 2, '12': 2 });
      add('MUZE', 'Müze Eğitimi', 'secmeli', gA, { '9': [1, 2], '11': [1, 2], '12': [1, 2] });
    } else if (schoolTypeId === 'gsl_tiyatro') {
      add('BESM', 'Beden Eğitimi ve Spor / Müzik', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });
      add('OYN', 'Oyunculuk', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 6, '12': 6 });
      add('HRK', 'Hareket', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
      add('SESK', 'Ses ve Konuşma', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 3, '12': 3 });
      add('TYTT', 'Tiyatro Tarihi', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
      add('DRM', 'Dramaturji', 'zorunlu', 'Ortak', { '11': 2, '12': 2 });
      add('OYNC', 'Oyun Çalışması', 'zorunlu', 'Ortak', { '11': 6, '12': 6 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });

      add('SBSE', 'Bireysel Ses Eğitimi', 'secmeli', gA, { '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('SGTS', 'Geleneksel Türk Sanatları', 'secmeli', gA, { '11': 2, '12': 2 }, { roomType: 'gorsel_atolye' });
    } else if (schoolTypeId === 'gsl_muzik') {
      add('BESG', 'Beden Eğitimi ve Spor / Görsel Sanatlar', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });
      add('BMTU', 'Batı Müziği Teori ve Uygulaması', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('TMTU', 'Türk Müziği Teori ve Uygulaması', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('CLG', 'Çalgı Eğitimi', 'zorunlu', 'Ortak', { '9': 4, '10': 2, '11': 4, '12': 4 }, { roomType: 'muzik_odasi' });
      add('PIY', 'Piyano', 'zorunlu', 'Ortak', { '9': 2, '10': 2 }, { roomType: 'muzik_odasi' });
      add('BKU', 'Bağlama / Kanun / Ut', 'zorunlu', 'Ortak', { '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('KORO', 'Koro ve Repertuvar', 'zorunlu', 'Ortak', { '10': 2, '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('CTO', 'Çalgı Toplulukları', 'zorunlu', 'Ortak', { '11': 4, '12': 4 }, { roomType: 'muzik_odasi' });
      add('BSE', 'Bireysel Ses Eğitimi', 'zorunlu', 'Ortak', { '12': 2 }, { roomType: 'muzik_odasi' });
      add('TDTM', 'Türk Dünyası ve Türk İslam Musikisi', 'zorunlu', 'Ortak', { '12': 1 }, { roomType: 'muzik_odasi' });
      add('TBMT', 'Türk ve Batı Müziği Tarihi', 'zorunlu', 'Ortak', { '11': 2 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });

      add('BDM', 'Bilişim Destekli Müzik', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('SBMT', 'Seçmeli Batı Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('STSM', 'Seçmeli Türk Sanat Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('STHM', 'Seçmeli Türk Halk Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('SPIY', 'Seçmeli Piyano', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('TSE_M', 'Toplu Ses Eğitimi', 'secmeli', gA, { '9': 1 }, { roomType: 'muzik_odasi' });
      add('CBO', 'Çalgı Bakım ve Onarımı', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
      add('MZK_K', 'Müzik Kültürü', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    } else {
      // GSL Türk Müziği
      add('BESG', 'Beden Eğitimi ve Spor / Görsel Sanatlar', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });
      add('BMTU', 'Batı Müziği Teori ve Uygulaması', 'zorunlu', 'Ortak', { '9': 2, '10': 2 }, { roomType: 'muzik_odasi' });
      add('TMTU', 'Türk Müziği Teori ve Uygulaması', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('CLG', 'Çalgı Eğitimi', 'zorunlu', 'Ortak', { '9': 4, '10': 2, '11': 4, '12': 4 }, { roomType: 'muzik_odasi' });
      add('PIY', 'Piyano', 'zorunlu', 'Ortak', { '9': 2, '10': 2 }, { roomType: 'muzik_odasi' });
      add('BKU', 'Bağlama / Kanun / Ut', 'zorunlu', 'Ortak', { '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('TMKR', 'Türk Müziği Koro ve Repertuvarı', 'zorunlu', 'Ortak', { '10': 2, '11': 2, '12': 2 }, { roomType: 'muzik_odasi' });
      add('CTO', 'Çalgı Toplulukları', 'zorunlu', 'Ortak', { '11': 4, '12': 4 }, { roomType: 'muzik_odasi' });
      add('BSE', 'Bireysel Ses Eğitimi', 'zorunlu', 'Ortak', { '12': 2 }, { roomType: 'muzik_odasi' });
      add('TDTM', 'Türk Dünyası ve Türk İslam Musikisi', 'zorunlu', 'Ortak', { '12': 1 }, { roomType: 'muzik_odasi' });
      add('TMT', 'Türk Müziği Tarihi', 'zorunlu', 'Ortak', { '11': 2 });
      add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });

      add('STSM', 'Seçmeli Türk Sanat Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('STHM', 'Seçmeli Türk Halk Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('SBMT', 'Seçmeli Batı Müziği Teori ve Uygulaması', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('BDM', 'Bilişim Destekli Müzik', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'muzik_odasi' });
      add('TSE_M', 'Toplu Ses Eğitimi', 'secmeli', gA, { '9': 1 }, { roomType: 'muzik_odasi' });
      add('CBO', 'Çalgı Bakım ve Onarımı', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
      add('MZK_K', 'Müzik Kültürü', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    }

    // GSL Ortak Akademik Seçmeliler
    add('SMAT', 'Seçmeli Matematik', 'secmeli', gA, { '11': [2, 3, 4], '12': [2, 3, 4] });
    add('TMAT', 'Temel Matematik', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SFIZ', 'Seçmeli Fizik', 'secmeli', gA, { '11': [2, 3, 4], '12': [2, 3, 4] });
    add('SKIM', 'Seçmeli Kimya', 'secmeli', gA, { '11': [2, 3, 4], '12': [2, 3, 4] });
    add('SBIY', 'Seçmeli Biyoloji', 'secmeli', gA, { '11': [2, 3, 4], '12': [2, 3, 4] });
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': [3, 4], '12': [3, 4] });
    add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
    add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SMNT', 'Mantık', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
    _addLiseCommonElectives(add, { isGsl: true });

  /* ---------------- 10. SPOR LİSESİ & TEMATİK SPOR LİSESİ (TTKB 102 & 103) ---------------- */
  } else if (schoolTypeId === 'spor_lisesi' || schoolTypeId === 'tematik_spor_lisesi') {
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
    add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { '9': 3, '10': 3, '11': 4, '12': 4 });
    add('GMZ', 'Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
    add('TSE_S', 'Temel Spor Eğitimi', 'zorunlu', 'Ortak', { '9': 2 }, { roomType: 'spor_salonu' });
    add('SAF', 'Spor Anatomisi ve Fizyolojisi', 'zorunlu', 'Ortak', { '11': 2 });
    add('ANTB', 'Antrenman Bilgisi', 'zorunlu', 'Ortak', { '12': 2 });
    add('ANTE', 'Antrenörlük Eğitimi', 'zorunlu', 'Ortak', { '12': 1 });
    add('SPS', 'Sporcu Sağlığı', 'zorunlu', 'Ortak', { '11': 2 });
    add('SYO', 'Spor Yönetimi ve Organizasyonu', 'zorunlu', 'Ortak', { '12': 2 });
    add('SPSO', 'Spor Psikolojisi ve Sosyolojisi', 'zorunlu', 'Ortak', { '12': 2 });
    add('SPB', 'Spor ve Beslenme', 'zorunlu', 'Ortak', { '9': 1 });
    add('EGO', 'Eğitsel Oyunlar', 'zorunlu', 'Ortak', { '11': 2 }, { roomType: 'spor_salonu' });
    add('GJIM', 'Genel Jimnastik', 'zorunlu', 'Ortak', { '9': 2 }, { roomType: 'spor_salonu' });
    add('REHD', 'Ritim Eğitimi ve Halk Dansları', 'zorunlu', 'Ortak', { '11': 3 }, { roomType: 'spor_salonu' });
    add('ATL', 'Atletizm', 'zorunlu', 'Ortak', { '11': 2, '12': 2 }, { roomType: 'spor_salonu' });
    if (schoolTypeId === 'tematik_spor_lisesi') {
      add('TSBS', 'Takım Sporları / Bireysel Sporlar', 'zorunlu', 'Ortak', { '9': 4, '10': 8, '11': 8, '12': 8 }, { roomType: 'spor_salonu' });
    } else {
      add('TKSP', 'Takım Sporları', 'zorunlu', 'Ortak', { '9': 4, '10': 4, '11': 4, '12': 4 }, { roomType: 'spor_salonu' });
      add('BRSP', 'Bireysel Sporlar', 'zorunlu', 'Ortak', { '10': 4, '11': 4, '12': 4 }, { roomType: 'spor_salonu' });
    }
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { '9': 1, '10': 1, '11': 1, '12': 1 });

    // Spor Lisesi Akademik Seçmeliler
    const gA = 'Akademik Çalışmalar';
    add('SMAT', 'Seçmeli Matematik', 'secmeli', gA, { '11': 2, '12': [2, 3, 4] });
    add('TMAT', 'Temel Matematik', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SFIZ', 'Seçmeli Fizik', 'secmeli', gA, { '11': 2, '12': [2, 3, 4] });
    add('SKIM', 'Seçmeli Kimya', 'secmeli', gA, { '11': 2, '12': [2, 3, 4] });
    add('SBIY', 'Seçmeli Biyoloji', 'secmeli', gA, { '11': 2, '12': [2, 3, 4] });
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': 2, '12': [3, 4] });
    add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': 2, '12': [2, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
    add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': 2, '12': [2, 4] });
    add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SMNT', 'Mantık', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': 2, '12': [2, 4] });
    add('AJIM', 'Artistik Jimnastik', 'secmeli', gA, { '11': 2, '12': 2 }, { roomType: 'spor_salonu' });
    add('MSBA', 'Müsabaka Analizi', 'secmeli', gA, { '11': 1, '12': 1 });
    if (schoolTypeId === 'tematik_spor_lisesi') {
      add('SPBH', 'Spor Basını ve Hukuku', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] });
      add('AGPF', 'Atletik Gelişim ve Performans', 'secmeli', gA, { '11': [1, 2], '12': [1, 2] }, { roomType: 'spor_salonu' });
    }
    add('BEST_T', 'Beden Eğitimi ve Spor Tarihi', 'secmeli', gA, { '12': 2 });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
    _addLiseCommonElectives(add, { isSpor: true });

  /* ---------------- 11. ÖZEL PROGRAM UYGULAYAN ANADOLU LİSESİ (TTKB 02/09/2026 - 104) ---------------- */
  } else if (schoolTypeId === 'ozel_anadolu') {
    add('HTDE', 'Hazırlık Sınıfı Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { 'H': 3 });
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { 'H': 3, '9': 6, '10': 6, '11': 6, '12': 6 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 20, '9': 4, '10': 4, '11': 4, '12': 4 }, { maxPerDay: 2 });
    add('YD2', 'İkinci Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 4 });
    add('DSN_O', 'Düşünme Eğitimi', 'zorunlu', 'Ortak', { 'H': 2 });
    add('VBG', 'Veri Bilimine Giriş', 'zorunlu', 'Ortak', { 'H': 2 }, { roomType: 'bilisim_lab' });
    add('BV', 'Büyük Veri', 'zorunlu', 'Ortak', { '9': 2 }, { roomType: 'bilisim_lab' });
    add('PGA', 'Programlamaya Giriş ve Algoritma + Programlama Dilleri', 'zorunlu', 'Ortak', { 'H': 4 }, { roomType: 'bilisim_lab' });
    add('AOY', 'Akademik Okuma ve Yazma', 'zorunlu', 'Ortak', { '10': 2 });
    add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 2, '11': 2, '12': 2 });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1, '10': 1, '11': 1, '12': 1 });

    // Tematik Alan: Temel Bilimler
    const gTB = 'Tematik Alan · Temel Bilimler';
    add('TUMB', 'Tümleşik Bilimler', 'secmeli', gTB, { 'H': 4, '9': 2 });
    add('YDAC', 'Yabancı Dilde Akademik Çalışmalar', 'secmeli', gTB, { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('FIZL', 'Fizik Laboratuvarı', 'secmeli', gTB, { '9': 2, '10': 2 }, { roomType: 'fen_lab' });
    add('KIML', 'Kimya Laboratuvarı', 'secmeli', gTB, { '9': 2, '10': 2 }, { roomType: 'fen_lab' });
    add('BIYL', 'Biyoloji Laboratuvarı', 'secmeli', gTB, { '9': 2, '10': 2 }, { roomType: 'fen_lab' });
    add('FBU_T', 'Fen Bilimleri Uygulamaları', 'secmeli', gTB, { '10': 2, '11': 2, '12': 2 });
    add('MTU_T', 'Matematik Uygulamaları', 'secmeli', gTB, { '10': 2, '11': 2, '12': 2 });
    add('FMAT', 'Finansal Matematik', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('VERA', 'Veri Analizi', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('ISTA', 'İstatistik', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('OPTM', 'Optimizasyon', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('BIYT', 'Biyoteknoloji', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('MOLB', 'Moleküler Biyoloji', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('TIP_T', 'Tıp Bilimine Giriş', 'secmeli', gTB, { '12': 2 });
    add('IMAT', 'İleri Matematik', 'secmeli', gTB, { '12': 2 });
    add('GEN_T', 'Genetik Bilimine Giriş', 'secmeli', gTB, { '12': 2 });

    // Tematik Alan: Sosyal Bilimler
    const gSB = 'Tematik Alan · Sosyal Bilimler';
    add('SBC_T', 'Sosyal Bilim Çalışmaları', 'secmeli', gSB, { 'H': 4, '9': 2 });
    add('EDU_T', 'Edebiyat Uygulamaları', 'secmeli', gSB, { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('EKO_T', 'Ekonominin Temel Kavramları', 'secmeli', gSB, { '10': 2, '11': 2, '12': 2 });
    add('MED_T', 'Medya ve İletişim', 'secmeli', gSB, { '10': 2, '11': 2, '12': 2 });
    add('YRYZ', 'Yaratıcı Yazarlık Çalışmaları', 'secmeli', gSB, { '10': 2, '11': 2, '12': 2 });
    add('MGUJ', 'Millî Güç Unsurları ve Jeopolitik', 'secmeli', gSB, { '10': 2, '11': 2, '12': 2 });
    add('TDEM', 'Türk Demokrasi Tarihi', 'secmeli', gSB, { '10': 2, '11': 2, '12': 2 });
    add('SYSO', 'Siyaset Sosyolojisi', 'secmeli', gSB, { '11': 2, '12': 2 });

    // Çok Yönlü Gelişim · Akademik
    const gA = 'Akademik Çalışmalar';
    add('SFIZ', 'Seçmeli Fizik', 'secmeli', gA, { '11': 4, '12': 4 });
    add('SKIM', 'Seçmeli Kimya', 'secmeli', gA, { '11': 4, '12': 4 });
    add('SBIY', 'Seçmeli Biyoloji', 'secmeli', gA, { '11': 4, '12': 4 });
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': [3, 5], '12': [3, 5] });
    add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
    add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SMNT', 'Mantık', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': [2, 10, 12], '12': [2, 10, 12] });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
    _addLiseCommonElectives(add, { skipFenMatUyg: true, skipSbc: true });

  /* ---------------- 12. ÖZEL PROGRAM UYGULAYAN FEN LİSESİ (TTKB 23/07/2025 - 24) ---------------- */
  } else if (schoolTypeId === 'ozel_fen') {
    add('HTDE', 'Hazırlık Sınıfı Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { 'H': 3 });
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '12': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
    add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 20, '9': 4, '10': 4, '11': 4, '12': 4 }, { maxPerDay: 2 });
    add('HMAT', 'Hazırlık Sınıfı Matematik', 'zorunlu', 'Ortak', { 'H': 3 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 6, '10': 6, '11': 6, '12': 6 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 4, '12': 4 });
    add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 2, '11': 2 });
    add('VBG', 'Veri Bilimine Giriş', 'zorunlu', 'Ortak', { 'H': 2 }, { roomType: 'bilisim_lab' });
    add('BV', 'Büyük Veri', 'zorunlu', 'Ortak', { '9': 2 }, { roomType: 'bilisim_lab' });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
    add('PRJ_O', 'Proje Tasarımı ve Uygulamaları', 'zorunlu', 'Ortak', { '10': 2 });
    add('FAOY', 'Fen Bilimlerinde Akademik Okuma ve Yazma', 'zorunlu', 'Ortak', { '11': 2 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '9': 1, '12': 1 });

    // Ortak Tematik & Alan Dersleri
    const gOT = 'Tematik Alan · Ortak';
    add('PGA', 'Programlamaya Giriş ve Algoritma + Programlama Dilleri', 'secmeli', gOT, { 'H': 4 }, { roomType: 'bilisim_lab' });
    add('TEE', 'Temel Elektrik-Elektronik', 'secmeli', gOT, { 'H': 2 });
    add('TUMB', 'Tümleşik Bilimler', 'secmeli', gOT, { 'H': 2 });

    const gBTY = 'Tematik Alan · Bilişim ve Yazılım';
    add('SYE', 'Sayısal Elektronik', 'secmeli', gBTY, { 'H': 2 }, { roomType: 'bilisim_lab' });
    add('BDS', 'Bilgisayarlı Devre Simülasyonu ve Baskı Devre Tasarımı', 'secmeli', gBTY, { '9': 2 }, { roomType: 'bilisim_lab' });
    add('MIK', 'Mikrodenetleyiciler ve Uygulamaları', 'secmeli', gBTY, { '9': 3 }, { roomType: 'bilisim_lab' });
    add('NTP', 'Nesne Tabanlı Programlama', 'secmeli', gBTY, { '9': 3 }, { roomType: 'bilisim_lab' });
    add('VBIL', 'Veri Bilimi', 'secmeli', gBTY, { '10': 3 }, { roomType: 'bilisim_lab' });
    add('ROBU', 'Robotik Uygulamaları', 'secmeli', gBTY, { '10': 3 }, { roomType: 'bilisim_lab' });
    add('AGIOT', 'Ağ Teknolojileri ve Nesnelerin İnterneti', 'secmeli', gBTY, { '10': 2 }, { roomType: 'bilisim_lab' });
    add('YZMO', 'Yapay Zekâ ve Makine Öğrenmesi', 'secmeli', gBTY, { '11': 2, '12': 2 }, { roomType: 'bilisim_lab' });
    add('BMIS', 'Bilgisayar Mimarisi ve İşletim Sistemleri', 'secmeli', gBTY, { '11': 2, '12': 2 }, { roomType: 'bilisim_lab' });
    add('SIBK', 'Siber Güvenlik ve Kriptoloji', 'secmeli', gBTY, { '11': 2, '12': 2 }, { roomType: 'bilisim_lab' });
    add('YAZU', 'Yazılım Uygulamaları', 'secmeli', gBTY, { '12': 2 }, { roomType: 'bilisim_lab' });

    const gHAV = 'Tematik Alan · Havacılık ve Uzay';
    add('HUT', 'Havacılık ve Uzayın Temelleri', 'secmeli', gHAV, { 'H': 2 });
    add('MEKT', 'Mekaniğin Temelleri', 'secmeli', gHAV, { '9': 3 });
    add('METE', 'Meteoroloji', 'secmeli', gHAV, { '9': 2 });
    add('CAD', 'Bilgisayar Destekli Tasarım ve Modelleme', 'secmeli', gHAV, { '10': 3 }, { roomType: 'bilisim_lab' });
    add('HSIS', 'Havacılık Sistemleri', 'secmeli', gHAV, { '10': 2, '11': 2 });
    add('UZAY', 'Uzay Teknolojileri', 'secmeli', gHAV, { '11': 2, '12': 2 });

    const gTB = 'Tematik Alan · Temel Bilimler';
    add('FIZL', 'Fizik Laboratuvarı', 'secmeli', gTB, { '9': [2, 3], '10': [2, 3] }, { roomType: 'fen_lab' });
    add('KIML', 'Kimya Laboratuvarı', 'secmeli', gTB, { '9': [2, 3], '10': [2, 3] }, { roomType: 'fen_lab' });
    add('BIYL', 'Biyoloji Laboratuvarı', 'secmeli', gTB, { '9': [2, 3], '10': [2, 3] }, { roomType: 'fen_lab' });
    add('TBBU', 'Temel Bilimlerde Bilişim Uygulamaları', 'secmeli', gTB, { '9': [2, 3], '10': [2, 3], '11': 2, '12': 2 }, { roomType: 'bilisim_lab' });
    add('BIYK', 'Biyokimya', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('MOLB', 'Moleküler Biyoloji', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('IMAT', 'İleri Matematik', 'secmeli', gTB, { '11': 2, '12': 2 });
    add('GEN_T', 'Genetik Bilimine Giriş', 'secmeli', gTB, { '12': 2 });

    // Çok Yönlü Gelişim
    const gA = 'Akademik Çalışmalar';
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': 1, '12': [3, 4] });
    add('STAR', 'Seçmeli Tarih', 'secmeli', gA, { '11': 1, '12': [2, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
    add('SCOG', 'Seçmeli Coğrafya', 'secmeli', gA, { '11': 1, '12': [2, 4] });
    add('SPSK', 'Psikoloji', 'secmeli', gA, { '11': 1, '12': 2 });
    add('SSYJ', 'Sosyoloji', 'secmeli', gA, { '11': 1, '12': 2 });
    add('SMNT', 'Mantık', 'secmeli', gA, { '11': 1, '12': 2 });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': 1, '12': [2, 3, 4] });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
    _addLiseCommonElectives(add, { hasPrepElectives: true });

  /* ---------------- 13. ÖZEL PROGRAM UYGULAYAN SOSYAL BİLİMLER LİSESİ (TTKB 23/07/2025 - 25) ---------------- */
  } else if (schoolTypeId === 'ozel_sosyal') {
    add('HTDE', 'Hazırlık Sınıfı Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { 'H': 3 });
    add('TDE', 'Türk Dili ve Edebiyatı', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('DKB', 'Din Kültürü ve Ahlak Bilgisi', 'zorunlu', 'Ortak', { '9': 2, '10': 2, '11': 2, '12': 2 });
    add('TAR', 'Tarih', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 2 });
    add('INK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'zorunlu', 'Ortak', { '11': 2 });
    add('COG', 'Coğrafya', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 2, '11': 2 });
    add('HMAT', 'Hazırlık Sınıfı Matematik', 'zorunlu', 'Ortak', { 'H': 3 });
    add('MAT', 'Matematik', 'zorunlu', 'Ortak', { '9': 5, '10': 5, '11': 5, '12': 5 });
    add('FIZ', 'Fizik', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('KIM', 'Kimya', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('BIY', 'Biyoloji', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('DSN_O', 'Düşünme Eğitimi', 'zorunlu', 'Ortak', { 'H': 2 });
    add('FEL', 'Felsefe', 'zorunlu', 'Ortak', { '9': 2, '10': 2 });
    add('SYJ', 'Sosyoloji', 'zorunlu', 'Ortak', { '10': 2, '11': 2 });
    add('PSK', 'Psikoloji', 'zorunlu', 'Ortak', { '11': 2 });
    add('YD1', 'Birinci Yabancı Dil', 'zorunlu', 'Ortak', { 'H': 18, '9': 4, '10': 4, '11': 4, '12': 4 }, { maxPerDay: 2 });
    add('BGS', 'Beden Eğitimi ve Spor / Görsel Sanatlar / Müzik', 'zorunlu', 'Ortak', { 'H': 2, '9': 2, '10': 2, '11': 2, '12': 2 });
    add('OSM', 'Osmanlı Türkçesi', 'zorunlu', 'Ortak', { 'H': 2, '9': 2 });
    add('SGT', 'Sağlık Bilgisi ve Trafik Kültürü', 'zorunlu', 'Ortak', { '9': 1 });
    add('VBG', 'Veri Bilimine Giriş', 'zorunlu', 'Ortak', { 'H': 2 }, { roomType: 'bilisim_lab' });
    add('BV', 'Büyük Veri', 'zorunlu', 'Ortak', { '9': 2 }, { roomType: 'bilisim_lab' });
    add('PRJ_O', 'Proje Tasarımı ve Uygulamaları', 'zorunlu', 'Ortak', { 'H': 2 });
    add('SBAOY', 'Sosyal Bilimlerde Akademik Okuma ve Yazma', 'zorunlu', 'Ortak', { '11': 2 });
    add('REH', 'Rehberlik ve Yönlendirme', 'zorunlu', 'Ortak', { 'H': 1, '10': 1, '11': 1, '12': 1 });

    // Ortak Tematik
    const gOT = 'Tematik Alan · Ortak';
    add('MITK', 'Medya ve İletişimin Temel Kavramları', 'secmeli', gOT, { 'H': 2 });
    add('SBTK', 'Siyaset Biliminin Temel Kavramları', 'secmeli', gOT, { 'H': 2 });
    add('EKTK', 'Ekonominin Temel Kavramları', 'secmeli', gOT, { 'H': 2 });

    // 5 Tematik Alan (Öne çıkan dersler)
    const gMI = 'Tematik · Medya ve İletişim';
    add('ILBG', 'İletişim Bilimine Giriş', 'secmeli', gMI, { '9': 2 });
    add('YMED', 'Yeni Medya', 'secmeli', gMI, { '10': [2, 3], '11': [2, 3] });
    add('GIT', 'Görsel İletişim Tasarımı', 'secmeli', gMI, { '11': [2, 3], '12': [2, 3] });
    const gSU = 'Tematik · Siyaset ve Uluslararası İlişkiler';
    add('HUKG', 'Hukuka Giriş', 'secmeli', gSU, { '9': 2 });
    add('ULIG', 'Uluslararası İlişkilere Giriş', 'secmeli', gSU, { '9': 2 });
    add('TDISP', 'Türk Dış Politikası', 'secmeli', gSU, { '11': [2, 3], '12': [2, 3] });
    add('ULHUK', 'Uluslararası Hukuk', 'secmeli', gSU, { '11': [2, 3], '12': [2, 3] });
    const gIK = 'Tematik · İktisat ve İşletme';
    add('IKTG', 'İktisada Giriş', 'secmeli', gIK, { '9': 2 });
    add('GENI', 'Genel İşletme', 'secmeli', gIK, { '9': 2 });
    add('FINY', 'Finansal Yönetim', 'secmeli', gIK, { '12': [2, 3] });
    const gET = 'Tematik · Edebiyat, Tarih ve Kültür';
    add('DILB', 'Dil Bilimi', 'secmeli', gET, { '9': 2 });
    add('MEDT', 'Medeniyet Tarihi', 'secmeli', gET, { '9': 2 });
    add('KARS', 'Karşılaştırmalı Edebiyat', 'secmeli', gET, { '12': [2, 3] });
    const gYD = 'Tematik · Yabancı Diller';
    add('YD2_T', 'İkinci Yabancı Dil', 'secmeli', gYD, { '9': [2, 3, 4], '10': [2, 3, 4], '11': [2, 3, 4], '12': [2, 3, 4] });
    add('YD3_T', 'Üçüncü Yabancı Dil', 'secmeli', gYD, { '9': [2, 3, 4], '10': [2, 3, 4], '11': [2, 3, 4], '12': [2, 3, 4] });
    add('CEVU', 'Çeviri Uygulamaları', 'secmeli', gYD, { '9': [2, 3], '10': [2, 3], '11': [2, 3], '12': [2, 3] });

    // Çok Yönlü Gelişim
    const gA = 'Akademik Çalışmalar';
    add('STDE', 'Seçmeli Türk Dili ve Edebiyatı', 'secmeli', gA, { '11': [2, 4], '12': [3, 4] });
    add('SCTD', 'Çağdaş Türk ve Dünya Tarihi', 'secmeli', gA, { '12': 2 });
    add('SMNT', 'Mantık', 'secmeli', gA, { '11': 2, '12': 2 });
    add('SYD1', 'Seçmeli Birinci Yabancı Dil', 'secmeli', gA, { '11': [2, 4], '12': [2, 4] });
    add('HTD', 'Hedef Temelli Destek Eğitimi', 'secmeli', gA, { '12': [3, 4, 5, 6] });
    _addLiseCommonElectives(add, { sbl: true, skipAstro: true });
  }

  return list;
}

window.MEB_SCHOOL_GROUPS = MEB_SCHOOL_GROUPS;
window.MEB_SCHOOL_TYPES = MEB_SCHOOL_TYPES;
window.MEB_BRANCHES_BY_SCHOOL_TYPE = MEB_BRANCHES_BY_SCHOOL_TYPE;
window.getMebTemplatesForGrade = getMebTemplatesForGrade;
