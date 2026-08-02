# Whence

**A daily word game about where words come from.**

Each day, five words — each harder than the last. You're shown what a word's Greek or Latin *roots* mean, never the word itself, and you guess your way to it letter by letter. Between rounds, you read where the word actually came from: when it entered English, the languages it passed through, and a bit of its history.

Wordle-adjacent in feel, but built around learning etymology rather than racing a clock.

**Live:** [etymon-game.netlify.app](https://etymon-game.netlify.app)

> **Note:** the app is mid-rename from *Etymon* to *Whence*; the deploy URL still reflects the old name.

---

## How it plays

- **Five rounds a day**, rising in difficulty through a scholar's ladder: Novitiate → Disciple → Scholar → Magister → Etymologus.
- **The clue gives you the roots' meanings**, e.g. *"Greek roots meaning: far, to look"* → TELESCOPE. It never shows the roots themselves or defines the word.
- **Guess letters.** A correct letter fills every position it appears in.
- **Your score starts at the round's maximum and falls** as the clock runs, on wrong guesses, and when you buy a hint — shown live, so the scoring explains itself with no tutorial. Time pressure tightens each round.
- **Stuck?** A hint reveals a random letter for a cost; Pass skips the word for zero.
- **After each round**, the word's full etymology and definition are revealed — the actual point of the game.
- Your five scores sum to a **daily rank**, from Novitiate up to Etymologus Maximus.

---

## Architecture

Deliberately lightweight: no frontend framework, minimal dependencies.

**Frontend** — a single `public/index.html` (HTML, CSS, vanilla JS). Parchment-and-serif aesthetic; mobile-first, responsive.

**Backend** — Netlify serverless functions. The player-facing function serves each day's five puzzles; the source is chosen in priority order:

1. **Curated corpus** — a static, hand-reviewed file (see below). The primary path.
2. **Blob cache** — a per-day cache for any generated set.
3. **Live generation** — an OpenAI call, as a fallback for dates the corpus doesn't yet cover.

**Hosting** — Netlify, auto-deploying from `main`.

---

## The puzzle corpus

The interesting engineering problem here isn't the game — it's the puzzles.

Early versions generated puzzles live from an LLM at request time. That surfaced a decisive problem: **language models fabricate etymologies.** They produce confident, plausible, well-formatted word histories with wrong dates, invented roots, and fictional backstories — and no automated check can tell a real etymology from an invented one, because the output is *shaped* correctly either way.

So the LLM was demoted from a runtime dependency to an **authoring tool**, behind a human curation pipeline:

```
generate candidates  →  auto-reject mechanical failures  →  human review + fact-check  →  compile static corpus  →  serve
```

- **`scripts/generate-corpus.js`** bulk-generates candidates and auto-rejects the mechanically broken ones (clue leaks the answer, wrong format, missing date, duplicates, banned content). It reports *why* candidates were rejected, so the prompt can be tuned against real data.
- **`scripts/review-corpus.js`** is a local review UI. Each candidate is fact-checked against Etymonline by a human — the one step no automation can replace — and approved, rejected, or re-tiered.
- **`scripts/compile-corpus.js`** lays the approved words out one-per-tier-per-day into a static, date-keyed file the game serves with no runtime LLM call.

The result: puzzles cost effectively nothing to serve, never repeat, and — crucially — never present an invented word history as fact.

The automated checks in this pipeline verify *shape, not truth*. That distinction is the whole design rationale, and it's enforced deliberately: there's even a test asserting that a well-formed but fabricated etymology passes every mechanical check, so the checks are never mistaken for fact-checking.

---

## Project layout

```
public/index.html                   the entire game
netlify/functions/
  get-daily-puzzle.js               serves the daily puzzle (corpus → cache → generate)
  generate-daily-puzzle.js          scheduled generation for the fallback path
netlify/lib/puzzles.js              shared runtime generation logic
scripts/
  generate-corpus.js                bulk candidate generation
  review-corpus.js                  human review + fact-check UI
  compile-corpus.js                 approved words → static corpus
  preview-puzzles.js                quick terminal preview for prompt tuning
  lib/authoring.js                  the authoring prompt + validation rules
```

Additional docs in the repo cover the corpus workflow (`CORPUS.md`), the launch checklist (`LAUNCH.md`), and security notes (`SECURITY.md`).

---

## Running locally

```bash
npm install
npm run dev:fallback     # play at localhost:8888 with no API calls
```

`dev:fallback` serves a fixed set of puzzles, so you can work on the game with no OpenAI cost. The corpus tooling is documented in `CORPUS.md`.

---

## Status

Active development. The game and the corpus pipeline are built; the curated corpus is being populated, and the *Etymon → Whence* rename is in progress. See `STATUS.md` for current state.

---

## Tech

Vanilla JS · Netlify Functions · OpenAI (authoring only) · no build step
