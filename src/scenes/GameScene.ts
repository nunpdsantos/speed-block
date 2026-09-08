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
import { FeedbackEvent, GridPos, PieceInstance, RunSummary } from '../core/types';
import { Difficulty, DIFFICULTY_LABELS, GameConfig } from '../core/Config';
import { getProgressStatus } from '../core/Progression';
import { loadSettings, updateSettings } from '../core/Settings';
import { FONT_DISPLAY, THEME, drawPanel } from '../rendering/Theme';
import { createButton, createToggle, createBodyText } from '../rendering/Widgets';

type Phase = 'tutorial' | 'countdown' | 'playing' | 'gameOver';

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

  // Tutorial overlay (first run only)
  private tutorialOverlay: Container | null = null;

  // Countdown state
  private phase: Phase = 'countdown';
  private countdownTime = 3;
  private countdownText: Text | null = null;
  private lastCountdownNumber = 4;

  // Critical time alerts
  private alertsFired = { ten: false, five: false, two: false };
  private lastTickSecond = -1;
  private lastHapticSecond = -1;
  private progressTierIndex = 0;
  private skipCountdown: boolean;
  private hapticsEnabled: boolean;

  // Game over sequence
  private gameOverSequenceActive = false;
  private gameOverElapsed = 0;

  // Bound DOM listeners (added in enter, removed in exit)
  private onVisibilityChange = () => {
    if (document.hidden && this.phase === 'playing' && !this.paused) {
      this.pause();
    }
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (this.phase !== 'playing') return;
      if (this.paused) this.resume();
      else this.pause();
    }
  };

  constructor(
    canvas: HTMLCanvasElement,
    layoutManager: LayoutManager,
    audioManager: AudioManager,
    config: GameConfig,
    difficulty: Difficulty,
    skipCountdown: boolean,
    onGameOver: (summary: RunSummary) => void,
    onQuit: () => void,
    bgColorSetter?: (color: number) => void,
  ) {
    this.canvas = canvas;
    this.layoutManager = layoutManager;
    this.audioManager = audioManager;
    this.onGameOver = onGameOver;
    this.onQuit = onQuit;
    this.skipCountdown = skipCountdown;
    this.bgColorSetter = bgColorSetter || null;
    this.container = new Container();
    this.hapticsEnabled = loadSettings().haptics;

    this.gameState = new GameState(config, difficulty);
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
    //   pauseBtn / pauseOverlay / tutorialOverlay

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
    this.fxManager.setDifficultyMood(difficulty);
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

    this.buildPauseButton();

    // Start game (but don't tick timer until countdown finishes)
    this.gameState.start();
    this.dragController.updatePieces(this.gameState.activePieces);
    this.dragController.updateBoard(this.gameState.board);

    // Initial render
    this.gridRenderer.drawBlocks(this.gameState.board.grid);
    this.pieceRenderer.drawTray(this.gameState.activePieces, true);
    this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
    this.uiRenderer.updateScore(this.gameState.score);
    this.uiRenderer.updateHighScore(this.gameState.highScore);
    this.uiRenderer.updateStreak(0);
    this.uiRenderer.updateTimer(this.gameState.timeRemaining, this.gameState.maxTime, 0);
    this.uiRenderer.updateSpeedBar(1, this.gameState.config.timer.speedWindowSeconds, 0);
    this.updateProgressPresentation(false);

    this.countdownTime = this.skipCountdown ? 0 : 3;
    this.lastCountdownNumber = 4;
    this.alertsFired = { ten: false, five: false, two: false };
    this.lastTickSecond = -1;
    this.lastHapticSecond = -1;
    this.progressTierIndex = getProgressStatus(this.gameState.difficulty, this.gameState.score).tierIndex;
    this.gameOverSequenceActive = false;
    this.gameOverElapsed = 0;

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('keydown', this.onKeyDown);

    if (!loadSettings().tutorialSeen) {
      this.phase = 'tutorial';
      this.dragController.detach(this.canvas);
      this.buildTutorialOverlay();
    } else if (this.skipCountdown) {
      this.beginPlay();
      this.fxManager.triggerFlash(0.16, 10);
      this.showCenterAlert(`${DIFFICULTY_LABELS[this.gameState.difficulty]} MODE`, THEME.accent, 22);
    } else {
      this.phase = 'countdown';
      this.dragController.detach(this.canvas);
    }
  }

  exit(): void {
    this.dragController.detach(this.canvas);
    this.audioManager.stopMusic();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.countdownText) {
      this.container.removeChild(this.countdownText);
      this.countdownText.destroy();
      this.countdownText = null;
    }
    this.removeTutorialOverlay();
    this.removePauseOverlay();
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
    this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
    this.updateProgressPresentation(false);
  }

  update(dt: number): void {
    if (this.paused) return;

    // Purely visual systems run in every phase
    const animDt = this.fxManager.getAnimationDt(dt);
    this.pieceRenderer.update(animDt);
    this.gridRenderer.update(animDt);
    this.uiRenderer.update(dt);

    // Game over sequence
    if (this.gameOverSequenceActive) {
      this.updateGameOverSequence(dt);
      this.fxManager.update(dt, this.gameState.drainRate, this.gameState.gameElapsed);
      this.animationManager.update(animDt);
      return;
    }

    if (this.phase === 'tutorial') {
      this.fxManager.update(dt, 1, 0);
      return;
    }

    // Countdown phase
    if (this.phase === 'countdown') {
      this.updateCountdown(dt);
      this.fxManager.update(dt, 1, 0);
      return;
    }

    // Normal gameplay
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

    // Music follows the game
    this.audioManager.updateMusic(
      this.gameState.drainRate,
      this.gameState.streakCount,
      this.gameState.timeRemaining / this.gameState.maxTime,
      this.fxManager.currentFlowIntensity,
    );

    // Countdown ticks
    this.updateCountdownTicks();

    // Critical time alerts
    this.updateCriticalAlerts();

    // Grid border heartbeat (time + board crowding)
    this.gridRenderer.updateGlow(dt, this.gameState.timeRemaining, this.gameState.boardFillFraction);

    // Near-miss highlight
    this.gridRenderer.updateNearMiss(this.gameState.board, dt);

    // Haptic heartbeat for low time
    if (this.gameState.timeRemaining <= 5) {
      const sec = Math.ceil(this.gameState.timeRemaining);
      if (sec !== this.lastHapticSecond && sec > 0) {
        this.lastHapticSecond = sec;
        this.haptic(16);
      }
    }
  }

  // ── Phase transitions ──

  private beginPlay(): void {
    this.phase = 'playing';
    this.dragController.attach(this.canvas);
    this.audioManager.startMusic();
  }

  // ── Tutorial (first run) ──

  private buildTutorialOverlay(): void {
    const layout = this.layoutManager.layout;
    const overlay = new Container();

    const bg = new Graphics();
    bg.rect(0, 0, layout.width, layout.height);
    bg.fill({ color: THEME.overlay, alpha: 0.82 });
    bg.eventMode = 'static';
    bg.on('pointerdown', (e) => e.stopPropagation());
    overlay.addChild(bg);

    const panelW = Math.min(340, layout.width - 32);
    const panelH = 330;
    const px = layout.width / 2 - panelW / 2;
    const py = layout.height / 2 - panelH / 2;
    const panel = new Graphics();
    drawPanel(panel, px, py, panelW, panelH, 18, 0.92);
    overlay.addChild(panel);

    const title = new Text({
      text: 'HOW TO PLAY',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 22,
        fontWeight: '800',
        fill: THEME.textPrimary,
        letterSpacing: 5,
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = layout.width / 2;
    title.y = py + 22;
    overlay.addChild(title);

    const steps = [
      ['1', 'DRAG a piece from the tray onto the board. Tap a piece, then tap the board, if you prefer.'],
      ['2', 'FILL a full row or column to clear it. Two at once is a combo, back-to-back clears build a streak.'],
      ['3', 'BE FAST. The clock drains constantly. Every placement adds time, and quick moves add more.'],
    ];
    let y = py + 64;
    for (const [n, body] of steps) {
      const badge = new Graphics();
      badge.circle(px + 30, y + 12, 12);
      badge.fill({ color: THEME.accent });
      overlay.addChild(badge);
      const num = new Text({
        text: n,
        style: new TextStyle({ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: '800', fill: THEME.textPrimary }),
      });
      num.anchor.set(0.5);
      num.x = px + 30;
      num.y = y + 12;
      overlay.addChild(num);
      const text = createBodyText(body, px + 52, y, {
        fontSize: 12.5,
        wrapWidth: panelW - 70,
        align: 'left',
        color: THEME.textSecondary,
      });
      overlay.addChild(text);
      y += 68;
    }

    overlay.addChild(createButton("LET'S GO", layout.width / 2, py + panelH - 40, () => {
      this.audioManager.unlock();
      this.audioManager.playUiClick();
      updateSettings({ tutorialSeen: true });
      this.removeTutorialOverlay();
      this.phase = 'countdown';
      this.countdownTime = 3;
      this.lastCountdownNumber = 4;
    }, { width: 180, height: 46, fontSize: 16 }));

    this.tutorialOverlay = overlay;
    this.container.addChild(overlay);
  }

  private removeTutorialOverlay(): void {
    if (this.tutorialOverlay) {
      this.container.removeChild(this.tutorialOverlay);
      this.tutorialOverlay.destroy({ children: true });
      this.tutorialOverlay = null;
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
      this.showCountdownNumber('GO!', true);
      this.audioManager.playGoChime();
      this.fxManager.triggerFlash(0.3, 6);
      this.beginPlay();
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
        fontSize: 72,
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
    this.countdownText.y = layout.gridOriginY + layout.gridSize / 2;
    this.container.addChild(this.countdownText);

    // Animate: scale in and fade out
    const startTime = performance.now();
    const target = this.countdownText;
    const animate = () => {
      if (this.countdownText !== target) return;
      const elapsed = performance.now() - startTime;
      const t = elapsed / 800;
      if (t >= 1) {
        if (target.parent) {
          this.container.removeChild(target);
          target.destroy();
          this.countdownText = null;
        }
        return;
      }
      const scale = 1 + 0.3 * (1 - t);
      target.scale.set(scale);
      target.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ── Countdown ticks ──

  private updateCountdownTicks(): void {
    const time = this.gameState.timeRemaining;
    if (time > 6) return;
    const sec = Math.ceil(time);
    if (sec === this.lastTickSecond || sec <= 0) return;
    this.lastTickSecond = sec;
    this.audioManager.playUrgentTick(sec);
  }

  // ── Critical alerts ──

  private updateCriticalAlerts(): void {
    const time = this.gameState.timeRemaining;
    if (time <= 10 && time > 9.5 && !this.alertsFired.ten) {
      this.alertsFired.ten = true;
      this.showCenterAlert('10 SECONDS', THEME.warning, 24);
    }
    if (time <= 5 && time > 4.5 && !this.alertsFired.five) {
      this.alertsFired.five = true;
      this.showCenterAlert('5 SECONDS!');
      this.audioManager.playAlertChime();
    }
    if (time <= 2 && time > 1.5 && !this.alertsFired.two) {
      this.alertsFired.two = true;
      this.showCenterAlert('2 SECONDS!');
      this.audioManager.playAlertChime();
      this.fxManager.triggerShake(3, 0.2);
    }
    // Reset alerts once the player has recovered so they can fire again later
    if (time > 12) {
      this.alertsFired = { ten: false, five: false, two: false };
    }
  }

  private showCenterAlert(text: string, color: number = THEME.danger, fontSize: number = 28): void {
    this.animationManager.showCenterAlert(text, color, fontSize);
  }

  // ── Game over sequence ──

  private startGameOverSequence(): void {
    this.gameOverSequenceActive = true;
    this.gameOverElapsed = 0;
    this.phase = 'gameOver';
    this.dragController.detach(this.canvas);
    this.audioManager.stopMusic();
    this.audioManager.playGameOver();
    this.ghostRenderer.hide();
    this.pieceRenderer.hideDragPiece();
    this.pieceRenderer.clearDragTrail();

    const cause = this.gameState.deathCause;
    this.showCenterAlert(cause === 'board_lock' ? 'NO MOVES LEFT' : "TIME'S UP", THEME.danger, 30);

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
    if (this.gameOverElapsed >= 1.1) {
      this.gameOverSequenceActive = false;
      this.onGameOver(this.gameState.buildRunSummary());
    }
  }

  // ── Haptic feedback ──

  private haptic(pattern: number | number[]): void {
    if (!this.hapticsEnabled) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch { /* unsupported */ }
    }
  }

  // ── Pause button ──

  private buildPauseButton(): void {
    if (this.pauseBtn) {
      this.container.removeChild(this.pauseBtn);
      this.pauseBtn.destroy({ children: true });
    }
    const layout = this.layoutManager.layout;
    const btn = new Container();
    const size = 34;
    const x = layout.gridOriginX + layout.gridSize - size;
    const y = 8;

    const bg = new Graphics();
    bg.roundRect(x, y, size, size, 9);
    bg.fill({ color: 0x000000, alpha: 0.3 });
    bg.roundRect(x, y, size, size, 9);
    bg.stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
    btn.addChild(bg);

    const icon = new Graphics();
    const barW = 4;
    const barH = 14;
    const gap = 5;
    const cx = x + size / 2;
    const cy = y + size / 2;
    icon.roundRect(cx - gap / 2 - barW, cy - barH / 2, barW, barH, 1.5);
    icon.fill({ color: THEME.textPrimary });
    icon.roundRect(cx + gap / 2, cy - barH / 2, barW, barH, 1.5);
    icon.fill({ color: THEME.textPrimary });
    btn.addChild(icon);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => {
      e.stopPropagation();
      if (this.phase === 'playing') this.pause();
    });

    this.pauseBtn = btn;
    this.container.addChild(btn);
  }

  // ── Pause / Resume / Quit ──

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.dragController.detach(this.canvas);
    this.pieceRenderer.hideDragPiece();
    this.pieceRenderer.clearDragTrail();
    this.ghostRenderer.hide();
    this.pieceRenderer.drawTray(this.gameState.activePieces);
    this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
    this.audioManager.stopMusic();
    this.buildPauseOverlay();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.removePauseOverlay();
    this.audioManager.unlock();
    if (this.phase === 'playing') {
      this.dragController.attach(this.canvas);
      this.audioManager.startMusic();
    }
  }

  private quit(): void {
    this.removePauseOverlay();
    this.paused = false;
    this.audioManager.stopMusic();
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
    bg.fill({ color: THEME.overlay, alpha: 0.86 });
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
    title.y = layout.height * 0.3;
    overlay.addChild(title);

    const sub = createBodyText(
      `${DIFFICULTY_LABELS[this.gameState.difficulty]} · ${this.gameState.score.toLocaleString()} PTS`,
      layout.width / 2,
      layout.height * 0.3 + 28,
      { fontSize: 12, color: THEME.textMuted },
    );
    overlay.addChild(sub);

    const cx = layout.width / 2;
    overlay.addChild(createButton('RESUME', cx, layout.height * 0.45, () => {
      this.audioManager.playUiClick();
      this.resume();
    }, { width: 200, height: 52 }));

    // Settings toggles
    const toggleY = layout.height * 0.56;
    overlay.addChild(createToggle('SOUND', cx - 66, toggleY, this.audioManager.isSfxEnabled, (v) => {
      this.audioManager.setSfxEnabled(v);
      this.audioManager.playUiClick();
      return v;
    }, 120));
    overlay.addChild(createToggle('MUSIC', cx + 66, toggleY, this.audioManager.isMusicEnabled, (v) => {
      this.audioManager.setMusicEnabled(v);
      this.audioManager.playUiClick();
      return v;
    }, 120));
    overlay.addChild(createToggle('HAPTICS', cx, toggleY + 42, this.hapticsEnabled, (v) => {
      this.hapticsEnabled = v;
      updateSettings({ haptics: v });
      this.audioManager.playUiClick();
      if (v) this.haptic(20);
      return v;
    }, 140));

    overlay.addChild(createButton('QUIT', cx, layout.height * 0.72, () => {
      this.audioManager.playUiClick();
      this.quit();
    }, { width: 200, height: 46, color: THEME.btnSecondary, glow: false, fontSize: 16 }));

    const hint = createBodyText('ESC or P also pauses on desktop', cx, layout.height * 0.72 + 40, {
      fontSize: 10,
      color: THEME.textMuted,
    });
    overlay.addChild(hint);

    this.pauseOverlay = overlay;
    this.container.addChild(overlay);
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
      this.pieceRenderer.beginDrag(state.piece, state.pointerX, state.pointerY);
      if (state.gridPos) {
        this.ghostRenderer.show(
          state.piece.shape, state.gridPos.row, state.gridPos.col,
          state.piece.color, state.isValid,
        );
      }
      const tempPieces = [...this.gameState.activePieces];
      tempPieces[state.pieceIndex] = null;
      this.pieceRenderer.drawTray(tempPieces);
      this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
      this.pieceRenderer.hideSelection();
      this.haptic(6);
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
        // Valid preview on release always places, wherever the finger is
        const events = this.gameState.tryPlace(
          state.pieceIndex,
          state.gridPos.row,
          state.gridPos.col,
        );
        this.processFeedback(events, state.piece, state.gridPos);
      } else if (state.inTrayZone) {
        // Dragged back to tray — cancel, return piece
      } else if (state.gridPos) {
        // Invalid drop: return piece to tray with rejection feedback
        this.handleInvalidPlacement(state.pieceIndex, state.piece, state.gridPos);
      }

      this.refreshTray();
    };

    this.dragController.onDragCancel = () => {
      this.pieceRenderer.hideDragPiece();
      this.pieceRenderer.clearDragTrail();
      this.ghostRenderer.hide();
      this.pieceRenderer.drawTray(this.gameState.activePieces);
      this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
    };

    this.dragController.onSelect = (pieceIndex, _piece) => {
      this.pieceRenderer.hideSelection();
      this.pieceRenderer.showSelection(pieceIndex);
      this.audioManager.playUiClick();
    };

    this.dragController.onDeselect = () => {
      this.pieceRenderer.hideSelection();
      this.ghostRenderer.hide();
    };

    this.dragController.onTapPlace = (pieceIndex, gridPos) => {
      const selectedPiece = this.gameState.activePieces[pieceIndex];
      this.pieceRenderer.hideSelection();
      this.ghostRenderer.hide();

      const events = this.gameState.tryPlace(pieceIndex, gridPos.row, gridPos.col);
      if (events.length > 0 && selectedPiece) {
        this.processFeedback(events, selectedPiece, gridPos);
      } else if (selectedPiece) {
        this.handleInvalidPlacement(pieceIndex, selectedPiece, gridPos);
      }

      this.refreshTray();
      this.dragController.deselect();
    };
  }

  /** Redraw tray (no intro animation) and sync input + dimming state */
  private refreshTray(): void {
    // A fresh batch was already drawn with animation by processFeedback; only
    // redraw when the tray still holds the current batch.
    if (!this.trayAnimatedThisTurn) {
      this.pieceRenderer.drawTray(this.gameState.activePieces);
    }
    this.trayAnimatedThisTurn = false;
    this.pieceRenderer.setUnplaceable(this.gameState.getUnplaceableMask());
    this.dragController.updatePieces(this.gameState.activePieces);
    this.dragController.updateBoard(this.gameState.board);
  }
  private trayAnimatedThisTurn = false;

  private handleInvalidPlacement(
    pieceIndex: number,
    piece: PieceInstance,
    gridPos: GridPos | null,
  ): void {
    this.audioManager.playInvalid();
    this.pieceRenderer.nudgeTraySlot(pieceIndex);
    if (gridPos) {
      this.ghostRenderer.flashRejected(piece.shape, gridPos.row, gridPos.col, piece.color);
    }
    this.fxManager.triggerShake(1.5, 0.08);
    this.haptic(12);
  }

  // ── Time bonus popup ──

  private showTimeBonusPopup(timeBonus: number, big: boolean = false): void {
    if (timeBonus <= 0) return;
    if (!big && timeBonus < 2.8) return;
    const label = `+${timeBonus.toFixed(1)}s`;
    if (big) {
      this.animationManager.showStreakPopup(0, label);
    } else {
      const layout = this.layoutManager.layout;
      this.animationManager.showTimeBonusPopup(
        label,
        layout.gridOriginX + 28,
        layout.gridOriginY - 30,
      );
    }
  }

  // ── Feedback processing ──

  private processFeedback(events: FeedbackEvent[], piece: PieceInstance, origin: GridPos): void {
    const layout = this.layoutManager.layout;
    const gridCenterX = layout.gridOriginX + layout.gridSize / 2;
    const gridCenterY = layout.gridOriginY + layout.gridSize / 2;

    for (const event of events) {
      switch (event.type) {
        case 'place': {
          this.audioManager.playPlace(this.gameState.streakCount, event.speedFraction ?? 1);
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.haptic(10);

          if (event.placedCells) {
            this.gridRenderer.popCells(event.placedCells, piece.color);
          }

          // Speed-based effects
          const fast = event.speedFraction !== undefined && event.speedFraction >= 0.8;
          const flowing = this.fxManager.currentFlowIntensity >= 0.35 &&
            event.speedFraction !== undefined && event.speedFraction >= 0.5;
          if ((fast || flowing) && event.placedCells && event.placedCells.length > 0) {
            if (fast) this.audioManager.playWhoosh();
            let cx = 0, cy = 0;
            for (const cell of event.placedCells) {
              cx += layout.gridOriginX + cell.col * layout.cellSize + layout.cellSize / 2;
              cy += layout.gridOriginY + cell.row * layout.cellSize + layout.cellSize / 2;
            }
            cx /= event.placedCells.length;
            cy /= event.placedCells.length;
            this.animationManager.spawnSpeedLines(cx, cy, fast ? 10 : 6);
          }

          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus);
          }

          // Update score display (placement points)
          this.updateProgressPresentation(true);

          // Streak broken
          if (event.streakBroken) {
            this.audioManager.playStreakBreak();
            this.showCenterAlert('STREAK LOST', THEME.textMuted, 18);
          }
          this.uiRenderer.updateStreak(
            this.gameState.streakCount,
            this.gameState.streakSafeMoves,
            this.gameState.config.scoring.comboWindowPlacements,
          );

          // Update flow state
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'clear': {
          const lines = event.clearResult?.totalLinesCleared ?? 1;
          this.audioManager.playClear(lines, this.gameState.streakCount);
          this.haptic(30);

          this.fxManager.triggerShake(2, 0.08);
          this.fxManager.triggerImpactFrame(0.1, 0.05);

          if (event.clearResult) {
            this.gridRenderer.animateClear(event.clearResult.cellsCleared, event.clearResult.cellColors, origin);
            this.animationManager.spawnClearEffect(event.clearResult.cellsCleared, 0x4A90D9);
          }
          if (event.scoreBreakdown) {
            this.animationManager.showScorePopup(event.scoreBreakdown.turnScore, layout.width / 2, gridCenterY, false);
          }
          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus, true);
          }
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.updateProgressPresentation(true);
          this.uiRenderer.updateStreak(
            this.gameState.streakCount,
            this.gameState.streakSafeMoves,
            this.gameState.config.scoring.comboWindowPlacements,
          );
          this.fxManager.boostFlow(0.22);
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'combo': {
          const lines = event.clearResult?.totalLinesCleared ?? 2;
          this.audioManager.playCombo(lines, this.gameState.streakCount);
          this.haptic(50);

          this.fxManager.triggerShake(lines >= 3 ? 6 : 4, 0.12);
          this.fxManager.triggerImpactFrame(0.1, 0.05);

          if (this.gameState.streakCount >= 3) {
            this.audioManager.playComboReverb(this.gameState.streakCount);
          }

          if (lines >= 3) {
            this.fxManager.triggerZoomPulse(this.gameContent, gridCenterX, gridCenterY);
          }

          if (event.clearResult) {
            this.gridRenderer.animateClear(event.clearResult.cellsCleared, event.clearResult.cellColors, origin);
            this.animationManager.spawnClearEffect(event.clearResult.cellsCleared, 0xF1C40F);
            const cells = event.clearResult.cellsCleared;
            setTimeout(() => {
              this.animationManager.spawnClearEffect(cells, 0xfbbf24);
            }, 100);
          }
          if (event.scoreBreakdown) {
            this.animationManager.showScorePopup(event.scoreBreakdown.turnScore, layout.width / 2, gridCenterY, true);
          }
          if (event.timeBonus) {
            this.showTimeBonusPopup(event.timeBonus, true);
          }
          this.animationManager.showStreakPopup(this.gameState.streakCount);
          this.gridRenderer.drawBlocks(this.gameState.board.grid);
          this.updateProgressPresentation(true);
          this.uiRenderer.updateStreak(
            this.gameState.streakCount,
            this.gameState.streakSafeMoves,
            this.gameState.config.scoring.comboWindowPlacements,
          );
          this.fxManager.boostFlow(0.42);
          this.fxManager.updateFlowState(this.gameState.streakCount);
          break;
        }

        case 'boardClear': {
          this.audioManager.playBoardClear();
          this.fxManager.triggerShake(8, 0.2);
          this.fxManager.triggerFlash(0.5, 5);
          this.fxManager.boostFlow(0.72);
          this.haptic([50, 30, 80, 30, 120]);

          this.animationManager.showCenterAlert('BOARD CLEAR', THEME.gold, 30);
          this.fxManager.triggerZoomPulse(this.gameContent, gridCenterX, gridCenterY);
          this.animationManager.spawnExplosion(gridCenterX, gridCenterY, 26);

          if (event.scoreBreakdown) {
            this.animationManager.showScorePopup(event.scoreBreakdown.turnScore, layout.width / 2, gridCenterY - 60, true);
          }
          break;
        }

        case 'newBest': {
          this.audioManager.playNewBest();
          this.uiRenderer.markNewBest(this.gameState.score);
          this.showCenterAlert('NEW BEST!', THEME.gold, 30);
          this.fxManager.triggerFlash(0.25, 6);
          this.fxManager.boostFlow(0.5);
          this.animationManager.spawnExplosion(gridCenterX, gridCenterY - 40, 20);
          this.haptic([30, 40, 60]);
          break;
        }

        case 'newBatch':
          this.pieceRenderer.drawTray(this.gameState.activePieces, true);
          this.trayAnimatedThisTurn = true;
          break;

        case 'newPieceIntroduced': {
          const names = event.newPieceNames ?? [];
          const label = names.length > 1 ? 'NEW PIECES' : `NEW: ${names[0] ?? 'PIECE'}`;
          this.showCenterAlert(label, THEME.accent, 24);
          this.audioManager.playTierUp();
          this.fxManager.triggerFlash(0.15, 6);
          if (event.graceSeconds) {
            this.animationManager.showTimeBonusPopup(
              `+${event.graceSeconds.toFixed(0)}s`,
              layout.gridOriginX + 28,
              layout.gridOriginY - 30,
            );
          }
          break;
        }

        case 'gameOver':
          this.startGameOverSequence();
          break;
      }
    }

    // Keep the NEW BEST readout live once it has been reached
    if (this.gameState.newBestReached) {
      this.uiRenderer.markNewBest(this.gameState.score);
    }
  }

  private updateProgressPresentation(announceTier: boolean): void {
    this.uiRenderer.updateScore(this.gameState.score);
    this.uiRenderer.updateProgress(this.gameState.difficulty, this.gameState.score);

    const status = getProgressStatus(this.gameState.difficulty, this.gameState.score);
    if (announceTier && status.tierIndex > this.progressTierIndex) {
      const layout = this.layoutManager.layout;
      this.showCenterAlert(`${status.current.label} TIER`, status.current.color, 30);
      this.audioManager.playTierUp();
      this.fxManager.triggerFlash(0.22, 8);
      this.fxManager.triggerShake(3, 0.1);
      this.fxManager.boostFlow(0.55);
      this.animationManager.spawnExplosion(
        layout.gridOriginX + layout.gridSize / 2,
        layout.gridOriginY + layout.gridSize / 2 - 20,
        18,
      );
    }
    this.progressTierIndex = status.tierIndex;
  }
}
