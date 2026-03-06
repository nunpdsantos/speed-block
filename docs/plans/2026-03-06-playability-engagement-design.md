# Speed Block Playability and Engagement Redesign

Date: 2026-03-06

## Problem

Players hit a difficulty wall and stop playing. The difficulty curve has a cliff instead of a slope. Once players reach a certain score range, they can't improve no matter how much they practice. This kills motivation and retention.

Secondary issues:
- Near-miss highlights are inconsistent, causing players to miss valid line completions
- Board clears feel unachievable
- The hidden adaptive difficulty system (from Codex) undermines leaderboard fairness

## Constraints

- Same rules for every player. No hidden per-player difficulty adjustment.
- Leaderboard scores must be directly comparable.
- No new UI systems or menus. Changes should be invisible or naturally integrated.
- Must not cause performance issues on mobile.

## Design

### 1. Strip the adaptive system

Delete:
- `src/core/AdaptiveProgression.ts`
- `src/core/RunTelemetry.ts`

Simplify:
- `src/main.ts` — remove `getAdaptiveTuning()` and `recordAdaptiveRun()` calls
- `src/core/GameState.ts` — remove `AdaptiveTuning` constructor parameter, remove import
- `src/core/RunPacing.ts` — remove `AdaptiveTuning` parameter from `getRunPacing()`, use pacing values directly
- `src/core/PieceGenerator.ts` — remove `adaptiveTuning` from `GenerationContext`, use fixed per-difficulty values for rescue/threat weighting

Preserve:
- `RunSummary` and `RunEndCause` types (useful for game-over display)
- `Progression.ts` (tier display, same for everyone)

### 2. Smooth difficulty ramp

Replace the discrete pacing phases in `RunPacing.ts` with continuous interpolation.

Each difficulty defines two anchor points:
- **Floor** (score 0): drain multiplier, drain acceleration, time bonus multiplier
- **Ceiling** (high score target): same three values at maximum difficulty

Values for each difficulty:

**Chill** (ceiling at 40,000):
- Floor: drain 0.80, drainAccel 0.15, timeBonus 1.25
- Ceiling: drain 1.12, drainAccel 1.10, timeBonus 0.90

**Fast** (ceiling at 30,000):
- Floor: drain 0.86, drainAccel 0.15, timeBonus 1.20
- Ceiling: drain 1.16, drainAccel 1.15, timeBonus 0.88

**Blitz** (ceiling at 20,000):
- Floor: drain 0.94, drainAccel 0.20, timeBonus 1.14
- Ceiling: drain 1.22, drainAccel 1.20, timeBonus 0.86

Interpolation function: `t = (score / ceiling) ^ 0.65`

The exponent 0.65 creates a concave curve: the first 50% of the score range covers ~35% of the difficulty increase. Early game is accessible, late game tightens gradually but never hits a wall.

Keep from Codex (fixed per-difficulty, no adaptive multiplier):
- Opening grace: reduced drain for the first N seconds (chill: 22s, fast: 18s, blitz: 12s)
- Dry-spell recovery: if player goes N placements without clearing, drain reduces slightly (chill: after 3 moves, fast: after 2, blitz: after 2)
- Low-time recovery: when timer fraction drops below threshold, drain eases slightly to allow comebacks

### 3. Fix near-miss highlights

Current: `GridRenderer.updateNearMiss()` only triggers at exactly 7/8 filled, highlights entire row/column strip.

New behavior:
- Trigger at 6/8 AND 7/8 filled
- Highlight only the empty cells in that row/column, not the whole strip
- 7/8 gets brighter highlight (alpha 0.25) than 6/8 (alpha 0.12)
- Keep existing pulse animation, apply to individual cells
- Empty cells glow amber to signal "place here to complete this line"

### 4. Gradual piece pool unlocks

Replace batch unlocks at score thresholds with gradual trickle.

Per difficulty, define unlock scores for each piece type individually:

**Chill:**
- 0: opening pool (single, domino, tromino_line, small_corner, tetromino_line, small_l, t_shape, zigzag, square_2x2)
- 3,000: pentomino_line
- 5,000: big_l
- 8,000: rectangle
- 11,000: diagonal_2
- 18,000: square_3x3
- 25,000: diagonal_3
- 35,000: big_rectangle

**Fast:** same pieces, scores scaled to 0.7x of Chill values.

**Blitz:** same pieces, scores scaled to 0.45x of Chill values.

Each new piece entering the pool is a micro-event the player adjusts to, not a complexity dump.

### 5. Fixed rescue/threat weighting

Replace adaptive rescue/threat multipliers with fixed board-fill rules (same for all players):

| Board fill | Rescue weight | Threat weight |
|------------|--------------|---------------|
| < 60% | 1.0x | 1.0x |
| 60-70% | 1.3x | 0.7x |
| 70-85% | 1.8x | 0.4x |
| > 85% | 2.5x | 0.2x |

These apply on top of the per-difficulty base rescue/threat biases from `MODE_WEIGHTS`.

The board fill fraction is computed from `board.occupiedCount() / 64`.

### 6. Performance budget for batch generation

Add `maxStatesExplored` counter to `isBatchSolvable()`:
- Default limit: 200 states
- If exceeded, bail out and treat batch as solvable (optimistic fallback)
- Prevents frame hitches on slow mobile devices
- Solvability is still guaranteed for most boards; only extremely complex board states skip verification

## Files affected

| File | Action |
|------|--------|
| `src/core/AdaptiveProgression.ts` | Delete |
| `src/core/RunTelemetry.ts` | Delete |
| `src/core/RunPacing.ts` | Rewrite: continuous interpolation, remove adaptive params |
| `src/core/PieceGenerator.ts` | Modify: remove adaptive params, gradual unlocks, fixed rescue/threat, perf budget |
| `src/core/GameState.ts` | Simplify: remove adaptive tuning param |
| `src/main.ts` | Simplify: remove adaptive imports and calls |
| `src/rendering/GridRenderer.ts` | Fix: near-miss highlights at 6/8+7/8, highlight empty cells |
| `src/scenes/GameScene.ts` | Simplify: remove adaptive tuning passthrough |

## What we keep from Codex

- Progression tiers (ROOKIE through LEGEND) with HUD display and tier-up alerts
- Score-driven pacing (not time-based)
- Batch solvability check
- Dry-spell recovery (fixed values)
- Low-time recovery (fixed values)
- Opening grace period (fixed values)
- Death cause tracking (timeout/board_lock/quit)
- Rescue/threat piece categories
- Cell budget system for batch generation
- Spatial fitness weighting in piece selection
