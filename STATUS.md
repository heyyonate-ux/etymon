# STATUS — start here

*The "you are here" file. Read this first when you come back after a break, before touching anything. Everything else (`CORPUS.md`, `LAUNCH.md`, the briefs) is reference; this is your bookmark.*

**Last updated: September 30, 2026** — update the date and the two live sections whenever you stop work.

---

## Where the project is right now

The redesign and corpus pipeline are live on `main`. The staging corpus now runs **2026-08-18 → 2026-11-20 (95 days, 475 words)**, compiled with `--include-unreviewed`. Nearly all of it is unverified; the compile reported 438 unreviewed candidates in `review.json`. `servedFrom: "corpus"` is **confirmed** in the `get-daily-puzzle` logs ("Serving 2026-09-30 from corpus.").

**This session (Sep 30):**

1. **Fixed: demo puzzles could get stuck for a whole day.** If the puzzle fetch failed (seen on iOS after a wifi drop), `initGame()` loaded the built-in demo puzzles but stamped them with today's real date. `saveState()` then stored them under today's key, `loadState()` trusted that save on every reload, and the player was stuck on demo puzzles even after the connection came back. Fixed by setting `puzzlesDate = 'demo'` in the fetch-failure path, so `loadState()` discards demo saves and the next load refetches. The fix is in `public/index.html`.
2. **Fixed: the generator stalled on duplicates.** `generate-corpus.js` told the model to avoid only the last 120 words on disk, so it kept re-suggesting older words, which were then rejected as duplicates. Scholar stalled at 59/95 because of this. The generator now sends the full word list, with the current tier's words last.
3. **Extended the corpus by 41 days** (Oct 10 → Nov 20). A snapshot comparison confirmed all 54 previously assigned days were unchanged.
4. **Code review corrected several "unclear" items** (see Next actions). Timer decay is per-second and escalating, ranks are rounded to the nearest thousand, there's a copyright line, a local streak (`whence:streak`), a same-day "already played" lock, and a first-visit auto-open of the rules menu.

**Earlier (Aug 22):** fixed stale puzzles on PWA resume (`visibilitychange`/`pageshow` reload on date change) and added the `puzzlesDate` validation on saved state. Both are confirmed working.

---

## ⏭️ Next actions (in order)

1. **Fix the failing scheduled `generate-daily-puzzle`.** Every run fails with a Netlify Blobs `uncachedEdgeURL` / strong-consistency error. It calls gpt-4o, generates puzzles, then fails to save them, and this happens up to 3× per scheduled run. That means daily OpenAI spend is being thrown away, and the fallback cache is likely empty if the corpus ever runs out. The likely fix is one line in how the function opens the blob store. Paste `generate-daily-puzzle.js` to get the exact edit.
2. **Decide whether the first-visit tutorial is enough.** First-time players already get the rules menu opened automatically (`isFirstVisit()` → `openMenu()`). The open question is whether that satisfies testers who found the game unclear, or whether it needs a dedicated intro screen.
3. **Verify the remaining dogfood fixes in the live code:** a clickable link in the share text, root words/etymology in the *per-round* result modal, and the iOS-only results-modal scroll bug. Their status hasn't been checked.
4. **Optional hardening of the fetch-failure path:** retry once before falling back to demo puzzles (a wifi handoff blip usually clears in a second or two), and replace the `alert()` with a small inline "offline — showing practice puzzles" note.
5. **Next corpus top-up by ~early November.** The corpus ends Nov 20; keep about 2+ weeks of buffer.
6. **Before any real/public launch:** re-compile *without* `--include-unreviewed` from a fully hand-reviewed set.
7. **Domain purchase, when ready (not urgent):** do a registrar check on `whence.app` / `whence.game`. This is still gated behind Phase 4; the subdomain, share URL, and repo rename move together as a unit.
8. **Rename tail, low priority:** `public/manifest.json` (`name`/`short_name`), `README.md`.

Full launch gate is in `LAUNCH.md`. Full phased plan is in `ROADMAP.md`/`TODO.md`. Full naming history is in `RENAME.md`.

