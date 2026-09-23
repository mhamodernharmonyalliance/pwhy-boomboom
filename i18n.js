/* ==========================================
   i18n — الترجمة
   ========================================== */

const I18N = {
  en: {
    loading: 'Loading...',
    since: 'Since',
    energy: 'Energy',
    coins: 'Coins',
    claim: 'Collect',
    dailyBonus: 'Daily Bonus',
    vitalSigns: 'Vital Signs',
    level: 'Level',
    upgrade: 'Upgrade',
    maxLevel: 'Max Level Reached',
    soon: 'Soon...',
    dream: 'Dream',
    close: 'Close',
    guest: 'Guest',
    noPurchases: 'No purchases yet',
    payNotTg: '⚠️ Payment is only available in Telegram',
    paySuccess: '🎉 Thank you! Level upgraded.',
    payFail: '⚠️ Payment failed.',
    payError: '❌ Failed to create invoice',
    payNetErr: '⚠️ Connection error',
    adsDisabled: '📺 Ads coming soon',
    notEnoughEnergy: '⚠️ Not enough energy',
    anesthesiaUsed: '💊 Sedated. For now.',
    patienceUsed: '🧘 A little patience...',
    conspiracyUsed: '🕵️ Claim accelerated (allegedly)',
    watchAd: '📺 Watch Ad (+{n} coins)',
    useResource: 'Use',
    resetDay: 'New day. He opened the app.',
    stillWaiting: 'Still waiting...',
    years: 'years',
     game: 'Game',
shop: 'Shop',
resources: 'Resources',
  },
  ar: {
    loading: 'جاري التحميل...',
    since: 'منذ',
    energy: 'طاقة',
    coins: 'عملات',
    claim: 'استلام',
    dailyBonus: 'مكافأة الحضور',
    vitalSigns: 'المؤشرات الحيوية',
    level: 'المستوى',
    upgrade: 'ترقية',
    maxLevel: 'وصلت الحد الأقصى',
    soon: 'قريبًا...',
    dream: 'الحلم',
    close: 'إغلاق',
    guest: 'ضيف',
    noPurchases: 'لا توجد مشتريات',
    payNotTg: '⚠️ الدفع متاح داخل Telegram فقط',
    paySuccess: '🎉 شكراً! تم ترقية المستوى.',
    payFail: '⚠️ فشل الدفع.',
    payError: '❌ فشل إنشاء الفاتورة',
    payNetErr: '⚠️ خطأ في الاتصال',
    adsDisabled: '📺 الإعلانات قريبًا',
    notEnoughEnergy: '⚠️ الطاقة لا تكفي',
    anesthesiaUsed: '💊 تم التخدير. مؤقتًا.',
    patienceUsed: '🧘 صبر قليل...',
    conspiracyUsed: '🕵️ تم تسريع الاستلام (مزعوم)',
    watchAd: '📺 شاهد إعلان (+{n} عملة)',
    useResource: 'استخدم',
    resetDay: 'يوم جديد. فتح التطبيق.',
    stillWaiting: 'ما زال ينتظر...',
    years: 'سنة',
     game: 'اللعبة',
shop: 'المتجر',
resources: 'الموارد',
  },
};

let currentLang = localStorage.getItem('lang') || 'ar';

export function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N.ar;
  let str = dict[key] || I18N.ar[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(`{${k}}`, v);
  });
  return str;
}

export function getLang() { return currentLang; }

export function setLanguage(lang) {
  if (!I18N[lang]) lang = 'ar';
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  if (window.__onLangChange) window.__onLangChange();
}

export function toggleLanguage() {
  setLanguage(currentLang === 'ar' ? 'en' : 'ar');
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
});
