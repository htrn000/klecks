import http from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.env.STATIC_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist'));
const apiHost = process.env.PROJECT_API_HOST || 'project-api';
const apiPort = Number(process.env.PROJECT_API_PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };

http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const proxy = http.request({ hostname: apiHost, port: apiPort, method: request.method, path: request.url, headers: request.headers }, (upstream) => {
            response.writeHead(upstream.statusCode || 502, upstream.headers);
            upstream.pipe(response);
        });
        proxy.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
        request.pipe(proxy);
        return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end(); return; }
    const candidate = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) { response.writeHead(404); response.end(); return; }
    let file = candidate;
    try {
        await access(file);
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        await access(file);
    } catch { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 5050), '0.0.0.0');
