import { PieceInstance, PieceType, PIECE_COLORS } from './types';
import { ALL_PIECE_TYPES } from './PieceData';
import { createPieceInstance, cellCount } from './Piece';
import { Board } from './Board';
import { Difficulty, GenerationConfig } from './Config';

const GRID_CELLS = 64; // 8x8
const LARGE_THRESHOLD = 6; // pieces with 6+ cells count as "large"
const OPENING_POOL = new Set([
  'single',
  'domino',
  'tromino_line',
  'small_corner',
  'tetromino_line',
  'small_l',
  't_shape',
  'zigzag',
  'square_2x2',
]);
const RESCUE_PIECES = new Set([
  'single',
  'domino',
  'tromino_line',
  'small_corner',
  'square_2x2',
  'diagonal_2',
]);
const THREAT_PIECES = new Set([
  'square_3x3',
  'big_rectangle',
  'rectangle',
  'big_l',
  'pentomino_line',
]);

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

const MODE_WEIGHTS: Record<Difficulty, {
  rescueBias: number;
  threatBias: number;
  pressureMoves: number;
  pressureTimeFraction: number;
  rescuePressureBoost: number;
  rescueCrisisBoost: number;
  threatPressureDrop: number;
  threatCrisisDrop: number;
}> = {
  chill: {
    rescueBias: 1.16,
    threatBias: 0.84,
    pressureMoves: 3,
    pressureTimeFraction: 0.22,
    rescuePressureBoost: 2.35,
    rescueCrisisBoost: 3.45,
    threatPressureDrop: 0.36,
    threatCrisisDrop: 0.16,
  },
  fast: {
    rescueBias: 1,
    threatBias: 1,
    pressureMoves: 2,
    pressureTimeFraction: 0.25,
    rescuePressureBoost: 2.1,
    rescueCrisisBoost: 3.2,
    threatPressureDrop: 0.45,
    threatCrisisDrop: 0.18,
  },
  blitz: {
    rescueBias: 0.92,
    threatBias: 1.08,
    pressureMoves: 2,
    pressureTimeFraction: 0.18,
    rescuePressureBoost: 1.8,
    rescueCrisisBoost: 2.7,
    threatPressureDrop: 0.58,
    threatCrisisDrop: 0.24,
  },
};

/** Placement fitness for a piece type on the current board */
interface TypeFitness {
  type: PieceType;
  size: number;
  totalPlacements: number; // sum of placements across all variants
  bestVariantPlacements: number; // max placements of any single variant
}

export interface GenerationContext {
  difficulty: Difficulty;
  score: number;
  movesSinceLastClear: number;
  timeRemainingFraction: number;
  boardFillFraction: number;
}

export class PieceGenerator {
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  /** Generate a batch of 3 pieces, balanced by board state and gap shapes */
  generateBatch(board: Board, context?: GenerationContext): PieceInstance[] {
    const fillRatio = board.occupiedCount() / GRID_CELLS;
    const normalizedContext = this.normalizeContext(context);
    const availableTypes = this.getAvailableTypes(normalizedContext);

    // Analyze the board once — how well does each piece type fit?
    const fitness = this.analyzeFitness(board, availableTypes);

    // Try budget-balanced, spatially-aware batch where all 3 are placeable
    for (let attempt = 0; attempt < 30; attempt++) {
      const batch = this.smartBatch(fillRatio, fitness, availableTypes, normalizedContext);
      if (this.isAcceptableBatch(board, batch)) return batch;
    }

    // Fallback: budget-balanced, at least one placeable
    for (let attempt = 0; attempt < 20; attempt++) {
      const batch = this.smartBatch(fillRatio, fitness, availableTypes, normalizedContext);
      if (this.isPlayableBatch(board, batch)) {
        return batch;
      }
    }

    // Last resort: pure random with at least one placeable
    for (let attempt = 0; attempt < this.config.maxRerollAttempts; attempt++) {
      const batch = [
        this.randomPiece(availableTypes),
        this.randomPiece(availableTypes),
        this.randomPiece(availableTypes),
      ];
      if (this.isPlayableBatch(board, batch)) return batch;
    }

    return [
      this.randomPiece(availableTypes),
      this.randomPiece(availableTypes),
      this.randomPiece(availableTypes),
    ];
  }

