/* ==========================================
   PWhy BoomBoom - Game Logic (v5 - Levels + Stars)
   Firebase + Adsgram + Hearts + Levels + Telegram Stars
   ========================================== */

// --- Safe SoundManager fallback ---
const SM = (typeof SoundManager !== 'undefined') ? SoundManager : {
  tap: () => {}, click: () => {}, combo: () => {}, gift: () => {},
  levelUp: () => {}, powerup: () => {}, bigTap: () => {},
  isMuted: () => false, toggle: () => false
};

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGk5Ufb-tVkxxfTcyqDKLiewik-DcH8o",
  authDomain: "pwhy-boomboom.firebaseapp.com",
  databaseURL: "https://pwhy-boomboom-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pwhy-boomboom",
  storageBucket: "pwhy-boomboom.firebasestorage.app",
  messagingSenderId: "107228338807",
  appId: "1:107228338807:web:f01becdb45cac930fda532"
};

// --- Firebase Init ---
let db = null;
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    console.log('✅ Firebase initialized');
  } else {
    console.error('❌ Firebase SDK not loaded');
  }
} catch (e) {
  console.error('❌ Firebase init error:', e);
}

// --- Levels System ---
const LEVELS = [
  { id: 'preliminary', ar: 'تمهيدي', en: 'Preliminary', min: 0,     color: '#f43f5e', glow: 'rgba(244,63,94,0.7)',  emoji: '💖', bonus: 1.0 },
  { id: 'bronze',      ar: 'برونزي', en: 'Bronze',      min: 20000, color: '#cd7f32', glow: 'rgba(205,127,50,0.7)', emoji: '🧡', bonus: 1.25 },
  { id: 'silver',      ar: 'فضي',    en: 'Silver',      min: 40000, color: '#e5e7eb', glow: 'rgba(229,231,235,0.7)', emoji: '🤍', bonus: 1.5 },
  { id: 'gold',        ar: 'ذهبي',   en: 'Gold',        min: 60000, color: '#ffd700', glow: 'rgba(255,215,0,0.8)',  emoji: '💛', bonus: 2.0 },
  { id: 'diamond',     ar: 'ماسي',   en: 'Diamond',     min: 80000, color: '#67e8f9', glow: 'rgba(103,232,249,0.85)', emoji: '💙', bonus: 3.0 }
];

function getLevel(pts) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (pts >= l.min) lvl = l;
  return lvl;
}
function getLevelIndex(pts) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (pts >= LEVELS[i].min) idx = i;
  return idx;
}
function getNextLevel(pts) {
  const idx = getLevelIndex(pts);
  return LEVELS[idx + 1] || null;
}

// --- Constants ---
const ENERGY_REGEN_PER_SEC = 3;
const AD_COOLDOWN_MS = 3 * 60 * 1000;
const AD_REWARD_HEARTS = 1000;
const AD_BOOST_DURATION_MS = 60 * 1000;
const AD_BOOST_MULTIPLIER = 2;
const COMBO_WINDOW_MS = 1500;
const SAVE_THROTTLE_MS = 5000;
const FIREBASE_TIMEOUT_MS = 6000;

// --- State ---
let score = 0;
let energy = 1000;
let maxEnergy = 1000;
let pointsPerTap = 1;
let comboCount = 0;
let lastTapTime = 0;
let tempMultiplier = 1;
let tempBoostExpiry = 0;
let lastAdWatchTime = 0;
let lastSaveTime = 0;
let saveTimer = null;
let isDataLoaded = false;
let tutorialKey = 'pwhy_tutorial_done';
let currentLevelId = null;

// --- Telegram Init ---
(function initTg() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try { tg.ready(); tg.expand(); } catch (e) {}
})();

// --- Adsgram ---
let AdController = null;
let adsgramReady = false;
window.initAdsgram = function() {
  if (typeof window.Adsgram === 'undefined') return false;
  try {
    AdController = window.Adsgram.init({ blockId: "0" });
    adsgramReady = true;
    console.log('✅ Adsgram ready');
    return true;
  } catch (e) {
    console.warn('⚠️ Adsgram init failed:', e);
    return false;
  }
};

// --- User ---
function getUserId() {
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (u && u.id) return 'pwhy_' + u.id;
  let guest = localStorage.getItem('pwhy_guest_id');
  if (!guest) {
    guest = 'GUEST_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('pwhy_guest_id', guest);
  }
  return guest;
}
function getUserName() {
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (u) return (u.first_name || '') + (u.last_name ? ' ' + u.last_name : '');
  return 'Player';
}

// --- Save ---
function scheduleSave() {
  if (saveTimer) return;
  const elapsed = Date.now() - lastSaveTime;
  const wait = Math.max(0, SAVE_THROTTLE_MS - elapsed);
  saveTimer = setTimeout(() => { saveTimer = null; saveToFirebase(); }, wait);
}

