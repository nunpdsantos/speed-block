import { Container, Graphics } from 'pixi.js';
import { PieceInstance } from '../core/types';
import { Layout } from './LayoutManager';
import { drawBeveledBlock, THEME } from './Theme';

const BLOCK_RADIUS = 5;
const BLOCK_INSET = 2;
const DRAG_TRAIL_SIZE = 4;

interface TrailPos {
  x: number;
  y: number;
}

export class PieceRenderer {
  container: Container;
  private trayPieces: Array<Container | null> = [null, null, null];
  private dragPiece: Graphics;
  private trailGraphics: Graphics;
  private selectionHighlight: Graphics;
  private layout!: Layout;
  private selectedIndex = -1;

  // Drag trail — circular buffer of last 4 positions
  private dragTrail: TrailPos[] = [];
  private currentDragPiece: PieceInstance | null = null;

  constructor() {
    this.container = new Container();
    this.selectionHighlight = new Graphics();
    this.selectionHighlight.visible = false;
    this.container.addChild(this.selectionHighlight);
    this.trailGraphics = new Graphics();
    this.container.addChild(this.trailGraphics);
    this.dragPiece = new Graphics();
    this.dragPiece.visible = false;
    this.container.addChild(this.dragPiece);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
  }

  /** Draw the 3 pieces in the tray */
  drawTray(pieces: (PieceInstance | null)[]): void {
    for (const p of this.trayPieces) {
      if (!p) continue;
      this.container.removeChild(p);
      p.destroy();
    }
    this.trayPieces = [null, null, null];

    const { trayOriginX, trayOriginY, trayWidth, trayHeight, trayCellSize } = this.layout;
    const slotWidth = trayWidth / 3;

    for (let i = 0; i < 3; i++) {
      const piece = pieces[i];
      if (!piece) continue;

      const slotContainer = new Container();
      const g = new Graphics();
      slotContainer.addChild(g);

      const piecePixelW = piece.cols * trayCellSize;
      const piecePixelH = piece.rows * trayCellSize;

      const slotCenterX = trayOriginX + slotWidth * i + slotWidth / 2;
      const slotCenterY = trayOriginY + trayHeight / 2;
      const startX = slotCenterX - piecePixelW / 2;
      const startY = slotCenterY - piecePixelH / 2;

      // Subtle shadow under tray piece
      for (let r = 0; r < piece.rows; r++) {
        for (let c = 0; c < piece.cols; c++) {
          if (piece.shape[r][c]) {
            const x = startX + c * trayCellSize + BLOCK_INSET;
            const y = startY + r * trayCellSize + BLOCK_INSET;
            const size = trayCellSize - BLOCK_INSET * 2;
            g.roundRect(x + 2, y + 2, size, size, BLOCK_RADIUS);
            g.fill({ color: 0x000000, alpha: 0.25 });
          }
        }
      }

      // Beveled blocks
      for (let r = 0; r < piece.rows; r++) {
        for (let c = 0; c < piece.cols; c++) {
          if (piece.shape[r][c]) {
            const x = startX + c * trayCellSize + BLOCK_INSET;
            const y = startY + r * trayCellSize + BLOCK_INSET;
            const size = trayCellSize - BLOCK_INSET * 2;
            drawBeveledBlock(g, x, y, size, piece.color, BLOCK_RADIUS);
          }
        }
      }

      this.container.addChild(slotContainer);
      this.trayPieces[i] = slotContainer;
    }
  }

