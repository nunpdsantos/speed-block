import { Application } from 'pixi.js';
import { LayoutManager } from './rendering/LayoutManager';
import { SceneManager } from './scenes/SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { AudioManager } from './audio/AudioManager';
import { getAdaptiveTuning, recordAdaptiveRun } from './core/AdaptiveProgression';
import { Leaderboard } from './core/Leaderboard';
import { Difficulty, DIFFICULTY_CONFIGS } from './core/Config';
import { RunSummary } from './core/types';

async function boot() {
  const container = document.getElementById('game-container')!;

  const app = new Application();
  await app.init({
    background: 0x4a5ba6,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';

  const layoutManager = new LayoutManager();
  const audioManager = new AudioManager();
  const sceneManager = new SceneManager(app.stage);

  let selectedDifficulty: Difficulty = 'fast';
  const leaderboard = new Leaderboard(selectedDifficulty);

  function showMenu() {
    const layout = layoutManager.recalculate(window.innerWidth, window.innerHeight);
    const menu = new MenuScene(
      layout.width, layout.height,
      leaderboard,
      selectedDifficulty,
      (difficulty) => {
        selectedDifficulty = difficulty;
        leaderboard.switchDifficulty(difficulty);
      },
      () => startGame(false),
    );
    sceneManager.switchTo(menu);
  }

  /** Set the app background color (for color temperature shifting) */
  function setBgColor(color: number): void {
    app.renderer.background.color = color;
  }

  function startGame(skipCountdown: boolean = false) {
    const config = DIFFICULTY_CONFIGS[selectedDifficulty];
    const adaptiveTuning = getAdaptiveTuning(selectedDifficulty);
    const gameScene = new GameScene(
      app.canvas,
      layoutManager,
      audioManager,
      config,
      selectedDifficulty,
      adaptiveTuning,
      skipCountdown,
      (summary) => showGameOver(summary),
      () => showMenu(),
      setBgColor,
    );
    sceneManager.switchTo(gameScene);
  }

  function showGameOver(summary: RunSummary) {
    if (summary.score > 0 && summary.endCause !== 'quit') {
      recordAdaptiveRun(selectedDifficulty, summary);
    }
    const layout = layoutManager.layout;
    const gameOver = new GameOverScene(
      layout.width, layout.height,
      summary.score,
      leaderboard,
      selectedDifficulty,
      () => startGame(true),
      () => showMenu(),
    );
    sceneManager.switchTo(gameOver);
  }

  // Resize handling
  window.addEventListener('resize', () => {
    const layout = layoutManager.recalculate(window.innerWidth, window.innerHeight);
    sceneManager.resize(layout.width, layout.height);
  });

  // Game loop
  app.ticker.add((ticker) => {
    sceneManager.update(ticker.deltaTime / 60);
  });

  showMenu();
}

boot().catch(console.error);
