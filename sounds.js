/* ==========================================
   Sound Manager - Web Audio API (v2)
   PWhy BoomBoom
   ========================================== */
const SoundManager = (() => {
  let ctx = null;
  let muted = localStorage.getItem('pwhy_muted') === '1';
  let unlocked = false;

  function init() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('⚠️ Web Audio API not supported'); return; }
      ctx = new AC();
      console.log('🔊 AudioContext created, state =', ctx.state);
    } catch (e) {
      console.warn('⚠️ AudioContext failed:', e);
      ctx = null;
    }
  }

  // ✅ فتح الصوت على أول تفاعل من المستخدم (مهم جدًا للموبايل)
  function unlock() {
    if (unlocked) return;
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        unlocked = true;
        console.log('🔊 AudioContext unlocked');
      }).catch(e => console.warn('resume failed:', e));
    } else {
      unlocked = true;
    }
  }

  // ✅ ربط الفتح بأي تفاعل: لمس، نقر، ضغط مفتاح
  ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, unlock, { once: false, passive: true });
  });

  async function play(freq, duration = 0.1, type = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    init();
    if (!ctx) return;
    try {
      // ✅ انتظر استئناف السياق قبل التشغيل
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + duration);
    } catch (e) {
      console.warn('⚠️ play failed:', e);
    }
  }

  return {
    tap:     () => play(880, 0.06, 'sine', 0.08),
    bigTap:  () => { play(660, 0.08, 'triangle', 0.1); play(990, 0.1, 'triangle', 0.1, 0.04); },
    levelUp: () => [523, 659, 784, 1046].forEach((f, i) => play(f, 0.22, 'sine', 0.18, i * 0.1)),
    gift:    () => [784, 988, 1318].forEach((f, i) => play(f, 0.15, 'square', 0.1, i * 0.08)),
    powerup: () => { play(880, 0.15, 'sawtooth', 0.1); play(1320, 0.2, 'sawtooth', 0.1, 0.1); },
    click:   () => play(600, 0.04, 'square', 0.05),
    combo:   (n) => play(700 + n * 80, 0.12, 'triangle', 0.13),
    isMuted: () => muted,
    toggle:  () => {
      muted = !muted;
      localStorage.setItem('pwhy_muted', muted ? '1' : '0');
      if (!muted) { unlock(); play(880, 0.1, 'sine', 0.1); }
      return muted;
    },
    // للتشخيص
    _debug: () => ({ ctx: !!ctx, state: ctx?.state, muted, unlocked })
  };
})();

// ✅ اجعلها متاحة عالميًا
window.SoundManager = SoundManager;

// ✅ حماية صارمة: احذف أي حالة كتم قديمة بالخطأ
if (localStorage.getItem('pwhy_muted') === '1') {
  console.log('🔇 Sound is currently MUTED (stored in localStorage)');
}
