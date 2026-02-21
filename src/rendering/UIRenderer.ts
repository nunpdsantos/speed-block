import { Container, Text, TextStyle } from 'pixi.js';
import { Layout } from './LayoutManager';
import { FONT_DISPLAY, FONT_MONO, THEME } from './Theme';

export class UIRenderer {
  container: Container;
  private scoreText: Text;
  private scoreLabelText: Text;
  private streakText: Text;
  private highScoreText: Text;
  private speedText: Text;
  private layout!: Layout;

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
        fontSize: 13,
        fontWeight: '700',
        fill: THEME.accent,
        letterSpacing: 1,
      }),
    });

    this.container.addChild(this.highScoreText);
    this.container.addChild(this.scoreLabelText);
    this.container.addChild(this.scoreText);
    this.container.addChild(this.streakText);
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

    this.speedText.anchor.set(0, 0);
    this.speedText.x = 12;
    this.speedText.y = 10;
  }

  updateScore(score: number): void {
    this.scoreText.text = score.toLocaleString();
    this.updateScoreColor(score);
  }

  updateStreak(streak: number): void {
    if (streak > 0) {
      this.streakText.text = `STREAK ×${streak}`;
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

  updateSpeedMultiplier(multiplier: number): void {
    if (multiplier > 1.01) {
      const pct = Math.round((multiplier - 1) * 100);
      this.speedText.text = `SPEED +${pct}%`;
      this.speedText.visible = true;
      // Color shifts: green at low bonus, gold at high
      if (multiplier >= 1.7) {
        this.speedText.style.fill = THEME.gold;
      } else if (multiplier >= 1.3) {
        this.speedText.style.fill = 0x20bf6b;
      } else {
        this.speedText.style.fill = THEME.accent;
      }
    } else {
      this.speedText.visible = false;
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
