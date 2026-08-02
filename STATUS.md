# STATUS — start here

*The "you are here" file. Read this first when you come back after a break, before touching anything. Everything else (`CORPUS.md`, `LAUNCH.md`, the briefs) is reference; this is your bookmark.*

**Last updated: July 2026** — update the date and the two live sections whenever you stop work.

---

## Where the project is right now

Whence (formerly Etymon) is a working daily etymology game. The big redesign and the corpus pipeline are **built and tested in-editor but not yet merged or deployed.** All current work lives on the branch `addSystemForCuratedClues`, not `main` — so nothing is live yet.

The game plays end to end in `dev:fallback`. What has *not* happened: a real curated corpus, a merge to `main`, a deploy, or a real-device pass.

---

## ⏭️ Next actions (in order)

1. **Tidy the working tree before committing**
   - Confirm `.netlify/` is now gitignored (it is, as of this update)
   - Inspect `public/daily-puzzle.json` — likely a stale artifact; our real serving file is `public/corpus.json`. Delete it unless you recognize it.
2. **Commit and push the branch** — a month of work is currently uncommitted. This is the highest-priority action; do it before anything else.
3. **Merge `addSystemForCuratedClues` → `main`** when ready (this is what triggers a Netlify deploy).
4. **Build a real launch corpus** — see `CORPUS.md`. Bank ~14 days before going public.
5. **Real-device pass** — iPhone + Android, especially the mobile-keyboard scroll (still the one known-unresolved UX item).
6. Finish the rename tail — see `RENAME.md` (`manifest.json`, `README.md`).

Full launch gate is in `LAUNCH.md`.

---

## 🔦 Open questions / unfinished

- **Mobile keyboard scroll** — the letter tracker can still be hidden behind the on-screen keyboard on iOS. Never fully confirmed fixed on a real device.
- **`public/daily-puzzle.json`** — identify and probably delete (see above).
- **Preview vs. corpus prompt** — the preview tool now shares the corpus *audit*, but still generates from the runtime prompt in `netlify/lib/puzzles.js`, not the stricter one in `scripts/lib/authoring.js`. Words previewed may differ slightly from words generated. Decide whether to unify.

---

## 🔁 The three routines (different clocks)

The steps feel overwhelming because three separate rhythms got jumbled. They're independent:

**A. Working on the game** — most sessions.
```bash
npm run dev:fallback        # play at localhost:8888, no API cost
# edit, refresh, repeat, then:
git add . && git commit -m "..." && git push
```

**B. Tuning clue quality** — occasional, until satisfied.
```bash
npm run puzzles             # prints 5 clues to judge (costs a few cents)
# tweak the prompt in scripts/lib/authoring.js, run again
```

**C. Banking puzzle days** — periodic (≈monthly).
```bash
npm run corpus:generate                       # make candidates (adds to review.json)
npm run corpus:review                          # approve/reject at localhost:4100
npm run corpus:compile -- --start 2026-08-01   # SAME start date, EVERY time
git add . && git commit -m "Extend corpus" && git push
```

Most days you only touch **A**. Full mechanics for **C** are in `CORPUS.md`.

---

## ⚠️ Two rules that must never be broken (routine C)

1. **Always `--start 2026-08-01`** — the same date, forever. It's what keeps already-scheduled days frozen while new words append to the end.
2. **Never `--reset`** once real players have seen real dates — it wipes `review.json`, your entire puzzle history.

`review.json` is the memory of everything ever scheduled. `corpus.json` is disposable and rebuilt from it each compile. Keep `review.json` committed.

Confidence check after any compile:
```bash
node -e "const c=require('./public/corpus.json');console.log(c.startDate,'→',c.endDate,'('+c.days+' days)')"
```
Start date unchanged + day count up = history intact.

---

## 🗺️ Where things live

```
public/index.html                  the whole game (HTML/CSS/JS)
netlify/functions/                  get-daily-puzzle (serves), generate-daily-puzzle (scheduled)
netlify/lib/puzzles.js              runtime generation
scripts/                            corpus pipeline + preview
scripts/lib/authoring.js            the prompt + validation to tune
public/corpus.json                  compiled puzzles the game serves (once built)
corpus/review.json                  approved/rejected record (the memory)
```

Reference docs: `CORPUS.md` (pipeline), `LAUNCH.md` (launch gate), `RENAME.md` (rename tail), `SECURITY.md`, plus the knowledge base and design briefs.

---

## 📌 Update protocol

When you finish a work session, update three things here: the **Last updated** date, **Where the project is now**, and **Next actions**. Sixty seconds, and it's the difference between "where was I?" and "oh right, here."
