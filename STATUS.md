# STATUS — start here

*The "you are here" file. Read this first when you come back after a break, before touching anything. Everything else (`CORPUS.md`, `LAUNCH.md`, the briefs) is reference; this is your bookmark.*

**Last updated: August 26, 2026 (mid-session update — corpus extended to 54 days, committed and deployed; plumbing recheck still pending)** — update the date and the two live sections whenever you stop work.

---

## Where the project is right now

The redesign and corpus pipeline are merged to `main` and deployed. Dogfooding with the small trusted group has gone well — no one has flagged a bad etymology, both the app-resume and stale-save bugs from last week are confirmed fixed, and the Whence trademark clearance is done (informally reviewed, low risk, proceed).

**The goal has shifted: from "trusted friends" to "people I don't know."** That's a real change in threat model and quality bar, not just more of the same dogfooding — so this session re-triaged the open items specifically against "am I comfortable with a stranger opening this link." The unreviewed half of the corpus got pulled forward as a result of that re-triage (still open, currently deprioritized by choice — see Next actions).

**Correction, this session:** `SECURITY.md`/`RENAME.md`/the prior version of this file all described the fallback endpoint's CORS as wide open (`*`) with no rate limiting. Checked the actual deployed `netlify/functions/get-daily-puzzle.js` against that claim — it's wrong. The live code already restricts CORS to a real `ALLOWED_ORIGINS` whitelist (production URL + localhost, with a `403` for anything else) and already rate-limits the expensive on-demand-generation path to 10 attempts/IP/day, backstopped by the $30/mo OpenAI budget cap. This item is done, not open — the planning docs had just drifted from the code. `SECURITY.md`/`RENAME.md` should be corrected next time either is touched, and `ALLOWED_ORIGINS` will need a one-line update whenever the domain rename (item 3) actually happens, or the new domain will get silently blocked.

