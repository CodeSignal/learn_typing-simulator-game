import { state } from '../state.js';
import { showCompletionScreen } from '../completion.js';

const meteoriteSkylineUrl = new URL('../assets/meteorite-skyline.svg', import.meta.url);

export class MeteoriteRainGame {
    constructor() {
      this.container = document.getElementById('meteorite-rain-container');
      this.playArea = document.getElementById('meteorite-play-area');
      this.skylineContainer = document.getElementById('meteorite-skyline');
      this.scoreElement = document.getElementById('meteorite-score');
      this.livesElement = document.getElementById('meteorite-lives');
      this.typingInput = document.getElementById('meteorite-typing-input');
      this.ground = document.getElementById('meteorite-ground');
      this.startMessage = document.getElementById('meteorite-start-message');
      this.heartElements = null;

      this.meteorites = [];
      this.words = [];
      this.score = 0;
      this.lives = 3;
      this.isFinished = false;
      this.hasStarted = false;
      this.currentTypedWord = '';
      this.spawnTimer = 0;
      this.lastFrameTime = null;
      this.gameStartTime = null;
      this.pointsPerChar = state.config.meteoriteRain?.pointsPerChar || 100;
      this.spawnIntervalId = null;
      this.animationFrame = null;
      this.startKeyListener = null;
      this.skylineLoadPromise = null;

      // Difficulty settings
      const difficultyConfig = state.config.meteoriteRain?.difficulty || {};
      this.baseSpawnInterval = difficultyConfig.baseSpawnInterval || state.config.meteoriteRain?.spawnInterval || 2000;
      this.minSpawnInterval = difficultyConfig.minSpawnInterval || 500;
      this.baseSpeed = difficultyConfig.baseSpeed || state.config.meteoriteRain?.meteoriteSpeed || 50;
      this.maxSpeed = difficultyConfig.maxSpeed || 150;
      this.difficultyIncreaseRate = difficultyConfig.difficultyIncreaseRate || 0.1;
    }

    initialize() {
      if (!this.container || !this.playArea) return;

      // Show meteorite rain container, hide others
      this.container.style.display = 'flex';
      const classicContainer = document.getElementById('classic-typing-container');
      const racingContainer = document.getElementById('racing-track-container');
      if (classicContainer) {
        classicContainer.style.display = 'none';
      }
      if (racingContainer) {
        racingContainer.style.display = 'none';
      }

      void this.initializeSkyline();

      // Reset game state
      this.reset();
    }

