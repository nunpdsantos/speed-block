# Speed Block

Fast 8x8 block-placement game inspired by the pacing, pressure, and line-clear loop of Block Blast, implemented with PixiJS and deployed on Vercel.

## Project Status

The game uses a fair, competitive design where every player gets the same rules:

- continuous score-phased difficulty curve (no step-function walls)
- smart 3-piece tray generation with rescue weighting, clear-opportunity weighting, and solvability checks
- gradual piece pool unlocks (new shapes trickle in one at a time as score climbs)
- fixed board-fill rescue/threat weighting (same for all players, no hidden adaptation)
- near-miss cell highlights showing exactly where to place to complete a line
- tray pieces that cannot be placed anywhere are dimmed
- passive in-run tier framing (ROOKIE through LEGEND) so progress feels visible
- personal best per difficulty with an in-run "NEW BEST" moment
- three difficulty modes: Chill, Fast, Blitz with separate leaderboards
- generative music that speeds up with the clock and layers up with the streak
- sound / music / haptics toggles persisted locally, first-run tutorial, auto-pause when the tab is hidden

## Tech Stack

- Vite
- TypeScript
- PixiJS
- Web Audio API (all sound is synthesized at runtime, no audio files)
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
- Never commit those values. They belong in Vercel project environment variables (or a local `.env`, which is git-ignored).

## Repository Map

### Gameplay core

- `src/core/Board.ts`: 8x8 board state, placement checks, line clear logic, line-completion lookahead
- `src/core/GameState.ts`: run loop, score/time state, streak window, personal best, run summary creation
- `src/core/ScoreEngine.ts`: score and time-bonus calculations
- `src/core/PieceGenerator.ts`: tray generation, gradual pool unlocks, rescue/threat weighting, clear-opportunity weighting, solvability checks
- `src/core/Progression.ts`: score tiers (ROOKIE through LEGEND) and progress state
- `src/core/RunPacing.ts`: continuous difficulty curve with grace, dry-spell, and low-time recovery
- `src/core/Settings.ts`: persisted preferences (sound, music, haptics, tutorial) and personal bests
- `src/core/Config.ts`: difficulty configs and generation settings

### Presentation and flow

- `src/scenes/MenuScene.ts`: menu, difficulty selection, settings, how-to-play, leaderboard
- `src/scenes/GameScene.ts`: active gameplay scene, event handling, tutorial, pause, progression presentation
- `src/scenes/GameOverScene.ts`: end-of-run flow with run stats, name entry, share
- `src/rendering/UIRenderer.ts`: HUD, timer, streak pips, tier chip, best display
- `src/rendering/GridRenderer.ts`: board rendering, near-miss highlights, placement pop, animated line clears
- `src/rendering/PieceRenderer.ts`: tray pieces (animated entrance, unplaceable dimming), drag piece with pickup animation
- `src/rendering/Widgets.ts`: shared buttons, toggles, stat chips, section labels
- `src/rendering/*.ts`: FX, layout, animation, and theme
- `src/audio/AudioManager.ts`: mixer, generative music engine, musical sound effects
- `src/input/DragController.ts`: piece drag and tap-to-place interactions
- `src/main.ts`: app boot and scene switching

## How the Audio Works

Everything is synthesized with the Web Audio API so the bundle ships no audio files:

- Two buses (music and effects) feed a compressor so loud moments never clip.
- The music is a 4-bar loop (Am, F, C, G) played by a step sequencer scheduled ahead of time on the audio clock. Tempo follows the timer drain rate, the arpeggio/hats/snare layers fade in as the streak grows, and a low-pass filter closes as time runs out.
- Placement plucks walk up a pentatonic scale with the streak; clears play a chord in the same key, so a hot run literally sounds like a rising melody.

## Current Gameplay Direction

1. Keep the game instantly readable and low-friction.
2. Make runs feel fair: same rules for every player, leaderboard scores are directly comparable.
3. Every action should have a visible, audible, and (on phones) tactile response.

## Known Limitations

- The leaderboard trusts the client. A determined player could post a fabricated score. Fixing that properly needs server-side run validation (for example a replay log verified by the API), which is a larger piece of work.
