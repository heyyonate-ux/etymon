#!/usr/bin/env node

/**
 * Stage 1 + 2 of the corpus pipeline: bulk-generate candidate puzzles, throw
 * out the mechanical failures, and write what survives to a review file.
 *
 *   npm run corpus:generate                        # 100 per tier
 *   npm run corpus:generate -- --count 40          # 40 per tier
 *   npm run corpus:generate -- --tier scholar      # one tier only
 *   npm run corpus:generate -- --model gpt-4o-mini
 *   npm run corpus:generate -- --reset             # start over
 *
 * Resumable by default: every accepted candidate is written to disk as it
 * arrives, and re-running tops each tier up to the target rather than starting
 * from zero. A crash at candidate 400 costs you nothing.
 *
 * NOTE: these checks verify SHAPE, NOT TRUTH. A confidently invented etymology
 * passes all of them. Human fact-checking is the point of the review stage.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {
  TIERS, TIER_LEVELS, MAX_WORD_LENGTH,
  buildPrompt, auditCandidate, etymonlineUrl, normalise
} = require('./lib/authoring');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = n => args.includes(`--${n}`);

if (has('help')) {
  console.log(`
Usage: npm run corpus:generate -- [options]

  --count <n>     candidates per tier (default 100)
  --tier <name>   only this tier: ${TIER_LEVELS.join(' | ')}
  --model <name>  default: OPENAI_MODEL env, or gpt-4o
  --concurrency   parallel requests (default 5)
  --reset         discard existing candidates and start fresh
  --help
`);
  process.exit(0);
}

const MODEL = flag('model') || process.env.OPENAI_MODEL || 'gpt-4o';
const TARGET_PER_TIER = Number(flag('count', '100')) || 100;
const CONCURRENCY = Number(flag('concurrency', '5')) || 5;
const ONLY_TIER = flag('tier');
const CALL_TIMEOUT_MS = 60000;

const OUT_DIR = path.join(__dirname, '..', 'corpus');
const REVIEW_FILE = path.join(OUT_DIR, 'review.json');
const REJECT_FILE = path.join(OUT_DIR, 'rejected.json');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m'
};

// ---------------------------------------------------------------------------

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function save(accepted, rejected) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REVIEW_FILE, JSON.stringify(accepted, null, 2));
  fs.writeFileSync(REJECT_FILE, JSON.stringify(rejected, null, 2));
}

async function callModel(prompt, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are an expert etymologist. Respond with valid JSON only. Accuracy matters more than creativity.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 600
      })
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim().replace(/```json\n?|\n?```/g, '');
  return JSON.parse(raw);
}

/** Generate until this tier hits its target, or we give up making progress. */
async function fillTier(tier, apiKey, state) {
  const existing = state.accepted.filter(a => a.difficulty === tier.level);
  let need = TARGET_PER_TIER - existing.length;

  if (need <= 0) {
    console.log(`${c.dim}${tier.level.padEnd(11)} already at ${existing.length}/${TARGET_PER_TIER} — skipping${c.reset}`);
    return;
  }

  process.stdout.write(`${c.cyan}${tier.level.padEnd(11)}${c.reset} ${existing.length}/${TARGET_PER_TIER} `);

  // Stop if several consecutive batches add nothing — the model has run out of
  // words it hasn't already produced for this tier.
  let barren = 0;

  while (need > 0 && barren < 3) {
    const batch = Math.min(need, CONCURRENCY);
    const avoid = [...state.usedWords];

    const results = await Promise.all(
      Array.from({ length: batch }, async () => {
        try {
          const raw = await callModel(buildPrompt(tier, avoid.slice(-120)), apiKey);
          return normalise(raw, tier.level);
        } catch (err) {
          return { __error: err.message };
        }
      })
    );

    let added = 0;
    for (const cand of results) {
      if (cand.__error) {
        state.errors.push(cand.__error);
        process.stdout.write(`${c.red}!${c.reset}`);
        continue;
      }

      const { rejects, flags } = auditCandidate(cand, {
        usedWords: state.usedWords,
        maxLength: MAX_WORD_LENGTH
      });

      if (rejects.length) {
        state.rejected.push({ ...cand, rejectedFor: rejects });
        rejects.forEach(r => {
          const key = r.replace(/".*?"/, '"..."').replace(/\d+ letters/, 'N letters');
          state.reasonCounts[key] = (state.reasonCounts[key] || 0) + 1;
        });
        process.stdout.write(`${c.yellow}·${c.reset}`);
        continue;
      }

      state.usedWords.add(cand.word);
      state.accepted.push({
        ...cand,
        status: 'unreviewed',
        flags,
        source: etymonlineUrl(cand.word),
        notes: ''
      });
      added++;
      need--;
      process.stdout.write(`${c.green}.${c.reset}`);
    }

    barren = added === 0 ? barren + 1 : 0;
    save(state.accepted, state.rejected); // checkpoint every batch
  }

  const got = state.accepted.filter(a => a.difficulty === tier.level).length;
  console.log(` ${got}/${TARGET_PER_TIER}${barren >= 3 ? c.yellow + ' (model ran dry)' + c.reset : ''}`);
}

