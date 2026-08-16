# Corpus Runbook

How to produce Etymon's daily puzzles. Written to be picked up cold — if it's been three months, start at the top and follow it down.

---

## The idea in 30 seconds

Etymon used to call GPT at runtime, which meant repeated words, obscure vocabulary, and — the reason this pipeline exists — **etymologies that were confidently wrong**. No automated check can tell a real etymology from an invented one. A human has to look.

So GPT became an authoring tool instead of a runtime dependency. You generate a pile of candidates, the tooling throws out the mechanically broken ones, you fact-check what's left, and the approved words ship as a static file. The game then costs nothing to run and can't serve a made-up word history.

```
corpus:generate  →  corpus/review.json    candidates awaiting review
corpus:review    →  corpus/review.json    same file, now marked
corpus:compile   →  public/corpus.json    what the game serves
```

---

## Before you start

```bash
cd ~/Apps/etymon-project
git pull                 # if you work from more than one machine
npm install              # only needed after a fresh clone
```

You need `OPENAI_API_KEY` in `.env`. It's already there if the game has ever generated a puzzle. Confirm it's still ignored by git:

```bash
git check-ignore .env    # prints ".env" = good. Prints nothing = STOP, fix .gitignore
```

---

## Step 1 — Generate candidates

**Always smoke-test first.** Five per tier takes about a minute and shows you what the prompt is currently producing before you spend real money on a full run.

```bash
npm run corpus:generate -- --count 5
```

Read the output. If the words look sensible and the clues aren't giving away answers, go full:

```bash
npm run corpus:generate
```

Roughly 500 accepted candidates, 10–20 minutes, a few dollars.

**What you'll see.** Dots scroll past per tier — green accepted, yellow auto-rejected, red API error. Then a histogram:

```
Why candidates were rejected
    47  no date in detailed etymology
    31  duplicate word
    12  clue word "..." is inside the answer
```

**That histogram is the most useful output of the whole run.** It turns "the clues feel off" into a specific, fixable thing. If one reason dominates, tune the matching instruction in `scripts/lib/authoring.js` (`buildPrompt`) and regenerate.

**It's resumable.** Disk is written after every batch. Kill it, re-run it, and each tier tops up toward the target rather than starting over. If a tier stops producing new words for three batches, it gives up and says *"model ran dry"* — that tier has exhausted what it can offer at that difficulty.

### Options

| Flag | Effect |
|---|---|
| `--count 40` | candidates per tier (default 100) |
| `--tier scholar` | one tier only — useful after a prompt tweak |
| `--model gpt-4o-mini` | cheaper, noticeably more fabrication |
| `--concurrency 3` | fewer parallel requests if you hit rate limits |
| `--reset` | discard everything and start fresh |

---

## Step 2 — Review (the real work)

```bash
npm run corpus:review
```

Open **http://localhost:4100**. Leave it running; it writes to disk after every keystroke, so you can close the tab and come back whenever.

| Key | Action |
|---|---|
| `a` | approve, jump to next unreviewed |
| `r` | reject, jump to next unreviewed |
| `t` | cycle the difficulty tier |
| `s` | open this word on Etymonline |
| `←` `→` | move between entries |
| `u` | jump to next unreviewed |

### What you're actually deciding

**1. Is the etymology true?** The only question that matters, and the only one the tooling can't answer. Press `s`, and check three things against Etymonline:

- **the date** — is it the right century?
- **the language path** — did it really come through Latin, or straight from Greek?
- **the roots** — do the named roots exist and mean what's claimed?

**2. Would a well-read adult recognise this word?** If they'd need a dictionary to know it exists, reject it. An unknown word isn't hard, it's unguessable.

**3. Does the clue work?** It should describe what the roots *mean* without leaking the answer or restating the definition.

**4. Is it in the right tier?** Press `t` to move it. Tier assignment from the model is unreliable — this is a judgement call.

### What a bad entry looks like

These are real, and all four passed every automated check:

- **CONUNDRUM** — sold as Latin. It isn't. Etymonline: unknown origin, 1590s Oxford slang, *mock*-Latin. The joke is that it's fake Latin, served as real.
- **TELEPHONE** — "first recorded 1876." Actually 1835, from French. Wrong by forty years, with an invented Latin intermediate.
- **PERSPICACITY** — roots given as *perspicax* + *capere* (to seize). The real root is *specere* (to look). Its own clue contradicted it.
- **CARTOGRAPHY** — "late 16th century." Actually 19th.

All plausible. All wrong. That's the failure mode to watch for — not obvious nonsense, but confident detail that doesn't survive a lookup.

### Pacing

About 20 seconds an entry. ~500 entries is a couple of hours, and it doesn't have to be one sitting.

