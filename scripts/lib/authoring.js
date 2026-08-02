/**
 * Shared authoring logic for the corpus pipeline.
 *
 * This is deliberately separate from netlify/lib/puzzles.js. That file is the
 * *runtime* path and stays until cutover; this one is the *authoring* path and
 * has a different prompt (better tier examples, no placeholder text) plus a
 * much stricter validation suite. When the corpus takes over serving, the
 * runtime generator can be deleted and this becomes the only prompt.
 */

// A word is one letter box on a phone. 15 gives ~17px boxes on an iPhone SE.
const MAX_WORD_LENGTH = 13;

// Tier examples drive what the model produces, so they're chosen to sit in the
// "recognisable but not top-of-mind" band. The previous prompt named
// PULCHRITUDE and VERISIMILITUDE, which is exactly why it kept producing them.
const TIERS = [
  {
    level: 'novitiate',
    guidance:
      'VERY EASY. Everyday compound words whose roots are obvious once pointed out: ' +
      'TELEPHONE, BICYCLE, PHOTOGRAPH, MICROSCOPE, TELEVISION, AUTOMOBILE.'
  },
  {
    level: 'disciple',
    guidance:
      'EASY. Common words, roots slightly less obvious: ' +
      'GEOGRAPHY, BIOLOGY, THERMOMETER, AQUARIUM, DEMOCRACY, MANUSCRIPT.'
  },
  {
    level: 'scholar',
    guidance:
      'MODERATE. Vocabulary any educated adult knows, but has to think about: ' +
      'METAMORPHOSIS, CACOPHONY, PHILANTHROPY, SYNCHRONIZE, ANONYMOUS, BENEVOLENT.'
  },
  {
    level: 'magister',
    guidance:
      'HARD. Words a well-read adult knows but rarely uses: ' +
      'MAGNANIMOUS, MISANTHROPE, EPHEMERAL, ANACHRONISM, SOLILOQUY, CIRCUMVENT.'
  },
  {
    level: 'etymologus',
    guidance:
      'HARDEST — but still recognisable on sight, never dictionary-only: ' +
      'OBFUSCATE, RECALCITRANT, LOQUACIOUS, INCORRIGIBLE, PERFUNCTORY, INTRANSIGENT.'
  }
];

const TIER_LEVELS = TIERS.map(t => t.level);

