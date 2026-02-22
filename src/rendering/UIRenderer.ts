import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Layout } from './LayoutManager';
import { FONT_DISPLAY, FONT_MONO, THEME } from './Theme';

export class UIRenderer {
  container: Container;
  private scoreText: Text;
  private scoreLabelText: Text;
  private streakText: Text;
  private highScoreText: Text;
  private timerText: Text;
  private timerBarGfx: Graphics;
  private layout!: Layout;

  // Low-time pulse animation
  private pulsePhase = 0;

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

    this.timerText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_MONO,
        fontSize: 14,
        fontWeight: '400',
        fill: THEME.textPrimary,
        letterSpacing: 1,
      }),
    });

    this.timerBarGfx = new Graphics();

    this.container.addChild(this.highScoreText);
    this.container.addChild(this.scoreLabelText);
    this.container.addChild(this.scoreText);
    this.container.addChild(this.streakText);
    this.container.addChild(this.timerBarGfx);
    this.container.addChild(this.timerText);
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

    // Timer text: left-aligned above the bar
    this.timerText.anchor.set(0, 1);
    this.timerText.x = layout.gridOriginX;
    this.timerText.y = layout.gridOriginY - 8;
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

  updateTimer(timeRemaining: number, maxTime: number, dt: number): void {
    if (!this.layout) return;
    const layout = this.layout;
    const barX = layout.gridOriginX;
    const barY = layout.gridOriginY - 6;
    const barW = layout.gridSize;
    const barH = 5;

    const fill = Math.max(0, Math.min(timeRemaining / maxTime, 1.0));
    const fillW = Math.max(barH, barW * fill);

    // Determine color based on time remaining
    let barColor: number;
    let glowColor: number;
    let isLow = false;
    let isCritical = false;

    if (timeRemaining <= 10) {
      barColor = 0xff4444;       // red — critical
      glowColor = 0xff6666;
      isCritical = true;
      isLow = true;
    } else if (timeRemaining <= 20) {
      barColor = 0xf59e0b;       // amber — warning
      glowColor = 0xfbbf24;
      isLow = true;
    } else if (timeRemaining <= 35) {
      barColor = THEME.gold;     // gold — getting low
      glowColor = THEME.goldGlow;
    } else {
      barColor = 0x20bf6b;       // green — healthy
      glowColor = 0x4ade80;
    }

    // Draw timer bar
    const g = this.timerBarGfx;
    g.clear();

    // Track background
    g.roundRect(barX, barY, barW, barH, 2);
    g.fill({ color: 0x111428, alpha: 0.6 });

    // Filled portion
    g.roundRect(barX, barY, fillW, barH, 2);
    g.fill({ color: barColor });

    // Glow when low
    if (isLow) {
      this.pulsePhase += dt * (isCritical ? 8 : 4);
      const pulseAlpha = 0.2 + Math.sin(this.pulsePhase) * 0.15;
      g.roundRect(barX, barY - 1, fillW, barH + 2, 3);
      g.fill({ color: glowColor, alpha: pulseAlpha });
    } else {
      this.pulsePhase = 0;
    }

    // Timer text
    const secs = Math.ceil(timeRemaining);
    this.timerText.text = `${secs}s`;
    this.timerText.style.fill = barColor;
    this.timerText.visible = true;

    // Pulse timer text when critical
    if (isCritical) {
      const scale = 1 + Math.sin(this.pulsePhase) * 0.1;
      this.timerText.scale.set(scale);
    } else {
      this.timerText.scale.set(1);
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
