import { GRID_SIZE, GridPos } from '../core/types';

export interface Layout {
  // Canvas dimensions
  width: number;
  height: number;

  // Grid
  gridOriginX: number;
  gridOriginY: number;
  cellSize: number;
  gridSize: number; // total pixel size of grid

  // Tray (piece selection area below grid)
  trayOriginX: number;
  trayOriginY: number;
  trayWidth: number;
  trayHeight: number;
  trayCellSize: number;

  // HUD
  scoreY: number;
  streakY: number;

  // Drag offset (lift piece above finger)
  dragOffsetY: number;
}

export class LayoutManager {
  layout!: Layout;

  constructor() {
    this.recalculate(window.innerWidth, window.innerHeight);
  }

  recalculate(screenW: number, screenH: number): Layout {
    const padding = 16;
    const hudHeight = 80;
    const gridHeightRatio = 0.58;

    const availableWidth = screenW - padding * 2;
    const availableGridHeight = screenH * gridHeightRatio;
    const maxCellSize = Math.floor(Math.min(availableWidth, availableGridHeight) / GRID_SIZE);
    const cellSize = Math.max(maxCellSize, 20); // minimum 20px cells
    const gridSize = cellSize * GRID_SIZE;

    const gridOriginX = Math.floor((screenW - gridSize) / 2);
    const gridOriginY = hudHeight + padding;

    const trayGap = padding * 2; // bigger gap between grid and tray
    const trayOriginY = gridOriginY + gridSize + trayGap;
    const trayHeight = screenH - trayOriginY - padding;
    const trayOriginX = gridOriginX;
    const trayWidth = gridSize;

    // Cap tray cell size so the tallest piece (5 rows) fits within the tray
    const maxPieceDim = 5;
    const trayMargin = 12; // vertical margin inside tray
    const maxTrayCellFromHeight = Math.floor((trayHeight - trayMargin * 2) / maxPieceDim);
    const trayCellSize = Math.min(Math.floor(cellSize * 0.5), maxTrayCellFromHeight);

    this.layout = {
      width: screenW,
      height: screenH,
      gridOriginX,
      gridOriginY,
      cellSize,
      gridSize,
      trayOriginX,
      trayOriginY,
      trayWidth,
      trayHeight,
      trayCellSize,
      scoreY: 20,
      streakY: 52,
      dragOffsetY: cellSize * -1.5,
    };

    return this.layout;
  }

  /** Convert pixel coordinate to grid position (O(1)) */
  pixelToGrid(px: number, py: number): GridPos | null {
    const { gridOriginX, gridOriginY, cellSize, gridSize } = this.layout;
    const lx = px - gridOriginX;
    const ly = py - gridOriginY;
    if (lx < 0 || ly < 0 || lx >= gridSize || ly >= gridSize) return null;
    return {
      row: Math.floor(ly / cellSize),
      col: Math.floor(lx / cellSize),
    };
  }

  /** Convert grid position to pixel coordinate (top-left of cell) */
  gridToPixel(row: number, col: number): { x: number; y: number } {
    return {
      x: this.layout.gridOriginX + col * this.layout.cellSize,
      y: this.layout.gridOriginY + row * this.layout.cellSize,
    };
  }
}
