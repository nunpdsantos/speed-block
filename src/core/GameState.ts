import { Board } from './Board';
import { PieceGenerator } from './PieceGenerator';
import { ScoreEngine } from './ScoreEngine';
import { cellCount } from './Piece';
import { GameConfig, DEFAULT_CONFIG } from './Config';
import { PieceInstance, FeedbackEvent, ClearResult } from './types';

/** Read the cached top score from localStorage (written by Leaderboard) */
function readCachedTopScore(): number {
  try {
    const raw = localStorage.getItem('freeblock_top10');
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
  batchStartTime: number = 0;
  /** Timestamp of last piece placement (for per-piece speed timer) */
  lastPlaceTime: number = 0;
  /** Consecutive fast placements count */
  speedStreak: number = 0;

  private generator: PieceGenerator;
  private scoreEngine: ScoreEngine;
  private config: GameConfig;

  constructor(config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.board = new Board();
    this.generator = new PieceGenerator(config.generation);
    this.scoreEngine = new ScoreEngine(config.scoring);
    this.activePieces = [null, null, null];
    this.score = 0;
    this.highScore = readCachedTopScore();
    this.streakCount = 0;
    this.movesSinceLastClear = 0;
    this.piecesPlacedInBatch = 0;
    this.isGameOver = false;
  }

  /** Seconds elapsed since last piece placement (or batch start if first piece) */
  get pieceElapsed(): number {
    return (Date.now() - this.lastPlaceTime) / 1000;
  }

  /** Current speed multiplier for display (base + speed streak) */
  get speedMultiplier(): number {
    return this.scoreEngine.getTotalSpeedMultiplier(this.pieceElapsed, this.speedStreak);
  }

  /** Current base speed multiplier (without streak, for timer display) */
  get baseSpeedMultiplier(): number {
    return this.scoreEngine.getSpeedMultiplier(this.pieceElapsed);
  }

  /** Start a new game */
  start(): FeedbackEvent {
    this.board.reset();
    this.score = 0;
    this.streakCount = 0;
    this.movesSinceLastClear = 0;
    this.piecesPlacedInBatch = 0;
    this.isGameOver = false;
    this.speedStreak = 0;
    const now = Date.now();
    this.batchStartTime = now;
    this.lastPlaceTime = now;
    const batch = this.generator.generateBatch(this.board);
    this.activePieces = [...batch];
    return { type: 'newBatch', newBatch: batch };
  }

  /** Attempt to place piece at index into grid at (row, col).
   *  Returns array of feedback events describing what happened. */
  tryPlace(pieceIndex: number, row: number, col: number): FeedbackEvent[] {
    const events: FeedbackEvent[] = [];
    const piece = this.activePieces[pieceIndex];
    if (!piece || this.isGameOver) return events;

    // 1. Validate
    if (!this.board.canPlace(piece.shape, row, col)) return events;

    // Snapshot elapsed time since last placement for speed bonus
    const elapsedSeconds = this.pieceElapsed;

    // 2. Commit cells
    const placedCells = this.board.place(piece.shape, row, col, piece.color);
    events.push({ type: 'place', pieceIndex, placedCells });

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

    // 6. Update combo state BEFORE scoring (so streak applies to current clear)
    if (clearResult.totalLinesCleared > 0) {
      // Cleared lines — increment streak
      this.movesSinceLastClear = 0;
    } else {
      this.movesSinceLastClear++;
      if (this.movesSinceLastClear >= this.config.scoring.comboWindowPlacements) {
        this.streakCount = 0;
      }
    }

    // 7. Update speed streak (before scoring so current streak applies)
    if (this.scoreEngine.isFastPlacement(elapsedSeconds)) {
      this.speedStreak++;
    } else {
      this.speedStreak = 0;
    }

    // 8. Compute score (with speed bonus + speed streak)
    if (clearResult.totalLinesCleared > 0 || this.config.scoring.placementPointsPerCell > 0) {
      const breakdown = this.scoreEngine.calculate(
        clearResult,
        cellCount(piece.shape),
        this.streakCount,
        isBoardClear,
        elapsedSeconds,
        this.speedStreak,
      );
      this.score += breakdown.turnScore;
      breakdown.totalScore = this.score;

      if (clearResult.totalLinesCleared > 0) {
        this.streakCount++;
        events.push({
          type: clearResult.totalLinesCleared >= 2 ? 'combo' : 'clear',
          clearResult,
          scoreBreakdown: breakdown,
          streakCount: this.streakCount,
        });
      }

      if (isBoardClear) {
        events.push({ type: 'boardClear', isBoardClear: true, scoreBreakdown: breakdown });
      }
    }

    // 9. Mark piece as placed, reset per-piece timer
    this.activePieces[pieceIndex] = null;
    this.piecesPlacedInBatch++;
    this.lastPlaceTime = Date.now();

    // 10. Generate new batch if all 3 placed
    if (this.piecesPlacedInBatch >= 3) {
      this.piecesPlacedInBatch = 0;
      const now = Date.now();
      this.batchStartTime = now;
      this.lastPlaceTime = now;
      const newBatch = this.generator.generateBatch(this.board);
      this.activePieces = [...newBatch];
      events.push({ type: 'newBatch', newBatch });
    }

    // 11. Check game over
    if (this.checkGameOver()) {
      this.isGameOver = true;
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

}