  /** Show dragged piece at pointer position */
  showDragPiece(piece: PieceInstance, px: number, py: number): void {
    this.currentDragPiece = piece;
    const g = this.dragPiece;
    g.clear();
    const { cellSize } = this.layout;
    const halfW = (piece.cols * cellSize) / 2;
    const halfH = (piece.rows * cellSize) / 2;
    const inset = 3;

    // Beveled blocks
    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        if (piece.shape[r][c]) {
          const x = px - halfW + c * cellSize + inset;
          const y = py - halfH + r * cellSize + inset + this.layout.dragOffsetY;
          const size = cellSize - inset * 2;
          drawBeveledBlock(g, x, y, size, piece.color, BLOCK_RADIUS);
        }
      }
    }
    g.visible = true;

    // Draw trail ghosts
    this.drawTrail(piece, px, py);
  }

  /** Record a drag position for the trail */
  recordDragPosition(px: number, py: number): void {
    this.dragTrail.push({ x: px, y: py });
    if (this.dragTrail.length > DRAG_TRAIL_SIZE) {
      this.dragTrail.shift();
    }
  }

  /** Clear drag trail on drop */
  clearDragTrail(): void {
    this.dragTrail = [];
    this.currentDragPiece = null;
    this.trailGraphics.clear();
  }

  private drawTrail(piece: PieceInstance, currentX: number, currentY: number): void {
    const g = this.trailGraphics;
    g.clear();
    if (this.dragTrail.length === 0) return;

    const { cellSize } = this.layout;
    const halfW = (piece.cols * cellSize) / 2;
    const halfH = (piece.rows * cellSize) / 2;
    const inset = 3;

    for (let ti = 0; ti < this.dragTrail.length; ti++) {
      const pos = this.dragTrail[ti];
      // Skip if too close to current position
      const dx = pos.x - currentX;
      const dy = pos.y - currentY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) continue;

      const alpha = 0.08 * (ti + 1) / this.dragTrail.length;

      for (let r = 0; r < piece.rows; r++) {
        for (let c = 0; c < piece.cols; c++) {
          if (piece.shape[r][c]) {
            const x = pos.x - halfW + c * cellSize + inset;
            const y = pos.y - halfH + r * cellSize + inset + this.layout.dragOffsetY;
            const size = cellSize - inset * 2;
            g.roundRect(x, y, size, size, BLOCK_RADIUS);
            g.fill({ color: piece.color, alpha });
          }
        }
      }
    }
  }

  hideDragPiece(): void {
    this.dragPiece.clear();
    this.dragPiece.visible = false;
  }

  nudgeTraySlot(index: number, distance: number = 8, durationMs: number = 130): void {
    const slot = this.trayPieces[index];
    if (!slot) return;

    const startX = slot.x;
    const startTime = performance.now();

    const animate = () => {
      if (!slot.parent) return;
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        slot.x = startX;
        return;
      }

      const t = elapsed / durationMs;
      const wave = Math.sin(t * Math.PI * 4) * (1 - t);
      slot.x = startX + wave * distance;
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  getTraySlotBounds(index: number): { x: number; y: number; w: number; h: number } {
    const { trayOriginX, trayOriginY, trayWidth, trayHeight } = this.layout;
    const slotWidth = trayWidth / 3;
    return {
      x: trayOriginX + slotWidth * index,
      y: trayOriginY,
      w: slotWidth,
      h: trayHeight,
    };
  }

  /** Show selection glow around a tray piece */
  showSelection(index: number): void {
    this.selectedIndex = index;
    const g = this.selectionHighlight;
    g.clear();
    const bounds = this.getTraySlotBounds(index);
    const pad = 4;
    g.roundRect(bounds.x + pad, bounds.y + pad, bounds.w - pad * 2, bounds.h - pad * 2, 10);
    g.stroke({ color: THEME.accent, alpha: 0.7, width: 2 });
    g.roundRect(bounds.x + pad, bounds.y + pad, bounds.w - pad * 2, bounds.h - pad * 2, 10);
    g.fill({ color: THEME.accent, alpha: 0.08 });
    g.visible = true;
  }

  /** Hide selection highlight */
  hideSelection(): void {
    this.selectedIndex = -1;
    this.selectionHighlight.clear();
    this.selectionHighlight.visible = false;
  }
}
