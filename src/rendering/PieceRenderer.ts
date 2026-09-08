import { Container, Graphics } from 'pixi.js';
import { PieceInstance } from '../core/types';
import { Layout } from './LayoutManager';
import { drawBeveledBlock, THEME, easeOutBack, easeOutCubic } from './Theme';

const BLOCK_RADIUS = 5;
const BLOCK_INSET = 2;
const DRAG_TRAIL_SIZE = 4;

const TRAY_INTRO_DURATION = 0.26;
const TRAY_INTRO_STAGGER = 0.07;
const PICKUP_DURATION = 0.13;

interface TrailPos {
  x: number;
  y: number;
}

interface SlotAnim {
  /** seconds since the tray was (re)drawn */
  t: number;
  delay: number;
  baseX: number;
  baseY: number;
}

export class PieceRenderer {
  container: Container;
  private trayPieces: Array<Container | null> = [null, null, null];
  private slotAnims: Array<SlotAnim | null> = [null, null, null];
  private unplaceable: boolean[] = [false, false, false];
  private dragPiece: Graphics;
  private trailGraphics: Graphics;
  private selectionHighlight: Graphics;
  private layout!: Layout;

  // Drag trail — circular buffer of last 4 positions
  private dragTrail: TrailPos[] = [];
  private currentDragPiece: PieceInstance | null = null;
  private dragX = 0;
  private dragY = 0;
  /** 0 → 1 as the picked-up piece grows from tray size to board size */
  private pickupT = 1;

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

  /**
   * Draw the 3 pieces in the tray.
   * @param animate when true, pieces slide up and scale in with a stagger
   *                (used when a fresh batch arrives)
   */
  drawTray(pieces: (PieceInstance | null)[], animate: boolean = false): void {
    for (const p of this.trayPieces) {
      if (!p) continue;
      this.container.removeChild(p);
      p.destroy();
    }
    this.trayPieces = [null, null, null];
    this.slotAnims = [null, null, null];

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
      // Draw the piece around the container origin so scale animates about its center
      const startX = -piecePixelW / 2;
      const startY = -piecePixelH / 2;

      // Subtle shadow under tray piece
      for (let r = 0; r < piece.rows; r++) {
        for (let c = 0; c < piece.cols; c++) {
          if (piece.shape[r][c]) {
            const x = startX + c * trayCellSize + BLOCK_INSET;
            const y = startY + r * trayCellSize + BLOCK_INSET;
            const size = trayCellSize - BLOCK_INSET * 2;
            g.roundRect(x + 2, y + 3, size, size, BLOCK_RADIUS);
            g.fill({ color: 0x000000, alpha: 0.28 });
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

      slotContainer.x = slotCenterX;
      slotContainer.y = slotCenterY;
      this.container.addChild(slotContainer);
      this.trayPieces[i] = slotContainer;

      if (animate) {
        this.slotAnims[i] = { t: 0, delay: i * TRAY_INTRO_STAGGER, baseX: slotCenterX, baseY: slotCenterY };
        slotContainer.alpha = 0;
        slotContainer.scale.set(0.5);
        slotContainer.y = slotCenterY + 18;
      }
    }

    this.applyUnplaceable();
  }

  /** Dim tray pieces that have no legal placement on the board */
  setUnplaceable(mask: boolean[]): void {
    this.unplaceable = [...mask];
    this.applyUnplaceable();
  }

  private applyUnplaceable(): void {
    for (let i = 0; i < 3; i++) {
      const slot = this.trayPieces[i];
      if (!slot || this.slotAnims[i]) continue;
      slot.alpha = this.unplaceable[i] ? 0.32 : 1;
    }
  }

  /** Advance tray intro + pickup animations. Call every frame. */
  update(dt: number): void {
    for (let i = 0; i < 3; i++) {
      const anim = this.slotAnims[i];
      const slot = this.trayPieces[i];
      if (!anim || !slot) continue;
      anim.t += dt;
      const local = anim.t - anim.delay;
      if (local < 0) continue;
      const t = local / TRAY_INTRO_DURATION;
      if (t >= 1) {
        slot.alpha = this.unplaceable[i] ? 0.32 : 1;
        slot.scale.set(1);
        slot.x = anim.baseX;
        slot.y = anim.baseY;
        this.slotAnims[i] = null;
        continue;
      }
      const k = easeOutBack(t);
      slot.alpha = Math.min(1, t * 2.5) * (this.unplaceable[i] ? 0.32 : 1);
      slot.scale.set(0.5 + 0.5 * k);
      slot.y = anim.baseY + 18 * (1 - easeOutCubic(t));
    }

    if (this.currentDragPiece && this.pickupT < 1) {
      this.pickupT = Math.min(1, this.pickupT + dt / PICKUP_DURATION);
      this.renderDragPiece();
    }
  }

  /** Begin a drag: the piece grows from tray size to board size */
  beginDrag(piece: PieceInstance, px: number, py: number): void {
    this.currentDragPiece = piece;
    this.dragX = px;
    this.dragY = py;
    this.pickupT = 0;
    this.renderDragPiece();
  }

  /** Show dragged piece at pointer position */
  showDragPiece(piece: PieceInstance, px: number, py: number): void {
    if (this.currentDragPiece !== piece) {
      this.currentDragPiece = piece;
      this.pickupT = 1;
    }
    this.dragX = px;
    this.dragY = py;
    this.renderDragPiece();
  }

  private renderDragPiece(): void {
    const piece = this.currentDragPiece;
    if (!piece) return;
    const g = this.dragPiece;
    g.clear();
    const { cellSize, trayCellSize } = this.layout;
    const k = easeOutCubic(this.pickupT);
    const size = trayCellSize + (cellSize - trayCellSize) * k;
    const offsetY = this.layout.dragOffsetY * k;
    const px = this.dragX;
    const py = this.dragY;
    const halfW = (piece.cols * size) / 2;
    const halfH = (piece.rows * size) / 2;
    const inset = 3 * (size / cellSize);

    // Soft shadow under the lifted piece
    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        if (piece.shape[r][c]) {
          const x = px - halfW + c * size + inset;
          const y = py - halfH + r * size + inset + offsetY;
          const s = size - inset * 2;
          g.roundRect(x + 3, y + 8 * k, s, s, BLOCK_RADIUS);
          g.fill({ color: 0x000000, alpha: 0.28 * k });
        }
      }
    }

    // Beveled blocks
    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        if (piece.shape[r][c]) {
          const x = px - halfW + c * size + inset;
          const y = py - halfH + r * size + inset + offsetY;
          const s = size - inset * 2;
          drawBeveledBlock(g, x, y, s, piece.color, BLOCK_RADIUS);
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
    this.currentDragPiece = null;
    this.pickupT = 1;
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
    const g = this.selectionHighlight;
    g.clear();
    const bounds = this.getTraySlotBounds(index);
    const pad = 4;
    g.roundRect(bounds.x + pad, bounds.y + pad, bounds.w - pad * 2, bounds.h - pad * 2, 12);
    g.stroke({ color: THEME.accentGlow, alpha: 0.8, width: 2 });
    g.roundRect(bounds.x + pad, bounds.y + pad, bounds.w - pad * 2, bounds.h - pad * 2, 12);
    g.fill({ color: THEME.accent, alpha: 0.1 });
    g.visible = true;
  }

  /** Hide selection highlight */
  hideSelection(): void {
    this.selectionHighlight.clear();
    this.selectionHighlight.visible = false;
  }
}
