/* ==========================================
   Sound Manager - Web Audio API
   PWhy BoomBoom
   ========================================== */
const SoundManager = (() => {
  let ctx = null;
  let muted = localStorage.getItem('pwhy_muted') === '1';

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('⚠️ AudioContext failed:', e);
      ctx = null;
    }
  }

  function play(freq, duration = 0.1, type = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    init();
    if (!ctx) return;
    try {
      // المتصفحات توقف AudioContext حتى أول تفاعل من المستخدم
      if (ctx.state === 'suspended') ctx.resume();

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
      if (!muted) play(880, 0.1, 'sine', 0.1);
      return muted;
    }
  };
})();

// ✅ اجعلها متاحة عالميًا (بدون هذا السطر، app.js لن يجدها)
window.SoundManager = SoundManager;
