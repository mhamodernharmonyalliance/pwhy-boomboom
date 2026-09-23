/* ==========================================
   منطق الواجهة الرئيسي
   ========================================== */

import { CONFIG } from './config.js';
import { getProductsList, LEVELS, RESOURCES, getLevel } from './products.js';
import { state, applyLevel, addCoins, addLog, setMood } from './game/state.js';
import { checkDailyPresence, doClick, doClaim, consumeEnergy, canClick, canClaim } from './game/ledger.js';
import { getFace, setFaceMood } from './game/faces.js';
import { initChart, updateChart, resizeChart } from './game/chart.js';
import { t, getLang, setLanguage, toggleLanguage } from './i18n.js';

window.toggleLanguage = toggleLanguage;

let products = [];

// ==================== INIT ====================
(async function init() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.themeParams?.bg_color) document.body.style.background = tg.themeParams.bg_color;
  }

  try {
    await loadUser();
    await loadProducts();
    hideSplash();
    showApp();
    render();
    initChart(document.getElementById('chart-bg'));
    checkDailyPresence();
    loop();
  } catch (e) {
    console.error(e);
    hideSplash();
    alert(e.message || 'Failed');
  }

  window.addEventListener('resize', resizeChart);
  window.__onLangChange = render;
})();

// ==================== API ====================
async function loadUser() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) {
    state.user = { firstName: t('guest'), id: 0 };
    return;
  }
  const res = await fetch('/api/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const result = await res.json();
  if (!result.ok) throw new Error(result.error || 'Auth failed');
  state.user = result.user;
  const data = result.data || {};
  if (data.level) applyLevel(data.level);
  if (typeof data.energy === 'number') state.energy = data.energy;
  if (typeof data.coins === 'number') state.coins = data.coins;
  if (data.lastDaily) state.lastDaily = data.lastDaily;
  if (data.purchases) state.purchases = data.purchases;
}

async function loadProducts() {
  const res = await fetch('/api/products');
  const data = await res.json();
  products = data.products || [];
}

// ==================== UI ====================
function hideSplash() {
  const s = document.getElementById('splash');
  if (s) { s.classList.add('hidden'); setTimeout(() => s.remove(), 400); }
}
function showApp() {
  document.getElementById('app')?.classList.remove('hidden');
}

function render() {
  renderUser();
  renderFace();
  renderStats();
  renderDreamBar();
  renderLevel();
  renderResources();
  renderAdsButton();
  renderLog();
}

function renderUser() {
  document.getElementById('user-name').textContent = state.user?.firstName || t('guest');
}

function renderFace() {
  const face = getFace();
  const el = document.getElementById('player-emoji');
  if (el) el.textContent = face.emoji;
  document.documentElement.style.setProperty('--led-color', face.color);
}

function renderStats() {
  document.getElementById('energy-value').textContent = Math.floor(state.energy);
  document.getElementById('energy-max').textContent = state.maxEnergy;
  document.getElementById('coins-value').textContent = Math.floor(state.coins);
  const pct = Math.min(100, (state.energy / state.maxEnergy) * 100);
  document.getElementById('energy-fill').style.width = pct + '%';
}

function renderDreamBar() {
  // شريط 314 — يتحرك مع المستوى لكن لا يكتمل أبدًا
  const progress = Math.min(99.5, (state.level / CONFIG.game.maxLevel) * 90 + Math.random() * 2);
  document.getElementById('dream-fill').style.width = progress + '%';
  document.getElementById('dream-target').textContent = CONFIG.game.dreamTarget;
  document.getElementById('dream-real').textContent = `$${CONFIG.game.realPrice}`;
  document.getElementById('dream-soon').textContent = t('soon');
}