function saveToFirebase() {
  if (!isDataLoaded || !db) return;
  const userId = getUserId();
  if (!userId) return;
  lastSaveTime = Date.now();
  try { localStorage.setItem('pwhy_offline_score', score.toString()); } catch (e) {}
  db.ref('boomboom_players/' + userId).update({
    score, energy, maxEnergy, pointsPerTap,
    lastActive: Date.now()
  }).catch(e => console.warn('save failed:', e));
}

// --- Load ---
async function loadUserData() {
  const userId = getUserId();

  if (!db) {
    console.warn('⚠️ No Firebase — offline mode');
    const cached = parseInt(localStorage.getItem('pwhy_offline_score') || '0');
    if (cached > 0) score = cached;
    isDataLoaded = true;
    hideSplash(); updateUI(); startEnergyRegen(); maybeShowTutorial();
    return;
  }

  try {
    const snap = await Promise.race([
      db.ref('boomboom_players/' + userId).once('value'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), FIREBASE_TIMEOUT_MS))
    ]);
    const data = snap.val();
    if (data) {
      score = typeof data.score === 'number' ? data.score : 0;
      energy = typeof data.energy === 'number' ? data.energy : 1000;
      maxEnergy = typeof data.maxEnergy === 'number' ? data.maxEnergy : 1000;
      pointsPerTap = typeof data.pointsPerTap === 'number' ? data.pointsPerTap : 1;
      lastAdWatchTime = data.lastAdWatchTime || 0;
      console.log('✅ User data loaded:', data);
    } else {
      await db.ref('boomboom_players/' + userId).set({
        score: 0, energy: 1000, maxEnergy: 1000, pointsPerTap: 1,
        name: getUserName(), joinedAt: Date.now(), lastActive: Date.now(),
        adCount: 0, heartsPopped: 0
      });
      console.log('✅ New user created');
    }
    isDataLoaded = true;
    hideSplash(); updateUI(); startAdCooldownTicker(); startEnergyRegen(); maybeShowTutorial();
  } catch (e) {
    console.error('❌ loadUserData failed:', e);
    const cached = parseInt(localStorage.getItem('pwhy_offline_score') || '0');
    if (cached > 0) score = cached;
    isDataLoaded = true;
    hideSplash(); updateUI(); startEnergyRegen(); maybeShowTutorial();
  }
}

function hideSplash() {
  const s = document.getElementById('splash');
  if (s) s.classList.add('hide');
  setTimeout(() => s?.remove(), 500);
}

// --- UI ---
function updateUI() {
  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.textContent = score.toLocaleString();

  const energyEl = document.getElementById('energy');
  const maxEnergyEl = document.getElementById('max-energy');
  const fillEl = document.getElementById('energy-fill');
  if (energyEl) energyEl.textContent = Math.floor(energy);
  if (maxEnergyEl) maxEnergyEl.textContent = maxEnergy;
  if (fillEl) fillEl.style.width = ((energy / maxEnergy) * 100) + '%';

  const bar = document.getElementById('boosts-bar');
  if (bar) {
    const now = Date.now();
    let html = '';
    if (tempMultiplier > 1 && now < tempBoostExpiry) {
      const s = Math.ceil((tempBoostExpiry - now) / 1000);
      html += `<div class="boost-chip">🔥 ×${tempMultiplier} (${s}s)</div>`;
    }
    bar.innerHTML = html;
  }

  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (u) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    if (avatar) avatar.textContent = (u.first_name?.[0] || '💖').toUpperCase();
    if (name) name.textContent = getUserName();
  }

  updateLevelUI();
}

// --- Level UI ---
function updateLevelUI() {
  const lvl = getLevel(score);
  const idx = getLevelIndex(score);
  const next = getNextLevel(score);

  const root = document.documentElement;
  root.style.setProperty('--heart-color', lvl.color);
  root.style.setProperty('--heart-glow', lvl.glow);

  // قلب رئيسي
  const heartMain = document.getElementById('heart-main');
  if (heartMain) heartMain.textContent = lvl.emoji;

  // قلب في لوحة النقاط
  const scoreHeart = document.getElementById('score-heart');
  if (scoreHeart) scoreHeart.textContent = lvl.emoji;

  // اسم المستوى
  const levelNum = document.getElementById('user-level-num');
  if (levelNum) {
    levelNum.textContent = `${lvl.emoji} ${currentLang === 'ar' ? lvl.ar : lvl.en}`;
    levelNum.style.color = lvl.color;
  }

  // شريط التقدم
  const fill = document.getElementById('level-fill');
  const label = document.getElementById('level-label');
  if (fill && label) {
    if (next) {
      const range = next.min - lvl.min;
      const done = score - lvl.min;
      const pct = Math.min(100, (done / range) * 100);
      fill.style.width = pct + '%';
      fill.style.background = `linear-gradient(90deg, ${lvl.color}, ${next.color})`;
      label.textContent = `${Math.floor(done).toLocaleString()} / ${range.toLocaleString()}`;
    } else {
      fill.style.width = '100%';
      label.textContent = 'MAX 💎';
    }
  }

  // ترقية؟
  if (currentLevelId && currentLevelId !== lvl.id) {
    onLevelUp(lvl);
  }
  currentLevelId = lvl.id;
}

