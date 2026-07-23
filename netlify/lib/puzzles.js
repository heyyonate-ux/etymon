const fetch = require('node-fetch');

/**
 * Shared puzzle generation logic.
 *
 * Used by both the scheduled generator (generate-daily-puzzle) and the
 * player-facing endpoint (get-daily-puzzle), which falls back to generating
 * on demand if the scheduled run hasn't produced today's set yet.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Model is env-configurable so it can be changed without a code deploy.
//
// Cost per full 5-word generation (~900 input / ~200 output tokens per call):
//   gpt-4         ~$0.20   <- legacy, 15x the price for no real quality gain
//   gpt-4o        ~$0.02   <- default: good factual quality for etymology
//   gpt-4o-mini   ~$0.0013 <- cheapest; verify etymology accuracy before using
//
// With the daily blob cache this runs once per day, so even gpt-4o is well
// under $1/month. Verify current names/prices at openai.com/api/pricing.
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const TEMPERATURE = 0.8;
const MAX_TOKENS = 500;

// The platform kills a synchronous function at 10s WITHOUT running our catch
// block, so we bail on our own terms well before that.
// Overridable so the CLI preview script can wait longer than a serverless
// function is allowed to. Production defaults are unchanged.
const OPENAI_CALL_TIMEOUT_MS = Number(process.env.OPENAI_CALL_TIMEOUT_MS) || 7000;
const TOTAL_BUDGET_MS = Number(process.env.OPENAI_TOTAL_BUDGET_MS) || 8500;

// How many times we re-roll duplicate/inappropriate words before patching
// those slots from the fallback set.
const MAX_REGEN_PASSES = 2;

const STORE_NAME = 'etymon-puzzles';

const DIFFICULTIES = [
  {
    level: 'novitiate',
    complexity: 'VERY EASY words that most people know: MICROSCOPE, TELEPHONE, BICYCLE, PHOTOGRAPH, TELEGRAPH. Roots should be extremely obvious and familiar.'
  },
  {
    level: 'disciple',
    complexity: 'MODERATELY EASY words: GEOGRAPHY, BIOLOGY, THERMOMETER, AUTOBIOGRAPHY, AQUARIUM. Common words with recognizable roots, but slightly less obvious than novitiate level.'
  },
  {
    level: 'scholar',
    complexity: 'CHALLENGING words: PHILANTHROPY, CLAUSTROPHOBIA, CACOPHONY, METAMORPHOSIS, SYNCHRONIZE. Less common vocabulary where roots are harder to connect.'
  },
  {
    level: 'magister',
    complexity: 'DIFFICULT words with obscure Latin roots: MAGNANIMOUS, VERISIMILITUDE, PUSILLANIMOUS, JUXTAPOSITION, PULCHRITUDE. Advanced vocabulary that educated adults may not use regularly.'
  },
  {
    level: 'etymologus',
    complexity: 'EXTREMELY DIFFICULT rare words: PERSPICACIOUS, LOQUACIOUS, RECALCITRANT, OBFUSCATE, TRUCULENT. Sophisticated academic vocabulary with complex, non-obvious etymological origins.'
  }
];

// ---------------------------------------------------------------------------
// Date helpers (everything is UTC so the scheduled run and the served day agree)
// ---------------------------------------------------------------------------

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Puzzles are fixed for the whole UTC day, so tell the CDN to hold the response
 * until midnight rather than re-validating every hour.
 */
function secondsUntilMidnightUTC() {
  const midnight = new Date().setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight - Date.now()) / 1000));
}

