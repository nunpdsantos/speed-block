import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GridPos } from '../core/types';
import { Layout } from './LayoutManager';
import { FONT_DISPLAY, FONT_MONO, THEME, lighten } from './Theme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  text: Text;
  startY: number;
  life: number;
  maxLife: number;
}

export class AnimationManager {
  container: Container;
  private particles: Particle[] = [];
  private popups: ScorePopup[] = [];
  private particleGraphics: Graphics;
  private layout!: Layout;

  constructor() {
    this.container = new Container();
    this.particleGraphics = new Graphics();
    this.container.addChild(this.particleGraphics);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
  }

  /** Spawn line-clear explosion particles at given cell positions */
  spawnClearEffect(cells: GridPos[], color: number): void {
    const { gridOriginX, gridOriginY, cellSize } = this.layout;
    const glowColor = lighten(color, 0.4);

    for (const cell of cells) {
      const cx = gridOriginX + cell.col * cellSize + cellSize / 2;
      const cy = gridOriginY + cell.row * cellSize + cellSize / 2;

      // Bright inner burst
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 50;
        this.particles.push({
          x: cx + (Math.random() - 0.5) * 4,
          y: cy + (Math.random() - 0.5) * 4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 3,
          color: glowColor,
          alpha: 1,
          life: 0,
          maxLife: 0.3 + Math.random() * 0.15,
        });
      }

      // Colored sparks
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          size: 2 + Math.random() * 3,
          color,
          alpha: 1,
          life: 0,
          maxLife: 0.5 + Math.random() * 0.25,
        });
      }
    }
  }

  /** Show a floating score popup */
  showScorePopup(score: number, x: number, y: number, isCombo: boolean): void {
    const color = isCombo ? THEME.gold : THEME.textPrimary;
    const style = new TextStyle({
      fontFamily: FONT_MONO,
      fontSize: isCombo ? 30 : 24,
      fontWeight: '400',
      fill: color,
      letterSpacing: 1,
      dropShadow: {
        alpha: 0.6,
        blur: 10,
        color: isCombo ? THEME.gold : 0x3b82f6,
        distance: 0,
      },
    });
    const text = new Text({ text: `+${score}`, style });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.container.addChild(text);
    this.popups.push({ text, startY: y, life: 0, maxLife: 0.9 });
  }

  /** Show streak label or custom text */
  showStreakPopup(streak: number, customLabel?: string): void {
    if (!this.layout) return;
    let label = customLabel || '';
    if (!customLabel) {
      if (streak >= 8) label = 'UNSTOPPABLE';
      else if (streak >= 5) label = 'INCREDIBLE';
      else if (streak >= 3) label = 'AMAZING';
      else if (streak >= 2) label = 'GREAT';
      else return;
    }

    const style = new TextStyle({
      fontFamily: FONT_DISPLAY,
      fontSize: 34,
      fontWeight: '800',
      fill: THEME.gold,
      letterSpacing: 6,
      dropShadow: {
        alpha: 0.7,
        blur: 12,
        color: THEME.gold,
        distance: 0,
      },
    });
    const text = new Text({ text: label, style });
    text.anchor.set(0.5);
    text.x = this.layout.width / 2;
    text.y = this.layout.height / 2 - 50;
    this.container.addChild(text);
    this.popups.push({ text, startY: text.y, life: 0, maxLife: 1.3 });
  }

  /** Update all animations. Called every frame with delta in seconds. */
  update(dt: number): void {
    const g = this.particleGraphics;
    g.clear();

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt; // gravity
      p.alpha = 1 - easeIn(t);
      p.size *= 0.97;

      // Particle with soft edge
      g.circle(p.x, p.y, p.size * 1.5);
      g.fill({ color: p.color, alpha: p.alpha * 0.2 });
      g.circle(p.x, p.y, p.size);
      g.fill({ color: p.color, alpha: p.alpha });
    }

    // Score popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const popup = this.popups[i];
      popup.life += dt;
      if (popup.life >= popup.maxLife) {
        this.container.removeChild(popup.text);
        popup.text.destroy();
        this.popups.splice(i, 1);
        continue;
      }
      const t = popup.life / popup.maxLife;
      // Scale bounce: start slightly large, settle to 1, then shrink
      const scale = t < 0.15
        ? 1 + 0.3 * easeOut(t / 0.15)
        : 1.3 - 0.3 * easeOut((t - 0.15) / 0.85);
      popup.text.y = popup.startY - 50 * easeOut(t);
      popup.text.alpha = t < 0.8 ? 1 : 1 - easeIn((t - 0.8) / 0.2);
      popup.text.scale.set(Math.max(0.5, scale));
    }
  }
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
