#!/usr/bin/env node

/**
 * Preview generated puzzles in the terminal, for judging clue quality.
 *
 * Runs outside netlify dev, so there's no 10s function limit, nothing is
 * written to Blobs, and the daily cache is untouched — sample as often as you
 * like without affecting what players see.
 *
 *   npm run puzzles                                  # all 5 tiers
 *   npm run puzzles:mini                             # same, cheaper model
 *   npm run puzzles -- --model gpt-4o-mini           # any model
 *   npm run puzzles -- --level scholar --count 5     # 5 samples of one tier
 *   npm run puzzles -- --json                        # raw JSON output
 *
 * Note the `--` separator: npm needs it to pass flags through to the script.
 */

// ---------------------------------------------------------------------------
// Args (parsed before requiring the lib, which reads MODEL at load time)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
}
const has = (name) => args.includes(`--${name}`);

if (has('help')) {
  console.log(`
Usage: npm run puzzles -- [options]

  --model <name>    Model to use (default: OPENAI_MODEL env or gpt-4o)
  --level <tier>    Only this tier: novitiate|disciple|scholar|magister|etymologus
  --count <n>       With --level, generate n samples of that tier (default 1)
  --json            Print raw JSON instead of formatted output
  --help            Show this
`);
  process.exit(0);
}

const modelArg = flag('model');
if (modelArg) process.env.OPENAI_MODEL = modelArg;

// Be patient — we're not bound by the serverless timeout here.
process.env.OPENAI_CALL_TIMEOUT_MS = process.env.OPENAI_CALL_TIMEOUT_MS || '60000';
process.env.OPENAI_TOTAL_BUDGET_MS = process.env.OPENAI_TOTAL_BUDGET_MS || '120000';

const { MODEL, DIFFICULTIES, generateAllPuzzles } = require('../netlify/lib/puzzles');

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m'
};
const rule = (ch = '─') => c.dim + ch.repeat(72) + c.reset;

