// input.js — input event handling for all game modes

import { state } from './state.js';
import { highlightKey, isKeyAvailable } from './keyboard.js';
import { renderText } from './text.js';
import { updateRealtimeStats } from './stats.js';

export function handleInput(e) {
  let input = e.target.value;

  // Special handling for meteorite rain game (word-based typing)
  if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
    // Don't allow typing if game hasn't started
    if (!state.currentGame.hasStarted) {
      e.target.value = '';
      return;
    }

    // Filter out unavailable keys if availableKeys is configured
    if (state.availableKeysSet.size > 0) {
      let filteredInput = '';
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (isKeyAvailable(char)) {
          filteredInput += char;
        }
      }
      input = filteredInput;
      e.target.value = input;
    }

    // Update game with current typed word (no spaces allowed in word input)
    const currentWord = input.trim();
    if (state.currentGame.setTypedWord) {
      state.currentGame.setTypedWord(currentWord);
    }

    // Highlight keys for meteorite rain
    if (state.keyboardEnabled && currentWord.length > 0) {
      const lastChar = currentWord[currentWord.length - 1];
      highlightKey(lastChar, false);
    }

    return; // Don't process further for meteorite rain (Enter key handled in handleKeyDown)
  }

  // Special handling for tower defense game
  if (state.config.gameType === 'towerDefense' && state.currentGame) {
    // Don't allow typing if game hasn't started
    if (!state.currentGame.hasStarted) {
      // Start game immediately when user starts typing
      if (input.length > 0) {
        state.currentGame.beginGame();
        // Continue processing the input after starting the game
      } else {
        // No input yet, clear and return
        e.target.value = '';
        return;
      }
    }

    // Update typed word for tower defense (track only the current word being typed)
    // Extract the last word from input (everything after the last space)
    const lastSpaceIndex = input.lastIndexOf(' ');
    const previousTypedWord = state.currentGame.typedWord || '';
    if (lastSpaceIndex === -1) {
      // No space found, entire input is the current word
      state.currentGame.typedWord = input;
    } else {
      // Get everything after the last space
      state.currentGame.typedWord = input.substring(lastSpaceIndex + 1);
    }

    // Highlight keyboard key for the last character typed
    if (state.keyboardEnabled && state.currentGame.typedWord.length > previousTypedWord.length) {
      // A new character was added
      const lastChar = state.currentGame.typedWord[state.currentGame.typedWord.length - 1];
      const currentWord = state.currentGame.currentWord;

      if (currentWord && state.currentGame.typedWord.length <= currentWord.length) {
        // Check if the character is correct
        const expectedChar = currentWord[state.currentGame.typedWord.length - 1];
        const isError = lastChar !== expectedChar;
        highlightKey(lastChar, isError);
      } else {
        // Character beyond word length - treat as error
        highlightKey(lastChar, true);
      }
    } else if (state.keyboardEnabled && state.currentGame.typedWord.length < previousTypedWord.length) {
      // Backspace was used
      if (isKeyAvailable('backspace')) {
        highlightKey('backspace', false);
      }
    }

    // Update word display
    if (state.currentGame.updateWordDisplay) {
      state.currentGame.updateWordDisplay();
    }

    // Don't process further for tower defense (word-based, not character-based)
    // But allow the input to be stored normally
    return;
  }

  // Original character-by-character handling for other game types
  // Filter out unavailable keys if availableKeys is configured
  if (state.availableKeysSet.size > 0) {
    let filteredInput = '';
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (isKeyAvailable(char)) {
        filteredInput += char;
      }
    }
    input = filteredInput;
    e.target.value = input;
  }

  // Start timer on first keypress
  if (state.startTime === null && input.length > 0) {
    state.startTime = Date.now();
  }

  // Prevent typing beyond the original text length
  if (input.length > state.originalText.length) {
    input = input.slice(0, state.originalText.length);
    e.target.value = input;
  }

  const inputLength = input.length;
  const typedLength = state.typedText.length;

  // Handle typing forward
  if (inputLength > typedLength) {
    const newChars = input.slice(typedLength);
    let validInput = state.typedText; // Start with current valid text

    for (let i = 0; i < newChars.length; i++) {
      const charIndex = typedLength + i;
      if (charIndex >= state.originalText.length) {
        break;
      }

      const expectedChar = state.originalText[charIndex];
      const typedChar = newChars[i];

      state.totalInputs++; // Track total inputs

      const isError = typedChar !== expectedChar;
      if (isError) {
        state.totalErrors++; // Track total errors

        // Highlight keyboard key to show error
        if (state.keyboardEnabled) {
          highlightKey(typedChar, true);
        }

        if (state.config.allowMistakes && state.config.gameType !== 'racing') {
          // Natural typing (non-racing): accept the wrong character (shown as
          // incorrect) and keep going. It counts against accuracy and remains an
          // "error left" until the user backspaces to fix it. Racing is excluded
          // because its completion requires every character to be correct;
          // accepting wrong characters there would soft-lock the finish.
          validInput += typedChar;
          state.charStates[charIndex] = 'incorrect';
        } else {
          // Guided mode: reject the incorrect character and stop so the user
          // must correct it before advancing.
          e.target.value = validInput;
          input = validInput;
          break; // Stop processing further characters
        }
      } else {
        // Character is correct - add it to valid input
        validInput += typedChar;
        state.charStates[charIndex] = 'correct';

        // Highlight keyboard key
        if (state.keyboardEnabled) {
          highlightKey(typedChar, false);
        }
      }
    }
    state.typedText = validInput;
  }
  // Handle backspace/delete
  else if (inputLength < typedLength) {
    state.typedText = input;
    // Reset states for characters that are no longer typed
    for (let i = inputLength; i < state.originalText.length; i++) {
      if (i < state.charStates.length) {
        state.charStates[i] = 'pending';
      }
    }

    // Highlight backspace key (only if available)
    if (state.keyboardEnabled && isKeyAvailable('backspace')) {
      highlightKey('backspace', false);
    }
  }

  renderText();
  updateRealtimeStats();
}

