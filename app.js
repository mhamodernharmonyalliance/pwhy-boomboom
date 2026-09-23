// التهيئة عند فتح التطبيق من تليجرام
document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram?.WebApp;

    // توسيع نافذة التطبيق داخل تليجرام
    if (tg) {
        tg.ready();
        tg.expand();
    }

    // جلب بيانات المستخدم من تليجرام
    const user = tg?.initDataUnsafe?.user;
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');

    if (user) {
        const name = user.first_name || 'لاعب';
        userNameEl.textContent = name;
        userAvatarEl.textContent = name[0].toUpperCase();
    } else {
        userNameEl.textContent = 'زائر';
    }

    // إدارة النقاط والضغطات
    let score = parseInt(localStorage.getItem('boomboom_simple_score')) || 0;
    const scoreEl = document.getElementById('score');
    const scoreHeaderEl = document.getElementById('score-header');
    const boomBtn = document.getElementById('boom-btn');

    function updateScoreDisplay() {
        scoreEl.textContent = score.toLocaleString();
        scoreHeaderEl.textContent = score.toLocaleString();
        localStorage.setItem('boomboom_simple_score', score);
    }

    updateScoreDisplay();

    // حدث النقر على القنبلة
    boomBtn.addEventListener('click', (e) => {
        score += 1;
        updateScoreDisplay();

        // اهتزاز خفيف للهاتف إن وجد
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }

        // تأثير رقم متطاير بسيط
        createFloatingNumber(e.clientX, e.clientY);
    });

    function createFloatingNumber(x, y) {
        const num = document.createElement('div');
        num.className = 'absolute text-amber-400 font-black text-2xl pointer-events-none animate-bounce';
        num.textContent = '+1';
        num.style.left = `${x - 10}px`;
        num.style.top = `${y - 30}px`;
        document.body.appendChild(num);

        setTimeout(() => num.remove(), 600);
    }
});
