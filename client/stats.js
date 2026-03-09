// stats.js — statistics calculation, display, saving, and parsing

import { state } from './state.js';

// Calculate real-time statistics (while typing)
export function calculateRealtimeStats() {
  // Calculate chars typed and total
  const charsTyped = state.typedText.length;
  const charsTotal = state.originalText.length;

  if (state.startTime === null) {
    return {
      speed: 0,
      accuracy: 0,
      time: 0,
      errors: 0,
      errorsLeft: 0,
      chars: { typed: charsTyped, total: charsTotal }
    };
  }

  const currentTime = Date.now();
  const totalTimeSeconds = (currentTime - state.startTime) / 1000;
  const totalTimeMinutes = totalTimeSeconds / 60;

  // Count errors left (unfixed incorrect characters)
  let errorsLeft = 0;
  for (let i = 0; i < state.charStates.length; i++) {
    if (state.charStates[i] === 'incorrect') {
      errorsLeft++;
    }
  }

  // Calculate accuracy: (correct inputs / total inputs) * 100
  const correctInputs = state.totalInputs - state.totalErrors;
  const accuracy = state.totalInputs > 0 ? (correctInputs / state.totalInputs) * 100 : 0;

  // Calculate words per minute
  // Count words by splitting on whitespace
  const wpm = totalTimeMinutes > 0 ? (charsTyped / 5) / totalTimeMinutes : 0;

  return {
    speed: wpm,
    accuracy: accuracy,
    time: totalTimeSeconds,
    errors: state.totalErrors,
    errorsLeft: errorsLeft,
    chars: { typed: charsTyped, total: charsTotal }
  };
}

// Update real-time stats display
export function updateRealtimeStats() {
  if (!state.realtimeStatsContainer) return;

  // Check if realTimeStats is configured and has items
  if (!state.config.realTimeStats || !Array.isArray(state.config.realTimeStats) || state.config.realTimeStats.length === 0) {
    state.realtimeStatsContainer.style.display = 'none';
    // Clear interval if stats are disabled
    if (state.realtimeStatsInterval) {
      clearInterval(state.realtimeStatsInterval);
      state.realtimeStatsInterval = null;
    }
    return;
  }

  const stats = calculateRealtimeStats();
  state.realtimeStatsContainer.style.display = 'flex';

  // Clear existing content
  state.realtimeStatsContainer.innerHTML = '';

  // Map of stat keys to display info
  const statMap = {
    speed: { label: 'WPM', value: stats.speed, format: (v) => v.toFixed(1) },
    accuracy: { label: 'Accuracy', value: stats.accuracy, format: (v) => v.toFixed(1) + '%' },
    time: { label: 'Time', value: stats.time, format: (v) => {
      if (v < 60) {
        return v.toFixed(1) + 's';
      } else {
        const minutes = Math.floor(v / 60);
        const seconds = (v % 60).toFixed(1);
        return `${minutes}m ${seconds}s`;
      }
    }},
    errors: { label: 'Errors', value: stats.errors, format: (v) => Math.round(v).toString() },
    errorsLeft: { label: 'Errors Left', value: stats.errorsLeft, format: (v) => Math.round(v).toString() },
    chars: { label: 'Chars', value: stats.chars, format: (v) => `${v.typed}/${v.total}` }
  };

  // Create stat items for each configured stat
  state.config.realTimeStats.forEach(statKey => {
    const statInfo = statMap[statKey];
    if (!statInfo) return; // Skip invalid stat keys

    const statItem = document.createElement('div');
    statItem.className = 'realtime-stat-item';

    const statLabel = document.createElement('span');
    statLabel.className = 'realtime-stat-label';
    statLabel.textContent = statInfo.label;

    const statValue = document.createElement('span');
    statValue.className = 'realtime-stat-value';
    statValue.textContent = statInfo.format(statInfo.value);

    statItem.appendChild(statLabel);
    statItem.appendChild(statValue);
    state.realtimeStatsContainer.appendChild(statItem);
  });

  // Start periodic updates if typing has started and interval not already running
  if (state.startTime !== null && !state.realtimeStatsInterval) {
    state.realtimeStatsInterval = setInterval(() => {
      updateRealtimeStats();
    }, 100); // Update every 100ms for smooth time updates
  }
}

