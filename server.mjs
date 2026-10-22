import http from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_MESSAGE = 96 * 1024;
const RESUME_MS = 20_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const PUBLIC_FILES = new Set(['index.html', 'game.css', 'playcanvas.css', 'start.js', 'game-playcanvas.js', 'assets-local.js']);
const id = () => randomBytes(18).toString('hex');

function acceptedEncodings(header = '') {
  return header.split(',').map(item => {
    const [name, ...parameters] = item.trim().toLowerCase().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const q = quality == null ? 1 : Number(quality.trim().slice(2));
    return { name, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
}

export function readIceServers(value = process.env.ICE_SERVERS_JSON) {
  if (!value) return [{ urls: 'stun:stun.l.google.com:19302' }];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > 12) throw new Error('ICE_SERVERS_JSON must contain at most 12 ICE server objects.');
  for (const server of parsed) {
    const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
    if (!Array.isArray(urls) || !urls.length || urls.some(url => typeof url !== 'string' || !/^(stun|stuns|turn|turns):[^\s]+$/.test(url))) throw new Error('Invalid ICE server URL.');
    if (server.username != null && typeof server.username !== 'string') throw new Error('Invalid ICE username.');
    if (server.credential != null && typeof server.credential !== 'string') throw new Error('Invalid ICE credential.');
  }
  return parsed;
}

/** Public static files and a small room/signaling/relay service; game authority stays in the host browser. */
export function createGameServer({ root = ROOT, iceServers = readIceServers(), publicOrigin = process.env.PUBLIC_ORIGIN || '', resumeMs = RESUME_MS, maxRooms = 1000 } = {}) {
  const rooms = new Map();
  const sessions = new Map();
  const tokens = new Map();
  let shuttingDown = false;
  const send = (session, message) => {
    const ws = session?.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Slow connection'); return false; }
    ws.send(JSON.stringify(message));
    return true;
  };
  const roomPeers = room => [room.host, ...room.guests.values()];
  const broadcast = (room, message, except) => { for (const session of roomPeers(room)) if (session !== except) send(session, message); };
  function removeSession(session, reason = 'Oyuncu ayrıldı.') {
    clearTimeout(session.expiry);
    sessions.delete(session.id);
    tokens.delete(session.token);
    const room = rooms.get(session.room);
    if (!room) return;
    session.room = null;
    if (room.host === session) {
      rooms.delete(room.code);
      for (const guest of room.guests.values()) {
        guest.room = null;
        send(guest, { type: 'room-closed', reason: 'Oda sahibi ayrıldı. Yeni bir oda oluşturabilirsiniz.' });
      }
      room.guests.clear();
    } else {
      room.guests.delete(session.id);
      send(room.host, { type: 'peer-left', id: session.id, reason });
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      if (pathname === '/runtime-config') {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', MIME['.json']);
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ protocol: 2, roomPath: '/room', iceServers }));
        return;
      }
      if (pathname === '/health') {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', MIME['.json']);
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, service: 'son-koridor', rooms: rooms.size }));
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if ((!PUBLIC_FILES.has(relative) && !relative.startsWith('assets/')) || relative.includes('\\') || relative.split('/').some(part => part === '..' || part.startsWith('.'))) { res.writeHead(404).end(); return; }
      const realRoot = await realpath(root);
      const file = await realpath(resolve(root, relative));
      if (!file.startsWith(realRoot + sep)) { res.writeHead(404).end(); return; }
      let info = await stat(file);
      if (!info.isFile()) { res.writeHead(404).end(); return; }
      let responseFile = file;
      if (['.js', '.css'].includes(extname(file))) {
        res.setHeader('Vary', 'Accept-Encoding');
        const accepted = acceptedEncodings(req.headers['accept-encoding']);
        const options = ['br', 'gzip'].map((encoding, preference) => ({ encoding, preference, q: accepted.find(item => item.name === encoding)?.q ?? accepted.find(item => item.name === '*')?.q ?? 0 })).filter(item => item.q > 0).sort((a, b) => b.q - a.q || a.preference - b.preference);
        for (const option of options) {
          try {
            const candidate = await realpath(file + (option.encoding === 'br' ? '.br' : '.gz'));
            if (!candidate.startsWith(realRoot + sep)) continue;
            const compressed = await stat(candidate);
            // A development rebuild must never serve a stale sibling from an older build.
            if (!compressed.isFile() || compressed.mtimeMs < info.mtimeMs) continue;
            responseFile = candidate; info = compressed;
            res.setHeader('Content-Encoding', option.encoding);
            break;
          } catch { /* Missing compression artifacts fall back to the original file. */ }
        }
      }
      res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
      res.setHeader('Content-Length', info.size);
      res.setHeader('Cache-Control', relative.startsWith('assets/') ? 'public, max-age=86400' : 'no-cache');
      res.writeHead(200);
      if (req.method === 'HEAD') res.end();
      else createReadStream(responseFile).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404).end(); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    let valid = false;
    try {
      const requestPath = new URL(req.url, 'http://localhost').pathname;
      const origin = req.headers.origin;
      valid = requestPath === '/room' && (!origin || (publicOrigin ? new URL(origin).origin === new URL(publicOrigin).origin : new URL(origin).host === req.headers.host));
    } catch { /* Invalid URLs are rejected below. */ }
    if (!valid) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    let session = { id: id(), token: id(), ws, room: null, role: null, expiry: null };
    sessions.set(session.id, session);
    tokens.set(session.token, session);
    let quota = 480;
    let quotaAt = Date.now();
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    send(session, { type: 'hello', id: session.id, token: session.token, protocol: 2 });
    ws.on('message', (bytes, binary) => {
      if (session.ws !== ws) return;
      const now = Date.now();
      // One host multiplexes up to seven clients; its state and RPC responses share this socket.
      quota = Math.min(480, quota + (now - quotaAt) * 0.24);
      quotaAt = now;
      if (binary || bytes.length > MAX_MESSAGE || (quota -= 1) < 0) { ws.close(1008, 'Message limit'); return; }
      let message;
      try { message = JSON.parse(bytes.toString()); } catch { ws.close(1008, 'Invalid JSON'); return; }
      if (!message || typeof message !== 'object') return;
      const requestId = typeof message.requestId === 'string' ? message.requestId.slice(0, 100) : undefined;
      const error = (reason, status = 400) => send(session, { type: 'error', requestId, reason, status });
      if (message.type === 'resume') {
        const old = tokens.get(message.token);
        if (!old || old === session || !old.room || old.ws?.readyState === WebSocket.OPEN) { error('Oturum yeniden bağlanamıyor.', 410); return; }
        removeSession(session);
        session = old;
        clearTimeout(session.expiry);
        session.expiry = null;
        session.ws = ws;
        const room = rooms.get(session.room);
        send(session, { type: 'resumed', requestId, id: session.id, token: session.token, code: session.room, role: session.role, hostId: room?.host.id });
        if (room) broadcast(room, { type: 'peer-resumed', id: session.id }, session);
        return;
      }
      if (message.type === 'leave') { removeSession(session); return; }
      if (message.type === 'create') {
        if (session.room) { error('Zaten bir odadasın.'); return; }
        if (rooms.size >= maxRooms) { error('Sunucu dolu. Biraz sonra yeniden dene.', 503); return; }
        const capacity = Number(message.maxPlayers);
        if (!Number.isInteger(capacity) || capacity < 2 || capacity > 8) { error('Oda sınırı 2–8 olmalı.'); return; }
        let code;
        do code = String(randomInt(10_000, 100_000)); while (rooms.has(code));
        session.room = code;
        session.role = 'host';
        rooms.set(code, { code, capacity, host: session, guests: new Map() });
        send(session, { type: 'created', requestId, code, me: session.id });
        return;
      }
      if (message.type === 'join') {
        if (session.room) { error('Zaten bir odadasın.'); return; }
        const room = rooms.get(message.code);
        if (!room) { error('Oda bulunamadı. Kodu kontrol et.', 404); return; }
        if (room.guests.size + 1 >= room.capacity) { error('Oda dolu.', 409); return; }
        session.room = room.code;
        session.role = 'guest';
        room.guests.set(session.id, session);
        send(session, { type: 'joined', requestId, code: room.code, me: session.id, hostId: room.host.id });
        send(room.host, { type: 'peer-joined', id: session.id });
        return;
      }
      const room = rooms.get(session.room);
      if (!room) { error('Odada değilsin.', 410); return; }
      if (message.type === 'capacity') {
        if (room.host !== session) { error('Yalnızca oda sahibi değiştirebilir.', 403); return; }
        const capacity = Number(message.maxPlayers);
        if (!Number.isInteger(capacity) || capacity < Math.max(2, room.guests.size + 1) || capacity > 8) { error('Geçersiz oda sınırı.'); return; }
        room.capacity = capacity;
        send(session, { type: 'capacity-updated', requestId, maxPlayers: capacity });
        return;
      }
      if (message.type === 'relay' || message.type === 'signal') {
        const target = room.host === session ? room.guests.get(message.to) : message.to === room.host.id ? room.host : null;
        if (!target || !message.data || typeof message.data !== 'object') { error('Geçersiz alıcı.'); return; }
        if (JSON.stringify(message.data).length > 64 * 1024) { ws.close(1008, 'Payload limit'); return; }
        send(target, { type: message.type, from: session.id, data: message.data });
        return;
      }
      error('Geçersiz komut.');
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      if (session.ws !== ws || !sessions.has(session.id)) return;
      session.ws = null;
      if (!session.room || shuttingDown) { removeSession(session); return; }
      const room = rooms.get(session.room);
      if (room) broadcast(room, { type: 'peer-suspended', id: session.id }, session);
      session.expiry = setTimeout(() => removeSession(session, 'Bağlantı koptu.'), resumeMs);
      session.expiry.unref?.();
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate();
      else { ws.alive = false; ws.ping(); }
    }
  }, 15_000);
  heartbeat.unref();
  return {
    server, wss, rooms,
    listen(port = 8001, host = '127.0.0.1') { return new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolveListen(server.address()); }); }); },
    async close() {
      shuttingDown = true;
      clearInterval(heartbeat);
      for (const session of sessions.values()) clearTimeout(session.expiry);
      for (const ws of wss.clients) ws.terminate();
      await new Promise(done => wss.close(done));
      await new Promise(done => server.close(done));
      server.closeAllConnections?.();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const service = createGameServer();
  const address = await service.listen(Number(process.env.PORT) || 8001, process.env.HOST || '127.0.0.1');
  console.log(`Son Koridor server listening on ${address.address}:${address.port}`);
  const stop = async () => { await service.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
