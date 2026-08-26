# STATUS — start here

*The "you are here" file. Read this first when you come back after a break, before touching anything. Everything else (`CORPUS.md`, `LAUNCH.md`, the briefs) is reference; this is your bookmark.*

**Last updated: August 26, 2026 (mid-session update — items 4/5 done, on a branch)** — update the date and the two live sections whenever you stop work.

---

## Where the project is right now

The redesign and corpus pipeline are merged to `main` and deployed. Dogfooding with the small trusted group has gone well — no one has flagged a bad etymology, both the app-resume and stale-save bugs from last week are confirmed fixed, and the Whence trademark clearance is done (informally reviewed, low risk, proceed).

**The goal has shifted: from "trusted friends" to "people I don't know."** That's a real change in threat model and quality bar, not just more of the same dogfooding — so this session re-triaged the open items specifically against "am I comfortable with a stranger opening this link." The unreviewed half of the corpus got pulled forward as a result of that re-triage (still open, currently deprioritized by choice — see Next actions).

**Correction, this session:** `SECURITY.md`/`RENAME.md`/the prior version of this file all described the fallback endpoint's CORS as wide open (`*`) with no rate limiting. Checked the actual deployed `netlify/functions/get-daily-puzzle.js` against that claim — it's wrong. The live code already restricts CORS to a real `ALLOWED_ORIGINS` whitelist (production URL + localhost, with a `403` for anything else) and already rate-limits the expensive on-demand-generation path to 10 attempts/IP/day, backstopped by the $30/mo OpenAI budget cap. This item is done, not open — the planning docs had just drifted from the code. `SECURITY.md`/`RENAME.md` should be corrected next time either is touched, and `ALLOWED_ORIGINS` will need a one-line update whenever the domain rename (item 3) actually happens, or the new domain will get silently blocked.

