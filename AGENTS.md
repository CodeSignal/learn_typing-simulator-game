# Repository Guidelines

## Product Context

This repository hosts a typing simulator game built with vanilla JavaScript and
the CodeSignal Design System.

Supported game modes are configured in `client/config.json`:
- `classic`: standard line-by-line typing flow
- `racing`: player car vs opponents progressing across the typed text
- `meteoriteRain`: type falling words before they hit the ground

## Runtime Architecture

- `client/index.html`: single-page shell with all mode containers and controls
- `client/typing-simulator.js`: game logic, input handling, rendering, stats
- `client/typing-simulator.css`: simulator visuals for all game modes
- `client/app.js`: help modal bootstrap
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
- Preserve the `id` and class hooks used by `client/typing-simulator.js`.
- If you change gameplay behavior, update both `README.md` and `client/help-content.html`.
- If you change config keys or API payloads, update this file and README in the same change.
- `client/app.css` contains shared shell styles; keep `client/index.html` and the design-system asset includes aligned to that file.

## Validation Checklist

- Run `npm run build` after JavaScript/CSS/HTML changes.
- For UI/flow changes, manually verify:
  - help modal opens from `#btn-help`
  - active game mode starts from `client/config.json`
  - completion and restart flows still work
  - stats persist to `client/stats.txt` through `/save-stats`
