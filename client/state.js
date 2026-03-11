// state.js — shared mutable state singleton
// All modules import this same object reference so mutations are visible everywhere.

export const state = {
  originalText: '',
  typedText: '',
  textContainer: null,
  hiddenInput: null,
  completionScreen: null,
  statsDashboard: null,
  restartButton: null,
  startOverButton: null,
  statsStartOverButton: null,
  keyboardContainer: null,
  realtimeStatsContainer: null,
  config: { keyboard: true, availableKeys: [], showStats: false, realTimeStats: [], gameType: 'classic' },

  // Normalized set of available keys (for fast lookup)
  availableKeysSet: new Set(),

  // Character states: 'pending', 'correct', 'incorrect'
  charStates: [],

  // Statistics tracking
  startTime: null,
  totalErrors: 0,
  totalInputs: 0,

  // Keyboard state
  keyboardEnabled: false,
  activeKeyElement: null,
  activeKeyTimeout: null,

  // Real-time stats update interval
  realtimeStatsInterval: null,

  // Game manager - handles different game types
  currentGame: null,
  gameUpdateInterval: null,
  gameAnimationFrame: null,

  // Cached DOM references
  meteoriteInput: null,
  keyboardStatsWrapper: null,
};
