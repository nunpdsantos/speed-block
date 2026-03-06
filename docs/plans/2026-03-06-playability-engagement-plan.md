# Playability and Engagement Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove hidden adaptive difficulty, smooth the difficulty curve, fix near-miss highlights, and add gradual piece unlocks — so every player gets the same fair game with no invisible walls.

**Architecture:** Six changes across 8 files. The adaptive system (2 files) gets deleted entirely. RunPacing gets rewritten with continuous interpolation. PieceGenerator gets modified for gradual unlocks, fixed rescue/threat weighting, and a performance budget. GridRenderer gets a near-miss highlight fix. GameState, GameScene, and main.ts get simplified.

**Tech Stack:** TypeScript, PixiJS (rendering), Vite (build). No tests exist in the project — verify with `npm run build` (runs `tsc && vite build`).

---

### Task 1: Strip adaptive system — delete files and remove imports

**Files:**
- Delete: `src/core/AdaptiveProgression.ts`
- Delete: `src/core/RunTelemetry.ts`
- Modify: `src/main.ts:8` (remove adaptive import)
- Modify: `src/main.ts:57` (remove getAdaptiveTuning call)
- Modify: `src/main.ts:75` (remove recordAdaptiveRun call)

**Step 1: Delete the two adaptive files**

```bash
rm src/core/AdaptiveProgression.ts src/core/RunTelemetry.ts
```

**Step 2: Modify `src/main.ts`**

Remove the import on line 8:
```typescript
// DELETE this line:
import { getAdaptiveTuning, recordAdaptiveRun } from './core/AdaptiveProgression';
```

Remove `getAdaptiveTuning` call on line 57. The `startGame` function should become:
```typescript
function startGame(skipCountdown: boolean = false) {
  const config = DIFFICULTY_CONFIGS[selectedDifficulty];
  const gameScene = new GameScene(
    app.canvas,
    layoutManager,
    audioManager,
    config,
    selectedDifficulty,
    skipCountdown,
    (summary) => showGameOver(summary),
    () => showMenu(),
    setBgColor,
  );
  sceneManager.switchTo(gameScene);
}
```

Remove `recordAdaptiveRun` call on line 74-76. The `showGameOver` function should become:
```typescript
function showGameOver(summary: RunSummary) {
  const layout = layoutManager.layout;
  const gameOver = new GameOverScene(
    layout.width, layout.height,
    summary.score,
    leaderboard,
    selectedDifficulty,
    () => startGame(true),
    () => showMenu(),
  );
  sceneManager.switchTo(gameOver);
}
```

**Step 3: Verify build fails** (expected — downstream files still reference AdaptiveTuning)

Run: `npm run build 2>&1 | head -30`
Expected: TypeScript errors in GameState, GameScene, RunPacing, PieceGenerator referencing missing AdaptiveTuning

---

### Task 2: Strip adaptive system — simplify GameState

**Files:**
- Modify: `src/core/GameState.ts:2,47,54,58,264-272,274-286`

**Step 1: Remove AdaptiveTuning from GameState**

Remove the import on line 2:
```typescript
// DELETE:
import { AdaptiveTuning, DEFAULT_ADAPTIVE_TUNING } from './AdaptiveProgression';
```

Remove the private field on line 47:
```typescript
// DELETE:
private adaptiveTuning: AdaptiveTuning;
```

Simplify the constructor (lines 51-69). Remove the `adaptiveTuning` parameter and its assignment:
```typescript
constructor(
  config: GameConfig = DEFAULT_CONFIG,
  difficulty: Difficulty = 'chill',
) {
  this.config = config;
  this.difficulty = difficulty;
  this.board = new Board();
  this.generator = new PieceGenerator(config.generation);
  this.scoreEngine = new ScoreEngine(config.scoring, config.timer);
  this.activePieces = [null, null, null];
  this.score = 0;
  this.highScore = readCachedTopScore(difficulty);
  this.streakCount = 0;
  this.movesSinceLastClear = 0;
  this.piecesPlacedInBatch = 0;
  this.isGameOver = false;
}
```

