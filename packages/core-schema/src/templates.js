import { TEMPLATE_VERSION, SchoolTypes } from './constants.js';

/**
 * Sürümlü, düzenlenebilir okul türü ders çizelgesi şablonları.
 * ÖNEMLİ: Resmî olarak doğrulanmamış hiçbir şablon `officialApproved: true` olarak işaretlenmez.
 * Kullanıcı ve okul idaresi eğitim-öğretim yılına göre şablonu güncelleyebilir.
 */
export const CURRICULUM_TEMPLATES = Object.freeze({
  version: TEMPLATE_VERSION,
  academicYear: '2026-2027',
  disclaimer: 'Bu şablonlar düzenlenebilir başlangıç taslaklarıdır; resmî MEB onayı yerine geçmez. Kullanmadan önce güncel TTKB kararlarıyla doğrulayınız.',
  templates: {
    ilkokul: {
      schoolTypeId: 'ilkokul',
      name: 'İlkokul Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [1, 2, 3, 4],
      defaultPeriodsPerDay: 6,
      weeklyTotals: { 1: 30, 2: 30, 3: 30, 4: 30 },
      electiveLimits: { 1: 0, 2: 0, 3: 0, 4: 0 },
      mandatory: [
        { name: 'Türkçe', short: 'TRK', branch: 'Sınıf Öğretmenliği', hours: { 1: 10, 2: 10, 3: 8, 4: 8 } },
        { name: 'Matematik', short: 'MAT', branch: 'Sınıf Öğretmenliği', hours: { 1: 5, 2: 5, 3: 5, 4: 5 } },
        { name: 'Hayat Bilgisi', short: 'HB', branch: 'Sınıf Öğretmenliği', hours: { 1: 4, 2: 4, 3: 3, 4: 0 } },
        { name: 'Fen Bilimleri', short: 'FEN', branch: 'Sınıf Öğretmenliği', hours: { 1: 0, 2: 0, 3: 3, 4: 3 } },
        { name: 'Sosyal Bilgiler', short: 'SOS', branch: 'Sınıf Öğretmenliği', hours: { 1: 0, 2: 0, 3: 0, 4: 3 } },
        { name: 'Yabancı Dil', short: 'YD', branch: 'İngilizce', hours: { 1: 0, 2: 2, 3: 2, 4: 2 } },
        { name: 'Din Kültürü ve Ahlak Bilgisi', short: 'DKAB', branch: 'Din Kültürü', hours: { 1: 0, 2: 0, 3: 0, 4: 2 } },
        { name: 'Görsel Sanatlar', short: 'GRS', branch: 'Sınıf Öğretmenliği', hours: { 1: 1, 2: 1, 3: 1, 4: 1 } },
        { name: 'Müzik', short: 'MZK', branch: 'Sınıf Öğretmenliği', hours: { 1: 1, 2: 1, 3: 1, 4: 1 } },
        { name: 'Beden Eğitimi ve Oyun', short: 'BEO', branch: 'Sınıf Öğretmenliği', hours: { 1: 5, 2: 5, 3: 5, 4: 2 } },
        { name: 'Trafik Güvenliği', short: 'TRF', branch: 'Sınıf Öğretmenliği', hours: { 1: 0, 2: 0, 3: 0, 4: 1 } },
        { name: 'İnsan Hakları, Vatandaşlık ve Demokrasi', short: 'İHV', branch: 'Sınıf Öğretmenliği', hours: { 1: 0, 2: 0, 3: 0, 4: 2 } },
        { name: 'Serbest Etkinlikler', short: 'SE', branch: 'Sınıf Öğretmenliği', hours: { 1: 4, 2: 2, 3: 2, 4: 0 } }
      ],
      electivePool: []
    },
    ortaokul: {
      schoolTypeId: 'ortaokul',
      name: 'Ortaokul Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [5, 6, 7, 8],
      defaultPeriodsPerDay: 7,
      weeklyTotals: { 5: 35, 6: 35, 7: 35, 8: 35 },
      electiveLimits: { 5: 5, 6: 5, 7: 5, 8: 6 },
      mandatory: [
        { name: 'Türkçe', short: 'TRK', branch: 'Türkçe', hours: { 5: 6, 6: 6, 7: 5, 8: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 5: 5, 6: 5, 7: 5, 8: 5 } },
        { name: 'Fen Bilimleri', short: 'FEN', branch: 'Fen Bilimleri', hours: { 5: 4, 6: 4, 7: 4, 8: 4 }, requiredRoomType: 'lab_science' },
        { name: 'Sosyal Bilgiler', short: 'SOS', branch: 'Sosyal Bilgiler', hours: { 5: 3, 6: 3, 7: 3, 8: 0 } },
        { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', short: 'İNK', branch: 'Sosyal Bilgiler', hours: { 5: 0, 6: 0, 7: 0, 8: 2 } },
        { name: 'Yabancı Dil', short: 'YD', branch: 'İngilizce', hours: { 5: 3, 6: 3, 7: 4, 8: 4 } },
        { name: 'Din Kültürü ve Ahlak Bilgisi', short: 'DKAB', branch: 'Din Kültürü', hours: { 5: 2, 6: 2, 7: 2, 8: 2 } },
        { name: 'Görsel Sanatlar', short: 'GRS', branch: 'Görsel Sanatlar', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } },
        { name: 'Müzik', short: 'MZK', branch: 'Müzik', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } },
        { name: 'Beden Eğitimi ve Spor', short: 'BES', branch: 'Beden Eğitimi', hours: { 5: 2, 6: 2, 7: 2, 8: 2 }, requiredRoomType: 'gym' },
        { name: 'Teknoloji ve Tasarım', short: 'TT', branch: 'Teknoloji Tasarım', hours: { 5: 0, 6: 0, 7: 2, 8: 2 } },
        { name: 'Bilişim Teknolojileri ve Yazılım', short: 'BTY', branch: 'Bilişim', hours: { 5: 2, 6: 2, 7: 0, 8: 0 }, requiredRoomType: 'lab_computer' },
        { name: 'Rehberlik ve Yönlendirme', short: 'REH', branch: 'Sınıf rehber öğretmeni', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } }
      ],
      electivePool: [
        { name: 'Matematik ve Bilim Uygulamaları', group: 'ITB', options: { 6: [2], 7: [2] } },
        { name: 'Yabancı Dil (seçmeli)', group: 'ITB', options: { 5: [2], 6: [2], 7: [2], 8: [2] } },
        { name: 'Robotik Kodlama', group: 'ITB', options: { 5: [2], 6: [2] } },
        { name: "Kur'an-ı Kerim", group: 'DAD', options: { 5: [2], 6: [2], 7: [2], 8: [2] } },
        { name: 'Peygamberimizin Hayatı', group: 'DAD', options: { 5: [2], 6: [2], 7: [2], 8: [2] } },
        { name: 'Spor ve Fiziki Etkinlikler', group: 'KSS', options: { 5: [2], 6: [2], 7: [2], 8: [2] } }
      ]
    },
    imam_hatip_ortaokulu: {
      schoolTypeId: 'imam_hatip_ortaokulu',
      name: 'İmam Hatip Ortaokulu Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [5, 6, 7, 8],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 5: 36, 6: 36, 7: 36, 8: 36 },
      electiveLimits: { 5: 1, 6: 1, 7: 1, 8: 2 },
      mandatory: [
        { name: 'Türkçe', short: 'TRK', branch: 'Türkçe', hours: { 5: 6, 6: 6, 7: 5, 8: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 5: 5, 6: 5, 7: 5, 8: 5 } },
        { name: 'Fen Bilimleri', short: 'FEN', branch: 'Fen Bilimleri', hours: { 5: 4, 6: 4, 7: 4, 8: 4 } },
        { name: 'Sosyal Bilgiler', short: 'SOS', branch: 'Sosyal Bilgiler', hours: { 5: 3, 6: 3, 7: 3, 8: 0 } },
        { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', short: 'İNK', branch: 'Sosyal Bilgiler', hours: { 5: 0, 6: 0, 7: 0, 8: 2 } },
        { name: 'Yabancı Dil', short: 'YD', branch: 'İngilizce', hours: { 5: 3, 6: 3, 7: 4, 8: 4 } },
        { name: 'Din Kültürü ve Ahlak Bilgisi', short: 'DKAB', branch: 'Din Kültürü', hours: { 5: 2, 6: 2, 7: 2, 8: 2 } },
        { name: "Kur'an-ı Kerim", short: 'KUR', branch: 'Din Kültürü', hours: { 5: 2, 6: 2, 7: 2, 8: 2 } },
        { name: 'Arapça', short: 'ARP', branch: 'Arapça', hours: { 5: 2, 6: 2, 7: 2, 8: 2 } },
        { name: 'Peygamberimizin Hayatı', short: 'PH', branch: 'Din Kültürü', hours: { 5: 2, 6: 2, 7: 2, 8: 2 } },
        { name: 'Temel Dinî Bilgiler', short: 'TDB', branch: 'Din Kültürü', hours: { 5: 0, 6: 1, 7: 1, 8: 0 } },
        { name: 'Beden Eğitimi ve Spor', short: 'BES', branch: 'Beden Eğitimi', hours: { 5: 2, 6: 1, 7: 1, 8: 1 } },
        { name: 'Görsel Sanatlar', short: 'GRS', branch: 'Görsel Sanatlar', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } },
        { name: 'Müzik', short: 'MZK', branch: 'Müzik', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } },
        { name: 'Teknoloji ve Tasarım', short: 'TT', branch: 'Teknoloji Tasarım', hours: { 5: 0, 6: 0, 7: 1, 8: 2 } },
        { name: 'Bilişim Teknolojileri ve Yazılım', short: 'BTY', branch: 'Bilişim', hours: { 5: 1, 6: 1, 7: 0, 8: 0 } },
        { name: 'Rehberlik ve Yönlendirme', short: 'REH', branch: 'Sınıf rehber öğretmeni', hours: { 5: 1, 6: 1, 7: 1, 8: 1 } }
      ],
      electivePool: []
    },
    anadolu_lisesi: {
      schoolTypeId: 'anadolu_lisesi',
      name: 'Anadolu Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: { 9: 7, 10: 6, 11: 20, 12: 24 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Din Kültürü ve Ahlak Bilgisi', short: 'DKAB', branch: 'Din Kültürü', hours: { 9: 2, 10: 2, 11: 2, 12: 2 } },
        { name: 'Tarih', short: 'TAR', branch: 'Tarih', hours: { 9: 2, 10: 2, 11: 2, 12: 0 } },
        { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', short: 'İNK', branch: 'Tarih', hours: { 9: 0, 10: 0, 11: 0, 12: 2 } },
        { name: 'Coğrafya', short: 'COĞ', branch: 'Coğrafya', hours: { 9: 2, 10: 2, 11: 0, 12: 0 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 6, 10: 6, 11: 0, 12: 0 } },
        { name: 'Fizik', short: 'FİZ', branch: 'Fizik', hours: { 9: 2, 10: 2, 11: 0, 12: 0 }, requiredRoomType: 'lab_physics' },
        { name: 'Kimya', short: 'KİM', branch: 'Kimya', hours: { 9: 2, 10: 2, 11: 0, 12: 0 }, requiredRoomType: 'lab_chemistry' },
        { name: 'Biyoloji', short: 'BİY', branch: 'Biyoloji', hours: { 9: 2, 10: 2, 11: 0, 12: 0 }, requiredRoomType: 'lab_biology' },
        { name: 'Felsefe', short: 'FEL', branch: 'Felsefe', hours: { 9: 0, 10: 2, 11: 2, 12: 0 } },
        { name: 'Birinci Yabancı Dil', short: 'YD1', branch: 'İngilizce', hours: { 9: 4, 10: 4, 11: 4, 12: 4 } },
        { name: 'Beden Eğitimi ve Spor', short: 'BES', branch: 'Beden Eğitimi', hours: { 9: 2, 10: 2, 11: 2, 12: 0 }, requiredRoomType: 'gym' },
        { name: 'Görsel Sanatlar/Müzik', short: 'GS/M', branch: 'Görsel Sanatlar', hours: { 9: 2, 10: 2, 11: 2, 12: 0 } },
        { name: 'Sağlık Bilgisi ve Trafik Kültürü', short: 'SBT', branch: 'Biyoloji', hours: { 9: 1, 10: 0, 11: 0, 12: 0 } },
        { name: 'Rehberlik ve Yönlendirme', short: 'REH', branch: 'Sınıf rehber öğretmeni', hours: { 9: 1, 10: 1, 11: 1, 12: 1 } }
      ],
      electivePool: [
        { name: 'Seçmeli Matematik', group: 'AKD', options: { 11: [6], 12: [6] } },
        { name: 'Seçmeli Fizik', group: 'AKD', options: { 11: [4], 12: [4] } },
        { name: 'Seçmeli Kimya', group: 'AKD', options: { 11: [4], 12: [4] } },
        { name: 'Seçmeli Biyoloji', group: 'AKD', options: { 11: [4], 12: [4] } }
      ]
    },
    fen_lisesi: {
      schoolTypeId: 'fen_lisesi',
      name: 'Fen Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: { 9: 5, 10: 4, 11: 4, 12: 8 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 6, 10: 6, 11: 6, 12: 6 } },
        { name: 'Fizik', short: 'FİZ', branch: 'Fizik', hours: { 9: 2, 10: 2, 11: 4, 12: 4 }, requiredRoomType: 'lab_physics' },
        { name: 'Kimya', short: 'KİM', branch: 'Kimya', hours: { 9: 2, 10: 2, 11: 4, 12: 4 }, requiredRoomType: 'lab_chemistry' },
        { name: 'Biyoloji', short: 'BİY', branch: 'Biyoloji', hours: { 9: 2, 10: 2, 11: 4, 12: 4 }, requiredRoomType: 'lab_biology' },
        { name: 'Birinci Yabancı Dil', short: 'YD1', branch: 'İngilizce', hours: { 9: 4, 10: 4, 11: 4, 12: 4 } },
        { name: 'Bilişim Teknolojileri ve Yazılım', short: 'BTY', branch: 'Bilişim', hours: { 9: 2, 10: 2, 11: 0, 12: 0 }, requiredRoomType: 'lab_computer' },
        { name: 'Din Kültürü ve Ahlak Bilgisi', short: 'DKAB', branch: 'Din Kültürü', hours: { 9: 2, 10: 2, 11: 2, 12: 2 } },
        { name: 'Tarih', short: 'TAR', branch: 'Tarih', hours: { 9: 2, 10: 2, 11: 2, 12: 0 } },
        { name: 'Coğrafya', short: 'COĞ', branch: 'Coğrafya', hours: { 9: 2, 10: 2, 11: 0, 12: 0 } },
        { name: 'Felsefe', short: 'FEL', branch: 'Felsefe', hours: { 9: 0, 10: 2, 11: 2, 12: 0 } },
        { name: 'Rehberlik ve Yönlendirme', short: 'REH', branch: 'Sınıf rehber öğretmeni', hours: { 9: 1, 10: 1, 11: 1, 12: 1 } }
      ],
      electivePool: []
    },
    sosyal_bilimler_lisesi: {
      schoolTypeId: 'sosyal_bilimler_lisesi',
      name: 'Sosyal Bilimler Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: { 9: 7, 10: 4, 11: 3, 12: 8 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 6, 10: 6, 11: 6, 12: 6 } },
        { name: 'Tarih', short: 'TAR', branch: 'Tarih', hours: { 9: 2, 10: 2, 11: 2, 12: 0 } },
        { name: 'Coğrafya', short: 'COĞ', branch: 'Coğrafya', hours: { 9: 2, 10: 2, 11: 4, 12: 4 } },
        { name: 'Osmanlı Türkçesi', short: 'OSM', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 2, 10: 2, 11: 2, 12: 0 } },
        { name: 'Sosyal Bilim Çalışmaları', short: 'SBÇ', branch: 'Tarih', hours: { 9: 0, 10: 2, 11: 2, 12: 2 } },
        { name: 'Rehberlik ve Yönlendirme', short: 'REH', branch: 'Sınıf rehber öğretmeni', hours: { 9: 1, 10: 1, 11: 0, 12: 1 } }
      ],
      electivePool: []
    },
    anadolu_imam_hatip_lisesi: {
      schoolTypeId: 'anadolu_imam_hatip_lisesi',
      name: 'Anadolu İmam Hatip Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: { 9: 0, 10: 0, 11: 16, 12: 21 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 6, 10: 6, 11: 0, 12: 0 } },
        { name: "Kur'an-ı Kerim", short: 'KUR', branch: 'Meslek Dersleri (İHL)', hours: { 9: 5, 10: 4, 11: 4, 12: 3 } },
        { name: 'Arapça', short: 'ARP', branch: 'Arapça', hours: { 9: 4, 10: 3, 11: 0, 12: 0 } },
        { name: 'Mesleki Arapça', short: 'MARP', branch: 'Arapça', hours: { 9: 0, 10: 0, 11: 3, 12: 2 } },
        { name: 'Fıkıh', short: 'FIK', branch: 'Meslek Dersleri (İHL)', hours: { 9: 0, 10: 2, 11: 0, 12: 0 } },
        { name: 'Hadis', short: 'HAD', branch: 'Meslek Dersleri (İHL)', hours: { 9: 0, 10: 2, 11: 0, 12: 0 } },
        { name: 'Tefsir', short: 'TEF', branch: 'Meslek Dersleri (İHL)', hours: { 9: 0, 10: 0, 11: 2, 12: 0 } }
      ],
      electivePool: []
    },
    mesleki_teknik_anadolu_lisesi: {
      schoolTypeId: 'mesleki_teknik_anadolu_lisesi',
      name: 'Mesleki ve Teknik Anadolu Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 9,
      weeklyTotals: { 9: 40, 10: 42, 11: 42, 12: 40 },
      electiveLimits: { 9: 4, 10: 4, 11: 6, 12: 4 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 5, 10: 4, 11: 0, 12: 0 } },
        { name: 'Alan/Dal Atölye Uygulaması', short: 'ATÖ', branch: 'Meslek Dersleri', hours: { 9: 6, 10: 10, 11: 14, 12: 0 }, requiredRoomType: 'workshop' },
        { name: 'İşletmelerde Mesleki Eğitim', short: 'İME', branch: 'Meslek Dersleri', hours: { 9: 0, 10: 0, 11: 0, 12: 24 }, requiredRoomType: 'workshop' }
      ],
      electivePool: []
    },
    cok_programli_anadolu_lisesi: {
      schoolTypeId: 'cok_programli_anadolu_lisesi',
      name: 'Çok Programlı Anadolu Lisesi Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: { 9: 6, 10: 6, 11: 12, 12: 14 },
      mandatory: [
        { name: 'Türk Dili ve Edebiyatı', short: 'TDE', branch: 'Türk Dili ve Edebiyatı', hours: { 9: 5, 10: 5, 11: 5, 12: 5 } },
        { name: 'Matematik', short: 'MAT', branch: 'Matematik', hours: { 9: 6, 10: 6, 11: 0, 12: 0 } },
        { name: 'Program/Alan Dersi', short: 'ALN', branch: 'Diğer', hours: { 9: 4, 10: 6, 11: 10, 12: 10 } }
      ],
      electivePool: []
    },
    ozel_ogretim: {
      schoolTypeId: 'ozel_ogretim',
      name: 'Özel Öğretim Kurumu Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      defaultPeriodsPerDay: 8,
      weeklyTotals: { 5: 40, 6: 40, 7: 40, 8: 40, 9: 40, 10: 40, 11: 40, 12: 40 },
      electiveLimits: {},
      mandatory: [],
      electivePool: []
    },
    ozel_egitim: {
      schoolTypeId: 'ozel_egitim',
      name: 'Özel Eğitim Kurumu Şablonu',
      version: TEMPLATE_VERSION,
      officialApproved: false,
      editable: true,
      grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      defaultPeriodsPerDay: 6,
      weeklyTotals: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 7: 30, 8: 30 },
      electiveLimits: {},
      mandatory: [
        { name: 'Bireyselleştirilmiş Eğitim Uygulaması', short: 'BEP', branch: 'Özel Eğitim', hours: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10 } },
        { name: 'Günlük Yaşam Becerileri', short: 'GYB', branch: 'Özel Eğitim', hours: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6 } }
      ],
      electivePool: []
    }
  }
});

export function getCurriculumTemplate(schoolTypeId) {
  return CURRICULUM_TEMPLATES.templates[schoolTypeId] || null;
}

export function listSchoolTypes() {
  return SchoolTypes.map(t => ({
    ...t,
    hasTemplate: Boolean(CURRICULUM_TEMPLATES.templates[t.id]),
    officialApproved: false
  }));
}
