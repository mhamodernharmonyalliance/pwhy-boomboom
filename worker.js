/* ==========================================
   Telegram Stars Template - Backend
   Cloudflare Worker
   ========================================== */

import { PRODUCTS, getProductsList } from './products.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // ==================== ROUTES ====================
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }
    if (url.pathname === '/api/create-invoice' && request.method === 'POST') {
      return handleCreateInvoice(request, env);
    }
    if (url.pathname === '/api/products' && request.method === 'GET') {
      return jsonResponse({ products: getProductsList() });
    }
    if (url.pathname === '/api/me' && request.method === 'POST') {
      return handleGetMe(request, env);
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ 
        ok: true, 
        hasToken: !!env.BOT_TOKEN,
        hasFirebase: !!(env.FIREBASE_URL || env.FIREBASE)
      });
    }

    // Static assets
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return fetch(request);
  }
};

// ==================== HELPERS ====================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() }
  });
}

function getFirebaseUrl(env) {
  return env.FIREBASE_URL || env.FIREBASE || 'https://pwhy.mhaapp.workers.dev';
}

// ==================== AUTH ====================
async function validateInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw', enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secret = await crypto.subtle.sign('HMAC', secretKey, enc.encode(botToken));

    const hmacKey = await crypto.subtle.importKey(
      'raw', secret,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');

    if (hex !== hash) return null;
    return JSON.parse(params.get('user') || 'null');
  } catch (e) { return null; }
}

// ==================== GET ME ====================
async function handleGetMe(request, env) {
  try {
    const { initData } = await request.json();
    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user) return jsonResponse({ error: 'Auth failed' }, 401);

    const firebaseBase = getFirebaseUrl(env);

    // Load user data
    const data = await fetch(`${firebaseBase}/users/${user.id}.json`)
      .then(r => r.json()).catch(() => null);

    return jsonResponse({
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name || '',
        username: user.username || '',
        languageCode: user.language_code || 'en'
      },
      data: data || {
        credits: 0,
        purchases: [],
        subscription: null
      }
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ==================== CREATE INVOICE ====================
async function handleCreateInvoice(request, env) {
  try {
    const { productId, initData, lang } = await request.json();

    if (!productId || !initData) {
      return jsonResponse({ error: 'Missing data' }, 400);
    }

    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user || !user.id) return jsonResponse({ error: 'Auth failed' }, 401);

    const product = PRODUCTS[productId];
    if (!product) return jsonResponse({ error: 'Unknown product' }, 404);

    const L = (lang === 'ar') ? 'ar' : 'en';
    const title = product.title[L] || product.title.en;
    const desc = product.desc[L] || product.desc.en;

    const res = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: desc,
          payload: JSON.stringify({ productId, userId: String(user.id) }),
          currency: 'XTR',
          prices: [{ label: title, amount: product.price }]
        })
      }
    );

    const data = await res.json();
    if (!data.ok) {
      console.error('createInvoiceLink error:', data);
      return jsonResponse({ error: data.description || 'Failed' }, 500);
    }

    return jsonResponse({ url: data.result });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ==================== WEBHOOK ====================
async function handleWebhook(request, env) {
  try {
    const update = await request.json();

    // Pre-checkout (إجباري للموافقة على عملية الشراء قبل خصم النجوم)
    if (update.pre_checkout_query) {
      await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/answerPreCheckoutQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true
          })
        }
      );
      return new Response('OK');
    }

    // Successful payment
    if (update.message?.successful_payment) {
      const p = update.message.successful_payment;
      let payload = {};
      try { payload = JSON.parse(p.invoice_payload); } catch (e) {}

      const product = PRODUCTS[payload.productId];
      const userId = payload.userId || String(update.message.from.id);

      if (product) {
        await applyPurchase(env, userId, payload.productId, product);

        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: update.message.chat.id,
              text: `✅ شكراً لك!\n🎁 تم تفعيل: ${product.title.ar || product.title.en}\nتمت إضافة الميزات إلى حسابك بنجاح.`
            })
          }
        );
      }
    }

    return new Response('OK');
  } catch (e) {
    console.error('webhook error:', e);
    return new Response('OK');
  }
}

// ==================== APPLY PURCHASE ====================
async function applyPurchase(env, userId, productId, product) {
  const firebaseBase = getFirebaseUrl(env);
  const base = `${firebaseBase}/users/${userId}`;
  const now = Date.now();

  // 1. Load current user data
  const userData = await fetch(`${base}.json`).then(r => r.json()).catch(() => null) || {};
  const purchases = userData.purchases || [];
  const credits = typeof userData.credits === 'number' ? userData.credits : 0;

  // 2. Build update based on type
  const update = {
    lastActive: now,
    purchases: [...purchases, {
      productId,
      type: product.type,
      price: product.price,
      at: now
    }].slice(-100)
  };

  if (product.type === 'credits') {
    update.credits = credits + product.amount;
  } else if (product.type === 'subscription') {
    const currentExpiry = userData.subscription?.expiry || now;
    const baseTime = Math.max(currentExpiry, now);
    update.subscription = {
      active: true,
      expiry: baseTime + (product.durationDays * 24 * 60 * 60 * 1000),
      startedAt: now
    };
  } else if (product.type === 'unlock') {
    const unlocks = userData.unlocks || [];
    if (!unlocks.includes(product.featureId)) {
      unlocks.push(product.featureId);
    }
    update.unlocks = unlocks;
  } else if (product.type === 'cosmetic') {
    const cosmetics = userData.cosmetics || [];
    cosmetics.push({ productId, at: now });
    update.cosmetics = cosmetics;
  }

  // 3. Save to Firebase User
  await fetch(`${base}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });

  // 4. Log purchase globally
  await fetch(`${firebaseBase}/purchases.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      productId,
      type: product.type,
      price: product.price,
      at: now
    })
  });
}
