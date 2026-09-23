/* ==========================================
   PWhy BoomBoom - Main App & Game Logic
   ========================================== */

import { sounds } from './sounds.js';
import { t, getLang, toggleLanguage, applyTranslations } from './i18n.js';

// تحديد رابط الـ Worker تلقائياً أو استخدام الرابط المحلي/المرفوع
const WORKER_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:8787'
  : window.location.origin;

let userData = null;
let products = [];

// متغيرات حالة اللعبة (Game State)
let score = parseInt(localStorage.getItem('boomboom_score')) || 0;
let energy = parseInt(localStorage.getItem('boomboom_energy')) || 1000;
let maxEnergy = parseInt(localStorage.getItem('boomboom_max_energy')) || 1000;
let pointsPerClick = parseInt(localStorage.getItem('boomboom_ppc')) || 1;

// ==================== INIT ====================
(async function init() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.themeParams?.bg_color) {
      document.body.style.background = tg.themeParams.bg_color;
    }
  }

  // إعداد أحداث النقر والتوقيت
  setupGameEvents();

  // تحميل البيانات من الخادم
  try {
    await loadUser();
    await loadProducts();
    hideSplash();
    showApp();
    renderUser();
    renderProducts();
    renderHistory();
  } catch (e) {
    console.error('Init error:', e);
    hideSplash();
    showApp(); // إظهار التطبيق حتى في حال عدم تسجيل الدخول
    renderUser();
  }
})();

// ==================== API LOGIC ====================
async function loadUser() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) {
    userData = {
      user: { firstName: t('guest') },
      data: { credits: score, purchases: [] }
    };
    return;
  }

  try {
    const res = await fetch(`${WORKER_URL}/api/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Auth failed');
    userData = result;

    if (userData.data?.credits !== undefined && userData.data.credits > 0) {
      score = userData.data.credits;
      updateUI();
    }
  } catch (err) {
    userData = {
      user: { firstName: t('guest') },
      data: { credits: score, purchases: [] }
    };
  }
}

async function loadProducts() {
  try {
    const res = await fetch(`${WORKER_URL}/api/products`);
    const data = await res.json();
    products = data.products || [];
  } catch (e) {
    products = [];
  }
}

// ==================== GAME LOGIC ====================
function setupGameEvents() {
  const clickArea = document.getElementById('click-area');
  if (!clickArea) return;

  clickArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
      handleTap(e.touches[i].clientX, e.touches[i].clientY);
    }
  });

  clickArea.addEventListener('click', (e) => {
    if (e.pointerType === 'mouse') {
      handleTap(e.clientX, e.clientY);
    }
  });

  // تجديد الطاقة تلقائياً كل ثانية
  setInterval(() => {
    if (energy < maxEnergy) {
      energy = Math.min(maxEnergy, energy + 2);
      updateUI();
    }
  }, 1000);

  updateUI();
}

function handleTap(x, y) {
  if (energy < pointsPerClick) return;

  score += pointsPerClick;
  energy -= pointsPerClick;
  updateUI();

  // تشغيل الصوت والاهتزاز
  sounds.tap();

  const tg = window.Telegram?.WebApp;
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('medium');
  }

  createFloatingNumber(x, y);
}

function createFloatingNumber(x, y) {
  const num = document.createElement('div');
  num.className = 'floating-num';
  num.textContent = `+${pointsPerClick}`;
  num.style.left = `${x - 15}px`;
  num.style.top = `${y - 30}px`;
  document.body.appendChild(num);

  setTimeout(() => num.remove(), 800);
}

function updateUI() {
  const scoreEl = document.getElementById('score');
  const scoreHeaderEl = document.getElementById('score-header');
  const energyEl = document.getElementById('energy');
  const maxEnergyEl = document.getElementById('max-energy');
  const energyBarEl = document.getElementById('energy-bar');

  if (scoreEl) scoreEl.textContent = score.toLocaleString();
  if (scoreHeaderEl) scoreHeaderEl.textContent = score.toLocaleString();
  if (energyEl) energyEl.textContent = energy;
  if (maxEnergyEl) maxEnergyEl.textContent = maxEnergy;

  if (energyBarEl) {
    const energyPercent = (energy / maxEnergy) * 100;
    energyBarEl.style.width = `${energyPercent}%`;
  }

  // الحفظ المحلي للتقدم
  localStorage.setItem('boomboom_score', score);
  localStorage.setItem('boomboom_energy', energy);
  localStorage.setItem('boomboom_max_energy', maxEnergy);
  localStorage.setItem('boomboom_ppc', pointsPerClick);
}

// ترقية المهارات داخل اللعبة بالنقاط
window.buyUpgrade = function(type) {
  if (type === 'tap' && score >= 100) {
    score -= 100;
    pointsPerClick += 1;
    sounds.upgrade();
    showAlert('🎉', t('paySuccess'), t('tapUpgradeTitle'));
  } else if (type === 'energy' && score >= 200) {
    score -= 200;
    maxEnergy += 500;
    energy += 500;
    sounds.upgrade();
    showAlert('🎉', t('paySuccess'), t('energyUpgradeTitle'));
  } else {
    sounds.error();
    showAlert('⚠️', 'تنبيه', 'عذراً، لا تمتلك رصيد كافي من الـ Booms!');
  }
  updateUI();
};

// ==================== UI RENDER ====================
function hideSplash() {
  const s = document.getElementById('splash');
  if (s) {
    s.style.opacity = '0';
    setTimeout(() => s.remove(), 400);
  }
}

function showApp() {
  document.getElementById('app')?.classList.remove('hidden');
}

function renderUser() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const name = tgUser?.first_name || userData?.user?.firstName || t('guest');
  
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = name;

  const userAvatarEl = document.getElementById('user-avatar');
  if (userAvatarEl && name) {
    userAvatarEl.textContent = name[0].toUpperCase();
  }
}

function renderProducts() {
  const container = document.getElementById('products-container');
  if (!container) return;

  if (!products.length) {
    container.innerHTML = `<div class="text-center text-slate-400 py-4 text-xs">${t('loading')}</div>`;
    return;
  }

  container.innerHTML = products.map(p => {
    const lang = getLang();
    const title = p.title?.[lang] || p.title?.en || p.id;
    const desc = p.desc?.[lang] || p.desc?.en || '';
    const icon = extractIcon(title) || '⭐';
    const titleText = stripIcon(title);

    return `
      <div class="bg-slate-900/80 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between mb-3 shadow-lg">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-2xl">${icon}</div>
          <div>
            <h4 class="font-bold text-sm text-slate-100">${titleText}</h4>
            <p class="text-xs text-slate-400">${desc}</p>
            <span class="text-xs text-yellow-400 font-semibold mt-1 block">${t('priceLabel')}: ${p.price} ⭐</span>
          </div>
        </div>
        <button onclick="buyProduct('${p.id}')" class="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs hover:brightness-110 active:scale-95 transition">
          ${t('navShop')} ⭐
        </button>
      </div>
    `;
  }).join('');
}

function renderHistory() {
  const section = document.getElementById('history-section');
  const list = document.getElementById('history-list');
  if (!section || !list) return;

  const purchases = userData?.data?.purchases || [];
  if (!purchases.length) {
    section.classList.remove('hidden');
    list.innerHTML = `<div class="text-slate-500 text-center py-3 text-xs">${t('noPurchases')}</div>`;
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = purchases.slice().reverse().map(p => {
    const date = new Date(p.date || Date.now()).toLocaleDateString();
    return `
      <div class="flex justify-between items-center py-2 border-b border-slate-800 text-xs text-slate-300">
        <span>${p.productId}</span>
        <span class="opacity-60">${date}</span>
      </div>
    `;
  }).join('');
}

function extractIcon(title) {
  const match = title?.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  return match ? match[0] : null;
}

function stripIcon(title) {
  return title ? title.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '').trim() : '';
}

// ==================== TELEGRAM STARS PURCHASE ====================
window.buyProduct = async function(productId) {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!tg || !tg.openInvoice || !initData) {
    sounds.error();
    showAlert('⚠️', 'تنبيه', t('payNotTg'));
    return;
  }

  const payModal = document.getElementById('pay-modal');
  if (payModal) payModal.classList.add('active');

  try {
    const res = await fetch(`${WORKER_URL}/api/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, initData, lang: getLang() })
    });
    const data = await res.json();

    if (payModal) payModal.classList.remove('active');

    if (!data.url) {
      sounds.error();
      showAlert('❌', 'خطأ', data.error || t('payError'));
      return;
    }

    // فتح نافذة دفع النجوم عبر تليجرام الرسمي
    tg.openInvoice(data.url, (status) => {
      if (status === 'paid') {
        sounds.claim();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showAlert('🎉', 'نجاح', t('paySuccess'));
        
        // تطبيق المكافأة فوراً
        score += 10000;
        updateUI();

        setTimeout(() => location.reload(), 2000);
      } else if (status === 'failed') {
        sounds.error();
        showAlert('⚠️', 'إلغاء', t('payFail'));
      }
    });
  } catch (e) {
    if (payModal) payModal.classList.remove('active');
    sounds.error();
    showAlert('⚠️', 'خطأ', t('payNetErr'));
  }
};

