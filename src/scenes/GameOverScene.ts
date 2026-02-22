import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { Leaderboard } from '../core/Leaderboard';
import { FONT_DISPLAY, FONT_MONO, THEME } from '../rendering/Theme';

export class GameOverScene implements Scene {
  container: Container;
  private onReplay: () => void;
  private score: number;
  private width: number;
  private height: number;
  private leaderboard: Leaderboard;
  private hiddenInput: HTMLInputElement | null = null;
  private nameSubmitted = false;
  private rank: number | null = null;
  private leaderboardContainer: Container | null = null;
  private leaderboardStartY: number;
  private cursorLine: Graphics | null = null;
  private elapsed = 0;

  constructor(
    width: number, height: number,
    score: number,
    leaderboard: Leaderboard,
    onReplay: () => void,
  ) {
    this.width = width;
    this.height = height;
    this.score = score;
    this.leaderboard = leaderboard;
    this.onReplay = onReplay;
    this.leaderboardStartY = this.height * 0.28;
    this.container = new Container();
    this.build();
  }

  private build(): void {
    // Dimmed overlay
    const overlay = new Graphics();
    overlay.rect(0, 0, this.width, this.height);
    overlay.fill({ color: 0x0a0e20, alpha: 0.88 });
    this.container.addChild(overlay);

    // Game over text
    const title = new Text({
      text: 'GAME OVER',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 32,
        fontWeight: '800',
        fill: THEME.textPrimary,
        letterSpacing: 6,
        dropShadow: {
          alpha: 0.4,
          blur: 12,
          color: THEME.danger,
          distance: 0,
        },
      }),
    });
    title.anchor.set(0.5);
    title.x = this.width / 2;
    title.y = this.height * 0.06;
    this.container.addChild(title);

    // Score label
    const scoreLabel = new Text({
      text: 'FINAL SCORE',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '600',
        fill: THEME.textSecondary,
        letterSpacing: 4,
      }),
    });
    scoreLabel.anchor.set(0.5);
    scoreLabel.x = this.width / 2;
    scoreLabel.y = this.height * 0.11;
    this.container.addChild(scoreLabel);

    // Score value with glow
    const scoreText = new Text({
      text: this.score.toLocaleString(),
      style: new TextStyle({
        fontFamily: FONT_MONO,
        fontSize: 46,
        fill: THEME.textPrimary,
        letterSpacing: 2,
        dropShadow: {
          alpha: 0.5,
          blur: 16,
          color: THEME.accent,
          distance: 0,
        },
      }),
    });
    scoreText.anchor.set(0.5);
    scoreText.x = this.width / 2;
    scoreText.y = this.height * 0.16;
    this.container.addChild(scoreText);

    const wouldRank = this.leaderboard.wouldRank(this.score);

    if (wouldRank) {
      this.showNameInput();
    } else {
      this.buildLeaderboard();
      this.buildPlayAgainButton();
    }
  }

  private showNameInput(): void {
    const promptText = new Text({
      text: 'NEW HIGH SCORE',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 14,
        fontWeight: '700',
        fill: THEME.gold,
        letterSpacing: 4,
        dropShadow: {
          alpha: 0.4,
          blur: 8,
          color: THEME.gold,
          distance: 0,
        },
      }),
    });
    promptText.anchor.set(0.5);
    promptText.x = this.width / 2;
    promptText.y = this.height * 0.225;
    this.container.addChild(promptText);

    // Name display — rendered in PixiJS
    const nameY = this.height * 0.275;
    const fieldW = 220;
    const fieldH = 42;
    const fieldX = this.width / 2 - fieldW / 2;
    const fieldY = nameY - fieldH / 2;

    // Input field background
    const fieldBg = new Graphics();
    fieldBg.roundRect(fieldX, fieldY, fieldW, fieldH, 8);
    fieldBg.fill({ color: 0x0c0e24, alpha: 0.95 });
    fieldBg.roundRect(fieldX, fieldY, fieldW, fieldH, 8);
    fieldBg.stroke({ color: THEME.accent, alpha: 0.6, width: 2 });
    this.container.addChild(fieldBg);

    const lastName = this.leaderboard.getLastName();
    const nameText = new Text({
      text: lastName || '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: '600',
        fill: THEME.textPrimary,
        letterSpacing: 1,
      }),
    });
    nameText.anchor.set(0.5);
    nameText.x = this.width / 2;
    nameText.y = nameY;
    this.container.addChild(nameText);


    // Blinking cursor
    const cursor = new Graphics();
    this.cursorLine = cursor;
    this.container.addChild(cursor);
    this.updateCursor(nameText);

    // Placeholder text (shown when empty)
    const placeholder = new Text({
      text: 'Your name',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: '400',
        fill: THEME.textMuted,
        letterSpacing: 1,
      }),
    });
    placeholder.anchor.set(0.5);
    placeholder.x = this.width / 2;
    placeholder.y = nameY;
    placeholder.visible = !lastName;
    this.container.addChild(placeholder);

    // Real HTML input overlaid on top of the PixiJS field.
    // Must be visible and properly sized for mobile keyboards to appear.
    const canvas = document.querySelector('canvas')!;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.width;
    const scaleY = canvasRect.height / this.height;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.value = lastName;
    input.autocomplete = 'off';
    input.enterKeyHint = 'done';
    Object.assign(input.style, {
      position: 'fixed',
      left: `${canvasRect.left + fieldX * scaleX}px`,
      top: `${canvasRect.top + fieldY * scaleY}px`,
      width: `${fieldW * scaleX}px`,
      height: `${fieldH * scaleY}px`,
      fontSize: `${18 * scaleY}px`,
      fontFamily: 'inherit',
      textAlign: 'center',
      color: 'white',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      caretColor: 'white',
      zIndex: '1000',
      touchAction: 'manipulation',
    });
    document.body.appendChild(input);
    this.hiddenInput = input;

    // Hide the PixiJS-rendered name text and cursor — the real input is visible now
    nameText.visible = false;
    placeholder.visible = false;
    if (this.cursorLine) this.cursorLine.visible = false;

    input.addEventListener('input', () => {
      // Keep PixiJS text in sync (used if input is removed before submission)
      nameText.text = input.value;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitName(input.value);
    });

    // Focus after a short delay to ensure DOM is ready
    setTimeout(() => input.focus(), 150);

    // OK button
    const btnW = 80;
    const btnH = 36;
    const btnX = this.width / 2 - btnW / 2;
    const btnY = fieldY + fieldH + 14;

    const btn = new Graphics();
    btn.roundRect(btnX, btnY, btnW, btnH, 8);
    btn.fill({ color: THEME.btnPrimary });
    btn.roundRect(btnX + 1, btnY + 1, btnW - 2, btnH * 0.45, 7);
    btn.fill({ color: THEME.btnHighlight, alpha: 0.12 });
    this.container.addChild(btn);

    const btnText = new Text({
      text: 'OK',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 16,
        fontWeight: '700',
        fill: THEME.textPrimary,
        letterSpacing: 2,
      }),
    });
    btnText.anchor.set(0.5);
    btnText.x = this.width / 2;
    btnText.y = btnY + btnH / 2;
    this.container.addChild(btnText);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => {
      e.stopPropagation();
      this.submitName(input.value);
    });
    btnText.eventMode = 'static';
    btnText.cursor = 'pointer';
    btnText.on('pointerdown', (e) => {
      e.stopPropagation();
      this.submitName(input.value);
    });

    this.leaderboardStartY = btnY + btnH + 20;
    this.buildLeaderboard();
  }

  private updateCursor(nameText: Text): void {
    if (!this.cursorLine) return;
    this.cursorLine.clear();
    const textW = nameText.width;
    const cursorX = this.width / 2 + textW / 2 + 2;
    const cursorY = nameText.y - 10;
    this.cursorLine.rect(cursorX, cursorY, 2, 20);
    this.cursorLine.fill({ color: THEME.textPrimary });
  }

  private async submitName(name: string): Promise<void> {
    if (this.nameSubmitted) return;
    this.nameSubmitted = true;

    if (this.hiddenInput) {
      this.hiddenInput.remove();
      this.hiddenInput = null;
    }

    this.rank = await this.leaderboard.submit(this.score, name);

    if (this.leaderboardContainer) {
      this.container.removeChild(this.leaderboardContainer);
      this.leaderboardContainer.destroy({ children: true });
      this.leaderboardContainer = null;
    }
    this.buildLeaderboard();
    this.buildPlayAgainButton();
  }

  private buildPlayAgainButton(): void {
    const btnW = 200;
    const btnH = 50;
    const btnX = this.width / 2 - btnW / 2;
    const btnY = this.height * 0.88;

    const btn = new Graphics();
    // Glow
    btn.roundRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4, 14);
    btn.fill({ color: THEME.accent, alpha: 0.12 });
    // Body
    btn.roundRect(btnX, btnY, btnW, btnH, 12);
    btn.fill({ color: THEME.btnPrimary });
    // Highlight
    btn.roundRect(btnX + 1, btnY + 1, btnW - 2, btnH * 0.45, 11);
    btn.fill({ color: THEME.btnHighlight, alpha: 0.12 });
    this.container.addChild(btn);

    const btnText = new Text({
      text: 'PLAY AGAIN',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: '700',
        fill: THEME.textPrimary,
        letterSpacing: 4,
      }),
    });
    btnText.anchor.set(0.5);
    btnText.x = this.width / 2;
    btnText.y = btnY + btnH / 2;
    this.container.addChild(btnText);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => this.onReplay());
    btnText.eventMode = 'static';
    btnText.cursor = 'pointer';
    btnText.on('pointerdown', () => this.onReplay());
  }

  private buildLeaderboard(): void {
    const entries = this.leaderboard.getEntries();
    const lbContainer = new Container();
    this.leaderboardContainer = lbContainer;
    this.container.addChild(lbContainer);

    if (entries.length === 0) return;

    const startY = this.leaderboardStartY;

    const headerText = new Text({
      text: 'LEADERBOARD',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        fontWeight: '600',
        fill: THEME.textSecondary,
        letterSpacing: 4,
      }),
    });
    headerText.anchor.set(0.5, 0);
    headerText.x = this.width / 2;
    headerText.y = startY;
    lbContainer.addChild(headerText);

    // Separator
    const sep = new Graphics();
    sep.rect(this.width / 2 - 80, startY + 22, 160, 1);
    sep.fill({ color: THEME.cellWellBorder, alpha: 0.5 });
    lbContainer.addChild(sep);

    const lineHeight = 26;
    const listStartY = startY + 32;
    const leftX = this.width / 2 - 160;
    const rightX = this.width / 2 + 160;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const y = listStartY + i * lineHeight;
      const isCurrentScore = this.rank !== null && i === this.rank - 1;
      const isTop3 = i < 3;

      const color = isCurrentScore ? THEME.gold : (isTop3 ? THEME.textPrimary : THEME.textSecondary);
      const fontSize = isCurrentScore ? 15 : 13;

      const displayName = entry.name || 'Player';
      const labelText = new Text({
        text: `${i + 1}.  ${displayName}`,
        style: new TextStyle({
          fontFamily: FONT_DISPLAY,
          fontSize,
          fontWeight: isCurrentScore || isTop3 ? '600' : '400',
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
    // Blink cursor at ~2Hz
    if (this.cursorLine) {
      this.cursorLine.visible = Math.sin(this.elapsed * 6) > 0;
    }
  }

  enter(): void {}
  exit(): void {
    if (this.hiddenInput) {
      this.hiddenInput.remove();
      this.hiddenInput = null;
    }
    this.container.removeAllListeners();
  }
}
