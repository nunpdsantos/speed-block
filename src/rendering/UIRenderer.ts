import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Layout } from './LayoutManager';
import { FONT_DISPLAY, FONT_MONO, THEME } from './Theme';
import { Difficulty } from '../core/Config';
import { getProgressStatus } from '../core/Progression';

export class UIRenderer {
  container: Container;
  private scoreText: Text;
  private scoreLabelText: Text;
  private streakText: Text;
  private highScoreText: Text;
  private timerText: Text;
  private timerBarGfx: Graphics;
  private speedBarGfx: Graphics;
  private speedText: Text;
  private rankText: Text;
  private goalText: Text;
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

    this.speedText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: '400',
        fill: THEME.textMuted,
        letterSpacing: 1,
      }),
    });

    this.rankText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '700',
        fill: THEME.accent,
        letterSpacing: 3,
      }),
    });

    this.goalText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '500',
        fill: THEME.textMuted,
        letterSpacing: 2,
      }),
    });

    this.timerBarGfx = new Graphics();
    this.speedBarGfx = new Graphics();

    this.container.addChild(this.goalText);
    this.container.addChild(this.highScoreText);
    this.container.addChild(this.scoreLabelText);
    this.container.addChild(this.scoreText);
    this.container.addChild(this.streakText);
    this.container.addChild(this.rankText);
    this.container.addChild(this.speedBarGfx);
    this.container.addChild(this.timerBarGfx);
    this.container.addChild(this.timerText);
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

    this.goalText.anchor.set(0, 0);
    this.goalText.x = 12;
    this.goalText.y = 10;

    // Timer text: left-aligned above the bar
    this.timerText.anchor.set(0, 1);
    this.timerText.x = layout.gridOriginX;
    this.timerText.y = layout.gridOriginY - 14;

    // Speed text: right-aligned above the bar
    this.speedText.anchor.set(1, 1);
    this.speedText.x = layout.gridOriginX + layout.gridSize;
    this.speedText.y = layout.gridOriginY - 14;

    this.rankText.anchor.set(0.5, 0);
    this.rankText.x = layout.width / 2;
    this.rankText.y = layout.streakY + 22;
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

  updateProgress(difficulty: Difficulty, score: number): void {
    const status = getProgressStatus(difficulty, score);
    this.rankText.text = `TIER ${status.current.label}`;
    this.rankText.style.fill = status.current.color;
    this.rankText.visible = true;

    if (status.next) {
      this.goalText.text = `NEXT ${status.next.minScore.toLocaleString()}`;
      this.goalText.visible = true;
    } else {
      this.goalText.text = 'TOP TIER';
      this.goalText.visible = true;
    }
  }

  updateTimer(timeRemaining: number, maxTime: number, dt: number): void {
    if (!this.layout) return;
    const layout = this.layout;
    const barX = layout.gridOriginX;
    const barY = layout.gridOriginY - 12; // moved up for bigger bar
    const barW = layout.gridSize;
    const barH = 12; // enlarged from 5px to 12px

    const fill = Math.max(0, Math.min(timeRemaining / maxTime, 1.0));
    const fillW = Math.max(barH, barW * fill);

    // Determine color based on time remaining
    let barColor: number;
    let glowColor: number;
    let isLow = false;
    let isCritical = false;

    if (timeRemaining <= 10) {
      barColor = 0xff4444;
      glowColor = 0xff6666;
      isCritical = true;
      isLow = true;
    } else if (timeRemaining <= 20) {
      barColor = 0xf59e0b;
      glowColor = 0xfbbf24;
      isLow = true;
    } else if (timeRemaining <= 35) {
      barColor = THEME.gold;
      glowColor = THEME.goldGlow;
    } else {
      barColor = 0x20bf6b;
      glowColor = 0x4ade80;
    }

    // Draw timer bar
    const g = this.timerBarGfx;
    g.clear();

    // Glow behind bar (always present)
    g.roundRect(barX - 2, barY - 2, fillW + 4, barH + 4, 4);
    g.fill({ color: glowColor, alpha: 0.12 });

    // Track background
    g.roundRect(barX, barY, barW, barH, 3);
    g.fill({ color: 0x111428, alpha: 0.6 });

    // Filled portion with gradient-like effect
    g.roundRect(barX, barY, fillW, barH, 3);
    g.fill({ color: barColor });

    // Top highlight strip
    g.roundRect(barX + 1, barY + 1, fillW - 2, barH * 0.35, 2);
    g.fill({ color: 0xffffff, alpha: 0.15 });

    // Pulse glow when low
    if (isLow) {
      this.pulsePhase += dt * (isCritical ? 8 : 4);
      const pulseAlpha = 0.25 + Math.sin(this.pulsePhase) * 0.2;
      g.roundRect(barX - 1, barY - 1, fillW + 2, barH + 2, 4);
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

  /** Draw the speed-time bar and speed multiplier text */
  updateSpeedBar(speedFraction: number, speedWindow: number, elapsed: number): void {
    if (!this.layout) return;
    const layout = this.layout;

    const barX = layout.gridOriginX;
    const barY = layout.gridOriginY - 2;
    const barW = layout.gridSize;
    const barH = 3;

    const fill = Math.max(0, 1 - elapsed / speedWindow);
    const fillW = Math.max(barH, barW * fill);

    // Color by speed fraction
    let color: number;
    if (speedFraction >= 0.9) color = 0x20bf6b;
    else if (speedFraction >= 0.6) color = 0xf59e0b;
    else color = 0x4a5568;

    const g = this.speedBarGfx;
    g.clear();

    // Track background
    g.roundRect(barX, barY, barW, barH, 1);
    g.fill({ color: 0x111428, alpha: 0.4 });

    // Filled portion
    if (fill > 0) {
      g.roundRect(barX, barY, fillW, barH, 1);
      g.fill({ color });
    }

    // Speed multiplier text
    const display = `x${speedFraction.toFixed(1)}`;
    this.speedText.text = display;
    this.speedText.style.fill = color;
    this.speedText.visible = true;
  }

  private updateScoreColor(score: number): void {
    let color = THEME.textPrimary;
    if (score >= 50000) color = 0xef4444;
    else if (score >= 25000) color = 0xf59e0b;
    else if (score >= 10000) color = 0xfbbf24;
    else if (score >= 5000) color = 0x10b981;
    else if (score >= 1000) color = 0x3b82f6;
    this.scoreText.style.fill = color;
  }
}