**Also found while reviewing `public/index.html` this session:** local streak (`whence:streak`) and first-visit tracking (`whence:visited`, driving the auto-shown intro modal) are already built and wired up — `updateStreak()`, `loadStreak()`/`saveStreak()`, and `isFirstVisit()`/`markVisited()` all exist and run. This resolves part of the "status unclear" open item on Phase 1 retention — the streak/first-visit piece is done, not missing. Still open: whether a same-day replay lock exists (Dad's "shouldn't be able to play twice a day" note) — not yet confirmed either way.

**Items 4 and 5 are done, pending deploy.** Instructions-modal height capped (game visible behind it instead of near-full-screen), the modal's own backdrop lightened to 50% opacity (scoped to `#menuModal` only — other modals unchanged), and Susan's two copy edits applied (welcome line no longer ends on "from"; Scoring bullets reworded out of second-person "you"). Built and reviewed in chat; being pushed to a branch for deploy-preview review before merging to `main`.

---

## ⏭️ Next actions (in order)

**Currently being worked through, in this order (per session plan, Aug 26):**

- ~~Corpus review completion~~ — skipped for now, by choice, not forgotten. Revisit before any wider/public link goes out.
- ~~CORS + rate limiting~~ — **done.** Verified against deployed `get-daily-puzzle.js`: real origin whitelist + 403 on mismatch, 10/IP/day cap on the generation path, $30/mo budget cap as backstop. No code change needed.
- ~~Domain + rename~~ — skipped for now, by choice.
- ~~Items 4 and 5~~ — **done, on a branch, not yet merged to `main`.**
  4. Shrink the initial instructions modal (Nate) — height capped, backdrop lightened to 50% opacity so the game reads as visible/waiting behind it.
  5. Instruction copy edits (Susan) — welcome line no longer ends on "from"; Scoring bullets reworded off second-person "you."
  Confirm the deploy-preview looks right — especially the modal's internal scroll behavior now that it's shorter than before, on an actual small screen — then merge.
- **Up next together: items 6–7.**
  6. **Android keyboard/viewport bug.** Answer tiles are cut off / require scrolling, and overall visible area is worse than iOS. Don't chase this in the Android Studio emulator — keyboard-triggered viewport resize behaves differently on real hardware. Plug a real Android phone into a laptop (USB debugging + `chrome://inspect`) for real DevTools on real hardware; "Dad" is already dogfooding on Android and is the fastest path to a test device or a screen recording.
  7. **Investigate auto-enabling "tap to type"** at round start and after dismissing the round-summary modal, so it doesn't need an explicit tap every round. Try attaching `.focus()` synchronously inside the existing tap handler that dismisses the round summary — that's still inside a genuine user-gesture call stack, which is what iOS/Android actually require, and may work without a dedicated extra tap.

**Not blocking, but worth doing before or shortly after the wider share:**

8. **Level indicator** — testers (Susan) found tier names (Novitiate, etc.) unclear without context.
9. **Horizontal rank scale on the final results modal**, achieved rank highlighted (Nate).
10. Small fixes: share-text has no clickable link in a text message; round scores round to the nearest thousand for display; add a copyright line (low priority — copyright protection is automatic on creation, this is a courtesy notice, not a legal requirement); root words/etymology shown in the *per-round* modal, not just the final summary; iOS-only results-modal scroll bug.
11. **Same-day replay lock** — confirm whether this exists (Dad's "shouldn't be able to play twice a day" note). Local streak + first-visit tracking are confirmed already built, so this is the one remaining unknown from the old Phase 1 retention item.

**Not blocking, worth thinking about, no action needed yet:**

12. **Beta/RC sharing via Netlify** — free branch/PR deploy previews already give you a shareable non-production URL with no extra cost. A password gate on that URL is a Pro-plan feature; if you want one on the free tier, a `_headers`-based Basic Auth workaround exists (native browser login prompt, functional but unpolished). For a beta shared only with people you already know, an unlisted branch-deploy URL with no password is probably sufficient.
13. **Difficulty ramp / top-tier bar, and whether to surface "what's a perfect score."** Good instincts from Nate, but hold off on specific changes until there's real score-distribution data from more players — right now the signal is from a handful of word-savvy testers, which isn't enough to tell "too easy in general" from "too easy for these two people."

Full launch gate is in `LAUNCH.md`. Full phased plan is in `ROADMAP.md`/`TODO.md`. Full naming history is in `RENAME.md`.

---

## 🔦 Open questions / unfinished

- **Mobile keyboard scroll (iOS)** — no live complaints this dogfood round, but never explicitly re-verified as fixed post-redesign. Treat as "probably fine," not confirmed.
- **Android keyboard/viewport** — newly confirmed broken this session (answer tiles cut off, less visible area than iOS). See Next action #6.
- **Same-day replay lock** — not yet confirmed whether this exists (Dad's "shouldn't be able to play twice a day" note). Note: local streak and first-visit tracking themselves *are* confirmed built (see "Where the project is right now") — this is narrower than the old "local streak/history — status unclear" item.
- **Preview vs. corpus prompt** — `scripts/preview-puzzles.js` still generates from the runtime prompt, not the stricter authoring prompt. Still unresolved.
- **`servedFrom: "corpus"` confirmation** — expected to show since Aug 18; worth a direct one-line confirmation.
- **Domain TLD** — leaning `.app`, not yet purchased; see `RENAME.md`.
- **Timer decay tuning** (−20pts/4s → smaller/more-frequent decrement) — agreed in dogfood feedback, not confirmed shipped. Check the live source.
- A punycode deprecation warning (`DEP0040`) in `get-daily-puzzle` logs — confirmed harmless, no action needed.

---

## 🔁 The three routines (different clocks)

**A. Working on the game** — most sessions.
```bash
npm run dev:fallback        # play at localhost:8888, no API cost
# edit, refresh, repeat, then:
git add . && git commit -m "..." && git push
```
Playwright tests live in `tests/` (`playwright.config.ts` at the repo root) — worth a `npx playwright test` pass before pushing anything touching gameplay.

**B. Tuning clue quality** — occasional, until satisfied.
```bash
npm run puzzles             # prints 5 clues to judge (costs a few cents)
# tweak the prompt in scripts/lib/authoring.js, run again
```

**C. Banking puzzle days** — periodic (≈monthly).
```bash
npm run corpus:generate                       # make candidates (adds to review.json)
npm run corpus:review                          # approve/reject at localhost:4100
npm run corpus:compile -- --start 2026-08-18   # SAME start date, EVERY time
git add . && git commit -m "Extend corpus" && git push
```

Most days you only touch **A**. Full mechanics for **C** are in `CORPUS.md`.

---

## ⚠️ Two rules that must never be broken (routine C)

1. **Always `--start 2026-08-18`** — the same date, forever.
2. **Never `--reset`** now that real testers have seen real dates — it wipes `review.json`, your entire puzzle history.

Confidence check after any compile:
```bash
node -e "const c=require('./public/corpus.json');console.log(c.startDate,'→',c.endDate,'('+c.days+' days)')"
```
Should currently echo `2026-08-18 → 2026-09-05 (19 days)` until the corpus is extended/recompiled without `--include-unreviewed`.

---

## 🗺️ Where things live

```
public/index.html                  the whole game (HTML/CSS/JS) — includes the two Aug-22 fixes
public/manifest.json                PWA manifest — rename tail still pending
public/corpus.json                  compiled puzzles the game serves (live: 19 days, 49/95 unreviewed)
netlify/functions/                  get-daily-puzzle (serves), generate-daily-puzzle (scheduled fallback)
netlify/lib/puzzles.js              runtime generation logic — CORS/rate-limit hardening lands here
scripts/                            corpus pipeline: generate-corpus.js, review-corpus.js, compile-corpus.js, preview-puzzles.js
scripts/lib/authoring.js            the authoring prompt + validation to tune
corpus/review.json                  approved/rejected record — the memory, never lose this
corpus/rejected.json                gitignored
tests/                              Playwright tests
playwright.config.ts                Playwright config (repo root)
```

Reference docs: `CORPUS.md` (pipeline), `LAUNCH.md` (launch gate), `RENAME.md` (rename tail + trademark clearance), `SECURITY.md`, plus the knowledge base and design briefs.

---

## 📌 Update protocol

When you finish a work session, update three things here: the **Last updated** date, **Where the project is now**, and **Next actions**. Sixty seconds, and it's the difference between "where was I?" and "oh right, here."
