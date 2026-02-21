import { PieceInstance, PieceType, PIECE_COLORS } from './types';
import { ALL_PIECE_TYPES } from './PieceData';
import { createPieceInstance, cellCount } from './Piece';
import { Board } from './Board';
import { GenerationConfig } from './Config';

const GRID_CELLS = 64; // 8x8
const LARGE_THRESHOLD = 6; // pieces with 6+ cells count as "large"

/** Placement fitness for a piece type on the current board */
interface TypeFitness {
  type: PieceType;
  size: number;
  totalPlacements: number; // sum of placements across all variants
  bestVariantPlacements: number; // max placements of any single variant
}

export class PieceGenerator {
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  /** Generate a batch of 3 pieces, balanced by board state and gap shapes */
  generateBatch(board: Board): PieceInstance[] {
    const fillRatio = board.occupiedCount() / GRID_CELLS;

    // Analyze the board once — how well does each piece type fit?
    const fitness = this.analyzeFitness(board);

    // Try budget-balanced, spatially-aware batch where all 3 are placeable
    for (let attempt = 0; attempt < 30; attempt++) {
      const batch = this.smartBatch(fillRatio, fitness, board);
      if (batch.length === 3 && this.allPlaceable(board, batch)) return batch;
    }

    // Fallback: budget-balanced, at least one placeable
    for (let attempt = 0; attempt < 20; attempt++) {
      const batch = this.smartBatch(fillRatio, fitness, board);
      if (batch.length === 3 && batch.some(p => board.canPlaceAnywhere(p.shape))) {
        return batch;
      }
    }

    // Last resort: pure random with at least one placeable
    for (let attempt = 0; attempt < this.config.maxRerollAttempts; attempt++) {
      const batch = [this.randomPiece(), this.randomPiece(), this.randomPiece()];
      if (batch.some(p => board.canPlaceAnywhere(p.shape))) return batch;
    }

    return [this.randomPiece(), this.randomPiece(), this.randomPiece()];
  }

  /**
   * For each piece type, count how many valid placements exist
   * across all its variants. This tells us which shapes actually
   * match the board's available gaps.
   */
  private analyzeFitness(board: Board): Map<string, TypeFitness> {
    const map = new Map<string, TypeFitness>();
    for (const type of ALL_PIECE_TYPES) {
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
    _board: Board,
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
      const eligible = ALL_PIECE_TYPES.filter(t => {
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
        : ALL_PIECE_TYPES.filter(t =>
            !usedTypes.has(t.id) && fitness.get(t.id)!.bestVariantPlacements > 0
          );

      if (pool.length === 0) break;

      const type = this.spatialWeightedSelect(pool, targetSize, fitness);
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
  ): PieceType {
    const weights = types.map(t => {
      const f = fitness.get(t.id)!;
      const sizeDist = Math.abs(f.size - targetSize);
      const sizeWeight = 1 / (1 + sizeDist * sizeDist);
      const fitWeight = Math.sqrt(f.totalPlacements + 1);
      return sizeWeight * fitWeight;
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

  /** Create a random PieceInstance from a PieceType */
  private pieceFromType(type: PieceType): PieceInstance {
    const variant = type.variants[Math.floor(Math.random() * type.variants.length)];
    const color = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
    return createPieceInstance(type.id, variant, color);
  }

  /** Fully random piece (no weighting) */
  private randomPiece(): PieceInstance {
    const type = ALL_PIECE_TYPES[Math.floor(Math.random() * ALL_PIECE_TYPES.length)];
    return this.pieceFromType(type);
  }
}
