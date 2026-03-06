# Speed Block

Fast 8x8 block-placement game inspired by the pacing, pressure, and line-clear loop of Block Blast, implemented with PixiJS and deployed on Vercel.

## Project Status

The game uses a fair, competitive design where every player gets the same rules:

- continuous score-phased difficulty curve (no step-function walls)
- smart 3-piece tray generation with rescue weighting and solvability checks
- gradual piece pool unlocks (new shapes trickle in one at a time as score climbs)
- fixed board-fill rescue/threat weighting (same for all players, no hidden adaptation)
- near-miss cell highlights showing exactly where to place to complete a line
- passive in-run tier framing (ROOKIE through LEGEND) so progress feels visible
- three difficulty modes: Chill, Fast, Blitz with separate leaderboards

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
- `src/core/PieceGenerator.ts`: tray generation, gradual pool unlocks, rescue/threat weighting, solvability checks
- `src/core/Progression.ts`: score tiers (ROOKIE through LEGEND) and progress state
- `src/core/RunPacing.ts`: continuous difficulty curve with grace, dry-spell, and low-time recovery
- `src/core/Config.ts`: difficulty configs and generation settings

### Presentation and flow

- `src/scenes/MenuScene.ts`: menu and difficulty selection
- `src/scenes/GameScene.ts`: active gameplay scene, event handling, progression presentation
- `src/scenes/GameOverScene.ts`: end-of-run flow
- `src/rendering/UIRenderer.ts`: HUD, timer, streak, tier, and next-goal display
- `src/rendering/GridRenderer.ts`: board rendering, near-miss cell highlights, placement flash
- `src/rendering/*.ts`: piece, FX, layout, and animation rendering
- `src/audio/AudioManager.ts`: music and SFX control
- `src/input/DragController.ts`: piece drag interactions
- `src/main.ts`: app boot and scene switching

## Current Gameplay Direction

1. Keep the game instantly readable and low-friction.
2. Make runs feel fair — same rules for every player, leaderboard scores are directly comparable.
3. Difficulty increases gradually with score, never hitting a wall.
4. Players improve through practice, not through hidden assistance.

## Documentation

- [`BLOCK_BLAST_MASTER_SPEC.md`](BLOCK_BLAST_MASTER_SPEC.md): research and reverse-engineering source document
- [`docs/plans/`](docs/plans/): design documents and implementation plans
