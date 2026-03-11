// restart.js — game restart logic

import { state } from './state.js';
import { updateRealtimeStats } from './stats.js';
import { renderText } from './text.js';
import { clearKeyHighlight } from './keyboard.js';
import { hideAllGameContainers, showGameContainer } from './game-manager.js';

export function restart() {
  state.typedText = '';
  for (let i = 0; i < state.charStates.length; i++) {
    state.charStates[i] = 'pending';
  }
  if (state.hiddenInput) {
    state.hiddenInput.value = '';
  }

  // Reset statistics
  state.startTime = null;
  state.totalErrors = 0;
  state.totalInputs = 0;

  // Clear real-time stats interval
  if (state.realtimeStatsInterval) {
    clearInterval(state.realtimeStatsInterval);
    state.realtimeStatsInterval = null;
  }

  // Update real-time stats display
  updateRealtimeStats();

  // Clear keyboard highlights
  clearKeyHighlight();

  // Reset game
  if (state.currentGame && state.currentGame.reset) {
    state.currentGame.reset();
  }

  // Show appropriate container and hide completion screen and stats dashboard
  const isMeteoriteRain = state.config.gameType === 'meteoriteRain';

  showGameContainer(state.config.gameType);

  if (['meteoriteRain', 'towerDefense'].includes(state.config.gameType)) {
    if (state.currentGame?.startGame) {
      setTimeout(() => { state.currentGame?.startGame(); }, 100);
    }
  }

  if (state.completionScreen) {
    state.completionScreen.style.display = 'none';
  }
  if (state.statsDashboard) {
    state.statsDashboard.style.display = 'none';
  }

  // Show real-time stats again if configured
  if (state.realtimeStatsContainer) {
    updateRealtimeStats();
  }

  // Show keyboard-stats-wrapper again
  if (state.keyboardStatsWrapper) {
    state.keyboardStatsWrapper.style.display = 'block';
  }

  // Show keyboard again if it was enabled
  if (state.keyboardContainer && state.keyboardEnabled) {
    state.keyboardContainer.classList.add('visible');
  }

  // Show the restart button again
  if (state.restartButton && state.restartButton.parentElement) {
    state.restartButton.parentElement.style.display = 'block';
  }

  renderText();

  // Focus the appropriate input after a short delay
  setTimeout(() => {
    if (isMeteoriteRain) {
      if (state.meteoriteInput) {
        state.meteoriteInput.focus();
      }
    } else if (state.hiddenInput) {
      state.hiddenInput.focus();
    }
  }, 50);
}
