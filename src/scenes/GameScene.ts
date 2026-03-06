import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Scene } from './SceneManager';
import { GameState } from '../core/GameState';
import { LayoutManager } from '../rendering/LayoutManager';
import { GridRenderer } from '../rendering/GridRenderer';
import { PieceRenderer } from '../rendering/PieceRenderer';
import { GhostRenderer } from '../rendering/GhostRenderer';
import { UIRenderer } from '../rendering/UIRenderer';
import { AnimationManager } from '../rendering/AnimationManager';
import { FXManager } from '../rendering/FXManager';
import { DragController, DragState } from '../input/DragController';
import { AudioManager } from '../audio/AudioManager';
import { AdaptiveTuning } from '../core/AdaptiveProgression';
import { FeedbackEvent, RunSummary } from '../core/types';
import { Difficulty, GameConfig } from '../core/Config';
import { getProgressStatus } from '../core/Progression';
import { FONT_DISPLAY, THEME } from '../rendering/Theme';

type CountdownPhase = 'countdown' | 'playing' | 'gameOver';

export class GameScene implements Scene {
  container: Container;
  private gameContent: Container; // wrapper for shake/zoom
  private gameState: GameState;
  private layoutManager: LayoutManager;
  private gridRenderer: GridRenderer;
  private pieceRenderer: PieceRenderer;
  private ghostRenderer: GhostRenderer;
  private uiRenderer: UIRenderer;
  private animationManager: AnimationManager;
  private fxManager: FXManager;
  private dragController: DragController;
  private audioManager: AudioManager;
  private canvas: HTMLCanvasElement;
  private onGameOver: (summary: RunSummary) => void;
  private onQuit: () => void;
  private bgColorSetter: ((color: number) => void) | null = null;

  // Pause state
  private paused = false;
  private pauseOverlay: Container | null = null;
  private pauseBtn: Container | null = null;

  // Countdown state
  private countdownPhase: CountdownPhase = 'countdown';
  private countdownTime = 3;
  private countdownText: Text | null = null;
  private lastCountdownNumber = 4;

  // Critical time alerts
  private alertsFired = { ten: false, five: false, last: false };
  private lastTickSecond = -1;
  private progressTierIndex = 0;

  // Game over sequence
  private gameOverSequenceActive = false;
  private gameOverElapsed = 0;

  constructor(
    canvas: HTMLCanvasElement,
    layoutManager: LayoutManager,
    audioManager: AudioManager,
    config: GameConfig,
    difficulty: Difficulty,
    adaptiveTuning: AdaptiveTuning,
    onGameOver: (summary: RunSummary) => void,
    onQuit: () => void,
    bgColorSetter?: (color: number) => void,
  ) {
    this.canvas = canvas;
    this.layoutManager = layoutManager;
    this.audioManager = audioManager;
    this.onGameOver = onGameOver;
    this.onQuit = onQuit;
    this.bgColorSetter = bgColorSetter || null;
    this.container = new Container();

    this.gameState = new GameState(config, difficulty, adaptiveTuning);
    this.gridRenderer = new GridRenderer();
    this.pieceRenderer = new PieceRenderer();
    this.ghostRenderer = new GhostRenderer();
    this.uiRenderer = new UIRenderer();
    this.animationManager = new AnimationManager();
    this.fxManager = new FXManager();
    this.dragController = new DragController(layoutManager, this.gameState.board);

    // Container hierarchy:
    // container
    //   fxManager.bgContainer       ← background particles
    //   gameContent                  ← wrapper for shake/zoom
    //     gridRenderer.container
    //     ghostRenderer.container
    //     pieceRenderer.container
    //     uiRenderer.container
    //     animationManager.container
    //   fxManager.fgContainer       ← vignette, screen flash
    //   pauseBtn / pauseOverlay

    this.gameContent = new Container();
    this.container.addChild(this.fxManager.bgContainer);
    this.gameContent.addChild(this.gridRenderer.container);
    this.gameContent.addChild(this.ghostRenderer.container);
    this.gameContent.addChild(this.pieceRenderer.container);
    this.gameContent.addChild(this.uiRenderer.container);
    this.gameContent.addChild(this.animationManager.container);
    this.container.addChild(this.gameContent);
    this.container.addChild(this.fxManager.fgContainer);

    this.fxManager.setShakeTarget(this.gameContent);
    if (this.bgColorSetter) {
      this.fxManager.setBgColorSetter(this.bgColorSetter);
    }

    this.setupDragCallbacks();
  }

