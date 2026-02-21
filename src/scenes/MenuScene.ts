import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { Leaderboard } from '../core/Leaderboard';
import { FONT_DISPLAY, FONT_MONO, THEME } from '../rendering/Theme';

export class MenuScene implements Scene {
  container: Container;
  private onPlay: () => void;
  private width: number;
  private height: number;
  private leaderboard: Leaderboard;
  private pulseText: Text | null = null;
  private elapsed = 0;

  constructor(width: number, height: number, leaderboard: Leaderboard, onPlay: () => void) {
    this.width = width;
    this.height = height;
    this.leaderboard = leaderboard;
    this.onPlay = onPlay;
    this.container = new Container();
    this.build();
  }

  private build(): void {
    // Title
    const title = new Text({
      text: 'FREE BLOCK',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 44,
        fontWeight: '800',
        fill: THEME.textPrimary,
        letterSpacing: 8,
        dropShadow: {
          alpha: 0.3,
          blur: 4,
          color: 0x000000,
          distance: 2,
        },
      }),
    });
    title.anchor.set(0.5);
    title.x = this.width / 2;
    title.y = this.height * 0.1;
    this.container.addChild(title);

    // Decorative line under title
    const line = new Graphics();
    const lineW = 120;
    line.rect(this.width / 2 - lineW / 2, this.height * 0.14, lineW, 2);
    line.fill({ color: 0xffffff, alpha: 0.2 });
    this.container.addChild(line);

    // Play button
    const btnW = 200;
    const btnH = 56;
    const btnX = this.width / 2 - btnW / 2;
    const btnY = this.height * 0.20;

    const btn = new Graphics();
    // Button glow
    btn.roundRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4, 14);
    btn.fill({ color: THEME.accent, alpha: 0.15 });
    // Button body
    btn.roundRect(btnX, btnY, btnW, btnH, 12);
    btn.fill({ color: THEME.btnPrimary });
    // Button highlight (top half)
    btn.roundRect(btnX + 1, btnY + 1, btnW - 2, btnH * 0.45, 11);
    btn.fill({ color: THEME.btnHighlight, alpha: 0.15 });
    this.container.addChild(btn);

    const btnText = new Text({
      text: 'PLAY',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 22,
        fontWeight: '700',
        fill: THEME.textPrimary,
        letterSpacing: 6,
      }),
    });
    btnText.anchor.set(0.5);
    btnText.x = this.width / 2;
    btnText.y = btnY + btnH / 2;
    this.container.addChild(btnText);

    // Tap to play hint (pulsing)
    const hint = new Text({
      text: 'TAP ANYWHERE',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '400',
        fill: THEME.textMuted,
        letterSpacing: 4,
      }),
    });
    hint.anchor.set(0.5);
    hint.x = this.width / 2;
    hint.y = this.height * 0.20 + btnH + 20;
    this.container.addChild(hint);
    this.pulseText = hint;

    // Leaderboard
    this.buildLeaderboard(this.height * 0.38);

    // Click handler — full screen
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', () => this.onPlay());
  }

  private buildLeaderboard(startY: number): void {
    const entries = this.leaderboard.getEntries();
    if (entries.length === 0) return;

    const headerText = new Text({
      text: 'LEADERBOARD',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 13,
        fontWeight: '600',
        fill: THEME.textSecondary,
        letterSpacing: 4,
      }),
    });
    headerText.anchor.set(0.5, 0);
    headerText.x = this.width / 2;
    headerText.y = startY;
    this.container.addChild(headerText);

    // Thin separator
    const sep = new Graphics();
    sep.rect(this.width / 2 - 80, startY + 24, 160, 1);
    sep.fill({ color: THEME.cellWellBorder, alpha: 0.5 });
    this.container.addChild(sep);

    const lineHeight = 30;
    const listStartY = startY + 36;
    const leftX = this.width / 2 - 140;
    const rightX = this.width / 2 + 140;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const y = listStartY + i * lineHeight;
      const isTop3 = i < 3;
      const color = isTop3 ? THEME.textPrimary : THEME.textSecondary;
      const fontSize = i === 0 ? 16 : 14;

      // Rank medal for top 3
      const medals = ['', '', ''];
      const rankPrefix = i < 3 ? medals[i] + ' ' : '';

      const displayName = entry.name || 'Player';
      const labelText = new Text({
        text: `${rankPrefix}${i + 1}.  ${displayName}`,
        style: new TextStyle({
          fontFamily: FONT_DISPLAY,
          fontSize,
          fontWeight: isTop3 ? '600' : '400',
          fill: color,
        }),
      });
      labelText.anchor.set(0, 0.5);
      labelText.x = leftX;
      labelText.y = y;
      this.container.addChild(labelText);

      const valText = new Text({
        text: entry.score.toLocaleString(),
        style: new TextStyle({
          fontFamily: FONT_MONO,
          fontSize,
          fill: color,
        }),
      });
      valText.anchor.set(1, 0.5);
      valText.x = rightX;
      valText.y = y;
      this.container.addChild(valText);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.pulseText) {
      // Gentle pulse between 0.3 and 0.7 alpha
      this.pulseText.alpha = 0.35 + 0.35 * Math.sin(this.elapsed * 3);
    }
  }

  enter(): void {}
  exit(): void {
    this.container.removeAllListeners();
  }
}
