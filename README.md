# Typing Simulator Game

Typing practice app with several modes:
- `classic`: standard text typing
- `racing`: race opponents while typing
- `meteoriteRain`: destroy falling word meteorites by typing them
- `towerDefense`: type prompted words to defeat enemies before they reach the castle
- `audio`: the target text is spoken aloud (Web Speech API) and hidden; the user transcribes what they hear

## Setup

```bash
git submodule update --init --recursive
npm install
```

## Run

```bash
# local development (Vite on 3000 + API server on 3001)
npm run start:dev

# production build output to dist/
npm run build

# serve dist/ on 3000
npm run start:prod
```

`npm start` maps to `npm run start:prod`.

## Configuration

Runtime behavior is controlled by `client/config.json`:
- `gameType`: `classic`, `racing`, `meteoriteRain`, `towerDefense`, or `audio`
- `keyboard`: show/hide visual keyboard
- `availableKeys`: allowed keys (empty array means all keys)
- `showStats`: show final stats dashboard
- `realTimeStats`: enabled live metrics (`speed`, `accuracy`, `time`, `errors`, `errorsLeft`, `chars`)
- `racing`: mode-specific config (`opponentSpeeds`, `mistakesAllowed`)
- `meteoriteRain`: mode-specific config (`meteoriteSpeed`, `spawnInterval`, `pointsPerChar`, `difficulty`)
- `towerDefense`: mode-specific config (`initialLives`, `cellSize`, `enemySpawnInterval`, `enemySpeed`, `enemyHealth`)
- `audio`: mode-specific config (`src` — URL of an audio/video clip to play; `rate` — playback rate, e.g. `0.9`)

In `audio` mode the target text is not shown. A recorded clip is played from
`audio.src` (falling back to the browser's speech synthesis if no `src` is set),
and the user transcribes what they hear. Accuracy is a character-level
similarity to the reference text (`text-to-input.txt`, which must match the clip)
and `errorsLeft` reports the number of mis-transcribed words.

## Main Files

- `client/index.html`: app shell and mode containers
- `client/typing-simulator.js`: core gameplay and stats logic
- `client/games/`: per-mode implementations (`classic-game.js`, `racing-game.js`, `meteorite-rain-game.js`, `tower-defense-game.js`, `audio-game.js`)
- `client/typing-simulator.css`: gameplay styles
- `client/app.css`: shared shell/layout styles
- `client/help.js`: help modal bootstrap
- `client/design-system/components/modal/modal.js`: design-system modal used for help
- `client/help-content.html`: help text shown in the modal
- `client/text-to-input.txt`: source text used for typing
- `server.js`: `/save-stats`, production static hosting
- `extract_solution.py`: parses and prints `client/stats.txt`

## API Endpoints

- `POST /save-stats`
  - Body: plain text payload
  - Persists results to `client/stats.txt`.

## Notes

- Help content is loaded from `client/help-content.html` and shown via `Modal.createHelpModal` from the design system when `#btn-help` is clicked.
- In development, Vite serves static assets and proxies `/save-stats` to the API server.
