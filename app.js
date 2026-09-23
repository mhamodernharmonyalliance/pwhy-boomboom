import { soundManager } from './sounds.js';
import i18n from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. تهيئة تطبيق تليجرام
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }

    // 2. حالة التطبيق (State)
    const state = {
        score: parseInt(localStorage.getItem('boomboom_simple_score')) || 0,
        clickPower: 1,
        soundMuted: localStorage.getItem('sound_muted') === 'true'
    };

    // 3. جلب عناصر الـ DOM
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const scoreEl = document.getElementById('score');
    const scoreHeaderEl = document.getElementById('score-header');
    const boomBtn = document.getElementById('boom-btn');
    const langBtn = document.getElementById('lang-btn');
    const soundBtn = document.getElementById('sound-btn');

    // 4. تهيئة بيانات المستخدم من تليجرام
    const user = tg?.initDataUnsafe?.user;
    if (user) {
        const name = user.first_name || 'لاعب';
        userNameEl.textContent = name;
        userAvatarEl.textContent = name.charAt(0).toUpperCase();
    } else {
        userNameEl.setAttribute('data-i18n', 'guest');
        userNameEl.textContent = i18n.t('guest');
    }

    // 5. تحديث واجهة النقاط
    function updateScoreDisplay() {
        const formattedScore = state.score.toLocaleString();
        if (scoreEl) scoreEl.textContent = formattedScore;
        if (scoreHeaderEl) scoreHeaderEl.textContent = formattedScore;
        localStorage.setItem('boomboom_simple_score', state.score.toString());
    }

    // 6. إنشاء النص المتطاير (+1)
    function createFloatingNumber(x, y) {
        const num = document.createElement('div');
        num.className = 'absolute text-amber-400 font-black text-2xl pointer-events-none select-none transition-all duration-500 ease-out z-50';
        num.textContent = `+${state.clickPower}`;
        num.style.left = `${x - 12}px`;
        num.style.top = `${y - 20}px`;
        document.body.appendChild(num);

        // تحريك الرقم للأعلى ثم إخفائه
        requestAnimationFrame(() => {
            num.style.transform = 'translateY(-40px)';
            num.style.opacity = '0';
        });

        setTimeout(() => num.remove(), 500);
    }

    // 7. حدث الضغط على زر القنبلة الرئيسي
    if (boomBtn) {
        boomBtn.addEventListener('click', (e) => {
            state.score += state.clickPower;
            updateScoreDisplay();

            // تشغيل الصوت والاهتزاز
            soundManager.play('tap');

            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }

            // تحديد موقع الضغطة للتأثير المتطاير
            const rect = boomBtn.getBoundingClientRect();
            const x = e.clientX || (rect.left + rect.width / 2);
            const y = e.clientY || (rect.top + rect.height / 2);

            createFloatingNumber(x, y);
        });
    }

    // 8. التحكم في الصوت
    function updateSoundUI() {
        if (soundBtn) {
            const soundLabel = soundBtn.querySelector('[data-i18n]');
            if (soundLabel) {
                soundLabel.textContent = i18n.t('soundLabel');
            }
            soundBtn.style.opacity = soundManager.isMuted ? '0.5' : '1';
        }
    }

    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            const isMuted = soundManager.toggleMute();
            updateSoundUI();
        });
    }

    // 9. التحكم في اللغة
    if (langBtn) {
        langBtn.textContent = i18n.currentLang === 'ar' ? 'English' : 'عربي';

        langBtn.addEventListener('click', () => {
            const nextLang = i18n.currentLang === 'ar' ? 'en' : 'ar';
            i18n.setLanguage(nextLang);
            langBtn.textContent = nextLang === 'ar' ? 'English' : 'عربي';
            updateSoundUI();
        });
    }

    // 10. التشغيل الابتدائي
    updateScoreDisplay();
    updateSoundUI();
});
