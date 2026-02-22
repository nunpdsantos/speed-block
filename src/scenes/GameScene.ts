import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { GameState } from '../core/GameState';
import { LayoutManager } from '../rendering/LayoutManager';
import { GridRenderer } from '../rendering/GridRenderer';
import { PieceRenderer } from '../rendering/PieceRenderer';
import { GhostRenderer } from '../rendering/GhostRenderer';
import { UIRenderer } from '../rendering/UIRenderer';
import { AnimationManager } from '../rendering/AnimationManager';
import { DragController, DragState } from '../input/DragController';
import { AudioManager } from '../audio/AudioManager';
import { FeedbackEvent } from '../core/types';
import { FONT_DISPLAY, THEME } from '../rendering/Theme';

export class GameScene implements Scene {
  container: Container;
  private gameState: GameState;
  private layoutManager: LayoutManager;
  private gridRenderer: GridRenderer;
  private pieceRenderer: PieceRenderer;
  private ghostRenderer: GhostRenderer;
  private uiRenderer: UIRenderer;
  private animationManager: AnimationManager;
  private dragController: DragController;
  private audioManager: AudioManager;
  private canvas: HTMLCanvasElement;
  private onGameOver: (score: number) => void;
  private onQuit: () => void;

  // Pause state
  private paused = false;
  private pauseStartTime = 0;
  private pauseOverlay: Container | null = null;
  private pauseBtn: Container | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    layoutManager: LayoutManager,
    audioManager: AudioManager,
    onGameOver: (score: number) => void,
    onQuit: () => void,
  ) {
    this.canvas = canvas;
    this.layoutManager = layoutManager;
    this.audioManager = audioManager;
    this.onGameOver = onGameOver;
    this.onQuit = onQuit;
    this.container = new Container();

    this.gameState = new GameState();
    this.gridRenderer = new GridRenderer();
    this.pieceRenderer = new PieceRenderer();
    this.ghostRenderer = new GhostRenderer();
    this.uiRenderer = new UIRenderer();
    this.animationManager = new AnimationManager();
    this.dragController = new DragController(layoutManager, this.gameState.board);

    // Layer order matters
    this.container.addChild(this.gridRenderer.container);
    this.container.addChild(this.ghostRenderer.container);
    this.container.addChild(this.pieceRenderer.container);
    this.container.addChild(this.uiRenderer.container);
    this.container.addChild(this.animationManager.container);

    this.setupDragCallbacks();
  }

  enter(): void {
    const layout = this.layoutManager.layout;
    this.gridRenderer.setLayout(layout);
    this.pieceRenderer.setLayout(layout);
    this.ghostRenderer.setLayout(layout);
    this.uiRenderer.setLayout(layout);
    this.animationManager.setLayout(layout);

    this.dragController.attach(this.canvas);
    this.buildPauseButton(layout.width);

    // Start game
    this.gameState.start();
    this.dragController.updatePieces(this.gameState.activePieces);
    this.dragController.updateBoard(this.gameState.board);

    // Initial render
    this.gridRenderer.drawBlocks(this.gameState.board.grid);
    this.pieceRenderer.drawTray(this.gameState.activePieces);
    this.uiRenderer.updateScore(this.gameState.score);
    this.uiRenderer.updateHighScore(this.gameState.highScore);
    this.uiRenderer.updateStreak(this.gameState.streakCount);
  }

  exit(): void {
    this.dragController.detach(this.canvas);
  }

  resize(width: number, height: number): void {
    const layout = this.layoutManager.recalculate(width, height);
    this.gridRenderer.setLayout(layout);
    this.pieceRenderer.setLayout(layout);
    this.ghostRenderer.setLayout(layout);
    this.uiRenderer.setLayout(layout);
    this.animationManager.setLayout(layout);
    this.gridRenderer.drawBlocks(this.gameState.board.grid);
    this.pieceRenderer.drawTray(this.gameState.activePieces);
  }

  update(dt: number): void {
    if (this.paused) return;
    this.animationManager.update(dt);
    this.uiRenderer.updateSpeedMultiplier(this.gameState.speedMultiplier, this.gameState.speedStreak);
  }

  // ── Pause button ──

  private buildPauseButton(screenW: number): void {
    const btn = new Container();
    const size = 36;
    const x = 10;
    const y = 38;

    const bg = new Graphics();
    bg.roundRect(x, y, size, size, 8);
    bg.fill({ color: 0x000000, alpha: 0.25 });
    btn.addChild(bg);

    // Pause icon (two vertical bars)
    const icon = new Graphics();
    const barW = 4;
    const barH = 16;
    const gap = 6;
    const cx = x + size / 2;
    const cy = y + size / 2;
    icon.rect(cx - gap / 2 - barW, cy - barH / 2, barW, barH);
    icon.fill({ color: THEME.textPrimary });
    icon.rect(cx + gap / 2, cy - barH / 2, barW, barH);
    icon.fill({ color: THEME.textPrimary });
    btn.addChild(icon);

    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.on('pointerdown', (e) => {
      e.stopPropagation();
      this.pause();
    });

    this.pauseBtn = btn;
    this.container.addChild(btn);
  }

  // ── Pause / Resume / Quit ──

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseStartTime = Date.now();
    this.dragController.detach(this.canvas);
    this.buildPauseOverlay();
  }

  private resume(): void {
    if (!this.paused) return;
    // Compensate speed timers for paused duration
    const pausedMs = Date.now() - this.pauseStartTime;
    this.gameState.batchStartTime += pausedMs;
    this.gameState.lastPlaceTime += pausedMs;
    this.paused = false;
    this.dragController.attach(this.canvas);
    this.removePauseOverlay();
  }

  private quit(): void {
    this.removePauseOverlay();
    if (this.gameState.score > 0) {
      this.onGameOver(this.gameState.score);
    } else {
      this.onQuit();
    }
  }

  private buildPauseOverlay(): void {
    const layout = this.layoutManager.layout;
    const overlay = new Container();

    // Dimmed background
    const bg = new Graphics();
    bg.rect(0, 0, layout.width, layout.height);
    bg.fill({ color: 0x0a0e20, alpha: 0.85 });
    bg.eventMode = 'static';
    bg.on('pointerdown', (e) => e.stopPropagation());
    overlay.addChild(bg);

    // "PAUSED" title
    const title = new Text({
      text: 'PAUSED',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 36,
        fontWeight: '800',
        fill: THEME.textPrimary,
        letterSpacing: 8,
      }),
    });
    title.anchor.set(0.5);
    title.x = layout.width / 2;
    title.y = layout.height * 0.35;
    overlay.addChild(title);

    // Resume button
    const resumeBtnY = layout.height * 0.48;
    this.addOverlayButton(overlay, 'RESUME', layout.width / 2, resumeBtnY, THEME.btnPrimary, () => this.resume());

    // Quit button
    const quitBtnY = layout.height * 0.58;
    this.addOverlayButton(overlay, 'QUIT', layout.width / 2, quitBtnY, 0x4a4a6a, () => this.quit());

    this.pauseOverlay = overlay;
    this.container.addChild(overlay);
  }

  private addOverlayButton(
    parent: Container, label: string,
    cx: number, cy: number, color: number,
    onClick: () => void,
  ): void {
    const btnW = 180;
    const btnH = 48;
    const btnX = cx - btnW / 2;
    const btnY = cy - btnH / 2;

    const btn = new Graphics();
    btn.roundRect(btnX, btnY, btnW, btnH, 12);
    btn.fill({ color });
    btn.roundRect(btnX + 1, btnY + 1, btnW - 2, btnH * 0.45, 11);
    btn.fill({ color: 0xffffff, alpha: 0.1 });
    parent.addChild(btn);

    const text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: '700',
        fill: THEME.textPrimary,
        letterSpacing: 4,
      }),
    });
    text.anchor.set(0.5);
    text.x = cx;
    text.y = cy;
    parent.addChild(text);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => { e.stopPropagation(); onClick(); });
    text.eventMode = 'static';
    text.cursor = 'pointer';
    text.on('pointerdown', (e) => { e.stopPropagation(); onClick(); });
  }

  private removePauseOverlay(): void {
    if (this.pauseOverlay) {
      this.container.removeChild(this.pauseOverlay);
      this.pauseOverlay.destroy({ children: true });
      this.pauseOverlay = null;
    }
  }

  // ── Drag callbacks ──

  private setupDragCallbacks(): void {
    this.dragController.onDragStart = (state: DragState) => {
      this.pieceRenderer.showDragPiece(state.piece, state.pointerX, state.pointerY);
      if (state.gridPos) {
        this.ghostRenderer.show(
          state.piece.shape, state.gridPos.row, state.gridPos.col,
          state.piece.color, state.isValid,
        );
      }
      const tempPieces = [...this.gameState.activePieces];
      tempPieces[state.pieceIndex] = null;
      this.pieceRenderer.drawTray(tempPieces);
      this.pieceRenderer.hideSelection();
    };

    this.dragController.onDragMove = (state: DragState) => {
      this.pieceRenderer.showDragPiece(state.piece, state.pointerX, state.pointerY);
      if (state.gridPos) {
        this.ghostRenderer.show(
          state.piece.shape, state.gridPos.row, state.gridPos.col,
          state.piece.color, state.isValid,
        );
      } else {
        this.ghostRenderer.hide();
      }
    };

    this.dragController.onDragEnd = (state: DragState) => {
      this.pieceRenderer.hideDragPiece();
      this.ghostRenderer.hide();

      if (state.gridPos && state.isValid) {
        const events = this.gameState.tryPlace(
          state.pieceIndex,
          state.gridPos.row,
          state.gridPos.col,
        );
        this.processFeedback(events);
      }

      this.pieceRenderer.drawTray(this.gameState.activePieces);
      this.dragController.updatePieces(this.gameState.activePieces);
      this.dragController.updateBoard(this.gameState.board);
    };

    this.dragController.onDragCancel = () => {
      this.pieceRenderer.hideDragPiece();
      this.ghostRenderer.hide();
      this.pieceRenderer.drawTray(this.gameState.activePieces);
    };

    this.dragController.onSelect = (pieceIndex, _piece) => {
      this.pieceRenderer.hideSelection();
      this.pieceRenderer.showSelection(pieceIndex);
    };

    this.dragController.onDeselect = () => {
      this.pieceRenderer.hideSelection();
      this.ghostRenderer.hide();
    };

    this.dragController.onTapPlace = (pieceIndex, gridPos) => {
      this.pieceRenderer.hideSelection();
      this.ghostRenderer.hide();

      const events = this.gameState.tryPlace(pieceIndex, gridPos.row, gridPos.col);
      this.processFeedback(events);

      this.pieceRenderer.drawTray(this.gameState.activePieces);
      this.dragController.updatePieces(this.gameState.activePieces);
      this.dragController.updateBoard(this.gameState.board);
      this.dragController.deselect();
    };
  }

  private showSpeedPopup(speedMultiplier: number): void {
    if (speedMultiplier <= 1.05) return;
    const pct = Math.round((speedMultiplier - 1) * 100);
    let label: string;
    if (speedMultiplier >= 4.0) {
      label = `BLAZING +${pct}%`;
    } else if (speedMultiplier >= 2.5) {
      label = `LIGHTNING +${pct}%`;
    } else {
      label = `SPEED +${pct}%`;
    }
    this.animationManager.showStreakPopup(0, label);
  }

  // ── Feedback processing ──

  private processFeedback(events: FeedbackEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'place':
          this.audioManager.playPlace();
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          break;

        case 'clear':
          this.audioManager.playClear();
          if (event.clearResult) {
            this.animationManager.spawnClearEffect(
              event.clearResult.cellsCleared,
              0x4A90D9,
            );
          }
          if (event.scoreBreakdown) {
            const layout = this.layoutManager.layout;
            this.animationManager.showScorePopup(
              event.scoreBreakdown.turnScore,
              layout.width / 2,
              layout.gridOriginY + layout.gridSize / 2,
              false,
            );
            this.showSpeedPopup(event.scoreBreakdown.speedMultiplier);
          }
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.uiRenderer.updateScore(this.gameState.score);
          this.uiRenderer.updateStreak(this.gameState.streakCount);
          break;

        case 'combo':
          this.audioManager.playCombo(this.gameState.streakCount);
          if (event.clearResult) {
            this.animationManager.spawnClearEffect(
              event.clearResult.cellsCleared,
              0xF1C40F,
            );
          }
          if (event.scoreBreakdown) {
            const layout = this.layoutManager.layout;
            this.animationManager.showScorePopup(
              event.scoreBreakdown.turnScore,
              layout.width / 2,
              layout.gridOriginY + layout.gridSize / 2,
              true,
            );
            this.showSpeedPopup(event.scoreBreakdown.speedMultiplier);
          }
          this.animationManager.showStreakPopup(this.gameState.streakCount);
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.uiRenderer.updateScore(this.gameState.score);
          this.uiRenderer.updateStreak(this.gameState.streakCount);
          break;

        case 'boardClear':
          if (event.scoreBreakdown) {
            const layout = this.layoutManager.layout;
            this.animationManager.showScorePopup(
              event.scoreBreakdown.turnScore,
              layout.width / 2,
              layout.gridOriginY + layout.gridSize / 2 - 60,
              true,
            );
          }
          break;

        case 'newBatch':
          this.pieceRenderer.drawTray(this.gameState.activePieces);
          break;

        case 'gameOver':
          this.audioManager.playGameOver();
          setTimeout(() => {
            this.onGameOver(this.gameState.score);
          }, 800);
          break;
      }
    }
  }
}
