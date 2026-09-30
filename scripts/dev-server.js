// Local stand-in for Vercel: serves index.html and runs api/*.js handlers.
// Without BLOB_READ_WRITE_TOKEN, data is stored in .data/ instead of Vercel Blob.
//   APP_PASSCODE=test npm run dev
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = Number(process.env.PORT || 3000);
process.chdir(ROOT);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const m = /^\/api\/([a-z-]+)$/.exec(url.pathname);
    if (m) {
      const mod = await import(pathToFileURL(path.join(ROOT, 'api', m[1] + '.js')).href).catch(() => null);
      const handler = mod && mod[req.method];
      if (!handler) { res.writeHead(mod ? 405 : 404).end(); return; }
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? 'half' : undefined,
      });
      const response = await handler(request);
      const headers = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await fs.readFile(path.join(ROOT, 'index.html')));
      return;
    }
    res.writeHead(404).end();
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, () => console.log(`Mug Collection running at http://localhost:${PORT}`));
