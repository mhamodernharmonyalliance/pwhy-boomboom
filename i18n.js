/* ==========================================
   i18n - Translations System
   ========================================== */

const I18N = {
  en: {
    loading: "Loading...",
    purchaseHistory: "Purchase History",
    openingInvoice: "Opening invoice...",
    close: "Close",
    guest: "Guest",
    credits: "Booms",
    noPurchases: "No purchases yet",
    payNotTg: "⚠️ Payment is only available in Telegram",
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
    navShop: "Shop"
  },
  ar: {
    loading: "جاري التحميل...",
    purchaseHistory: "سجل المشتريات",
    openingInvoice: "جاري فتح الفاتورة...",
    close: "إغلاق",
    guest: "لاعب pwhy",
    credits: "نقطة",
    noPurchases: "لا توجد مشتريات بعد",
    payNotTg: "⚠️ الدفع متاح فقط داخل Telegram",
    paySuccess: "🎉 شكراً لك! تم تطبيق الشراء.",
    payFail: "⚠️ فشل الدفع. جرب مرة أخرى.",
    payError: "❌ فشل إنشاء الفاتورة",
    payNetErr: "⚠️ خطأ في الاتصال",
    priceLabel: "⭐ نجمة",
    gameTitle: "إجمالي الـ Booms",
    energyLabel: "الطاقة",
    levelLabel: "مستوى 1",
    upgradesTitle: "التطويرات بالنقاط",
    starsStoreTitle: "متجر النجوم (Telegram Stars)",
    tapUpgradeTitle: "قوة النقر (Multitap)",
    tapUpgradeCost: "السعر: 100 💣",
    energyUpgradeTitle: "حد الطاقة (Energy Limit)",
    energyUpgradeCost: "السعر: 200 💣",
    navGame: "اللعبة",
    navShop: "المتجر"
  }
};

let currentLang = localStorage.getItem('lang') || (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code === 'ar' ? 'ar' : 'en');

function t(key) {
  const dict = I18N[currentLang] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

function getLang() { return currentLang; }

function setLanguage(lang) {
  if (!I18N[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  applyTranslations();
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderHistory === 'function') renderHistory();
}

function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'ar' : 'en');
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
  applyTranslations();
});
