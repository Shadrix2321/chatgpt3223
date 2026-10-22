import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { WebSocket } from 'ws';
import { createGameServer, readIceServers } from '../server.mjs';
import { Mh, selectTransport } from '../src/network.mjs';

async function fixture(t, options = {}) {
  const service = createGameServer({ resumeMs: 80, ...options });
  const address = await service.listen(0);
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(() => service.close());
  return { ...service, baseUrl, wsUrl: baseUrl.replace('http:', 'ws:') + '/room' };
}

async function socket(t, url, options) {
  const ws = new WebSocket(url, options);
  const queue = [];
  const waiters = [];
  ws.on('message', bytes => {
    const message = JSON.parse(bytes.toString());
    const index = waiters.findIndex(waiter => waiter.matches(message));
    if (index !== -1) { const [waiter] = waiters.splice(index, 1); clearTimeout(waiter.timeout); waiter.resolve(message); }
    else queue.push(message);
  });
  const next = (type, predicate = () => true) => new Promise((resolve, reject) => {
    const matches = message => message.type === type && predicate(message);
    const index = queue.findIndex(matches);
    if (index !== -1) { resolve(queue.splice(index, 1)[0]); return; }
    const waiter = { resolve, matches, timeout: setTimeout(() => { const i = waiters.indexOf(waiter); if (i >= 0) waiters.splice(i, 1); reject(new Error(`No ${type} message`)); }, 1500) };
    waiters.push(waiter);
  });
  const hello = await next('hello');
  t.after(() => { for (const waiter of waiters) clearTimeout(waiter.timeout); ws.terminate(); });
  return { ws, hello, next, send: message => ws.send(JSON.stringify(message)) };
}

test('room registration, capacity, authenticated relay sender and host-only routing', async t => {
  const service = await fixture(t);
  const host = await socket(t, service.wsUrl);
  const guest = await socket(t, service.wsUrl);
  const extra = await socket(t, service.wsUrl);
  host.send({ type: 'create', maxPlayers: 2, requestId: 'create' });
  const created = await host.next('created');
  assert.match(created.code, /^\d{5}$/);
  guest.send({ type: 'join', code: created.code, requestId: 'join' });
  const joined = await guest.next('joined');
  assert.equal(joined.hostId, host.hello.id);
  assert.equal((await host.next('peer-joined')).id, guest.hello.id);
  extra.send({ type: 'join', code: created.code, requestId: 'full' });
  assert.equal((await extra.next('error')).status, 409);
  guest.send({ type: 'relay', to: host.hello.id, from: 'forged', data: { kind: 'test', value: 42 } });
  const forwarded = await host.next('relay');
  assert.equal(forwarded.from, guest.hello.id);
  assert.deepEqual(forwarded.data, { kind: 'test', value: 42 });
  guest.send({ type: 'capacity', maxPlayers: 8, requestId: 'deny' });
  assert.equal((await guest.next('error')).status, 403);
  host.send({ type: 'capacity', maxPlayers: 3, requestId: 'allow' });
  assert.equal((await host.next('capacity-updated')).maxPlayers, 3);
  extra.send({ type: 'join', code: created.code, requestId: 'join-again' });
  await extra.next('joined');
  guest.send({ type: 'relay', to: extra.hello.id, data: { kind: 'not-allowed' } });
  assert.equal((await guest.next('error')).status, 400);
  host.send({ type: 'leave' });
  assert.match((await guest.next('room-closed')).reason, /Oda sahibi/);
  assert.equal(service.rooms.size, 0);
});

test('unclean disconnect resumes the same authenticated room identity before expiry', async t => {
  const service = await fixture(t, { resumeMs: 1000 });
  const host = await socket(t, service.wsUrl);
  const guest = await socket(t, service.wsUrl);
  host.send({ type: 'create', maxPlayers: 2, requestId: 'c' });
  const { code } = await host.next('created');
  guest.send({ type: 'join', code, requestId: 'j' });
  await guest.next('joined'); await host.next('peer-joined');
  guest.ws.terminate();
  await host.next('peer-suspended');
  const replacement = await socket(t, service.wsUrl);
  replacement.send({ type: 'resume', token: guest.hello.token, requestId: 'r' });
  const resumed = await replacement.next('resumed');
  assert.equal(resumed.id, guest.hello.id);
  assert.equal(resumed.code, code);
  assert.equal((await host.next('peer-resumed')).id, guest.hello.id);
  replacement.send({ type: 'relay', to: host.hello.id, data: { resumed: true } });
  assert.equal((await host.next('relay')).from, guest.hello.id);
});

test('expired disconnected guest is removed and frees capacity', async t => {
  const service = await fixture(t);
  const host = await socket(t, service.wsUrl);
  const guest = await socket(t, service.wsUrl);
  host.send({ type: 'create', maxPlayers: 2, requestId: 'c' });
  const { code } = await host.next('created');
  guest.send({ type: 'join', code, requestId: 'j' });
  await guest.next('joined'); await host.next('peer-joined');
  guest.ws.terminate();
  await host.next('peer-left');
  assert.equal(service.rooms.get(code).guests.size, 0);
});

