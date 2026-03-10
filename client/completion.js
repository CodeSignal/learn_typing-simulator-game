// completion.js — completion screen and stats dashboard display

import { state } from './state.js';
import {
  calculateCompletionStats,
  createEmptyStatistics,
  formatStatValue,
  saveStatistics,
  parseStatsText
} from './stats.js';

// Load and display stats dashboard
async function showStatsDashboard() {
  // Hide typing container
  const typingTextContainer = document.getElementById('classic-typing-container');
  if (typingTextContainer) {
    typingTextContainer.style.display = 'none';
  }

  // Hide racing track
  const racingTrackContainer = document.getElementById('racing-track-container');
  if (racingTrackContainer) {
    racingTrackContainer.style.display = 'none';
  }

  // Hide meteorite rain container
  const meteoriteRainContainer = document.getElementById('meteorite-rain-container');
  if (meteoriteRainContainer) {
    meteoriteRainContainer.style.display = 'none';
  }

  // Hide tower defense container
  const towerDefenseContainer = document.getElementById('tower-defense-container');
  if (towerDefenseContainer) {
    towerDefenseContainer.style.display = 'none';
  }

  // Hide the restart button when dashboard is shown
  if (state.restartButton && state.restartButton.parentElement) {
    state.restartButton.parentElement.style.display = 'none';
  }

  // Hide keyboard when dashboard is shown
  if (state.keyboardContainer) {
    state.keyboardContainer.classList.remove('visible');
  }

  // Hide real-time stats when dashboard is shown
  if (state.realtimeStatsContainer) {
    state.realtimeStatsContainer.style.display = 'none';
  }
  if (state.realtimeStatsInterval) {
    clearInterval(state.realtimeStatsInterval);
    state.realtimeStatsInterval = null;
  }

  // Hide keyboard-stats-wrapper when dashboard is shown
  const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
  if (keyboardStatsWrapper) {
    keyboardStatsWrapper.style.display = 'none';
  }

  // Hide completion screen if visible
  if (state.completionScreen) {
    state.completionScreen.style.display = 'none';
  }

  try {
    const response = await fetch('./stats.txt');
    let stats = null;

    if (response.ok) {
      const statsText = await response.text();
      stats = parseStatsText(statsText);
    } else {
      console.warn('Stats file not found, using default values');
      stats = createEmptyStatistics();
    }

    // Update dashboard header based on game type
    const dashboardHeader = state.statsDashboard ? state.statsDashboard.querySelector('.stats-dashboard-header h2') : null;
    if (dashboardHeader) {
      if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
        // Show final score for meteorite rain
        const score = state.currentGame.getScore ? state.currentGame.getScore() : 0;
        dashboardHeader.textContent = `Final Score: ${score}`;
      } else if (state.config.gameType === 'racing' && state.currentGame && state.currentGame.playerWon !== null) {
        if (state.currentGame.playerWon === true) {
          dashboardHeader.textContent = 'Victory 🏅';
        } else if (state.currentGame.playerWon === false) {
          dashboardHeader.textContent = 'You lost! 😢';
        } else {
          dashboardHeader.textContent = 'Typing Statistics'; // Fallback
        }
      } else {
        dashboardHeader.textContent = 'Typing Statistics'; // Default for non-racing games
      }
    }

    // Update dashboard with stats
    const speedEl = document.getElementById('stat-speed');
    const accuracyEl = document.getElementById('stat-accuracy');
    const timeEl = document.getElementById('stat-time');
    const errorsEl = document.getElementById('stat-errors');
    const errorsLeftEl = document.getElementById('stat-errors-left');

    if (speedEl) speedEl.textContent = formatStatValue('speed', stats);
    if (accuracyEl) accuracyEl.textContent = formatStatValue('accuracy', stats);
    if (timeEl) timeEl.textContent = formatStatValue('time', stats);
    if (errorsEl) errorsEl.textContent = formatStatValue('errors', stats);
    if (errorsLeftEl) errorsLeftEl.textContent = formatStatValue('errorsLeft', stats);

    // Show dashboard
    if (state.statsDashboard) {
      state.statsDashboard.style.display = 'flex';
    }

    if (state.hiddenInput) {
      state.hiddenInput.blur();
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    // Fall back to simple completion screen
    // Keyboard is already hidden above
    if (state.completionScreen) {
      state.completionScreen.style.display = 'flex';
    }
  }
}

