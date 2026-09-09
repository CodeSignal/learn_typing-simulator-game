// completion.js — orchestrates end-of-task saving and result display.
//
// Modes own their own results. A game class may implement any of:
//   serializeStats(stats) -> string   the stats.txt body for that mode
//   renderResult(stats)               what the candidate sees when finished
//   allowsRestart() -> boolean        false hides the restart / Start Over controls
// Anything not implemented falls back to the standard behaviour below, so only
// modes that genuinely differ carry any code.

import { state } from './state.js';
import {
  calculateCompletionStats,
  createEmptyStatistics,
  formatStatValue,
  parseStatsText,
  postStatsText
} from './stats.js';
import { hideAllGameContainers } from './game-manager.js';
import { buildStandardPayload } from './results/standard-result.js';

export function gameAllowsRestart() {
  const game = state.currentGame;
  return game && typeof game.allowsRestart === 'function' ? game.allowsRestart() : true;
}

// Shared teardown: leave only the result view on screen.
function prepareResultView() {
  hideAllGameContainers();

  if (state.keyboardContainer) state.keyboardContainer.classList.remove('visible');
  if (state.realtimeStatsContainer) state.realtimeStatsContainer.style.display = 'none';
  if (state.realtimeStatsInterval) {
    clearInterval(state.realtimeStatsInterval);
    state.realtimeStatsInterval = null;
  }
  if (state.keyboardStatsWrapper) state.keyboardStatsWrapper.style.display = 'none';
  if (state.restartButton && state.restartButton.parentElement) {
    state.restartButton.parentElement.style.display = 'none';
  }
  if (state.hiddenInput) state.hiddenInput.blur();
}

// The standard stats dashboard. Exported so a mode can reuse it and then adjust
// (see AudioGame, which relabels the error cards).
export async function showStatsDashboard() {
  prepareResultView();
  if (state.completionScreen) state.completionScreen.style.display = 'none';

  try {
    const response = await fetch('./stats.txt');
    const stats = response.ok
      ? parseStatsText(await response.text())
      : createEmptyStatistics();

    const dashboardHeader = state.statsDashboard
      ? state.statsDashboard.querySelector('.stats-dashboard-header h2')
      : null;
    if (dashboardHeader) dashboardHeader.textContent = resultHeading();

    const cells = {
      speed: document.getElementById('stat-speed'),
      accuracy: document.getElementById('stat-accuracy'),
      time: document.getElementById('stat-time'),
      errors: document.getElementById('stat-errors'),
      errorsLeft: document.getElementById('stat-errors-left')
    };
    Object.entries(cells).forEach(([key, el]) => {
      if (el) el.textContent = formatStatValue(key, stats);
    });

    if (state.statsDashboard) state.statsDashboard.style.display = 'flex';
  } catch (error) {
    console.error('Error loading stats:', error);
    if (state.completionScreen) state.completionScreen.style.display = 'flex';
  }
}

function resultHeading() {
  const game = state.currentGame;
  if (state.config.gameType === 'meteoriteRain' && game) {
    return `Final Score: ${game.getScore ? game.getScore() : 0}`;
  }
  if (state.config.gameType === 'racing' && game && game.playerWon !== null) {
    if (game.playerWon === true) return 'Victory 🏅';
    if (game.playerWon === false) return 'You lost! 😢';
  }
  return 'Typing Statistics';
}

function shouldShowDashboard() {
  const isMeteorite = state.config.gameType === 'meteoriteRain';
  const isRacing = state.config.gameType === 'racing' && state.currentGame;
  return state.config.showStats === true ||
    (isRacing && state.currentGame.playerWon !== null) ||
    isMeteorite;
}

async function renderDefaultResult() {
  if (shouldShowDashboard()) {
    setTimeout(() => showStatsDashboard(), 200);
    return;
  }
  prepareResultView();
  if (state.completionScreen) state.completionScreen.style.display = 'flex';
}

export function showCompletionScreen() {
  if (state.statsDashboard) state.statsDashboard.style.display = 'none';
  if (!state.completionScreen) {
    console.error('Completion screen element not found');
    return;
  }

  prepareResultView();

  const game = state.currentGame;
  const stats = calculateCompletionStats();
  const render = () => (game && typeof game.renderResult === 'function')
    ? game.renderResult(stats)
    : renderDefaultResult();

  if (!stats) {
    render();
    return;
  }

  const payload = (game && typeof game.serializeStats === 'function')
    ? game.serializeStats(stats)
    : buildStandardPayload(stats);

  postStatsText(payload).then(render, (error) => {
    console.error('Could not save statistics:', error);
    render();
  });
}
