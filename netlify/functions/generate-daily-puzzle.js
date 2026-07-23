const { schedule } = require('@netlify/functions');
const { connectLambda, getStore } = require('@netlify/blobs');
const {
  MODEL,
  STORE_NAME,
  TOTAL_BUDGET_MS,
  generateAllPuzzles,
  todayUTC
} = require('../lib/puzzles');

/**
 * Scheduled generator — runs once per day at 00:00 UTC and writes that day's
 * puzzles to Netlify Blobs. The player-facing function then only reads.
 *
 * This is what makes cost flat: one generation per day regardless of how many
 * people play. get-daily-puzzle can still self-heal by generating on demand,
 * so a missed run degrades gracefully rather than breaking the game.
 *
 * Notes:
 * - The schedule is declared in netlify.toml AND inline here; either works.
 * - Scheduled functions only run on published production deploys — they do not
 *   fire on deploy previews or branch deploys.
 * - Trigger manually with: netlify functions:invoke generate-daily-puzzle
 */

const handler = async (event) => {
  const today = todayUTC();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not set — skipping scheduled generation.');
    return { statusCode: 500, body: 'Missing OPENAI_API_KEY' };
  }

  let store;
  try {
    connectLambda(event);
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (error) {
    console.error('Netlify Blobs unavailable — cannot persist:', error.message);
    return { statusCode: 500, body: 'Blobs unavailable' };
  }

  // Don't pay twice if the endpoint already self-healed for today.
  try {
    const existing = await store.get(`daily-${today}`, { type: 'json' });
    if (existing && Array.isArray(existing.puzzles) && existing.puzzles.length === 5) {
      console.log(`Puzzles for ${today} already exist — nothing to do.`);
      return { statusCode: 200, body: `Already generated for ${today}` };
    }
  } catch (error) {
    console.warn('Existing-blob check failed, generating anyway:', error.message);
  }

  try {
    console.log(`Generating puzzles for ${today} using ${MODEL}...`);
    const puzzles = await generateAllPuzzles(apiKey, Date.now() + TOTAL_BUDGET_MS);

    const payload = {
      date: today,
      generatedAt: new Date().toISOString(),
      source: 'scheduled',
      puzzles
    };

    await store.setJSON(`daily-${today}`, payload);

    console.log(`Stored ${today}: ${puzzles.map((p) => p.word).join(', ')}`);
    return { statusCode: 200, body: `Generated puzzles for ${today}` };
  } catch (error) {
    console.error('Scheduled generation failed:', error);
    return { statusCode: 500, body: 'Generation failed' };
  }
};

exports.handler = schedule('@daily', handler);