export function showCompletionScreen() {
  console.log('showCompletionScreen called');

  // Hide stats dashboard if visible
  if (state.statsDashboard) {
    state.statsDashboard.style.display = 'none';
  }

  if (!state.completionScreen) {
    console.error('Completion screen element not found!');
    return;
  }

  // Hide typing container
  const typingTextContainer = document.getElementById('classic-typing-container');
  if (typingTextContainer) {
    typingTextContainer.style.display = 'none';
  }

  // Hide racing track
  const racingTrackContainer = document.getElementById('racing-track-container');
  if (racingTrackContainer) {
    racingTrackContainer.style.display = 'none';
  }

  // Hide meteorite rain container
  const meteoriteRainContainer = document.getElementById('meteorite-rain-container');
  if (meteoriteRainContainer) {
    meteoriteRainContainer.style.display = 'none';
  }

  // Hide tower defense container
  const towerDefenseContainer = document.getElementById('tower-defense-container');
  if (towerDefenseContainer) {
    towerDefenseContainer.style.display = 'none';
  }

  // Hide keyboard when completion screen is shown
  if (state.keyboardContainer) {
    state.keyboardContainer.classList.remove('visible');
  }

  // Hide real-time stats when completion screen is shown
  if (state.realtimeStatsContainer) {
    state.realtimeStatsContainer.style.display = 'none';
  }
  if (state.realtimeStatsInterval) {
    clearInterval(state.realtimeStatsInterval);
    state.realtimeStatsInterval = null;
  }

  // Hide keyboard-stats-wrapper when completion screen is shown
  const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
  if (keyboardStatsWrapper) {
    keyboardStatsWrapper.style.display = 'none';
  }

  // Hide the restart button when completion screen is shown
  if (state.restartButton && state.restartButton.parentElement) {
    state.restartButton.parentElement.style.display = 'none';
  }

  // Calculate and save statistics
  console.log('About to calculate statistics...');
  const stats = calculateCompletionStats();
  console.log('Statistics result:', stats);
  const isMeteoriteRainGame = state.config.gameType === 'meteoriteRain';

  // For racing game or meteorite rain, show dashboard even if stats are null
  const isRacingGame = state.config.gameType === 'racing' && state.currentGame;
  const shouldShowDashboard = state.config.showStats === true || (isRacingGame && state.currentGame.playerWon !== null) || isMeteoriteRainGame;

  if (stats) {
    console.log('Calling saveStatistics...');
    saveStatistics(stats).then(() => {
      // After saving, check if we should show stats dashboard
      if (shouldShowDashboard) {
        // Wait a bit for the file to be written, then show dashboard
        setTimeout(() => {
          showStatsDashboard();
        }, 200);
      } else {
        // Show simple completion screen
        // Ensure real-time stats are hidden
        if (state.realtimeStatsContainer) {
          state.realtimeStatsContainer.style.display = 'none';
        }
        state.completionScreen.style.display = 'flex';
        if (state.hiddenInput) {
          state.hiddenInput.blur();
        }
      }
    });
  } else {
    console.log('No statistics to save (stats is null)');
    // For racing game or meteorite rain, still show dashboard
    if (shouldShowDashboard) {
      setTimeout(() => {
        showStatsDashboard();
      }, 200);
    } else {
      // Show simple completion screen
      // Ensure real-time stats are hidden
      if (state.realtimeStatsContainer) {
        state.realtimeStatsContainer.style.display = 'none';
      }
      state.completionScreen.style.display = 'flex';
      if (state.hiddenInput) {
        state.hiddenInput.blur();
      }
    }
  }
}