Simplify `getGenerationContext` (lines 264-272) — remove adaptiveTuning:
```typescript
private getGenerationContext() {
  return {
    difficulty: this.difficulty,
    score: this.score,
    movesSinceLastClear: this.movesSinceLastClear,
    timeRemainingFraction: this.maxTime > 0 ? this.timeRemaining / this.maxTime : 1,
    boardFillFraction: this.board.occupiedCount() / 64,
  };
}
```

Simplify `getRunPacing` (lines 274-286) — remove adaptiveTuning parameter:
```typescript
private getRunPacing(
  movesSinceLastClear: number = this.movesSinceLastClear,
  timeRemainingFraction: number = this.maxTime > 0 ? this.timeRemaining / this.maxTime : 1,
) {
  return getRunPacing(
    this.difficulty,
    this.score,
    this.gameElapsed,
    movesSinceLastClear,
    timeRemainingFraction,
  );
}
```

**Step 2: Verify build still fails** (GameScene and PieceGenerator still reference AdaptiveTuning)

Run: `npm run build 2>&1 | head -30`

---

### Task 3: Strip adaptive system — simplify GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts:13,67,82`

**Step 1: Remove AdaptiveTuning from GameScene**

Remove the import on line 13:
```typescript
// DELETE:
import { AdaptiveTuning } from '../core/AdaptiveProgression';
```

Remove `adaptiveTuning` from the constructor signature (line 67) and the `new GameState` call (line 82).

Constructor should become:
```typescript
constructor(
  canvas: HTMLCanvasElement,
  layoutManager: LayoutManager,
  audioManager: AudioManager,
  config: GameConfig,
  difficulty: Difficulty,
  skipCountdown: boolean,
  onGameOver: (summary: RunSummary) => void,
  onQuit: () => void,
  bgColorSetter?: (color: number) => void,
) {
```

And the GameState creation on line 82:
```typescript
this.gameState = new GameState(config, difficulty);
```

**Step 2: Verify build still fails** (RunPacing and PieceGenerator remain)

Run: `npm run build 2>&1 | head -20`

---

### Task 4: Rewrite RunPacing — continuous interpolation

**Files:**
- Rewrite: `src/core/RunPacing.ts` (full file)

**Step 1: Rewrite RunPacing.ts**

Replace entire file contents with:

