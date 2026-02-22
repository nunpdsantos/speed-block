import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { Leaderboard } from '../core/Leaderboard';
import { Difficulty, DIFFICULTY_LABELS } from '../core/Config';
import { FONT_DISPLAY, FONT_MONO, THEME } from '../rendering/Theme';

const DIFFICULTIES: Difficulty[] = ['chill', 'fast', 'blitz'];

export class MenuScene implements Scene {
  container: Container;
  private onPlay: () => void;
  private onDifficultyChange: (d: Difficulty) => void;
  private width: number;
  private height: number;
  private leaderboard: Leaderboard;
  private selectedDifficulty: Difficulty;
  private pulseText: Text | null = null;
  private elapsed = 0;

  // Rebuildable sections
  private difficultyContainer: Container | null = null;
  private leaderboardContainer: Container | null = null;

  constructor(
    width: number, height: number,
    leaderboard: Leaderboard,
    selectedDifficulty: Difficulty,
    onDifficultyChange: (d: Difficulty) => void,
    onPlay: () => void,
  ) {
    this.width = width;
    this.height = height;
    this.leaderboard = leaderboard;
    this.selectedDifficulty = selectedDifficulty;
    this.onDifficultyChange = onDifficultyChange;
    this.onPlay = onPlay;
    this.container = new Container();
    this.build();
  }

  private build(): void {
    // Title
    const title = new Text({
      text: 'SPEED BLOCK',
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

    // Difficulty selector
    this.buildDifficultySelector();

    // Play button
    const btnW = 200;
    const btnH = 56;
    const btnX = this.width / 2 - btnW / 2;
    const btnY = this.height * 0.28;

    const btn = new Graphics();
    btn.roundRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4, 14);
    btn.fill({ color: THEME.accent, alpha: 0.15 });
    btn.roundRect(btnX, btnY, btnW, btnH, 12);
    btn.fill({ color: THEME.btnPrimary });
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

    // Play button click (stops propagation so full-screen handler doesn't double-fire)
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => { e.stopPropagation(); this.onPlay(); });
    btnText.eventMode = 'static';
    btnText.cursor = 'pointer';
    btnText.on('pointerdown', (e) => { e.stopPropagation(); this.onPlay(); });

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
    hint.y = btnY + btnH + 20;
    this.container.addChild(hint);
    this.pulseText = hint;

    // Leaderboard
    this.buildLeaderboard();

    // Full-screen tap handler (below everything)
    const fullScreenHit = new Graphics();
    fullScreenHit.rect(0, 0, this.width, this.height);
    fullScreenHit.fill({ color: 0x000000, alpha: 0 });
    fullScreenHit.eventMode = 'static';
    fullScreenHit.on('pointerdown', () => this.onPlay());
    this.container.addChildAt(fullScreenHit, 0);
  }

  // ── Difficulty selector ──

  private buildDifficultySelector(): void {
    if (this.difficultyContainer) {
      this.container.removeChild(this.difficultyContainer);
      this.difficultyContainer.destroy({ children: true });
    }

    const group = new Container();
    this.difficultyContainer = group;
    this.container.addChild(group);

    const selectorY = this.height * 0.19;
    const chipW = 80;
    const chipH = 32;
    const gap = 10;
    const totalW = DIFFICULTIES.length * chipW + (DIFFICULTIES.length - 1) * gap;
    const startX = this.width / 2 - totalW / 2;

    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const diff = DIFFICULTIES[i];
      const isSelected = diff === this.selectedDifficulty;
      const x = startX + i * (chipW + gap);

      const chip = new Graphics();
      if (isSelected) {
        chip.roundRect(x - 1, selectorY - 1, chipW + 2, chipH + 2, 9);
        chip.fill({ color: THEME.accent, alpha: 0.3 });
        chip.roundRect(x, selectorY, chipW, chipH, 8);
        chip.fill({ color: THEME.btnPrimary });
      } else {
        chip.roundRect(x, selectorY, chipW, chipH, 8);
        chip.fill({ color: 0x1a1e3a, alpha: 0.8 });
        chip.roundRect(x, selectorY, chipW, chipH, 8);
        chip.stroke({ color: THEME.cellWellBorder, alpha: 0.5, width: 1 });
      }
      group.addChild(chip);

      const label = new Text({
        text: DIFFICULTY_LABELS[diff],
        style: new TextStyle({
          fontFamily: FONT_DISPLAY,
          fontSize: 12,
          fontWeight: isSelected ? '700' : '500',
          fill: isSelected ? THEME.textPrimary : THEME.textSecondary,
          letterSpacing: 2,
        }),
      });
      label.anchor.set(0.5);
      label.x = x + chipW / 2;
      label.y = selectorY + chipH / 2;
      group.addChild(label);

      chip.eventMode = 'static';
      chip.cursor = 'pointer';
      chip.on('pointerdown', (e) => {
        e.stopPropagation();
        if (diff === this.selectedDifficulty) return;
        this.selectedDifficulty = diff;
        this.onDifficultyChange(diff);
        this.buildDifficultySelector();
        this.buildLeaderboard();
      });
      label.eventMode = 'static';
      label.cursor = 'pointer';
      label.on('pointerdown', (e) => {
        e.stopPropagation();
        if (diff === this.selectedDifficulty) return;
        this.selectedDifficulty = diff;
        this.onDifficultyChange(diff);
        this.buildDifficultySelector();
        this.buildLeaderboard();
      });
    }
  }

  // ── Leaderboard ──

  private buildLeaderboard(): void {
    if (this.leaderboardContainer) {
      this.container.removeChild(this.leaderboardContainer);
      this.leaderboardContainer.destroy({ children: true });
      this.leaderboardContainer = null;
    }

    const entries = this.leaderboard.getEntries();
    if (entries.length === 0) return;

    const lbContainer = new Container();
    this.leaderboardContainer = lbContainer;
    this.container.addChild(lbContainer);

    const startY = this.height * 0.43;

    const headerText = new Text({
      text: `LEADERBOARD — ${DIFFICULTY_LABELS[this.selectedDifficulty]}`,
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
    lbContainer.addChild(headerText);

    // Thin separator
    const sep = new Graphics();
    sep.rect(this.width / 2 - 80, startY + 24, 160, 1);
    sep.fill({ color: THEME.cellWellBorder, alpha: 0.5 });
    lbContainer.addChild(sep);

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

      const displayName = entry.name || 'Player';
      const labelText = new Text({
        text: `${i + 1}.  ${displayName}`,
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
      lbContainer.addChild(labelText);

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
      lbContainer.addChild(valText);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.pulseText) {
      this.pulseText.alpha = 0.35 + 0.35 * Math.sin(this.elapsed * 3);
    }
  }

  enter(): void {}
  exit(): void {
    this.container.removeAllListeners();
  }
}
