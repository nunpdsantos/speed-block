import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, Grid, GridPos, CellColor } from '../core/types';
import { Board } from '../core/Board';
import { Layout } from './LayoutManager';
import { THEME, drawBeveledBlock, lerpColor, lighten, easeOutBack } from './Theme';

const BLOCK_INSET = 3;
const CELL_RADIUS = 5;
const CELL_GAP = 1.5;

/** A block that has just been placed: pops in slightly oversized then settles */
interface PopCell {
  row: number;
  col: number;
  color: number;
  life: number;
}
const POP_DURATION = 0.2;

/** A block being cleared: flashes white, swells, then shrinks away */
interface DyingCell {
  row: number;
  col: number;
  color: number;
  delay: number;
  life: number;
}
const DIE_DURATION = 0.32;

export class GridRenderer {
  container: Container;
  private bgGraphics: Graphics;
  private blockGraphics: Graphics;
  private popGraphics: Graphics;
  private clearGraphics: Graphics;
  private glowGraphics: Graphics;
  private nearMissGraphics: Graphics;
  private layout!: Layout;

  private pops: PopCell[] = [];
  private dying: DyingCell[] = [];

  // Glow state
  private glowPhase = 0;

  // Near-miss state
  private nearMissPhase = 0;

  constructor() {
    this.container = new Container();
    this.bgGraphics = new Graphics();
    this.blockGraphics = new Graphics();
    this.glowGraphics = new Graphics();
    this.nearMissGraphics = new Graphics();
    this.popGraphics = new Graphics();
    this.clearGraphics = new Graphics();

    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.glowGraphics);
    this.container.addChild(this.blockGraphics);
    this.container.addChild(this.nearMissGraphics);
    this.container.addChild(this.popGraphics);
    this.container.addChild(this.clearGraphics);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    this.drawBackground();
  }

  private drawBackground(): void {
    const g = this.bgGraphics;
    g.clear();
    const { gridOriginX, gridOriginY, cellSize, gridSize } = this.layout;
    const pad = 8;

    // Board outer shadow
    g.roundRect(gridOriginX - pad + 2, gridOriginY - pad + 5, gridSize + pad * 2, gridSize + pad * 2, 14);
    g.fill({ color: 0x000000, alpha: 0.32 });

    // Board background
    g.roundRect(gridOriginX - pad, gridOriginY - pad, gridSize + pad * 2, gridSize + pad * 2, 14);
    g.fill({ color: THEME.gridBg });

    // Board border
    g.roundRect(gridOriginX - pad, gridOriginY - pad, gridSize + pad * 2, gridSize + pad * 2, 14);
    g.stroke({ width: 1.5, color: THEME.cellWellBorder, alpha: 0.6 });

    // Individual cell wells
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = gridOriginX + c * cellSize + CELL_GAP;
        const y = gridOriginY + r * cellSize + CELL_GAP;
        const s = cellSize - CELL_GAP * 2;
        g.roundRect(x, y, s, s, CELL_RADIUS);
        g.fill({ color: THEME.cellWell });
        // Subtle inner top shadow so wells look recessed
        g.roundRect(x, y, s, Math.max(2, s * 0.12), CELL_RADIUS);
        g.fill({ color: 0x000000, alpha: 0.18 });
      }
    }
  }

  /** Redraw all placed blocks from grid state */
  drawBlocks(grid: Grid): void {
    const g = this.blockGraphics;
    g.clear();
    const { gridOriginX, gridOriginY, cellSize } = this.layout;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = grid[r][c];
        if (color !== null) {
          const x = gridOriginX + c * cellSize + BLOCK_INSET;
          const y = gridOriginY + r * cellSize + BLOCK_INSET;
          const size = cellSize - BLOCK_INSET * 2;
          drawBeveledBlock(g, x, y, size, color, CELL_RADIUS);
        }
      }
    }
  }

  /** Placed blocks pop in: drawn oversized with a white flash, settling in 200ms */
  popCells(cells: GridPos[], color: CellColor): void {
    for (const cell of cells) {
      this.pops.push({ row: cell.row, col: cell.col, color, life: 0 });
    }
  }

  /**
   * Animate cleared cells: they flash, swell and shrink away in a sweep that
   * radiates from the cell the player just placed (or the board center).
   */
  animateClear(cells: GridPos[], colors: CellColor[], origin?: GridPos): void {
    const oc = origin ? origin.col : 3.5;
    const or = origin ? origin.row : 3.5;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const dist = Math.abs(cell.col - oc) + Math.abs(cell.row - or);
      this.dying.push({
        row: cell.row,
        col: cell.col,
        color: colors[i] ?? 0xffffff,
        delay: dist * 0.022,
        life: 0,
      });
    }
  }

  /** Advance pop + clear animations — call every frame */
  update(dt: number): void {
    if (!this.layout) return;
    const { gridOriginX, gridOriginY, cellSize } = this.layout;

    // Placement pops
    const pg = this.popGraphics;
    pg.clear();
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life += dt;
      const t = p.life / POP_DURATION;
      if (t >= 1) { this.pops.splice(i, 1); continue; }
      const scale = 1 + 0.18 * (1 - easeOutBack(t));
      const size = (cellSize - BLOCK_INSET * 2) * scale;
      const cx = gridOriginX + p.col * cellSize + cellSize / 2;
      const cy = gridOriginY + p.row * cellSize + cellSize / 2;
      drawBeveledBlock(pg, cx - size / 2, cy - size / 2, size, p.color, CELL_RADIUS);
      // White flash fading out over the first half
      const flash = Math.max(0, 1 - t * 2) * 0.55;
      if (flash > 0.01) {
        pg.roundRect(cx - size / 2, cy - size / 2, size, size, CELL_RADIUS);
        pg.fill({ color: 0xffffff, alpha: flash });
      }
    }

    // Clearing cells
    const cg = this.clearGraphics;
    cg.clear();
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.life += dt;
      const local = d.life - d.delay;
      const cx = gridOriginX + d.col * cellSize + cellSize / 2;
      const cy = gridOriginY + d.row * cellSize + cellSize / 2;
      const baseSize = cellSize - BLOCK_INSET * 2;

      if (local < 0) {
        // Waiting for the sweep to arrive: still drawn as a normal block
        drawBeveledBlock(cg, cx - baseSize / 2, cy - baseSize / 2, baseSize, d.color, CELL_RADIUS);
        continue;
      }
      const t = local / DIE_DURATION;
      if (t >= 1) { this.dying.splice(i, 1); continue; }

      // Phase 1 (0–0.3): swell + flash white. Phase 2 (0.3–1): shrink + fade.
      let scale: number;
      let alpha: number;
      let flash: number;
      if (t < 0.3) {
        const k = t / 0.3;
        scale = 1 + 0.22 * k;
        alpha = 1;
        flash = k;
      } else {
        const k = (t - 0.3) / 0.7;
        scale = 1.22 * (1 - k * k);
        alpha = 1 - k;
        flash = 1 - k;
      }
      const size = baseSize * scale;
      if (size <= 0.5) continue;
      drawBeveledBlock(cg, cx - size / 2, cy - size / 2, size, d.color, CELL_RADIUS, alpha);
      cg.roundRect(cx - size / 2, cy - size / 2, size, size, CELL_RADIUS);
      cg.fill({ color: lighten(d.color, 0.7), alpha: flash * 0.85 * alpha });
    }
  }

  /** True while any clear animation is still playing */
  get isClearing(): boolean {
    return this.dying.length > 0;
  }

  /**
   * Grid border heartbeat glow. Color and rate come from the clock; a
   * crowded board tints the glow toward orange so danger is visible even
   * when the timer is healthy.
   */
  updateGlow(dt: number, timeRemaining: number, boardFill: number = 0): void {
    const g = this.glowGraphics;
    g.clear();
    if (!this.layout) return;

    const { gridOriginX, gridOriginY, gridSize } = this.layout;
    const pad = 8;

    let rate: number;
    let color: number;

    if (timeRemaining <= 5) {
      rate = 3; // 3Hz critical
      color = 0xff4444;
    } else if (timeRemaining <= 10) {
      rate = 2; // 2Hz
      color = 0xff6644;
    } else if (timeRemaining <= 20) {
      rate = 1.5; // 1.5Hz warning
      color = 0xf59e0b;
    } else {
      rate = 0.8; // 0.8Hz healthy
      color = THEME.accent;
    }

    // Board crowding: from 65% full the glow drifts toward orange/red
    if (boardFill >= 0.65) {
      const crowd = Math.min(1, (boardFill - 0.65) / 0.25);
      color = lerpColor(color, 0xff5a3c, crowd * 0.85);
      rate = Math.max(rate, 0.8 + crowd * 1.4);
    }

    this.glowPhase += dt * rate * Math.PI * 2;
    const pulse = 0.3 + Math.sin(this.glowPhase) * 0.3;
    const alpha = Math.max(0.05, pulse);

    // Draw glow border
    g.roundRect(
      gridOriginX - pad - 2, gridOriginY - pad - 2,
      gridSize + pad * 2 + 4, gridSize + pad * 2 + 4,
      16,
    );
    g.stroke({ width: 3, color, alpha });

    // Outer glow
    g.roundRect(
      gridOriginX - pad - 4, gridOriginY - pad - 4,
      gridSize + pad * 2 + 8, gridSize + pad * 2 + 8,
      18,
    );
    g.stroke({ width: 2, color, alpha: alpha * 0.4 });
  }

  /** Near-miss highlight: empty cells in rows/cols that are one block from clearing */
  updateNearMiss(board: Board, dt: number): void {
    const g = this.nearMissGraphics;
    g.clear();
    if (!this.layout) return;

    const { gridOriginX, gridOriginY, cellSize } = this.layout;
    this.nearMissPhase += dt * 6;
    const alpha7 = 0.26 + Math.sin(this.nearMissPhase) * 0.12;
    const alpha6 = 0.10 + Math.sin(this.nearMissPhase * 0.75) * 0.04;

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
      const fill = board.getRowFillCount(r);
      const alpha = fill === GRID_SIZE - 1 ? alpha7 : fill === GRID_SIZE - 2 ? alpha6 : 0;
      if (alpha > 0) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (board.getCell(r, c) === null) {
            const x = gridOriginX + c * cellSize;
            const y = gridOriginY + r * cellSize;
            g.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 3);
            g.fill({ color: THEME.gold, alpha });
          }
        }
      }
    }

    // Check cols
    for (let c = 0; c < GRID_SIZE; c++) {
      const fill = board.getColFillCount(c);
      const alpha = fill === GRID_SIZE - 1 ? alpha7 : fill === GRID_SIZE - 2 ? alpha6 : 0;
      if (alpha > 0) {
        for (let r = 0; r < GRID_SIZE; r++) {
          if (board.getCell(r, c) === null) {
            const x = gridOriginX + c * cellSize;
            const y = gridOriginY + r * cellSize;
            g.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 3);
            g.fill({ color: THEME.gold, alpha });
          }
        }
      }
    }
  }

  /** Get pixel coordinates for cleared cells */
  getClearCellPixels(cells: GridPos[]): { x: number; y: number; size: number }[] {
    const { gridOriginX, gridOriginY, cellSize } = this.layout;
    return cells.map(({ row, col }) => ({
      x: gridOriginX + col * cellSize + BLOCK_INSET,
      y: gridOriginY + row * cellSize + BLOCK_INSET,
      size: cellSize - BLOCK_INSET * 2,
    }));
  }
}