export function calculateStatistics() {
  console.log('Calculating statistics...');
  console.log('startTime:', state.startTime, 'totalInputs:', state.totalInputs, 'totalErrors:', state.totalErrors);

  if (state.startTime === null) {
    console.log('No typing started, returning null');
    return null; // No typing started
  }

  const endTime = Date.now();
  const totalTimeSeconds = (endTime - state.startTime) / 1000;
  const totalTimeMinutes = totalTimeSeconds / 60;

  // Count errors left (unfixed incorrect characters)
  let errorsLeft = 0;
  for (let i = 0; i < state.charStates.length; i++) {
    if (state.charStates[i] === 'incorrect') {
      errorsLeft++;
    }
  }

  // Calculate accuracy: (correct inputs / total inputs) * 100
  const correctInputs = state.totalInputs - state.totalErrors;
  const accuracy = state.totalInputs > 0 ? (correctInputs / state.totalInputs) * 100 : 0;

  // Calculate words per minute
  // Count words by splitting on whitespace
  const wordsTyped = state.originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
  const wpm = totalTimeMinutes > 0 ? wordsTyped / totalTimeMinutes : 0;

  const stats = {
    totalErrors: state.totalErrors,
    errorsLeft: errorsLeft,
    totalTime: totalTimeSeconds,
    accuracy: accuracy,
    speed: wpm
  };

  console.log('Calculated statistics:', stats);
  return stats;
}

export async function saveStatistics(stats) {
  console.log('saveStatistics called with:', stats);
  try {
    // Get win/lose status for racing games or score for meteorite rain
    let statusLine = '';
    if (state.config.gameType === 'racing' && state.currentGame && state.currentGame.playerWon !== null) {
      const status = state.currentGame.playerWon ? 'win' : 'lose';
      statusLine = `Status: ${status}\n\n`;
    } else if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
      const score = state.currentGame.getScore ? state.currentGame.getScore() : 0;
      statusLine = `Score: ${score}\n\n`;
    }

    // Format statistics text
    const statsText = `${statusLine}Typing Statistics
==================

Total Errors Made: ${stats.totalErrors}
Errors Left (Unfixed): ${stats.errorsLeft}
Total Time: ${stats.totalTime.toFixed(2)} seconds
Accuracy: ${stats.accuracy.toFixed(2)}%
Speed: ${stats.speed.toFixed(2)} words per minute

Generated: ${new Date().toLocaleString()}
`;

    console.log('Sending stats to server:', statsText);
    const response = await fetch('/save-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: statsText
    });

    console.log('Server response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('Statistics saved to client/stats.txt', result);
    } else {
      const errorText = await response.text();
      console.error('Failed to save statistics:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error saving statistics:', error);
  }
}

// Parse stats from stats.txt file
export function parseStatsText(statsText) {
  const stats = {};
  const lines = statsText.split('\n');

  for (const line of lines) {
    if (line.includes('Total Errors Made:')) {
      const match = line.match(/Total Errors Made:\s*(\d+)/);
      if (match) stats.totalErrors = parseInt(match[1], 10);
    } else if (line.includes('Errors Left (Unfixed):')) {
      const match = line.match(/Errors Left \(Unfixed\):\s*(\d+)/);
      if (match) stats.errorsLeft = parseInt(match[1], 10);
    } else if (line.includes('Total Time:')) {
      const match = line.match(/Total Time:\s*([\d.]+)\s*seconds/);
      if (match) stats.totalTime = parseFloat(match[1]);
    } else if (line.includes('Accuracy:')) {
      const match = line.match(/Accuracy:\s*([\d.]+)%/);
      if (match) stats.accuracy = parseFloat(match[1]);
    } else if (line.includes('Speed:')) {
      const match = line.match(/Speed:\s*([\d.]+)\s*words per minute/);
      if (match) stats.speed = parseFloat(match[1]);
    }
  }

  return stats;
}