  enter(): void {
    const layout = this.layoutManager.layout;
    this.gridRenderer.setLayout(layout);
    this.pieceRenderer.setLayout(layout);
    this.ghostRenderer.setLayout(layout);
    this.uiRenderer.setLayout(layout);
    this.animationManager.setLayout(layout);
    this.fxManager.setLayout(layout);

    this.buildPauseButton(layout.width);

    // Start game (but don't tick timer until countdown finishes)
    this.gameState.start();
    this.dragController.updatePieces(this.gameState.activePieces);
    this.dragController.updateBoard(this.gameState.board);

    // Initial render
    this.gridRenderer.drawBlocks(this.gameState.board.grid);
    this.pieceRenderer.drawTray(this.gameState.activePieces);
    this.uiRenderer.updateScore(this.gameState.score);
    this.uiRenderer.updateHighScore(this.gameState.highScore);
    this.uiRenderer.updateStreak(this.gameState.streakCount);
    this.updateProgressPresentation(false);

    // Start countdown
    this.countdownPhase = 'countdown';
    this.countdownTime = 3;
    this.lastCountdownNumber = 4;
    this.alertsFired = { ten: false, five: false, last: false };
    this.lastTickSecond = -1;
    this.progressTierIndex = getProgressStatus(this.gameState.difficulty, this.gameState.score).tierIndex;
    this.gameOverSequenceActive = false;
    this.gameOverElapsed = 0;

    // Disable drag during countdown
    this.dragController.detach(this.canvas);
  }

  exit(): void {
    this.dragController.detach(this.canvas);
    this.audioManager.stopPulse();
    if (this.countdownText) {
      this.container.removeChild(this.countdownText);
      this.countdownText.destroy();
      this.countdownText = null;
    }
  }

  resize(width: number, height: number): void {
    const layout = this.layoutManager.recalculate(width, height);
    this.gridRenderer.setLayout(layout);
    this.pieceRenderer.setLayout(layout);
    this.ghostRenderer.setLayout(layout);
    this.uiRenderer.setLayout(layout);
    this.animationManager.setLayout(layout);
    this.fxManager.setLayout(layout);
    this.gridRenderer.drawBlocks(this.gameState.board.grid);
    this.pieceRenderer.drawTray(this.gameState.activePieces);
  }

  update(dt: number): void {
    if (this.paused) return;

    // Game over sequence
    if (this.gameOverSequenceActive) {
      this.updateGameOverSequence(dt);
      this.fxManager.update(dt, this.gameState.drainRate, this.gameState.gameElapsed);
      this.animationManager.update(this.fxManager.getAnimationDt(dt));
      return;
    }

    // Countdown phase
    if (this.countdownPhase === 'countdown') {
      this.updateCountdown(dt);
      this.fxManager.update(dt, 1, 0);
      return;
    }

    // Normal gameplay
    const animDt = this.fxManager.getAnimationDt(dt);
    this.animationManager.update(animDt);

    // Tick the timer down
    const timeUp = this.gameState.tick(dt);
    if (timeUp) {
      this.startGameOverSequence();
      return;
    }

    // FX manager update
    this.fxManager.update(dt, this.gameState.drainRate, this.gameState.gameElapsed);

    // Update timer bar
    this.uiRenderer.updateTimer(this.gameState.timeRemaining, this.gameState.maxTime, dt);

    // Update speed-time bar
    this.uiRenderer.updateSpeedBar(
      this.gameState.currentSpeedFraction,
      this.gameState.config.timer.speedWindowSeconds,
      this.gameState.pieceElapsed,
    );

    // Background pulse audio
    this.audioManager.updatePulse(this.gameState.drainRate);

    // Countdown ticks
    this.updateCountdownTicks();

    // Critical time alerts
    this.updateCriticalAlerts();

    // Grid border heartbeat
    this.gridRenderer.updateGlow(dt, this.gameState.timeRemaining);

    // Placement flash (must run every frame to decay)
    this.gridRenderer.updateFlash(dt);

    // Near-miss highlight
    this.gridRenderer.updateNearMiss(this.gameState.board);

    // Haptic heartbeat for low time
    if (this.gameState.timeRemaining <= 10) {
      const sec = Math.ceil(this.gameState.timeRemaining);
      if (sec !== this.lastTickSecond && sec > 0) {
        this.haptic([20, 100, 20]);
      }
    }
  }

