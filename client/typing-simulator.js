// typing-simulator.js — entry point and initialization orchestrator

import { state } from './state.js';
import { loadConfig } from './config.js';
import { loadText } from './text.js';
import { initializeKeyboard } from './keyboard.js';
import { handleInput, handleKeyDown } from './input.js';
import { updateRealtimeStats } from './stats.js';
import { restart } from './restart.js';
import { initializeGame } from './game-manager.js';

async function initialize() {
  // Load config first
  await loadConfig();

  state.textContainer = document.getElementById('typing-text');
  state.hiddenInput = document.getElementById('hidden-input');
  state.completionScreen = document.getElementById('completion-screen');
  state.statsDashboard = document.getElementById('stats-dashboard');
  state.restartButton = document.getElementById('btn-restart');
  state.startOverButton = document.getElementById('btn-start-over');
  state.statsStartOverButton = document.getElementById('btn-stats-start-over');
  state.realtimeStatsContainer = document.getElementById('realtime-stats-container');
  state.keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');

  if (!state.hiddenInput) {
    console.error('Required elements not found');
    return;
  }

  // Initialize game based on config
  initializeGame();

  // Initialize keyboard
  initializeKeyboard();

  // Set up event listeners
  state.hiddenInput.addEventListener('input', handleInput);
  state.hiddenInput.addEventListener('keydown', handleKeyDown);

  // Add global keydown listener for tower defense to auto-focus input when typing
  if (state.config.gameType === 'towerDefense') {
    document.addEventListener('keydown', (e) => {
      // Only focus if input is not already focused and user is typing a regular character
      if (state.hiddenInput && document.activeElement !== state.hiddenInput &&
          e.target !== state.hiddenInput &&
          !e.ctrlKey && !e.metaKey && !e.altKey &&
          e.key.length === 1 && e.key.match(/[a-zA-Z0-9\s.,!?;:'"()-]/)) {
        state.hiddenInput.focus();
        // Dispatch the keydown event to the input so it gets processed
        const keydownEvent = new KeyboardEvent('keydown', {
          key: e.key,
          code: e.code,
          bubbles: true,
          cancelable: true
        });
        state.hiddenInput.dispatchEvent(keydownEvent);
        // Also dispatch input event to trigger handleInput which will start the game
        const inputEvent = new Event('input', { bubbles: true });
        state.hiddenInput.dispatchEvent(inputEvent);
      }
    });
  }

  // Set up event listeners for meteorite rain input
  state.meteoriteInput = document.getElementById('meteorite-typing-input');
  if (state.meteoriteInput) {
    state.meteoriteInput.addEventListener('input', handleInput);
    state.meteoriteInput.addEventListener('keydown', handleKeyDown);
  }

  if (state.restartButton) {
    state.restartButton.addEventListener('click', restart);
  }

  if (state.startOverButton) {
    state.startOverButton.addEventListener('click', restart);
  }

  if (state.statsStartOverButton) {
    state.statsStartOverButton.addEventListener('click', restart);
  }

  // Focus the input when clicking on the text container or racing track
  const typingTextContainer = document.querySelector('.typing-text-container');
  const racingTrackContainer = document.getElementById('racing-track-container');

  if (typingTextContainer) {
    typingTextContainer.addEventListener('click', () => {
      const isCompletionVisible = state.completionScreen && state.completionScreen.style.display === 'flex';
      const isStatsVisible = state.statsDashboard && state.statsDashboard.style.display === 'flex';
      if (state.hiddenInput && !isCompletionVisible && !isStatsVisible) {
        state.hiddenInput.focus();
      }
    });
  }

  if (racingTrackContainer) {
    racingTrackContainer.addEventListener('click', () => {
      const isCompletionVisible = state.completionScreen && state.completionScreen.style.display === 'flex';
      const isStatsVisible = state.statsDashboard && state.statsDashboard.style.display === 'flex';
      if (state.hiddenInput && !isCompletionVisible && !isStatsVisible) {
        state.hiddenInput.focus();
      }
    });
  }

  // Focus meteorite input when clicking on play area
  const meteoritePlayArea = document.getElementById('meteorite-play-area');
  if (meteoritePlayArea) {
    meteoritePlayArea.addEventListener('click', () => {
      const isCompletionVisible = state.completionScreen && state.completionScreen.style.display === 'flex';
      const isStatsVisible = state.statsDashboard && state.statsDashboard.style.display === 'flex';
      if (state.meteoriteInput && !isCompletionVisible && !isStatsVisible) {
        state.meteoriteInput.focus();
      }
    });
  }

  // Load the text
  await loadText();

  // Extract words for meteorite rain game after text is loaded
  if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
    if (state.currentGame.extractWords) {
      state.currentGame.extractWords();
    }
  }

  // Update track dimensions after text is loaded (for racing game)
  if (state.currentGame && state.currentGame.updateTrackDimensions) {
    // Wait for layout to settle
    setTimeout(() => {
      if (state.currentGame && state.currentGame.updateTrackDimensions) {
        state.currentGame.updateTrackDimensions();
      }
    }, 100);
  }

  // Initialize real-time stats display
  updateRealtimeStats();

  // Focus the appropriate input after a short delay
  setTimeout(() => {
    const isCompletionVisible = state.completionScreen && state.completionScreen.style.display === 'flex';
    const isStatsVisible = state.statsDashboard && state.statsDashboard.style.display === 'flex';
    if (isCompletionVisible || isStatsVisible) return;

    if (state.config.gameType === 'meteoriteRain') {
      if (state.meteoriteInput) {
        state.meteoriteInput.focus();
      }
    } else if (state.hiddenInput) {
      state.hiddenInput.focus();
    }
  }, 100);

  // Handle window resize for racing game
  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
      if (state.currentGame && state.currentGame.updateTrackDimensions) {
        state.currentGame.updateTrackDimensions();
      }
    }, 250);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