  /**
   * For each piece type, count how many valid placements exist
   * across all its variants. This tells us which shapes actually
   * match the board's available gaps.
   */
  private analyzeFitness(board: Board, pieceTypes: PieceType[]): Map<string, TypeFitness> {
    const map = new Map<string, TypeFitness>();
    for (const type of pieceTypes) {
      let totalPlacements = 0;
      let bestVariantPlacements = 0;
      for (const variant of type.variants) {
        const count = board.countPlacements(variant);
        totalPlacements += count;
        if (count > bestVariantPlacements) bestVariantPlacements = count;
      }
      map.set(type.id, {
        type,
        size: cellCount(type.variants[0]),
        totalPlacements,
        bestVariantPlacements,
      });
    }
    return map;
  }

  /**
   * Cell budget scales with board fill:
   *  - Empty board (fill=0):   budget ~14 → medium/large batches
   *  - Half full (fill=0.5):   budget ~10 → balanced batches
   *  - Mostly full (fill=0.8): budget ~7  → smaller, manageable pieces
   */
  private getCellBudget(fillRatio: number): number {
    const base = 14 - fillRatio * 9;
    const variance = (Math.random() - 0.5) * 4; // ±2
    return Math.max(3, Math.min(20, Math.round(base + variance)));
  }

  /**
   * Generate a batch using cell budget + spatial fitness weighting.
   * Pieces that fit more places on the board get higher probability.
   */
  private smartBatch(
    fillRatio: number,
    fitness: Map<string, TypeFitness>,
    pieceTypes: PieceType[],
    context: GenerationContext,
  ): PieceInstance[] {
    const budget = this.getCellBudget(fillRatio);
    const pieces: PieceInstance[] = [];
    const usedTypes = new Set<string>();
    let remaining = budget;
    let largeCount = 0;

    for (let i = 0; i < 3; i++) {
      const slotsLeft = 3 - i;
      const targetSize = remaining / slotsLeft;

      // Filter eligible piece types
      const eligible = pieceTypes.filter(t => {
        if (usedTypes.has(t.id)) return false;
        const f = fitness.get(t.id)!;
        // Must actually fit somewhere on the board
        if (f.bestVariantPlacements === 0) return false;
        // Budget constraints
        if (f.size > remaining && slotsLeft > 1) return false;
        // Max 1 large piece per batch
        if (f.size >= LARGE_THRESHOLD && largeCount >= 1) return false;
        // Last piece: don't go wildly over budget
        if (i === 2 && f.size > remaining + 2) return false;
        return true;
      });

      const pool = eligible.length > 0
        ? eligible
        : pieceTypes.filter(t =>
            !usedTypes.has(t.id) && fitness.get(t.id)!.bestVariantPlacements > 0
          );

      if (pool.length === 0) break;

      const type = this.spatialWeightedSelect(pool, targetSize, fitness, context);
      const piece = this.pieceFromType(type);
      pieces.push(piece);
      usedTypes.add(type.id);

      const size = fitness.get(type.id)!.size;
      remaining -= size;
      if (size >= LARGE_THRESHOLD) largeCount++;
    }

    return pieces;
  }

