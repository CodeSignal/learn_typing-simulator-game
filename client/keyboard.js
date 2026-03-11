// keyboard.js — keyboard layout, rendering, and highlight logic

import { state } from './state.js';

// Keyboard layout definition
const keyboardLayout = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift'],
  ['space']
];

// Map special keys to display names
const keyDisplayNames = {
  'backspace': '⌫',
  'tab': 'Tab',
  'caps': 'Caps',
  'enter': 'Enter',
  'shift': 'Shift',
  'space': 'Space'
};

// Check if a key is available for typing
// Accepts both character values (from input) and KeyboardEvent.key values
export function isKeyAvailable(key) {
  // Space, comma, dot, backspace, and enter are ALWAYS available
  const keyLower = key.toLowerCase();
  if (key === ' ' || key === '\u00A0' || key === ',' || key === '.' ||
      key === 'Backspace' || key === '\b' || key === 'Enter' || key === 'Return' ||
      key === '\n' || key === '\r' ||
      keyLower === 'space' || keyLower === 'comma' || keyLower === 'dot' ||
      keyLower === 'backspace' || keyLower === 'enter') {
    return true;
  }

  // If no available keys are configured, all keys are available
  if (state.availableKeysSet.size === 0) {
    return true;
  }

  // Handle KeyboardEvent.key values (e.g., "Tab")
  if (key === 'Tab' || keyLower === 'tab') {
    return state.availableKeysSet.has('tab');
  }

  // Handle character values (from input events)
  if (key === '\t') {
    return state.availableKeysSet.has('tab');
  }

  // For regular keys, normalize to lowercase and check
  // Handle both single characters and KeyboardEvent.key values
  const normalizedKey = key.length === 1 ? key.toLowerCase() : keyLower;
  return state.availableKeysSet.has(normalizedKey);
}

// Get key element by character
function getKeyElement(char) {
  if (!state.keyboardContainer) return null;

  // Normalize character
  const normalizedChar = char.toLowerCase();

  // Handle special keys
  if (char === ' ') {
    return state.keyboardContainer.querySelector('[data-key="space"]');
  }
  if (char === '\n' || char === '\r') {
    return state.keyboardContainer.querySelector('[data-key="enter"]');
  }
  if (char === '\t') {
    return state.keyboardContainer.querySelector('[data-key="tab"]');
  }

  // Find regular key
  return state.keyboardContainer.querySelector(`[data-key="${normalizedChar}"]`);
}

// Highlight a key on the keyboard
export function highlightKey(char, isError = false) {
  // Don't highlight unavailable keys
  if (!isKeyAvailable(char)) {
    return;
  }

  // Clear previous highlight
  if (state.activeKeyElement) {
    state.activeKeyElement.classList.remove('active', 'active-error');
  }

  // Clear timeout if exists
  if (state.activeKeyTimeout) {
    clearTimeout(state.activeKeyTimeout);
  }

  const keyElement = getKeyElement(char);
  if (keyElement) {
    state.activeKeyElement = keyElement;
    if (isError) {
      keyElement.classList.add('active-error');
    } else {
      keyElement.classList.add('active');
    }

    // Remove highlight after animation
    state.activeKeyTimeout = setTimeout(() => {
      if (keyElement) {
        keyElement.classList.remove('active', 'active-error');
      }
      state.activeKeyElement = null;
    }, 200);
  }
}

// Clear the active keyboard highlight
export function clearKeyHighlight() {
  if (state.activeKeyElement) {
    state.activeKeyElement.classList.remove('active', 'active-error');
    state.activeKeyElement = null;
  }
  if (state.activeKeyTimeout) {
    clearTimeout(state.activeKeyTimeout);
    state.activeKeyTimeout = null;
  }
}

// Render the keyboard
function renderKeyboard() {
  if (!state.keyboardContainer) return;

  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';

  keyboardLayout.forEach(row => {
    const rowElement = document.createElement('div');
    rowElement.className = 'keyboard-row';

    row.forEach(key => {
      const keyElement = document.createElement('div');
      const normalizedKey = key.toLowerCase();
      keyElement.className = 'keyboard-key';
      keyElement.setAttribute('data-key', normalizedKey);

      // Check if this key is available (use isKeyAvailable to ensure space, comma, dot are always available)
      const isAvailable = isKeyAvailable(key);
      if (!isAvailable) {
        keyElement.classList.add('unavailable');
      }

      // Add special class for certain keys
      if (key === 'space' || key === 'enter' || key === 'shift' ||
          key === 'backspace' || key === 'tab' || key === 'caps') {
        keyElement.classList.add(key);
      }

      // Set display text
      if (keyDisplayNames[key]) {
        keyElement.textContent = keyDisplayNames[key];
      } else {
        keyElement.textContent = key.toUpperCase();
      }

      rowElement.appendChild(keyElement);
    });

    keyboard.appendChild(rowElement);
  });

  state.keyboardContainer.innerHTML = '';
  state.keyboardContainer.appendChild(keyboard);
}

// Initialize keyboard
export function initializeKeyboard() {
  state.keyboardContainer = document.getElementById('keyboard-container');
  if (!state.keyboardContainer) return;

  state.keyboardEnabled = state.config.keyboard === true;

  if (state.keyboardEnabled) {
    renderKeyboard();
    state.keyboardContainer.classList.add('visible');
  } else {
    state.keyboardContainer.classList.remove('visible');
  }
}
