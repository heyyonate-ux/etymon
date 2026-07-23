const { connectLambda, getStore } = require('@netlify/blobs');
const {
  STORE_NAME,
  TOTAL_BUDGET_MS,
  FALLBACK_PUZZLES,
  generateAllPuzzles,
  todayUTC,
  secondsUntilMidnightUTC,
  buildPayload
} = require('../lib/puzzles');

/**
 * Serves today's daily puzzle.
 *
 * Read path, cheapest first:
 *   1. In-memory cache  — free, but dies with the container
 *   2. Netlify Blobs    — shared across all instances; written once per day by
 *                         the scheduled generate-daily-puzzle function
 *   3. Generate on demand — self-healing if the scheduled run hasn't happened
 *                           yet (e.g. first deploy), then persisted to Blobs
 *
 * Blobs are treated as an optimization, not a hard dependency: if the store is
 * unavailable the endpoint still works, it just regenerates more often.
 *
 * Set USE_FALLBACK=true to skip OpenAI entirely (local dev / gameplay work).
 */

const ALLOWED_ORIGINS = [
  'https://etymon-game.netlify.app',
  'http://localhost:8888',
  'http://127.0.0.1:8888'
];

// Only applies to requests that would trigger a generation; cached reads are
// never throttled, so ordinary players can't hit this.
const RATE_LIMIT_PER_DAY = 10;

let memoryCache = { date: null, payload: null };
const rateLimitStore = new Map();

exports.handler = async (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const corsHeaders = buildCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' }, corsHeaders);
  }
  // Browsers always send Origin cross-origin; a missing Origin (same-origin
  // navigation, curl) is allowed through.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json(403, { error: 'Forbidden origin' }, corsHeaders);
  }

  const today = todayUTC();
  const cacheHeaders = {
    ...corsHeaders,
    'Cache-Control': `public, max-age=${secondsUntilMidnightUTC()}`
  };

  // Local dev / gameplay iteration: never call OpenAI.
  if (process.env.USE_FALLBACK === 'true') {
    return json(200, buildPayload(today, FALLBACK_PUZZLES, 'fallback'), corsHeaders);
  }

  // 1. In-memory
  if (memoryCache.date === today && memoryCache.payload) {
    return json(200, { ...memoryCache.payload, servedFrom: 'memory' }, cacheHeaders);
  }

  // 2. Blobs
  const store = openStore(event);
  if (store) {
    try {
      const stored = await store.get(`daily-${today}`, { type: 'json' });
      if (stored && Array.isArray(stored.puzzles) && stored.puzzles.length === 5) {
        memoryCache = { date: today, payload: stored };
        return json(200, { ...stored, servedFrom: 'blob' }, cacheHeaders);
      }
    } catch (error) {
      console.warn('Blob read failed:', error.message);
    }
  }

  // 3. Generate on demand
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set — serving fallback puzzles.');
    return json(200, buildPayload(today, FALLBACK_PUZZLES, 'fallback'), corsHeaders);
  }

  if (isRateLimited(headers, today)) {
    return json(429, { error: 'Rate limit exceeded. Try again tomorrow.' }, {
      ...corsHeaders,
      'Retry-After': '3600'
    });
  }

  try {
    console.log(`No stored puzzles for ${today} — generating on demand.`);
    const puzzles = await generateAllPuzzles(apiKey, Date.now() + TOTAL_BUDGET_MS);
    const payload = buildPayload(today, puzzles, 'generated');

    memoryCache = { date: today, payload };

    if (store) {
      try {
        await store.setJSON(`daily-${today}`, payload);
      } catch (error) {
        console.warn('Blob write failed:', error.message);
      }
    }

    return json(200, { ...payload, servedFrom: 'generated' }, cacheHeaders);
  } catch (error) {
    console.error('Error generating puzzles:', error);
    return json(200, buildPayload(today, FALLBACK_PUZZLES, 'fallback'), corsHeaders);
  }
};

/**
 * Blobs isn't auto-configured for the legacy Lambda handler signature, so the
 * event has to be handed over explicitly. Returns null if unavailable, letting
 * the caller degrade to on-demand generation.
 */
function openStore(event) {
  try {
    connectLambda(event);
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (error) {
    console.warn('Netlify Blobs unavailable:', error.message);
    return null;
  }
}

function buildCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

function json(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

/**
 * Best-effort throttle on generation attempts only. Serverless instances are
 * ephemeral and there may be several at once, so treat this as a speed bump —
 * the OpenAI budget cap remains the real backstop.
 */
function isRateLimited(headers, today) {
  const ip =
    headers['x-nf-client-connection-ip'] ||
    headers['client-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';

  const key = `${ip}-${today}`;
  const count = rateLimitStore.get(key) || 0;
  if (count >= RATE_LIMIT_PER_DAY) return true;

  rateLimitStore.set(key, count + 1);

  if (rateLimitStore.size > 5000) {
    for (const k of rateLimitStore.keys()) {
      if (!k.endsWith(today)) rateLimitStore.delete(k);
    }
  }
  return false;
}
