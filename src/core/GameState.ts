import { Board } from './Board';
import { PieceGenerator } from './PieceGenerator';
import { ScoreEngine } from './ScoreEngine';
import { Difficulty, GameConfig, DEFAULT_CONFIG } from './Config';
import { getRunPacing } from './RunPacing';
import { PieceInstance, FeedbackEvent, ClearResult, RunEndCause, RunSummary } from './types';

/** Read the cached top score from localStorage for a given difficulty */
function readCachedTopScore(difficulty: Difficulty): number {
  try {
    const raw = localStorage.getItem(`speedblock_${difficulty}_top10`);
    if (raw) {
      const entries = JSON.parse(raw);
      return entries.length > 0 ? entries[0].score : 0;
    }
  } catch { /* */ }
  return 0;
}

export class GameState {
  board: Board;
  activePieces: (PieceInstance | null)[];
  score: number;
  highScore: number;
  streakCount: number;
  movesSinceLastClear: number;
  piecesPlacedInBatch: number;
  isGameOver: boolean;
  /** Time remaining in seconds */
  timeRemaining: number = 0;
  /** Seconds elapsed since last piece placement (for speed-time scaling) */
  pieceElapsed: number = 0;
  /** Total seconds played (for drain acceleration) */
  gameElapsed: number = 0;
  /** Current drain rate multiplier */
  drainRate: number = 1;
  deathCause: RunEndCause | null = null;
  totalTurns: number = 0;
  clearTurns: number = 0;
  maxStreak: number = 0;
  maxDrySpell: number = 0;
  peakBoardFillCount: number = 0;

  private generator: PieceGenerator;
  private scoreEngine: ScoreEngine;
  readonly config: GameConfig;
  readonly difficulty: Difficulty;

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

  get maxTime(): number {
    return this.config.timer.maxSeconds;
  }

  /** Current speed fraction (live, for UI display): 1.0 = instant, min = slow */
  get currentSpeedFraction(): number {
    return this.scoreEngine.getSpeedFraction(this.pieceElapsed);
  }

  /** Start a new game */
  start(): FeedbackEvent {
    this.board.reset();
    this.score = 0;
    this.streakCount = 0;
    this.movesSinceLastClear = 0;
    this.piecesPlacedInBatch = 0;
    this.isGameOver = false;
    this.timeRemaining = this.config.timer.startSeconds;
    this.pieceElapsed = 0;
    this.gameElapsed = 0;
    this.drainRate = 1;
    this.deathCause = null;
    this.totalTurns = 0;
    this.clearTurns = 0;
    this.maxStreak = 0;
    this.maxDrySpell = 0;
    this.peakBoardFillCount = 0;
    const batch = this.generator.generateBatch(this.board, this.getGenerationContext());
    this.activePieces = [...batch];
    return { type: 'newBatch', newBatch: batch };
  }

