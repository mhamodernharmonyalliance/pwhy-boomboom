/* ==========================================
   Boom Boom — P Why
   Cloudflare Worker
   ========================================== */

import { getProductsList, getLevel } from './products.js';
import { CONFIG } from './config.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    // Game API
    if (url.pathname === '/api/me'              && request.method === 'POST') return handleGetMe(request, env);
    if (url.pathname === '/api/products'        && request.method === 'GET')  return jsonResponse({ products: getProductsList() });
    if (url.pathname === '/api/create-invoice'  && request.method === 'POST') return handleCreateInvoice(request, env);
    if (url.pathname === '/api/game/state'      && request.method === 'POST') return handleGameState(request, env);
    if (url.pathname === '/api/game/save'       && request.method === 'POST') return handleGameSave(request, env);
    if (url.pathname === '/api/webhook'         && request.method === 'POST') return handleWebhook(request, env);
    if (url.pathname === '/api/health')         return jsonResponse({ ok: true, hasToken: !!env.BOT_TOKEN, ads: CONFIG.ads.enabled });

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return fetch(request);
  }
};

// ==================== Helpers ====================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

// ==================== Auth ====================
async function validateInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw', enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const secret = await crypto.subtle.sign('HMAC', secretKey, enc.encode(botToken));
    const hmacKey = await crypto.subtle.importKey(
      'raw', secret,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== hash) return null;
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch { return null; }
}

// ==================== API: Me ====================
async function handleGetMe(request, env) {
  try {
    const { initData } = await request.json();
    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user) return jsonResponse({ error: 'Auth failed' }, 401);
    const data = await fetch(`${CONFIG.firebase}/users/${user.id}.json`)
      .then(r => r.json()).catch(() => null);
    return jsonResponse({
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name || '',
        username: user.username || '',
        languageCode: user.language_code || 'ar',
      },
      data: data || { level: 1, energy: 5, coins: 0, purchases: [], lastDaily: 0 },
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ==================== API: Game State ====================
async function handleGameState(request, env) {
  try {
    const { initData } = await request.json();
    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user) return jsonResponse({ error: 'Auth failed' }, 401);
    const data = await fetch(`${CONFIG.firebase}/users/${user.id}.json`)
      .then(r => r.json()).catch(() => null) || {};
    return jsonResponse({ ok: true, data });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ==================== API: Game Save ====================
async function handleGameSave(request, env) {
  try {
    const { initData, payload } = await request.json();
    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user) return jsonResponse({ error: 'Auth failed' }, 401);
    await fetch(`${CONFIG.firebase}/users/${user.id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, lastActive: Date.now() }),
    });
    return jsonResponse({ ok: true });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ==================== API: Invoice ====================
async function handleCreateInvoice(request, env) {
  try {
    const { productId, initData, lang } = await request.json();
    if (!productId || !initData) return jsonResponse({ error: 'Missing data' }, 400);
    const user = await validateInitData(initData, env.BOT_TOKEN);
    if (!user) return jsonResponse({ error: 'Auth failed' }, 401);

    // Level upgrade
    const m = productId.match(/^level_(\d+)$/);
    if (!m) return jsonResponse({ error: 'Unknown product' }, 404);
    const level = Number(m[1]);
    const L = getLevel(level);
    if (!L) return jsonResponse({ error: 'Unknown level' }, 404);

    const L_ = (lang === 'en') ? 'en' : 'ar';
    const title = L.title[L_];
    const desc = L.desc[L_];

    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: desc,
        payload: JSON.stringify({ productId, userId: String(user.id), level }),
        currency: 'XTR',
        prices: [{ label: title, amount: L.price }],
      }),
    });
    const data = await res.json();
    if (!data.ok) return jsonResponse({ error: data.description || 'Failed' }, 500);
    return jsonResponse({ url: data.result });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ==================== Webhook ====================
async function handleWebhook(request, env) {
  try {
    const update = await request.json();

    if (update.pre_checkout_query) {
      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
      });
      return new Response('OK');
    }

    if (update.message?.successful_payment) {
      const p = update.message.successful_payment;
      let payload = {};
      try { payload = JSON.parse(p.invoice_payload); } catch {}
      if (payload.level && payload.userId) {
        const userRef = `${CONFIG.firebase}/users/${payload.userId}`;
        const userData = await fetch(`${userRef}.json`).then(r => r.json()).catch(() => null) || {};
        const purchases = userData.purchases || [];
        purchases.push({ productId: payload.productId, level: payload.level, price: p.total_amount, at: Date.now() });
        await fetch(`${userRef}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: payload.level, purchases }),
        });

        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: update.message.chat.id,
            text: `🎉 ${getLevel(payload.level)?.title?.ar || 'ترقية'}\nما زال الحلم 314... قريبًا.`,
          }),
        });
      }
    }
    return new Response('OK');
  } catch (e) { console.error(e); return new Response('OK'); }
                                   }
