# Typing Simulator Game

Typing practice app with three modes:
- `classic`: standard text typing
- `racing`: race opponents while typing
- `meteoriteRain`: destroy falling word meteorites by typing them

## Setup

```bash
git submodule update --init --recursive
npm install
```

## Run

```bash
# local development (Vite on 3000 + API/WebSocket on 3001)
npm run start:dev

# production build output to dist/
npm run build

# serve dist/ on 3000
npm run start:prod
```

`npm start` maps to `npm run start:prod`.

## Configuration

Runtime behavior is controlled by `client/config.json`:
- `gameType`: `classic`, `racing`, or `meteoriteRain`
- `keyboard`: show/hide visual keyboard
- `availableKeys`: allowed keys (empty array means all keys)
- `showStats`: show final stats dashboard
- `realTimeStats`: enabled live metrics (`speed`, `accuracy`, `time`, `errors`, `errorsLeft`, `chars`)
- `racing`: mode-specific config (`opponentSpeeds`, `mistakesAllowed`)
- `meteoriteRain`: mode-specific config (`meteoriteSpeed`, `spawnInterval`, `pointsPerChar`, `difficulty`)

## Main Files

- `client/index.html`: app shell and mode containers
- `client/typing-simulator.js`: core gameplay and stats logic
- `client/typing-simulator.css`: gameplay styles
- `client/app.css`: shared shell/layout styles
- `client/design-system/components/modal/modal.js`: design-system modal used for help
- `client/help-content.html`: help text shown in the modal
- `client/text-to-input.txt`: source text used for typing
- `server.js`: `/message`, `/save-stats`, production static hosting
- `extract_solution.py`: parses and prints `client/stats.txt`

## API Endpoints

- `POST /message`
  - Body: `{ "message": "..." }`
  - Broadcasts alert messages to connected `/ws` clients.

- `POST /save-stats`
  - Body: plain text payload
  - Persists results to `client/stats.txt`.

## Notes

- Help content is loaded from `client/help-content.html` and shown via `Modal.createHelpModal` from the design system when `#btn-help` is clicked.
- In development, Vite serves static assets and proxies `/message`, `/save-stats`, and `/ws` to the API server.
