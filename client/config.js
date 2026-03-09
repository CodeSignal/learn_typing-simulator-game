// config.js — load runtime configuration from config.json

import { state } from './state.js';

export async function loadConfig() {
  try {
    const response = await fetch('./config.json');
    if (!response.ok) {
      console.warn('Config file not found, using defaults');
      return;
    }
    state.config = await response.json();

    // Normalize available keys to lowercase for fast lookup
    // Empty array means all keys are available
    if (state.config.availableKeys && Array.isArray(state.config.availableKeys) && state.config.availableKeys.length > 0) {
      state.availableKeysSet = new Set(state.config.availableKeys.map(key => key.toLowerCase()));
    } else {
      state.availableKeysSet = new Set(); // Empty set means all keys available
    }

    // Set default game type if not specified
    if (!state.config.gameType) {
      state.config.gameType = 'classic';
    }
  } catch (error) {
    console.warn('Error loading config:', error);
  }
}