---

## 🔦 Open questions / unfinished

- **Mobile keyboard scroll**: no live complaints, but never explicitly re-verified post-redesign. Treat it as "probably fine."
- **Susan's "state isn't cached" complaint**: local state and a streak *do* exist in the code. Her report may predate them or may have been a failed-fetch/demo episode like the one fixed today. Worth asking her whether it still happens.
- **Preview vs. corpus prompt**: `scripts/preview-puzzles.js` still uses the runtime prompt, not the stricter authoring prompt.
- **A stale code comment**: around line 1956 of `index.html`, a comment still refers to decay "intervals" of 3.0s–1.0s from the old design. It's cosmetic; tidy it the next time you're in there.
- **Punycode `DEP0040` warning** in function logs: harmless, no action needed.

---

## 🔁 The three routines (different clocks)

**A. Working on the game** (most sessions).
```bash
npm run dev:fallback        # play at localhost:8888, no API cost
# edit, refresh, repeat; npx playwright test before pushing gameplay changes
git add . && git commit -m "..." && git push
```

**B. Tuning clue quality** (occasional).
```bash
npm run puzzles             # prints 5 clues to judge (costs a few cents)
# tweak the prompt in scripts/lib/authoring.js, run again
```

**C. Banking puzzle days** (periodic; next due ~early November).
```bash
git checkout main && git pull && git status          # start clean
cp public/corpus.json /tmp/corpus-before.json         # snapshot for the safety check
npm run corpus:generate -- --count <TARGET>           # TARGET = total per tier, NOT an amount to add
npm run corpus:review                                 # optional for staging; required before launch
npm run corpus:compile -- --include-unreviewed --start 2026-08-18
```
Then run both checks below and commit `corpus/review.json` + `public/corpus.json`.

**How `--count` works:** it tops each tier up to a *total*, which includes entries rejected in review. Currently each tier holds about 95–100 entries. For 30 more days, use roughly `--count 130`. If a tier stops early ("no new words in last 3 batches"), rerun it with `--tier <name>`.

---

## ⚠️ Rules that must never be broken (routine C)

1. **Always `--start 2026-08-18`**: the same date, forever.
2. **Never `--reset`**: it wipes `review.json`, your entire puzzle history.
3. **Don't reject a word that's already been scheduled to a past date.** The compiler assigns words to days in `review.json` order, so removing an early word shifts every later day and changes puzzles testers already played. Run the unchanged-days check after every compile.

Checks after any compile:
```bash
node -e "const c=require('./public/corpus.json');console.log(c.startDate,'→',c.endDate,'('+c.days+' days)')"
node -e "const a=require('/tmp/corpus-before.json').puzzles,b=require('./public/corpus.json').puzzles;const bad=Object.keys(a).filter(d=>JSON.stringify(a[d].map(p=>p.word))!==JSON.stringify((b[d]||[]).map(p=>p.word)));console.log(bad.length?'CHANGED: '+bad.join(', '):'All '+Object.keys(a).length+' existing days unchanged')"
```
The first should currently echo `2026-08-18 → 2026-11-20 (95 days)`. The second must report all existing days unchanged; if it doesn't, don't commit.

---

## 🗺️ Where things live

```
public/index.html                  the whole game — includes the Aug-22 and Sep-30 fixes
public/manifest.json                PWA manifest — rename tail still pending
public/corpus.json                  compiled puzzles (live: 95 days, through 2026-11-20)
netlify/functions/                  get-daily-puzzle (serves), generate-daily-puzzle (scheduled fallback — currently failing, see Next #1)
netlify/lib/puzzles.js              runtime generation logic
scripts/                            generate-corpus.js, review-corpus.js, compile-corpus.js, preview-puzzles.js
scripts/lib/authoring.js            authoring prompt + validation
corpus/review.json                  full candidate/review record — the memory, never lose this
corpus/rejected.json                gitignored
tests/, playwright.config.ts        Playwright
```

---

## 📌 Update protocol

When you finish a work session, update three things here: the **Last updated** date, **Where the project is now**, and **Next actions**. Sixty seconds.
