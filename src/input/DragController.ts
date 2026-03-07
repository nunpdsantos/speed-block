import { PieceInstance, GridPos, GRID_SIZE } from '../core/types';
import { Board } from '../core/Board';
import { LayoutManager } from '../rendering/LayoutManager';

export interface DragState {
  pieceIndex: number;
  piece: PieceInstance;
  pointerX: number;
  pointerY: number;
  gridPos: GridPos | null;
  isValid: boolean;
  /** True when pointer is in the tray cancel zone on release */
  inTrayZone: boolean;
}

export type DragStartCallback = (state: DragState) => void;
export type DragMoveCallback = (state: DragState) => void;
export type DragEndCallback = (state: DragState) => void;
export type DragCancelCallback = () => void;
export type SelectCallback = (pieceIndex: number, piece: PieceInstance) => void;
export type DeselectCallback = () => void;
export type TapPlaceCallback = (pieceIndex: number, gridPos: GridPos) => void;

const TAP_THRESHOLD = 12; // pixels — below this distance is a tap, not a drag
const HYSTERESIS_FRACTION = 0.12; // 12% of cell size

export class DragController {
  private layoutManager: LayoutManager;
  private board: Board;
  private pieces: (PieceInstance | null)[] = [];
  private dragging: DragState | null = null;
  private active = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownPieceIndex = -1;

  // Hysteresis: last snapped grid position during drag
  private lastSnappedRow = 0;
  private lastSnappedCol = 0;
  private hasSnappedPos = false;

  // Selected piece for tap-to-place
  selectedIndex = -1;
  selectedPiece: PieceInstance | null = null;

  // Drag callbacks
  onDragStart: DragStartCallback = () => {};
  onDragMove: DragMoveCallback = () => {};
  onDragEnd: DragEndCallback = () => {};
  onDragCancel: DragCancelCallback = () => {};

  // Tap-to-place callbacks
  onSelect: SelectCallback = () => {};
  onDeselect: DeselectCallback = () => {};
  onTapPlace: TapPlaceCallback = () => {};

  constructor(layoutManager: LayoutManager, board: Board) {
    this.layoutManager = layoutManager;
    this.board = board;
  }

  attach(canvas: HTMLCanvasElement): void {
    this.active = true;
    canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', this.handlePointerCancel, { passive: false });
  }