    async initializeSkyline() {
      if (!this.skylineContainer) {
        return;
      }

      if (this.skylineContainer.dataset.loaded === 'true') {
        return;
      }

      if (this.skylineLoadPromise) {
        return this.skylineLoadPromise;
      }

      this.skylineLoadPromise = fetch(meteoriteSkylineUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load meteorite skyline: ${response.status}`);
          }

          return response.text();
        })
        .then(svgMarkup => {
          this.skylineContainer.innerHTML = svgMarkup;
          this.skylineContainer.dataset.loaded = 'true';
        })
        .catch(error => {
          console.error('Failed to initialize meteorite skyline:', error);
        })
        .finally(() => {
          this.skylineLoadPromise = null;
        });

      return this.skylineLoadPromise;
    }

    extractWords() {
      // Split text into words (split by whitespace and filter empty strings)
      this.words = state.originalText
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.toLowerCase().trim());

      // Remove duplicates while preserving order
      this.words = [...new Set(this.words)];

      console.log('Extracted words:', this.words);
    }

    reset() {
      // Extract words if not already extracted
      if (this.words.length === 0 && state.originalText.length > 0) {
        this.extractWords();
      }

      // Clear all meteorites
      this.meteorites.forEach(meteorite => {
        if (meteorite.element && meteorite.element.parentNode) {
          meteorite.element.parentNode.removeChild(meteorite.element);
        }
      });
      this.meteorites = [];

      // Reset game state
      this.score = 0;
      this.lives = 3;
      this.isFinished = false;
      this.hasStarted = false;
      this.currentTypedWord = '';
      this.spawnTimer = 0;
      this.lastFrameTime = null;
      this.gameStartTime = null;
      this.heartElements = null;

      // Remove old start key listener if exists
      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }

      // Show start message
      if (this.startMessage) {
        this.startMessage.style.display = 'flex';
      }

      // Update UI
      this.updateScore();
      this.updateLives();
      this.updateTypingDisplay();

      // Clear intervals and animation frames
      if (this.spawnIntervalId) {
        clearTimeout(this.spawnIntervalId);
        this.spawnIntervalId = null;
      }
      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }

    getCurrentDifficulty() {
      if (!this.gameStartTime) return 0;
      const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
      return Math.min(elapsedSeconds * this.difficultyIncreaseRate, 1.0);
    }

    getRandomSpawnInterval() {
      const difficulty = this.getCurrentDifficulty();
      const minInterval = this.minSpawnInterval;
      const maxInterval = this.baseSpawnInterval;
      const currentMaxInterval = maxInterval - (maxInterval - minInterval) * difficulty;

      const randomFactor = 0.7 + Math.random() * 0.3;
      return Math.max(minInterval, currentMaxInterval * randomFactor);
    }

    getCurrentSpeed() {
      const difficulty = this.getCurrentDifficulty();
      return this.baseSpeed + (this.maxSpeed - this.baseSpeed) * difficulty;
    }

    spawnMeteorite() {
      if (this.isFinished || !this.hasStarted || this.words.length === 0) return;

      const word = this.words[Math.floor(Math.random() * this.words.length)];
      const currentSpeed = this.getCurrentSpeed();

      const meteorite = document.createElement('div');
      meteorite.className = 'meteorite';

      const circle = document.createElement('div');
      circle.className = 'meteorite-circle';

      const wordElement = document.createElement('div');
      wordElement.className = 'meteorite-word';
      wordElement.textContent = word;

      meteorite.appendChild(circle);
      meteorite.appendChild(wordElement);
      this.playArea.appendChild(meteorite);

      const padding = 100;
      const maxX = this.playArea.offsetWidth - padding;
      const x = padding + Math.random() * (maxX - padding);

      meteorite.style.left = `${x}px`;
      meteorite.style.top = '0px';

      const meteoriteData = {
        element: meteorite,
        word: word,
        y: 0,
        x: x,
        speed: currentSpeed
      };

      this.meteorites.push(meteoriteData);
    }

    updateMeteorites(currentTime) {
      if (this.isFinished || !this.hasStarted) return;

      let deltaTime = 0;
      if (this.lastFrameTime !== null) {
        deltaTime = (currentTime - this.lastFrameTime) / 1000;
        deltaTime = Math.min(deltaTime, 0.1);
      }
      this.lastFrameTime = currentTime;

      if (deltaTime === 0) return;

      const playAreaHeight = this.playArea.offsetHeight;
      const groundHeight = this.ground ? this.ground.offsetHeight : 20;

      this.meteorites.forEach((meteorite, index) => {
        const speedPxPerSec = meteorite.speed || this.baseSpeed;
        const movementThisFrame = speedPxPerSec * deltaTime;
        meteorite.y += movementThisFrame;
        meteorite.element.style.top = `${meteorite.y}px`;

        const meteoriteBottom = meteorite.y + meteorite.element.offsetHeight;
        if (meteoriteBottom >= playAreaHeight - groundHeight) {
          this.loseLife();
          this.destroyMeteorite(index);
        }
      });

      if (this.lives <= 0 && !this.isFinished) {
        this.endGame();
      }
    }

    destroyMeteorite(index) {
      const meteorite = this.meteorites[index];
      if (meteorite && meteorite.element && meteorite.element.parentNode) {
        meteorite.element.parentNode.removeChild(meteorite.element);
      }
      this.meteorites.splice(index, 1);
    }

    checkWordMatch(typedWord) {
      if (!typedWord || typedWord.length === 0) return false;

      const typedLower = typedWord.toLowerCase().trim();

      for (let i = 0; i < this.meteorites.length; i++) {
        const meteorite = this.meteorites[i];
        if (meteorite.word.toLowerCase() === typedLower) {
          const points = meteorite.word.length * this.pointsPerChar;
          this.score += points;
          this.updateScore();
          this.destroyMeteorite(i);
          return true;
        }
      }
      return false;
    }

    loseLife() {
      if (this.lives > 0) {
        this.lives--;
        this.updateLives();
      }
    }

    endGame() {
      this.isFinished = true;

      if (this.spawnIntervalId) {
        clearTimeout(this.spawnIntervalId);
        this.spawnIntervalId = null;
      }

      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      showCompletionScreen();
    }

    updateScore() {
      if (this.scoreElement) {
        this.scoreElement.textContent = this.score;
      }
    }

    updateLives() {
      if (!this.livesElement) return;

      if (!this.heartElements) {
        this.heartElements = this.livesElement.querySelectorAll('.meteorite-heart');
      }

      if (this.heartElements) {
        this.heartElements.forEach((heart, index) => {
          if (index < this.lives) {
            heart.style.display = 'inline-block';
          } else {
            heart.style.display = 'none';
          }
        });
      }
    }

    updateTypingDisplay() {
      // Input element is managed by handleInput, no need to update display separately
    }

    setTypedWord(word) {
      this.currentTypedWord = word;
    }

    beginGame() {
      this.hasStarted = true;

      if (this.startMessage) {
        this.startMessage.style.display = 'none';
      }

      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }

      this.gameStartTime = Date.now();

      this.spawnMeteorite();

      const scheduleNextSpawn = () => {
        if (this.isFinished || !this.hasStarted) return;

        const nextInterval = this.getRandomSpawnInterval();
        this.spawnIntervalId = setTimeout(() => {
          if (!this.isFinished && this.hasStarted) {
            this.spawnMeteorite();
            scheduleNextSpawn();
          }
        }, nextInterval);
      };

      scheduleNextSpawn();

      const animate = (currentTime) => {
        if (this.isFinished || !this.hasStarted) return;
        this.updateMeteorites(currentTime);
        this.animationFrame = requestAnimationFrame(animate);
      };
      this.animationFrame = requestAnimationFrame(animate);

      if (this.typingInput) {
        setTimeout(() => {
          if (this.typingInput) {
            this.typingInput.focus();
          }
        }, 100);
      }
    }

    startGame() {
      this.setupStartListener();
    }

    setupStartListener() {
      this.startKeyListener = (e) => {
        if (this.hasStarted || this.isFinished) return;

        if (e.key === 'Enter' || e.key === 'Return' || e.key === ' ' || e.key === 'Space') {
          e.preventDefault();
          this.beginGame();
        }
      };

      document.addEventListener('keydown', this.startKeyListener);
    }

    renderText(textHtml) {
      // Not used in meteorite rain game
    }

    destroy() {
      if (this.spawnIntervalId) {
        clearTimeout(this.spawnIntervalId);
        this.spawnIntervalId = null;
      }
      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }
      this.reset();
    }

    getScore() {
      return this.score;
    }
  }