function buildPayload(date, puzzles, source) {
  return { date, generatedAt: new Date().toISOString(), source, puzzles };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate all five puzzles in parallel, then repair duplicate or
 * inappropriate slots. Always returns five playable puzzles.
 */
async function generateAllPuzzles(apiKey, deadline = Date.now() + TOTAL_BUDGET_MS) {
  let results = await Promise.all(
    DIFFICULTIES.map((d) => safeGeneratePuzzle(apiKey, d, [], deadline))
  );

  for (let pass = 0; pass < MAX_REGEN_PASSES; pass++) {
    const seen = new Set();
    const badIndexes = [];

    results.forEach((puzzle, i) => {
      if (isUsable(puzzle, seen)) {
        seen.add(puzzle.word);
      } else {
        badIndexes.push(i);
      }
    });

    if (badIndexes.length === 0) break;
    if (Date.now() >= deadline) {
      console.warn('Out of time budget — patching remaining slots from fallback.');
      break;
    }

    const avoid = Array.from(seen);
    const regenerated = await Promise.all(
      badIndexes.map((i) => safeGeneratePuzzle(apiKey, DIFFICULTIES[i], avoid, deadline))
    );
    badIndexes.forEach((slot, k) => {
      results[slot] = regenerated[k];
    });
  }

  // Safety net: patch any remaining bad slot from the fallback set for that tier.
  const seen = new Set();
  return results.map((puzzle, i) => {
    if (isUsable(puzzle, seen)) {
      seen.add(puzzle.word);
      return puzzle;
    }
    const substitute = FALLBACK_PUZZLES[i];
    console.warn(`Patching slot ${i} (${DIFFICULTIES[i].level}) with fallback: ${substitute.word}`);
    seen.add(substitute.word);
    return substitute;
  });
}

function isUsable(puzzle, seen) {
  return Boolean(
    puzzle && isValidPuzzle(puzzle) && isAppropriateWord(puzzle) && !seen.has(puzzle.word)
  );
}

/** Wraps generatePuzzle so one failed call can't reject the whole batch. */
async function safeGeneratePuzzle(apiKey, difficulty, avoidWords, deadline) {
  if (Date.now() >= deadline) return null;
  try {
    return await generatePuzzle(apiKey, difficulty, avoidWords, deadline);
  } catch (error) {
    console.error(`Generation failed for ${difficulty.level}:`, error.message);
    return null;
  }
}

async function generatePuzzle(apiKey, difficulty, avoidWords, deadline) {
  const avoidClause = avoidWords.length
    ? `\n\nIMPORTANT: Do NOT use these words that have already been generated: ${avoidWords.join(', ')}`
    : '';

  const prompt = `You are an expert etymologist creating a word puzzle. Generate a single word with its etymology for the difficulty level: "${difficulty.level}" (${difficulty.complexity}).

Requirements:
- Choose ONE word appropriate for this difficulty level
- Word must be 15 letters or fewer
- The word should have clear Greek or Latin etymological roots
- AVOID words related to: violence, death, cannibalism, sexual content, bodily functions, or other inappropriate topics
- Choose neutral, educational vocabulary suitable for all ages${avoidClause}

CRITICAL for clue format:
- Do NOT show the actual root words (no "tele, graphein" or "philos, anthropos")
- Instead, describe what the roots MEAN in English
- Keep it challenging but fair - describe the meaning, not the word itself
- Format: "Greek/Latin roots meaning: [description of meanings]"

Examples of GOOD clues:
- "Greek roots meaning: far, to write" (for TELEGRAPH)
- "Greek roots meaning: love, human" (for PHILANTHROPY)
- "Latin roots meaning: great, soul" (for MAGNANIMOUS)
- "Greek roots meaning: through, to look" (for PERSPICACIOUS)

Examples of BAD clues (too specific):
- "Greek: tele, graphein" (reveals the actual roots)
- "An instrument for distant viewing" (describes the word, not roots)

CRITICAL for detailedEtymology:
- MUST trace the word's path through languages (e.g., "Entered English in the 1600s from Greek philanthropia through Latin philanthropia")
- Include when the word entered English
- Mention intermediate languages if applicable (Greek → Latin → French → English)
- Add 1-2 interesting historical facts about the word's usage or meaning evolution

Example detailedEtymology format:
"First recorded in English in 1610-20, this word traveled from Greek 'tele' (far) and 'skopein' (to look) through New Latin 'telescopium.' Galileo popularized the term when he improved the spyglass design, revolutionizing astronomy by allowing observation of distant celestial objects."

Respond ONLY with valid JSON in this exact format:
{
  "word": "WORD_IN_CAPS",
  "clue": "Greek/Latin roots meaning: [description]",
  "definition": "Brief dictionary definition",
  "briefEtymology": "From Greek/Latin root1 (meaning) and root2 (meaning)",
  "detailedEtymology": "2-3 sentences following the format above - MUST include date and language progression"
}`;

  const timeoutMs = Math.min(OPENAI_CALL_TIMEOUT_MS, Math.max(0, deadline - Date.now()));
  if (timeoutMs <= 0) throw new Error('No time budget remaining');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert etymologist. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS
      })
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  let puzzle;
  try {
    puzzle = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    throw new Error('Invalid JSON from GPT');
  }

  // Normalize at the source so gameplay and results can never disagree.
  puzzle.word = String(puzzle.word || '').toUpperCase().trim();

  puzzle.difficulty = difficulty.level;
  puzzle.isSpeedRound = difficulty.level !== 'etymologus';
  puzzle.isFinalChallenge = difficulty.level === 'etymologus';

  return puzzle;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidPuzzle(puzzle) {
  const required = ['word', 'clue', 'definition', 'briefEtymology', 'detailedEtymology'];
  return (
    required.every((f) => typeof puzzle[f] === 'string' && puzzle[f].trim().length > 0) &&
    /^[A-Z]+$/.test(puzzle.word)
  );
}

