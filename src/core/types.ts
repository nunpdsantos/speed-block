// ── Grid ──
export const GRID_SIZE = 8;

export type CellColor = number; // index into palette
export type Grid = (CellColor | null)[][];

// ── Piece shape ──
export type ShapeMatrix = boolean[][];

export interface PieceType {
  id: string;
  variants: ShapeMatrix[];
}

// ── Piece instance (in tray or being dragged) ──
export interface PieceInstance {
  typeId: string;
  shape: ShapeMatrix;
  color: CellColor;
  rows: number;
  cols: number;
}

// ── Grid coordinate ──
export interface GridPos {
  row: number;
  col: number;
}

// ── Cell positions occupied by a piece at a grid position ──
export interface PlacementCells {
  positions: GridPos[];
}

// ── Line clear result ──
export interface ClearResult {
  rows: number[];
  cols: number[];
  cellsCleared: GridPos[];
  totalCellsRemoved: number;
  totalLinesCleared: number;
}

// ── Score breakdown for a single turn ──
export interface ScoreBreakdown {
  basePoints: number;
  lineBonus: number;
  streakMultiplier: number;
  speedMultiplier: number;
  turnScore: number;
  totalScore: number;
}

// ── Feedback event: the contract between core → rendering ──
export interface FeedbackEvent {
  type: 'place' | 'clear' | 'combo' | 'gameOver' | 'newBatch' | 'boardClear';
  pieceIndex?: number;
  placedCells?: GridPos[];
  clearResult?: ClearResult;
  scoreBreakdown?: ScoreBreakdown;
  streakCount?: number;
  isGameOver?: boolean;
  newBatch?: PieceInstance[];
  isBoardClear?: boolean;
}

// ── Color palette — bold and saturated ──
export const PIECE_COLORS: number[] = [
  0x4b7bec, // blue
  0xe8913a, // orange
  0xd65db1, // pink
  0x8854d0, // purple
  0xd64545, // red
  0x20bf6b, // green
  0x45aaf2, // light blue
  0xf7b731, // yellow
];
