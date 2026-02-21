import { Container } from 'pixi.js';
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

  constructor(
    canvas: HTMLCanvasElement,
    layoutManager: LayoutManager,
    audioManager: AudioManager,
    onGameOver: (score: number) => void,
  ) {
    this.canvas = canvas;
    this.layoutManager = layoutManager;
    this.audioManager = audioManager;
    this.onGameOver = onGameOver;
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
    this.animationManager.update(dt);
    // Update speed multiplier display in real-time
    this.uiRenderer.updateSpeedMultiplier(this.gameState.speedMultiplier);
  }

  private setupDragCallbacks(): void {
    this.dragController.onDragStart = (state: DragState) => {
      this.pieceRenderer.showDragPiece(state.piece, state.pointerX, state.pointerY);
      if (state.gridPos) {
        this.ghostRenderer.show(
          state.piece.shape, state.gridPos.row, state.gridPos.col,
          state.piece.color, state.isValid,
        );
      }
      // Redraw tray without the dragged piece
      const tempPieces = [...this.gameState.activePieces];
      tempPieces[state.pieceIndex] = null;
      this.pieceRenderer.drawTray(tempPieces);
      // Clear selection if was selected
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

      // Redraw tray with current state
      this.pieceRenderer.drawTray(this.gameState.activePieces);
      this.dragController.updatePieces(this.gameState.activePieces);
      this.dragController.updateBoard(this.gameState.board);
    };

    this.dragController.onDragCancel = () => {
      this.pieceRenderer.hideDragPiece();
      this.ghostRenderer.hide();
      this.pieceRenderer.drawTray(this.gameState.activePieces);
    };

    // Tap-to-place callbacks
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
            // Show speed bonus popup if significant
            if (event.scoreBreakdown.speedMultiplier > 1.05) {
              const pct = Math.round((event.scoreBreakdown.speedMultiplier - 1) * 100);
              this.animationManager.showStreakPopup(0, `SPEED +${pct}%`);
            }
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
            if (event.scoreBreakdown.speedMultiplier > 1.05) {
              const pct = Math.round((event.scoreBreakdown.speedMultiplier - 1) * 100);
              this.animationManager.showStreakPopup(0, `SPEED +${pct}%`);
            }
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
