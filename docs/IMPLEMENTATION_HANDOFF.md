# Speed Block Implementation Handoff

## Snapshot

- Date: 2026-03-06
- Primary gameplay problem addressed: players were plateauing too early and the game was escalating into frustration faster than mastery.
- Gameplay changes previously pushed to GitHub: `d74099a` (`Improve adaptive game progression`)
- Current goal: keep the game low-friction while making it feel like players naturally get further the more they play.

This document is the current implementation handoff for the progression, pacing, and balancing systems in the repository.

## What Changed

### 1. Passive score-tier progression

Files:

- `src/core/Progression.ts`
- `src/rendering/UIRenderer.ts`
- `src/scenes/GameScene.ts`

What changed:

- Added per-difficulty score tiers (`ROOKIE`, `SHARP`, `PRO`, `ELITE`, `MASTER`, `LEGEND`).
- Added passive HUD presentation for the current tier and next score target.
- Added tier-up alerts during a run.

Why it changed:

- Players needed to feel that they were moving through a run, not just surviving until collapse.
- This is intentionally passive. It gives visible progress without creating missions, menus, or coaching.

Design note:

- This system is motivational framing, not the core balancing system. If it feels too explicit later, it can be reduced or removed without breaking the hidden progression work.

### 2. Run pacing moved from mostly time-based to score-phased pacing

Files:

- `src/core/RunPacing.ts`
- `src/core/GameState.ts`

What changed:

- Added per-difficulty pacing phases based on score bands.
- Added opening grace behavior.
- Added dry-spell recovery when the player goes several placements without clearing.
- Added low-time recovery so near-death states can sometimes convert into comebacks.
- Time gain is now tuned by pacing state, not just base scoring rules.

Why it changed:

- The older curve mostly got harder because time was passing.
- That produced pressure, but not satisfying progression.
- The new model creates a recognizable arc:
  - early confidence
  - mid-run tension
  - crisis recovery
  - late-run pressure after the player has already had a meaningful run

### 3. Piece generation became structured and pressure-aware

Files:

- `src/core/PieceGenerator.ts`
- `src/core/Config.ts`
- `src/core/GameState.ts`

What changed:

- Added opening, midgame, and endgame piece pools.
- Delayed harder shape unlocks until later score bands.
- Added rescue-piece weighting under pressure.
- Reduced threat-piece weighting when the player is near collapse.
- Enabled batch solvability checks with `ensureBatchSolvable: true`.
- Passed live run context into the generator: difficulty, score, dry spell state, time pressure, adaptive tuning.

Why it changed:

- Player frustration was being driven partly by trays that felt unfair or abruptly hostile.
- The generator now does more of the pacing work, instead of leaving everything to the timer.
- This is important because players usually accept losing to their own board decisions, but not to obviously hostile RNG.

Current generator intent:

- Opening trays should feel readable and placeable.
- Mid-run trays can become more demanding, but should still permit recovery.
- When the run is under pressure, the generator should lean toward survival-friendly shapes.

### 4. Hidden cross-session adaptation

Files:

- `src/core/AdaptiveProgression.ts`
- `src/main.ts`
- `src/core/PieceGenerator.ts`
- `src/core/RunPacing.ts`

What changed:

- Added a local per-difficulty adaptive profile stored in `localStorage`.
- The game now records finished runs and adjusts future runs based on recent performance.
- The adaptive model controls:
  - `openingGraceMultiplier`
  - `basePressureMultiplier`
  - `recoveryMultiplier`
  - `unlockDelayMultiplier`
  - `rescueWeightMultiplier`
  - `threatWeightMultiplier`

Why it changed:

- The user goal was not to teach players how to improve. It was to make the game itself feel more engaging and more naturally progressive.
- That requires hidden difficulty shaping across repeated runs, not just better messaging.

Current behavior:

- New or struggling players get a softer opening and more recovery.
- Strong recent runs tighten the curve back up.
- All of this is invisible to the player.

### 5. Death-cause-aware run summaries

Files:

- `src/core/types.ts`
- `src/core/GameState.ts`
- `src/scenes/GameScene.ts`
- `src/main.ts`

What changed:

- Run summaries now capture:
  - score
  - end cause (`timeout`, `board_lock`, `quit`)
  - turns played
  - turns with clears
  - max streak
  - max dry spell
  - run duration
  - time remaining
  - board fill at run end
  - peak board fill during the run

Why it changed:

- A timeout and a board lock are different balancing failures.
- If the game only reacts to score, it softens the wrong part of the experience.

### 6. Local telemetry-backed adaptation

Files:

- `src/core/RunTelemetry.ts`
- `src/core/AdaptiveProgression.ts`

What changed:

- Added a local telemetry profile per difficulty in `localStorage`.
- Each recent run records:
  - score band reached
  - end cause
  - clear rate
  - dry-spell ratio
  - board fill at death
  - peak board fill
- Adaptive tuning now derives timer-pressure and board-pressure assistance from those signals, not just score streaks.

