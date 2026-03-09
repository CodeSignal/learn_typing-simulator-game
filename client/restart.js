// restart.js — game restart logic

import { state } from './state.js';
import { updateRealtimeStats } from './stats.js';
import { renderText } from './text.js';

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
  if (state.activeKeyElement) {
    state.activeKeyElement.classList.remove('active', 'active-error');
    state.activeKeyElement = null;
  }
  if (state.activeKeyTimeout) {
    clearTimeout(state.activeKeyTimeout);
    state.activeKeyTimeout = null;
  }

  // Reset game
  if (state.currentGame && state.currentGame.reset) {
    state.currentGame.reset();
  }

  // Show appropriate container and hide completion screen and stats dashboard
  const isRacing = state.config.gameType === 'racing';
  const isMeteoriteRain = state.config.gameType === 'meteoriteRain';
  const isTowerDefense = state.config.gameType === 'towerDefense';

  if (isRacing) {
    const racingContainer = document.getElementById('racing-track-container');
    if (racingContainer) {
      racingContainer.style.display = 'block';
    }
    const classicContainer = document.getElementById('classic-typing-container');
    if (classicContainer) {
      classicContainer.style.display = 'none';
    }
    const meteoriteContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteContainer) {
      meteoriteContainer.style.display = 'none';
    }
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'none';
    }
  } else if (isMeteoriteRain) {
    const meteoriteContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteContainer) {
      meteoriteContainer.style.display = 'flex';
    }
    const classicContainer = document.getElementById('classic-typing-container');
    if (classicContainer) {
      classicContainer.style.display = 'none';
    }
    const racingContainer = document.getElementById('racing-track-container');
    if (racingContainer) {
      racingContainer.style.display = 'none';
    }
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'none';
    }
    // Restart meteorite rain game
    if (state.currentGame && state.currentGame.startGame) {
      setTimeout(() => {
        if (state.currentGame && state.currentGame.startGame) {
          state.currentGame.startGame();
        }
      }, 100);
    }
  } else if (isTowerDefense) {
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'flex';
    }
    const classicContainer = document.getElementById('classic-typing-container');
    if (classicContainer) {
      classicContainer.style.display = 'none';
    }
    const racingContainer = document.getElementById('racing-track-container');
    if (racingContainer) {
      racingContainer.style.display = 'none';
    }
    const meteoriteContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteContainer) {
      meteoriteContainer.style.display = 'none';
    }
    // Restart tower defense game
    if (state.currentGame && state.currentGame.startGame) {
      setTimeout(() => {
        if (state.currentGame && state.currentGame.startGame) {
          state.currentGame.startGame();
        }
      }, 100);
    }
  } else {
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'block';
    }
    const racingContainer = document.getElementById('racing-track-container');
    if (racingContainer) {
      racingContainer.style.display = 'none';
    }
    const meteoriteContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteContainer) {
      meteoriteContainer.style.display = 'none';
    }
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'none';
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
  const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
  if (keyboardStatsWrapper) {
    keyboardStatsWrapper.style.display = 'block';
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
      const meteoriteInput = document.getElementById('meteorite-typing-input');
      if (meteoriteInput) {
        meteoriteInput.focus();
      }
    } else if (state.hiddenInput) {
      state.hiddenInput.focus();
    }
  }, 50);
}