function onLevelUp(lvl) {
  console.log('🎉 Level Up:', lvl.id);
  if (SM.levelUp) SM.levelUp();

  document.body.style.transition = 'background 0.8s';
  document.body.style.background = `radial-gradient(circle at center, ${lvl.glow} 0%, #0f172a 70%)`;
  setTimeout(() => { document.body.style.background = '#0f172a'; }, 1200);

  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
  }

  const title = currentLang === 'ar' ? `🎉 ترقية: ${lvl.ar}` : `🎉 Level Up: ${lvl.en}`;
  const msg = currentLang === 'ar'
    ? `مضاعف نقاطك الآن ×${lvl.bonus}`
    : `Your score multiplier is now ×${lvl.bonus}`;
  showAlert(lvl.emoji, title, msg);
}

// --- Energy ---
function startEnergyRegen() {
  setInterval(() => {
    if (energy < maxEnergy) {
      energy = Math.min(maxEnergy, energy + ENERGY_REGEN_PER_SEC);
      updateUI();
    }
  }, 1000);
}

// --- Tap ---
function handleTap(x, y) {
  if (energy < pointsPerTap) { SM.click(); return; }

  const now = Date.now();
  if (now - lastTapTime < COMBO_WINDOW_MS) comboCount++;
  else comboCount = 1;
  lastTapTime = now;

  let comboMultiplier = 1;
  if (comboCount >= 20) comboMultiplier = 3;
  else if (comboCount >= 10) comboMultiplier = 2;
  else if (comboCount >= 5) comboMultiplier = 1.5;

  if (comboCount === 5 || comboCount === 10 || comboCount === 20) {
    SM.combo(comboCount);
    showCombo(comboCount, comboMultiplier);
  }

  let eff = comboMultiplier;
  if (tempMultiplier > 1 && now < tempBoostExpiry) eff *= tempMultiplier;

  const lvl = getLevel(score);
  const gain = Math.floor(pointsPerTap * eff * lvl.bonus);
  score += gain;
  energy -= pointsPerTap;

  SM.tap();
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }

  spawnFloatingHeart(x, y, '+' + gain);
  spawnBurstHearts(x, y);
  pulseHeart();
  updateUI();
  scheduleSave();
}

function pulseHeart() {
  const w = document.getElementById('heart-wrapper');
  if (!w) return;
  w.classList.add('pop');
  setTimeout(() => w.classList.remove('pop'), 200);
}

function spawnFloatingHeart(x, y, text) {
  const el = document.createElement('div');
  el.className = 'floating-heart';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function spawnBurstHearts(x, y) {
  const lvl = getLevel(score);
  const hearts = [lvl.emoji, '💕', '❤️', '💗', '💓'];
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'burst-heart';
    el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
    const dist = 40 + Math.random() * 40;
    el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

function showCombo(n, m) {
  const el = document.createElement('div');
  el.className = 'combo-indicator';
  el.textContent = '🔥 ' + n + 'x COMBO!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// --- Heart stage ---
(function initHeartStage() {
  const heartStage = document.getElementById('heart-stage');
  if (!heartStage) { console.error('❌ #heart-stage not found'); return; }
  let lastTouchTime = 0;
  heartStage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      lastTouchTime = Date.now();
      handleTap(e.clientX, e.clientY);
    } else if (e.pointerType === 'mouse') {
      if (Date.now() - lastTouchTime > 500) handleTap(e.clientX, e.clientY);
    }
  });
  console.log('✅ Heart stage ready');
})();

