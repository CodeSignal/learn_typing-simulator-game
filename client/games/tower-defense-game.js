import { state } from '../state.js';
import { showCompletionScreen } from '../completion.js';

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
export class TowerDefenseGame {
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
    if (!state.originalText || state.originalText.length === 0) {
      this.words = [];
      return;
    }

    // Split text into words (simple split on whitespace)
    this.words = state.originalText.trim().split(/\s+/).filter(word => word.length > 0);

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
    const archerTower = this.createTowerOption('archer', 'Archer Tower', 100, '\u{1F3F9}');
    const wizardTower = this.createTowerOption('wizard', 'Wizard Tower', 150, '\u{1F52E}');
    const bombTower = this.createTowerOption('bomb', 'Bomb Tower', 250, '\u{1F4A3}');

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
        if (state.hiddenInput) {
          setTimeout(() => {
            state.hiddenInput.focus();
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
    this.lives = state.config.towerDefense?.initialLives || 3;
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
    if (state.originalText && state.originalText.length > 0) {
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