Watch the **days ready** counter at the top. That's the smallest approved count across the five tiers — since every day needs one word per tier, it's your true coverage. Approving twelve scholar words does nothing if magister is still at three. If one tier lags, generate more of just that tier:

```bash
npm run corpus:generate -- --tier magister --count 40
```

---

## Step 3 — Compile

```bash
npm run corpus:compile
```

Takes everything marked `approved`, drops globally duplicate words, and lays them out one per tier per day starting tomorrow. Writes `public/corpus.json` and prints the date range covered.

```bash
npm run corpus:compile -- --start 2026-08-01    # choose the first date
npm run corpus:compile -- --days 30             # cap the length
```

Re-running is safe — it rebuilds from scratch each time.

⚠️ **`--start` decides which words land on which days.** Once real players have played a date, don't recompile with a different start, or you'll shuffle puzzles people have already seen. When extending later, keep the same `--start` and let it run longer.

### Staging: compile before reviewing (dogfooding only)

To get a playable corpus live before hand-reviewing every entry:

    npm run corpus:compile -- --include-unreviewed --start <date>

This ships every candidate that isn't explicitly `rejected` — including
`unreviewed` ones. Etymologies are NOT fact-checked. It prints a warning
every time. Use it only to get something in front of dogfooders.

Before any real/public launch, re-compile WITHOUT the flag from a properly
reviewed set. Ask dogfooders to flag etymologies that seem wrong — they
become a free first-pass fact-check.

---

## Step 4 — Ship

```bash
git add corpus/review.json public/corpus.json
git commit -m "Add reviewed corpus through <end date>"
git push origin main
```

Netlify deploys from `main`, so it's live on push.

Commit `review.json` too — it's the record of what you approved and rejected, and it's what makes the next top-up resumable.

Verify: load the site, open a function log, and look for `servedFrom: "corpus"`. If you see `"generated"` instead, the date isn't covered by the corpus and it fell back to live generation.

---

## Topping up later

The recurring loop once a corpus exists:

```bash
npm run corpus:generate -- --count 60    # adds to what's already there
npm run corpus:review                    # only new entries show as unreviewed
npm run corpus:compile -- --start <same start date as before>
git add corpus/review.json public/corpus.json && git commit -m "Extend corpus" && git push
```

You only need to stay ahead of your players. Check coverage any time:

```bash
node -e "const c=require('./public/corpus.json');console.log(c.days,'days:',c.startDate,'→',c.endDate)"
```

**Dates past the end aren't a dead end** — the game falls back to live generation, exactly as it worked before. Running out degrades quality, not availability.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `OPENAI_API_KEY not found` | Run via `npm run`, not `node` directly — npm loads `.env` |
| `Cannot find module './lib/authoring'` | `authoring.js` belongs in `scripts/lib/`, not `netlify/lib/` |
| Lots of red `!` during generate | API rate limit or outage. Lower `--concurrency`, or wait |
| "model ran dry" on a tier | Normal — it's out of fresh words at that difficulty. Try again later, or widen that tier's examples in `authoring.js` |
| Review page is empty | No `corpus/review.json` yet — run generate first |
| `Cannot build a single day` | A tier has zero approvals. The message names it |
| Days ready stuck at a low number | One tier is starving. Generate more of just that tier |
| Site still shows generated puzzles | Date is past `endDate`, or `corpus.json` wasn't committed |
| Port 4100 in use | `REVIEW_PORT=4200 npm run corpus:review` |

---

## Reference

### Files

```
scripts/
  lib/authoring.js      prompt + all validation rules  ← tune the prompt here
  generate-corpus.js    stage 1-2
  review-corpus.js      stage 3 (local server, never deploys)
  compile-corpus.js     stage 4
corpus/
  review.json           candidates + your decisions     ← committed
  rejected.json         auto-rejects with reasons       ← gitignored
public/
  corpus.json           what the game serves            ← committed
```

### Entry states

`unreviewed` → not yet looked at · `approved` → ships · `rejected` → ignored, kept on record

### Settings worth knowing

- **Max word length** — `MAX_WORD_LENGTH` in `scripts/lib/authoring.js`, currently **13**. Longer words mean smaller letter boxes on a phone.
- **Words per day** — five, one per tier. Changing this touches the compiler and the game.
- **Model** — defaults to `gpt-4o`. Don't economise here; you generate once and read the results forever.

### A standing caveat

The automated checks verify **shape, not truth**. A fabricated etymology passes every one of them — there's even a test asserting that it does, so nobody later mistakes the checks for fact-checking. Your review is the only thing standing between a made-up word history and a player reading it as fact.
