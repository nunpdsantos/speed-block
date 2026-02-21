import { Container, Graphics } from 'pixi.js';
import { ShapeMatrix, GRID_SIZE } from '../core/types';
import { Layout } from './LayoutManager';
import { THEME, lighten } from './Theme';

const BLOCK_RADIUS = 4;
const INSET = 2;

export class GhostRenderer {
  container: Container;
  private graphics: Graphics;
  private layout!: Layout;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
  }

  /** Show ghost preview — outline style for valid, filled for invalid */
  show(shape: ShapeMatrix, row: number, col: number, color: number, valid: boolean): void {
    const g = this.graphics;
    g.clear();
    const { gridOriginX, gridOriginY, cellSize } = this.layout;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        if (!shape[r][c]) continue;
        const gr = row + r;
        const gc = col + c;
        if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) continue;

        const x = gridOriginX + gc * cellSize + INSET;
        const y = gridOriginY + gr * cellSize + INSET;
        const size = cellSize - INSET * 2;

        if (valid) {
          // Valid: soft glow fill + bright border
          g.roundRect(x, y, size, size, BLOCK_RADIUS);
          g.fill({ color: lighten(color, 0.3), alpha: 0.2 });
          g.roundRect(x, y, size, size, BLOCK_RADIUS);
          g.stroke({ width: 1.5, color: lighten(color, 0.4), alpha: 0.6 });
        } else {
          // Invalid: dim red fill
          g.roundRect(x, y, size, size, BLOCK_RADIUS);
          g.fill({ color: THEME.danger, alpha: 0.12 });
          g.roundRect(x, y, size, size, BLOCK_RADIUS);
          g.stroke({ width: 1, color: THEME.danger, alpha: 0.3 });
        }
      }
    }
  }

  hide(): void {
    this.graphics.clear();
  }
}