// ---------------------------------------------------------------------------

(async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`${c.red}OPENAI_API_KEY not found.${c.reset} Run via npm so .env loads: npm run corpus:generate`);
    process.exit(1);
  }
  if (ONLY_TIER && !TIER_LEVELS.includes(ONLY_TIER)) {
    console.error(`${c.red}Unknown tier "${ONLY_TIER}".${c.reset} Valid: ${TIER_LEVELS.join(', ')}`);
    process.exit(1);
  }

  const accepted = has('reset') ? [] : loadJson(REVIEW_FILE, []);
  const rejected = has('reset') ? [] : loadJson(REJECT_FILE, []);

  const state = {
    accepted,
    rejected,
    usedWords: new Set(accepted.map(a => a.word)),
    reasonCounts: {},
    errors: []
  };

  const tiers = ONLY_TIER ? TIERS.filter(t => t.level === ONLY_TIER) : TIERS;

  console.log(`\n${c.bold}Etymon corpus generator${c.reset}  ${c.dim}model ${MODEL} · target ${TARGET_PER_TIER}/tier · max ${MAX_WORD_LENGTH} letters${c.reset}`);
  if (accepted.length) console.log(`${c.dim}Resuming — ${accepted.length} candidates already on disk.${c.reset}`);
  console.log('');

  const started = Date.now();
  for (const tier of tiers) {
    await fillTier(tier, apiKey, state);
  }
  const mins = ((Date.now() - started) / 60000).toFixed(1);

  save(state.accepted, state.rejected);

  console.log(`\n${c.bold}Done in ${mins} min${c.reset}`);
  console.log(`  accepted: ${c.green}${state.accepted.length}${c.reset}   rejected: ${c.yellow}${state.rejected.length}${c.reset}   api errors: ${state.errors.length}`);

  const reasons = Object.entries(state.reasonCounts).sort((a, b) => b[1] - a[1]);
  if (reasons.length) {
    console.log(`\n${c.bold}Why candidates were rejected${c.reset} ${c.dim}(tune the prompt against this)${c.reset}`);
    reasons.forEach(([r, n]) => console.log(`  ${String(n).padStart(4)}  ${r}`));
  }

  const flagged = state.accepted.filter(a => a.flags && a.flags.length).length;
  if (flagged) console.log(`\n${c.yellow}${flagged}${c.reset} accepted candidates carry a flag for the reviewer.`);

  console.log(`\n  review file: ${c.cyan}corpus/review.json${c.reset}`);
  console.log(`  rejects:     ${c.dim}corpus/rejected.json${c.reset}`);
  console.log(`\n${c.bold}${c.yellow}These checks verify shape, not truth.${c.reset}`);
  console.log(`${c.dim}A confidently invented etymology passes every one of them.`);
  console.log(`Fact-check against Etymonline in review:  npm run corpus:review${c.reset}\n`);
})();
