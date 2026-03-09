import { state } from '../state.js';
import { showCompletionScreen } from '../completion.js';

export class RacingGame {
    constructor() {
      this.trackContainer = document.getElementById('racing-track-container');
      this.typingTextElement = document.getElementById('racing-typing-text');
      this.playerCar = document.getElementById('car-player');
      this.opponentCars = [
        document.getElementById('car-opponent-1'),
        document.getElementById('car-opponent-2'),
        document.getElementById('car-opponent-3')
      ];
      this.finishLine = document.getElementById('racing-finish-line');
      this.trackElement = this.trackContainer ? this.trackContainer.querySelector('.racing-track') : null;

      this.opponentPositions = [0, 0, 0];
      this.opponentSpeeds = state.config.racing?.opponentSpeeds || [0.3, 0.4, 0.5];
      // Convert speeds from pixels per frame (at 60fps) to pixels per second
      // Original speeds: 0.3, 0.4, 0.5 px/frame at 60fps = 18, 24, 30 px/s
      this.opponentSpeedsPxPerSec = this.opponentSpeeds.map(speed => speed * 60);
      // Current speeds with randomness (initialized to base speeds)
      this.currentOpponentSpeeds = [...this.opponentSpeedsPxPerSec];
      this.speedUpdateTimer = 0; // Timer for speed updates (in milliseconds)
      this.speedUpdateInterval = 1500 + Math.random() * 1000; // Update speed every 1.5-2.5 seconds
      this.lastFrameTime = null; // For delta time calculation
      this.trackWidth = 0;
      this.finishLineTextPosition = 0; // Position in text coordinates
      this.isFinished = false;
      this.playerWon = null; // null = not finished, true = player won, false = player lost
    }

    initialize() {
      if (!this.trackContainer || !this.trackElement) return;

      // Show racing track, hide classic view
      this.trackContainer.style.display = 'block';
      const classicContainer = document.getElementById('classic-typing-container');
      if (classicContainer) {
        classicContainer.style.display = 'none';
      }

      // Calculate track dimensions
      this.updateTrackDimensions();

      // Reset positions
      this.reset();
    }

    updateTrackDimensions() {
      if (!this.trackElement) return;
      this.trackWidth = this.trackElement.offsetWidth;
    }

    reset() {
      this.opponentPositions = [0, 0, 0];
      this.isFinished = false;
      this.finishLineTextPosition = 0;
      this.playerWon = null;
      this.currentOpponentSpeeds = [...this.opponentSpeedsPxPerSec];
      this.speedUpdateTimer = 0;
      this.speedUpdateInterval = 1500 + Math.random() * 1000;
      this.lastFrameTime = null;

      if (this.playerCar) {
        this.playerCar.style.left = '20px';
      }

      this.opponentCars.forEach((car, index) => {
        if (car) {
          car.style.left = '20px';
        }
        this.opponentPositions[index] = 0;
      });

      setTimeout(() => {
        this.updateFinishLinePosition();
      }, 0);
    }

    updateOpponentSpeeds() {
      this.opponentSpeedsPxPerSec.forEach((baseSpeed, index) => {
        const variation = 0.2;
        const randomFactor = 1 + (Math.random() * 2 - 1) * variation;
        this.currentOpponentSpeeds[index] = baseSpeed * randomFactor;
      });

      this.speedUpdateTimer = 0;
      this.speedUpdateInterval = 1500 + Math.random() * 1000;
    }

    updatePlayerPosition() {
      if (!this.playerCar || this.isFinished || !this.typingTextElement) return;

      const cursorElement = this.typingTextElement.querySelector('.cursor-position');
      if (!cursorElement) {
        const firstChar = this.typingTextElement.querySelector('span');
        if (firstChar) {
          const carWidth = 40;
          const position = 70 + firstChar.offsetLeft - carWidth;
          this.playerCar.style.left = `${Math.max(20, position)}px`;
        }
        return;
      }

      const cursorLeft = cursorElement.offsetLeft;
      const carWidth = 40;
      const position = 70 + cursorLeft - carWidth;

      this.playerCar.style.left = `${Math.max(20, position)}px`;

      this.updateFinishLinePosition();

      if (cursorLeft >= this.finishLineTextPosition && !this.isFinished) {
        this.isFinished = true;
        this.playerWon = true;
      }
    }

    updateFinishLinePosition() {
      if (!this.typingTextElement || !this.finishLine) return;

      const allChars = this.typingTextElement.querySelectorAll('span');
      if (allChars.length === 0) {
        const minWidth = 70;
        const lanes = this.trackElement ? this.trackElement.querySelectorAll('.racing-track-lane') : [];
        lanes.forEach(lane => {
          lane.style.width = `${minWidth}px`;
        });
        if (this.trackElement) {
          this.trackElement.style.width = `${minWidth}px`;
        }
        return;
      }

      const lastChar = allChars[allChars.length - 1];
      const finishLineTextPosition = lastChar.offsetLeft + lastChar.offsetWidth;
      this.finishLineTextPosition = finishLineTextPosition;

      const buffer = 20;
      const finishLinePosition = 70 + finishLineTextPosition + buffer;

      const lanes = this.trackElement ? this.trackElement.querySelectorAll('.racing-track-lane') : [];
      lanes.forEach(lane => {
        lane.style.width = `${finishLinePosition}px`;
      });

      if (this.trackElement) {
        this.trackElement.style.width = `${finishLinePosition}px`;
      }
    }

    updateOpponents(currentTime) {
      if (this.isFinished || !state.startTime) return;

      let deltaTime = 0;
      if (this.lastFrameTime !== null) {
        deltaTime = (currentTime - this.lastFrameTime) / 1000;
        deltaTime = Math.min(deltaTime, 0.1);
      }
      this.lastFrameTime = currentTime;

      if (deltaTime === 0) return;

      this.updateFinishLinePosition();

      this.speedUpdateTimer += deltaTime * 1000;
      if (this.speedUpdateTimer >= this.speedUpdateInterval) {
        this.updateOpponentSpeeds();
      }

      const trackWidth = this.trackElement ? this.trackElement.offsetWidth : 0;
      const finishLineX = trackWidth;

      this.opponentCars.forEach((car, index) => {
        if (!car) return;

        const speedPxPerSec = this.currentOpponentSpeeds[index] || this.opponentSpeedsPxPerSec[index] || 18;
        const movementThisFrame = speedPxPerSec * deltaTime;
        this.opponentPositions[index] += movementThisFrame;

        const carWidth = 40;
        const carLeftPosition = 20 + this.opponentPositions[index];
        const carFrontPosition = carLeftPosition + carWidth;

        const maxPosition = finishLineX > 0 ? finishLineX - 20 : this.trackWidth - 20;
        const position = Math.min(carLeftPosition, maxPosition);
        car.style.left = `${position}px`;

        const buffer = 10;
        if (finishLineX > 0 && carFrontPosition >= finishLineX - buffer && !this.isFinished) {
          this.isFinished = true;
          this.playerWon = false;
          console.log('Opponent finished first! Showing completion screen.');
          showCompletionScreen();
        }
      });
    }

    renderText(textHtml) {
      if (this.typingTextElement) {
        this.typingTextElement.innerHTML = textHtml;

        setTimeout(() => {
          this.updatePlayerPosition();
          this.updateFinishLinePosition();
        }, 0);
      }
    }

    destroy() {
      this.isFinished = false;
    }
  }
