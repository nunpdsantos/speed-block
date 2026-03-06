# Speed Block

Fast 8x8 block-placement game inspired by the pacing, pressure, and line-clear loop of Block Blast, implemented with PixiJS and deployed on Vercel.

## Project Status

The recent gameplay work focused on one problem: players were hitting early score plateaus and the run curve was getting harsh too quickly. The current build now uses:

- score-phased pacing instead of a mostly time-only pressure ramp
- smarter 3-piece tray generation with rescue weighting and solvability checks
- hidden cross-session adaptation based on recent runs
- local telemetry that distinguishes timeout pressure from board-lock pressure
- passive in-run tier framing so progress feels visible without adding friction

The detailed handoff for this work lives in [`docs/IMPLEMENTATION_HANDOFF.md`](docs/IMPLEMENTATION_HANDOFF.md).

## Tech Stack

- Vite
- TypeScript
- PixiJS
- Vercel serverless / edge function for leaderboard
- Upstash Redis for leaderboard storage

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Deployment Notes

- Frontend is expected to deploy on Vercel.
- The leaderboard API lives in `api/leaderboard.ts`.
- Production leaderboard storage requires:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

## Repository Map

### Gameplay core

- `src/core/Board.ts`: 8x8 board state, placement checks, line clear logic
- `src/core/GameState.ts`: run loop, score/time state, run summary creation
- `src/core/ScoreEngine.ts`: score and time-bonus calculations
- `src/core/PieceGenerator.ts`: tray generation, pool selection, rescue weighting, solvability checks
- `src/core/Progression.ts`: score tiers and progress state
- `src/core/RunPacing.ts`: per-difficulty run phases and recovery logic
- `src/core/AdaptiveProgression.ts`: hidden cross-session tuning model
- `src/core/RunTelemetry.ts`: local telemetry storage and tuning signals
- `src/core/Config.ts`: difficulty configs and generation settings

### Presentation and flow

- `src/scenes/MenuScene.ts`: menu and difficulty selection
- `src/scenes/GameScene.ts`: active gameplay scene, event handling, progression presentation
- `src/scenes/GameOverScene.ts`: end-of-run flow
- `src/rendering/UIRenderer.ts`: HUD, timer, streak, tier, and next-goal display
- `src/rendering/*.ts`: board, piece, FX, layout, and animation rendering
- `src/audio/AudioManager.ts`: music and SFX control
- `src/input/DragController.ts`: piece drag interactions
- `src/main.ts`: app boot, scene switching, adaptive profile load/save

## Current Gameplay Direction

This codebase is not trying to be a static clone. The current design goal is:

1. Keep the game instantly readable and low-friction.
2. Make runs feel fairer and more recoverable.
3. Let players naturally feel improvement over repeated sessions.
4. Hide most of the adaptation so progression feels automatic, not instructional.

## Documentation

- [`BLOCK_BLAST_MASTER_SPEC.md`](BLOCK_BLAST_MASTER_SPEC.md): research and reverse-engineering source document
- [`docs/IMPLEMENTATION_HANDOFF.md`](docs/IMPLEMENTATION_HANDOFF.md): current implementation state, rationale, open issues, and next-step recommendations