test('server refuses foreign browser origins and does not expose source or package files', async t => {
  const service = await fixture(t);
  const denied = new WebSocket(service.wsUrl, { origin: 'https://foreign.example' });
  const [error] = await once(denied, 'error');
  assert.match(error.message, /403/);
  for (const path of ['/src/network.mjs', '/package.json', '/.git/config', '/node_modules/ws/package.json', '/server.mjs', '/assets/../../server.mjs']) {
    assert.equal((await fetch(service.baseUrl + path)).status, 404, path);
  }
  const config = await fetch(service.baseUrl + '/runtime-config');
  assert.equal(config.headers.get('cache-control'), 'no-store');
  assert.equal((await config.json()).protocol, 2);
  assert.equal((await fetch(service.baseUrl + '/')).status, 200);
});

test('malformed JSON and oversized messages close the offending socket', async t => {
  const service = await fixture(t);
  const malformed = await socket(t, service.wsUrl);
  const closed = once(malformed.ws, 'close');
  malformed.ws.send('{bad');
  assert.equal((await closed)[0], 1008);
  const oversized = await socket(t, service.wsUrl);
  const tooLarge = once(oversized.ws, 'close');
  oversized.ws.send('x'.repeat(100 * 1024));
  assert.equal((await tooLarge)[0], 1009);
});

