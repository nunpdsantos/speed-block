import { PieceInstance, GridPos, ShapeMatrix } from './types';

/** Get the cell positions a piece would occupy at a given grid position */
export function getCellPositions(shape: ShapeMatrix, row: number, col: number): GridPos[] {
  const positions: GridPos[] = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) {
      if (shape[r][c]) {
        positions.push({ row: row + r, col: col + c });
      }
    }
  }
  return positions;
}

/** Count the filled cells in a shape */
export function cellCount(shape: ShapeMatrix): number {
  let count = 0;
  for (const row of shape) {
    for (const cell of row) {
      if (cell) count++;
    }
  }
  return count;
}

/** Create a PieceInstance from a shape and color */
export function createPieceInstance(typeId: string, shape: ShapeMatrix, color: number): PieceInstance {
  return {
    typeId,
    shape,
    color,
    rows: shape.length,
    cols: shape[0].length,
  };
}