// ==================== NAVIGATION SWITCHER ====================
window.switchTab = function(tab) {
  sounds.nav();
  const tabGame = document.getElementById('tab-game');
  const tabShop = document.getElementById('tab-shop');
  const navGame = document.getElementById('nav-game');
  const navShop = document.getElementById('nav-shop');

  if (tabGame) tabGame.classList.add('hidden');
  if (tabShop) tabShop.classList.add('hidden');
  if (navGame) navGame.className = 'flex flex-col items-center gap-1 text-slate-500';
  if (navShop) navShop.className = 'flex flex-col items-center gap-1 text-slate-500';

  if (tab === 'game') {
    if (tabGame) tabGame.classList.remove('hidden');
    if (navGame) navGame.className = 'flex flex-col items-center gap-1 text-amber-400 font-bold';
  } else {
    if (tabShop) tabShop.classList.remove('hidden');
    if (navShop) navShop.className = 'flex flex-col items-center gap-1 text-amber-400 font-bold';
  }
};

// ==================== LANGUAGE TOGGLE ====================
window.toggleLang = function() {
  toggleLanguage();
  renderProducts();
  renderUser();
};

// ==================== ALERTS ====================
function showAlert(icon, title, message) {
  const iconEl = document.getElementById('alert-icon');
  const titleEl = document.getElementById('alert-title');
  const msgEl = document.getElementById('alert-message');
  const modal = document.getElementById('alert-modal');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  
  if (modal) {
    modal.classList.add('active');
  } else {
    alert(`${icon} ${title}: ${message}`);
  }
}

window.closeAlert = function() {
  sounds.nav();
  document.getElementById('alert-modal')?.classList.remove('active');
};
