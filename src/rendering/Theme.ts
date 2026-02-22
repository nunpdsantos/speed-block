// ── Visual Identity ──

// Typography
export const FONT_DISPLAY = '"Oxanium", sans-serif';
export const FONT_MONO = '"Share Tech Mono", monospace';

// Color system — bright blue background with dark grid
export const THEME = {
  // Backgrounds
  bg: 0x4a5ba6,        // medium blue page background
  gridBg: 0x191e3c,    // dark navy grid board
  cellWell: 0x1f2548,   // cell depression (slightly lighter than grid)
  cellWellBorder: 0x2a3260,

  // Text
  textPrimary: 0xffffff,
  textSecondary: 0xb8c0e0,
  textMuted: 0x7882aa,

  // Accents
  accent: 0x4a7af7,
  accentGlow: 0x6b9aff,
  gold: 0xfbbf24,
  goldGlow: 0xfde047,
  danger: 0xef4444,
  success: 0x22d3ee,

  // UI
  btnPrimary: 0x4a7af7,
  btnHighlight: 0x6b9aff,
  overlay: 0x0a0e20,
};

// Color utilities
export function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * amount);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/** Linearly interpolate between two RGB colors */
export function lerpColor(a: number, b: number, t: number): number {
  const clamp = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * clamp);
  const g = Math.round(ag + (bg - ag) * clamp);
  const bv = Math.round(ab + (bb - ab) * clamp);
  return (r << 16) | (g << 8) | bv;
}

/**
 * Draw a 3D beveled block tile — matches the raised-tile style
 * of the original game with thick highlight and visible shadow edge.
 */
export function drawBeveledBlock(
  g: import('pixi.js').Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  radius: number = 5,
): void {
  const bevel = Math.max(Math.floor(size * 0.06), 2);

  // Full block filled with shadow/dark color (visible on bottom-right edges)
  g.roundRect(x, y, size, size, radius);
  g.fill({ color: darken(color, 0.35) });

  // Main face (inset from bottom-right to reveal shadow edge)
  g.roundRect(x, y, size - bevel, size - bevel, radius);
  g.fill({ color });

  // Top-left highlight edge (bright strip)
  g.roundRect(x + 1, y + 1, size - bevel - 2, Math.max(size * 0.38, 6), radius - 1);
  g.fill({ color: lighten(color, 0.28), alpha: 0.55 });
}
