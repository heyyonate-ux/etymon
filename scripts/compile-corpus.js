#!/usr/bin/env node

/**
 * Stage 4: turn approved candidates into the shipped corpus.
 *
 *   npm run corpus:compile
 *   npm run corpus:compile -- --start 2026-02-01
 *   npm run corpus:compile -- --days 30
 *
 * Takes every entry marked `approved` in corpus/review.json, assigns one word
 * per tier per day, and writes public/corpus.json — a date-keyed file the app
 * can read with no LLM call at runtime.
 *
 * Guarantees global uniqueness: a word can never appear on two days.
 */

const fs = require('fs');
const path = require('path');
const { TIER_LEVELS } = require('./lib/authoring');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const REVIEW_FILE = path.join(__dirname, '..', 'corpus', 'review.json');
const OUT_FILE = path.join(__dirname, '..', 'public', 'corpus.json');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m'
};

function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

(() => {
  let review;
  try {
    review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
  } catch {
    console.error(`${c.red}No corpus/review.json.${c.reset} Run npm run corpus:generate first.`);
    process.exit(1);
  }

  // --include-unreviewed lets you compile a playable corpus from candidates
  // you haven't hand-approved yet — for dogfooding only. It deliberately still
  // EXCLUDES anything explicitly rejected, so you're shipping "not yet checked,"
  // never "checked and failed."
  const includeUnreviewed = process.argv.includes('--include-unreviewed');
  const approved = includeUnreviewed
    ? review.filter(r => r.status !== 'rejected')
    : review.filter(r => r.status === 'approved');

  if (includeUnreviewed) {
    const unreviewedCount = review.filter(r => r.status === 'unreviewed').length;
    console.log(`\n\x1b[33m⚠  --include-unreviewed: shipping ${unreviewedCount} UNVERIFIED candidates.\x1b[0m`);
    console.log(`\x1b[2m   Etymologies are NOT fact-checked. For dogfooding only — re-compile without\n   this flag before any real launch.\x1b[0m`);
  }
  if (!approved.length) {
    console.error(`${c.red}Nothing approved yet.${c.reset} Run npm run corpus:review.`);
    process.exit(1);
  }

  // Bucket by tier, dropping any duplicate word globally (first wins).
  const seen = new Set();
  const byTier = Object.fromEntries(TIER_LEVELS.map(t => [t, []]));
  let dupes = 0;

  for (const entry of approved) {
    const word = entry.word.toUpperCase().trim();
    if (seen.has(word)) { dupes++; continue; }
    if (!byTier[entry.difficulty]) {
      console.warn(`${c.yellow}Skipping ${word}: unknown tier "${entry.difficulty}"${c.reset}`);
      continue;
    }
    seen.add(word);
    byTier[entry.difficulty].push(entry);
  }

  console.log(`\n${c.bold}Approved by tier${c.reset}`);
  TIER_LEVELS.forEach(t => {
    const n = byTier[t].length;
    console.log(`  ${t.padEnd(11)} ${String(n).padStart(4)}`);
  });
  if (dupes) console.log(`${c.dim}  (${dupes} duplicate words dropped)${c.reset}`);

  // A day needs one word from every tier, so coverage is the smallest tier.
  const available = Math.min(...TIER_LEVELS.map(t => byTier[t].length));
  const requested = Number(flag('days', String(available))) || available;
  const days = Math.min(available, requested);

  if (days === 0) {
    const short = TIER_LEVELS.filter(t => byTier[t].length === 0);
    console.error(`\n${c.red}Cannot build a single day — no approved words in: ${short.join(', ')}${c.reset}\n`);
    process.exit(1);
  }

  const startDate = flag('start') || tomorrowUTC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    console.error(`${c.red}--start must be YYYY-MM-DD${c.reset}`);
    process.exit(1);
  }

  const puzzles = {};
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    puzzles[date] = TIER_LEVELS.map(tier => {
      const e = byTier[tier][d];
      return {
        word: e.word,
        clue: e.clue,
        definition: e.definition,
        briefEtymology: e.briefEtymology,
        detailedEtymology: e.detailedEtymology,
        difficulty: e.difficulty,
        isSpeedRound: tier !== 'etymologus',
        isFinalChallenge: tier === 'etymologus'
      };
    });
  }

  const corpus = {
    generatedAt: new Date().toISOString(),
    startDate,
    endDate: addDays(startDate, days - 1),
    days,
    wordsPerDay: TIER_LEVELS.length,
    puzzles
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(corpus, null, 2));

  const leftover = TIER_LEVELS
    .map(t => `${t} +${byTier[t].length - days}`)
    .filter(s => !s.endsWith('+0'));

  console.log(`\n${c.green}${c.bold}Wrote public/corpus.json${c.reset}`);
  console.log(`  ${days} days · ${days * TIER_LEVELS.length} words`);
  console.log(`  ${corpus.startDate} → ${corpus.endDate}`);
  if (leftover.length) console.log(`${c.dim}  unused approved words: ${leftover.join(', ')}${c.reset}`);
  if (days < requested) {
    console.log(`${c.yellow}  Wanted ${requested} days but the smallest tier only has ${available}.${c.reset}`);
  }
  console.log('');
})();