Why it changed:

- Score alone was too blunt.
- The game now distinguishes:
  - "player is getting squeezed by time"
  - "player is getting choked by board density and tray hostility"

Observed tuning intent:

- Timeout-heavy recent histories should reduce timer pressure and increase recovery.
- Dense board-lock histories should delay hard-shape unlocks and bias toward rescue pieces.

## How The Systems Connect

High-level flow:

1. `src/main.ts` starts a new run and loads adaptive tuning for the selected difficulty.
2. `GameScene` creates `GameState` with that tuning.
3. `GameState` drives the timer loop and placement results.
4. `RunPacing` adjusts drain and time gain during the run.
5. `PieceGenerator` uses live run context plus adaptive tuning to decide which shapes to offer.
6. At game over, `GameState` builds a run summary.
7. `main.ts` records that summary into both:
   - adaptive progression profile
   - local run telemetry profile
8. The next run uses the updated profile automatically.

This means progression now exists at three levels:

- in-run pacing
- tray composition
- cross-session hidden adaptation

## Why These Changes Were Made

The original user feedback was consistent:

- players hit score ceilings and stopped feeling improvement
- difficulty spiked too quickly
- some runs felt unfair
- the game did not naturally support a feeling of skill growth over time

The design response was to move away from "pressure only" and toward "pressure plus recoverability plus hidden adaptation."

The important constraint was that players should not have to interact with extra systems. The game should do the progression work for them.

## Validation Done

Confirmed locally:

- `npm run build` passes.
- A smoke test of the telemetry-backed adaptive model showed:
  - timeout-heavy histories drive timer relief harder
  - board-lock-heavy histories drive unlock delay and rescue weighting harder

Important limitation:

- The telemetry is local-only and stored in browser `localStorage`.
- There is no remote analytics pipeline, cohort analysis, or admin tuning dashboard yet.

## Current Strengths

- The early run should feel more readable and less punishing.
- The generator now contributes to pacing instead of acting like a flat RNG source.
- Recovery states are more intentional.
- The next run can quietly adapt to repeated failure patterns.
- The progression system does not require extra user interaction.

## Current Limitations

### 1. Telemetry is local, not product analytics

The game adapts per device/browser, but there is no centralized data set yet. That means balancing still depends on local testing and direct user feedback.

### 2. The adaptive model is heuristic

The coefficients are hand-tuned. They are reasonable, but they are not yet fitted from large-scale player data.

### 3. No remote config

The pacing and adaptation coefficients are still code-driven. Shipping balance changes still requires a deployment.

### 4. Passive progression may still be too visible for some tastes

The tier HUD is intentionally lightweight, but if the product direction becomes even more invisible, the underlying systems can stay while the tier framing is simplified.

### 5. Board-state understanding is still coarse

The system knows board density, not deeper topology. It does not yet understand patterns like:

- trapped center zones
- fragmented micro-holes
- long corridor starvation
- repeated 3x3 denial states

## Recommended Next Improvements

### Highest-value next step

Build a real analytics loop:

- emit run summaries to a backend
- segment by difficulty and player cohort
- compare timeout-heavy vs board-lock-heavy populations
- tune coefficients from actual retention and run-length data

### Strong gameplay follow-ups

1. Add board-topology metrics.

Examples:

- number of isolated holes
- largest contiguous empty region
- count of live 3x3 spaces
- count of live 1x5 lanes

Why:

- This would let the generator respond to actual board shape, not just board density.

2. Add remote-configurable pacing weights.

Why:

- The tuning model is now worth A/B testing.
- Vercel-compatible runtime config would allow faster balancing without code edits.

3. Separate onboarding adaptation from mastery adaptation more clearly.

Why:

- New-player assistance and long-term mastery tuning are currently blended into one model.
- Splitting them would make the curve easier to reason about.

4. Add internal debug overlays or a dev panel.

Show:

- current adaptive tuning values
- current run phase
- recovery-active state
- generator pool composition

Why:

- This would make balancing much faster in future sessions.

5. Run structured playtests by difficulty.

Track:

- median score
- 25th/75th percentile score
- median session length
- end-cause distribution
- proportion of runs reaching each tier

Why:

- The real goal is not just fairness; it is perceived progression and replay willingness.

## Suggested Starting Point For The Next Session

If the next session continues the progression work, start here:

1. Inspect `src/core/AdaptiveProgression.ts`, `src/core/RunTelemetry.ts`, `src/core/RunPacing.ts`, and `src/core/PieceGenerator.ts`.
2. Decide whether the next step is:
   - data infrastructure
   - board-topology-aware generation
   - remote config / A-B testing hooks
3. Run a short playtest pass per difficulty and capture:
   - average score
   - average death cause
   - how early the run first feels unfair

## Source Of Truth

Use the documents like this:

- `BLOCK_BLAST_MASTER_SPEC.md` for external research and genre reference
- `README.md` for project orientation and setup
- this file for the current gameplay implementation and next-step handoff
