/* ==========================================
   PWhy BoomBoom Worker - Cloudflare Backend
   Adsgram Reward URL + Static Assets
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

    // Static assets (via ASSETS binding)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback (should never happen if ASSETS binding is configured)
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

// --- Adsgram Reward Handler ---
async function handleReward(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return new Response('Missing userId', { status: 400 });

    const timestamp = Date.now();
    console.log(`💖 Ad reward for PWhy user: ${userId}`);

    // 1. Log the ad view globally
    await fetch(`${FIREBASE}/boomboom_ad_rewards.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, at: timestamp, source: 'adsgram' })
    });

    // 2. Increment user's ad counter
    const counterRef = `${FIREBASE}/boomboom_players/${userId}/adCount.json`;
    const snap = await fetch(counterRef).then(r => r.json()).catch(() => 0);
    const currentCount = typeof snap === 'number' ? snap : 0;

    await fetch(`${FIREBASE}/boomboom_players/${userId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adCount: currentCount + 1,
        lastAdAt: timestamp
      })
    });

    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (e) {
    console.error('reward error:', e);
    return new Response('OK', { status: 200 });
  }
}
