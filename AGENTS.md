# Repository Guidelines

## Product Context

This repository hosts a typing simulator game built with vanilla JavaScript and
the CodeSignal Design System.

Supported game modes are configured in `client/config.json`:
- `classic`: standard line-by-line typing flow
- `racing`: player car vs opponents progressing across the typed text
- `meteoriteRain`: type falling words before they hit the ground
- `towerDefense`: type prompted words to defeat enemies before they reach the castle
- `audio`: a recorded clip (`audio.src`, falling back to the Web Speech API) is played while the target text stays hidden; the user transcribes what they hear

The `allowMistakes` config flag (classic/text modes) toggles natural typing (wrong
characters are accepted and marked incorrect, completion is reaching the end of the
text) versus the default guided mode (wrong keystrokes are rejected until corrected).

The `includeTranscript` config flag (any mode) makes completion append the expected
and submitted transcriptions to `stats.txt` on submit — handled in `completion.js`
(`saveCompletionStats`, layered on top of the shared serializer so `stats.js` stays
untouched). The base task's `.codesignal/extract_solution.py` surfaces those
transcripts in STDOUT for the grader.

## Runtime Architecture

- `client/index.html`: single-page shell with containers and controls for classic, racing, meteorite rain, and tower defense modes
- `client/typing-simulator.js`: entry point and initialization orchestrator; wires DOM, listeners, focus management, config/text loading, and mode bootstrapping
- `client/state.js`: shared mutable state singleton used across all client modules
- `client/config.js`: loads and normalizes runtime configuration from `client/config.json`
- `client/text.js`: loads `client/text-to-input.txt`, initializes character state, renders text, and triggers completion for text-based modes
- `client/input.js`: central input and keydown handling with per-mode branches
- `client/keyboard.js`: visual keyboard rendering, key availability checks, and key highlighting
- `client/stats.js`: real-time/final stats calculation, stats parsing, and `/save-stats` persistence
- `client/completion.js`: completion screen and stats dashboard flow
- `client/restart.js`: reset and restart flow for all game modes
- `client/game-manager.js`: game factory/lifecycle coordinator that instantiates the active mode and starts its loops
- `client/games/classic-game.js`: classic mode adapter
- `client/games/racing-game.js`: racing mode behavior and animation
- `client/games/meteorite-rain-game.js`: meteorite rain gameplay loop
- `client/games/tower-defense-game.js`: tower defense gameplay loop and UI updates
- `client/games/audio-game.js`: audio dictation mode (speaks the hidden target text, captures the transcription, and triggers stats)
- `client/typing-simulator.css`: simulator visuals for all game modes
- `client/help.js`: help modal bootstrap
- `client/design-system/components/modal/modal.js`: design-system modal component used by help modal flow
- `client/help-content.html`: help guide loaded into the modal at runtime
- `client/config.json`: runtime feature toggles and mode parameters
- `client/text-to-input.txt`: source text used for typing content/word pool
- `server.js`: API server for `/save-stats` and production static hosting
- `extract_solution.py`: utility that parses and prints `client/stats.txt`

## Development Commands

```bash
# first-time setup
git submodule update --init --recursive
npm install

# local dev (Vite on :3000, API server on :3001)
npm run start:dev

# production build
npm run build

# serve dist/ in production mode on :3000
npm run start:prod
```

## Data and API Contracts

- Text source: client fetches `./text-to-input.txt`
- Config source: client fetches `./config.json`
- Stats write path:
  - client POSTs plain text to `/save-stats`
  - server writes payload to `client/stats.txt`

## Contribution Rules

- Keep the app framework-free unless a migration is explicitly requested.
- Keep cross-cutting logic in the shared modules above; do NOT dump new behavior into `client/typing-simulator.js` unless it is truly initialization/orchestration code.
- Keep mode-specific gameplay inside `client/games/` and shared behavior in the top-level client modules.
- Preserve the `id` and class hooks used across `client/index.html`, `client/typing-simulator.js`, `client/help.js`, and the game modules.
- If you change gameplay behavior, update both `README.md` and `client/help-content.html`.
- If you add, remove, or rename client modules, update the runtime architecture sections in both this file and `README.md` in the same change.
- If you change config keys or API payloads, update this file and README in the same change.
- `client/app.css` contains shared shell styles; keep `client/index.html` and the design-system asset includes aligned to that file.

## Validation Checklist

- Run `npm run build` after JavaScript/CSS/HTML changes.
- For UI/flow changes, manually verify:
  - help modal opens from `#btn-help`
  - active game mode from `client/config.json` initializes the correct container and input flow
  - completion and restart flows still work
  - affected game loops still start/reset correctly (`racing`, `meteoriteRain`, `towerDefense`, `audio`)
  - stats persist to `client/stats.txt` through `/save-stats`
