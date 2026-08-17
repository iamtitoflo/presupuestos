import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Serves the repo root exactly like `python3 -m http.server`, so the e2e
// tests exercise the real static files (index.html loading js/main.js as an
// ES module, sw.js, the vendored jsPDF, etc.) rather than a mock.
export function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(ROOT, reqPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export function serverUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

// Chromium launch options. In CI/dev machines this resolves via Playwright's
// normal bundled-browser lookup (after `npx playwright install chromium`).
// PW_CHROMIUM_PATH lets a sandboxed environment without internet access to
// the Playwright CDN point at a pre-provisioned browser instead.
export function chromiumLaunchOptions() {
  return process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
}
