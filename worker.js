/* ==========================================
   PWhy BoomBoom Worker - Cloudflare Backend
   Adsgram Reward + Telegram Stars Invoice
   ========================================== */

const FIREBASE = 'https://pwhy-boomboom-default-rtdb.europe-west1.firebasedatabase.app';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // --- Routes ---
    if (url.pathname === '/reward' && request.method === 'GET') {
      return handleReward(request, env);
    }
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, hasToken: !!env.BOT_TOKEN });
    }
    if (url.pathname === '/api/products') {
      return jsonResponse({ ok: true, products: [] });
    }
    if (url.pathname === '/api/create-invoice' && request.method === 'POST') {
      return handleCreateInvoice(request, env);
    }

    // Static assets
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};

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

// --- Adsgram Reward ---
async function handleReward(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return new Response('Missing userId', { status: 400 });

    const timestamp = Date.now();
    console.log(`💖 Ad reward: ${userId}`);

    await fetch(`${FIREBASE}/boomboom_ad_rewards.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, at: timestamp, source: 'adsgram' })
    });

    const counterRef = `${FIREBASE}/boomboom_players/${userId}/adCount.json`;
    const snap = await fetch(counterRef).then(r => r.json()).catch(() => 0);
    const currentCount = typeof snap === 'number' ? snap : 0;

    await fetch(`${FIREBASE}/boomboom_players/${userId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adCount: currentCount + 1, lastAdAt: timestamp })
    });

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  } catch (e) {
    console.error('reward error:', e);
    return new Response('OK', { status: 200 });
  }
}

// --- Telegram Stars Invoice ---
async function handleCreateInvoice(request, env) {
  try {
    const body = await request.json();
    const { userId, stars, reward, title } = body;

    if (!userId || !stars || !reward) {
      return jsonResponse({ ok: false, error: 'Missing params' }, 400);
    }
    if (!env.BOT_TOKEN) {
      return jsonResponse({ ok: false, error: 'BOT_TOKEN not set' }, 500);
    }

    // payload يحتوي على userId والمكافأة (حتى 128 حرف)
    const payload = JSON.stringify({
      u: userId.slice(0, 40),
      r: reward,
      t: Date.now()
    }).slice(0, 128);

    const invoiceData = {
      title: title || 'PWhy Pack',
      description: `+${reward.toLocaleString()} PWhy coins`,
      payload: payload,
      currency: 'XTR',
      prices: [{ label: 'PWhy Pack', amount: stars }]
    };

    const tgRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      }
    );
    const tgJson = await tgRes.json();

    if (!tgJson.ok) {
      console.error('Telegram invoice error:', tgJson);
      return jsonResponse({ ok: false, error: tgJson.description || 'Telegram error' }, 500);
    }

    // حفظ الفاتورة في Firebase للتحقق لاحقًا
    const invoiceId = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await fetch(`${FIREBASE}/stars_invoices/${invoiceId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId, stars, reward,
        invoiceLink: tgJson.result,
        createdAt: Date.now(),
        status: 'pending'
      })
    }).catch(e => console.warn('firebase save failed:', e));

    console.log(`⭐ Invoice created for ${userId}: ${stars} stars -> ${reward} PWhy`);

    return jsonResponse({
      ok: true,
      invoiceLink: tgJson.result,
      invoiceId: invoiceId
    });
  } catch (e) {
    console.error('handleCreateInvoice error:', e);
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}
