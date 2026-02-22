import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { Leaderboard } from '../core/Leaderboard';
import { Difficulty, DIFFICULTY_LABELS } from '../core/Config';
import { FONT_DISPLAY, FONT_MONO, THEME } from '../rendering/Theme';

export class GameOverScene implements Scene {
  container: Container;
  private onReplay: () => void;
  private onMenu: () => void;
  private score: number;
  private width: number;
  private height: number;
  private leaderboard: Leaderboard;
  private difficulty: Difficulty;
  private nameSubmitted = false;
  private rank: number | null = null;
  private leaderboardContainer: Container | null = null;

  // Name input group — everything related to name entry
  private nameInputGroup: Container | null = null;
  private htmlInput: HTMLInputElement | null = null;
  private htmlButton: HTMLButtonElement | null = null;

  constructor(
    width: number, height: number,
    score: number,
    leaderboard: Leaderboard,
    difficulty: Difficulty,
    onReplay: () => void,
    onMenu: () => void,
  ) {
    this.width = width;
    this.height = height;
    this.score = score;
    this.leaderboard = leaderboard;
    this.difficulty = difficulty;
    this.onReplay = onReplay;
    this.onMenu = onMenu;
    this.container = new Container();
    this.init();
  }

  private async init(): Promise<void> {
    await this.leaderboard.waitForRemote();
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

    // Difficulty badge
    const diffLabel = new Text({
      text: DIFFICULTY_LABELS[this.difficulty],
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '600',
        fill: THEME.textMuted,
        letterSpacing: 3,
      }),
    });
    diffLabel.anchor.set(0.5);
    diffLabel.x = this.width / 2;
    diffLabel.y = this.height * 0.205;
    this.container.addChild(diffLabel);

    const wouldRank = this.leaderboard.wouldRank(this.score);

    if (wouldRank) {
      this.buildNameInput();
    }

    this.buildLeaderboard();
    this.buildPlayAgainButton();
  }

  // ── Name input ──

  private buildNameInput(): void {
    const group = new Container();
    this.nameInputGroup = group;
    this.container.addChild(group);

    const promptText = new Text({
      text: 'NEW HIGH SCORE!',
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
    group.addChild(promptText);

    // Name field dimensions
    const nameY = this.height * 0.275;
    const fieldW = 220;
    const fieldH = 42;
    const fieldX = this.width / 2 - fieldW / 2;
    const fieldY = nameY - fieldH / 2;

    // PixiJS field background (visible behind the HTML input)
    const fieldBg = new Graphics();
    fieldBg.roundRect(fieldX, fieldY, fieldW, fieldH, 8);
    fieldBg.fill({ color: 0x0c0e24, alpha: 0.95 });
    fieldBg.roundRect(fieldX, fieldY, fieldW, fieldH, 8);
    fieldBg.stroke({ color: THEME.accent, alpha: 0.6, width: 2 });
    group.addChild(fieldBg);

    // HTML input + OK button overlaid on the PixiJS field
    this.createHtmlInput(fieldX, fieldY, fieldW, fieldH);
  }

  private createHtmlInput(fieldX: number, fieldY: number, fieldW: number, fieldH: number): void {
    const canvas = document.querySelector('canvas')!;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.width;
    const scaleY = canvasRect.height / this.height;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.value = '';
    input.autocomplete = 'off';
    input.enterKeyHint = 'done';
    input.inputMode = 'text';
    input.placeholder = 'Your name';

    // Position over the PixiJS field
    const left = canvasRect.left + fieldX * scaleX;
    const top = canvasRect.top + fieldY * scaleY;
    const width = fieldW * scaleX;
    const height = fieldH * scaleY;
    const fontSize = 18 * scaleY;

    input.setAttribute('style', [
      `position: fixed`,
      `left: ${left}px`,
      `top: ${top}px`,
      `width: ${width}px`,
      `height: ${height}px`,
      `font-size: ${fontSize}px`,
      `font-family: 'Oxanium', sans-serif`,
      `text-align: center`,
      `color: white`,
      `background: transparent`,
      `border: none`,
      `outline: none`,
      `caret-color: white`,
      `z-index: 10000`,
      `padding: 0`,
      `margin: 0`,
      `box-sizing: border-box`,
      `-webkit-user-select: text !important`,
      `user-select: text !important`,
      `-webkit-touch-callout: default !important`,
      `touch-action: auto !important`,
    ].join('; '));

    document.body.appendChild(input);
    this.htmlInput = input;

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.submitName();
    });

    // HTML OK button — real DOM element so it works reliably on all devices
    const btnW = 80;
    const btnH = 36;
    const btnLeft = canvasRect.left + (this.width / 2 - btnW / 2) * scaleX;
    const btnTop = top + height + 14 * scaleY;
    const btnWidth = btnW * scaleX;
    const btnHeight = btnH * scaleY;
    const btnFontSize = 16 * scaleY;

    const btn = document.createElement('button');
    btn.textContent = 'OK';
    btn.setAttribute('style', [
      `position: fixed`,
      `left: ${btnLeft}px`,
      `top: ${btnTop}px`,
      `width: ${btnWidth}px`,
      `height: ${btnHeight}px`,
      `font-size: ${btnFontSize}px`,
      `font-family: 'Oxanium', sans-serif`,
      `font-weight: 700`,
      `letter-spacing: 2px`,
      `color: white`,
      `background: #4a6cf7`,
      `border: none`,
      `border-radius: ${8 * scaleY}px`,
      `cursor: pointer`,
      `z-index: 10000`,
      `padding: 0`,
      `margin: 0`,
      `touch-action: manipulation`,
      `-webkit-tap-highlight-color: transparent`,
    ].join('; '));

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submitName();
    });

    document.body.appendChild(btn);
    this.htmlButton = btn;

    // Focus input with delay to let the DOM settle
    setTimeout(() => {
      input.focus({ preventScroll: true });
    }, 200);
  }

  private removeHtmlInput(): void {
    if (this.htmlInput) {
      this.htmlInput.remove();
      this.htmlInput = null;
    }
    if (this.htmlButton) {
      this.htmlButton.remove();
      this.htmlButton = null;
    }
  }

  private removeNameInputGroup(): void {
    this.removeHtmlInput();
    if (this.nameInputGroup) {
      this.container.removeChild(this.nameInputGroup);
      this.nameInputGroup.destroy({ children: true });
      this.nameInputGroup = null;
    }
  }

  private async submitName(): Promise<void> {
    if (this.nameSubmitted) return;
    this.nameSubmitted = true;

    const name = this.htmlInput?.value || '';

    // Remove the entire name input area (HTML input + PixiJS group)
    this.removeNameInputGroup();

    // Submit score
    this.rank = await this.leaderboard.submit(this.score, name);

    // Rebuild leaderboard with updated entries and rank highlight
    if (this.leaderboardContainer) {
      this.container.removeChild(this.leaderboardContainer);
      this.leaderboardContainer.destroy({ children: true });
      this.leaderboardContainer = null;
    }
    this.buildLeaderboard();
  }

  // ── Play again button ──

  private buildPlayAgainButton(): void {
    const btnW = 200;
    const btnH = 50;
    const btnX = this.width / 2 - btnW / 2;
    const btnY = this.height * 0.85;

    // Play Again button
    const btn = new Graphics();
    btn.roundRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4, 14);
    btn.fill({ color: THEME.accent, alpha: 0.12 });
    btn.roundRect(btnX, btnY, btnW, btnH, 12);
    btn.fill({ color: THEME.btnPrimary });
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

    // Menu button
    const menuBtnY = btnY + btnH + 12;
    const menuBtnW = 200;
    const menuBtnH = 44;
    const menuBtnX = this.width / 2 - menuBtnW / 2;

    const menuBtn = new Graphics();
    menuBtn.roundRect(menuBtnX, menuBtnY, menuBtnW, menuBtnH, 10);
    menuBtn.fill({ color: 0x4a4a6a });
    menuBtn.roundRect(menuBtnX + 1, menuBtnY + 1, menuBtnW - 2, menuBtnH * 0.45, 9);
    menuBtn.fill({ color: 0xffffff, alpha: 0.06 });
    this.container.addChild(menuBtn);

    const menuText = new Text({
      text: 'MENU',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 16,
        fontWeight: '700',
        fill: THEME.textSecondary,
        letterSpacing: 4,
      }),
    });
    menuText.anchor.set(0.5);
    menuText.x = this.width / 2;
    menuText.y = menuBtnY + menuBtnH / 2;
    this.container.addChild(menuText);

    menuBtn.eventMode = 'static';
    menuBtn.cursor = 'pointer';
    menuBtn.on('pointerdown', () => this.onMenu());
    menuText.eventMode = 'static';
    menuText.cursor = 'pointer';
    menuText.on('pointerdown', () => this.onMenu());
  }

  // ── Leaderboard display ──

  private buildLeaderboard(): void {
    const entries = this.leaderboard.getEntries();
    const lbContainer = new Container();
    this.leaderboardContainer = lbContainer;
    this.container.addChild(lbContainer);

    if (entries.length === 0) return;

    // Position leaderboard below the name input area if it exists, otherwise higher
    const startY = this.nameInputGroup
      ? this.height * 0.39
      : this.height * 0.28;

    const headerText = new Text({
      text: `LEADERBOARD — ${DIFFICULTY_LABELS[this.difficulty]}`,
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

  // ── Scene lifecycle ──

  update(_dt: number): void {}

  enter(): void {}

  exit(): void {
    this.removeHtmlInput();
    this.container.removeAllListeners();
  }
}
