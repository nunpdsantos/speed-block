import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, Grid, GridPos } from '../core/types';
import { Board } from '../core/Board';
import { Layout } from './LayoutManager';
import { THEME, drawBeveledBlock, lerpColor } from './Theme';

const BLOCK_INSET = 3;
const CELL_RADIUS = 5;
const CELL_GAP = 1.5;

export class GridRenderer {
  container: Container;
  private bgGraphics: Graphics;
  private blockGraphics: Graphics;
  private flashGraphics: Graphics;
  private glowGraphics: Graphics;
  private nearMissGraphics: Graphics;
  private layout!: Layout;

  // Placement flash: cell key → remaining flash time
  private flashCellMap: Map<string, number> = new Map();

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
    this.flashGraphics = new Graphics();

    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.glowGraphics);
    this.container.addChild(this.blockGraphics);
    this.container.addChild(this.nearMissGraphics);
    this.container.addChild(this.flashGraphics);
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
    g.roundRect(gridOriginX - pad + 3, gridOriginY - pad + 3, gridSize + pad * 2, gridSize + pad * 2, 12);
    g.fill({ color: 0x000000, alpha: 0.25 });

    // Board background
    g.roundRect(gridOriginX - pad, gridOriginY - pad, gridSize + pad * 2, gridSize + pad * 2, 12);
    g.fill({ color: THEME.gridBg });

    // Board border
    g.roundRect(gridOriginX - pad, gridOriginY - pad, gridSize + pad * 2, gridSize + pad * 2, 12);
    g.stroke({ width: 1.5, color: THEME.cellWellBorder, alpha: 0.5 });

    // Individual cell wells
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = gridOriginX + c * cellSize + CELL_GAP;
        const y = gridOriginY + r * cellSize + CELL_GAP;
        const s = cellSize - CELL_GAP * 2;
        g.roundRect(x, y, s, s, CELL_RADIUS);
        g.fill({ color: THEME.cellWell });
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

  /** Mark cells to flash white on placement */
  flashCells(cells: GridPos[]): void {
    for (const cell of cells) {
      this.flashCellMap.set(`${cell.row},${cell.col}`, 0.05); // 50ms flash
    }
  }

  /** Update placement flash overlay — call every frame */
  updateFlash(dt: number): void {
    const g = this.flashGraphics;
    g.clear();
    if (this.flashCellMap.size === 0) return;
    if (!this.layout) return;

    const { gridOriginX, gridOriginY, cellSize } = this.layout;
    const toRemove: string[] = [];

    this.flashCellMap.forEach((time, key) => {
      // Decrement timer
      const remaining = time - dt;
      this.flashCellMap.set(key, remaining);

      if (remaining <= 0) {
        toRemove.push(key);
        return;
      }
      const [r, c] = key.split(',').map(Number);
      const x = gridOriginX + c * cellSize + BLOCK_INSET;
      const y = gridOriginY + r * cellSize + BLOCK_INSET;
      const size = cellSize - BLOCK_INSET * 2;
      const alpha = Math.min(1, remaining / 0.03); // fade out
      g.roundRect(x, y, size, size, CELL_RADIUS);
      g.fill({ color: 0xffffff, alpha: alpha * 0.6 });
    });

    for (const key of toRemove) {
      this.flashCellMap.delete(key);
    }
  }

  /** Update grid border heartbeat glow */
  updateGlow(dt: number, timeRemaining: number): void {
    const g = this.glowGraphics;
    g.clear();
    if (!this.layout) return;

    const { gridOriginX, gridOriginY, gridSize } = this.layout;
    const pad = 8;

    // Determine glow rate and color based on time
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

    this.glowPhase += dt * rate * Math.PI * 2;
    const pulse = 0.3 + Math.sin(this.glowPhase) * 0.3;
    const alpha = Math.max(0.05, pulse);

    // Draw glow border
    g.roundRect(
      gridOriginX - pad - 2, gridOriginY - pad - 2,
      gridSize + pad * 2 + 4, gridSize + pad * 2 + 4,
      14,
    );
    g.stroke({ width: 3, color, alpha });

    // Outer glow
    g.roundRect(
      gridOriginX - pad - 4, gridOriginY - pad - 4,
      gridSize + pad * 2 + 8, gridSize + pad * 2 + 8,
      16,
    );
    g.stroke({ width: 2, color, alpha: alpha * 0.4 });
  }

  /** Update near-miss highlight for rows/cols at 7/8 filled */
  updateNearMiss(board: Board): void {
    const g = this.nearMissGraphics;
    g.clear();
    if (!this.layout) return;

    const { gridOriginX, gridOriginY, cellSize, gridSize } = this.layout;
    this.nearMissPhase += 0.1;
    const pulse = 0.15 + Math.sin(this.nearMissPhase * 4) * 0.1;

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
      const count = board.getRowFillCount(r);
      if (count === GRID_SIZE - 1) {
        // This row is 7/8 filled
        const y = gridOriginY + r * cellSize;
        g.rect(gridOriginX, y, gridSize, cellSize);
        g.fill({ color: 0xf59e0b, alpha: pulse });
      }
    }

    // Check cols
    for (let c = 0; c < GRID_SIZE; c++) {
      const count = board.getColFillCount(c);
      if (count === GRID_SIZE - 1) {
        const x = gridOriginX + c * cellSize;
        g.rect(x, gridOriginY, cellSize, gridSize);
        g.fill({ color: 0xf59e0b, alpha: pulse });
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
