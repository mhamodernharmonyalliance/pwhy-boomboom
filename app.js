/* ==========================================
   PWhy BoomBoom - Game Logic (v3 - Final)
   Firebase + Adsgram + Hearts
   ========================================== */

// --- Safe SoundManager fallback ---
const SM = window.SoundManager || {
  tap: () => {}, click: () => {}, combo: () => {}, gift: () => {},
  levelUp: () => {}, powerup: () => {}, bigTap: () => {},
  isMuted: () => false, toggle: () => false
};

// --- Firebase Config (Project: pwhy-boomboom) ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGk5Ufb-tVkxxfTcyqDKLiewik-DcH8o",
  authDomain: "pwhy-boomboom.firebaseapp.com",
  databaseURL: "https://pwhy-boomboom-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pwhy-boomboom",
  storageBucket: "pwhy-boomboom.firebasestorage.app",
  messagingSenderId: "107228338807",
  appId: "1:107228338807:web:f01becdb45cac930fda532"
};

// --- Firebase Init (Protected) ---
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

// --- Telegram Init ---
(function initTg() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch (e) {}
})();

// --- Adsgram (called from index.html after script loads) ---
let AdController = null;
let adsgramReady = false;
window.initAdsgram = function() {
  if (typeof window.Adsgram === 'undefined') return false;
  try {
    // ⚠️ ضع Block ID الخاص بـ Adsgram لمشروع PWhy
    AdController = window.Adsgram.init({ blockId: "49527" });
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

// --- Save (Throttled) ---
function scheduleSave() {
  if (saveTimer) return;
  const elapsed = Date.now() - lastSaveTime;
  const wait = Math.max(0, SAVE_THROTTLE_MS - elapsed);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToFirebase();
  }, wait);
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

  // Offline fallback if Firebase is not available
  if (!db) {
    console.warn('⚠️ No Firebase — running in offline mode');
    const cached = parseInt(localStorage.getItem('pwhy_offline_score') || '0');
    if (cached > 0) score = cached;
    isDataLoaded = true;
    hideSplash();
    updateUI();
    startEnergyRegen();
    maybeShowTutorial();
    return;
  }

  try {
    const snap = await Promise.race([
      db.ref('boomboom_players/' + userId).once('value'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase timeout')), FIREBASE_TIMEOUT_MS)
      )
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
    hideSplash();
    updateUI();
    startAdCooldownTicker();
    startEnergyRegen();
    maybeShowTutorial();
  } catch (e) {
    console.error('❌ loadUserData failed:', e);
    const cached = parseInt(localStorage.getItem('pwhy_offline_score') || '0');
    if (cached > 0) score = cached;
    isDataLoaded = true;
    hideSplash();
    updateUI();
    startEnergyRegen();
    maybeShowTutorial();
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
}

// --- Energy Regen ---
function startEnergyRegen() {
  setInterval(() => {
    if (energy < maxEnergy) {
      energy = Math.min(maxEnergy, energy + ENERGY_REGEN_PER_SEC);
      updateUI();
    }
  }, 1000);
}

// --- Tap Handler ---
function handleTap(x, y) {
  console.log('👆 Tap at', x, y, 'energy=', energy);

  if (energy < pointsPerTap) {
    SM.click();
    return;
  }

  const now = Date.now();
  if (now - lastTapTime < COMBO_WINDOW_MS) {
    comboCount++;
  } else {
    comboCount = 1;
  }
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

  const gain = Math.floor(pointsPerTap * eff);
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
  const hearts = ['💖', '💕', '❤️', '💗', '💓'];
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

// --- Heart stage events (pointerdown only) ---
(function initHeartStage() {
  const heartStage = document.getElementById('heart-stage');
  if (!heartStage) {
    console.error('❌ #heart-stage not found');
    return;
  }
  let lastTouchTime = 0;
  heartStage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      lastTouchTime = Date.now();
      handleTap(e.clientX, e.clientY);
    } else if (e.pointerType === 'mouse') {
      // تجاهل نقر الماوس المزدوج بعد لمسة على الأجهزة الهجينة
      if (Date.now() - lastTouchTime > 500) {
        handleTap(e.clientX, e.clientY);
      }
    }
  });
  console.log('✅ Heart stage ready');
})();

// --- Adsgram Ad ---
async function watchAd() {
  console.log('🎬 watchAd called', { adsgramReady, AdController: !!AdController });

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
    if (db) {
      db.ref('boomboom_players/' + getUserId()).update({ lastAdWatchTime }).catch(() => {});
    }

    energy += AD_REWARD_HEARTS;
    tempMultiplier = AD_BOOST_MULTIPLIER;
    tempBoostExpiry = Date.now() + AD_BOOST_DURATION_MS;

    SM.gift();
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    showAlert('💖', 'Success!', t('adBoost'));
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

// --- Init mute state ---
(function initMute() {
  const btn = document.getElementById('mute-btn');
  if (btn && SM.isMuted && SM.isMuted()) btn.textContent = '🔇';
})();

// --- Save on unload ---
window.addEventListener('beforeunload', saveToFirebase);
window.addEventListener('pagehide', saveToFirebase);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveToFirebase();
});

// --- Load (single call) ---
loadUserData();
