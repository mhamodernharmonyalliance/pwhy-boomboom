/* ==========================================
   P Why — Boom Boom
   Frontend Logic
   ========================================== */

import { CONFIG } from './config.js';
import { getProductsList, LEVELS, RESOURCES, getLevel } from './products.js';
import { state, applyLevel, addCoins, addLog, setMood } from './game/state.js';
import { checkDailyPresence, doClick, doClaim, consumeEnergy } from './game/ledger.js';
import { getFace, setFaceMood } from './game/faces.js';
import { t, getLang, setLanguage, toggleLanguage } from './i18n.js';
import { sounds } from './sounds.js';

window.toggleLanguage = toggleLanguage;
window.switchTab = switchTab;
window.closeFlash = closeFlash;

let products = [];
let currentTab = 'game';

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
    bindUI();
    renderAll();
    checkDailyPresence();
    if (state.lastDaily && Date.now() - state.lastDaily < 1000) {
      sounds.daily();
    }
    loop();
  } catch (e) {
    console.error(e);
    hideSplash();
    flash(e.message || 'Failed to load');
  }

  window.__onLangChange = renderAll;
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

function bindUI() {
  // Tap button
  const tap = document.getElementById('click-area');
  if (tap) {
    tap.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) {
        handleTap(e.touches[i].clientX, e.touches[i].clientY);
      }
    }, { passive: false });

    tap.addEventListener('click', (e) => {
      if (e.pointerType === 'mouse') handleTap(e.clientX, e.clientY);
    });
  }

  // Sound toggle
  document.getElementById('sound-btn')?.addEventListener('click', (e) => {
    const on = sounds.toggle();
    e.currentTarget.textContent = on ? '🔊' : '🔇';
  });
}

// ==================== TAP ====================
function handleTap(x, y) {
  if (!doClick()) return;
  sounds.tap();
  spawnFloating(x, y, `+${CONFIG.game.clickEnergy}`);
  renderStats();
  renderFace();
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
}

function spawnFloating(x, y, text) {
  const el = document.createElement('div');
  el.className = 'floating-num';
  el.textContent = text;
  el.style.left = (x - 15) + 'px';
  el.style.top  = (y - 30) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ==================== ACTIONS ====================
window.doClaimAction = function () {
  const res = doClaim();
  if (res.ok) {
    sounds.claim();
    flash(`💰 +${res.earned}`);
    renderAll();
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  }
};

function useResource(id) {
  const r = RESOURCES[id];
  if (!r) return;
  if (!consumeEnergy(r.energyCost)) {
    sounds.error();
    flash(t('notEnoughEnergy'));
    return;
  }
  if (id === 'anesthesia') { setFaceMood('sedated', 5000);  sounds.sedate();   addLog(t('anesthesiaUsed')); }
  if (id === 'patience')   { setFaceMood('calm', 3000);      sounds.resource(); addLog(t('patienceUsed')); }
  if (id === 'conspiracy') { setFaceMood('suspicious', 4000); sounds.resource(); addLog(t('conspiracyUsed')); }
  renderAll();
}

window.useResource = useResource;

// ==================== UPGRADE ====================
window.upgradeLevel = async function () {
  const next = getLevel(state.level + 1);
  if (!next) return;
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;
  if (!tg || !tg.openInvoice || !initData) {
    sounds.error();
    flash(t('payNotTg'));
    return;
  }
  try {
    const res = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: `level_${state.level + 1}`, initData, lang: getLang() }),
    });
    const data = await res.json();
    if (!data.url) { sounds.error(); flash(data.error || t('payError')); return; }
    tg.openInvoice(data.url, (status) => {
      if (status === 'paid') {
        applyLevel(state.level + 1);
        addLog(`📦 ${t('level')} ${state.level}`);
        sounds.upgrade();
        renderAll();
        flash(t('paySuccess'));
      } else if (status === 'failed') {
        sounds.error();
        flash(t('payFail'));
      }
    });
  } catch { sounds.error(); flash(t('payNetErr')); }
};

// ==================== ADS ====================
async function watchAd() {
  if (!CONFIG.ads.enabled) { sounds.error(); flash(t('adsDisabled')); return; }
  const now = Date.now();
  if (now - state.lastAd < CONFIG.ads.cooldown) { sounds.error(); flash(t('adsDisabled')); return; }
  const ok = await showRewardedAd();
  if (ok) {
    state.lastAd = now;
    addCoins(CONFIG.ads.rewardCoins);
    addLog(`📺 +${CONFIG.ads.rewardCoins} 🪙`);
    sounds.adReward();
    renderAll();
  }
}

