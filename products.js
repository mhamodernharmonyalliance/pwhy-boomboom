/* ==========================================
   المنتجات — باقات الترقية والموارد
   ========================================== */

import { CONFIG } from './config.js';

// 6 مستويات كحد أقصى — متدرجة احترافيًا
export const LEVELS = {
  1: { price: 50,  maxEnergy: 10, coinMultiplier: 1.0,
       title: { ar: '🌱 البداية',           en: '🌱 The Beginning' },
       desc:  { ar: 'وعد منذ 1919',         en: 'A promise since 1919' } },

  2: { price: 100, maxEnergy: 15, coinMultiplier: 1.5,
       title: { ar: '📈 الاستمرار',          en: '📈 The Continuation' },
       desc:  { ar: 'المرحلة الثانية',       en: 'Phase Two' } },

  3: { price: 125, maxEnergy: 20, coinMultiplier: 2.0,
       title: { ar: '🚀 ليس الأخير',         en: '🚀 Not the Last' },
       desc:  { ar: 'ما زال قريبًا',         en: 'Still coming soon' } },

  4: { price: 150, maxEnergy: 25, coinMultiplier: 2.5,
       title: { ar: '🌐 المرحلة القادمة',    en: '🌐 The Next Phase' },
       desc:  { ar: 'بلا تاريخ محدد',        en: 'No specific date' } },

  5: { price: 175, maxEnergy: 30, coinMultiplier: 3.0,
       title: { ar: '🏛️ الشبكة الرئيسية',    en: '🏛️ The Mainnet' },
       desc:  { ar: 'التوثيق العالمي',       en: 'Global verification' } },

  6: { price: 200, maxEnergy: 40, coinMultiplier: 4.0,
       title: { ar: '👑 314 قريب',           en: '👑 314 Soon' },
       desc:  { ar: 'أقرب من أي وقت مضى',    en: 'Closer than ever' } },
};

// موارد البقاء النفسي
export const RESOURCES = {
  anesthesia: {
    id: 'anesthesia', icon: '💊',
    energyCost: CONFIG.costs.anesthesia,
    title: { ar: 'بنج',    en: 'Anesthesia' },
    desc:  { ar: 'يخفف صدمة الأخبار', en: 'Mutes the shock of news' },
  },
  patience: {
    id: 'patience', icon: '🧘',
    energyCost: CONFIG.costs.patience,
    title: { ar: 'صبر',    en: 'Patience' },
    desc:  { ar: 'تسريع خفيف',      en: 'Slight speedup' },
  },
  conspiracy: {
    id: 'conspiracy', icon: '🕵️',
    energyCost: CONFIG.costs.conspiracy,
    title: { ar: 'نظرية مؤامرة', en: 'Conspiracy Theory' },
    desc:  { ar: 'يسرّع الاستلام',   en: 'Accelerates claim' },
  },
};

export function getProductsList() {
  return Object.entries(LEVELS).map(([lvl, data]) => ({
    id: `level_${lvl}`,
    level: Number(lvl),
    price: data.price,
    type: 'level_upgrade',
    title: data.title,
    desc: data.desc,
  }));
}

export function getLevel(level) { return LEVELS[level] || null; }
export function getResource(id) { return RESOURCES[id] || null; }
