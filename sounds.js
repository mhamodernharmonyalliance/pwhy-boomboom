/* ==========================================
   PWhy — Web Audio API Sound Synthesizer
   مؤثرات صوتية مدمجة بدون ملفات خارجية
   ========================================== */

let ctx = null;
let enabled = true;

/**
 * الحصول على Web Audio Context وتفعيل الصوت
 */
function getCtx() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

/**
 * إنشاء نغمة بسيطة
 */
function tone(freq, duration = 0.08, type = 'sine', volume = 0.15) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);

    // منع صوت الـ Pop/Click عند بداية الصوت
    gain.gain.setValueAtTime(0.001, ac.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) {
    /* تجنب توقف اللعبة في حال انسداد الصوت */
  }
}

/**
 * إنشاء نغمة متغيرة Frequency (Slide/Sweep)
 */
function slide(freqStart, freqEnd, duration = 0.2, type = 'sine', volume = 0.15) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), ac.currentTime + duration);

    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) {}
}

// ==================== SOUND EFFECTS ====================
export const sounds = {
  // نقرة الضغط على القنبلة
  tap() {
    tone(880, 0.04, 'square', 0.08);
  },

  // صوت انفجار خفيف عند التدمير/الكبس
  boom() {
    slide(200, 40, 0.25, 'sawtooth', 0.2);
  },

  // استلام الأرباح/المكافآت
  claim() {
    tone(660, 0.06, 'sine', 0.15);
    setTimeout(() => tone(990, 0.08, 'sine', 0.15), 50);
  },

  // ترقية الأسلحة/المستوى
  upgrade() {
    slide(300, 900, 0.35, 'triangle', 0.2);
    setTimeout(() => tone(1200, 0.15, 'sine', 0.15), 250);
  },

  // خطأ / رصيد غير كافي
  error() {
    slide(400, 150, 0.25, 'sawtooth', 0.15);
  },

  // المكافأة اليومية
  daily() {
    tone(523, 0.1, 'sine', 0.15);
    setTimeout(() => tone(659, 0.1, 'sine', 0.15), 100);
    setTimeout(() => tone(784, 0.15, 'sine', 0.15), 200);
  },

  // التنقل بين القوائم (Navigation)
  nav() {
    tone(600, 0.03, 'sine', 0.08);
  },

  // الشراء من المتجر
  buy() {
    tone(1000, 0.05, 'sine', 0.12);
    setTimeout(() => tone(1500, 0.08, 'sine', 0.12), 60);
  },

  // تفعيل/إيقاف الصوت
  toggle() {
    enabled = !enabled;
    if (enabled) tone(880, 0.08, 'sine', 0.12);
    return enabled;
  },

  isEnabled() {
    return enabled;
  }
};

// ==================== Unlock Audio Context ====================
export function unlockAudio() {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') {
      ac.resume();
    }
  } catch (e) {}
}

// تفعيل الصوت تلقائياً مع أول لمسة للمستخدم
if (typeof window !== 'undefined') {
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });
}

export default sounds;
