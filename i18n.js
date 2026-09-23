/* ==========================================
   PWhy — Internationalization (i18n) System
   نظام دعم اللغة العربية والإنجليزية
   ========================================== */

const I18N = {
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

// تحديد اللغة الحالية بناءً على localStorage أو لغة تليجرام الافتراضية
let currentLang = localStorage.getItem('lang') || 
  (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code === 'ar' ? 'ar' : 'en');

/**
 * دالة جلب النص المترجم بناءً على المفتاح
 */
export function t(key) {
  const dict = I18N[currentLang] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

/**
 * معرفة اللغة الحالية
 */
export function getLang() { 
  return currentLang; 
}

/**
 * تغيير اللغة وتطبيقها على الصفحة
 */
export function setLanguage(lang) {
  if (!I18N[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  
  applyTranslations();

  // إطلاق حدث تغيير اللغة للتطبيقات الأخرى إذا لزم الأمر
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * التبديل بين العربية والإنجليزية
 */
export function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'ar' : 'en');
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
}

// تهيئة اللغة عند بداية التحميل
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    applyTranslations();
  });
}

export default { t, getLang, setLanguage, toggleLanguage, applyTranslations };
