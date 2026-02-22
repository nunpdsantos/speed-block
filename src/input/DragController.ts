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
}

export type DragStartCallback = (state: DragState) => void;
export type DragMoveCallback = (state: DragState) => void;
export type DragEndCallback = (state: DragState) => void;
export type DragCancelCallback = () => void;
export type SelectCallback = (pieceIndex: number, piece: PieceInstance) => void;
export type DeselectCallback = () => void;
export type TapPlaceCallback = (pieceIndex: number, gridPos: GridPos) => void;

const TAP_THRESHOLD = 12; // pixels — below this distance is a tap, not a drag

export class DragController {
  private layoutManager: LayoutManager;
  private board: Board;
  private pieces: (PieceInstance | null)[] = [];
  private dragging: DragState | null = null;
  private active = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownPieceIndex = -1;

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
      };
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
      // Normal drag end
      this.updateGridSnap(px, py);
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
    const row = Math.max(0, Math.min(GRID_SIZE - piece.rows, idealRow));
    const col = Math.max(0, Math.min(GRID_SIZE - piece.cols, idealCol));

    if (this.board.canPlace(piece.shape, row, col)) {
      return { row, col };
    }
    // If clamped position fails, try the ideal unclamped position too
    if ((row !== idealRow || col !== idealCol) && this.board.canPlace(piece.shape, idealRow, idealCol)) {
      return { row: idealRow, col: idealCol };
    }
    return null;
  }

  /** Snap the dragged piece to the nearest grid cell, accounting for drag offset */
  private updateGridSnap(px: number, py: number): void {
    if (!this.dragging) return;
    const layout = this.layoutManager.layout;
    const piece = this.dragging.piece;

    // The visual center of the piece (with drag offset) maps to the grid
    const centerX = px;
    const centerY = py + layout.dragOffsetY;

    // Convert to grid position (top-left corner of piece)
    const halfCols = piece.cols / 2;
    const halfRows = piece.rows / 2;
    const gridX = centerX - layout.gridOriginX;
    const gridY = centerY - layout.gridOriginY;
    const col = Math.round(gridX / layout.cellSize - halfCols);
    const row = Math.round(gridY / layout.cellSize - halfRows);

    // Clamp to valid range for display
    const clampedRow = Math.max(-piece.rows + 1, Math.min(GRID_SIZE - 1, row));
    const clampedCol = Math.max(-piece.cols + 1, Math.min(GRID_SIZE - 1, col));

    this.dragging.gridPos = { row: clampedRow, col: clampedCol };
    this.dragging.isValid = this.board.canPlace(piece.shape, clampedRow, clampedCol);
  }
}
