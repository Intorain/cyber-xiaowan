#!/usr/bin/env node
// 赛博小晚桌宠 · 本地服务
// 零依赖：仅使用 Node 内置模块，所有流量只走 127.0.0.1 回环地址。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeHome } from './runtime-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const assetsDir = path.join(here, 'assets');
const runtimeDir = runtimeHome();
const runtimeFile = path.join(runtimeDir, 'pet.json');

const manifest = JSON.parse(await readFile(path.join(here, 'pets.json'), 'utf8'));
const stateNames = Object.keys(manifest.states);

/** @type {Map<import('node:http').ServerResponse, boolean>} */
const sseClients = new Map();
const state = { name: manifest.defaultState, note: '', since: Date.now() };

function setState(name, note = '') {
  if (!stateNames.includes(name)) return false;
  state.name = name;
  state.note = String(note || '').slice(0, 120);
  state.since = Date.now();
  broadcast(JSON.stringify({ type: 'state', ...state }));
  return true;
}

function broadcast(payload) {
  for (const [res] of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function readBody(req, limit = 8 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function serveFile(res, absolutePath) {
  const ext = path.extname(absolutePath).toLowerCase();
  const stream = createReadStream(absolutePath);
  stream.once('open', () => {
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.once('error', (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    sendJson(res, 500, { error: 'failed to read file' });
  });
}

function hasTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://${req.headers.host}`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return serveFile(res, path.join(publicDir, 'index.html'));
    }

    if (req.method === 'GET' && url.pathname === '/pets.json') {
      return sendJson(res, 200, manifest);
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      return sendJson(res, 200, { ...manifest, version: 1 });
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(res, 200, state);
    }

    if (req.method === 'POST' && url.pathname === '/api/state') {
      if (!hasTrustedOrigin(req)) {
        return sendJson(res, 403, { error: 'forbidden origin' });
      }
      const body = JSON.parse((await readBody(req)) || '{}');
      const ok = setState(body.state, body.note);
      if (!ok) {
        return sendJson(res, 400, { error: 'unknown state', states: stateNames });
      }
      return sendJson(res, 200, state);
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'state', ...state })}\n\n`);
      sseClients.set(res, true);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const relative = path.normalize(decodeURIComponent(url.pathname.slice('/assets/'.length)));
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return sendJson(res, 403, { error: 'forbidden' });
      }
      const absolute = path.join(assetsDir, relative);
      if (!absolute.startsWith(assetsDir)) return sendJson(res, 403, { error: 'forbidden' });
      return serveFile(res, absolute);
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    sendJson(res, 500, { error: String((error && error.message) || error) });
  }
});

export async function start({ port = 0 } = {}) {
  await mkdir(runtimeDir, { recursive: true });
  await new Promise((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' ? address.port : port;
  await writeFile(runtimeFile, `${JSON.stringify({ port: actualPort, pid: process.pid, startedAt: new Date().toISOString() })}\n`);

  server.on('close', () => {
    readFile(runtimeFile, 'utf8')
      .then((text) => {
        const info = JSON.parse(text);
        if (info.pid === process.pid) {
          return writeFile(runtimeFile, '');
        }
        return undefined;
      })
      .catch(() => {});
  });

  return { port: actualPort, url: `http://127.0.0.1:${actualPort}/` };
}