function wrap(text, indent = 2) {
  const width = 72 - indent;
  const pad = ' '.repeat(indent);
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(pad + line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(pad + line.trim());
  return lines.join('\n');
}

/**
 * Cheap objective checks against the rules the prompt asks for. These don't
 * judge whether a clue is *good* — that's your call — they just surface the
 * obvious violations so you're not hunting for them by eye.
 */
function auditPuzzle(puzzle, seenWords) {
  const notes = [];
  const word = puzzle.word;
  const clue = (puzzle.clue || '').toLowerCase();

  if (clue.includes(word.toLowerCase())) {
    notes.push([c.red, 'clue contains the answer']);
  }

  // Prompt forbids exposing the literal roots. A long alphabetic token inside
  // the clue that isn't an ordinary English word is usually a transliteration
  // that slipped through (e.g. "skopein", "anthropos").
  const suspicious = (puzzle.clue || '')
    .replace(/^.*?meaning:/i, '')
    .match(/\b[a-z]{6,}\b/g) || [];
  // Ordinary English words that legitimately appear in a "roots meaning: ..."
  // clue. Anything 6+ letters not on this list gets flagged as a *possible*
  // transliteration — expect the occasional false positive.
  const common = new Set([
    'meaning', 'through', 'because', 'against', 'without', 'between',
    'greater', 'smaller', 'writing', 'written', 'speaking', 'speech',
    'looking', 'thinking', 'measure', 'measuring', 'measurement',
    'together', 'himself', 'herself', 'itself', 'shaped', 'formed',
    'across', 'beyond', 'around', 'before', 'after', 'spirit', 'people',
    'nature', 'science', 'letter', 'memory', 'wisdom', 'colour', 'color',
    'number', 'hearing', 'distant', 'logical', 'knowledge', 'sensation',
    'feeling', 'suffering', 'healing', 'growth', 'change', 'motion',
    'movement', 'strange', 'foreign', 'ancient', 'hollow', 'narrow',
    'silence', 'darkness', 'brightness', 'heaven', 'planet', 'thousand',
    'hundred', 'higher', 'inside', 'outside', 'beneath', 'strength',
    'weakness', 'birth', 'living', 'breath', 'breathing', 'himself',
    'sacred', 'common', 'single', 'double', 'divided', 'joined', 'binding',
    'carrying', 'bearing', 'leading', 'sending', 'taking', 'making',
    'turning', 'falling', 'rising', 'flowing', 'burning', 'cutting'
  ]);
  const leaks = suspicious.filter((w) => !common.has(w));
  if (leaks.length) {
    notes.push([c.yellow, `possible root leak: ${leaks.join(', ')}`]);
  }

  if (!/\b(1[0-9]{3}|[0-9]{3,4}\s*(BCE|CE|AD|BC)|[0-9]{2}th|century|[0-9]{4}s)\b/i.test(
    puzzle.detailedEtymology || ''
  )) {
    notes.push([c.yellow, 'no date in detailed etymology']);
  }

  if (word.length > 15) notes.push([c.red, `${word.length} letters (max 15)`]);
  if (seenWords.has(word)) notes.push([c.red, 'duplicate word']);

  return notes;
}

function printPuzzle(puzzle, index, seenWords) {
  const notes = auditPuzzle(puzzle, seenWords);
  seenWords.add(puzzle.word);

  console.log('');
  console.log(
    `${c.dim}${String(index + 1).padStart(2)}.${c.reset} ` +
    `${c.magenta}${(puzzle.difficulty || '?').toUpperCase()}${c.reset}  ` +
    `${c.bold}${c.cyan}${puzzle.word}${c.reset} ` +
    `${c.dim}(${puzzle.word.length} letters)${c.reset}` +
    (puzzle.isFinalChallenge ? `  ${c.dim}[final challenge]${c.reset}` : '')
  );
  console.log(`${c.bold}   Clue:${c.reset} ${puzzle.clue}`);
  console.log(`${c.dim}   Definition:${c.reset}`);
  console.log(c.dim + wrap(puzzle.definition, 5) + c.reset);
  console.log(`${c.dim}   Brief:${c.reset}`);
  console.log(c.dim + wrap(puzzle.briefEtymology, 5) + c.reset);
  console.log(`${c.dim}   Detailed:${c.reset}`);
  console.log(c.dim + wrap(puzzle.detailedEtymology, 5) + c.reset);

  if (notes.length) {
    for (const [color, msg] of notes) {
      console.log(`   ${color}⚠ ${msg}${c.reset}`);
    }
  } else {
    console.log(`   ${c.green}✓ passes automated checks${c.reset}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      `${c.red}OPENAI_API_KEY not found.${c.reset}\n` +
      `Run via npm (which loads .env):  npm run puzzles`
    );
    process.exit(1);
  }

  const level = flag('level');
  const count = Number(flag('count', '1')) || 1;
  const asJson = has('json');

  if (level && !DIFFICULTIES.some((d) => d.level === level)) {
    console.error(`${c.red}Unknown level "${level}".${c.reset} Valid: ${DIFFICULTIES.map((d) => d.level).join(', ')}`);
    process.exit(1);
  }

  if (!asJson) {
    console.log('');
    console.log(rule('═'));
    console.log(`${c.bold} Etymon puzzle preview${c.reset}  ${c.dim}model: ${MODEL}${c.reset}`);
    if (level) console.log(`${c.dim} tier: ${level} · samples: ${count}${c.reset}`);
    console.log(rule('═'));
  }

  const started = Date.now();
  let puzzles = [];

  try {
    if (level) {
      // Sample one tier repeatedly to judge variance.
      const only = DIFFICULTIES.filter((d) => d.level === level);
      const original = DIFFICULTIES.slice();
      DIFFICULTIES.length = 0;
      DIFFICULTIES.push(...only);
      for (let i = 0; i < count; i++) {
        const batch = await generateAllPuzzles(apiKey, Date.now() + 120000);
        puzzles.push(...batch);
      }
      DIFFICULTIES.length = 0;
      DIFFICULTIES.push(...original);
    } else {
      puzzles = await generateAllPuzzles(apiKey, Date.now() + 120000);
    }
  } catch (error) {
    console.error(`${c.red}Generation failed:${c.reset} ${error.message}`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (asJson) {
    console.log(JSON.stringify(puzzles, null, 2));
    return;
  }

  const seen = new Set();
  puzzles.forEach((p, i) => printPuzzle(p, i, seen));

  console.log('');
  console.log(rule());
  console.log(
    `${c.dim} ${puzzles.length} puzzles in ${elapsed}s · model ${MODEL}${c.reset}`
  );
  console.log(
    `${c.dim} Not written to Blobs — players are unaffected.${c.reset}`
  );
  console.log('');
})();