function renderLevel() {
  const el = document.getElementById('level-display');
  if (!el) return;
  el.textContent = `${t('level')} ${state.level}`;
  const next = getLevel(state.level + 1);
  const btn = document.getElementById('upgrade-btn');
  if (!next) {
    btn.textContent = t('maxLevel');
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  btn.innerHTML = `${next.title[getLang()]} — ⭐ ${next.price}`;
}

function renderResources() {
  const container = document.getElementById('resources');
  if (!container) return;
  container.innerHTML = Object.values(RESOURCES).map(r => `
    <button class="resource-btn" data-res="${r.id}">
      <span class="res-icon">${r.icon}</span>
      <span class="res-cost">-${r.energyCost}⚡</span>
      <span class="res-name">${r.title[getLang()]}</span>
    </button>
  `).join('');
  container.querySelectorAll('.resource-btn').forEach(btn => {
    btn.onclick = () => useResource(btn.dataset.res);
  });
}

function renderAdsButton() {
  const btn = document.getElementById('ad-btn');
  if (!btn) return;
  if (!CONFIG.ads.enabled) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'block';
  btn.textContent = t('watchAd', { n: CONFIG.ads.rewardCoins });
  btn.onclick = watchAd;
}

function renderLog() {
  const el = document.getElementById('log');
  if (!el) return;
  el.innerHTML = state.log.slice(0, 8).map(l =>
    `<div class="log-item">${l.text}</div>`
  ).join('');
}

// ==================== ACTIONS ====================
window.doCollectClick = function () {
  if (doClick()) {
    render();
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }
};

window.doClaimAction = function () {
  const res = doClaim();
  if (res.ok) {
    render();
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  }
};

function useResource(id) {
  const r = RESOURCES[id];
  if (!r) return;
  if (!consumeEnergy(r.energyCost)) {
    flashMessage(t('notEnoughEnergy'));
    return;
  }
  if (id === 'anesthesia')   { setFaceMood('sedated', 5000);  addLog(t('anesthesiaUsed')); }
  if (id === 'patience')     { setFaceMood('calm', 3000);      addLog(t('patienceUsed')); }
  if (id === 'conspiracy')   { setFaceMood('suspicious', 4000); addLog(t('conspiracyUsed')); }
  render();
}

async function watchAd() {
  if (!CONFIG.ads.enabled) { flashMessage(t('adsDisabled')); return; }
  const now = Date.now();
  if (now - state.lastAd < CONFIG.ads.cooldown) { flashMessage(t('adsDisabled')); return; }

  // الموديول جاهز — يستدعي SDK الخاص بالمزود
  const ok = await showRewardedAd();
  if (ok) {
    state.lastAd = now;
    addCoins(CONFIG.ads.rewardCoins);
    addLog(`📺 +${CONFIG.ads.rewardCoins} عملة`);
    render();
  }
}

// الدالة الموحّدة — تُملأ لاحقًا بـ Monetag SDK
async function showRewardedAd() {
  // TODO: استبدل بسطر Monetag لما يوصلك Zone ID
  // import createAdHandler from 'monetag-tg-sdk'
  // const handler = createAdHandler(CONFIG.ads.zoneId)
  // await handler()
  return true;
}

// ==================== UPGRADE ====================
window.upgradeLevel = async function () {
  const next = getLevel(state.level + 1);
  if (!next) return;
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;
  if (!tg || !tg.openInvoice || !initData) {
    flashMessage(t('payNotTg'));
    return;
  }
  try {
    const res = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: `level_${state.level + 1}`, initData, lang: getLang() }),
    });
    const data = await res.json();
    if (!data.url) { flashMessage(data.error || t('payError')); return; }
    tg.openInvoice(data.url, (status) => {
      if (status === 'paid') {
        applyLevel(state.level + 1);
        addLog(`📦 ${t('level')} ${state.level}`);
        render();
        flashMessage(t('paySuccess'));
      } else if (status === 'failed') {
        flashMessage(t('payFail'));
      }
    });
  } catch { flashMessage(t('payNetErr')); }
};

// ==================== LOOP ====================
function loop() {
  setInterval(() => {
    // إعادة حساب المزاج
    renderFace();
    renderStats();
    renderDreamBar();
    updateChart();
  }, CONFIG.game.tickInterval);
}

// ==================== HELPERS ====================
function flashMessage(text) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.textContent = text;
  el.classList.add('active');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('active'), 2500);
}

window.closeFlash = () => document.getElementById('flash')?.classList.remove('active');
