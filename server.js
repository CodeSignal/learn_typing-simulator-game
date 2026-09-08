const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DIST_DIR = path.join(__dirname, 'dist');
const CLIENT_DIR = path.join(__dirname, 'client');
// Check if IS_PRODUCTION is set to true
const isProduction = process.env.IS_PRODUCTION === 'true';
// In production mode, dist directory must exist
if (isProduction && !fs.existsSync(DIST_DIR)) {
  throw new Error(`Production mode enabled but dist directory does not exist: ${DIST_DIR}`);
}
// Force port 3000 in production, otherwise use PORT environment variable or default to 3000
const PORT = isProduction ? 3000 : (process.env.PORT || 3000);

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Get MIME type based on file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'text/plain';
}

function getStatsFilePath() {
  return isProduction
    ? path.join(DIST_DIR, 'stats.txt')
    : path.join(CLIENT_DIR, 'stats.txt');
}

// Play counter for audio tasks that cap how many times the clip may be played.
// It lives server-side (not in the browser) so reloading the page cannot hand
// the candidate a fresh listen budget.
function getPlaysFilePath() {
  return isProduction
    ? path.join(DIST_DIR, 'plays.json')
    : path.join(CLIENT_DIR, 'plays.json');
}

// The server is the authority on the limit too: config.json is on disk here, so
// the browser cannot raise its own cap by editing the copy it was served.
function getConfigFilePath() {
  return isProduction
    ? path.join(DIST_DIR, 'config.json')
    : path.join(CLIENT_DIR, 'config.json');
}

function getMaxPlays() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigFilePath(), 'utf8'));
    const max = config && config.audio && config.audio.maxPlays;
    return Number.isInteger(max) && max > 0 ? max : 0; // 0 = unlimited
  } catch (error) {
    return 0;
  }
}

// Returns the number of plays consumed, or null when the counter exists but
// cannot be trusted. A missing file means "none used yet"; corrupt data must NOT
// silently become 0, or a damaged file would hand back the whole listen budget.
function readPlaysUsed() {
  let raw;
  try {
    raw = fs.readFileSync(getPlaysFilePath(), 'utf8');
  } catch (error) {
    return error.code === 'ENOENT' ? 0 : null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Number.isInteger(parsed.playsUsed) || parsed.playsUsed < 0) return null;
    return parsed.playsUsed;
  } catch (error) {
    return null;
  }
}

// Write to a sibling temp file and rename, so an interrupted write can never
// leave a truncated plays.json behind (rename is atomic on the same filesystem).
function writePlaysUsed(playsUsed) {
  const playsPath = getPlaysFilePath();
  const dir = path.dirname(playsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = path.join(dir, `.plays.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify({ playsUsed }), 'utf8');
  fs.renameSync(tempPath, playsPath);
}

// Serve static files
function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

// Handle POST requests
function handlePostRequest(req, res, parsedUrl) {
  if (parsedUrl.pathname === '/play') {
    // Reserve one play. This is the authority: it decides against the limit in
    // config.json on disk, so a stale client, a second tab, or a dropped request
    // cannot push playback past the cap.
    try {
      const maxPlays = getMaxPlays();
      const used = readPlaysUsed();

      if (used === null) {
        // Counter unreadable: fail closed rather than granting a free play.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ allowed: false, unavailable: true, maxPlays }));
        return;
      }
      if (maxPlays && used >= maxPlays) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ allowed: false, playsUsed: used, maxPlays }));
        return;
      }

      const playsUsed = used + 1;
      writePlaysUsed(playsUsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ allowed: true, playsUsed, maxPlays }));
    } catch (error) {
      console.error('Error recording play:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to record play' }));
    }
    return;
  }

  if (parsedUrl.pathname === '/save-stats') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const statsPath = getStatsFilePath();
        const statsDir = path.dirname(statsPath);
        if (!fs.existsSync(statsDir)) {
          fs.mkdirSync(statsDir, { recursive: true });
        }

        fs.writeFileSync(statsPath, body, 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Statistics saved' }));

      } catch (error) {
        console.error('Error saving statistics:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save statistics' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathName = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;

  // Handle POST requests
  if (req.method === 'POST') {
    handlePostRequest(req, res, parsedUrl);
    return;
  }

  // Report how many plays have been consumed so the client can restore the
  // remaining listen budget after a reload.
  if (parsedUrl.pathname === '/plays') {
    const used = readPlaysUsed();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(used === null
      ? { unavailable: true, maxPlays: getMaxPlays() }
      : { playsUsed: used, maxPlays: getMaxPlays() }));
    return;
  }

  // In production mode, serve static files from dist directory
  if (isProduction) {
    // Strip leading slashes so path.join/resolve can't ignore DIST_DIR
    let filePath = path.join(DIST_DIR, pathName.replace(/^\/+/, ''));

    // Security check - prevent directory traversal
    const resolvedDistDir = path.resolve(DIST_DIR);
    const resolvedFilePath = path.resolve(filePath);
    const relativePath = path.relative(resolvedDistDir, resolvedFilePath);

    // Reject if path tries to traverse outside the base directory
    if (relativePath.startsWith('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    serveFile(filePath, res);
  } else {
    // Development mode - static files are served by Vite
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found (development mode - use Vite dev server `npm run start:dev`)');
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (isProduction) {
    console.log(`Serving static files from: ${DIST_DIR}`);
  } else {
    console.log(`Development mode - static files served by Vite`);
  }
  console.log('Press Ctrl+C to stop the server');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