  detach(canvas: HTMLCanvasElement): void {
    this.active = false;
    this.deselect();
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerCancel);
  }

  updatePieces(pieces: (PieceInstance | null)[]): void {
    this.pieces = pieces;
    // If selected piece was consumed, deselect
    if (this.selectedIndex >= 0 && !this.pieces[this.selectedIndex]) {
      this.deselect();
    }
  }

  updateBoard(board: Board): void {
    this.board = board;
  }

  deselect(): void {
    if (this.selectedIndex >= 0) {
      this.selectedIndex = -1;
      this.selectedPiece = null;
      this.onDeselect();
    }
  }

  private hitTrayPiece(px: number, py: number): number {
    const layout = this.layoutManager.layout;
    const slotWidth = layout.trayWidth / 3;
    for (let i = 0; i < 3; i++) {
      if (!this.pieces[i]) continue;
      const slotX = layout.trayOriginX + slotWidth * i;
      const slotY = layout.trayOriginY;
      if (px >= slotX && px < slotX + slotWidth &&
          py >= slotY && py < slotY + layout.trayHeight) {
        return i;
      }
    }
    return -1;
  }

  /** Check if pointer position is in the tray cancel zone */
  private isInTrayZone(py: number): boolean {
    const layout = this.layoutManager.layout;
    return py >= layout.trayOriginY;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.active) return;
    // If a previous drag got stuck (missed pointerup/pointercancel), force-cancel it
    if (this.dragging) {
      this.dragging = null;
      this.onDragCancel();
      this.pointerDownPos = null;
      this.pointerDownPieceIndex = -1;
    }
    e.preventDefault();
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic events */ }

    const px = e.clientX;
    const py = e.clientY;
    this.pointerDownPos = { x: px, y: py };

    // Check which tray piece was hit
    const hitIndex = this.hitTrayPiece(px, py);
    this.pointerDownPieceIndex = hitIndex;

    if (hitIndex >= 0) {
      // Start drag immediately (will check for tap on pointerup)
      const piece = this.pieces[hitIndex]!;
      this.dragging = {
        pieceIndex: hitIndex,
        piece,
        pointerX: px,
        pointerY: py,
        gridPos: null,
        isValid: false,
        inTrayZone: false,
      };
      // Reset hysteresis for new drag
      this.hasSnappedPos = false;
      this.updateGridSnap(px, py);
      this.onDragStart(this.dragging);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.active) return;

    const px = e.clientX;
    const py = e.clientY;

    if (this.dragging) {
      e.preventDefault();
      this.dragging.pointerX = px;
      this.dragging.pointerY = py;
      this.updateGridSnap(px, py);
      this.onDragMove(this.dragging);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.active) return;
    e.preventDefault();

    const px = e.clientX;
    const py = e.clientY;

    // Check if this was a tap (minimal movement)
    const isTap = this.pointerDownPos &&
      Math.hypot(px - this.pointerDownPos.x, py - this.pointerDownPos.y) < TAP_THRESHOLD;

    if (isTap && this.dragging) {
      // Tap on tray piece — select it instead of dragging
      const hitIndex = this.pointerDownPieceIndex;
      // Cancel the in-progress drag visual
      this.dragging = null;
      this.onDragCancel();

      if (hitIndex >= 0) {
        if (this.selectedIndex === hitIndex) {
          // Tap same piece — deselect
          this.deselect();
        } else {
          // Select this piece
          this.selectedIndex = hitIndex;
          this.selectedPiece = this.pieces[hitIndex]!;
          this.onSelect(hitIndex, this.selectedPiece);
        }
      }
    } else if (isTap && !this.dragging && this.selectedIndex >= 0) {
      // Tap on grid with piece selected — try to place
      const gridPos = this.getGridPosForSelected(px, py);
      if (gridPos) {
        this.onTapPlace(this.selectedIndex, gridPos);
      } else {
        // Tap outside grid — deselect
        this.deselect();
      }
    } else if (this.dragging) {
      // Normal drag end — check for tray cancel zone
      this.updateGridSnap(px, py);
      this.dragging.inTrayZone = this.isInTrayZone(py);
      this.onDragEnd(this.dragging);
      this.dragging = null;
    }

    this.pointerDownPos = null;
    this.pointerDownPieceIndex = -1;
  };

  private handlePointerCancel = (_e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = null;
    this.onDragCancel();
    this.pointerDownPos = null;
    this.pointerDownPieceIndex = -1;
  };

  /** Get grid position for tap-to-place (centers piece at tapped cell, clamps to bounds) */
  private getGridPosForSelected(px: number, py: number): GridPos | null {
    if (!this.selectedPiece) return null;
    const piece = this.selectedPiece;

    // Convert tap to grid cell
    const gridPos = this.layoutManager.pixelToGrid(px, py);
    if (!gridPos) return null;

    // Try centering piece on tapped cell, clamped to grid bounds
    const idealRow = gridPos.row - Math.floor(piece.rows / 2);
    const idealCol = gridPos.col - Math.floor(piece.cols / 2);
    return this.findNearestPlacement(piece, idealRow, idealCol, 2);
  }

  findNearestPlacement(
    piece: PieceInstance,
    anchorRow: number,
    anchorCol: number,
    maxRadius: number = 2,
  ): GridPos | null {
    const maxRow = GRID_SIZE - piece.rows;
    const maxCol = GRID_SIZE - piece.cols;
    const clampedRow = Math.max(0, Math.min(maxRow, anchorRow));
    const clampedCol = Math.max(0, Math.min(maxCol, anchorCol));
    const seen = new Set<string>();

    for (let radius = 0; radius <= maxRadius; radius++) {
      const candidates: GridPos[] = [];

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const row = clampedRow + dr;
          const col = clampedCol + dc;
          if (row < 0 || row > maxRow || col < 0 || col > maxCol) continue;

          const key = `${row}:${col}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ row, col });
        }
      }

      candidates.sort((a, b) => {
        const da = (a.row - anchorRow) * (a.row - anchorRow) + (a.col - anchorCol) * (a.col - anchorCol);
        const db = (b.row - anchorRow) * (b.row - anchorRow) + (b.col - anchorCol) * (b.col - anchorCol);
        return da - db;
      });

      for (const candidate of candidates) {
        if (this.board.canPlace(piece.shape, candidate.row, candidate.col)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /** Snap the dragged piece to the nearest grid cell, with hysteresis to prevent flicker */
  private updateGridSnap(px: number, py: number): void {
    if (!this.dragging) return;
    const layout = this.layoutManager.layout;
    const piece = this.dragging.piece;

    // The visual center of the piece (with drag offset) maps to the grid
    const centerX = px;
    const centerY = py + layout.dragOffsetY;

    // Convert to continuous grid position (top-left corner of piece)
    const halfCols = piece.cols / 2;
    const halfRows = piece.rows / 2;
    const gridX = centerX - layout.gridOriginX;
    const gridY = centerY - layout.gridOriginY;
    const exactCol = gridX / layout.cellSize - halfCols;
    const exactRow = gridY / layout.cellSize - halfRows;

    let col: number;
    let row: number;

    if (this.hasSnappedPos) {
      // Hysteresis: only snap to new cell if we've moved past midpoint + threshold
      const threshold = HYSTERESIS_FRACTION;
      const newCol = Math.round(exactCol);
      const newRow = Math.round(exactRow);

      if (newCol !== this.lastSnappedCol) {
        const distFromMid = Math.abs(exactCol - newCol);
        col = distFromMid <= threshold ? this.lastSnappedCol : newCol;
      } else {
        col = this.lastSnappedCol;
      }

      if (newRow !== this.lastSnappedRow) {
        const distFromMid = Math.abs(exactRow - newRow);
        row = distFromMid <= threshold ? this.lastSnappedRow : newRow;
      } else {
        row = this.lastSnappedRow;
      }
    } else {
      // First snap: use simple rounding
      col = Math.round(exactCol);
      row = Math.round(exactRow);
      this.hasSnappedPos = true;
    }

    this.lastSnappedRow = row;
    this.lastSnappedCol = col;

    // Clamp to valid range for display
    const clampedRow = Math.max(-piece.rows + 1, Math.min(GRID_SIZE - 1, row));
    const clampedCol = Math.max(-piece.cols + 1, Math.min(GRID_SIZE - 1, col));

    this.dragging.gridPos = { row: clampedRow, col: clampedCol };
    this.dragging.isValid = this.board.canPlace(piece.shape, clampedRow, clampedCol);
  }
}