// --- Adsgram Ad ---
async function watchAd() {
  const now = Date.now();
  if (now - lastAdWatchTime < AD_COOLDOWN_MS) {
    const r = AD_COOLDOWN_MS - (now - lastAdWatchTime);
    const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
    showAlert('⏳', t('adWait'), `${m}:${s.toString().padStart(2,'0')} ${t('adBefore')}`);
    return;
  }

  const btn = document.getElementById('ad-btn');
  if (btn) btn.disabled = true;

  try {
    if (!adsgramReady || !AdController) {
      showAlert('⚠️', 'Ad', t('adNoAds'));
      return;
    }

    await AdController.show();

    lastAdWatchTime = Date.now();
    localStorage.setItem('pwhy_last_ad', lastAdWatchTime.toString());
    if (db) db.ref('boomboom_players/' + getUserId()).update({ lastAdWatchTime }).catch(() => {});

    // مكافأة الطاقة
    energy += AD_REWARD_HEARTS;

    // مكافأة النقاط بحسب المستوى
    const lvl = getLevel(score);
    const bonusCoins = Math.floor(500 * lvl.bonus);
    score += bonusCoins;

    // مضاعف
    tempMultiplier = AD_BOOST_MULTIPLIER;
    tempBoostExpiry = Date.now() + AD_BOOST_DURATION_MS;

    SM.gift();
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    const msg = currentLang === 'ar'
      ? `+${AD_REWARD_HEARTS} طاقة، +${bonusCoins} PWhy، مضاعف ×2`
      : `+${AD_REWARD_HEARTS} energy, +${bonusCoins} PWhy, ×2 boost`;
    showAlert('🎬', 'Success!', msg);
    updateUI();
    scheduleSave();
  } catch (e) {
    console.warn('ad error:', e);
    showAlert('⚠️', 'Ad', t('adError'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function startAdCooldownTicker() {
  const stored = parseInt(localStorage.getItem('pwhy_last_ad') || '0');
  if (stored && stored > lastAdWatchTime) lastAdWatchTime = stored;

  setInterval(() => {
    const cd = document.getElementById('ad-cooldown');
    const btn = document.getElementById('ad-btn');
    if (!cd || !btn) return;
    const now = Date.now();
    const r = AD_COOLDOWN_MS - (now - lastAdWatchTime);
    if (r > 0 && lastAdWatchTime > 0) {
      const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
      cd.style.display = 'block';
      cd.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      btn.disabled = true;
    } else {
      cd.style.display = 'none';
      btn.disabled = false;
    }
  }, 1000);
}

// --- Alerts ---
function showAlert(icon, title, message) {
  const iconEl = document.getElementById('alert-icon');
  const titleEl = document.getElementById('alert-title');
  const msgEl = document.getElementById('alert-message');
  const modal = document.getElementById('alert-modal');
  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (modal) modal.classList.add('active');
}
function closeAlert() {
  const modal = document.getElementById('alert-modal');
  if (modal) modal.classList.remove('active');
  SM.click();
}

// --- Tutorial ---
function maybeShowTutorial() {
  if (!localStorage.getItem(tutorialKey)) {
    setTimeout(() => {
      const m = document.getElementById('tut-modal');
      if (m) m.classList.add('active');
    }, 700);
  }
}
function closeTutorial() {
  localStorage.setItem(tutorialKey, '1');
  const m = document.getElementById('tut-modal');
  if (m) m.classList.remove('active');
  SM.click();
}

// --- Mute ---
function toggleMute() {
  const muted = SM.toggle();
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}
(function initMute() {
  const btn = document.getElementById('mute-btn');
  if (btn && SM.isMuted && SM.isMuted()) btn.textContent = '🔇';
})();

// --- Star Shop ---
function openStarShop() {
  const m = document.getElementById('star-shop-modal');
  if (m) m.classList.add('active');
}
function closeStarShop() {
  const m = document.getElementById('star-shop-modal');
  if (m) m.classList.remove('active');
  SM.click();
}

// --- Buy with Telegram Stars ---
async function buyWithStars(starsAmount, reward, title) {
  const tg = window.Telegram?.WebApp;

  if (!tg || !tg.openInvoice) {
    showAlert('⚠️', 'Stars', currentLang === 'ar'
      ? 'الدفع بالنجوم غير متاح هنا'
      : 'Telegram Stars not available here');
    return;
  }

  try {
    const res = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getUserId(),
        stars: starsAmount,
        reward: reward,
        title: title
      })
    });
    const data = await res.json();

    if (!data.ok || !data.invoiceLink) {
      showAlert('⚠️', 'Stars', data.error || 'Failed to create invoice');
      return;
    }

    tg.openInvoice(data.invoiceLink, (status) => {
      console.log('Invoice status:', status);
      if (status === 'paid') {
        SM.gift();
        score += reward;
        updateUI();
        scheduleSave();
        showAlert('⭐', 'Success!', currentLang === 'ar'
          ? `+${reward.toLocaleString()} PWhy`
          : `+${reward.toLocaleString()} PWhy`);
        closeStarShop();
      } else if (status === 'cancelled') {
        console.log('Payment cancelled');
      } else {
        showAlert('⚠️', 'Stars', 'Payment: ' + status);
      }
    });
  } catch (e) {
    console.error('buyWithStars error:', e);
    showAlert('⚠️', 'Stars', 'Network error');
  }
}

// --- Save on unload ---
window.addEventListener('beforeunload', saveToFirebase);
window.addEventListener('pagehide', saveToFirebase);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveToFirebase();
});

// --- Load ---
loadUserData();
