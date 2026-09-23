/* ==========================================
   Products Catalog - PWhy BoomBoom
   ========================================== */

export const PRODUCTS = {
  // --- Boom Packs (حزم النقاط) ---
  'booms_small': {
    price: 15,
    type: 'credits',
    amount: 10000,
    title: {
      en: '💣 10,000 Booms',
      ar: '💣 10,000 نقطة بوم'
    },
    desc: {
      en: 'Get a quick boost of 10k Booms',
      ar: 'احصل على دفعة سريعة من 10 آلاف نقطة'
    }
  },
  'booms_medium': {
    price: 50,
    type: 'credits',
    amount: 50000,
    title: {
      en: '🚀 50,000 Booms',
      ar: '🚀 50,000 نقطة بوم'
    },
    desc: {
      en: 'Save 20% — Boost your rank faster',
      ar: 'وفر 20% — واترتقِ في الترتيب بسرعة'
    }
  },
  'booms_large': {
    price: 150,
    type: 'credits',
    amount: 200000,
    title: {
      en: '💎 200,000 Booms',
      ar: '💎 200,000 نقطة بوم'
    },
    desc: {
      en: 'Best Value! Massive points pack',
      ar: 'القيمة الأفضل! حزمة ضخمة من النقاط'
    }
  },

  // --- Subscriptions & Status (الاشتراكات والتميز) ---
  'vip_pass': {
    price: 100,
    type: 'subscription',
    durationDays: 30,
    title: {
      en: '👑 VIP Pass (30 Days)',
      ar: '👑 اشتراك VIP (30 يوم)'
    },
    desc: {
      en: '2x Tap Multiplier & Unlimited Energy Regen',
      ar: 'مضاعفة النقرات 2x واسترجاع غير محدود للطاقة'
    }
  },

  // --- Boosters & Upgrades (التطويرات الممتازة) ---
  'auto_bot': {
    price: 75,
    type: 'unlock',
    featureId: 'autotap_bot',
    title: {
      en: '🤖 Auto-Tap Bot',
      ar: '🤖 بوت النقر التلقائي'
    },
    desc: {
      en: 'Collects Booms automatically while you are away',
      ar: 'يجمع النقاط تلقائياً أثناء غيابك عن اللعبة'
    }
  },
  'badge_legend': {
    price: 25,
    type: 'cosmetic',
    title: {
      en: '🎖️ Boom Legend Badge',
      ar: '🎖️ شارة أسطورة البوم'
    },
    desc: {
      en: 'Display a golden legendary badge next to your name',
      ar: 'اعرض شارة ذهبية أسطورية بجانب اسمك'
    }
  }
};

// Helper: Convert to list for API
export function getProductsList() {
  return Object.entries(PRODUCTS).map(([id, p]) => ({
    id,
    price: p.price,
    type: p.type,
    amount: p.amount || null,
    title: p.title,
    desc: p.desc
  }));
}
