// completion.js — completion screen and stats dashboard display

import { state } from './state.js';
import {
  calculateCompletionStats,
  createEmptyStatistics,
  formatStatValue,
  saveStatistics,
  parseStatsText
} from './stats.js';
import { hideAllGameContainers } from './game-manager.js';

// Save the completion stats, and — when the task sets `includeTranscript` (any
// mode) — append the expected and submitted transcripts so a grader can compare
// the actual transcription, not just the numbers. The transcripts are added on
// top of the shared serializer's output (read back and re-posted) so stats.js
// stays untouched.
async function saveCompletionStats(stats) {
  await saveStatistics(stats);
  if (!state.config.includeTranscript) return;
  try {
    // fetch does not throw on HTTP errors; guard so we never append transcripts
    // to an error page and write that back (the base stats were already saved).
    const response = await fetch('./stats.txt', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch stats.txt: ${response.status}`);
    }
    const base = await response.text();
    const transcripts =
      `Expected Transcription:\n${state.originalText}\n\n` +
      `Submitted Transcription:\n${state.typedText}\n\n`;
    const marker = 'Generated:';
    const idx = base.indexOf(marker);
    const body = idx >= 0
      ? base.slice(0, idx) + transcripts + base.slice(idx)
      : base.replace(/\s*$/, '\n') + '\n' + transcripts;
    await fetch('/save-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body
    });
  } catch (error) {
    console.error('Could not save transcript:', error);
  }
}

// Load and display stats dashboard
async function showStatsDashboard() {
  hideAllGameContainers();

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
  if (state.keyboardStatsWrapper) {
    state.keyboardStatsWrapper.style.display = 'none';
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

    // In audio (dictation) mode the two error stats are edit distances against
    // the hidden transcript, not keystroke errors, so relabel them accordingly.
    if (state.config.gameType === 'audio') {
      const errorsLabel = errorsEl && errorsEl.closest('.stat-card') &&
        errorsEl.closest('.stat-card').querySelector('.stat-label');
      const errorsLeftLabel = errorsLeftEl && errorsLeftEl.closest('.stat-card') &&
        errorsLeftEl.closest('.stat-card').querySelector('.stat-label');
      if (errorsLabel) errorsLabel.textContent = 'Character errors';
      if (errorsLeftLabel) errorsLeftLabel.textContent = 'Word errors';
    }

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
  // Hide stats dashboard if visible
  if (state.statsDashboard) {
    state.statsDashboard.style.display = 'none';
  }

  if (!state.completionScreen) {
    console.error('Completion screen element not found');
    return;
  }

  hideAllGameContainers();

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
  if (state.keyboardStatsWrapper) {
    state.keyboardStatsWrapper.style.display = 'none';
  }

  // Hide the restart button when completion screen is shown
  if (state.restartButton && state.restartButton.parentElement) {
    state.restartButton.parentElement.style.display = 'none';
  }

  // Calculate and save statistics
  const stats = calculateCompletionStats();
  const isMeteoriteRainGame = state.config.gameType === 'meteoriteRain';

  // For racing game or meteorite rain, show dashboard even if stats are null
  const isRacingGame = state.config.gameType === 'racing' && state.currentGame;
  const shouldShowDashboard = state.config.showStats === true || (isRacingGame && state.currentGame.playerWon !== null) || isMeteoriteRainGame;

  if (stats) {
    saveCompletionStats(stats).then(() => {
      if (shouldShowDashboard) {
        setTimeout(() => showStatsDashboard(), 200);
      } else {
        if (state.realtimeStatsContainer) state.realtimeStatsContainer.style.display = 'none';
        state.completionScreen.style.display = 'flex';
        if (state.hiddenInput) state.hiddenInput.blur();
      }
    });
  } else {
    if (shouldShowDashboard) {
      setTimeout(() => showStatsDashboard(), 200);
    } else {
      if (state.realtimeStatsContainer) state.realtimeStatsContainer.style.display = 'none';
      state.completionScreen.style.display = 'flex';
      if (state.hiddenInput) state.hiddenInput.blur();
    }
  }
}