  // ── Countdown ──

  private updateCountdown(dt: number): void {
    this.countdownTime -= dt;
    const currentNum = Math.ceil(this.countdownTime);

    if (currentNum !== this.lastCountdownNumber && currentNum > 0) {
      this.lastCountdownNumber = currentNum;
      this.showCountdownNumber(String(currentNum));
      this.audioManager.playTick();
    }

    if (this.countdownTime <= 0) {
      // Show "GO!"
      this.showCountdownNumber('GO!', true);
      this.audioManager.playGoChime();
      this.fxManager.triggerFlash(0.3, 6);

      this.countdownPhase = 'playing';
      this.dragController.attach(this.canvas);
      this.audioManager.startPulse(this.gameState.drainRate);
    }
  }

  private showCountdownNumber(text: string, isGo = false): void {
    if (this.countdownText) {
      this.container.removeChild(this.countdownText);
      this.countdownText.destroy();
    }
    const layout = this.layoutManager.layout;
    this.countdownText = new Text({
      text,
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 64,
        fontWeight: '800',
        fill: isGo ? THEME.gold : THEME.textPrimary,
        letterSpacing: 8,
        dropShadow: {
          alpha: 0.7,
          blur: 16,
          color: isGo ? THEME.gold : 0x3b82f6,
          distance: 0,
        },
      }),
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.x = layout.width / 2;
    this.countdownText.y = layout.height / 2 - 30;
    this.container.addChild(this.countdownText);

    // Animate: scale in and fade out
    const startTime = performance.now();
    const animate = () => {
      if (!this.countdownText) return;
      const elapsed = performance.now() - startTime;
      const t = elapsed / 800;
      if (t >= 1) {
        if (this.countdownText.parent) {
          this.container.removeChild(this.countdownText);
          this.countdownText.destroy();
          this.countdownText = null;
        }
        return;
      }
      const scale = 1 + 0.3 * (1 - t);
      this.countdownText.scale.set(scale);
      this.countdownText.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ── Countdown ticks ──

  private updateCountdownTicks(): void {
    const time = this.gameState.timeRemaining;
    if (time > 10) return;
    const sec = Math.ceil(time);
    if (sec === this.lastTickSecond || sec <= 0) return;
    this.lastTickSecond = sec;

    if (time <= 3) {
      // Triple tick
      this.audioManager.playTick();
      setTimeout(() => this.audioManager.playTick(), 80);
      setTimeout(() => this.audioManager.playTick(), 160);
    } else if (time <= 5) {
      // Double tick
      this.audioManager.playTick();
      setTimeout(() => this.audioManager.playTick(), 100);
    } else {
      // Single tick
      this.audioManager.playTick();
    }
  }

  // ── Critical alerts ──

  private updateCriticalAlerts(): void {
    const time = this.gameState.timeRemaining;
    if (time <= 10 && time > 9.5 && !this.alertsFired.ten) {
      this.alertsFired.ten = true;
      this.showCenterAlert('10 SECONDS!');
      this.audioManager.playAlertChime();
    }
    if (time <= 5 && time > 4.5 && !this.alertsFired.five) {
      this.alertsFired.five = true;
      this.showCenterAlert('5 SECONDS!');
      this.audioManager.playAlertChime();
    }
    if (time <= 3 && time > 2.5 && !this.alertsFired.last) {
      this.alertsFired.last = true;
      this.showCenterAlert('LAST CHANCE!');
      this.audioManager.playAlertChime();
      this.fxManager.triggerShake(3, 0.2);
    }
  }

  private showCenterAlert(text: string): void {
    this.animationManager.showCenterAlert(text);
  }

  // ── Game over sequence ──

  private startGameOverSequence(): void {
    this.gameOverSequenceActive = true;
    this.gameOverElapsed = 0;
    this.countdownPhase = 'gameOver';
    this.dragController.detach(this.canvas);
    this.audioManager.stopPulse();
    this.audioManager.playGameOver();

    // Flash
    this.fxManager.triggerFlash(0.6, 3);
    // Big shake
    this.fxManager.triggerShake(12, 0.4);
    // Slow-motion
    this.fxManager.triggerImpactFrame(0.2, 0.5);

    // Explosion particles from grid center
    const layout = this.layoutManager.layout;
    const cx = layout.gridOriginX + layout.gridSize / 2;
    const cy = layout.gridOriginY + layout.gridSize / 2;
    this.animationManager.spawnExplosion(cx, cy, 50);

    // Haptic
    this.haptic([50, 30, 80, 30, 120]);
  }

  private updateGameOverSequence(dt: number): void {
    this.gameOverElapsed += dt;
    if (this.gameOverElapsed >= 1.2) {
      this.gameOverSequenceActive = false;
      this.onGameOver(this.gameState.buildRunSummary());
    }
  }

  // ── Haptic feedback ──

  private haptic(pattern: number | number[]): void {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // ── Pause button ──

  private buildPauseButton(_screenW: number): void {
    const btn = new Container();
    const size = 36;
    const x = 10;
    const y = 38;

    const bg = new Graphics();
    bg.roundRect(x, y, size, size, 8);
    bg.fill({ color: 0x000000, alpha: 0.25 });
    btn.addChild(bg);

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
    this.dragController.detach(this.canvas);
    this.audioManager.stopPulse();
    this.buildPauseOverlay();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.dragController.attach(this.canvas);
    if (this.countdownPhase === 'playing') {
      this.audioManager.startPulse(this.gameState.drainRate);
    }
    this.removePauseOverlay();
  }

  private quit(): void {
    this.removePauseOverlay();
    this.audioManager.stopPulse();
    if (this.gameState.score > 0) {
      this.onGameOver(this.gameState.buildRunSummary('quit'));
    } else {
      this.onQuit();
    }
  }

  private buildPauseOverlay(): void {
    const layout = this.layoutManager.layout;
    const overlay = new Container();

    const bg = new Graphics();
    bg.rect(0, 0, layout.width, layout.height);
    bg.fill({ color: 0x0a0e20, alpha: 0.85 });
    bg.eventMode = 'static';
    bg.on('pointerdown', (e) => e.stopPropagation());
    overlay.addChild(bg);

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

    const resumeBtnY = layout.height * 0.48;
    this.addOverlayButton(overlay, 'RESUME', layout.width / 2, resumeBtnY, THEME.btnPrimary, () => this.resume());

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
      this.pieceRenderer.recordDragPosition(state.pointerX, state.pointerY);
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
      this.pieceRenderer.clearDragTrail();
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
      this.pieceRenderer.clearDragTrail();
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

  // ── Time bonus popup ──

  private showTimeBonusPopup(timeBonus: number, big: boolean = false): void {
    if (timeBonus <= 0) return;
    const label = `+${timeBonus.toFixed(1)}s`;
    if (big) {
      this.animationManager.showStreakPopup(0, label);
    } else {
      const layout = this.layoutManager.layout;
      this.animationManager.showTimeBonusPopup(
        label,
        layout.gridOriginX + layout.gridSize / 2,
        layout.gridOriginY - 20,
      );
    }
  }

  // ── Feedback processing ──

  private processFeedback(events: FeedbackEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'place': {
          this.audioManager.playPlace();
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.haptic(10);

          // Placement flash
          if (event.placedCells) {
            this.gridRenderer.flashCells(event.placedCells);
          }

          // Speed-based effects
          if (event.speedFraction !== undefined && event.speedFraction >= 0.8) {
            this.audioManager.playWhoosh();
            // Speed lines from placement center
            if (event.placedCells && event.placedCells.length > 0) {
              const layout = this.layoutManager.layout;
              let cx = 0, cy = 0;
              for (const cell of event.placedCells) {
                cx += layout.gridOriginX + cell.col * layout.cellSize + layout.cellSize / 2;
                cy += layout.gridOriginY + cell.row * layout.cellSize + layout.cellSize / 2;
              }
              cx /= event.placedCells.length;
              cy /= event.placedCells.length;
              this.animationManager.spawnSpeedLines(cx, cy);
            }
          }

          // Speed lines at lower threshold during flow state
          if (this.fxManager.currentFlowIntensity >= 0.35 && event.speedFraction !== undefined && event.speedFraction >= 0.5) {
            if (event.placedCells && event.placedCells.length > 0) {
              const layout = this.layoutManager.layout;
              let cx = 0, cy = 0;
              for (const cell of event.placedCells) {
                cx += layout.gridOriginX + cell.col * layout.cellSize + layout.cellSize / 2;
                cy += layout.gridOriginY + cell.row * layout.cellSize + layout.cellSize / 2;
              }
              cx /= event.placedCells.length;
              cy /= event.placedCells.length;
              this.animationManager.spawnSpeedLines(cx, cy, 6);
            }
          }

          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus);
          }

          // Update score display (placement points)
          this.updateProgressPresentation(true);

          // Streak broken
          if (event.streakBroken) {
            this.audioManager.playStreakBreak();
          }

          // Update flow state
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'clear': {
          this.audioManager.playClear();
          this.audioManager.playSubBass();
          this.haptic(30);

          // Shake: 1-line clear
          this.fxManager.triggerShake(2, 0.08);
          this.fxManager.triggerImpactFrame(0.1, 0.05);

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
          }
          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus, true);
          }
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.updateProgressPresentation(true);
          this.uiRenderer.updateStreak(this.gameState.streakCount);
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'combo': {
          this.audioManager.playCombo(this.gameState.streakCount);
          this.audioManager.playSubBass();
          this.haptic(50);

          // Shake: 2+ lines
          const lines = event.clearResult?.totalLinesCleared ?? 0;
          this.fxManager.triggerShake(lines >= 3 ? 6 : 4, 0.12);
          this.fxManager.triggerImpactFrame(0.1, 0.05);

          // Reverb tail for streak >= 3
          if (this.gameState.streakCount >= 3) {
            this.audioManager.playComboReverb(this.gameState.streakCount);
          }

          // Zoom pulse on 3+ line clears
          if (lines >= 3) {
            const layout = this.layoutManager.layout;
            this.fxManager.triggerZoomPulse(
              this.gameContent,
              layout.gridOriginX + layout.gridSize / 2,
              layout.gridOriginY + layout.gridSize / 2,
            );
          }

          if (event.clearResult) {
            this.animationManager.spawnClearEffect(
              event.clearResult.cellsCleared,
              0xF1C40F,
            );
            // Secondary burst wave for combos at 100ms delay
            setTimeout(() => {
              if (event.clearResult) {
                this.animationManager.spawnClearEffect(
                  event.clearResult.cellsCleared,
                  0xfbbf24,
                );
              }
            }, 100);
          }
          if (event.scoreBreakdown) {
            const layout = this.layoutManager.layout;
            this.animationManager.showScorePopup(
              event.scoreBreakdown.turnScore,
              layout.width / 2,
              layout.gridOriginY + layout.gridSize / 2,
              true,
            );
          }
          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus, true);
          }
          this.animationManager.showStreakPopup(this.gameState.streakCount);
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.updateProgressPresentation(true);
          this.uiRenderer.updateStreak(this.gameState.streakCount);
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'boardClear': {
          // Big shake + flash
          this.fxManager.triggerShake(8, 0.2);
          this.fxManager.triggerFlash(0.5, 5);
          this.haptic([50, 30, 80, 30, 120]);

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
        }

        case 'newBatch':
          this.pieceRenderer.drawTray(this.gameState.activePieces);
          break;

        case 'gameOver':
          this.startGameOverSequence();
          break;
      }
    }
  }

  private updateProgressPresentation(announceTier: boolean): void {
    this.uiRenderer.updateScore(this.gameState.score);
    this.uiRenderer.updateProgress(this.gameState.difficulty, this.gameState.score);

    const status = getProgressStatus(this.gameState.difficulty, this.gameState.score);
    if (announceTier && status.tierIndex > this.progressTierIndex) {
      this.showCenterAlert(`${status.current.label} TIER`);
      this.audioManager.playAlertChime();
    }
    this.progressTierIndex = status.tierIndex;
  }
}
