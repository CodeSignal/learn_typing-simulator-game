// stats.js — statistics calculation, display, saving, parsing, and formatting

import { state } from './state.js';

function createCharsProgress(typed = 0, total = state.originalText.length) {
  return { typed, total };
}

function createEmptySnapshot(chars = createCharsProgress()) {
  return {
    totalErrors: 0,
    errorsLeft: 0,
    totalTime: 0,
    accuracy: 0,
    speed: 0,
    chars
  };
}

function getElapsedSeconds(startTime, now = Date.now()) {
  if (startTime === null || startTime === undefined) {
    return 0;
  }

  return Math.max(0, (now - startTime) / 1000);
}

function countErrorsLeft() {
  let errorsLeft = 0;

  for (let i = 0; i < state.charStates.length; i++) {
    if (state.charStates[i] === 'incorrect') {
      errorsLeft++;
    }
  }

  return errorsLeft;
}

function calculateAccuracy(totalInputs, totalErrors) {
  if (totalInputs <= 0) {
    return 0;
  }

  const correctInputs = totalInputs - totalErrors;
  return (correctInputs / totalInputs) * 100;
}

function calculateSpeed(charsTyped, totalTimeSeconds) {
  if (totalTimeSeconds <= 0) {
    return 0;
  }

  return (charsTyped / 5) / (totalTimeSeconds / 60);
}

// Levenshtein edit distance. Works over strings (char-level) or arrays of
// strings (word-level), since it only relies on indexing and strict equality.
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function getTextCharsProgress() {
  return createCharsProgress(state.typedText.length, state.originalText.length);
}

function getMeteoriteCharsTyped() {
  if (!state.currentGame) {
    return 0;
  }

  const score = state.currentGame.getScore ? state.currentGame.getScore() : 0;
  const pointsPerChar = state.currentGame.pointsPerChar ?? state.config.meteoriteRain?.pointsPerChar ?? 100;
  return pointsPerChar > 0 ? score / pointsPerChar : 0;
}

function getMeteoriteCharsProgress() {
  return createCharsProgress(getMeteoriteCharsTyped(), state.originalText.length);
}

function buildTextModeSnapshot(now) {
  const chars = getTextCharsProgress();

  if (state.startTime === null) {
    return null;
  }

  const totalTime = getElapsedSeconds(state.startTime, now);

  return {
    totalErrors: state.totalErrors,
    errorsLeft: countErrorsLeft(),
    totalTime,
    accuracy: calculateAccuracy(state.totalInputs, state.totalErrors),
    speed: calculateSpeed(chars.typed, totalTime),
    chars
  };
}

function buildMeteoriteSnapshot(now) {
  const chars = getMeteoriteCharsProgress();
  const gameStartTime = state.currentGame?.gameStartTime ?? null;
  const totalTime = getElapsedSeconds(gameStartTime, now);

  return {
    totalErrors: 0,
    errorsLeft: 0,
    totalTime,
    accuracy: 100,
    speed: calculateSpeed(chars.typed, totalTime),
    chars
  };
}

// Audio dictation: the target text is hidden and spoken aloud, and the user
// transcribes it freely. Accuracy is a character-level similarity and
// "errors left" is the count of mis-transcribed words (word-level distance).
function buildAudioSnapshot(now) {
  const target = state.originalText || '';
  const typed = (state.currentGame && state.currentGame.typedText) || state.typedText || '';

  if (state.startTime === null) {
    return null;
  }

  const totalTime = getElapsedSeconds(state.startTime, now);
  const charDistance = editDistance(typed, target);
  const targetWords = target.trim().split(/\s+/).filter(Boolean);
  const typedWords = typed.trim().split(/\s+/).filter(Boolean);
  const wordDistance = editDistance(typedWords, targetWords);
  const maxChars = Math.max(target.length, typed.length, 1);
  const accuracy = Math.max(0, (1 - charDistance / maxChars) * 100);

  return {
    totalErrors: charDistance,
    errorsLeft: wordDistance,
    totalTime,
    accuracy,
    speed: calculateSpeed(typed.length, totalTime),
    chars: createCharsProgress(typed.length, target.length)
  };
}

function buildStatsSnapshot({ mode = 'realtime', now = Date.now() } = {}) {
  if (state.config.gameType === 'meteoriteRain') {
    return buildMeteoriteSnapshot(now);
  }

  if (state.config.gameType === 'audio') {
    const audioSnapshot = buildAudioSnapshot(now);
    if (audioSnapshot) {
      return audioSnapshot;
    }
    if (mode === 'completion') {
      return null;
    }
    return createEmptySnapshot(getTextCharsProgress());
  }

  const textModeSnapshot = buildTextModeSnapshot(now);
  if (textModeSnapshot) {
    return textModeSnapshot;
  }

  if (mode === 'completion') {
    return null;
  }

  return createEmptySnapshot(getTextCharsProgress());
}

