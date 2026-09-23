/* ==========================================
   Sounds — Web Audio API
   بدون ملفات خارجية، كله مولّد برمجيًا
   ========================================== */

let ctx = null;
let enabled = true;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * نغمة بسيطة
 * @param {number} freq - التردد (Hz)
 * @param {number} duration - المدة (ثواني)
 * @param {string} type - sine | square | triangle | sawtooth
 * @param {number} volume - 0 → 1
 */
function tone(freq, duration = 0.08, type = 'sine', volume = 0.15) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) { /* ignore */ }
}

/**
 * نغمة بتتغير (سلايد)
 */
function slide(freqStart, freqEnd, duration = 0.2, type = 'sine', volume = 0.15) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) { /* ignore */ }
}

// ==================== SOUNDS ====================
export const sounds = {
  // ضغطة على الموبايل — "طق" قصير
  tap() {
    tone(880, 0.04, 'square', 0.08);
  },

  // استلام — "دقة" معدنية (نغمتين)
  claim() {
    tone(660, 0.06, 'sine', 0.15);
    setTimeout(() => tone(990, 0.08, 'sine', 0.15), 50);
  },

  // ترقية مستوى — "whoosh" صاعد
  upgrade() {
    slide(300, 900, 0.35, 'triangle', 0.2);
    setTimeout(() => tone(1200, 0.15, 'sine', 0.15), 250);
  },

  // مورد نفسي (بنج/صبر/مؤامرة) — همسة
  resource() {
    tone(440, 0.1, 'sine', 0.12);
    setTimeout(() => tone(550, 0.12, 'sine', 0.10), 80);
  },

  // خطأ — نغمة هابطة
  error() {
    slide(400, 200, 0.25, 'square', 0.15);
  },

  // مكافأة حضور يومي — ثلاث نغمات صاعدة
  daily() {
    tone(523, 0.1, 'sine', 0.15);
    setTimeout(() => tone(659, 0.1, 'sine', 0.15), 100);
    setTimeout(() => tone(784, 0.15, 'sine', 0.15), 200);
  },

  // فتح تبويب — نقرة خفيفة
  nav() {
    tone(600, 0.03, 'sine', 0.08);
  },

  // مزاج سيئ (stressed)
  stress() {
    tone(220, 0.15, 'sawtooth', 0.08);
  },

  // بنج — تخدير
  sedate() {
    slide(500, 200, 0.5, 'sine', 0.1);
  },

  // إعلان اكتمل
  adReward() {
    tone(700, 0.08, 'sine', 0.15);
    setTimeout(() => tone(1000, 0.12, 'sine', 0.15), 80);
  },

  toggle() {
    enabled = !enabled;
    if (enabled) tone(880, 0.08, 'sine', 0.12);
    return enabled;
  },

  isEnabled() { return enabled; },
};

// فعّل السياق عند أول تفاعل
export function unlockAudio() {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { /* ignore */ }
}

document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });
