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
    }
  }

  destroy() {
    // Cleanup if needed
  }
}
