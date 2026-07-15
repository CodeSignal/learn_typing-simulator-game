// classic-game.js — Classic typing game (original behavior)

export class ClassicGame {
  constructor() {
    this.textContainer = document.getElementById('typing-text');
  }

  initialize() {
    // Show classic view, hide racing track
    const classicContainer = document.getElementById('classic-typing-container');
    const racingContainer = document.getElementById('racing-track-container');

    if (classicContainer) {
      classicContainer.style.display = 'flex';
    }
    if (racingContainer) {
      racingContainer.style.display = 'none';
    }
  }

  reset() {
    // Nothing to reset for classic game
  }

  updatePlayerPosition(progress) {
    // No visual position update for classic game
  }

  updateOpponents() {
    // No opponents in classic game
  }

  renderText(textHtml) {
    if (this.textContainer) {
      this.textContainer.innerHTML = textHtml;
      this.scrollCursorIntoView();
    }
  }

  // Keep the current typing position visible for passages taller than the view.
  scrollCursorIntoView() {
    const container = this.textContainer.closest('.typing-text-container');
    if (!container) return;
    const cursor = this.textContainer.querySelector('.cursor-position');
    if (!cursor) return;

    const containerRect = container.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    // Distance from the cursor to the vertical center of the viewport.
    const delta = (cursorRect.top - containerRect.top) - container.clientHeight / 2;
    // Only adjust when the cursor has drifted meaningfully to avoid jitter.
    if (Math.abs(delta) > 4) {
      container.scrollTop += delta;
    }
  }

  destroy() {
    // Cleanup if needed
  }
}
