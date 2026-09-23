/* ==========================================
   Cloudflare Worker - PWhy BoomBoom Backend
   ========================================== */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // 1. التعامل مع طلبات Preflight (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // 2. مسار فحص الحالة (Health Check)
      if (url.pathname === '/' || url.pathname === '/api/health') {
        return jsonResponse({
          ok: true,
          status: 'online',
          hasToken: !!env.BOT_TOKEN,
          hasFirebase: !!env.FIREBASE_URL,
        });
      }

      // 3. مسار جلب قائمة المنتجات والمتجر
      if (url.pathname === '/api/products') {
        const products = getProductsList();
        return jsonResponse({ ok: true, products });
      }

      // 4. مسار جلب بيانات المستخدم وتدقيق التوثيق
      if (url.pathname === '/api/me' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (!body.initData) {
          return jsonResponse({ ok: false, error: 'Missing initData' }, 400);
        }
        
        const user = parseInitDataUser(body.initData);
        if (!user) {
          return jsonResponse({ ok: false, error: 'Invalid user data' }, 401);
        }

        // جلب بيانات اللاعب من Firebase إذا كان معرّفاً
        let userData = { credits: 0, purchases: [] };
        if (env.FIREBASE_URL) {
          try {
            const fbRes = await fetch(`${env.FIREBASE_URL}/users/${user.id}.json`);
            const fbData = await fbRes.json();
            if (fbData) userData = fbData;
          } catch (e) {
            /* التغاضي عن الخطأ والعودة بالبيانات الافتراضية */
          }
        }

        return jsonResponse({
          ok: true,
          user: user,
          data: userData
        });
      }

      // 5. مسار إنشاء رابط فاتورة نجوم تليجرام (Telegram Stars Invoice)
      if (url.pathname === '/api/create-invoice' && request.method === 'POST') {
        if (!env.BOT_TOKEN) {
          return jsonResponse({ ok: false, error: 'Bot token configuration is missing' }, 500);
        }

        const body = await request.json().catch(() => ({}));
        const { productId, initData, lang } = body;

        const product = getProductsList().find(p => p.id === productId);
        if (!product) {
          return jsonResponse({ ok: false, error: 'Product not found' }, 404);
        }

        const user = parseInitDataUser(initData);
        const userLang = lang || 'ar';
        const title = product.title?.[userLang] || product.title?.ar || product.title?.en || product.id;
        const description = product.desc?.[userLang] || product.desc?.ar || product.desc?.en || 'PWhy BoomBoom Purchase';

        // طلب إنشاء رابط الفاتورة من Telegram Bot API
        const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            description: description,
            payload: JSON.stringify({ productId, userId: user?.id || 0, at: Date.now() }),
            provider_token: "", // فارغ حصراً لعملة النجوم (Stars)
            currency: "XTR",   // رمز عملة Telegram Stars
            prices: [{ label: title, amount: product.price }]
          })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
          return jsonResponse({ ok: false, error: tgData.description || 'Failed from Telegram API' }, 400);
        }

        return jsonResponse({ ok: true, url: tgData.result });
      }

      // 6. مسار استقبال الـ Webhook الخاص بـ Telegram
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const update = await request.json().catch(() => ({}));

        // أ) الموافقة التلقائية على طلب الفحص المسبق (pre_checkout_query)
        if (update.pre_checkout_query) {
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pre_checkout_query_id: update.pre_checkout_query.id,
              ok: true
            })
          });
          return jsonResponse({ ok: true });
        }

        // ب) معالجة نجاح عملية الدفع (successful_payment)
        if (update.message?.successful_payment) {
          const payment = update.message.successful_payment;
          const payload = JSON.parse(payment.invoice_payload || '{}');
          const userId = payload.userId || update.message.from?.id;
          const productId = payload.productId;

          // حفظ المشتريات وإضافة النقاط للمستخدم في Firebase
          if (env.FIREBASE_URL && userId && productId) {
            const product = getProductsList().find(p => p.id === productId);
            const rewardBooms = product?.id === 'stars_10' ? 10000 : 0;

            await fetch(`${env.FIREBASE_URL}/users/${userId}/purchases.json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId,
                telegramPaymentChargeId: payment.telegram_payment_charge_id,
                totalAmount: payment.total_amount,
                date: new Date().toISOString()
              })
            });

            if (rewardBooms > 0) {
              // إضافة الرصيد لحساب اللاعب
              await fetch(`${env.FIREBASE_URL}/users/${userId}/credits.json`, {
                method: 'PUT',
                body: JSON.stringify(rewardBooms)
              });
            }
          }

          return jsonResponse({ ok: true, received: true });
        }

        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, error: 'Route not found' }, 404);

    } catch (err) {
      return jsonResponse({ ok: false, error: err.message }, 500);
    }
  }
};

// ==================== HELPER FUNCTIONS ====================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders
    }
  });
}

function parseInitDataUser(initDataStr) {
  try {
    const params = new URLSearchParams(initDataStr);
    const userStr = params.get('user');
    if (!userStr) return null;
    const u = JSON.parse(userStr);
    return {
      id: u.id,
      firstName: u.first_name || 'Player',
      username: u.username || '',
      languageCode: u.language_code || 'en'
    };
  } catch (e) {
    return null;
  }
}

function getProductsList() {
  return [
    {
      id: 'stars_10',
      price: 10,
      title: { ar: '⚡ شحنة 10,000 فورية', en: '⚡ Instant 10k Energy' },
      desc: { ar: 'احصل على 10,000 نقطة فوراً', en: 'Get 10,000 points instantly' }
    },
    {
      id: 'multitap_boost',
      price: 50,
      title: { ar: '🚀 قوة نقر مضاعفة (+5)', en: '🚀 Multitap Boost (+5)' },
      desc: { ar: 'زيادة دائمة لقوة الضغطة', en: 'Permanent click power boost' }
    },
    {
      id: 'vip_pass',
      price: 100,
      title: { ar: '👑 اشتراك VIP شهري', en: '👑 Monthly VIP Pass' },
      desc: { ar: 'مكافآت يومية مضاعفة', en: 'Double daily rewards' }
    }
  ];
}
