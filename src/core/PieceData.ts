import { PieceType, ShapeMatrix } from './types';

function m(rows: number[][]): ShapeMatrix {
  return rows.map(r => r.map(v => v === 1));
}

// Rotate a matrix 90° clockwise
function rotate90(shape: ShapeMatrix): ShapeMatrix {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: ShapeMatrix = [];
  for (let c = 0; c < cols; c++) {
    const newRow: boolean[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(shape[r][c]);
    }
    rotated.push(newRow);
  }
  return rotated;
}

// Mirror a matrix horizontally
function mirrorH(shape: ShapeMatrix): ShapeMatrix {
  return shape.map(row => [...row].reverse());
}

// Generate all 4 rotations
function rotations4(shape: ShapeMatrix): ShapeMatrix[] {
  const r0 = shape;
  const r1 = rotate90(r0);
  const r2 = rotate90(r1);
  const r3 = rotate90(r2);
  return [r0, r1, r2, r3];
}

// Generate unique variants from rotations (deduplicate symmetric shapes)
function uniqueVariants(variants: ShapeMatrix[]): ShapeMatrix[] {
  const seen = new Set<string>();
  const unique: ShapeMatrix[] = [];
  for (const v of variants) {
    const key = JSON.stringify(v);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  return unique;
}

// ── 16 piece types with all rotation/mirror variants ──

// 1. Single block (1x1)
const single: PieceType = {
  id: 'single',
  variants: [m([[1]])],
};

// 2. Domino (1x2)
const domino: PieceType = {
  id: 'domino',
  variants: uniqueVariants([
    m([[1, 1]]),
    m([[1], [1]]),
  ]),
};

// 3. Tromino line (1x3)
const trominoLine: PieceType = {
  id: 'tromino_line',
  variants: uniqueVariants([
    m([[1, 1, 1]]),
    m([[1], [1], [1]]),
  ]),
};

// 4. Small corner (2x2, 3 cells)
const smallCorner: PieceType = {
  id: 'small_corner',
  variants: uniqueVariants(rotations4(m([
    [1, 0],
    [1, 1],
  ]))),
};

// 5. Tetromino line (1x4)
const tetrominoLine: PieceType = {
  id: 'tetromino_line',
  variants: uniqueVariants([
    m([[1, 1, 1, 1]]),
    m([[1], [1], [1], [1]]),
  ]),
};

// 6. Small L-shape (2x3, 4 cells) — rotations + mirror = 8 variants
const smallL: PieceType = {
  id: 'small_l',
  variants: uniqueVariants([
    ...rotations4(m([
      [1, 1, 1],
      [1, 0, 0],
    ])),
    ...rotations4(mirrorH(m([
      [1, 1, 1],
      [1, 0, 0],
    ]))),
  ]),
};

// 7. T-shape (2x3, 4 cells)
const tShape: PieceType = {
  id: 't_shape',
  variants: uniqueVariants(rotations4(m([
    [0, 1, 0],
    [1, 1, 1],
  ]))),
};

// 8. Z/S Zigzag (2x3, 4 cells) — Z + S (mirror) = 4 variants
const zigzag: PieceType = {
  id: 'zigzag',
  variants: uniqueVariants([
    ...rotations4(m([
      [0, 1, 1],
      [1, 1, 0],
    ])),
    ...rotations4(mirrorH(m([
      [0, 1, 1],
      [1, 1, 0],
    ]))),
  ]),
};

// 9. 2x2 Square (4 cells)
const square2: PieceType = {
  id: 'square_2x2',
  variants: [m([
    [1, 1],
    [1, 1],
  ])],
};

// 10. Pentomino line (1x5)
const pentominoLine: PieceType = {
  id: 'pentomino_line',
  variants: uniqueVariants([
    m([[1, 1, 1, 1, 1]]),
    m([[1], [1], [1], [1], [1]]),
  ]),
};

// 11. Big L-shape (3x3, 5 cells)
const bigL: PieceType = {
  id: 'big_l',
  variants: uniqueVariants([
    ...rotations4(m([
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ])),
    ...rotations4(mirrorH(m([
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ]))),
  ]),
};

// 12. Rectangle (2x3, 6 cells)
const rectangle: PieceType = {
  id: 'rectangle',
  variants: uniqueVariants([
    m([[1, 1, 1], [1, 1, 1]]),
    m([[1, 1], [1, 1], [1, 1]]),
  ]),
};

// 13. 3x3 Square (9 cells)
const square3: PieceType = {
  id: 'square_3x3',
  variants: [m([
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ])],
};

// 14. Diagonal 2x2 (2 cells)
const diagonal2: PieceType = {
  id: 'diagonal_2',
  variants: uniqueVariants([
    m([
      [1, 0],
      [0, 1],
    ]),
    m([
      [0, 1],
      [1, 0],
    ]),
  ]),
};

// 15. Diagonal 3x3 (3 cells)
const diagonal3: PieceType = {
  id: 'diagonal_3',
  variants: uniqueVariants([
    m([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]),
    m([
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ]),
  ]),
};

// 16. Big rectangle (4x2, 8 cells)
const bigRectangle: PieceType = {
  id: 'big_rectangle',
  variants: uniqueVariants([
    m([[1, 1, 1, 1], [1, 1, 1, 1]]),
    m([[1, 1], [1, 1], [1, 1], [1, 1]]),
  ]),
};

export const ALL_PIECE_TYPES: PieceType[] = [
  single,
  domino,
  trominoLine,
  smallCorner,
  tetrominoLine,
  smallL,
  tShape,
  zigzag,
  square2,
  pentominoLine,
  bigL,
  rectangle,
  square3,
  diagonal2,
  diagonal3,
  bigRectangle,
];
