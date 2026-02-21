import { Application } from 'pixi.js';
import { LayoutManager } from './rendering/LayoutManager';
import { SceneManager } from './scenes/SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { AudioManager } from './audio/AudioManager';
import { Leaderboard } from './core/Leaderboard';

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
  app.canvas.style.touchAction = 'manipulation';

  const layoutManager = new LayoutManager();
  const audioManager = new AudioManager();
  const sceneManager = new SceneManager(app.stage);
  const leaderboard = new Leaderboard();

  function showMenu() {
    const layout = layoutManager.recalculate(window.innerWidth, window.innerHeight);
    const menu = new MenuScene(layout.width, layout.height, leaderboard, () => startGame());
    sceneManager.switchTo(menu);
  }

  function startGame() {
    const gameScene = new GameScene(
      app.canvas,
      layoutManager,
      audioManager,
      (score) => showGameOver(score),
      () => showMenu(),
    );
    sceneManager.switchTo(gameScene);
  }

  function showGameOver(score: number) {
    const layout = layoutManager.layout;
    const gameOver = new GameOverScene(
      layout.width, layout.height,
      score,
      leaderboard,
      () => startGame(),
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