```typescript
import { Difficulty } from './Config';

interface DifficultyRamp {
  ceilingScore: number;
  floorDrain: number;
  ceilingDrain: number;
  floorDrainAccel: number;
  ceilingDrainAccel: number;
  floorTimeBonus: number;
  ceilingTimeBonus: number;
  graceSeconds: number;
  graceStartDrainMultiplier: number;
  drySpellMoveThreshold: number;
  drySpellDrainMultiplier: number;
  drySpellTimeBonusMultiplier: number;
  lowTimeThresholdFraction: number;
  lowTimeDrainMultiplier: number;
  lowTimeTimeBonusBoost: number;
}

export interface RunPacingState {
  drainMultiplier: number;
  drainAccelMultiplier: number;
  timeBonusMultiplier: number;
  recoveryActive: boolean;
}

const RAMPS: Record<Difficulty, DifficultyRamp> = {
  chill: {
    ceilingScore: 40000,
    floorDrain: 0.80, ceilingDrain: 1.12,
    floorDrainAccel: 0.15, ceilingDrainAccel: 1.10,
    floorTimeBonus: 1.25, ceilingTimeBonus: 0.90,
    graceSeconds: 22,
    graceStartDrainMultiplier: 0.70,
    drySpellMoveThreshold: 3,
    drySpellDrainMultiplier: 0.82,
    drySpellTimeBonusMultiplier: 1.20,
    lowTimeThresholdFraction: 0.20,
    lowTimeDrainMultiplier: 0.80,
    lowTimeTimeBonusBoost: 0.22,
  },
  fast: {
    ceilingScore: 30000,
    floorDrain: 0.86, ceilingDrain: 1.16,
    floorDrainAccel: 0.15, ceilingDrainAccel: 1.15,
    floorTimeBonus: 1.20, ceilingTimeBonus: 0.88,
    graceSeconds: 18,
    graceStartDrainMultiplier: 0.78,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.84,
    drySpellTimeBonusMultiplier: 1.16,
    lowTimeThresholdFraction: 0.24,
    lowTimeDrainMultiplier: 0.82,
    lowTimeTimeBonusBoost: 0.18,
  },
  blitz: {
    ceilingScore: 20000,
    floorDrain: 0.94, ceilingDrain: 1.22,
    floorDrainAccel: 0.20, ceilingDrainAccel: 1.20,
    floorTimeBonus: 1.14, ceilingTimeBonus: 0.86,
    graceSeconds: 12,
    graceStartDrainMultiplier: 0.86,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.88,
    drySpellTimeBonusMultiplier: 1.12,
    lowTimeThresholdFraction: 0.28,
    lowTimeDrainMultiplier: 0.86,
    lowTimeTimeBonusBoost: 0.14,
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getRunPacing(
  difficulty: Difficulty,
  score: number,
  gameElapsed: number,
  movesSinceLastClear: number,
  timeRemainingFraction: number,
): RunPacingState {
  const ramp = RAMPS[difficulty];

  // Continuous interpolation: t = (score / ceiling) ^ 0.65
  const rawT = Math.min(score / ramp.ceilingScore, 1);
  const t = Math.pow(rawT, 0.65);

  let drainMultiplier = lerp(ramp.floorDrain, ramp.ceilingDrain, t);
  let drainAccelMultiplier = lerp(ramp.floorDrainAccel, ramp.ceilingDrainAccel, t);
  let timeBonusMultiplier = lerp(ramp.floorTimeBonus, ramp.ceilingTimeBonus, t);
  let recoveryActive = false;

  // Opening grace: ease into full drain over the first N seconds
  if (gameElapsed < ramp.graceSeconds) {
    const graceT = Math.min(gameElapsed / ramp.graceSeconds, 1);
    drainMultiplier = ramp.graceStartDrainMultiplier +
      (drainMultiplier - ramp.graceStartDrainMultiplier) * graceT;
    drainAccelMultiplier *= graceT;
    timeBonusMultiplier = Math.max(timeBonusMultiplier, 1.12 - graceT * 0.05);
  }

  // Dry-spell recovery: ease drain when player can't clear
  if (movesSinceLastClear >= ramp.drySpellMoveThreshold) {
    recoveryActive = true;
    drainMultiplier *= ramp.drySpellDrainMultiplier;
    timeBonusMultiplier *= ramp.drySpellTimeBonusMultiplier;
  }

  // Low-time recovery: slight relief when near death
  if (timeRemainingFraction <= ramp.lowTimeThresholdFraction) {
    recoveryActive = true;
    const panicT = 1 - Math.max(timeRemainingFraction, 0) / ramp.lowTimeThresholdFraction;
    drainMultiplier *= 1 - (1 - ramp.lowTimeDrainMultiplier) * panicT;
    timeBonusMultiplier *= 1 + ramp.lowTimeTimeBonusBoost * panicT;
  }

  return { drainMultiplier, drainAccelMultiplier, timeBonusMultiplier, recoveryActive };
}
```

**Step 2: Verify build still fails** (PieceGenerator still references AdaptiveTuning)

Run: `npm run build 2>&1 | head -20`

---

### Task 5: Modify PieceGenerator — remove adaptive, gradual unlocks, fixed rescue/threat, perf budget

**Files:**
- Modify: `src/core/PieceGenerator.ts` (multiple sections)

**Step 1: Update imports and GenerationContext**

Remove the AdaptiveTuning import (line 4):
```typescript
// DELETE:
import { AdaptiveTuning, DEFAULT_ADAPTIVE_TUNING } from './AdaptiveProgression';
```

Update `GenerationContext` interface (lines 98-104) to remove adaptiveTuning, add boardFillFraction:
```typescript
export interface GenerationContext {
  difficulty: Difficulty;
  score: number;
  movesSinceLastClear: number;
  timeRemainingFraction: number;
  boardFillFraction: number;
}
```

Update `normalizeContext` (lines 301-309):
```typescript
private normalizeContext(context?: GenerationContext): GenerationContext {
  return {
    difficulty: context?.difficulty ?? 'fast',
    score: context?.score ?? 0,
    movesSinceLastClear: context?.movesSinceLastClear ?? 0,
    timeRemainingFraction: context?.timeRemainingFraction ?? 1,
    boardFillFraction: context?.boardFillFraction ?? 0,
  };
}
```

