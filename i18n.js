/* ==========================================
   PWhy BoomBoom - i18n (EN default, AR alt)
   ========================================== */

const I18N = {
  en: {
    splashTitle: "Loading PWhy BoomBoom... 💖",
    splashSub: "Preparing hearts",
    level: "Level",
    scoreLabel: "Total Booms",
    energy: "Energy",
    watchAd: "Watch Ad → +1000 Hearts",
    adWait: "⏳ Wait",
    adBefore: "before a new ad.",
    adNoAds: "⚠️ No ads available. Try later.",
    adError: "⚠️ Error. Try again.",
    adBoost: "🎬 +1000 Hearts added!",
    tutTitle: "Welcome to PWhy BoomBoom!",
    tutSub: "Quick start guide",
    tutStep1: "Tap the heart to earn Booms.",
    tutStep2: "Watch your energy — it regenerates.",
    tutStep3: "Watch ads for +1000 hearts.",
    tutStart: "🚀 Let's go!",
    ok: "OK",
    boost: "BOOST ×2",
    x2Boost: "🔥 x2 Boost",
    offlineScoreKept: "Offline mode"
  },
  ar: {
    splashTitle: "جاري تحميل PWhy BoomBoom... 💖",
    splashSub: "تجهيز القلوب",
    level: "مستوى",
    scoreLabel: "إجمالي الـ Booms",
    energy: "الطاقة",
    watchAd: "شاهد إعلان → +1000 قلب",
    adWait: "⏳ انتظر",
    adBefore: "قبل إعلان جديد.",
    adNoAds: "⚠️ لا توجد إعلانات متاحة. جرب لاحقاً.",
    adError: "⚠️ خطأ. جرب مرة أخرى.",
    adBoost: "🎬 +1000 قلب!",
    tutTitle: "مرحباً في PWhy BoomBoom!",
    tutSub: "دليل سريع للبدء",
    tutStep1: "اضغط على القلب لتكسب Booms.",
    tutStep2: "انتبه لطاقتك — تتجدد تلقائياً.",
    tutStep3: "شاهد الإعلانات مقابل +1000 قلب.",
    tutStart: "🚀 هيا نبدأ!",
    ok: "حسناً",
    boost: "تعزيز ×2",
    x2Boost: "🔥 مضاعف ×2",
    offlineScoreKept: "وضع غير متصل"
  }
};

let currentLang = localStorage.getItem('pwhy_lang') || 'en';

function t(key) {
  const dict = I18N[currentLang] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

function getLang() { return currentLang; }

function setLanguage(lang) {
  if (!I18N[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('pwhy_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  applyTranslations();
}

function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'ar' : 'en');
  SoundManager.click();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
  applyTranslations();
});
