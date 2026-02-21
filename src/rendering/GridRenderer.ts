import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, Grid, GridPos } from '../core/types';
import { Layout } from './LayoutManager';
import { THEME, drawBeveledBlock } from './Theme';

const BLOCK_INSET = 3; // gap between blocks — shows grid underneath
const CELL_RADIUS = 5;
const CELL_GAP = 1.5;

export class GridRenderer {
  container: Container;
  private bgGraphics: Graphics;
  private blockGraphics: Graphics;
  private layout!: Layout;

  constructor() {
    this.container = new Container();
    this.bgGraphics = new Graphics();
    this.blockGraphics = new Graphics();
    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.blockGraphics);
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

    // Board background — dark navy, strong contrast against blue page
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

  /** Get pixel coordinates for cleared cells (for particle spawning) */
  getClearCellPixels(cells: GridPos[]): { x: number; y: number; size: number }[] {
    const { gridOriginX, gridOriginY, cellSize } = this.layout;
    return cells.map(({ row, col }) => ({
      x: gridOriginX + col * cellSize + BLOCK_INSET,
      y: gridOriginY + row * cellSize + BLOCK_INSET,
      size: cellSize - BLOCK_INSET * 2,
    }));
  }
}
