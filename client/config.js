// config.js — load runtime configuration from config.json

import { state } from './state.js';
import { normalizeMarkingMode, normalizeErrorMetric } from './text-metrics.js';

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

    // How typed text is compared with the reference. Both default to
    // 'positional', which is the original behaviour, so a task that sets
    // neither renders and scores exactly as it always has. An unrecognised
    // value falls back rather than breaking the task.
    warnIfUnknown('markingMode', state.config.markingMode, normalizeMarkingMode);
    warnIfUnknown('errorMetric', state.config.errorMetric, normalizeErrorMetric);
    state.config.markingMode = normalizeMarkingMode(state.config.markingMode);
    state.config.errorMetric = normalizeErrorMetric(state.config.errorMetric);
  } catch (error) {
    console.warn('Error loading config:', error);
  }
}

function warnIfUnknown(key, value, normalize) {
  if (value !== undefined && normalize(value) !== value) {
    console.warn(`Unknown ${key} "${value}", falling back to "${normalize(value)}"`);
  }
}