function formatFixed(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

export function formatDuration(seconds) {
  if (seconds < 60) {
    return `${formatFixed(seconds, 1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = formatFixed(seconds % 60, 1);
  return `${minutes}m ${remainingSeconds}s`;
}

const STAT_DEFINITIONS = {
  speed: {
    label: 'WPM',
    select: (stats) => stats.speed ?? 0,
    format: (value) => formatFixed(value, 1)
  },
  accuracy: {
    label: 'Accuracy',
    select: (stats) => stats.accuracy ?? 0,
    format: (value) => `${formatFixed(value, 1)}%`
  },
  time: {
    label: 'Time',
    select: (stats) => stats.totalTime ?? stats.time ?? 0,
    format: (value) => formatDuration(value)
  },
  errors: {
    label: 'Errors',
    select: (stats) => stats.totalErrors ?? stats.errors ?? 0,
    format: (value) => Math.round(value).toString()
  },
  errorsLeft: {
    label: 'Errors Left',
    select: (stats) => stats.errorsLeft ?? 0,
    format: (value) => Math.round(value).toString()
  },
  chars: {
    label: 'Chars',
    select: (stats) => stats.chars ?? createCharsProgress(),
    format: (value) => `${value.typed}/${value.total}`
  }
};

function getStatDefinition(statKey) {
  return STAT_DEFINITIONS[statKey] ?? null;
}

function buildRealtimeStatsFromSnapshot(snapshot) {
  return {
    speed: snapshot.speed,
    accuracy: snapshot.accuracy,
    time: snapshot.totalTime,
    errors: snapshot.totalErrors,
    errorsLeft: snapshot.errorsLeft,
    chars: snapshot.chars
  };
}

function buildStatsPrefix() {
  if (state.config.gameType === 'racing' && state.currentGame && state.currentGame.playerWon !== null) {
    const status = state.currentGame.playerWon ? 'win' : 'lose';
    return `Status: ${status}\n\n`;
  }

  if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
    const score = state.currentGame.getScore ? state.currentGame.getScore() : 0;
    return `Score: ${score}\n\n`;
  }

  return '';
}

function serializeStatsText(stats) {
  return `${buildStatsPrefix()}Typing Statistics
==================

Total Errors Made: ${stats.totalErrors}
Errors Left (Unfixed): ${stats.errorsLeft}
Total Time: ${stats.totalTime.toFixed(2)} seconds
Accuracy: ${stats.accuracy.toFixed(2)}%
Speed: ${stats.speed.toFixed(2)} words per minute

Generated: ${new Date().toLocaleString()}
`;
}

export function createEmptyStatistics() {
  return createEmptySnapshot(createCharsProgress());
}

export function calculateRealtimeStats() {
  const snapshot = buildStatsSnapshot({ mode: 'realtime' }) ?? createEmptyStatistics();
  return buildRealtimeStatsFromSnapshot(snapshot);
}

export function calculateCompletionStats() {
  return buildStatsSnapshot({ mode: 'completion' });
}

export function calculateStatistics() {
  return calculateCompletionStats();
}

export function formatStatValue(statKey, stats) {
  const definition = getStatDefinition(statKey);
  if (!definition) {
    return '';
  }

  return definition.format(definition.select(stats));
}

// Update real-time stats display
export function updateRealtimeStats() {
  if (!state.realtimeStatsContainer) return;

  if (!Array.isArray(state.config.realTimeStats) || state.config.realTimeStats.length === 0) {
    state.realtimeStatsContainer.style.display = 'none';
    if (state.realtimeStatsInterval) {
      clearInterval(state.realtimeStatsInterval);
      state.realtimeStatsInterval = null;
    }
    return;
  }

  const stats = calculateRealtimeStats();
  state.realtimeStatsContainer.style.display = 'flex';
  state.realtimeStatsContainer.innerHTML = '';

  state.config.realTimeStats.forEach((statKey) => {
    const definition = getStatDefinition(statKey);
    if (!definition) {
      return;
    }

    const statItem = document.createElement('div');
    statItem.className = 'realtime-stat-item';

    const statLabel = document.createElement('span');
    statLabel.className = 'realtime-stat-label';
    statLabel.textContent = definition.label;

    const statValue = document.createElement('span');
    statValue.className = 'realtime-stat-value';
    statValue.textContent = formatStatValue(statKey, stats);

    statItem.appendChild(statLabel);
    statItem.appendChild(statValue);
    state.realtimeStatsContainer.appendChild(statItem);
  });

  const hasActiveTimer = state.config.gameType === 'meteoriteRain' || state.startTime !== null;

  if (hasActiveTimer && !state.realtimeStatsInterval) {
    state.realtimeStatsInterval = setInterval(() => {
      updateRealtimeStats();
    }, 100);
  }
}

export async function saveStatistics(stats) {
  try {
    const response = await fetch('/save-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: serializeStatsText(stats)
    });

    if (response.ok) {
      await response.json();
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
    if (line.includes('Status:')) {
      const match = line.match(/Status:\s*(win|lose)/i);
      if (match) stats.status = match[1].toLowerCase();
    } else if (line.includes('Score:')) {
      const match = line.match(/Score:\s*(\d+)/i);
      if (match) stats.score = parseInt(match[1], 10);
    } else if (line.includes('Total Errors Made:')) {
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
    } else if (line.includes('Generated:')) {
      const match = line.match(/Generated:\s*(.+)/);
      if (match) stats.generated = match[1].trim();
    }
  }

  return stats;
}