test('static precompressed JS negotiates encoding and decodes to the original bytes', async t => {
  const root = await mkdtemp('/tmp/son-koridor-compression-');
  const source = 'console.log("Son Koridor");\n'.repeat(80);
  await writeFile(root + '/game-playcanvas.js', source);
  await writeFile(root + '/game-playcanvas.js.gz', gzipSync(source));
  await writeFile(root + '/game-playcanvas.js.br', brotliCompressSync(source));
  const service = await fixture(t, { root });
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const encoding of ['gzip', 'br']) {
    const response = await fetch(service.baseUrl + '/game-playcanvas.js', { headers: { 'Accept-Encoding': encoding } });
    assert.equal(response.headers.get('content-encoding'), encoding);
    assert.equal(response.headers.get('vary'), 'Accept-Encoding');
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(await response.text(), source);
  }
  const identity = await fetch(service.baseUrl + '/game-playcanvas.js', { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0' } });
  assert.equal(identity.headers.get('content-encoding'), null);
  assert.equal(await identity.text(), source);
  // Compression sidecars cannot be downloaded as arbitrary public paths.
  assert.equal((await fetch(service.baseUrl + '/game-playcanvas.js.gz')).status, 404);
});

test('two real clients create, join, start and exchange authoritative state through relay without WebRTC', async t => {
  const service = await fixture(t);
  const options = { baseUrl: service.baseUrl, webSocketFactory: url => new WebSocket(url), forceRelay: true };
  const hostStates = [], guestStates = [];
  const host = new Mh({ ...options, onState: state => hostStates.push(state) });
  const guest = new Mh({ ...options, onState: state => guestStates.push(state) });
  t.after(() => { guest.close(); host.close(); });
  const created = await host.request('create', { name: 'Host', maxPlayers: 2 });
  const joined = await guest.request('join', { name: 'Guest', code: created.state.code });
  assert.equal(joined.state.players.length, 2);
  assert.notEqual(joined.me, created.me);
  assert.ok(joined.token);
  await host.request('start');
  const synced = await guest.request('sync', { seq: 1, move: { x: 0, z: 147, yaw: 0, crouch: true, sprint: false } });
  assert.equal(synced.state.phase, 'playing');
  assert.equal(synced.state.items.length, 10);
  assert.equal(synced.state.players.find(player => player.id === guest.me).crouch, true);
  assert.equal(guest.stats.transport, 'relay');
  assert.ok(guestStates.length > 0);
  assert.ok(hostStates.length > 0);
});

test('duplicate RPC arriving by both paths executes a host action only once', async t => {
  const service = await fixture(t);
  const options = { baseUrl: service.baseUrl, webSocketFactory: url => new WebSocket(url), forceRelay: true };
  const host = new Mh(options), guest = new Mh(options);
  t.after(() => { guest.close(); host.close(); });
  const created = await host.create({ name: 'Host', maxPlayers: 2 });
  await guest.join({ name: 'Guest', code: created.state.code });
  await host.request('start');
  const packet = { kind: 'rpc', id: `${guest.me}-r987`, body: { action: 'sync', seq: 987, move: { x: 0, z: 148, yaw: 0 } } };
  const revision = host.host.state._revision;
  host._packet(guest.me, packet, 'relay');
  const afterFirst = host.host.state._revision;
  host._packet(guest.me, packet, 'rtc');
  assert.ok(afterFirst > revision);
  assert.equal(host.host.state._revision, afterFirst);
  for (let sequence = 1000; sequence < 1070; sequence++) host._packet(guest.me, { kind: 'rpc', id: `${guest.me}-r${sequence}`, body: { action: 'sync', seq: sequence } }, 'relay');
  assert.equal(host.peers.get(guest.me).cache.has(packet.id), false);
  const afterEviction = host.host.state._revision;
  host._packet(guest.me, packet, 'rtc');
  assert.equal(host.host.state._revision, afterEviction, 'A duplicate whose result was evicted must not run again');
});

test('an eight-player room exchanges concurrent syncs without disconnecting the multiplexed host', async t => {
  const service = await fixture(t);
  const options = { baseUrl: service.baseUrl, webSocketFactory: url => new WebSocket(url), forceRelay: true };
  const host = new Mh(options);
  const guests = Array.from({ length: 7 }, () => new Mh(options));
  t.after(() => { for (const guest of guests) guest.close(); host.close(); });
  const created = await host.create({ name: 'Host', maxPlayers: 8 });
  for (let i = 0; i < guests.length; i++) await guests[i].join({ name: `Guest ${i}`, code: created.state.code });
  await host.request('start');
  for (let seq = 1; seq <= 10; seq++) {
    const states = await Promise.all(guests.map(guest => guest.request('sync', { seq, move: { x: 0, z: 148, yaw: 0 } })));
    assert.ok(states.every(result => result.state.players.length === 8));
    await new Promise(done => setTimeout(done, 110));
  }
  assert.equal(host.ws.readyState, WebSocket.OPEN);
  assert.ok(guests.every(guest => guest.ws.readyState === WebSocket.OPEN));
});

test('client automatically resumes a dropped relay socket and continues the same player', async t => {
  const service = await fixture(t, { resumeMs: 5000 });
  const options = { baseUrl: service.baseUrl, webSocketFactory: url => new WebSocket(url), forceRelay: true };
  const host = new Mh(options), guest = new Mh(options);
  t.after(() => { guest.close(); host.close(); });
  const created = await host.create({ name: 'Host', maxPlayers: 2 });
  await guest.join({ name: 'Guest', code: created.state.code });
  const oldIdentity = guest.me;
  const oldSocket = guest.ws;
  oldSocket.terminate();
  const deadline = Date.now() + 3000;
  while ((guest.ws === oldSocket || guest.ws?.readyState !== WebSocket.OPEN || guest.reconnectAttempt !== 0) && Date.now() < deadline) await new Promise(done => setTimeout(done, 30));
  assert.notEqual(guest.ws, oldSocket);
  assert.equal(guest.me, oldIdentity);
  const result = await guest.request('sync', { seq: 3 });
  assert.equal(result.me, oldIdentity);
  assert.equal(result.state.players.length, 2);
});

test('an unavailable native RTC implementation does not block relay gameplay', async t => {
  const service = await fixture(t);
  let attempted = 0;
  const options = { baseUrl: service.baseUrl, webSocketFactory: url => new WebSocket(url), forceRelay: false, rtcFactory: () => { attempted++; throw new Error('RTC unavailable'); } };
  const host = new Mh(options), guest = new Mh(options);
  t.after(() => { guest.close(); host.close(); });
  const created = await host.create({ name: 'Host', maxPlayers: 2 });
  await guest.join({ name: 'Guest', code: created.state.code });
  await host.request('start');
  const result = await guest.request('sync', { seq: 1 });
  assert.equal(result.state.phase, 'playing');
  const deadline = Date.now() + 1000;
  while (!attempted && Date.now() < deadline) await new Promise(done => setTimeout(done, 20));
  assert.ok(attempted > 0);
  assert.equal(guest.stats.transport, 'relay');
});

test('path selection requires samples, picks the faster route and fails back when RTC closes', () => {
  assert.equal(selectTransport({ rtc: [1], relay: [15, 15, 15] }), 'relay');
  assert.equal(selectTransport({ rtc: [3, 3, 3], relay: [25, 24, 26] }), 'rtc');
  assert.equal(selectTransport({ rtc: [40, 42, 41], relay: [12, 11, 12] }, 'rtc'), 'relay');
  assert.equal(selectTransport({ rtc: [1, 1, 1], relay: [50, 50, 50] }, 'rtc', false), 'relay');
});

test('solo creates and starts without any network dependency', async () => {
  const game = new Mh({ webSocketFactory: () => { throw new Error('Network must not be used'); } });
  try {
    const created = await game.create({ name: 'Solo', maxPlayers: 1 });
    assert.equal(created.state.players.length, 1);
    assert.equal((await game.request('start')).state.items.length, 6);
    assert.equal(game.stats.transport, 'local');
  } finally { game.close(); }
});

test('ICE configuration accepts STUN and TURN but rejects malformed credentials/configuration', () => {
  const config = readIceServers(JSON.stringify([{ urls: ['turn:relay.example:3478', 'turns:relay.example:443'], username: 'temporary-user', credential: 'temporary-password' }]));
  assert.equal(config[0].urls.length, 2);
  assert.throws(() => readIceServers('{invalid'));
  assert.throws(() => readIceServers('[{"urls":"https://example.com"}]'));
  assert.throws(() => readIceServers('[{"urls":"turn:example.com","credential":99}]'));
});