**Also found while reviewing `public/index.html` this session:** local streak (`whence:streak`) and first-visit tracking (`whence:visited`, driving the auto-shown intro modal) are already built and wired up — `updateStreak()`, `loadStreak()`/`saveStreak()`, and `isFirstVisit()`/`markVisited()` all exist and run. This resolves part of the "status unclear" open item on Phase 1 retention — the streak/first-visit piece is done, not missing. Still open: whether a same-day replay lock exists (Dad's "shouldn't be able to play twice a day" note) — not yet confirmed either way.

**Items 4 and 5 are done and deployed.** Instructions-modal height capped (game visible behind it instead of near-full-screen), the modal's own backdrop lightened to 50% opacity (scoped to `#menuModal` only — other modals unchanged), and Susan's two copy edits applied (welcome line no longer ends on "from"; Scoring bullets reworded out of second-person "you"). Reviewed in chat, merged to `main`.

**Items 6 and 7 are built and deployed** (two separate deploys, per plan). Both live in the same mobile-keyboard code path in `public/index.html`:

- **Item 6 (Android keyboard/viewport bug):** the scroll-into-view logic that used to center `#letterTracker` with a fixed `-80px` offset and blind `300ms`/`400ms` timeouts (tuned against iOS's behavior) now targets `#etymologyClue` instead, so the clue + word boxes are what stay visible if the screen runs short on room — not the secondary letter-status strip. Timing is now driven by the real `visualViewport` `resize` event (with the old fixed timeout kept only as a fallback if that event doesn't fire), so it adapts to whatever keyboard height and browser-chrome behavior the actual device has instead of assuming iOS's numbers.
- **Item 7 (auto-enable "tap to type"):** the keyboard-activation logic was pulled into one shared function, `activateMobileKeyboard()`, and is now called automatically from both real taps that start a round — the round-1 "Start Round" button, and the `continueButton` tap that dismisses the round-summary modal and auto-starts rounds 2–5. Both are genuine user gestures with no async gap before the `.focus()` call, which is what makes this allowed under iOS/Android's rules.
- **Follow-on hardening, same deploy:** rather than remove the manual "Tap to Type" button (redundant in the common case, but the underlying hidden input uses a zero-size/invisible pattern some browsers treat with suspicion), `activateMobileKeyboard()` now checks `document.activeElement === mobileInput` right after calling `.focus()`. If the browser actually honored it, the button hides as before. If not, the button stays visible as a real, working fallback instead of a decorative one that could disappear even on failure.

**Items 6/7 Android test — found broken, root-caused, fixed, retested working.** Dad tested on a real Android device: the clue/word boxes were still not visible while typing (screenshot showed only the letter tracker + hint/pass buttons). Root cause: the hidden `<input>` that actually receives keyboard focus (`mobileKeyboardInput`) sat in the DOM down near the hint/pass buttons — some Android/Chrome versions apply their own native "scroll focused element into view" behavior on focus, independent of and apparently overriding our own `scrollIntoView` call, so it was scrolling to where the input *actually sits*, not where our JS was aiming. Fix: moved the (zero-size, invisible) input up in the markup to sit right after the clue and word boxes, so native and our-own scroll behavior now point the same direction regardless of which one wins on a given device. Retested and confirmed working.

**New bug found during that same testing round, now fixed but not yet deployed:** force-quitting the app mid-round and reopening it left no way to get the keyboard back at all. Root cause: `resumeRound()` (which runs when the app loads and finds an in-progress round saved in `localStorage`) restarts the timer but never re-shows the manual "Tap to Type" fallback button — that only happens in `showReadyScreen()`, a different code path this one skips. A force-quit+reopen is a real page reload, so any previous keyboard focus is gone, and the fallback button had already been hidden the last time the keyboard opened successfully. Fix: the resume-with-already-started branch now re-shows the fallback button (deliberately *not* attempting an automatic `.focus()` here, since this runs on page load rather than from inside a real tap, and would likely be silently blocked the same way our other auto-focus attempts would be outside a genuine gesture). **Needs deploy + a fresh test:** force-quit the app mid-round, reopen, confirm the "Tap to Type" button is there.

**Also removed this session: the "Advertisement Space • Remove ads with Premium" placeholder.** Found while reviewing the file — a permanent, unconditional `.ad-banner` div shown on every gameplay screen, referencing a Premium tier that doesn't exist and implying ads were being served when none were. No ad network, no payment infra, no product decision behind it — pure leftover scaffold. Removed (markup + its CSS) rather than either extreme (building real ads, or leaving a placeholder that misrepresents the product to strangers). Confirmed working on iOS and laptop and shipped.

**Corpus extended to 54 days — committed and deployed.** Ran `corpus:generate -- --count 40` (`scholar` capped early at 54, the new bottleneck tier — `magister`/`etymologus` reached 99/88, contrary to the expectation that the hardest tiers would run dry first), then `corpus:compile -- --start 2026-08-18 --include-unreviewed`. Result: **2026-08-18 → 2026-10-10 (54 days)**, up from the previous 19. **This is a meaningfully bigger review-debt jump than the earlier "49/95 unreviewed" note** — the compile output flagged 390 unverified candidates in the eligible pool; only a small fraction of the full 270 shipped words (54 days × 5 tiers) were ever hand-reviewed, so treat this 54-day corpus as almost entirely unverified, not just "half reviewed" like before. Still fine for continued dogfooding with the small trusted group per the staging-flag precedent in `bulk-generator-brief.md`/`STATUS.md`, but the gap to a real launch-ready corpus (`LAUNCH.md`'s hard gate: re-compile *without* `--include-unreviewed` from a fully reviewed set) just got substantially wider. **Committed, pushed, and deployed — still needs the `LAUNCH.md` plumbing recheck** (play the live game, confirm function logs show `servedFrom: "corpus"`, confirm a date in the new range serves consistently on a second load) before treating this as fully verified live.

---

## ⏭️ Next actions (in order)

**Currently being worked through, in this order (per session plan, Aug 26):**

- ~~Corpus review completion~~ — **debt grew substantially, Aug 26.** Was 49/95 unreviewed; now ~390 unreviewed candidates in the pool feeding a 270-word (54-day) compiled corpus, almost entirely unverified. Still skipped by choice for now — fine for continued dogfooding — but this is a bigger gap to close before any wider/public link goes out than it was this morning. Revisit review cadence/plan (Phase 3 in `ROADMAP.md`) sooner rather than later given the size of this jump.
- ~~Corpus extension — commit, push, deploy~~ — **done, Aug 26.** Committed and deployed. **Still open: the `LAUNCH.md` plumbing recheck** — play the live game, confirm function logs show `servedFrom: "corpus"` (not a fallback), and that a date within the new range serves consistently on a second load.
- ~~CORS + rate limiting~~ — **done.** Verified against deployed `get-daily-puzzle.js`: real origin whitelist + 403 on mismatch, 10/IP/day cap on the generation path, $30/mo budget cap as backstop. No code change needed.
- **Domain + rename — starting now (Aug 26).** Next step per plan: registrar availability check on `whence.app`/`whence.game`, then buy, then move the Netlify subdomain + share-URL string + `ALLOWED_ORIGINS` together as one deploy. **Critical, easy to miss:** `netlify/functions/get-daily-puzzle.js`'s `ALLOWED_ORIGINS` whitelist currently only contains the old domain — if the subdomain changes without this being updated in the *same* deploy, the game's own puzzle-fetching calls will get a `403 Forbidden origin` and the site will effectively break on the new URL, not just look untidy. Confirmed only one other hardcoded reference exists in the codebase: the `shareUrl` string in `index.html` (~line 2392). `public/manifest.json`'s `name`/`short_name` rename (still pending, separate from the URL) is a natural thing to bundle into this same pass since you'll already be in "rename mode" — not URL-critical, just cosmetic/PWA-branding, so it won't break anything if missed, but cheap to do together.
- ~~Items 4 and 5~~ — **done, deployed.**
  4. Shrink the initial instructions modal (Nate) — height capped, backdrop lightened to 50% opacity so the game reads as visible/waiting behind it.
  5. Instruction copy edits (Susan) — welcome line no longer ends on "from"; Scoring bullets reworded off second-person "you."
- **Up next together: items 6–7.** — **done, deployed, and now confirmed on all three platforms (iOS, laptop, Android) after fixing a native-scroll conflict Dad's testing surfaced.**
  6. Android keyboard/viewport bug — scroll target switched from the letter tracker to the clue, timing driven by the real `visualViewport` resize event; then a second Android-specific fix (moved the hidden keyboard-focus input's DOM position, which some Android/Chrome versions use for their own native scroll-into-view, overriding ours).
  7. Auto-enable "tap to type" — keyboard opens automatically on the round-1 Start tap and the round-summary Continue tap; manual button kept as a real, verified fallback.
  **One more fix pending deploy — see the force-quit/resume item above.** Don't consider 6/7 fully closed until that's shipped and retested.
- ~~Ad-banner placeholder~~ — **done, deployed, confirmed working.** Removed the permanent "Advertisement Space • Remove ads with Premium" div (markup + CSS) — it referenced a Premium tier that doesn't exist.
- **Nothing currently in progress.** Next up, whenever ready: items 8–9 (level indicator, horizontal rank scale), or the domain/rename work now starting — see below and above.

**Not blocking, but worth doing before or shortly after the wider share:**

8. **Level indicator** — testers (Susan) found tier names (Novitiate, etc.) unclear without context.
9. **Horizontal rank scale on the final results modal**, achieved rank highlighted (Nate).
10. Small fixes: share-text has no clickable link in a text message; round scores round to the nearest thousand for display; add a copyright line (low priority — copyright protection is automatic on creation, this is a courtesy notice, not a legal requirement); root words/etymology shown in the *per-round* modal, not just the final summary; iOS-only results-modal scroll bug.
11. **Same-day replay lock** — confirm whether this exists (Dad's "shouldn't be able to play twice a day" note). Local streak + first-visit tracking are confirmed already built, so this is the one remaining unknown from the old Phase 1 retention item.
15. **"Practice" button is a dead end.** Two entry points — the "Practice" button on the final results modal, and "Practice Mode" in the post-game hamburger menu (which just clicks the first one) — both currently show `alert('Practice mode coming soon!...')` with no real functionality behind them. Decided Aug 26: leave the honest "coming soon" alert as-is for now rather than build practice mode or remove the button — unlike the ad banner, this one isn't misrepresenting anything (it's explicit about being unbuilt), so it doesn't carry the same urgency. Revisit before wider sharing, or whenever practice mode actually gets built.

**Not blocking, worth thinking about, no action needed yet:**

12. **Beta/RC sharing via Netlify** — free branch/PR deploy previews already give you a shareable non-production URL with no extra cost. A password gate on that URL is a Pro-plan feature; if you want one on the free tier, a `_headers`-based Basic Auth workaround exists (native browser login prompt, functional but unpolished). For a beta shared only with people you already know, an unlisted branch-deploy URL with no password is probably sufficient.
13. **Difficulty ramp / top-tier bar, and whether to surface "what's a perfect score."** Good instincts from Nate, but hold off on specific changes until there's real score-distribution data from more players — right now the signal is from a handful of word-savvy testers, which isn't enough to tell "too easy in general" from "too easy for these two people."
14. **Monetization (ads / Premium) — explicitly undecided, not just unbuilt.** The old placeholder implied both existed; neither does, and nothing about *whether* Whence ever monetizes this way has actually been decided. Now tracked properly in `ROADMAP.md` Phase 6, alongside the social-scores decision it mirrors — added Aug 26.

Full launch gate is in `LAUNCH.md`. Full phased plan is in `ROADMAP.md`/`TODO.md`. Full naming history is in `RENAME.md`.

---

## 🔦 Open questions / unfinished

- **Items 4/5 real-device look.** Deployed, but worth a direct look on an actual small screen (not just desktop-resized) — specifically the modal's internal scroll now that it's shorter than before, and whether 50% backdrop opacity reads as intended rather than too light/too dark in daylight vs. a dim room.
- **Force-quit/resume keyboard fix — deploy and retest.** Written, not yet shipped. Test: start a round, force-quit the app entirely (not just background it), reopen mid-round, confirm the "Tap to Type" button is visible and works. Easiest to test on the dev build (separate origin/localStorage from production, so it doesn't disturb a day you've already completed) rather than needing incognito.
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
Should currently echo `2026-08-18 → 2026-10-10 (54 days)` — committed and deployed Aug 26. Still worth the `LAUNCH.md` plumbing recheck (see Next actions) to confirm the live site is actually serving from this file, not a fallback.

---

## 🗺️ Where things live

```
public/index.html                  the whole game (HTML/CSS/JS) — includes the Aug-22 fixes + Aug-26 keyboard/viewport + instructions-modal + ad-banner-removal changes
public/manifest.json                PWA manifest — rename tail still pending
public/corpus.json                  compiled puzzles the game serves (live: 54 days through 2026-10-10 as of Aug 26, ~390 unreviewed in the pool — plumbing recheck still pending, see Next actions)
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
