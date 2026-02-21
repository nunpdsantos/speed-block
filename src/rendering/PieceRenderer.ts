import { Container, Graphics } from 'pixi.js';
import { PieceInstance } from '../core/types';
import { Layout } from './LayoutManager';
import { drawBeveledBlock, THEME } from './Theme';

const BLOCK_RADIUS = 5;
const BLOCK_INSET = 2;

export class PieceRenderer {
  container: Container;
  private trayPieces: Container[] = [];
  private dragPiece: Graphics;
  private selectionHighlight: Graphics;
  private layout!: Layout;
  private selectedIndex = -1;

  constructor() {
    this.container = new Container();
    this.selectionHighlight = new Graphics();
    this.selectionHighlight.visible = false;
    this.container.addChild(this.selectionHighlight);
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
      this.container.removeChild(p);
      p.destroy();
    }
    this.trayPieces = [];

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
      this.trayPieces.push(slotContainer);
    }
  }

  /** Show dragged piece at pointer position */
  showDragPiece(piece: PieceInstance, px: number, py: number): void {
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
  }

  hideDragPiece(): void {
    this.dragPiece.clear();
    this.dragPiece.visible = false;
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