**Step 2: Replace getAvailableTypes with gradual unlocks**

Replace the method (lines 311-325) with:

```typescript
private getAvailableTypes(context: GenerationContext): PieceType[] {
  const unlocks = PIECE_UNLOCK_SCORES[context.difficulty];
  const pool = new Set<string>(OPENING_POOL);
  for (const [pieceId, unlockScore] of unlocks) {
    if (context.score >= unlockScore) {
      pool.add(pieceId);
    }
  }
  return ALL_PIECE_TYPES.filter(type => pool.has(type.id));
}
```

Add the unlock score data near the top of the file (after the existing `THREAT_PIECES` set):

```typescript
const CHILL_UNLOCKS: [string, number][] = [
  ['pentomino_line', 3000],
  ['big_l', 5000],
  ['rectangle', 8000],
  ['diagonal_2', 11000],
  ['square_3x3', 18000],
  ['diagonal_3', 25000],
  ['big_rectangle', 35000],
];

const PIECE_UNLOCK_SCORES: Record<Difficulty, [string, number][]> = {
  chill: CHILL_UNLOCKS,
  fast: CHILL_UNLOCKS.map(([id, score]) => [id, Math.round(score * 0.7)]),
  blitz: CHILL_UNLOCKS.map(([id, score]) => [id, Math.round(score * 0.45)]),
};
```

**Step 3: Replace getContextWeight with fixed board-fill rules**

Replace the method (lines 327-356) with:

```typescript
private getContextWeight(typeId: string, context: GenerationContext): number {
  const mode = MODE_WEIGHTS[context.difficulty];
  const fill = context.boardFillFraction;

  // Fixed board-fill rescue/threat weighting (same for all players)
  let rescueBoost = 1;
  let threatDrop = 1;
  if (fill >= 0.85) {
    rescueBoost = 2.5;
    threatDrop = 0.2;
  } else if (fill >= 0.70) {
    rescueBoost = 1.8;
    threatDrop = 0.4;
  } else if (fill >= 0.60) {
    rescueBoost = 1.3;
    threatDrop = 0.7;
  }

  // Pressure state from dry spell or low time
  const underPressure =
    context.movesSinceLastClear >= mode.pressureMoves ||
    context.timeRemainingFraction <= mode.pressureTimeFraction;

  let weight = 1;

  if (RESCUE_PIECES.has(typeId)) {
    weight *= mode.rescueBias * rescueBoost;
    if (underPressure) {
      weight *= context.timeRemainingFraction <= 0.12 || context.movesSinceLastClear >= mode.pressureMoves + 1
        ? mode.rescueCrisisBoost
        : mode.rescuePressureBoost;
    }
  }

  if (THREAT_PIECES.has(typeId)) {
    weight *= mode.threatBias * threatDrop;
    if (underPressure) {
      weight *= context.timeRemainingFraction <= 0.12 || context.movesSinceLastClear >= mode.pressureMoves + 1
        ? mode.threatCrisisDrop
        : mode.threatPressureDrop;
    }
  }

  return weight;
}
```

**Step 4: Add performance budget to solvability check**

Replace `isBatchSolvable` (line 358-360) and `canSolveBatch` (lines 362-387):

```typescript
private isBatchSolvable(board: Board, batch: PieceInstance[]): boolean {
  const budget = { remaining: 200 };
  return this.canSolveBatch(board, batch, new Map<string, boolean>(), budget);
}

private canSolveBatch(
  board: Board,
  pieces: PieceInstance[],
  memo: Map<string, boolean>,
  budget: { remaining: number },
): boolean {
  if (pieces.length === 0) return true;
  if (budget.remaining <= 0) return true; // optimistic bail-out

  const key = `${this.serializeBoard(board)}|${pieces.map(this.pieceKey).sort().join('|')}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  budget.remaining--;

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const rest = pieces.slice(0, i).concat(pieces.slice(i + 1));
    const states = this.getPlacementStates(board, piece);
    for (const nextBoard of states) {
      if (this.canSolveBatch(nextBoard, rest, memo, budget)) {
        memo.set(key, true);
        return true;
      }
    }
  }

  memo.set(key, false);
  return false;
}
```

**Step 5: Remove MIDGAME_UNLOCKS and ENDGAME_UNLOCKS sets**

Delete the `MIDGAME_UNLOCKS` and `ENDGAME_UNLOCKS` const declarations (lines 22-32) since they're replaced by `PIECE_UNLOCK_SCORES`.

**Step 6: Verify build passes**

Run: `npm run build`
Expected: Success — all AdaptiveTuning references are gone, all types align.

**Step 7: Commit**

```bash
git add -A
git commit -m "Strip adaptive system, smooth difficulty ramp, gradual piece unlocks, perf budget