export function handleKeyDown(e) {
  // Special handling for tower defense game
  if (state.config.gameType === 'towerDefense' && state.currentGame) {
    // If input is not focused and user starts typing, focus it
    if (state.hiddenInput && document.activeElement !== state.hiddenInput &&
        e.target !== state.hiddenInput &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.key.length === 1 && e.key.match(/[a-zA-Z0-9\s.,!?;:'"()-]/)) {
      state.hiddenInput.focus();
      // Let the key event propagate to the input
      return;
    }

    // Game starts automatically when user types (handled in handleInput)
    // No need to start on space key press

    // Space key checks word completion if game has started
    if ((e.key === ' ' || e.key === 'Space') && state.currentGame.hasStarted) {
      // Prevent default to handle space ourselves
      e.preventDefault();

      // Get current input value (before space is added)
      const input = state.hiddenInput ? state.hiddenInput.value : '';

      // Update typed word to current input (last word before space)
      state.currentGame.typedWord = input;

      // Check if word is complete
      if (state.currentGame.checkWordCompletion && state.currentGame.checkWordCompletion()) {
        // Word completed - complete it and select next word
        if (state.currentGame.completeWord) {
          state.currentGame.completeWord();
        }
        // Clear the input for next word
        if (state.hiddenInput) {
          state.hiddenInput.value = '';
          state.currentGame.typedWord = '';
        }
      } else {
        // Word not complete - don't add space, just update display
        // User needs to complete the word first
      }

      // Update word display
      if (state.currentGame.updateWordDisplay) {
        state.currentGame.updateWordDisplay();
      }
    }

    return;
  }

  // Special handling for meteorite rain game - Space key submits word or starts game
  if (state.config.gameType === 'meteoriteRain' && state.currentGame) {
    // Space key submits word or starts game
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault(); // Prevent default space behavior

      // If game hasn't started, start it
      if (!state.currentGame.hasStarted) {
        state.currentGame.beginGame();
        return;
      }

      if (state.meteoriteInput) {
        const wordToCheck = state.meteoriteInput.value.trim();
        if (wordToCheck.length > 0) {
          // Check if word matches a meteorite
          if (state.currentGame.checkWordMatch && state.currentGame.checkWordMatch(wordToCheck)) {
            // Word matched! Clear input
            state.meteoriteInput.value = '';
            if (state.currentGame.setTypedWord) {
              state.currentGame.setTypedWord('');
            }
          } else {
            // Word didn't match, clear input anyway (player can try again)
            state.meteoriteInput.value = '';
            if (state.currentGame.setTypedWord) {
              state.currentGame.setTypedWord('');
            }
          }
        }
      }
      return;
    }

    // Enter key can also start the game (for convenience)
    if ((e.key === 'Enter' || e.key === 'Return') && !state.currentGame.hasStarted) {
      e.preventDefault();
      state.currentGame.beginGame();
      return;
    }
  }

  // Handle Enter key for other game types - check availability but let textarea handle insertion
  if (e.key === 'Enter' || e.key === 'Return') {
    if (!isKeyAvailable('\n')) {
      e.preventDefault(); // Prevent if not available
      return;
    }

    // Check if we can still type (not beyond original text length)
    if (state.hiddenInput.value.length >= state.originalText.length) {
      e.preventDefault(); // Can't type beyond original text
      return;
    }

    // Let the browser handle the newline insertion naturally
    // Highlight keyboard key if enabled
    if (state.keyboardEnabled) {
      // Use setTimeout to highlight after the newline is inserted
      setTimeout(() => {
        highlightKey('\n', false);
      }, 0);
    }

    // The input event will fire naturally, no need to manually trigger
    return;
  }

  // Handle Tab key - manually insert tab character
  if (e.key === 'Tab') {
    e.preventDefault(); // Prevent tab from moving focus

    if (!isKeyAvailable('\t')) {
      return; // Key not available, don't insert
    }

    // Check if we can still type (not beyond original text length)
    if (state.hiddenInput.value.length >= state.originalText.length) {
      return; // Can't type beyond original text
    }

    // Get current cursor position
    const cursorPos = state.hiddenInput.selectionStart || state.hiddenInput.value.length;

    // Insert tab at cursor position
    const currentValue = state.hiddenInput.value;
    const newValue = currentValue.slice(0, cursorPos) + '\t' + currentValue.slice(cursorPos);

    // Update input value
    state.hiddenInput.value = newValue;

    // Move cursor after the inserted tab
    setTimeout(() => {
      state.hiddenInput.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }, 0);

    // Highlight keyboard key if enabled
    if (state.keyboardEnabled) {
      highlightKey('\t', false);
    }

    // Manually trigger input event to process the tab
    const inputEvent = new Event('input', { bubbles: true });
    state.hiddenInput.dispatchEvent(inputEvent);

    return;
  }

  // Prevent unavailable keys from being typed (skip for meteorite rain - it has its own input)
  if (state.config.gameType !== 'meteoriteRain' && state.availableKeysSet.size > 0 && !isKeyAvailable(e.key)) {
    e.preventDefault();
    return;
  }

  // Prevent default behavior for backspace when at start (only for hiddenInput, not meteorite input)
  if (e.key === 'Backspace' && e.target === state.hiddenInput && state.hiddenInput.value.length === 0) {
    e.preventDefault();
  }
}
