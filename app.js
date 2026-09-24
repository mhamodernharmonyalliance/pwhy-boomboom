/* ==========================================
   PWhy BoomBoom - Game Logic
   Firebase + Adsgram + Hearts
   ========================================== */

// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBJTd25x7MKfcQVzAH7ZNNaAwUjXs_-CoI",
  authDomain: "mhaexplorer-ac7a7.firebaseapp.com",
  databaseURL: "https://mhaexplorer-ac7a7-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mhaexplorer-ac7a7",
  storageBucket: "mhaexplorer-ac7a7.appspot.com",
  messagingSenderId: "692744600959",
  appId: "1:692744600959:web:7feb3b2f9f24c21fe22e4a"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Constants ---
const ENERGY_REGEN_PER_SEC = 3;
const AD_COOLDOWN_MS = 3 * 60 * 1000;
const AD_REWARD_HEARTS = 1000;
const AD_BOOST_DURATION_MS = 60 * 1000;
const AD_BOOST_MULTIPLIER = 2;
const COMBO_WINDOW_MS = 1500;
const SAVE_THROTTLE_MS = 5000;

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

// --- Adsgram ---
let AdController = null;
let adsgramReady = false;
function initAdsgram() {
  if (typeof window.Adsgram === 'undefined') return false;
  try {
    // ⚠️ ضع Block ID الخاص بـ Adsgram لمشروع PWhy
    AdController = window.Adsgram.init({ blockId: "49527" });
    adsgramReady = true;
    return true;
  } catch (e) { return false; }
}
setTimeout(initAdsgram, 2000);

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
  if (!isDataLoaded) return;
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
  try {
    const snap = await db.ref('boomboom_players/' + userId).once('value');
    const data = snap.val();
    if (data) {
      score = typeof data.score === 'number' ? data.score : 0;
      energy = typeof data.energy === 'number' ? data.energy : 1000;
      maxEnergy = typeof data.maxEnergy === 'number' ? data.maxEnergy : 1000;
      pointsPerTap = typeof data.pointsPerTap === 'number' ? data.pointsPerTap : 1;
      lastAdWatchTime = data.lastAdWatchTime || 0;
    } else {
      // New user
      await db.ref('boomboom_players/' + userId).set({
        score: 0, energy: 1000, maxEnergy: 1000, pointsPerTap: 1,
        name: getUserName(), joinedAt: Date.now(), lastActive: Date.now(),
        adCount: 0, heartsPopped: 0
      });
    }
    isDataLoaded = true;
    hideSplash();
    updateUI();
    startAdCooldownTicker();
    startEnergyRegen();
    maybeShowTutorial();
  } catch (e) {
    console.error(e);
    const cached = parseInt(localStorage.getItem('pwhy_offline_score') || '0');
    if (cached > 0) score = cached;
    isDataLoaded = true;
    hideSplash();
    updateUI();
    startEnergyRegen();
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

  // Boosts
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

  // User avatar
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
  if (energy < pointsPerTap) {
    SoundManager.click();
    return;
  }

  const now = Date.now();
  if (now - lastTapTime < COMBO_WINDOW_MS) {
    comboCount++;
  } else {
    comboCount = 1;
  }
  lastTapTime = now;

  // Combo bonuses
  let comboMultiplier = 1;
  if (comboCount >= 20) comboMultiplier = 3;
  else if (comboCount >= 10) comboMultiplier = 2;
  else if (comboCount >= 5) comboMultiplier = 1.5;

  if (comboCount === 5 || comboCount === 10 || comboCount === 20) {
    SoundManager.combo(comboCount);
    showCombo(comboCount, comboMultiplier);
  }

  // Effective multiplier (ads + combo)
  let eff = comboMultiplier;
  if (tempMultiplier > 1 && now < tempBoostExpiry) eff *= tempMultiplier;

  const gain = Math.floor(pointsPerTap * eff);
  score += gain;
  energy -= pointsPerTap;

  SoundManager.tap();
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }

  // Visual effects
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

// --- Heart stage events ---
const heartStage = document.getElementById('heart-stage');
if (heartStage) {
  heartStage.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
      handleTap(e.touches[i].clientX, e.touches[i].clientY);
    }
  }, { passive: false });

  heartStage.addEventListener('click', (e) => {
    handleTap(e.clientX, e.clientY);
  });
}

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

    // Success
    lastAdWatchTime = Date.now();
    localStorage.setItem('pwhy_last_ad', lastAdWatchTime.toString());
    db.ref('boomboom_players/' + getUserId()).update({ lastAdWatchTime });

    energy += AD_REWARD_HEARTS;
    tempMultiplier = AD_BOOST_MULTIPLIER;
    tempBoostExpiry = Date.now() + AD_BOOST_DURATION_MS;

    SoundManager.gift();
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
  document.getElementById('alert-icon').textContent = icon;
  document.getElementById('alert-title').textContent = title;
  document.getElementById('alert-message').textContent = message;
  document.getElementById('alert-modal').classList.add('active');
}
function closeAlert() {
  document.getElementById('alert-modal').classList.remove('active');
  SoundManager.click();
}

// --- Tutorial ---
function maybeShowTutorial() {
  if (!localStorage.getItem(tutorialKey)) {
    setTimeout(() => document.getElementById('tut-modal').classList.add('active'), 700);
  }
}
function closeTutorial() {
  localStorage.setItem(tutorialKey, '1');
  document.getElementById('tut-modal').classList.remove('active');
  SoundManager.click();
}

// --- Mute ---
function toggleMute() {
  const muted = SoundManager.toggle();
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}

// --- Init mute state ---
(function initMute() {
  const btn = document.getElementById('mute-btn');
  if (btn && SoundManager.isMuted()) btn.textContent = '🔇';
})();

// --- Save on unload ---
window.addEventListener('beforeunload', saveToFirebase);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveToFirebase();
});

// --- Load ---
loadUserData();
// --- Load ---
loadUserData();

// ⏰ مؤقت أمان: اخفِ splash بعد 6 ثوان بغض النظر عن Firebase
setTimeout(() => {
  const s = document.getElementById('splash');
  if (s && !s.classList.contains('hide')) {
    console.warn('⚠️ Splash timeout — forcing hide (Firebase may have failed)');
    s.classList.add('hide');
    setTimeout(() => s?.remove(), 500);
  }
}, 6000);

// 🔒 عند الخروج من اللعبة، احفظ
window.addEventListener('pagehide', saveToFirebase);