function isAppropriateWord(puzzle) {
  if (puzzle.word.length > 15) {
    console.log(`Word too long: ${puzzle.word} (${puzzle.word.length} letters)`);
    return false;
  }

  const inappropriateTerms = [
    'cannibal', 'anthropophag', 'kill', 'murder', 'death', 'corpse',
    'torture', 'violent', 'genocide', 'suicide', 'blood', 'gore',
    'rape', 'sexual', 'erotic', 'pornograph', 'incest',
    'feces', 'excrement', 'defecate', 'urinate', 'vomit'
  ];

  const text = `${puzzle.word} ${puzzle.definition} ${puzzle.briefEtymology} ${puzzle.detailedEtymology}`.toLowerCase();
  return !inappropriateTerms.some((term) => text.includes(term));
}

// ---------------------------------------------------------------------------
// Fallback set — one per difficulty tier, in order.
// ---------------------------------------------------------------------------

const FALLBACK_PUZZLES = [
  {
    word: 'TELESCOPE',
    clue: 'Greek roots meaning: far, to look or see',
    definition: 'An optical instrument designed to make distant objects appear nearer.',
    briefEtymology: 'From Greek tele (far) and skopein (to look)',
    detailedEtymology: "First coined in the early 1600s when Galileo improved upon the spyglass design. The word combines tele, meaning 'far off,' with skopein, 'to look at.' The telescope revolutionized astronomy by allowing humans to observe distant celestial objects.",
    difficulty: 'novitiate',
    isSpeedRound: true,
    isFinalChallenge: false
  },
  {
    word: 'DEMOCRACY',
    clue: 'Greek roots meaning: people, power or rule',
    definition: 'A system of government by the whole population.',
    briefEtymology: 'From Greek demos (people) and kratos (power)',
    detailedEtymology: "Originating in ancient Athens around 508 BCE, democracy literally means 'rule by the people.' The demos referred to the common people of Athens, while kratos signified strength or power.",
    difficulty: 'disciple',
    isSpeedRound: true,
    isFinalChallenge: false
  },
  {
    word: 'PHILANTHROPY',
    clue: 'Greek roots meaning: loving, human being',
    definition: 'The desire to promote the welfare of others through generous donation.',
    briefEtymology: 'From Greek philos (loving) and anthropos (human)',
    detailedEtymology: "Entering English in the 1600s, philanthropy literally translates to 'love of humanity.' The concept dates back to ancient Greek philosophy where philanthropia was considered a fundamental virtue.",
    difficulty: 'scholar',
    isSpeedRound: true,
    isFinalChallenge: false
  },
  {
    word: 'MAGNANIMOUS',
    clue: 'Latin roots meaning: great, soul or spirit',
    definition: 'Generous or forgiving, showing nobility of spirit.',
    briefEtymology: 'From Latin magnus (great) and animus (soul)',
    detailedEtymology: "This word entered English in the 1580s. It literally means 'great-souled' and was used in classical philosophy to describe the virtue of having a generous and noble disposition.",
    difficulty: 'magister',
    isSpeedRound: true,
    isFinalChallenge: false
  },
  {
    word: 'PERSPICACIOUS',
    clue: 'Latin roots meaning: through, to look',
    definition: 'Having a ready insight into things; acutely perceptive.',
    briefEtymology: 'From Latin per (through) and spicere (to look)',
    detailedEtymology: "Dating from the 1610s, perspicacious derives from perspicax, the Latin word for 'sharp-sighted.' The prefix per- intensifies spicere (to look), suggesting the ability to see through appearances to underlying truths.",
    difficulty: 'etymologus',
    isSpeedRound: false,
    isFinalChallenge: true
  }
];

module.exports = {
  MODEL,
  STORE_NAME,
  TOTAL_BUDGET_MS,
  DIFFICULTIES,
  FALLBACK_PUZZLES,
  generateAllPuzzles,
  isValidPuzzle,
  isAppropriateWord,
  todayUTC,
  secondsUntilMidnightUTC,
  buildPayload
};
