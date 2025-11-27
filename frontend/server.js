import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs, createReadStream } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const serveFile = async (res, filePath) => {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stat = await fs.stat(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });

  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    res.writeHead(500).end('Internal Server Error');
  });
};

const sendNotFound = (res) => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/') {
      pathname = '/index.html';
    }

    let filePath = path.join(distDir, pathname);

    // 보안: dist 디렉터리 밖 접근 차단
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      await serveFile(res, filePath);
    } catch (error) {
      // SPA 라우팅을 위해 항상 index.html 반환
      const fallback = path.join(distDir, 'index.html');
      try {
        await serveFile(res, fallback);
      } catch {
        sendNotFound(res);
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

const PORT = process.env.PORT || 4173;
server.listen(PORT, () => {
  console.log(`✅ Frontend server listening on port ${PORT}`);
});

