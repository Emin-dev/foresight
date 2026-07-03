# Foresight

**Foresight** is a small, fully deterministic grid-tactics game in the vein of *Into the Breach*:
every enemy telegraphs its exact next move — where it will step, what it will hit, for how much —
**before** you act. You move, then resolution plays out **exactly** as shown. No hidden rolls, no
fudged AI, no gap between the telegraph and the outcome.

Live site: https://emin-dev.github.io/foresight/

## Honest framing — read this first

Market research for this concept scored it low: **2/10**. The evidence cited in favor of a
deterministic tactics game was *Into the Breach*'s critical acclaim and sales — but that evidence
belongs to a critically-acclaimed studio with press relationships and Steam's discovery algorithm
behind it. None of that transfers to an unbranded clone with no storefront and no press. The
research explicitly named this a **reference-class fallacy**: borrowing a comparable's success
numbers for a product that shares only the mechanic, not the distribution.

This is being built anyway, as a **craft and genre-diversity bet** for this catalog — it's the
first grid-tactics game shipped so far, and the determinism-proof architecture (see below) was
worth building and testing in its own right. Go in expecting a small, honestly-scoped tactics
puzzle, not the next *Into the Breach*, and definitely not a revenue plan.

## The determinism promise — this is provably true, not just claimed

- `js/enemies.js`'s `computeIntent(board, enemy)` is a **pure function**: same board and enemy in,
  same intent out, every time. No `Math.random()`, no hidden mutable state, anywhere in the file.
- `js/run.js`'s `startTurn(board)` calls `computeIntent` for every enemy **before** the player acts
  — that's the intent the UI displays.
- `js/run.js`'s `resolveTurn(boardAfterPlayerActions, intents, mission)` executes those exact
  captured intent objects — it never recomputes an enemy's plan against the post-player-action
  board. What was shown is what happens; the only exception is an honest one (an enemy that died to
  a player action earlier in the same turn simply can't act — its intent fizzles, which is the
  truthful outcome, not a hidden recalculation).
- Read `test/run.test.mjs` — it includes two full, exactly-scripted mission playthroughs (one win,
  one loss) that assert the specific resulting board state, plus dedicated "CORE PROMISE" tests
  that rearrange the board *after* an intent is captured and confirm the enemy still executes the
  original telegraphed action.

## Units & enemies

| Unit | Role |
|---|---|
| ■ Bulwark | Slow, sturdy blocker. Holds a tile enemies can't pass through or occupy. Deals no damage. |
| ▲ Ram | Pushes an adjacent enemy back one tile — if the push is blocked, the enemy takes damage instead of moving. |
| ● Striker | Direct damage in a straight line, up to 3 tiles, if nothing blocks the line. |

| Enemy | Behavior |
|---|---|
| ✦ Crawler | Always advances one tile toward the nearest objective, then attacks whatever tile it ends up facing. |
| ◆ Brute | Fixed facing direction, set at spawn. Always attacks the tile directly ahead, advancing into it first if it's empty. |
| ✱ Spitter | Never moves. Fires down its row/column at the nearest aligned objective — a unit or hazard standing in the way is hit instead, so a Bulwark can genuinely intercept the shot. |

## Campaign

15 missions across 3 islands, 6x6 grid throughout:

- **Reedshore** (free) — 5 missions, gentle introduction to every unit/enemy type.
- **Stonemarch** (paid unlock) — 5 missions, multiple enemy types at once, tighter turn limits.
- **Windkeep** (paid unlock) — 5 missions, full squads, every enemy type combined, the campaign finale.

Every mission was confirmed winnable ahead of shipping by scripted search against the real engine
(exhaustive brute-force search for most missions, large-scale randomized search — 200k trials — for
the rest) — not just assumed to be fair. This process caught and fixed two real mission-design bugs
during development: `reedshore-1`'s original striker spawn position was literally unwinnable, and
`stonemarch-4`'s only blocker died with no time left to bring up backup.

## Monetization: BUY (one-time, not a subscription)

- **Free:** Reedshore island — 5 missions, the complete game engine and every unit/enemy type.
- **One-time $4.99 unlock:** Stonemarch + Windkeep — 10 more missions across two islands. Persists
  in this browser only (`localStorage`), no account system.

Losing a mission never resets or removes saved progress — this is permadeath-lite in the sense of
"retry immediately, no punishment," not "lose your run."

## What's real in this repo

- **Board/unit/enemy/turn logic (`js/board.js`, `js/units.js`, `js/enemies.js`, `js/run.js`) —
  REAL.** Pure functions throughout; no DOM dependency, fully Node-testable, no randomness anywhere
  in the resolution path.
- **Mission data (`js/missions.js`) — REAL**, all 15 missions pre-verified winnable against the
  actual engine.
- **Save/progress (`js/save.js`) — REAL** localStorage persistence, non-punishing on loss.
- **Checkout (`js/checkout.js`) — SANDBOX ONLY.** No real payment provider is ever contacted. Real
  Luhn check, real expiry-not-in-the-past validation (using the actual runtime clock), real CVC
  format check, and a documented decline test card (`4000000000000002`) for demoing the failure
  path — the same sandbox pattern used by every other product in this line.

## Structure

- `index.html` — landing/docs page, the honest framing, the game UI mount points, pricing.
- `js/board.js` — grid/tile state, pure functions.
- `js/enemies.js` — enemy type definitions + deterministic intent computation.
- `js/units.js` — player unit type definitions + pure action resolvers.
- `js/run.js` — turn orchestration; the proof of the determinism promise.
- `js/missions.js` — the 15-mission campaign as plain data.
- `js/save.js` — localStorage progress tracking.
- `js/checkout.js` — sandbox payment simulation + local unlock flag.
- `js/main.js` — UI wiring: board rendering, mission select, intent telegraph display, checkout.
- `style.css` — mobile-first, calm village green/amber visual style, no dark patterns.
- `test/*.test.mjs` — real Node tests, 63 checks total.
- `server.mjs` — local static file server for development (not deployed; see `.gitignore`).

## Running tests

```
node test/board.test.mjs
node test/enemies.test.mjs
node test/units.test.mjs
node test/run.test.mjs
node test/checkout.test.mjs
```

63 checks total across the 5 files — none were weakened to force a pass.

## Local development

```
node server.mjs
```

Serves the app at `http://127.0.0.1:8093`.
