/* ==========================================
   Boom Boom — P Why
   الإعدادات المركزية
   ========================================== */

export const CONFIG = {
  game: {
    name: 'P Why',
    tagline: { ar: 'منذ 1919 — ننتظر', en: 'Since 1919 — Still Waiting' },
    startYear: 1919,
    dreamTarget: 314,          // الحلم الأبدي
    realPrice: 0.0004,          // السعر الثابت (سخرية)
    maxLevel: 6,
    dailyPresenceEnergy: 5,     // 🎁 حضور يومي
    clickEnergy: 1,             // ضغطة = طاقة
    clickCooldown: 700,         // ms
    claimCooldown: 3000,        // ms
    baseEnergyCap: 10,
    tickInterval: 1000,         // تحديث كل ثانية
  },

  costs: {
    anesthesia: 10,   // 💊 بنج — أضعاف الطاقة
    patience: 2,      // 🧘 صبر
    conspiracy: 3,    // 🕵️ مؤامرة — تسريع claim
  },

  ads: {
    enabled: false,           // ← فعّلها بعد ما تجهز حساب Monetag
    provider: 'monetag',
    zoneId: '',               // ← الصق Zone ID هنا
    rewardCoins: 10,
    cooldown: 60000,          // دقيقة بين كل إعلان
  },

  firebase: 'https://YOUR-PROJECT.firebaseio.com',
};