async function showRewardedAd() {
  // TODO: Monetag SDK
  return true;
}

// ==================== TABS ====================
function switchTab(tab) {
  currentTab = tab;
  sounds.nav();
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.getElementById('nav-game')?.classList.toggle('active', tab === 'game');
  document.getElementById('nav-shop')?.classList.toggle('active', tab === 'shop');
}

// ==================== RENDER ====================
function renderAll() {
  renderUser();
  renderFace();
  renderStats();
  renderDreamBar();
  renderLevels();
  renderResources();
  renderAdsButton();
  renderLog();
}

function renderUser() {
  const name = state.user?.firstName || t('guest');
  document.getElementById('user-name').textContent = name;
  document.getElementById('level-num').textContent = state.level;
  if (state.user?.firstName) {
    document.getElementById('user-avatar').textContent = state.user.firstName[0].toUpperCase();
  }
}

function renderFace() {
  const face = getFace();
  const el = document.getElementById('player-emoji');
  if (el) el.textContent = face.emoji;
  document.documentElement.style.setProperty('--led-color', face.color);
}

function renderStats() {
  const e = Math.floor(state.energy);
  document.getElementById('energy-value').textContent = e;
  document.getElementById('energy-max').textContent = state.maxEnergy;
  document.getElementById('coins-main').textContent = Math.floor(state.coins).toLocaleString();
  document.getElementById('coins-header').textContent = Math.floor(state.coins).toLocaleString();
  const pct = Math.min(100, (state.energy / state.maxEnergy) * 100);
  document.getElementById('energy-fill').style.width = pct + '%';
}

function renderDreamBar() {
  const progress = Math.min(99.5, (state.level / CONFIG.game.maxLevel) * 88 + Math.random() * 3);
  document.getElementById('dream-fill').style.width = progress + '%';
  document.getElementById('dream-real').textContent = `$${CONFIG.game.realPrice}`;
}

function renderLevels() {
  const container = document.getElementById('levels-list');
  if (!container) return;
  const lang = getLang();
  container.innerHTML = Object.entries(LEVELS).map(([lvl, data]) => {
    const n = Number(lvl);
    const owned = n <= state.level;
    const isNext = n === state.level + 1;
    const locked = n > state.level + 1;
    const cls = owned ? 'owned' : (locked ? 'locked' : '');
    return `
      <div class="level-card ${cls}">
        <div class="level-left">
          <div class="level-title">${data.title[lang] || data.title.ar}</div>
          <div class="level-desc">${data.desc[lang] || data.desc.ar}</div>
          <div class="level-price">⭐ ${data.price}</div>
        </div>
        ${owned
          ? `<span class="level-owned-badge">✅</span>`
          : `<button class="level-buy" ${isNext ? '' : 'disabled'} onclick="upgradeLevel()">
              ${isNext ? t('upgrade') : `🔒 ${t('level')} ${n - 1}`}
             </button>`}
      </div>
    `;
  }).join('');
}

function renderResources() {
  const container = document.getElementById('resources-list');
  if (!container) return;
  const lang = getLang();
  container.innerHTML = Object.values(RESOURCES).map(r => `
    <div class="resource-card" onclick="useResource('${r.id}')">
      <div class="res-icon">${r.icon}</div>
      <div class="res-body">
        <div class="res-name">${r.title[lang] || r.title.ar}</div>
        <div class="res-desc">${r.desc[lang] || r.desc.ar}</div>
      </div>
      <div class="res-cost">${r.energyCost} ⚡</div>
    </div>
  `).join('');
}

function renderAdsButton() {
  const btn = document.getElementById('ad-btn');
  if (!btn) return;
  if (!CONFIG.ads.enabled) { btn.style.display = 'none'; return; }
  btn.style.display = 'block';
  btn.innerHTML = `📺 ${t('watchAd', { n: CONFIG.ads.rewardCoins })}`;
  btn.onclick = watchAd;
}

function renderLog() {
  const el = document.getElementById('log');
  if (!el) return;
  el.innerHTML = state.log.slice(0, 6).map(l =>
    `<div class="log-item">${l.text}</div>`
  ).join('');
}

// ==================== LOOP ====================
function loop() {
  setInterval(() => {
    renderFace();
    renderStats();
    renderDreamBar();
  }, CONFIG.game.tickInterval);
}

// ==================== HELPERS ====================
function flash(text) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.textContent = text;
  el.classList.add('active');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('active'), 2200);
}

function closeFlash() {
  document.getElementById('flash')?.classList.remove('active');
}
