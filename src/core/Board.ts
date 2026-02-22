import { GRID_SIZE, Grid, CellColor, GridPos, ClearResult, ShapeMatrix } from './types';

export class Board {
  grid: Grid;

  constructor() {
    this.grid = Board.createEmptyGrid();
  }

  static createEmptyGrid(): Grid {
    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null)
    );
  }

  reset(): void {
    this.grid = Board.createEmptyGrid();
  }

  getCell(row: number, col: number): CellColor | null {
    return this.grid[row][col];
  }

  /** Check if a shape can be placed at (row, col) */
  canPlace(shape: ShapeMatrix, row: number, col: number): boolean {
    const shapeRows = shape.length;
    const shapeCols = shape[0].length;
    if (row < 0 || col < 0 || row + shapeRows > GRID_SIZE || col + shapeCols > GRID_SIZE) {
      return false;
    }
    for (let r = 0; r < shapeRows; r++) {
      for (let c = 0; c < shapeCols; c++) {
        if (shape[r][c] && this.grid[row + r][col + c] !== null) {
          return false;
        }
      }
    }
    return true;
  }

  /** Check if a shape can be placed ANYWHERE on the board */
  canPlaceAnywhere(shape: ShapeMatrix): boolean {
    for (let row = 0; row <= GRID_SIZE - shape.length; row++) {
      for (let col = 0; col <= GRID_SIZE - shape[0].length; col++) {
        if (this.canPlace(shape, row, col)) return true;
      }
    }
    return false;
  }

  /** Place a shape at (row, col). Returns the cells that were filled. */
  place(shape: ShapeMatrix, row: number, col: number, color: CellColor): GridPos[] {
    const cells: GridPos[] = [];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        if (shape[r][c]) {
          this.grid[row + r][col + c] = color;
          cells.push({ row: row + r, col: col + c });
        }
      }
    }
    return cells;
  }

  /** Find completed rows and columns */
  findCompleted(): { rows: number[]; cols: number[] } {
    const rows: number[] = [];
    const cols: number[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      let full = true;
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === null) { full = false; break; }
      }
      if (full) rows.push(r);
    }

    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (this.grid[r][c] === null) { full = false; break; }
      }
      if (full) cols.push(c);
    }

    return { rows, cols };
  }

  /** Clear completed lines. NO gravity. Returns clear result. */
  clearLines(completed: { rows: number[]; cols: number[] }): ClearResult {
    const clearedSet = new Set<string>();
    const cellsCleared: GridPos[] = [];

    for (const r of completed.rows) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const key = `${r},${c}`;
        if (!clearedSet.has(key)) {
          clearedSet.add(key);
          cellsCleared.push({ row: r, col: c });
        }
        this.grid[r][c] = null;
      }
    }

    for (const c of completed.cols) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const key = `${r},${c}`;
        if (!clearedSet.has(key)) {
          clearedSet.add(key);
          cellsCleared.push({ row: r, col: c });
        }
        this.grid[r][c] = null;
      }
    }

    return {
      rows: completed.rows,
      cols: completed.cols,
      cellsCleared,
      totalCellsRemoved: cellsCleared.length,
      totalLinesCleared: completed.rows.length + completed.cols.length,
    };
  }

  /** Check if the board is completely empty */
  isEmpty(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] !== null) return false;
      }
    }
    return true;
  }

  /** Count how many valid positions exist for a shape */
  countPlacements(shape: ShapeMatrix): number {
    let count = 0;
    for (let row = 0; row <= GRID_SIZE - shape.length; row++) {
      for (let col = 0; col <= GRID_SIZE - shape[0].length; col++) {
        if (this.canPlace(shape, row, col)) count++;
      }
    }
    return count;
  }

  /** Count filled cells in a row */
  getRowFillCount(row: number): number {
    let count = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (this.grid[row][c] !== null) count++;
    }
    return count;
  }

  /** Count filled cells in a column */
  getColFillCount(col: number): number {
    let count = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (this.grid[r][col] !== null) count++;
    }
    return count;
  }

  /** Count occupied cells */
  occupiedCount(): number {
    let count = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] !== null) count++;
      }
    }
    return count;
  }
}