  /**
   * Combined weighting: size proximity * spatial fitness.
   *
   * sizeWeight:  1 / (1 + |size - target|^2)  — prefer pieces near budget target
   * fitWeight:   sqrt(totalPlacements + 1)     — prefer pieces with more placement options
   *
   * The sqrt dampens the fitness so a piece with 50 placements doesn't
   * completely dominate one with 10. Both are good; the 50 one is just
   * somewhat more likely.
   */
  private spatialWeightedSelect(
    types: PieceType[],
    targetSize: number,
    fitness: Map<string, TypeFitness>,
    context: GenerationContext,
  ): PieceType {
    const weights = types.map(t => {
      const f = fitness.get(t.id)!;
      const sizeDist = Math.abs(f.size - targetSize);
      const sizeWeight = 1 / (1 + sizeDist * sizeDist);
      const fitWeight = Math.sqrt(f.totalPlacements + 1);
      const contextWeight = this.getContextWeight(t.id, context);
      return sizeWeight * fitWeight * contextWeight;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < types.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return types[i];
    }

    return types[types.length - 1];
  }

  /** Check if all pieces in a batch can be placed somewhere on the board */
  private allPlaceable(board: Board, batch: PieceInstance[]): boolean {
    return batch.every(p => board.canPlaceAnywhere(p.shape));
  }

  private isAcceptableBatch(board: Board, batch: PieceInstance[]): boolean {
    if (!this.isPlayableBatch(board, batch)) return false;
    if (!this.config.ensureBatchSolvable) return true;
    return this.isBatchSolvable(board, batch);
  }

  private isPlayableBatch(board: Board, batch: PieceInstance[]): boolean {
    if (batch.length !== 3) return false;
    if (this.config.ensureLegalPlacement) {
      return this.allPlaceable(board, batch);
    }
    return batch.some(p => board.canPlaceAnywhere(p.shape));
  }

  private normalizeContext(context?: GenerationContext): GenerationContext {
    return {
      difficulty: context?.difficulty ?? 'fast',
      score: context?.score ?? 0,
      movesSinceLastClear: context?.movesSinceLastClear ?? 0,
      timeRemainingFraction: context?.timeRemainingFraction ?? 1,
      boardFillFraction: context?.boardFillFraction ?? 0,
    };
  }

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

  private getContextWeight(typeId: string, context: GenerationContext): number {
    const mode = MODE_WEIGHTS[context.difficulty];
    const fill = context.boardFillFraction;

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
    if (budget.remaining <= 0) return true;

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

  private getPlacementStates(board: Board, piece: PieceInstance): Board[] {
    const states: { nextBoard: Board; linesCleared: number; occupied: number }[] = [];

    for (let row = 0; row <= 8 - piece.rows; row++) {
      for (let col = 0; col <= 8 - piece.cols; col++) {
        if (!board.canPlace(piece.shape, row, col)) continue;
        const nextBoard = this.cloneBoard(board);
        nextBoard.place(piece.shape, row, col, piece.color);
        const completed = nextBoard.findCompleted();
        let linesCleared = 0;
        if (completed.rows.length > 0 || completed.cols.length > 0) {
          const clearResult = nextBoard.clearLines(completed);
          linesCleared = clearResult.totalLinesCleared;
        }
        states.push({
          nextBoard,
          linesCleared,
          occupied: nextBoard.occupiedCount(),
        });
      }
    }

    states.sort((a, b) => {
      if (b.linesCleared !== a.linesCleared) return b.linesCleared - a.linesCleared;
      return a.occupied - b.occupied;
    });

    return states.map(state => state.nextBoard);
  }

  private cloneBoard(board: Board): Board {
    const next = new Board();
    next.grid = board.grid.map(row => [...row]);
    return next;
  }

  private serializeBoard(board: Board): string {
    return board.grid
      .map(row => row.map(cell => (cell === null ? '.' : '#')).join(''))
      .join('/');
  }

  private pieceKey = (piece: PieceInstance): string =>
    `${piece.typeId}:${JSON.stringify(piece.shape)}`;

  /** Create a random PieceInstance from a PieceType */
  private pieceFromType(type: PieceType): PieceInstance {
    const variant = type.variants[Math.floor(Math.random() * type.variants.length)];
    const color = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
    return createPieceInstance(type.id, variant, color);
  }

  /** Fully random piece (no weighting) */
  private randomPiece(pieceTypes: PieceType[]): PieceInstance {
    const pool = pieceTypes.length > 0 ? pieceTypes : ALL_PIECE_TYPES;
    const type = pool[Math.floor(Math.random() * pool.length)];
    return this.pieceFromType(type);
  }
}
