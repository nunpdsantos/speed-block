import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Layout } from './LayoutManager';
import { FONT_DISPLAY, FONT_MONO, THEME } from './Theme';

// Speed bar color tiers
const SPEED_TIERS = [
  { min: 3.5, color: 0xff4444, glow: 0xff6666 },  // red — blazing
  { min: 2.5, color: THEME.gold, glow: THEME.goldGlow },  // gold — excellent
  { min: 1.8, color: 0x20bf6b, glow: 0x4ade80 },  // green — solid
  { min: 0,   color: THEME.accent, glow: THEME.accentGlow },  // blue — baseline
];

function getSpeedColor(multiplier: number): { color: number; glow: number } {
  for (const tier of SPEED_TIERS) {
    if (multiplier >= tier.min) return tier;
  }
  return SPEED_TIERS[SPEED_TIERS.length - 1];
}

export class UIRenderer {
  container: Container;
  private scoreText: Text;
  private scoreLabelText: Text;
  private streakText: Text;
  private highScoreText: Text;
  private speedText: Text;
  private speedBarGfx: Graphics;
  private speedStreakGfx: Graphics;
  private layout!: Layout;

  // Animation state
  private speedPulsePhase = 0;

  constructor() {
    this.container = new Container();

    this.scoreLabelText = new Text({
      text: 'SCORE',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        fontWeight: '600',
        fill: THEME.textSecondary,
        letterSpacing: 3,
      }),
    });

    this.scoreText = new Text({
      text: '0',
      style: new TextStyle({
        fontFamily: FONT_MONO,
        fontSize: 34,
        fontWeight: '400',
        fill: THEME.textPrimary,
        letterSpacing: 1,
      }),
    });

    this.streakText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 16,
        fontWeight: '700',
        fill: THEME.gold,
        letterSpacing: 2,
        dropShadow: {
          alpha: 0.4,
          blur: 6,
          color: THEME.gold,
          distance: 0,
        },
      }),
    });

    this.highScoreText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        fontWeight: '400',
        fill: THEME.textMuted,
        letterSpacing: 2,
      }),
    });

    this.speedText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 14,
        fontWeight: '700',
        fill: THEME.accent,
        letterSpacing: 1,
      }),
    });

    this.speedBarGfx = new Graphics();
    this.speedStreakGfx = new Graphics();

    this.container.addChild(this.highScoreText);
    this.container.addChild(this.scoreLabelText);
    this.container.addChild(this.scoreText);
    this.container.addChild(this.streakText);
    this.container.addChild(this.speedBarGfx);
    this.container.addChild(this.speedStreakGfx);
    this.container.addChild(this.speedText);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;

    this.scoreLabelText.anchor.set(0.5, 0);
    this.scoreLabelText.x = layout.width / 2;
    this.scoreLabelText.y = 10;

    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = layout.width / 2;
    this.scoreText.y = layout.scoreY;

    this.streakText.anchor.set(0.5, 0);
    this.streakText.x = layout.width / 2;
    this.streakText.y = layout.streakY;

    this.highScoreText.anchor.set(1, 0);
    this.highScoreText.x = layout.width - 12;
    this.highScoreText.y = 10;

    // Speed text sits right-aligned above the bar
    this.speedText.anchor.set(1, 1);
    this.speedText.x = layout.gridOriginX + layout.gridSize;
    this.speedText.y = layout.gridOriginY - 8;
  }

  updateScore(score: number): void {
    this.scoreText.text = score.toLocaleString();
    this.updateScoreColor(score);
  }

  updateStreak(streak: number): void {
    if (streak > 0) {
      this.streakText.text = `STREAK \u00D7${streak}`;
      this.streakText.visible = true;
    } else {
      this.streakText.visible = false;
    }
  }

  updateHighScore(highScore: number): void {
    if (highScore > 0) {
      this.highScoreText.text = `BEST ${highScore.toLocaleString()}`;
      this.highScoreText.visible = true;
    } else {
      this.highScoreText.visible = false;
    }
  }

  updateSpeedMultiplier(multiplier: number, speedStreak: number, dt: number): void {
    if (!this.layout) return;
    const layout = this.layout;
    const barX = layout.gridOriginX;
    const barY = layout.gridOriginY - 6;
    const barW = layout.gridSize;
    const barH = 4;

    // Speed bar: always drawn, fills based on multiplier
    const g = this.speedBarGfx;
    g.clear();

    if (multiplier > 1.01) {
      // Fill ratio: 1.0 = empty, max = full. max is 6.0 (4x base + 2x streak cap)
      const maxPossible = 6.0;
      const fill = Math.min((multiplier - 1.0) / (maxPossible - 1.0), 1.0);
      const tier = getSpeedColor(multiplier);

      // Track background (dark)
      g.roundRect(barX, barY, barW, barH, 2);
      g.fill({ color: 0x111428, alpha: 0.6 });

      // Filled portion
      const fillW = Math.max(barH, barW * fill);  // min width = bar height for round cap
      g.roundRect(barX, barY, fillW, barH, 2);
      g.fill({ color: tier.color });

      // Glow overlay on the filled portion for high multipliers
      if (multiplier >= 2.5) {
        g.roundRect(barX, barY, fillW, barH, 2);
        g.fill({ color: tier.glow, alpha: 0.3 });
      }

      // Speed text
      const pct = Math.round((multiplier - 1) * 100);
      let label = `+${pct}%`;
      if (multiplier >= 4.0) {
        label = `BLAZING ${label}`;
      } else if (multiplier >= 2.5) {
        label = `FAST ${label}`;
      }
      this.speedText.text = label;
      this.speedText.visible = true;
      this.speedText.style.fill = tier.color;

      // Pulse the text at high multipliers
      if (multiplier >= 2.5) {
        this.speedPulsePhase += dt * 6;
        const pulse = 1 + Math.sin(this.speedPulsePhase) * 0.08;
        this.speedText.scale.set(pulse);
        // Glow via dropShadow
        this.speedText.style.dropShadow = {
          alpha: 0.5 + Math.sin(this.speedPulsePhase) * 0.3,
          angle: 0,
          blur: 8,
          color: tier.glow,
          distance: 0,
        };
      } else {
        this.speedPulsePhase = 0;
        this.speedText.scale.set(1);
        this.speedText.style.dropShadow = false;
      }
    } else {
      // Timer expired — show empty track briefly or hide
      g.roundRect(barX, barY, barW, barH, 2);
      g.fill({ color: 0x111428, alpha: 0.3 });
      this.speedText.visible = false;
      this.speedPulsePhase = 0;
      this.speedText.scale.set(1);
      this.speedText.style.dropShadow = false;
    }

    // Speed streak pips (small dots to the left of the speed text)
    const sg = this.speedStreakGfx;
    sg.clear();
    if (speedStreak > 0) {
      const pipSize = 4;
      const pipGap = 3;
      const maxPips = Math.min(speedStreak, 8);  // cap visual at 8
      const pipStartX = barX;
      const pipY = barY - 10;

      for (let i = 0; i < maxPips; i++) {
        const px = pipStartX + i * (pipSize + pipGap);
        const tier = i >= 4 ? getSpeedColor(4.0) : i >= 2 ? getSpeedColor(2.5) : getSpeedColor(1.5);
        // Filled pip
        sg.circle(px + pipSize / 2, pipY, pipSize / 2);
        sg.fill({ color: tier.color });
        // Glow on later pips
        if (i >= 2) {
          sg.circle(px + pipSize / 2, pipY, pipSize / 2 + 1);
          sg.fill({ color: tier.glow, alpha: 0.3 });
        }
      }
    }
  }

  private updateScoreColor(score: number): void {
    let color = THEME.textPrimary;
    if (score >= 50000) color = 0xef4444;      // ruby
    else if (score >= 25000) color = 0xf59e0b;  // amber
    else if (score >= 10000) color = 0xfbbf24;  // gold
    else if (score >= 5000) color = 0x10b981;   // emerald
    else if (score >= 1000) color = 0x3b82f6;   // sapphire
    this.scoreText.style.fill = color;
  }
}
