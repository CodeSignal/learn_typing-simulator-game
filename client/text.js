// text.js — text loading and rendering

import { state } from './state.js';
import { showCompletionScreen } from './completion.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export async function loadText() {
  try {
    const response = await fetch('./text-to-input.txt');
    if (!response.ok) {
      throw new Error('Failed to load text file');
    }
    state.originalText = await response.text();
    // Replace all newlines with spaces (for single-line display in racing mode)
    state.originalText = state.originalText.replace(/\n/g, ' ');
    // Trim trailing whitespace
    state.originalText = state.originalText.trimEnd();

    // Initialize character states
    state.charStates.length = 0;
    for (let i = 0; i < state.originalText.length; i++) {
      state.charStates.push('pending');
    }

    renderText();

    // For tower defense, extract words and update display after text loads
    if (state.config.gameType === 'towerDefense' && state.currentGame) {
      if (state.currentGame.extractWords) {
        state.currentGame.extractWords();
      }
      if (state.currentGame.updateWordDisplay) {
        state.currentGame.updateWordDisplay();
      }
    }
  } catch (error) {
    console.error('Error loading text:', error);
    if (state.textContainer) {
      state.textContainer.innerHTML = '<p>Error: Could not load text file.</p>';
    }
  }
}

export function renderText() {
  // Calculate correct characters count
  let correctCharsCount = 0;
  for (let i = 0; i < state.charStates.length; i++) {
    if (state.charStates[i] === 'correct') {
      correctCharsCount++;
    }
  }

  // Completion threshold: racing always requires the full passage (finish-line semantics).
  // Classic mode may use racing.mistakesAllowed to allow finishing with fewer correct chars (legacy key location).
  const textLength = state.originalText.length;
  const isRacing = state.config.gameType === 'racing';
  const mistakesAllowed = state.config.racing?.mistakesAllowed ?? 0;
  const requiredCorrectChars = isRacing
    ? textLength
    : textLength - mistakesAllowed;

  if (correctCharsCount >= requiredCorrectChars && textLength > 0) {
    console.log('Completion detected! Showing completion screen.');
    console.log('Correct chars:', correctCharsCount, 'Required:', requiredCorrectChars);

    // For racing game, mark player as winner if not already finished
    if (state.config.gameType === 'racing' && state.currentGame && !state.currentGame.isFinished) {
      state.currentGame.isFinished = true;
      state.currentGame.playerWon = true;
    }

    showCompletionScreen();
    return;
  }

  // Hide completion screen if visible
  if (state.completionScreen) {
    state.completionScreen.style.display = 'none';
  }

  // Render text based on game type
  const isTowerDefense = state.config.gameType === 'towerDefense';

  // For tower defense, only render the current word (handled by updateWordDisplay)
  if (isTowerDefense && state.currentGame) {
    if (state.currentGame.updateWordDisplay) {
      state.currentGame.updateWordDisplay();
    }
    return; // Word display is handled separately
  }

  let html = '';
  const currentPosition = state.typedText.length;

  for (let i = 0; i < state.originalText.length; i++) {
    const char = state.originalText[i];
    const charState = state.charStates[i];
    let className = 'char-';

    if (i < state.typedText.length) {
      // Character has been typed
      if (charState === 'incorrect') {
        className += 'incorrect';
      } else {
        className += 'correct';
      }
    } else {
      // Character not yet typed
      className += 'pending';
    }

    // Handle special characters that need escaping
    let displayChar = char;
    const isSpace = char === ' ';
    if (isSpace) {
      displayChar = '\u00A0'; // Non-breaking space
      className += ' char-space'; // Add class to identify spaces
    } else if (char === '\n') {
      // For racing, convert newlines to spaces (single line display)
      displayChar = isRacing ? '\u00A0' : '<br>';
      if (isRacing) {
        className += ' char-space'; // Add class for newlines converted to spaces
      }
    } else {
      displayChar = escapeHtml(char);
    }

    // Add cursor class to the character at the typing position
    if (i === currentPosition) {
      className += ' cursor-position';
    }

    html += `<span class="${className}">${displayChar}</span>`;
  }

  // If all characters are typed, add a cursor position marker at the end
  if (currentPosition === state.originalText.length) {
    html += '<span class="char-pending cursor-position">\u00A0</span>';
  }

  // Use game's renderText method
  if (state.currentGame && state.currentGame.renderText) {
    state.currentGame.renderText(html);
  } else if (state.textContainer) {
    // Fallback to classic rendering
    state.textContainer.innerHTML = html;
  }

  // Update player position in racing game (car follows cursor)
  if (isRacing && state.currentGame && state.currentGame.updatePlayerPosition) {
    state.currentGame.updatePlayerPosition();
  }
}
