/* ==========================================
   PWhy — Internationalization (i18n) System
   نظام دعم اللغة العربية والإنجليزية
   ========================================== */

const I18N_DATA = {
  en: {
    loading: "Loading...",
    purchaseHistory: "Purchase History",
    openingInvoice: "Opening invoice...",
    close: "Close",
    guest: "PWhy Player",
    credits: "Booms",
    noPurchases: "No purchases yet",
    payNotTg: "⚠️ Payment is only available inside Telegram",
    paySuccess: "🎉 Thank you! Purchase applied.",
    payFail: "⚠️ Payment failed. Try again.",
    payError: "❌ Failed to create invoice",
    payNetErr: "⚠️ Connection error",
    priceLabel: "⭐ Stars",
    gameTitle: "Total Booms",
    energyLabel: "Energy",
    levelLabel: "Level 1",
    upgradesTitle: "Upgrades & Boosts",
    starsStoreTitle: "Telegram Stars Store",
    tapUpgradeTitle: "Tap Power (+1)",
    tapUpgradeCost: "Cost: 100 💣",
    energyUpgradeTitle: "Energy Limit (+500)",
    energyUpgradeCost: "Cost: 200 💣",
    navGame: "Game",
    navShop: "Shop",
    navTasks: "Tasks",
    langBtn: "العربية",
    joinChannel: "Join Official Channel",
    claimReward: "Claim 1,000 💣"
  },
  ar: {
    loading: "جاري التحميل...",
    purchaseHistory: "سجل المشتريات",
    openingInvoice: "جاري فتح الفاتورة...",
    close: "إغلاق",
    guest: "لاعب PWhy",
    credits: "نقطة",
    noPurchases: "لا توجد مشتريات بعد",
    payNotTg: "⚠️ الدفع متاح فقط داخل Telegram",
    paySuccess: "🎉 شكراً لك! تم تطبيق الشراء بنجاح.",
    payFail: "⚠️ فشل الدفع. حاول مرة أخرى.",
    payError: "❌ فشل إنشاء الفاتورة",
    payNetErr: "⚠️ خطأ في الاتصال بالشبكة",
    priceLabel: "⭐ نجمة",
    gameTitle: "إجمالي الـ Booms",
    energyLabel: "الطاقة",
    levelLabel: "المستوى 1",
    upgradesTitle: "التطويرات بالنقاط",
    starsStoreTitle: "متجر النجوم (Telegram Stars)",
    tapUpgradeTitle: "قوة النقر (Multitap)",
    tapUpgradeCost: "السعر: 100 💣",
    energyUpgradeTitle: "حد الطاقة (Energy Limit)",
    energyUpgradeCost: "السعر: 200 💣",
    navGame: "اللعبة",
    navShop: "المتجر",
    navTasks: "المهام",
    langBtn: "English",
    joinChannel: "انضم للقناة الرسمية",
    claimReward: "احصل على 1,000 💣"
  }
};

// تحديد اللغة الافتراضية
let currentLang = localStorage.getItem('lang') || 
  (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code === 'ar' ? 'ar' : 'en');

/**
 * دالة جلب النص المترجم بناءً على المفتاح
 */
export function t(key) {
  const dict = I18N_DATA[currentLang] || I18N_DATA.en;
  return dict[key] || I18N_DATA.en[key] || key;
}

/**
 * معرفة اللغة الحالية
 */
export function getLang() { 
  return currentLang; 
}

/**
 * تطبيق الترجمة على كل العناصر التي تحمل خاصية data-i18n
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // تحديث نص زر التغيير تلقائياً إن وجد
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.textContent = t('langBtn');
  }
}

/**
 * تغيير اللغة وتطبيقها على الصفحة
 */
export function setLanguage(lang) {
  if (!I18N_DATA[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  
  applyTranslations();
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * التبديل بين العربية والإنجليزية
 */
export function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'ar' : 'en');
}

// جعل الدوال متاحة على مستوى window لسهولة الوصول المباشر
if (typeof window !== 'undefined') {
  window.I18N = { t, getLang, setLanguage, toggleLanguage, applyTranslations };
  
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    applyTranslations();
  });
}

export default { t, getLang, setLanguage, toggleLanguage, applyTranslations };