function buildPrompt(tier, avoidWords = []) {
  const avoid = avoidWords.length
    ? `\n\nAlready used — do NOT choose any of these:\n${avoidWords.join(', ')}`
    : '';

  return `You are an expert etymologist writing a word puzzle. Produce ONE word for the difficulty tier "${tier.level}".

Tier: ${tier.guidance}

Hard requirements:
- The word must be ${MAX_WORD_LENGTH} letters or fewer, letters only (no spaces or hyphens).
- A well-read adult must RECOGNISE the word on sight, even if they rarely use it. If a reader would need a dictionary to know it exists, choose a different word. This matters more than difficulty.
- It must have clear, real Greek or Latin roots.
- Avoid violence, death, sexual content, bodily functions, and anything unsuitable for all ages.${avoid}

Writing the clue:
- State what the roots MEAN in plain English. Never print the roots themselves.
- Never include the answer, or any part of the answer, in the clue. For QUINTESSENCE do not write "five, essence" — "essence" is inside the answer. Write "fifth, being" instead.
- Do not define the word. "An instrument for seeing far away" describes the answer; "far, to look" describes the roots.
- Format exactly: "Greek roots meaning: x, y" or "Latin roots meaning: x, y". If the roots are from both languages, say "Greek and Latin roots meaning: x, y".
- The language you name in the clue MUST match the language in briefEtymology.

Writing the etymology:
- briefEtymology names the actual roots and their meanings.
- detailedEtymology must give the century or year the word entered English, trace the path between languages, and add one genuinely interesting fact.
- ACCURACY IS CRITICAL. If you are not confident of a date or derivation, choose a different word rather than guessing. A plausible-sounding invented etymology is the worst possible output.

Return ONLY this JSON, with no code fence and no commentary:
{
  "word": "TELESCOPE",
  "clue": "Greek roots meaning: far, to look",
  "definition": "An optical instrument that makes distant objects appear nearer.",
  "briefEtymology": "From Greek tele (far) and skopein (to look)",
  "detailedEtymology": "First recorded in English in 1611, from Italian telescopio and New Latin telescopium, coined in Galileo's circle. Galileo did not invent the design but his improvements made it an astronomical instrument."
}

Replace every value with your own word's details. Do not echo the example.`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['word', 'clue', 'definition', 'briefEtymology', 'detailedEtymology'];

// Text the model sometimes copies straight out of a prompt template.
const PLACEHOLDER_PATTERNS = [
  /\broot1\b/i, /\broot2\b/i, /\[description\]/i, /\[meaning/i,
  /WORD_IN_CAPS/i, /\bx, y\b/i, /Greek\/Latin/i
];

const BANNED_TERMS = [
  'cannibal', 'anthropophag', 'kill', 'murder', 'death', 'corpse',
  'torture', 'violent', 'genocide', 'suicide', 'blood', 'gore',
  'rape', 'sexual', 'erotic', 'pornograph', 'incest',
  'feces', 'excrement', 'defecate', 'urinate', 'vomit'
];

// Words too short to be meaningful overlaps when substring-checking the clue.
const CLUE_STOPWORDS = new Set([
  'greek', 'latin', 'roots', 'root', 'meaning', 'and', 'or', 'the', 'a', 'an',
  'of', 'to', 'in', 'on', 'for', 'with', 'from', 'that', 'which', 'be', 'is'
]);

/**
 * Mechanical checks only.
 *
 * IMPORTANT: none of this can detect a fabricated etymology. Every rule here
 * verifies shape, not truth. A confidently invented date passes all of them.
 * Human fact-checking is the only defence.
 *
 * Returns { rejects: [...], flags: [...] } — rejects are disqualifying,
 * flags are worth a human glance but not automatic removal.
 */
function auditCandidate(c, { usedWords = new Set(), maxLength = MAX_WORD_LENGTH } = {}) {
  const rejects = [];
  const flags = [];

  for (const f of REQUIRED_FIELDS) {
    if (typeof c?.[f] !== 'string' || !c[f].trim()) {
      rejects.push(`missing field: ${f}`);
    }
  }
  if (rejects.length) return { rejects, flags };

  const word = c.word.toUpperCase().trim();
  const clue = c.clue.trim();
  const allText = `${word} ${c.definition} ${c.briefEtymology} ${c.detailedEtymology}`.toLowerCase();

  if (!/^[A-Z]+$/.test(word)) rejects.push('word is not pure A-Z');
  if (word.length > maxLength) rejects.push(`word is ${word.length} letters (max ${maxLength})`);
  if (word.length < 4) rejects.push('word is too short to play');
  if (usedWords.has(word)) rejects.push('duplicate word');

  // Placeholder leakage — PHILOSOPHY once shipped "root1 (meaning love)".
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(clue) || p.test(c.briefEtymology) || p.test(c.detailedEtymology)) {
      rejects.push(`prompt placeholder text: ${p.source}`);
      break;
    }
  }

  // Clue must not contain the answer, or any fragment of it. The old check
  // looked for the whole word only, which is how QUINTESSENCE/"essence" passed.
  const clueBody = clue.replace(/^.*?meaning:/i, '').toLowerCase();
  const lowerWord = word.toLowerCase();
  if (clueBody.includes(lowerWord)) {
    rejects.push('clue contains the answer');
  } else {
    for (const token of clueBody.match(/[a-z]+/g) || []) {
      if (token.length < 4 || CLUE_STOPWORDS.has(token)) continue;
      if (lowerWord.includes(token)) {
        rejects.push(`clue word "${token}" is inside the answer`);
        break;
      }
    }
  }

  if (!/^(Greek|Latin|Greek and Latin) roots? meaning:/i.test(clue)) {
    flags.push('clue does not follow the "X roots meaning:" format');
  }

  // Clue language vs. etymology language. SYNTHESIZE claimed Greek roots in the
  // clue and a Latin root in the etymology.
  const clueSaysGreek = /greek/i.test(clue);
  const clueSaysLatin = /latin/i.test(clue);
  const etyGreek = /greek/i.test(c.briefEtymology);
  const etyLatin = /latin/i.test(c.briefEtymology);
  if (clueSaysGreek && !clueSaysLatin && etyLatin && !etyGreek) {
    rejects.push('clue says Greek but etymology says Latin');
  }
  if (clueSaysLatin && !clueSaysGreek && etyGreek && !etyLatin) {
    rejects.push('clue says Latin but etymology says Greek');
  }

  // A date is required — its presence is checkable, its correctness is not.
  if (!/\b(\d{3,4}\s*(BCE|BC|CE|AD)|1[0-9]{3}|20[0-2][0-9]|[0-9]{1,2}(st|nd|rd|th)\s+century|[0-9]{4}s)\b/i
        .test(c.detailedEtymology)) {
    rejects.push('no date in detailed etymology');
  }

  if (BANNED_TERMS.some(t => allText.includes(t))) {
    rejects.push('contains banned subject matter');
  }

  // Clue restating the definition rather than the roots — flagged, not rejected,
  // because the overlap is sometimes legitimate.
  const defWords = new Set((c.definition.toLowerCase().match(/[a-z]{5,}/g) || []));
  const clueWords = (clueBody.match(/[a-z]{5,}/g) || []);
  const overlap = clueWords.filter(t => defWords.has(t));
  if (clueWords.length && overlap.length / clueWords.length > 0.5) {
    flags.push(`clue may restate the definition (${overlap.join(', ')})`);
  }

  if (c.detailedEtymology.trim().split(/\s+/).length < 20) {
    flags.push('detailed etymology is very short');
  }

  return { rejects, flags };
}

function etymonlineUrl(word) {
  return `https://www.etymonline.com/word/${encodeURIComponent(word.toLowerCase())}`;
}

function normalise(c, tierLevel) {
  return {
    word: String(c.word || '').toUpperCase().trim(),
    clue: String(c.clue || '').trim(),
    definition: String(c.definition || '').trim(),
    briefEtymology: String(c.briefEtymology || '').trim(),
    detailedEtymology: String(c.detailedEtymology || '').trim(),
    difficulty: tierLevel
  };
}

module.exports = {
  MAX_WORD_LENGTH,
  TIERS,
  TIER_LEVELS,
  buildPrompt,
  auditCandidate,
  etymonlineUrl,
  normalise
};
