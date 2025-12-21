// typing-simulator.js
(function() {
  let originalText = '';
  let typedText = '';
  let textContainer = null;
  let hiddenInput = null;
  let completionScreen = null;
  let statsDashboard = null;
  let restartButton = null;
  let startOverButton = null;
  let statsStartOverButton = null;
  let keyboardContainer = null;
  let realtimeStatsContainer = null;
  let config = { keyboard: true, availableKeys: [], showStats: false, realTimeStats: [], gameType: 'classic' };

  // Normalized set of available keys (for fast lookup)
  let availableKeysSet = new Set();

  // Character states: 'pending', 'correct', 'incorrect'
  const charStates = [];

  // Statistics tracking
  let startTime = null;
  let totalErrors = 0;
  let totalInputs = 0;

  // Keyboard state
  let keyboardEnabled = false;
  let activeKeyElement = null;
  let activeKeyTimeout = null;

  // Real-time stats update interval
  let realtimeStatsInterval = null;

  // Game manager - handles different game types
  let currentGame = null;
  let gameUpdateInterval = null;
  let gameAnimationFrame = null;

  // Load configuration
  async function loadConfig() {
    try {
      const response = await fetch('./config.json');
      if (!response.ok) {
        console.warn('Config file not found, using defaults');
        return;
      }
      config = await response.json();

      // Normalize available keys to lowercase for fast lookup
      // Empty array means all keys are available
      if (config.availableKeys && Array.isArray(config.availableKeys) && config.availableKeys.length > 0) {
        availableKeysSet = new Set(config.availableKeys.map(key => key.toLowerCase()));
      } else {
        availableKeysSet = new Set(); // Empty set means all keys available
      }

      // Set default game type if not specified
      if (!config.gameType) {
        config.gameType = 'classic';
      }
    } catch (error) {
      console.warn('Error loading config:', error);
    }
  }

  // ==================== GAME MANAGER ====================

  // Racing Game Implementation
  class RacingGame {
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
      this.opponentSpeeds = config.racing?.opponentSpeeds || [0.3, 0.4, 0.5];
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
      // Finish line position will be calculated dynamically based on text end
    }

    reset() {
      this.opponentPositions = [0, 0, 0];
      this.isFinished = false;
      this.finishLineTextPosition = 0;
      this.playerWon = null; // Reset win/loss status
      // Reset speeds to base speeds (in px/s)
      this.currentOpponentSpeeds = [...this.opponentSpeedsPxPerSec];
      this.speedUpdateTimer = 0;
      this.speedUpdateInterval = 1500 + Math.random() * 1000; // Reset update interval
      this.lastFrameTime = null; // Reset frame time

      if (this.playerCar) {
        this.playerCar.style.left = '20px';
      }

      this.opponentCars.forEach((car, index) => {
        if (car) {
          car.style.left = '20px';
        }
        this.opponentPositions[index] = 0;
      });

      // Update finish line position after reset
      setTimeout(() => {
        this.updateFinishLinePosition();
      }, 0);
    }

    updateOpponentSpeeds() {
      // Update speeds with small random variations
      // Variations are ±20% of base speed to keep it realistic
      this.opponentSpeedsPxPerSec.forEach((baseSpeed, index) => {
        const variation = 0.2; // ±20% variation
        const randomFactor = 1 + (Math.random() * 2 - 1) * variation; // Random between 0.8 and 1.2
        this.currentOpponentSpeeds[index] = baseSpeed * randomFactor;
      });

      // Reset timer and set new random interval
      this.speedUpdateTimer = 0;
      this.speedUpdateInterval = 1500 + Math.random() * 1000; // 1.5-2.5 seconds
    }

    updatePlayerPosition() {
      if (!this.playerCar || this.isFinished || !this.typingTextElement) return;

      // Get the cursor element position
      const cursorElement = this.typingTextElement.querySelector('.cursor-position');
      if (!cursorElement) {
        // If no cursor, position at start of text
        const firstChar = this.typingTextElement.querySelector('span');
        if (firstChar) {
          const carWidth = 40;
          const position = 70 + firstChar.offsetLeft - carWidth; // Car front at first character
          this.playerCar.style.left = `${Math.max(20, position)}px`;
        }
        return;
      }

      // Get the absolute position of the cursor within the text element
      const cursorLeft = cursorElement.offsetLeft;

      // Position car so its front (right edge) is at cursor position
      const carWidth = 40; // Car SVG width
      const position = 70 + cursorLeft - carWidth; // 70px is where text starts, car front at cursor

      this.playerCar.style.left = `${Math.max(20, position)}px`;

      // Update finish line position to end of text
      this.updateFinishLinePosition();

      // Check if player crossed finish line
      if (cursorLeft >= this.finishLineTextPosition && !this.isFinished) {
        this.isFinished = true;
        this.playerWon = true; // Player finished first
        // Completion will be handled by the main renderText function
      }
    }

    updateFinishLinePosition() {
      if (!this.typingTextElement || !this.finishLine) return;

      // Find the last character span
      const allChars = this.typingTextElement.querySelectorAll('span');
      if (allChars.length === 0) {
        // No text yet - set lanes and track to minimum width
        const minWidth = 70; // At least where text starts
        const lanes = this.trackElement ? this.trackElement.querySelectorAll('.racing-track-lane') : [];
        lanes.forEach(lane => {
          lane.style.width = `${minWidth}px`;
        });
        if (this.trackElement) {
          this.trackElement.style.width = `${minWidth}px`;
        }
        // Finish line is positioned with right: 0 in CSS, so it automatically aligns with track edge
        return;
      }

      const lastChar = allChars[allChars.length - 1];
      const finishLineTextPosition = lastChar.offsetLeft + lastChar.offsetWidth;
      this.finishLineTextPosition = finishLineTextPosition;

      // Position finish line at the end of text with a buffer
      const buffer = 20; // Buffer space between text end and finish line
      const finishLinePosition = 70 + finishLineTextPosition + buffer; // 70px is where text starts

      // Update track lanes to end at finish line
      const lanes = this.trackElement ? this.trackElement.querySelectorAll('.racing-track-lane') : [];
      lanes.forEach(lane => {
        lane.style.width = `${finishLinePosition}px`;
      });

      // Update racing-track container width to match finish line
      if (this.trackElement) {
        this.trackElement.style.width = `${finishLinePosition}px`;
      }

      // Finish line is positioned with right: 0 in CSS, so it automatically aligns with track edge
    }

    updateOpponents(currentTime) {
      if (this.isFinished || !startTime) return;

      // Calculate delta time (time since last frame) in seconds
      let deltaTime = 0;
      if (this.lastFrameTime !== null) {
        deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        // Clamp delta time to prevent large jumps (e.g., when tab regains focus)
        deltaTime = Math.min(deltaTime, 0.1); // Max 100ms delta (10fps minimum)
      }
      this.lastFrameTime = currentTime;

      // Skip update if this is the first frame (no delta time yet)
      if (deltaTime === 0) return;

      // Update finish line position first (in case text changed)
      this.updateFinishLinePosition();

      // Update speeds periodically with randomness
      this.speedUpdateTimer += deltaTime * 1000; // Convert to milliseconds
      if (this.speedUpdateTimer >= this.speedUpdateInterval) {
        this.updateOpponentSpeeds();
      }

      // Get finish line X position - it's at the right edge of the track
      // Since finish line uses right: 0, we need to get track width
      const trackWidth = this.trackElement ? this.trackElement.offsetWidth : 0;
      const finishLineX = trackWidth; // Finish line is at the right edge

      this.opponentCars.forEach((car, index) => {
        if (!car) return;

        // Use current speed (with randomness) in pixels per second
        // Multiply by deltaTime to get frame-rate independent movement
        const speedPxPerSec = this.currentOpponentSpeeds[index] || this.opponentSpeedsPxPerSec[index] || 18;
        const movementThisFrame = speedPxPerSec * deltaTime; // pixels this frame
        this.opponentPositions[index] += movementThisFrame;

        // Calculate car position
        // Car's left edge is at: 20px (start) + opponentPositions[index]
        // Car's right edge (front) is at: 20px + opponentPositions[index] + 40px (car width)
        const carWidth = 40;
        const carLeftPosition = 20 + this.opponentPositions[index];
        const carFrontPosition = carLeftPosition + carWidth;

        // Opponents move based on their position, finish line is at end of text
        const maxPosition = finishLineX > 0 ? finishLineX - 20 : this.trackWidth - 20;
        const position = Math.min(carLeftPosition, maxPosition);
        car.style.left = `${position}px`;

        // Check if opponent's front touches finish line (with small buffer for visibility)
        const buffer = 10; // Small buffer so it's obvious to user
        if (finishLineX > 0 && carFrontPosition >= finishLineX - buffer && !this.isFinished) {
          this.isFinished = true;
          this.playerWon = false; // Opponent finished first
          // Trigger completion screen when opponent wins
          console.log('Opponent finished first! Showing completion screen.');
          showCompletionScreen();
        }
      });
    }

    renderText(textHtml) {
      if (this.typingTextElement) {
        this.typingTextElement.innerHTML = textHtml;

        // Wait for DOM to update, then update positions
        setTimeout(() => {
          this.updatePlayerPosition();
          this.updateFinishLinePosition();
        }, 0);
      }
    }

    destroy() {
      // Cleanup if needed
      this.isFinished = false;
    }
  }

  // Classic Game Implementation (original behavior)
  class ClassicGame {
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

  // Meteorite Rain Game Implementation
  class MeteoriteRainGame {
    constructor() {
      this.container = document.getElementById('meteorite-rain-container');
      this.playArea = document.getElementById('meteorite-play-area');
      this.scoreElement = document.getElementById('meteorite-score');
      this.livesElement = document.getElementById('meteorite-lives');
      this.typingInput = document.getElementById('meteorite-typing-input');
      this.ground = document.getElementById('meteorite-ground');
      this.startMessage = document.getElementById('meteorite-start-message');
      this.heartElements = null; // Will be populated when lives element is available

      this.meteorites = [];
      this.words = [];
      this.score = 0;
      this.lives = 3;
      this.isFinished = false;
      this.hasStarted = false; // Track if game has started
      this.currentTypedWord = '';
      this.spawnTimer = 0;
      this.lastFrameTime = null;
      this.gameStartTime = null;
      this.pointsPerChar = config.meteoriteRain?.pointsPerChar || 100;
      this.spawnIntervalId = null;
      this.animationFrame = null;
      this.startKeyListener = null; // Store reference to start key listener

      // Difficulty settings
      const difficultyConfig = config.meteoriteRain?.difficulty || {};
      this.baseSpawnInterval = difficultyConfig.baseSpawnInterval || config.meteoriteRain?.spawnInterval || 2000;
      this.minSpawnInterval = difficultyConfig.minSpawnInterval || 500;
      this.baseSpeed = difficultyConfig.baseSpeed || config.meteoriteRain?.meteoriteSpeed || 50;
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

      // Reset game state
      this.reset();
    }

    extractWords() {
      // Split text into words (split by whitespace and filter empty strings)
      this.words = originalText
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.toLowerCase().trim());

      // Remove duplicates while preserving order
      this.words = [...new Set(this.words)];

      console.log('Extracted words:', this.words);
    }

    reset() {
      // Extract words if not already extracted
      if (this.words.length === 0 && originalText.length > 0) {
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
      this.heartElements = null; // Reset heart elements cache

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
      // Difficulty increases linearly over time
      return Math.min(elapsedSeconds * this.difficultyIncreaseRate, 1.0);
    }

    getRandomSpawnInterval() {
      const difficulty = this.getCurrentDifficulty();
      // As difficulty increases, spawn interval decreases
      // At difficulty 0: baseSpawnInterval
      // At difficulty 1: minSpawnInterval
      const minInterval = this.minSpawnInterval;
      const maxInterval = this.baseSpawnInterval;
      const currentMaxInterval = maxInterval - (maxInterval - minInterval) * difficulty;

      // Random interval between 70% and 100% of current max interval
      const randomFactor = 0.7 + Math.random() * 0.3;
      return Math.max(minInterval, currentMaxInterval * randomFactor);
    }

    getCurrentSpeed() {
      const difficulty = this.getCurrentDifficulty();
      // As difficulty increases, speed increases
      // At difficulty 0: baseSpeed
      // At difficulty 1: maxSpeed
      return this.baseSpeed + (this.maxSpeed - this.baseSpeed) * difficulty;
    }

    spawnMeteorite() {
      if (this.isFinished || !this.hasStarted || this.words.length === 0) return;

      // Pick a random word
      const word = this.words[Math.floor(Math.random() * this.words.length)];

      // Get current speed for this meteorite
      const currentSpeed = this.getCurrentSpeed();

      // Create meteorite element
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

      // Random horizontal position (with padding from edges to avoid score and hearts)
      const padding = 100;
      const maxX = this.playArea.offsetWidth - padding;
      const x = padding + Math.random() * (maxX - padding);

      meteorite.style.left = `${x}px`;
      meteorite.style.top = '0px';

      // Store meteorite data with its speed
      const meteoriteData = {
        element: meteorite,
        word: word,
        y: 0,
        x: x,
        speed: currentSpeed // Each meteorite has its own speed based on when it was spawned
      };

      this.meteorites.push(meteoriteData);
    }

    updateMeteorites(currentTime) {
      if (this.isFinished || !this.hasStarted) return;

      // Calculate delta time
      let deltaTime = 0;
      if (this.lastFrameTime !== null) {
        deltaTime = (currentTime - this.lastFrameTime) / 1000;
        deltaTime = Math.min(deltaTime, 0.1); // Clamp to prevent large jumps
      }
      this.lastFrameTime = currentTime;

      if (deltaTime === 0) return;

      const playAreaHeight = this.playArea.offsetHeight;
      const groundHeight = this.ground ? this.ground.offsetHeight : 20;

      // Update each meteorite position
      this.meteorites.forEach((meteorite, index) => {
        // Move meteorite down using its individual speed
        const speedPxPerSec = meteorite.speed || this.baseSpeed;
        const movementThisFrame = speedPxPerSec * deltaTime;
        meteorite.y += movementThisFrame;
        meteorite.element.style.top = `${meteorite.y}px`;

        // Check if meteorite hit the ground
        const meteoriteBottom = meteorite.y + meteorite.element.offsetHeight;
        if (meteoriteBottom >= playAreaHeight - groundHeight) {
          // Meteorite hit the ground - lose a life
          this.loseLife();
          this.destroyMeteorite(index);
        }
      });

      // Check if game should end
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

      // Find matching meteorite
      for (let i = 0; i < this.meteorites.length; i++) {
        const meteorite = this.meteorites[i];
        if (meteorite.word.toLowerCase() === typedLower) {
          // Match! Destroy meteorite and award points
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

      // Stop spawning
      if (this.spawnIntervalId) {
        clearTimeout(this.spawnIntervalId);
        this.spawnIntervalId = null;
      }

      // Stop animation
      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      // Show completion screen with score
      showCompletionScreen();
    }

    updateScore() {
      if (this.scoreElement) {
        this.scoreElement.textContent = this.score;
      }
    }

    updateLives() {
      if (!this.livesElement) return;

      // Get or cache heart elements
      if (!this.heartElements) {
        this.heartElements = this.livesElement.querySelectorAll('.meteorite-heart');
      }

      // Show/hide hearts based on current lives
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
      // Input value is managed by the input element itself
    }

    beginGame() {
      // Mark game as started
      this.hasStarted = true;

      // Hide start message
      if (this.startMessage) {
        this.startMessage.style.display = 'none';
      }

      // Remove start key listener
      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }

      // Set game start time for difficulty calculation
      this.gameStartTime = Date.now();

      // Start spawning meteorites with dynamic intervals
      this.spawnMeteorite(); // Spawn first one immediately

      // Schedule next spawn with random interval based on difficulty
      const scheduleNextSpawn = () => {
        if (this.isFinished || !this.hasStarted) return;

        const nextInterval = this.getRandomSpawnInterval();
        this.spawnIntervalId = setTimeout(() => {
          if (!this.isFinished && this.hasStarted) {
            this.spawnMeteorite();
            scheduleNextSpawn(); // Schedule next spawn
          }
        }, nextInterval);
      };

      scheduleNextSpawn();

      // Start animation loop
      const animate = (currentTime) => {
        if (this.isFinished || !this.hasStarted) return;
        this.updateMeteorites(currentTime);
        this.animationFrame = requestAnimationFrame(animate);
      };
      this.animationFrame = requestAnimationFrame(animate);

      // Focus the input element
      if (this.typingInput) {
        setTimeout(() => {
          if (this.typingInput) {
            this.typingInput.focus();
          }
        }, 100);
      }
    }

    startGame() {
      // Set up key listener for starting the game
      this.setupStartListener();
    }

    setupStartListener() {
      // Listen for Enter or Space to start the game
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
      // Cleanup
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

  // Tower classes for Tower Defense
  class Tower {
    constructor(gridX, gridY, type, cellSize) {
      this.gridX = gridX;
      this.gridY = gridY;
      this.type = type;
      this.cellSize = cellSize;
      this.x = gridX * cellSize + cellSize / 2; // Pixel position (center of cell)
      this.y = gridY * cellSize + cellSize / 2;
      this.lastAttackTime = 0;
      this.element = null;

      // Tower stats (will be overridden by subclasses)
      this.range = 100;
      this.damage = 0;
      this.attackSpeed = 1.0; // attacks per second
      this.cost = 0;
    }

    createElement() {
      this.element = document.createElement('div');
      this.element.className = `td-tower td-tower-${this.type}`;
      this.element.style.position = 'absolute';
      this.element.style.left = `${this.x - this.cellSize / 2}px`;
      this.element.style.top = `${this.y - this.cellSize / 2}px`;
      this.element.style.width = `${this.cellSize}px`;
      this.element.style.height = `${this.cellSize}px`;
      this.element.style.pointerEvents = 'none';

      const gridContainer = document.getElementById('tower-defense-grid');
      if (gridContainer) {
        gridContainer.appendChild(this.element);
      }
    }

    update(deltaTime, enemies) {
      const currentTime = Date.now();
      const timeSinceLastAttack = (currentTime - this.lastAttackTime) / 1000;

      if (timeSinceLastAttack >= 1 / this.attackSpeed) {
        this.attack(enemies);
        this.lastAttackTime = currentTime;
      }
    }

    attack(enemies) {
      // Overridden by subclasses
    }

    getEnemiesInRange(enemies) {
      const enemiesInRange = [];
      for (const enemy of enemies) {
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= this.range) {
          enemiesInRange.push(enemy);
        }
      }
      return enemiesInRange;
    }

    destroy() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  class ArcherTower extends Tower {
    constructor(gridX, gridY, cellSize) {
      super(gridX, gridY, 'archer', cellSize);
      this.range = 120;
      this.damage = 30;
      this.attackSpeed = 1.0; // 1 attack per second
      this.cost = 100;
      this.createElement();
    }

    attack(enemies) {
      const enemiesInRange = this.getEnemiesInRange(enemies);
      if (enemiesInRange.length > 0) {
        // Attack the enemy closest to castle (highest pathIndex)
        const target = enemiesInRange.reduce((closest, enemy) => {
          return enemy.pathIndex > closest.pathIndex ? enemy : closest;
        }, enemiesInRange[0]);

        target.takeDamage(this.damage);

        // Visual feedback (optional - could add projectile animation)
        this.showAttackEffect(target);
      }
    }

    showAttackEffect(target) {
      if (!target || !target.element) return;

      const gridContainer = document.getElementById('tower-defense-grid');
      if (!gridContainer) return;

      // Create projectile (small black dot)
      const projectile = document.createElement('div');
      projectile.className = 'td-projectile-arrow';
      projectile.style.position = 'absolute';
      projectile.style.width = '6px';
      projectile.style.height = '6px';
      projectile.style.borderRadius = '50%';
      projectile.style.backgroundColor = '#000000';
      projectile.style.zIndex = '15';
      projectile.style.pointerEvents = 'none';

      // Start position (tower center)
      const startX = this.x;
      const startY = this.y;
      projectile.style.left = `${startX - 3}px`;
      projectile.style.top = `${startY - 3}px`;

      gridContainer.appendChild(projectile);

      // End position (enemy center)
      const endX = target.x;
      const endY = target.y;

      // Animate projectile
      requestAnimationFrame(() => {
        projectile.style.transition = 'left 0.3s linear, top 0.3s linear';
        projectile.style.left = `${endX - 3}px`;
        projectile.style.top = `${endY - 3}px`;
      });

      // Remove projectile after animation
      setTimeout(() => {
        if (projectile.parentNode) {
          projectile.parentNode.removeChild(projectile);
        }
      }, 300);
    }
  }

  class WizardTower extends Tower {
    constructor(gridX, gridY, cellSize) {
      super(gridX, gridY, 'wizard', cellSize);
      this.range = 100;
      this.damage = 15;
      this.attackSpeed = 0.8; // 0.8 attacks per second
      this.cost = 150;
      this.createElement();
    }

    attack(enemies) {
      const enemiesInRange = this.getEnemiesInRange(enemies);
      // Attack all enemies in range
      for (const enemy of enemiesInRange) {
        enemy.takeDamage(this.damage);
      }

      if (enemiesInRange.length > 0) {
        this.showAttackEffect();
      }
    }

    showAttackEffect() {
      const gridContainer = document.getElementById('tower-defense-grid');
      if (!gridContainer) return;

      // Create expanding circle effect
      const circle = document.createElement('div');
      circle.className = 'td-projectile-magic';
      circle.style.position = 'absolute';
      circle.style.width = '20px';
      circle.style.height = '20px';
      circle.style.borderRadius = '50%';
      circle.style.border = '2px solid #8B5CF6';
      circle.style.backgroundColor = 'rgba(139, 92, 246, 0.3)';
      circle.style.zIndex = '15';
      circle.style.pointerEvents = 'none';
      circle.style.left = `${this.x - 10}px`;
      circle.style.top = `${this.y - 10}px`;

      gridContainer.appendChild(circle);

      // Animate circle expanding outward
      requestAnimationFrame(() => {
        const maxSize = this.range * 2;
        circle.style.transition = 'width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.4s ease-out';
        circle.style.width = `${maxSize}px`;
        circle.style.height = `${maxSize}px`;
        circle.style.left = `${this.x - maxSize / 2}px`;
        circle.style.top = `${this.y - maxSize / 2}px`;
        circle.style.opacity = '0';
      });

      // Remove circle after animation
      setTimeout(() => {
        if (circle.parentNode) {
          circle.parentNode.removeChild(circle);
        }
      }, 400);
    }
  }

  class BombTower extends Tower {
    constructor(gridX, gridY, cellSize) {
      super(gridX, gridY, 'bomb', cellSize);
      this.range = 120;
      this.damage = 60; // Large damage to main target
      this.areaDamage = 25; // Lower damage to other enemies in range
      this.attackSpeed = 0.6; // 0.6 attacks per second (slower than before)
      this.cost = 250;
      this.createElement();
    }

    attack(enemies) {
      const enemiesInRange = this.getEnemiesInRange(enemies);
      if (enemiesInRange.length > 0) {
        // Attack the enemy closest to castle (highest pathIndex) with full damage
        const mainTarget = enemiesInRange.reduce((closest, enemy) => {
          return enemy.pathIndex > closest.pathIndex ? enemy : closest;
        }, enemiesInRange[0]);

        // Show projectile animation first, then apply damage when it hits
        this.showAttackEffect(mainTarget, enemiesInRange);
      }
    }

    showAttackEffect(target, enemiesInRange) {
      if (!target || !target.element) return;

      const gridContainer = document.getElementById('tower-defense-grid');
      if (!gridContainer) return;

      // Create projectile (bigger than archer's - 12px instead of 6px)
      const projectile = document.createElement('div');
      projectile.className = 'td-projectile-bomb';
      projectile.style.position = 'absolute';
      projectile.style.width = '12px';
      projectile.style.height = '12px';
      projectile.style.borderRadius = '50%';
      projectile.style.backgroundColor = '#FF6B00';
      projectile.style.boxShadow = '0 0 8px #FF4500';
      projectile.style.zIndex = '15';
      projectile.style.pointerEvents = 'none';

      // Start position (tower center)
      const startX = this.x;
      const startY = this.y;
      projectile.style.left = `${startX - 6}px`;
      projectile.style.top = `${startY - 6}px`;

      gridContainer.appendChild(projectile);

      // End position (enemy center)
      const endX = target.x;
      const endY = target.y;

      // Animate projectile traveling to target
      requestAnimationFrame(() => {
        projectile.style.transition = 'left 0.4s linear, top 0.4s linear';
        projectile.style.left = `${endX - 6}px`;
        projectile.style.top = `${endY - 6}px`;
      });

      // When projectile hits, apply damage and show explosion
      setTimeout(() => {
        // Apply damage to main target
        target.takeDamage(this.damage);

        // Deal area damage to other enemies in range
        for (const enemy of enemiesInRange) {
          if (enemy !== target) {
            enemy.takeDamage(this.areaDamage);
          }
        }

        // Remove projectile
        if (projectile.parentNode) {
          projectile.parentNode.removeChild(projectile);
        }

        // Create explosion effect at target location
        const explosion = document.createElement('div');
        explosion.className = 'td-projectile-bomb-explosion';
        explosion.style.position = 'absolute';
        explosion.style.width = '30px';
        explosion.style.height = '30px';
        explosion.style.borderRadius = '50%';
        explosion.style.backgroundColor = '#FF6B00';
        explosion.style.boxShadow = '0 0 20px #FF6B00, 0 0 40px #FF4500';
        explosion.style.zIndex = '15';
        explosion.style.pointerEvents = 'none';

        // Position at target center
        const targetRect = target.element.getBoundingClientRect();
        const gridRect = gridContainer.getBoundingClientRect();
        explosion.style.left = `${targetRect.left - gridRect.left + targetRect.width / 2 - 15}px`;
        explosion.style.top = `${targetRect.top - gridRect.top + targetRect.height / 2 - 15}px`;

        gridContainer.appendChild(explosion);

        // Animate explosion expanding
        requestAnimationFrame(() => {
          const maxSize = this.range * 1.5;
          explosion.style.transition = 'width 0.3s ease-out, height 0.3s ease-out, left 0.3s ease-out, top 0.3s ease-out, opacity 0.3s ease-out';
          explosion.style.width = `${maxSize}px`;
          explosion.style.height = `${maxSize}px`;
          explosion.style.left = `${targetRect.left - gridRect.left + targetRect.width / 2 - maxSize / 2}px`;
          explosion.style.top = `${targetRect.top - gridRect.top + targetRect.height / 2 - maxSize / 2}px`;
          explosion.style.opacity = '0';

          setTimeout(() => {
            if (explosion.parentNode) {
              explosion.parentNode.removeChild(explosion);
            }
          }, 300);
        });
      }, 400); // Wait for projectile to reach target
    }
  }

  // Tower Defense Game Implementation
  class TowerDefenseGame {
    constructor() {
      this.container = document.getElementById('tower-defense-container');
      this.gridContainer = document.getElementById('tower-defense-grid');
      this.livesElement = document.getElementById('td-lives');
      this.waveElement = document.getElementById('td-wave');
      this.goldElement = document.getElementById('td-gold');
      this.scoreElement = document.getElementById('td-score');
      this.wordDisplay = document.getElementById('tower-defense-word-display');

      // Word typing system
      this.words = []; // Array of word strings
      this.currentWord = null; // Current word to type (string)
      this.typedWord = ''; // What user has typed for current word

      // Game state
      this.grid = []; // 2D array: grid[y][x]
      this.gridWidth = 0;
      this.gridHeight = 0;
      this.cellSize = 50; // pixels
      this.path = []; // Array of {x, y} grid coordinates
      this.entrancePos = null; // {x, y}
      this.castlePos = null; // {x, y}

      // Game entities
      this.enemies = [];
      this.towers = [];
      this.towerPopup = null; // Popup for tower selection
      this.selectedCell = null; // Currently selected cell for tower placement

      // Game resources
      this.lives = 3;
      this.gold = 0;
      this.score = 0;
      this.waveNumber = 0;
      this.enemiesInWave = 0;
      this.enemiesSpawned = 0;

      // Game timing
      this.lastFrameTime = null;
      this.animationFrame = null;
      this.waveTimer = 0;
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = 2000; // milliseconds between enemy spawns
      this.startKeyListener = null;

      // Game status
      this.isFinished = false;
      this.hasStarted = false;
    }

    async loadField() {
      try {
        const response = await fetch('./field.txt');
        if (!response.ok) {
          throw new Error('Failed to load field file');
        }
        const fieldText = await response.text();
        return this.parseField(fieldText);
      } catch (error) {
        console.error('Error loading field:', error);
        return null;
      }
    }

    parseField(fieldText) {
      const lines = fieldText.split('\n').filter(line => line.trim().length > 0);
      if (lines.length === 0) return null;

      this.gridHeight = lines.length;
      this.gridWidth = lines[0].length;
      this.grid = [];

      // Define variants for grass and rock cells
      const grassVariants = ['empty', 'flowers', 'strokes'];
      const rockVariants = ['1', '2', '3'];

      // Find entrance (E) and castle (C)
      for (let y = 0; y < lines.length; y++) {
        this.grid[y] = [];
        for (let x = 0; x < lines[y].length; x++) {
          const char = lines[y][x];
          let cellType = 'grass';
          let variant = null;

          if (char === '#') {
            cellType = 'road';
          } else if (char === '.') {
            cellType = 'grass';
            // Randomly select a grass variant
            variant = grassVariants[Math.floor(Math.random() * grassVariants.length)];
          } else if (char === 'R' || char === 'r') {
            cellType = 'rock';
            // Randomly select a rock variant
            variant = rockVariants[Math.floor(Math.random() * rockVariants.length)];
          } else if (char === 'E' || char === 'e') {
            cellType = 'road'; // Entrance is on road
            this.entrancePos = { x, y };
          } else if (char === 'C' || char === 'c') {
            cellType = 'road'; // Castle is on road
            this.castlePos = { x, y };
          }

          this.grid[y][x] = {
            type: cellType,
            x: x,
            y: y,
            tower: null,
            variant: variant // Store variant for grass and rock cells
          };
        }
      }

      // Calculate path from entrance to castle using A* or simple pathfinding
      if (this.entrancePos && this.castlePos) {
        this.path = this.findPath(this.entrancePos, this.castlePos);
      } else {
        // Fallback: if no E or C, use first and last road cell
        this.findEntranceAndCastle();
        if (this.entrancePos && this.castlePos) {
          this.path = this.findPath(this.entrancePos, this.castlePos);
        }
      }

      return this.grid;
    }

    findEntranceAndCastle() {
      // Find first road cell as entrance
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          if (this.grid[y][x].type === 'road') {
            this.entrancePos = { x, y };
            break;
          }
        }
        if (this.entrancePos) break;
      }

      // Find last road cell as castle
      for (let y = this.gridHeight - 1; y >= 0; y--) {
        for (let x = this.gridWidth - 1; x >= 0; x--) {
          if (this.grid[y][x].type === 'road') {
            this.castlePos = { x, y };
            break;
          }
        }
        if (this.castlePos) break;
      }
    }

    findPath(start, end) {
      // Simple BFS pathfinding
      const queue = [{ x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] }];
      const visited = new Set();
      visited.add(`${start.x},${start.y}`);

      const directions = [
        { x: 0, y: -1 }, // up
        { x: 1, y: 0 },  // right
        { x: 0, y: 1 },  // down
        { x: -1, y: 0 }  // left
      ];

      while (queue.length > 0) {
        const current = queue.shift();

        if (current.x === end.x && current.y === end.y) {
          return current.path;
        }

        for (const dir of directions) {
          const newX = current.x + dir.x;
          const newY = current.y + dir.y;
          const key = `${newX},${newY}`;

          if (
            newX >= 0 && newX < this.gridWidth &&
            newY >= 0 && newY < this.gridHeight &&
            !visited.has(key) &&
            (this.grid[newY][newX].type === 'road' ||
             this.grid[newY][newX].type === 'entrance' ||
             this.grid[newY][newX].type === 'castle')
          ) {
            visited.add(key);
            queue.push({
              x: newX,
              y: newY,
              path: [...current.path, { x: newX, y: newY }]
            });
          }
        }
      }

      // Fallback: return direct path if BFS fails
      return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
    }

    extractWords() {
      if (!originalText || originalText.length === 0) {
        this.words = [];
        return;
      }

      // Split text into words (simple split on whitespace)
      this.words = originalText.trim().split(/\s+/).filter(word => word.length > 0);

      // Select a random word to start
      this.selectRandomWord();
    }

    selectRandomWord() {
      if (this.words.length === 0) {
        this.currentWord = null;
        this.typedWord = '';
        return;
      }

      // Select a random word from the list
      const randomIndex = Math.floor(Math.random() * this.words.length);
      this.currentWord = this.words[randomIndex];
      this.typedWord = '';
    }

    checkWordCompletion() {
      if (!this.currentWord) return false;

      // Check if typed word matches current word exactly
      return this.typedWord.trim() === this.currentWord;
    }

    completeWord() {
      if (!this.currentWord) return false;

      if (this.checkWordCompletion()) {
        // Award gold: 10 per character
        const goldEarned = this.currentWord.length * 10;
        this.gold += goldEarned;
        this.updateUI();

        // Select next random word
        this.selectRandomWord();

        // Update word display
        this.updateWordDisplay();

        return true;
      }

      return false;
    }

    updateWordDisplay() {
      if (!this.wordDisplay) {
        return;
      }

      if (!this.currentWord) {
        this.wordDisplay.innerHTML = '';
        return;
      }

      // Render the current word with typing progress
      let html = '';
      const wordText = this.currentWord;
      const typedWord = this.typedWord;

      for (let i = 0; i < wordText.length; i++) {
        const char = wordText[i];
        let className = 'char-';

        if (i < typedWord.length) {
          // Character has been typed
          if (typedWord[i] === char) {
            className += 'correct';
          } else {
            className += 'incorrect';
          }
        } else {
          // Character not yet typed
          className += 'pending';
        }

        // Add cursor class if this is the current typing position
        if (i === typedWord.length) {
          className += ' cursor-position';
        }

        // Escape HTML
        const div = document.createElement('div');
        div.textContent = char;
        const displayChar = div.innerHTML;

        html += `<span class="${className}">${displayChar}</span>`;
      }

      // Add cursor at end if word is fully typed
      if (typedWord.length >= wordText.length) {
        html += '<span class="char-pending cursor-position">\u00A0</span>';
      }

      this.wordDisplay.innerHTML = html;
    }

    renderGrid() {
      if (!this.gridContainer) return;

      this.gridContainer.innerHTML = '';
      this.gridContainer.style.display = 'grid';
      this.gridContainer.style.gridTemplateColumns = `repeat(${this.gridWidth}, ${this.cellSize}px)`;
      this.gridContainer.style.gridTemplateRows = `repeat(${this.gridHeight}, ${this.cellSize}px)`;

      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const cell = this.grid[y][x];
          const cellElement = document.createElement('div');
          cellElement.className = `td-cell td-cell-${cell.type}`;
          cellElement.setAttribute('data-x', x);
          cellElement.setAttribute('data-y', y);

          // Add variant class for grass and rock cells
          if (cell.variant) {
            cellElement.classList.add(`td-cell-${cell.type}-${cell.variant}`);
          }

          // Add special classes for entrance and castle
          if (this.entrancePos && x === this.entrancePos.x && y === this.entrancePos.y) {
            cellElement.classList.add('td-cell-entrance');
          }
          if (this.castlePos && x === this.castlePos.x && y === this.castlePos.y) {
            cellElement.classList.add('td-cell-castle');
          }

          // Add click handler for grass cells (only if no tower)
          if (cell.type === 'grass' && cell.tower === null) {
            cellElement.style.cursor = 'pointer';
            cellElement.addEventListener('click', () => {
              this.handleCellClick(x, y, cell);
            });
          }

          this.gridContainer.appendChild(cellElement);
        }
      }

      // Re-render existing towers
      for (const tower of this.towers) {
        if (!tower.element || !tower.element.parentNode) {
          tower.createElement();
        }
      }
    }

    handleCellClick(gridX, gridY, cell) {
      // Only allow placement on grass cells without towers
      if (cell.type !== 'grass' || cell.tower !== null) {
        return;
      }

      // Show tower selection popup
      this.showTowerPopup(gridX, gridY, cell);
    }

    showTowerPopup(gridX, gridY, cell) {
      // Hide previous popup if exists
      if (this.towerPopup) {
        this.hideTowerPopup();
      }

      // Create popup element
      this.towerPopup = document.createElement('div');
      this.towerPopup.className = 'td-tower-popup';

      // Calculate position (above the cell)
      const cellElement = this.gridContainer.querySelector(`[data-x="${gridX}"][data-y="${gridY}"]`);
      if (!cellElement) return;

      const rect = cellElement.getBoundingClientRect();
      const gridRect = this.gridContainer.getBoundingClientRect();

      this.towerPopup.style.position = 'absolute';
      this.towerPopup.style.left = `${rect.left - gridRect.left + this.cellSize / 2}px`;
      this.towerPopup.style.top = `${rect.top - gridRect.top - 10}px`;
      this.towerPopup.style.transform = 'translate(-50%, -100%)';

      // Create tower options
      const archerTower = this.createTowerOption('archer', 'Archer Tower', 100, '🏹');
      const wizardTower = this.createTowerOption('wizard', 'Wizard Tower', 150, '🔮');
      const bombTower = this.createTowerOption('bomb', 'Bomb Tower', 250, '💣');

      this.towerPopup.appendChild(archerTower);
      this.towerPopup.appendChild(wizardTower);
      this.towerPopup.appendChild(bombTower);

      this.gridContainer.appendChild(this.towerPopup);
      this.selectedCell = { x: gridX, y: gridY, cell: cell };

      // Close popup when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClick);
      }, 0);
    }

    handleOutsideClick = (e) => {
      if (this.towerPopup && !this.towerPopup.contains(e.target)) {
        const cellElement = this.gridContainer.querySelector(`[data-x="${this.selectedCell.x}"][data-y="${this.selectedCell.y}"]`);
        if (!cellElement || !cellElement.contains(e.target)) {
          this.hideTowerPopup();
        }
      }
    };

    createTowerOption(type, name, cost, icon) {
      const option = document.createElement('div');
      option.className = 'td-tower-option';
      if (this.gold < cost) {
        option.classList.add('td-tower-option-disabled');
      }

      option.innerHTML = `
        <div class="td-tower-option-icon">${icon}</div>
      `;

      if (this.gold >= cost) {
        option.style.cursor = 'pointer';
        option.onclick = () => {
          this.placeTower(this.selectedCell.x, this.selectedCell.y, type, cost);
          this.hideTowerPopup();
          // Refocus input after placing tower
          if (hiddenInput) {
            setTimeout(() => {
              hiddenInput.focus();
            }, 0);
          }
        };
      }

      return option;
    }

    placeTower(gridX, gridY, towerType, cost) {
      const cell = this.grid[gridY][gridX];
      if (cell.type !== 'grass' || cell.tower !== null || this.gold < cost) {
        return;
      }

      // Deduct gold
      this.gold -= cost;
      this.updateUI();

      // Create tower
      let tower;
      if (towerType === 'archer') {
        tower = new ArcherTower(gridX, gridY, this.cellSize);
      } else if (towerType === 'wizard') {
        tower = new WizardTower(gridX, gridY, this.cellSize);
      } else if (towerType === 'bomb') {
        tower = new BombTower(gridX, gridY, this.cellSize);
      } else {
        return;
      }

      // Place tower
      cell.tower = tower;
      this.towers.push(tower);
    }

    hideTowerPopup() {
      if (this.towerPopup) {
        if (this.towerPopup.parentNode) {
          this.towerPopup.parentNode.removeChild(this.towerPopup);
        }
        this.towerPopup = null;
      }
      this.selectedCell = null;
      document.removeEventListener('click', this.handleOutsideClick);
    }

    initialize() {
      if (!this.container || !this.gridContainer) return;

      // Show tower defense container, hide others
      this.container.style.display = 'flex';
      const classicContainer = document.getElementById('classic-typing-container');
      const racingContainer = document.getElementById('racing-track-container');
      const meteoriteContainer = document.getElementById('meteorite-rain-container');

      if (classicContainer) classicContainer.style.display = 'none';
      if (racingContainer) racingContainer.style.display = 'none';
      if (meteoriteContainer) meteoriteContainer.style.display = 'none';

      // Reset game state
      this.reset();
    }

    async reset() {
      // Load and parse field
      const fieldLoaded = await this.loadField();
      if (!fieldLoaded) {
        console.error('Failed to load field');
        return;
      }

      // Reset game state
      this.enemies = [];
      this.towers = [];
      this.lives = config.towerDefense?.initialLives || 3;
      this.gold = 0;
      this.score = 0;
      this.waveNumber = 0;
      this.enemiesInWave = 0;
      this.enemiesSpawned = 0;
      this.isFinished = false;
      this.hasStarted = false;
      this.lastFrameTime = null;
      this.selectedCell = null;
      this.typedWord = '';

      // Extract words from text (only if text is loaded)
      if (originalText && originalText.length > 0) {
        this.extractWords();
        this.updateWordDisplay();
      }

      // Remove tower popup if exists
      if (this.towerPopup) {
        this.hideTowerPopup();
      }

      // Clear intervals and animation frames
      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      // Remove old start key listener if exists
      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }

      // Render grid
      this.renderGrid();

      // Update UI
      this.updateUI();
    }

    updateUI() {
      if (this.livesElement) {
        this.livesElement.textContent = `Lives: ${this.lives}`;
      }
      if (this.goldElement) {
        this.goldElement.textContent = `Gold: ${this.gold}`;
      }
      if (this.scoreElement) {
        this.scoreElement.textContent = `Score: ${this.score}`;
      }
      if (this.waveElement) {
        this.waveElement.textContent = `Wave: ${this.waveNumber}`;
      }
    }

    spawnEnemy() {
      if (!this.path || this.path.length === 0) return;

      // Calculate enemy stats based on wave number
      // Health increases: 100 + (wave - 1) * 50 (wave 1: 100, wave 2: 150, wave 3: 200, etc.)
      const baseHealth = 100;
      const healthIncreasePerWave = 50;
      const enemyHealth = baseHealth + (this.waveNumber - 1) * healthIncreasePerWave;

      // Speed increases slightly: 50 + (wave - 1) * 5 (wave 1: 50, wave 2: 55, wave 3: 60, etc.)
      const baseSpeed = 50;
      const speedIncreasePerWave = 5;
      const enemySpeed = baseSpeed + (this.waveNumber - 1) * speedIncreasePerWave;

      const enemy = new Enemy(this.path, this.cellSize, enemyHealth, enemySpeed);
      this.enemies.push(enemy);
      this.enemiesSpawned++;
    }

    updateEnemies(deltaTime) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(deltaTime);

        // Check if enemy reached castle
        if (enemy.hasReachedCastle()) {
          this.lives--;
          this.updateUI();
          enemy.destroy();
          this.enemies.splice(i, 1);

          // Check if game over
          if (this.lives <= 0) {
            this.endGame();
          }
        } else if (enemy.isDead()) {
          // Award score for killing enemy
          this.score += 100;
          this.updateUI();
          enemy.destroy();
          this.enemies.splice(i, 1);
        }
      }
    }

    updateWaves(deltaTime) {
      if (this.isFinished || !this.hasStarted) return;

      // Start new wave if needed
      if (this.enemies.length === 0 && this.enemiesSpawned >= this.enemiesInWave) {
        this.waveNumber++;
        // Progressive difficulty: more enemies per wave
        // Wave 1: 5, Wave 2: 8, Wave 3: 12, Wave 4: 17, Wave 5: 23, etc.
        // Formula: 5 + (wave - 1) * 3 + (wave - 1) * (wave - 2) / 2
        // Simplified: base + linear growth + quadratic growth
        const baseEnemies = 5;
        const linearGrowth = (this.waveNumber - 1) * 3;
        const quadraticGrowth = Math.floor((this.waveNumber - 1) * (this.waveNumber - 2) / 2);
        this.enemiesInWave = baseEnemies + linearGrowth + quadraticGrowth;
        this.enemiesSpawned = 0;
        this.updateUI();
      }

      // Spawn enemies
      if (this.enemiesSpawned < this.enemiesInWave) {
        this.enemySpawnTimer += deltaTime * 1000;
        if (this.enemySpawnTimer >= this.enemySpawnInterval) {
          this.spawnEnemy();
          this.enemySpawnTimer = 0;
        }
      }
    }

    updateTowers(deltaTime) {
      for (const tower of this.towers) {
        tower.update(deltaTime, this.enemies);
      }
    }

    beginGame() {
      this.hasStarted = true;
      this.waveNumber = 1;
      // Wave 1 starts with 5 enemies
      this.enemiesInWave = 5;
      this.enemiesSpawned = 0;

      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }

      // Start animation loop
      const animate = (currentTime) => {
        if (this.isFinished || !this.hasStarted) return;

        const deltaTime = this.lastFrameTime !== null
          ? Math.min((currentTime - this.lastFrameTime) / 1000, 0.1)
          : 0;
        this.lastFrameTime = currentTime;

        if (deltaTime > 0) {
          this.updateWaves(deltaTime);
          this.updateEnemies(deltaTime);
          this.updateTowers(deltaTime);
        }

        this.animationFrame = requestAnimationFrame(animate);
      };

      this.lastFrameTime = null;
      this.animationFrame = requestAnimationFrame(animate);
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

    endGame() {
      this.isFinished = true;

      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      // Show completion screen
      showCompletionScreen();
    }

    renderText(textHtml) {
      // Update word display when text is rendered
      this.updateWordDisplay();
    }

    destroy() {
      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      if (this.startKeyListener) {
        document.removeEventListener('keydown', this.startKeyListener);
        this.startKeyListener = null;
      }
      document.removeEventListener('click', this.handleOutsideClick);

      // Clean up towers
      for (const tower of this.towers) {
        tower.destroy();
      }
      this.towers = [];

      // Clean up popup
      this.hideTowerPopup();

      this.reset();
    }
  }

  // Enemy class for Tower Defense
  class Enemy {
    constructor(path, cellSize, health = 100, speed = 50) {
      this.path = path;
      this.pathIndex = 0;
      this.cellSize = cellSize;
      this.x = 0; // Pixel position
      this.y = 0;
      this.health = health;
      this.maxHealth = health;
      this.speed = speed; // pixels per second
      this.element = null;

      // Initialize position at entrance
      if (path && path.length > 0) {
        const start = path[0];
        this.x = start.x * cellSize + cellSize / 2;
        this.y = start.y * cellSize + cellSize / 2;
      }

      this.createElement();
    }

    createElement() {
      this.element = document.createElement('div');
      this.element.className = 'td-enemy';
      this.element.style.position = 'absolute';
      this.element.style.width = `${this.cellSize * 0.6}px`;
      this.element.style.height = `${this.cellSize * 0.6}px`;
      this.element.style.pointerEvents = 'none';
      this.element.style.transition = 'transform 0.1s linear';

      // Health bar
      const healthBar = document.createElement('div');
      healthBar.className = 'td-enemy-health-bar';
      healthBar.style.position = 'absolute';
      healthBar.style.top = '-8px';
      healthBar.style.left = '0';
      healthBar.style.width = '100%';
      healthBar.style.height = '4px';
      healthBar.style.backgroundColor = '#DC2626';
      healthBar.style.borderRadius = '2px';
      this.element.appendChild(healthBar);

      this.healthBarFill = document.createElement('div');
      this.healthBarFill.style.width = '100%';
      this.healthBarFill.style.height = '100%';
      this.healthBarFill.style.backgroundColor = '#10B981';
      this.healthBarFill.style.borderRadius = '2px';
      healthBar.appendChild(this.healthBarFill);

      const gridContainer = document.getElementById('tower-defense-grid');
      if (gridContainer) {
        gridContainer.appendChild(this.element);
      }
    }

    update(deltaTime) {
      if (!this.path || this.pathIndex >= this.path.length - 1) {
        return;
      }

      const current = this.path[this.pathIndex];
      const target = this.path[this.pathIndex + 1];

      const targetX = target.x * this.cellSize + this.cellSize / 2;
      const targetY = target.y * this.cellSize + this.cellSize / 2;

      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 2) {
        // Reached current target, move to next
        this.pathIndex++;
        if (this.pathIndex >= this.path.length - 1) {
          // Reached castle
          return;
        }
      } else {
        // Move towards target
        const moveDistance = this.speed * deltaTime;
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;

        this.x += moveX;
        this.y += moveY;
      }

      // Update element position
      if (this.element) {
        this.element.style.left = `${this.x - this.cellSize * 0.3}px`;
        this.element.style.top = `${this.y - this.cellSize * 0.3}px`;
      }
    }

    hasReachedCastle() {
      return this.path && this.pathIndex >= this.path.length - 1;
    }

    isDead() {
      return this.health <= 0;
    }

    takeDamage(amount) {
      this.health -= amount;
      if (this.health < 0) this.health = 0;

      // Update health bar
      if (this.healthBarFill) {
        const percent = (this.health / this.maxHealth) * 100;
        this.healthBarFill.style.width = `${percent}%`;
      }
    }

    destroy() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  // Game Manager
  function initializeGame() {
    // Clean up previous game
    if (currentGame) {
      currentGame.destroy();
      if (gameUpdateInterval) {
        clearInterval(gameUpdateInterval);
        gameUpdateInterval = null;
      }
      if (gameAnimationFrame !== null) {
        cancelAnimationFrame(gameAnimationFrame);
        gameAnimationFrame = null;
      }
    }

    // Initialize based on game type
    const gameType = config.gameType || 'classic';

    if (gameType === 'racing') {
      currentGame = new RacingGame();
    } else if (gameType === 'meteoriteRain') {
      currentGame = new MeteoriteRainGame();
    } else if (gameType === 'towerDefense') {
      currentGame = new TowerDefenseGame();
    } else {
      currentGame = new ClassicGame();
    }

    currentGame.initialize();

    // Start game update loop for racing using requestAnimationFrame
    if (gameType === 'racing' && currentGame instanceof RacingGame) {
      function animate(currentTime) {
        if (currentGame && currentGame.updateOpponents) {
          currentGame.updateOpponents(currentTime);
        }
        // Continue animation loop
        gameAnimationFrame = requestAnimationFrame(animate);
      }
      // Start the animation loop
      gameAnimationFrame = requestAnimationFrame(animate);
    }

    // Start meteorite rain game
    if (gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
      // Start the game after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (currentGame && currentGame.startGame) {
          currentGame.startGame();
        }
      }, 100);
    }

    // Start tower defense game
    if (gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
      // Start the game after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (currentGame && currentGame.startGame) {
          currentGame.startGame();
        }
      }, 100);
    }

    // Re-render text if it's already loaded (not for meteorite rain or tower defense)
    if (originalText.length > 0 && gameType !== 'meteoriteRain' && gameType !== 'towerDefense') {
      renderText();
    }

    // Words for tower defense will be extracted after text loads in initialize()
  }

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
  function isKeyAvailable(key) {
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
    if (availableKeysSet.size === 0) {
      return true;
    }

    // Handle KeyboardEvent.key values (e.g., "Tab")
    if (key === 'Tab' || keyLower === 'tab') {
      return availableKeysSet.has('tab');
    }

    // Handle character values (from input events)
    if (key === '\t') {
      return availableKeysSet.has('tab');
    }

    // For regular keys, normalize to lowercase and check
    // Handle both single characters and KeyboardEvent.key values
    const normalizedKey = key.length === 1 ? key.toLowerCase() : keyLower;
    return availableKeysSet.has(normalizedKey);
  }

  // Get key element by character
  function getKeyElement(char) {
    if (!keyboardContainer) return null;

    // Normalize character
    const normalizedChar = char.toLowerCase();

    // Handle special keys
    if (char === ' ') {
      return keyboardContainer.querySelector('[data-key="space"]');
    }
    if (char === '\n' || char === '\r') {
      return keyboardContainer.querySelector('[data-key="enter"]');
    }
    if (char === '\t') {
      return keyboardContainer.querySelector('[data-key="tab"]');
    }

    // Find regular key
    return keyboardContainer.querySelector(`[data-key="${normalizedChar}"]`);
  }

  // Highlight a key on the keyboard
  function highlightKey(char, isError = false) {
    // Don't highlight unavailable keys
    if (!isKeyAvailable(char)) {
      return;
    }

    // Clear previous highlight
    if (activeKeyElement) {
      activeKeyElement.classList.remove('active', 'active-error');
    }

    // Clear timeout if exists
    if (activeKeyTimeout) {
      clearTimeout(activeKeyTimeout);
    }

    const keyElement = getKeyElement(char);
    if (keyElement) {
      activeKeyElement = keyElement;
      if (isError) {
        keyElement.classList.add('active-error');
      } else {
        keyElement.classList.add('active');
      }

      // Remove highlight after animation
      activeKeyTimeout = setTimeout(() => {
        if (keyElement) {
          keyElement.classList.remove('active', 'active-error');
        }
        activeKeyElement = null;
      }, 200);
    }
  }

  // Render the keyboard
  function renderKeyboard() {
    if (!keyboardContainer) return;

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

    keyboardContainer.innerHTML = '';
    keyboardContainer.appendChild(keyboard);
  }

  // Initialize keyboard
  function initializeKeyboard() {
    keyboardContainer = document.getElementById('keyboard-container');
    if (!keyboardContainer) return;

    keyboardEnabled = config.keyboard === true;

    if (keyboardEnabled) {
      renderKeyboard();
      keyboardContainer.classList.add('visible');
    } else {
      keyboardContainer.classList.remove('visible');
    }
  }

  async function loadText() {
    try {
      const response = await fetch('./text-to-input.txt');
      if (!response.ok) {
        throw new Error('Failed to load text file');
      }
      originalText = await response.text();
      // Replace all newlines with spaces (for single-line display in racing mode)
      originalText = originalText.replace(/\n/g, ' ');
      // Trim trailing whitespace
      originalText = originalText.trimEnd();

      // Initialize character states
      charStates.length = 0;
      for (let i = 0; i < originalText.length; i++) {
        charStates.push('pending');
      }

      renderText();

      // For tower defense, extract words and update display after text loads
      if (config.gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
        if (currentGame.extractWords) {
          currentGame.extractWords();
        }
        if (currentGame.updateWordDisplay) {
          currentGame.updateWordDisplay();
        }
      }

      setStatus('Ready');
    } catch (error) {
      console.error('Error loading text:', error);
      if (textContainer) {
        textContainer.innerHTML = '<p>Error: Could not load text file.</p>';
      }
    }
  }

  function renderText() {
    // Calculate correct characters count
    let correctCharsCount = 0;
    for (let i = 0; i < charStates.length; i++) {
      if (charStates[i] === 'correct') {
        correctCharsCount++;
      }
    }

    // Check if completed based on correct characters requirement
    const mistakesAllowed = config.racing?.mistakesAllowed ?? 0;
    const requiredCorrectChars = originalText.length - mistakesAllowed;

    if (correctCharsCount >= requiredCorrectChars && originalText.length > 0) {
      console.log('Completion detected! Showing completion screen.');
      console.log('Correct chars:', correctCharsCount, 'Required:', requiredCorrectChars);

      // For racing game, mark player as winner if not already finished
      if (config.gameType === 'racing' && currentGame && !currentGame.isFinished) {
        currentGame.isFinished = true;
        currentGame.playerWon = true;
      }

      showCompletionScreen();
      return;
    }

    // Hide completion screen if visible
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }

    // Calculate progress for racing game based on correct characters and required amount
    // (reuse mistakesAllowed and requiredCorrectChars from above)
    const progress = requiredCorrectChars > 0 ? Math.min(correctCharsCount / requiredCorrectChars, 1.0) : 0;

    // Render text based on game type
    const isRacing = config.gameType === 'racing';
    const isTowerDefense = config.gameType === 'towerDefense';

    // For tower defense, only render the current word (handled by updateWordDisplay)
    if (isTowerDefense && currentGame instanceof TowerDefenseGame) {
      if (currentGame && currentGame.updateWordDisplay) {
        currentGame.updateWordDisplay();
      }
      return; // Word display is handled separately
    }

    let html = '';
    const currentPosition = typedText.length;

    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];
      const state = charStates[i];
      let className = 'char-';

      if (i < typedText.length) {
        // Character has been typed
        if (state === 'incorrect') {
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
    if (currentPosition === originalText.length) {
      html += '<span class="char-pending cursor-position">\u00A0</span>';
    }

    // Use game's renderText method
    if (currentGame && currentGame.renderText) {
      currentGame.renderText(html);
    } else if (textContainer) {
      // Fallback to classic rendering
      textContainer.innerHTML = html;
    }

    // Update player position in racing game (car follows cursor)
    if (isRacing && currentGame && currentGame.updatePlayerPosition) {
      currentGame.updatePlayerPosition();
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleInput(e) {
    let input = e.target.value;

    // Special handling for meteorite rain game (word-based typing)
    if (config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
      // Don't allow typing if game hasn't started
      if (!currentGame.hasStarted) {
        e.target.value = '';
        return;
      }

      // Filter out unavailable keys if availableKeys is configured
      if (availableKeysSet.size > 0) {
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
      if (currentGame.setTypedWord) {
        currentGame.setTypedWord(currentWord);
      }

      // Highlight keys for meteorite rain
      if (keyboardEnabled && currentWord.length > 0) {
        const lastChar = currentWord[currentWord.length - 1];
        highlightKey(lastChar, false);
      }

      return; // Don't process further for meteorite rain (Enter key handled in handleKeyDown)
    }

    // Special handling for tower defense game
    if (config.gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
      // Don't allow typing if game hasn't started
      if (!currentGame.hasStarted) {
        // Start game immediately when user starts typing
        if (input.length > 0) {
          currentGame.beginGame();
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
      const previousTypedWord = currentGame.typedWord || '';
      if (lastSpaceIndex === -1) {
        // No space found, entire input is the current word
        currentGame.typedWord = input;
      } else {
        // Get everything after the last space
        currentGame.typedWord = input.substring(lastSpaceIndex + 1);
      }

      // Highlight keyboard key for the last character typed
      if (keyboardEnabled && currentGame.typedWord.length > previousTypedWord.length) {
        // A new character was added
        const lastChar = currentGame.typedWord[currentGame.typedWord.length - 1];
        const currentWord = currentGame.currentWord;

        if (currentWord && currentGame.typedWord.length <= currentWord.length) {
          // Check if the character is correct
          const expectedChar = currentWord[currentGame.typedWord.length - 1];
          const isError = lastChar !== expectedChar;
          highlightKey(lastChar, isError);
        } else {
          // Character beyond word length - treat as error
          highlightKey(lastChar, true);
        }
      } else if (keyboardEnabled && currentGame.typedWord.length < previousTypedWord.length) {
        // Backspace was used
        if (isKeyAvailable('backspace')) {
          highlightKey('backspace', false);
        }
      }

      // Update word display
      if (currentGame.updateWordDisplay) {
        currentGame.updateWordDisplay();
      }

      // Don't process further for tower defense (word-based, not character-based)
      // But allow the input to be stored normally
      return;
    }

    // Original character-by-character handling for other game types
    // Filter out unavailable keys if availableKeys is configured
    if (availableKeysSet.size > 0) {
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
    if (startTime === null && input.length > 0) {
      startTime = Date.now();
    }

    // Prevent typing beyond the original text length
    if (input.length > originalText.length) {
      input = input.slice(0, originalText.length);
      e.target.value = input;
    }

    const inputLength = input.length;
    const typedLength = typedText.length;

    // Handle typing forward
    if (inputLength > typedLength) {
      const newChars = input.slice(typedLength);
      let validInput = typedText; // Start with current valid text

      for (let i = 0; i < newChars.length; i++) {
        const charIndex = typedLength + i;
        if (charIndex >= originalText.length) {
          break;
        }

        const expectedChar = originalText[charIndex];
        const typedChar = newChars[i];

        totalInputs++; // Track total inputs

        const isError = typedChar !== expectedChar;
        if (isError) {
          // Don't add incorrect character to input, but count as error
          totalErrors++; // Track total errors

          // Highlight keyboard key to show error
          if (keyboardEnabled) {
            highlightKey(typedChar, true);
          }

          // Reset input to valid text (reject the incorrect character)
          e.target.value = validInput;
          input = validInput;
          break; // Stop processing further characters
        } else {
          // Character is correct - add it to valid input
          validInput += typedChar;
          charStates[charIndex] = 'correct';

          // Highlight keyboard key
          if (keyboardEnabled) {
            highlightKey(typedChar, false);
          }
        }
      }
      typedText = validInput;
    }
    // Handle backspace/delete
    else if (inputLength < typedLength) {
      typedText = input;
      // Reset states for characters that are no longer typed
      for (let i = inputLength; i < originalText.length; i++) {
        if (i < charStates.length) {
          charStates[i] = 'pending';
        }
      }

      // Highlight backspace key (only if available)
      if (keyboardEnabled && isKeyAvailable('backspace')) {
        highlightKey('backspace', false);
      }
    }

    renderText();
    updateRealtimeStats();

    // Update word display for tower defense
    if (config.gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
      currentGame.updateWordDisplay();
    }
  }

  function handleKeyDown(e) {
    // Special handling for tower defense game
    if (config.gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
      // If input is not focused and user starts typing, focus it
      if (hiddenInput && document.activeElement !== hiddenInput &&
          e.target !== hiddenInput &&
          !e.ctrlKey && !e.metaKey && !e.altKey &&
          e.key.length === 1 && e.key.match(/[a-zA-Z0-9\s.,!?;:'"()-]/)) {
        hiddenInput.focus();
        // Let the key event propagate to the input
        return;
      }

      // Game starts automatically when user types (handled in handleInput)
      // No need to start on space key press

      // Space key checks word completion if game has started
      if ((e.key === ' ' || e.key === 'Space') && currentGame.hasStarted) {
        // Prevent default to handle space ourselves
        e.preventDefault();

        // Get current input value (before space is added)
        const input = hiddenInput ? hiddenInput.value : '';

        // Update typed word to current input (last word before space)
        currentGame.typedWord = input;

        // Check if word is complete
        if (currentGame.checkWordCompletion && currentGame.checkWordCompletion()) {
          // Word completed - complete it and select next word
          if (currentGame.completeWord) {
            currentGame.completeWord();
          }
          // Clear the input for next word
          if (hiddenInput) {
            hiddenInput.value = '';
            currentGame.typedWord = '';
          }
        } else {
          // Word not complete - don't add space, just update display
          // User needs to complete the word first
        }

        // Update word display
        if (currentGame.updateWordDisplay) {
          currentGame.updateWordDisplay();
        }
      }

      return;
    }

    // Special handling for meteorite rain game - Space key submits word or starts game
    if (config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
      // Space key submits word or starts game
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault(); // Prevent default space behavior

        // If game hasn't started, start it
        if (!currentGame.hasStarted) {
          currentGame.beginGame();
          return;
        }

        const inputElement = document.getElementById('meteorite-typing-input');
        if (inputElement) {
          const wordToCheck = inputElement.value.trim();
          if (wordToCheck.length > 0) {
            // Check if word matches a meteorite
            if (currentGame.checkWordMatch && currentGame.checkWordMatch(wordToCheck)) {
              // Word matched! Clear input
              inputElement.value = '';
              if (currentGame.setTypedWord) {
                currentGame.setTypedWord('');
              }
            } else {
              // Word didn't match, clear input anyway (player can try again)
              inputElement.value = '';
              if (currentGame.setTypedWord) {
                currentGame.setTypedWord('');
              }
            }
          }
        }
        return;
      }

      // Enter key can also start the game (for convenience)
      if ((e.key === 'Enter' || e.key === 'Return') && !currentGame.hasStarted) {
        e.preventDefault();
        currentGame.beginGame();
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
      if (hiddenInput.value.length >= originalText.length) {
        e.preventDefault(); // Can't type beyond original text
        return;
      }

      // Let the browser handle the newline insertion naturally
      // Highlight keyboard key if enabled
      if (keyboardEnabled) {
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
      if (hiddenInput.value.length >= originalText.length) {
        return; // Can't type beyond original text
      }

      // Get current cursor position
      const cursorPos = hiddenInput.selectionStart || hiddenInput.value.length;

      // Insert tab at cursor position
      const currentValue = hiddenInput.value;
      const newValue = currentValue.slice(0, cursorPos) + '\t' + currentValue.slice(cursorPos);

      // Update input value
      hiddenInput.value = newValue;

      // Move cursor after the inserted tab
      setTimeout(() => {
        hiddenInput.setSelectionRange(cursorPos + 1, cursorPos + 1);
      }, 0);

      // Highlight keyboard key if enabled
      if (keyboardEnabled) {
        highlightKey('\t', false);
      }

      // Manually trigger input event to process the tab
      const inputEvent = new Event('input', { bubbles: true });
      hiddenInput.dispatchEvent(inputEvent);

      return;
    }

    // Prevent unavailable keys from being typed (skip for meteorite rain - it has its own input)
    if (config.gameType !== 'meteoriteRain' && availableKeysSet.size > 0 && !isKeyAvailable(e.key)) {
      e.preventDefault();
      return;
    }

    // Prevent default behavior for backspace when at start (only for hiddenInput, not meteorite input)
    if (e.key === 'Backspace' && e.target === hiddenInput && hiddenInput.value.length === 0) {
      e.preventDefault();
    }
  }

  function restart() {
    typedText = '';
    for (let i = 0; i < charStates.length; i++) {
      charStates[i] = 'pending';
    }
    if (hiddenInput) {
      hiddenInput.value = '';
    }

    // Reset statistics
    startTime = null;
    totalErrors = 0;
    totalInputs = 0;

    // Clear real-time stats interval
    if (realtimeStatsInterval) {
      clearInterval(realtimeStatsInterval);
      realtimeStatsInterval = null;
    }

    // Update real-time stats display
    updateRealtimeStats();

    // Clear keyboard highlights
    if (activeKeyElement) {
      activeKeyElement.classList.remove('active', 'active-error');
      activeKeyElement = null;
    }
    if (activeKeyTimeout) {
      clearTimeout(activeKeyTimeout);
      activeKeyTimeout = null;
    }

    // Reset game
    if (currentGame && currentGame.reset) {
      currentGame.reset();
    }

    // Show appropriate container and hide completion screen and stats dashboard
    const isRacing = config.gameType === 'racing';
    const isMeteoriteRain = config.gameType === 'meteoriteRain';
    const isTowerDefense = config.gameType === 'towerDefense';

    if (isRacing) {
      const racingContainer = document.getElementById('racing-track-container');
      if (racingContainer) {
        racingContainer.style.display = 'block';
      }
      const classicContainer = document.getElementById('classic-typing-container');
      if (classicContainer) {
        classicContainer.style.display = 'none';
      }
      const meteoriteContainer = document.getElementById('meteorite-rain-container');
      if (meteoriteContainer) {
        meteoriteContainer.style.display = 'none';
      }
      const towerDefenseContainer = document.getElementById('tower-defense-container');
      if (towerDefenseContainer) {
        towerDefenseContainer.style.display = 'none';
      }
    } else if (isMeteoriteRain) {
      const meteoriteContainer = document.getElementById('meteorite-rain-container');
      if (meteoriteContainer) {
        meteoriteContainer.style.display = 'flex';
      }
      const classicContainer = document.getElementById('classic-typing-container');
      if (classicContainer) {
        classicContainer.style.display = 'none';
      }
      const racingContainer = document.getElementById('racing-track-container');
      if (racingContainer) {
        racingContainer.style.display = 'none';
      }
      const towerDefenseContainer = document.getElementById('tower-defense-container');
      if (towerDefenseContainer) {
        towerDefenseContainer.style.display = 'none';
      }
      // Restart meteorite rain game
      if (currentGame && currentGame.startGame) {
        setTimeout(() => {
          if (currentGame && currentGame.startGame) {
            currentGame.startGame();
          }
        }, 100);
      }
    } else if (isTowerDefense) {
      const towerDefenseContainer = document.getElementById('tower-defense-container');
      if (towerDefenseContainer) {
        towerDefenseContainer.style.display = 'flex';
      }
      const classicContainer = document.getElementById('classic-typing-container');
      if (classicContainer) {
        classicContainer.style.display = 'none';
      }
      const racingContainer = document.getElementById('racing-track-container');
      if (racingContainer) {
        racingContainer.style.display = 'none';
      }
      const meteoriteContainer = document.getElementById('meteorite-rain-container');
      if (meteoriteContainer) {
        meteoriteContainer.style.display = 'none';
      }
      // Restart tower defense game
      if (currentGame && currentGame.startGame) {
        setTimeout(() => {
          if (currentGame && currentGame.startGame) {
            currentGame.startGame();
          }
        }, 100);
      }
    } else {
      const typingTextContainer = document.querySelector('.typing-text-container');
      if (typingTextContainer) {
        typingTextContainer.style.display = 'block';
      }
      const racingContainer = document.getElementById('racing-track-container');
      if (racingContainer) {
        racingContainer.style.display = 'none';
      }
      const meteoriteContainer = document.getElementById('meteorite-rain-container');
      if (meteoriteContainer) {
        meteoriteContainer.style.display = 'none';
      }
      const towerDefenseContainer = document.getElementById('tower-defense-container');
      if (towerDefenseContainer) {
        towerDefenseContainer.style.display = 'none';
      }
    }

    if (completionScreen) {
      completionScreen.style.display = 'none';
    }
    if (statsDashboard) {
      statsDashboard.style.display = 'none';
    }

    // Show real-time stats again if configured
    if (realtimeStatsContainer) {
      updateRealtimeStats();
    }

    // Show keyboard-stats-wrapper again
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'block';
    }

    // Show keyboard again if it was enabled
    if (keyboardContainer && keyboardEnabled) {
      keyboardContainer.classList.add('visible');
    }

    // Show the restart button again
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'block';
    }

    renderText();

    // Focus the appropriate input after a short delay
    setTimeout(() => {
      if (isMeteoriteRain) {
        const meteoriteInput = document.getElementById('meteorite-typing-input');
        if (meteoriteInput) {
          meteoriteInput.focus();
        }
      } else if (hiddenInput) {
        hiddenInput.focus();
      }
    }, 50);
  }

  // Calculate real-time statistics (while typing)
  function calculateRealtimeStats() {
    // Calculate chars typed and total
    const charsTyped = typedText.length;
    const charsTotal = originalText.length;

    if (startTime === null) {
      return {
        speed: 0,
        accuracy: 0,
        time: 0,
        errors: 0,
        errorsLeft: 0,
        chars: { typed: charsTyped, total: charsTotal }
      };
    }

    const currentTime = Date.now();
    const totalTimeSeconds = (currentTime - startTime) / 1000;
    const totalTimeMinutes = totalTimeSeconds / 60;

    // Count errors left (unfixed incorrect characters)
    let errorsLeft = 0;
    for (let i = 0; i < charStates.length; i++) {
      if (charStates[i] === 'incorrect') {
        errorsLeft++;
      }
    }

    // Calculate accuracy: (correct inputs / total inputs) * 100
    const correctInputs = totalInputs - totalErrors;
    const accuracy = totalInputs > 0 ? (correctInputs / totalInputs) * 100 : 0;

    // Calculate words per minute
    // Count words by splitting on whitespace
    const wordsTyped = originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
    const wpm = totalTimeMinutes > 0 ? wordsTyped / totalTimeMinutes : 0;

    return {
      speed: wpm,
      accuracy: accuracy,
      time: totalTimeSeconds,
      errors: totalErrors,
      errorsLeft: errorsLeft,
      chars: { typed: charsTyped, total: charsTotal }
    };
  }

  // Update real-time stats display
  function updateRealtimeStats() {
    if (!realtimeStatsContainer) return;

    // Check if realTimeStats is configured and has items
    if (!config.realTimeStats || !Array.isArray(config.realTimeStats) || config.realTimeStats.length === 0) {
      realtimeStatsContainer.style.display = 'none';
      // Clear interval if stats are disabled
      if (realtimeStatsInterval) {
        clearInterval(realtimeStatsInterval);
        realtimeStatsInterval = null;
      }
      return;
    }

    const stats = calculateRealtimeStats();
    realtimeStatsContainer.style.display = 'flex';

    // Clear existing content
    realtimeStatsContainer.innerHTML = '';

    // Map of stat keys to display info
    const statMap = {
      speed: { label: 'WPM', value: stats.speed, format: (v) => v.toFixed(1) },
      accuracy: { label: 'Accuracy', value: stats.accuracy, format: (v) => v.toFixed(1) + '%' },
      time: { label: 'Time', value: stats.time, format: (v) => {
        if (v < 60) {
          return v.toFixed(1) + 's';
        } else {
          const minutes = Math.floor(v / 60);
          const seconds = (v % 60).toFixed(1);
          return `${minutes}m ${seconds}s`;
        }
      }},
      errors: { label: 'Errors', value: stats.errors, format: (v) => Math.round(v).toString() },
      errorsLeft: { label: 'Errors Left', value: stats.errorsLeft, format: (v) => Math.round(v).toString() },
      chars: { label: 'Chars', value: stats.chars, format: (v) => `${v.typed}/${v.total}` }
    };

    // Create stat items for each configured stat
    config.realTimeStats.forEach(statKey => {
      const statInfo = statMap[statKey];
      if (!statInfo) return; // Skip invalid stat keys

      const statItem = document.createElement('div');
      statItem.className = 'realtime-stat-item';

      const statLabel = document.createElement('span');
      statLabel.className = 'realtime-stat-label';
      statLabel.textContent = statInfo.label;

      const statValue = document.createElement('span');
      statValue.className = 'realtime-stat-value';
      statValue.textContent = statInfo.format(statInfo.value);

      statItem.appendChild(statLabel);
      statItem.appendChild(statValue);
      realtimeStatsContainer.appendChild(statItem);
    });

    // Start periodic updates if typing has started and interval not already running
    if (startTime !== null && !realtimeStatsInterval) {
      realtimeStatsInterval = setInterval(() => {
        updateRealtimeStats();
      }, 100); // Update every 100ms for smooth time updates
    }
  }

  function calculateStatistics() {
    console.log('Calculating statistics...');
    console.log('startTime:', startTime, 'totalInputs:', totalInputs, 'totalErrors:', totalErrors);

    if (startTime === null) {
      console.log('No typing started, returning null');
      return null; // No typing started
    }

    const endTime = Date.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    const totalTimeMinutes = totalTimeSeconds / 60;

    // Count errors left (unfixed incorrect characters)
    let errorsLeft = 0;
    for (let i = 0; i < charStates.length; i++) {
      if (charStates[i] === 'incorrect') {
        errorsLeft++;
      }
    }

    // Calculate accuracy: (correct inputs / total inputs) * 100
    const correctInputs = totalInputs - totalErrors;
    const accuracy = totalInputs > 0 ? (correctInputs / totalInputs) * 100 : 0;

    // Calculate words per minute
    // Count words by splitting on whitespace
    const wordsTyped = originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
    const wpm = totalTimeMinutes > 0 ? wordsTyped / totalTimeMinutes : 0;

    const stats = {
      totalErrors: totalErrors,
      errorsLeft: errorsLeft,
      totalTime: totalTimeSeconds,
      accuracy: accuracy,
      speed: wpm
    };

    console.log('Calculated statistics:', stats);
    return stats;
  }

  async function saveStatistics(stats) {
    console.log('saveStatistics called with:', stats);
    try {
      // Get win/lose status for racing games or score for meteorite rain
      let statusLine = '';
      if (config.gameType === 'racing' && currentGame && currentGame.playerWon !== null) {
        const status = currentGame.playerWon ? 'win' : 'lose';
        statusLine = `Status: ${status}\n\n`;
      } else if (config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
        const score = currentGame.getScore ? currentGame.getScore() : 0;
        statusLine = `Score: ${score}\n\n`;
      }

      // Format statistics text
      const statsText = `${statusLine}Typing Statistics
==================

Total Errors Made: ${stats.totalErrors}
Errors Left (Unfixed): ${stats.errorsLeft}
Total Time: ${stats.totalTime.toFixed(2)} seconds
Accuracy: ${stats.accuracy.toFixed(2)}%
Speed: ${stats.speed.toFixed(2)} words per minute

Generated: ${new Date().toLocaleString()}
`;

      console.log('Sending stats to server:', statsText);
      const response = await fetch('/save-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: statsText
      });

      console.log('Server response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Statistics saved to client/stats.txt', result);
      } else {
        const errorText = await response.text();
        console.error('Failed to save statistics:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error saving statistics:', error);
    }
  }

  // Parse stats from stats.txt file
  function parseStatsText(statsText) {
    const stats = {};
    const lines = statsText.split('\n');

    for (const line of lines) {
      if (line.includes('Total Errors Made:')) {
        const match = line.match(/Total Errors Made:\s*(\d+)/);
        if (match) stats.totalErrors = parseInt(match[1], 10);
      } else if (line.includes('Errors Left (Unfixed):')) {
        const match = line.match(/Errors Left \(Unfixed\):\s*(\d+)/);
        if (match) stats.errorsLeft = parseInt(match[1], 10);
      } else if (line.includes('Total Time:')) {
        const match = line.match(/Total Time:\s*([\d.]+)\s*seconds/);
        if (match) stats.totalTime = parseFloat(match[1]);
      } else if (line.includes('Accuracy:')) {
        const match = line.match(/Accuracy:\s*([\d.]+)%/);
        if (match) stats.accuracy = parseFloat(match[1]);
      } else if (line.includes('Speed:')) {
        const match = line.match(/Speed:\s*([\d.]+)\s*words per minute/);
        if (match) stats.speed = parseFloat(match[1]);
      }
    }

    return stats;
  }

  // Load and display stats dashboard
  async function showStatsDashboard() {
    // Hide typing container
    const typingTextContainer = document.getElementById('classic-typing-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'none';
    }

    // Hide racing track
    const racingTrackContainer = document.getElementById('racing-track-container');
    if (racingTrackContainer) {
      racingTrackContainer.style.display = 'none';
    }

    // Hide meteorite rain container
    const meteoriteRainContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteRainContainer) {
      meteoriteRainContainer.style.display = 'none';
    }

    // Hide tower defense container
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'none';
    }

    // Hide the restart button when dashboard is shown
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'none';
    }

    // Hide keyboard when dashboard is shown
    if (keyboardContainer) {
      keyboardContainer.classList.remove('visible');
    }

    // Hide real-time stats when dashboard is shown
    if (realtimeStatsContainer) {
      realtimeStatsContainer.style.display = 'none';
    }

    // Hide keyboard-stats-wrapper when dashboard is shown
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'none';
    }

    // Hide completion screen if visible
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }

    try {
      const response = await fetch('./stats.txt');
      let stats = null;

      if (response.ok) {
        const statsText = await response.text();
        stats = parseStatsText(statsText);
      } else {
        console.warn('Stats file not found, using default values');
        // Create default stats object with zeros
        stats = {
          totalErrors: 0,
          errorsLeft: 0,
          totalTime: 0,
          accuracy: 0,
          speed: 0
        };
      }

      // Update dashboard header based on game type
      const dashboardHeader = statsDashboard ? statsDashboard.querySelector('.stats-dashboard-header h2') : null;
      if (dashboardHeader) {
        if (config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
          // Show final score for meteorite rain
          const score = currentGame.getScore ? currentGame.getScore() : 0;
          dashboardHeader.textContent = `Final Score: ${score}`;
        } else if (config.gameType === 'racing' && currentGame && currentGame.playerWon !== null) {
          if (currentGame.playerWon === true) {
            dashboardHeader.textContent = 'Victory 🏅';
          } else if (currentGame.playerWon === false) {
            dashboardHeader.textContent = 'You lost! 😢';
          } else {
            dashboardHeader.textContent = 'Typing Statistics'; // Fallback
          }
        } else {
          dashboardHeader.textContent = 'Typing Statistics'; // Default for non-racing games
        }
      }

      // Update dashboard with stats
      const speedEl = document.getElementById('stat-speed');
      const accuracyEl = document.getElementById('stat-accuracy');
      const timeEl = document.getElementById('stat-time');
      const errorsEl = document.getElementById('stat-errors');
      const errorsLeftEl = document.getElementById('stat-errors-left');

      if (speedEl) speedEl.textContent = stats.speed ? stats.speed.toFixed(1) : '0';
      if (accuracyEl) accuracyEl.textContent = stats.accuracy ? stats.accuracy.toFixed(1) + '%' : '0%';
      if (timeEl) {
        const timeValue = stats.totalTime || 0;
        if (timeValue < 60) {
          timeEl.textContent = timeValue.toFixed(1) + 's';
        } else {
          const minutes = Math.floor(timeValue / 60);
          const seconds = (timeValue % 60).toFixed(1);
          timeEl.textContent = `${minutes}m ${seconds}s`;
        }
      }
      if (errorsEl) errorsEl.textContent = stats.totalErrors || 0;
      if (errorsLeftEl) errorsLeftEl.textContent = stats.errorsLeft || 0;

      // Show dashboard
      if (statsDashboard) {
        statsDashboard.style.display = 'flex';
      }

      if (hiddenInput) {
        hiddenInput.blur();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fall back to simple completion screen
      // Keyboard is already hidden above
      if (completionScreen) {
        completionScreen.style.display = 'flex';
      }
    }
  }

  function showCompletionScreen() {
    console.log('showCompletionScreen called');

    // Hide stats dashboard if visible
    if (statsDashboard) {
      statsDashboard.style.display = 'none';
    }

    if (!completionScreen) {
      console.error('Completion screen element not found!');
      return;
    }

    // Hide typing container
    const typingTextContainer = document.getElementById('classic-typing-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'none';
    }

    // Hide racing track
    const racingTrackContainer = document.getElementById('racing-track-container');
    if (racingTrackContainer) {
      racingTrackContainer.style.display = 'none';
    }

    // Hide meteorite rain container
    const meteoriteRainContainer = document.getElementById('meteorite-rain-container');
    if (meteoriteRainContainer) {
      meteoriteRainContainer.style.display = 'none';
    }

    // Hide tower defense container
    const towerDefenseContainer = document.getElementById('tower-defense-container');
    if (towerDefenseContainer) {
      towerDefenseContainer.style.display = 'none';
    }

    // Hide keyboard when completion screen is shown
    if (keyboardContainer) {
      keyboardContainer.classList.remove('visible');
    }

    // Hide real-time stats when completion screen is shown
    if (realtimeStatsContainer) {
      realtimeStatsContainer.style.display = 'none';
    }

    // Hide keyboard-stats-wrapper when completion screen is shown
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'none';
    }

    // Hide the restart button when completion screen is shown
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'none';
    }

    // Calculate and save statistics
    console.log('About to calculate statistics...');
    let stats = calculateStatistics();
    console.log('Statistics result:', stats);

    // For meteorite rain games, create stats even if calculateStatistics returns null
    const isMeteoriteRainGame = config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame;
    if (isMeteoriteRainGame && (!stats || stats === null)) {
      // Create minimal stats for meteorite rain using game's own timing
      const gameStartTime = currentGame.gameStartTime;
      const endTime = Date.now();
      const totalTimeSeconds = gameStartTime ? (endTime - gameStartTime) / 1000 : 0;

      stats = {
        totalErrors: 0,
        errorsLeft: 0,
        totalTime: totalTimeSeconds,
        accuracy: 100, // Not applicable for word-based game, but set to 100
        speed: 0 // Not applicable for word-based game
      };
      console.log('Created stats for meteorite rain game:', stats);
    }

    // For racing game or meteorite rain, show dashboard even if stats are null
    const isRacingGame = config.gameType === 'racing' && currentGame;
    const shouldShowDashboard = config.showStats === true || (isRacingGame && currentGame.playerWon !== null) || isMeteoriteRainGame;

    if (stats) {
      console.log('Calling saveStatistics...');
      saveStatistics(stats).then(() => {
        // After saving, check if we should show stats dashboard
        if (shouldShowDashboard) {
          // Wait a bit for the file to be written, then show dashboard
          setTimeout(() => {
            showStatsDashboard();
          }, 200);
        } else {
          // Show simple completion screen
          // Ensure real-time stats are hidden
          if (realtimeStatsContainer) {
            realtimeStatsContainer.style.display = 'none';
          }
          completionScreen.style.display = 'flex';
          if (hiddenInput) {
            hiddenInput.blur();
          }
        }
      });
    } else {
      console.log('No statistics to save (stats is null)');
      // For racing game or meteorite rain, still show dashboard
      if (shouldShowDashboard) {
        setTimeout(() => {
          showStatsDashboard();
        }, 200);
      } else {
        // Show simple completion screen
        // Ensure real-time stats are hidden
        if (realtimeStatsContainer) {
          realtimeStatsContainer.style.display = 'none';
        }
        completionScreen.style.display = 'flex';
        if (hiddenInput) {
          hiddenInput.blur();
        }
      }
    }
  }

  async function initialize() {
    // Load config first
    await loadConfig();

    textContainer = document.getElementById('typing-text');
    hiddenInput = document.getElementById('hidden-input');
    completionScreen = document.getElementById('completion-screen');
    statsDashboard = document.getElementById('stats-dashboard');
    restartButton = document.getElementById('btn-restart');
    startOverButton = document.getElementById('btn-start-over');
    statsStartOverButton = document.getElementById('btn-stats-start-over');
    realtimeStatsContainer = document.getElementById('realtime-stats-container');

    if (!hiddenInput) {
      console.error('Required elements not found');
      return;
    }

    // Initialize game based on config
    initializeGame();

    // Initialize keyboard
    initializeKeyboard();

    // Set up event listeners
    hiddenInput.addEventListener('input', handleInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);

    // Add global keydown listener for tower defense to auto-focus input when typing
    if (config.gameType === 'towerDefense') {
      document.addEventListener('keydown', (e) => {
        // Only focus if input is not already focused and user is typing a regular character
        if (hiddenInput && document.activeElement !== hiddenInput &&
            e.target !== hiddenInput &&
            !e.ctrlKey && !e.metaKey && !e.altKey &&
            e.key.length === 1 && e.key.match(/[a-zA-Z0-9\s.,!?;:'"()-]/)) {
          hiddenInput.focus();
          // Dispatch the keydown event to the input so it gets processed
          const keydownEvent = new KeyboardEvent('keydown', {
            key: e.key,
            code: e.code,
            bubbles: true,
            cancelable: true
          });
          hiddenInput.dispatchEvent(keydownEvent);
          // Also dispatch input event to trigger handleInput which will start the game
          const inputEvent = new Event('input', { bubbles: true });
          hiddenInput.dispatchEvent(inputEvent);
        }
      });
    }

    // Set up event listeners for meteorite rain input
    const meteoriteInput = document.getElementById('meteorite-typing-input');
    if (meteoriteInput) {
      meteoriteInput.addEventListener('input', handleInput);
      meteoriteInput.addEventListener('keydown', handleKeyDown);
    }

    if (restartButton) {
      restartButton.addEventListener('click', restart);
    }

    if (startOverButton) {
      startOverButton.addEventListener('click', restart);
    }

    if (statsStartOverButton) {
      statsStartOverButton.addEventListener('click', restart);
    }

    // Focus the input when clicking on the text container or racing track
    const typingTextContainer = document.querySelector('.typing-text-container');
    const racingTrackContainer = document.getElementById('racing-track-container');

    if (typingTextContainer) {
      typingTextContainer.addEventListener('click', () => {
        const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
        const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
        if (hiddenInput && !isCompletionVisible && !isStatsVisible) {
          hiddenInput.focus();
        }
      });
    }

    if (racingTrackContainer) {
      racingTrackContainer.addEventListener('click', () => {
        const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
        const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
        if (hiddenInput && !isCompletionVisible && !isStatsVisible) {
          hiddenInput.focus();
        }
      });
    }

    // Focus meteorite input when clicking on play area
    const meteoritePlayArea = document.getElementById('meteorite-play-area');
    if (meteoritePlayArea) {
      meteoritePlayArea.addEventListener('click', () => {
        const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
        const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
        const meteoriteInput = document.getElementById('meteorite-typing-input');
        if (meteoriteInput && !isCompletionVisible && !isStatsVisible) {
          meteoriteInput.focus();
        }
      });
    }

    // Load the text
    await loadText();

    // Extract words for meteorite rain game after text is loaded
    if (config.gameType === 'meteoriteRain' && currentGame instanceof MeteoriteRainGame) {
      if (currentGame.extractWords) {
        currentGame.extractWords();
      }
    }

    // Extract words for tower defense game after text is loaded
    if (config.gameType === 'towerDefense' && currentGame instanceof TowerDefenseGame) {
      if (currentGame.extractWords) {
        currentGame.extractWords();
        currentGame.updateWordDisplay();
      }
    }

    // Update track dimensions after text is loaded (for racing game)
    if (currentGame && currentGame.updateTrackDimensions) {
      // Wait for layout to settle
      setTimeout(() => {
        if (currentGame && currentGame.updateTrackDimensions) {
          currentGame.updateTrackDimensions();
        }
      }, 100);
    }

    // Initialize real-time stats display
    updateRealtimeStats();

    // Focus the appropriate input after a short delay
    setTimeout(() => {
      const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
      const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
      if (isCompletionVisible || isStatsVisible) return;

      if (config.gameType === 'meteoriteRain') {
        const meteoriteInput = document.getElementById('meteorite-typing-input');
        if (meteoriteInput) {
          meteoriteInput.focus();
        }
      } else if (hiddenInput) {
        hiddenInput.focus();
      }
    }, 100);

    // Handle window resize for racing game
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        if (currentGame && currentGame.updateTrackDimensions) {
          currentGame.updateTrackDimensions();
        }
      }, 250);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