  /** Tick the timer down with accelerating drain. Returns true if time ran out. */
  tick(dt: number): boolean {
    if (this.isGameOver) return false;

    this.pieceElapsed += dt;
    this.gameElapsed += dt;

    const pacing = this.getRunPacing();
    this.drainRate = Math.max(
      0.55,
      pacing.drainMultiplier +
      (this.gameElapsed / 60) * this.config.timer.drainAccelPerMinute * pacing.drainAccelMultiplier,
    );
    this.timeRemaining = Math.max(0, this.timeRemaining - dt * this.drainRate);

    if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      this.deathCause = 'timeout';
      return true;
    }
    return false;
  }

  /** Add time to the bank (capped at maxSeconds) */
  addTime(seconds: number): void {
    this.timeRemaining = Math.min(this.timeRemaining + seconds, this.config.timer.maxSeconds);
  }

  /** Attempt to place piece at index into grid at (row, col).
   *  Returns array of feedback events describing what happened. */
  tryPlace(pieceIndex: number, row: number, col: number): FeedbackEvent[] {
    const events: FeedbackEvent[] = [];
    const piece = this.activePieces[pieceIndex];
    if (!piece || this.isGameOver) return events;
    const preMoveMovesSinceLastClear = this.movesSinceLastClear;
    const preMoveTimeRemainingFraction = this.maxTime > 0 ? this.timeRemaining / this.maxTime : 1;
    this.totalTurns++;

    // 1. Validate
    if (!this.board.canPlace(piece.shape, row, col)) return events;

    // 2. Commit cells
    const placedCells = this.board.place(piece.shape, row, col, piece.color);
    const placeSpeedFraction = this.scoreEngine.getSpeedFraction(this.pieceElapsed);
    events.push({ type: 'place', pieceIndex, placedCells, speedFraction: placeSpeedFraction });

    // 3. Detect completed lines
    const completed = this.board.findCompleted();

    // 4. Clear lines (NO gravity)
    let clearResult: ClearResult = {
      rows: [], cols: [], cellsCleared: [],
      totalCellsRemoved: 0, totalLinesCleared: 0,
    };
    if (completed.rows.length > 0 || completed.cols.length > 0) {
      clearResult = this.board.clearLines(completed);
    }

    // 5. Check board clear
    const isBoardClear = clearResult.totalLinesCleared > 0 && this.board.isEmpty();

    // 6. Update combo state BEFORE scoring
    if (clearResult.totalLinesCleared > 0) {
      this.clearTurns++;
      this.movesSinceLastClear = 0;
    } else {
      this.movesSinceLastClear++;
      this.maxDrySpell = Math.max(this.maxDrySpell, this.movesSinceLastClear);
      if (this.movesSinceLastClear >= this.config.scoring.comboWindowPlacements) {
        if (this.streakCount >= 3) {
          events[0].streakBroken = true;
          events[0].previousStreak = this.streakCount;
        }
        this.streakCount = 0;
      }
    }

    // 7. Snapshot speed fraction and reset piece timer
    const speedFraction = this.scoreEngine.getSpeedFraction(this.pieceElapsed);
    this.pieceElapsed = 0;

    // 8. Calculate time bonus scaled by speed, add to bank
    const timeBonus = this.scoreEngine.calculateTimeBonus(
      clearResult.totalLinesCleared,
      isBoardClear,
      this.streakCount,
      speedFraction,
    );
    const pacing = this.getRunPacing(preMoveMovesSinceLastClear, preMoveTimeRemainingFraction);
    const tunedTimeBonus = Math.round(timeBonus * pacing.timeBonusMultiplier * 10) / 10;
    this.addTime(tunedTimeBonus);

    // 9. Award placement points (per block placed)
    const placementPoints = placedCells.length * this.config.scoring.pointsPerBlockPlaced;
    this.score += placementPoints;

    // 10. Compute score for clears (no speed multiplier)
    if (clearResult.totalLinesCleared > 0) {
      const breakdown = this.scoreEngine.calculate(
        clearResult,
        this.streakCount,
        isBoardClear,
      );
      this.score += breakdown.turnScore;
      breakdown.totalScore = this.score;

      this.streakCount++;
      this.maxStreak = Math.max(this.maxStreak, this.streakCount);
      events.push({
        type: clearResult.totalLinesCleared >= 2 ? 'combo' : 'clear',
        clearResult,
        scoreBreakdown: breakdown,
        streakCount: this.streakCount,
        timeBonus: tunedTimeBonus,
      });

      if (isBoardClear) {
        events.push({
          type: 'boardClear',
          isBoardClear: true,
          scoreBreakdown: breakdown,
          timeBonus: tunedTimeBonus,
        });
      }
    } else {
      // No clear — still emit timeBonus for the placement
      events[0].timeBonus = tunedTimeBonus;
    }

    // 10. Mark piece as placed
    this.activePieces[pieceIndex] = null;
    this.piecesPlacedInBatch++;
    this.peakBoardFillCount = Math.max(this.peakBoardFillCount, this.board.occupiedCount());

    // 11. Generate new batch if all 3 placed
    if (this.piecesPlacedInBatch >= 3) {
      this.piecesPlacedInBatch = 0;
      const newBatch = this.generator.generateBatch(this.board, this.getGenerationContext());
      this.activePieces = [...newBatch];
      events.push({ type: 'newBatch', newBatch });
    }

    // 12. Check game over (no valid placement)
    if (this.checkGameOver()) {
      this.isGameOver = true;
      this.deathCause = 'board_lock';
      events.push({ type: 'gameOver', isGameOver: true });
    }

    return events;
  }

  /** Check if any remaining piece can be placed anywhere */
  private checkGameOver(): boolean {
    for (const piece of this.activePieces) {
      if (!piece) continue;
      if (this.board.canPlaceAnywhere(piece.shape)) return false;
    }
    return true;
  }

  private getGenerationContext() {
    return {
      difficulty: this.difficulty,
      score: this.score,
      movesSinceLastClear: this.movesSinceLastClear,
      timeRemainingFraction: this.maxTime > 0 ? this.timeRemaining / this.maxTime : 1,
      boardFillFraction: this.board.occupiedCount() / 64,
    };
  }

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

  buildRunSummary(endCauseOverride?: RunEndCause): RunSummary {
    return {
      score: this.score,
      endCause: endCauseOverride ?? this.deathCause ?? 'board_lock',
      totalTurns: this.totalTurns,
      clearTurns: this.clearTurns,
      maxStreak: this.maxStreak,
      maxDrySpell: this.maxDrySpell,
      gameElapsed: this.gameElapsed,
      timeRemaining: this.timeRemaining,
      boardFillFraction: this.board.occupiedCount() / 64,
      peakBoardFillFraction: this.peakBoardFillCount / 64,
    };
  }
}
