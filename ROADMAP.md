# Roadmap — Whence

*The plan from "runs in prod" through public release and beyond. Companion to `LAUNCH.md` (which is the pre-launch gate); this picks up roughly where that ends and looks further out.*

Created: July 2026 · Status: **pre-content, pre-launch**

---

## The organizing principle

Everything before "announce" is **cheap and reversible**. Everything in the later feature set is **expensive and sticky** — accounts, databases, payments, things you can't easily unwind once real users depend on them. The whole strategy is: stay in the cheap, reversible zone until dogfooding proves which expensive things are actually worth building. Don't build retention features for a game nobody returns to yet; find out if they return first.

Two different bars, often conflated:

- **Functioning in prod** — the app runs, plays, serves puzzles. Likely already true, with a quality asterisk (it's serving fallback/generated puzzles, not a curated corpus).
- **Ready to announce** — real curated content with runway, verified on real devices, name and domain settled. A couple of focused weekends of *content and verification* work, not features.

---

## Phase 0 — Content (the gate for everything else)

No corpus, nothing to dogfood. This is first and unavoidable.

**Split it into two mindsets that feel like one task:**

1. **Tune the prompt (throwaway work).** Generate ~20, read them, fix the prompt in `scripts/lib/authoring.js`, repeat until the hit rate is decent. If you review-for-keeps while the prompt is still weak, you fact-check a lot of words you'll reject.
2. **Bank days (kept work).** Once the prompt is good, switch to reviewing for volume. Every approved word is fact-checked against Etymonline — the one step nothing can automate.

- [ ] Tune prompt to an acceptable hit rate (see `LAUNCH.md` stopping rule)
- [ ] Bank **~14+ days** so dogfooders don't hit the generation cliff mid-week
- [ ] Compile, commit, verify `servedFrom: "corpus"` live

Full mechanics: `CORPUS.md`.

---

## Phase 1 — Cheap retention (before testers arrive)

`localStorage` only — no backend, no accounts, no privacy surface. An afternoon each.

Do these **before** dogfooding, because retrofitting them after people have started building streaks means those early players lose the history they'd accumulated — a worse experience than not having it.

- [ ] **Local streak** — consecutive days played. This is the answer to "why come back tomorrow?" now that scoring isn't pure speed.
- [ ] **Local history** — past results survive a refresh on that device.

These also directly de-risk the biggest open question about the redesign: whether a no-timer-pressure learning game has a return hook. A streak is the cheapest possible test of that.

---

## Phase 2 — Dogfood (the highest-value step)

Real people, real devices, small trusted group. This is also your **real-device QA pass** — the mobile-keyboard scroll on iOS gets tested for free the moment friends play on their phones.

Don't ask "is it fun?" — you'll get politeness. Ask for specifics:

- [ ] **Did any etymology seem wrong?** Testers are free fact-checkers on the exact failure mode you fear most.
- [ ] **Where did you get stuck or confused?** Difficulty calibration and UX friction.
- [ ] **Did the mobile keyboard behave?** The one known-unresolved UX item.
- [ ] **Did you come back the next day?** The retention question that decides whether Phase 4 is worth building at all.

Watch two numbers you can't know until now: how fast play **drains the corpus** (your real burn rate), and how the **review load feels** to sustain. Both feed Phase 3.

---

## Phase 3 — Set the maintenance rhythm (informed by Phase 2)

**Deliberately after dogfooding, not before.** You can't set a sustainable cadence until you know your burn rate and how much review time is realistic for you. Building the routine first is guessing; building it second is arithmetic.

- [ ] Decide cadence (weekly / bi-weekly) based on observed drain vs. sustainable review time
- [ ] Keep a comfortable buffer ahead of players at all times
- [ ] Remember the two corpus rules forever: **same `--start` date; never `--reset`** (`STATUS.md`, `CORPUS.md`)

---

## Phase 4 — Public URL, rename tail, security

Coordinated changes, best done as a unit right before announcing.

- [ ] **Custom domain + subdomain + share-URL move together** — split them and share messages point at a dead address (`RENAME.md`)
- [ ] Finish the rename tail: `manifest.json` (home-screen name), any remaining brand strings
- [ ] **Security glance** — once there's a public audience, the wide-open CORS (`*`) and absent rate limiting on the fallback generation endpoint stop being theoretical. Small fix; belongs here. (`SECURITY.md`)
- [ ] Confirm OpenAI budget cap + alerts still in place

---

## Phase 5 — Announce

Wider than the dogfood group. By here: real corpus with runway, verified on real devices, name and domain settled, endpoint hardened.

If the goal is **portfolio / job applications** rather than an actual audience, note that a reviewer values *judgment and execution* over user numbers — "functioning in prod with a small real corpus and a thoughtful architecture" is already a strong artifact. That bar is much closer to Phase 0 than Phase 5. Be clear which goal you're aiming at, because it changes how much of Phases 3–5 matters right now.

---

## Phase 6 — Account-based features (only after return behavior is proven)

Everything here needs accounts + a database + server-side score validation. **Do not build any of it until Phase 2 proves people actually come back.** A leaderboard for a game with no retention is effort on the wrong problem.

**The decision to make *now*, even though the features come later:** do you want scores to eventually be social? If yes, **scoring must move server-side before you have users** — the moment scores are competitive, client-side scoring is forgeable, and you can't retroactively secure scores people have already submitted. You don't have to build it now; you have to *know the answer*, because it decides whether Phase 1's local scoring is a stepping stone or a dead end.

In rough dependency order:

- [ ] **Accounts** — the prerequisite for everything below; also the first real privacy surface
- [ ] **Cross-device sync** — history/streaks that follow the player, not the device
- [ ] **Global high scores** — needs server-side score validation first
- [ ] **Groups / private leagues** — compete with friends in a bounded set. Frequently the most-loved social feature; also a lot of surface area
- [ ] **Subscription** — gating puzzles behind payment is a decision about what Whence *is* (portfolio / hobby / business), plus payment infra and legal surface. Premature until people demonstrably value it enough to pay

---

## One-screen summary

```
0. Content        tune prompt, bank ~14 days, verify corpus serves     ← gate
1. Retention      local streak + history (localStorage)                ← before testers
2. Dogfood        real devices, specific questions, watch burn rate    ← highest value
3. Rhythm         set cadence FROM what dogfooding showed
4. Ship           domain + rename tail + security glance (as a unit)
5. Announce       portfolio goal? you're basically at 0-2 already
6. Accounts       ONLY after return behavior is proven; decide
                  "social scores?" now, build later
```

**The line to hold:** cheap and reversible until dogfooding earns the right to build expensive and sticky.
