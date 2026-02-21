import { Board } from './Board';
import { PieceGenerator } from './PieceGenerator';
import { ScoreEngine } from './ScoreEngine';
import { Leaderboard } from './Leaderboard';
import { cellCount } from './Piece';
import { GameConfig, DEFAULT_CONFIG } from './Config';
import { PieceInstance, FeedbackEvent, ClearResult } from './types';

export class GameState {
  board: Board;
  activePieces: (PieceInstance | null)[];
  score: number;
  highScore: number;
  streakCount: number;
  movesSinceLastClear: number;
  piecesPlacedInBatch: number;
  isGameOver: boolean;
  lastRank: number | null = null;
  leaderboard: Leaderboard;
  batchStartTime: number = 0;

  private generator: PieceGenerator;
  private scoreEngine: ScoreEngine;
  private config: GameConfig;

  constructor(config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.board = new Board();
    this.generator = new PieceGenerator(config.generation);
    this.scoreEngine = new ScoreEngine(config.scoring);
    this.leaderboard = new Leaderboard();
    this.activePieces = [null, null, null];
    this.score = 0;
    this.highScore = this.leaderboard.getTopScore();
    this.streakCount = 0;
    this.movesSinceLastClear = 0;
    this.piecesPlacedInBatch = 0;
    this.isGameOver = false;
  }

  /** Seconds elapsed since current batch was dealt */
  get batchElapsed(): number {
    return (Date.now() - this.batchStartTime) / 1000;
  }

  /** Current speed multiplier for display */
  get speedMultiplier(): number {
    return this.scoreEngine.getSpeedMultiplier(this.batchElapsed);
  }

  /** Start a new game */
  start(): FeedbackEvent {
    this.board.reset();
    this.score = 0;
    this.streakCount = 0;
    this.movesSinceLastClear = 0;
    this.piecesPlacedInBatch = 0;
    this.isGameOver = false;
    this.batchStartTime = Date.now();
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

    // Snapshot elapsed time for speed bonus
    const elapsedSeconds = this.batchElapsed;

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

    // 7. Compute score (with speed bonus)
    if (clearResult.totalLinesCleared > 0 || this.config.scoring.placementPointsPerCell > 0) {
      const breakdown = this.scoreEngine.calculate(
        clearResult,
        cellCount(piece.shape),
        this.streakCount,
        isBoardClear,
        elapsedSeconds,
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

    // 8. Mark piece as placed
    this.activePieces[pieceIndex] = null;
    this.piecesPlacedInBatch++;

    // 9. Generate new batch if all 3 placed
    if (this.piecesPlacedInBatch >= 3) {
      this.piecesPlacedInBatch = 0;
      this.batchStartTime = Date.now();
      const newBatch = this.generator.generateBatch(this.board);
      this.activePieces = [...newBatch];
      events.push({ type: 'newBatch', newBatch });
    }

    // 10. Check game over
    if (this.checkGameOver()) {
      this.isGameOver = true;
      // Don't submit yet — GameOverScene will submit after name entry
      this.lastRank = this.leaderboard.wouldRank(this.score) ? -1 : null;
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