- Delete AdaptiveProgression and RunTelemetry (unfair leaderboard)
- Rewrite RunPacing with continuous interpolation (no more step-function walls)
- Replace batch piece unlocks with gradual per-piece score thresholds
- Fixed board-fill rescue/threat weighting (same for all players)
- Cap solvability search at 200 states (mobile perf)
- Simplify GameState, GameScene, main.ts"
```

---

### Task 6: Fix near-miss highlights

**Files:**
- Modify: `src/rendering/GridRenderer.ts:187-216`

**Step 1: Rewrite updateNearMiss method**

Replace lines 187-216 with:

```typescript
/** Update near-miss highlight: show empty cells in rows/cols at 6/8 or 7/8 filled */
updateNearMiss(board: Board): void {
  const g = this.nearMissGraphics;
  g.clear();
  if (!this.layout) return;

  const { gridOriginX, gridOriginY, cellSize } = this.layout;
  this.nearMissPhase += 0.1;

  // Check rows
  for (let r = 0; r < GRID_SIZE; r++) {
    const count = board.getRowFillCount(r);
    if (count === GRID_SIZE - 1 || count === GRID_SIZE - 2) {
      const alpha = count === GRID_SIZE - 1
        ? 0.25 + Math.sin(this.nearMissPhase * 4) * 0.10
        : 0.12 + Math.sin(this.nearMissPhase * 4) * 0.06;
      // Highlight only empty cells
      for (let c = 0; c < GRID_SIZE; c++) {
        if (board.getCell(r, c) === null) {
          const x = gridOriginX + c * cellSize;
          const y = gridOriginY + r * cellSize;
          g.roundRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 2);
          g.fill({ color: 0xf59e0b, alpha });
        }
      }
    }
  }

  // Check cols
  for (let c = 0; c < GRID_SIZE; c++) {
    const count = board.getColFillCount(c);
    if (count === GRID_SIZE - 1 || count === GRID_SIZE - 2) {
      const alpha = count === GRID_SIZE - 1
        ? 0.25 + Math.sin(this.nearMissPhase * 4) * 0.10
        : 0.12 + Math.sin(this.nearMissPhase * 4) * 0.06;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (board.getCell(r, c) === null) {
          const x = gridOriginX + c * cellSize;
          const y = gridOriginY + r * cellSize;
          g.roundRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 2);
          g.fill({ color: 0xf59e0b, alpha });
        }
      }
    }
  }
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Success

**Step 3: Commit**

```bash
git add src/rendering/GridRenderer.ts
git commit -m "Fix near-miss highlights: trigger at 6/8 and 7/8, highlight empty cells only"
```

---

### Task 7: Clean up and verify

**Step 1: Remove stale documentation references**

Check if `docs/IMPLEMENTATION_HANDOFF.md` references the deleted adaptive system. If so, delete it — it describes a system that no longer exists.

```bash
rm docs/IMPLEMENTATION_HANDOFF.md
```

Also check `BLOCK_BLAST_MASTER_SPEC.md` and `README.md` for adaptive system references and remove them if present.

**Step 2: Full build verification**

Run: `npm run build`
Expected: Clean success, no warnings.

**Step 3: Manual smoke test**

Open the game in a browser. For each difficulty (Chill, Fast, Blitz), verify:
- Game starts and timer counts down
- Pieces generate and can be placed
- Near-miss highlights appear on rows/cols at 6/8 and 7/8 (only empty cells glow)
- Difficulty increases gradually with score (no sudden wall)
- New piece types appear one at a time as score climbs
- Board clears are achievable with good play
- Game over works for both timeout and board lock

**Step 4: Final commit**

```bash
git add -A
git commit -m "Remove stale adaptive system docs"
```
