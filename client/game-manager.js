// game-manager.js — game factory and initialization

import { state } from './state.js';
import { renderText } from './text.js';
import { RacingGame } from './games/racing-game.js';
import { ClassicGame } from './games/classic-game.js';
import { MeteoriteRainGame } from './games/meteorite-rain-game.js';
import { TowerDefenseGame } from './games/tower-defense-game.js';

const GAME_CONTAINERS = [
  'classic-typing-container',
  'racing-track-container',
  'meteorite-rain-container',
  'tower-defense-container',
];

export function hideAllGameContainers() {
  for (const id of GAME_CONTAINERS) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
}

export function showGameContainer(gameType) {
  hideAllGameContainers();
  if (gameType === 'racing') {
    const el = document.getElementById('racing-track-container');
    if (el) el.style.display = 'block';
  } else if (gameType === 'meteoriteRain') {
    const el = document.getElementById('meteorite-rain-container');
    if (el) el.style.display = 'flex';
  } else if (gameType === 'towerDefense') {
    const el = document.getElementById('tower-defense-container');
    if (el) el.style.display = 'flex';
  } else {
    const el = document.getElementById('classic-typing-container');
    if (el) el.style.display = 'flex';
  }
}

export function initializeGame() {
  // Clean up previous game
  if (state.currentGame) {
    state.currentGame.destroy();
    if (state.gameUpdateInterval) {
      clearInterval(state.gameUpdateInterval);
      state.gameUpdateInterval = null;
    }
    if (state.gameAnimationFrame !== null) {
      cancelAnimationFrame(state.gameAnimationFrame);
      state.gameAnimationFrame = null;
    }
  }

  // Initialize based on game type
  const gameType = state.config.gameType || 'classic';

  if (gameType === 'racing') {
    state.currentGame = new RacingGame();
  } else if (gameType === 'meteoriteRain') {
    state.currentGame = new MeteoriteRainGame();
  } else if (gameType === 'towerDefense') {
    state.currentGame = new TowerDefenseGame();
  } else {
    state.currentGame = new ClassicGame();
  }

  state.currentGame.initialize();

  // Start game update loop for racing using requestAnimationFrame
  if (gameType === 'racing' && state.currentGame instanceof RacingGame) {
    function animate(currentTime) {
      if (state.currentGame && state.currentGame.updateOpponents) {
        state.currentGame.updateOpponents(currentTime);
      }
      // Continue animation loop
      state.gameAnimationFrame = requestAnimationFrame(animate);
    }
    // Start the animation loop
    state.gameAnimationFrame = requestAnimationFrame(animate);
  }

  // Start meteorite rain game
  if (gameType === 'meteoriteRain' && state.currentGame instanceof MeteoriteRainGame) {
    // Start the game after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (state.currentGame && state.currentGame.startGame) {
        state.currentGame.startGame();
      }
    }, 100);
  }

  // Start tower defense game
  if (gameType === 'towerDefense' && state.currentGame instanceof TowerDefenseGame) {
    // Start the game after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (state.currentGame && state.currentGame.startGame) {
        state.currentGame.startGame();
      }
    }, 100);
  }

  // Re-render text if it's already loaded (not for meteorite rain or tower defense)
  if (state.originalText.length > 0 && gameType !== 'meteoriteRain' && gameType !== 'towerDefense') {
    renderText();
  }

  // Words for tower defense will be extracted after text loads in initialize()
}
