/* ==========================================
   PWhy BoomBoom Worker - Cloudflare Backend
   Firebase + Telegram Stars + Referrals
   ========================================== */

const FIREBASE = 'https://pwhy-boomboom-default-rtdb.europe-west1.firebasedatabase.app';
const REFERRAL_REWARD = 150;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // --- Routes ---
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, hasToken: !!env.BOT_TOKEN });
    }
    if (url.pathname === '/api/create-invoice' && request.method === 'POST') {
      return handleCreateInvoice(request, env);
    }
    if (url.pathname === '/api/referral' && request.method === 'POST') {
      return handleReferral(request);
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

    console.log(`⭐ Invoice created: ${userId} → ${stars} stars → ${reward} PWhy`);

    return jsonResponse({ ok: true, invoiceLink: tgJson.result, invoiceId: invoiceId });
  } catch (e) {
    console.error('handleCreateInvoice error:', e);
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}

// --- Referral ---
async function handleReferral(request) {
  try {
    const { referrerId, referredId } = await request.json();

    if (!referrerId || !referredId || referrerId === referredId) {
      console.warn('⚠️ Invalid referral:', { referrerId, referredId });
      return jsonResponse({ ok: false, error: 'invalid' }, 400);
    }

    // هل هذا المستخدم محال سابقًا؟
    const existing = await fetch(`${FIREBASE}/boomboom_referrals/${referredId}.json`)
      .then(r => r.json()).catch(() => null);
    if (existing) {
      console.log('ℹ️ Already referred:', referredId);
      return jsonResponse({ ok: false, error: 'already' }, 409);
    }

    // اقرأ بيانات المُحيل
    const refSnap = await fetch(`${FIREBASE}/boomboom_players/${referrerId}.json`)
      .then(r => r.json()).catch(() => null);
    if (!refSnap) {
      console.warn('⚠️ Referrer not found:', referrerId);
      return jsonResponse({ ok: false, error: 'no-referrer' }, 404);
    }

    // سجّل الإحالة
    await fetch(`${FIREBASE}/boomboom_referrals/${referredId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerId, at: Date.now() })
    });

    // امنح المُحيل +150
    const newScore = (refSnap.score || 0) + REFERRAL_REWARD;
    await fetch(`${FIREBASE}/boomboom_players/${referrerId}/score.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newScore)
    });

    console.log(`🤝 Referral: ${referredId} → ${referrerId} (+${REFERRAL_REWARD})`);
    return jsonResponse({ ok: true, rewarded: REFERRAL_REWARD });
  } catch (e) {
    console.error('❌ Referral error:', e);
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}
