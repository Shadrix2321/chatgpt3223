import { $l as GameHost } from './simulation.mjs';

const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
const code = () => String(10_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 90_000);
const now = () => performance.now();
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : Infinity;

/** Require several measured samples and a small hysteresis margin to avoid path flapping. */
export function selectTransport(samples, current = 'relay', rtcOpen = true) {
  if (!rtcOpen || samples.rtc.length < 3) return 'relay';
  if (samples.relay.length < 3) return current;
  const rtc = average(samples.rtc), relay = average(samples.relay);
  const margin = Math.max(0.15, Math.min(rtc, relay) * 0.1);
  if (current === 'rtc') return relay + margin < rtc ? 'relay' : 'rtc';
  return rtc + margin < relay ? 'rtc' : 'relay';
}

/** Host-authoritative game transport. Relay is usable immediately; RTC is an optional measured upgrade. */
export class Mh {
  constructor({ onState = () => {}, onClosed = () => {}, baseUrl = globalThis.location?.origin || 'http://127.0.0.1:8001', webSocketFactory = url => new WebSocket(url), rtcFactory = config => new RTCPeerConnection(config), forceRelay = globalThis.location ? new URLSearchParams(location.search).get('transport') === 'relay' : false } = {}) {
    Object.assign(this, { onState, onClosed, baseUrl, webSocketFactory, rtcFactory, forceRelay });
    this.peers = new Map();
    this.controls = new Map();
    this.pending = new Map();
    this.generation = 0;
    this.rpc = 0;
    this.closing = true;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  get stats() {
    if (this.host?.state.maxPlayers === 1) return { transport: 'local', rttMs: 0, peers: [] };
    const peers = [...this.peers.values()].map(peer => ({ id: peer.id, transport: peer.transport, rttMs: Math.round(average(peer.samples[peer.transport]) * 10) / 10, directReady: peer.dc?.readyState === 'open' }));
    const transports = new Set(peers.map(peer => peer.transport));
    const finite = peers.map(peer => peer.rttMs).filter(Number.isFinite);
    return { transport: transports.size > 1 ? 'mixed' : peers[0]?.transport || 'relay', rttMs: finite.length ? Math.round(average(finite)) : null, peers, reconnecting: !!this.reconnectTimer };
  }

  async request(action, payload = {}) {
    if (action === 'create') return this.create(payload);
    if (action === 'join') return this.join(payload);
    if (!this.me) throw failure('Oturum sona erdi.', 410);
    if (this.host) {
      const response = this.host.request(this.me, { action, ...payload });
      if (action === 'capacity' && this.ws) await this._control({ type: 'capacity', maxPlayers: this.host.state.maxPlayers });
      if (action !== 'sync') this.publish();
      return response;
    }
    return this._remote({ action, ...payload });
  }

  async create({ name, maxPlayers = 4 }) {
    this.close();
    const generation = this.generation;
    this.closing = false;
    try {
      if (Number(maxPlayers) === 1) {
        this.me = uid(); this.token = uid(); this.code = code();
      } else {
        await this._connectRelay();
        const response = await this._control({ type: 'create', maxPlayers: Number(maxPlayers) });
        this.code = response.code;
      }
      if (generation !== this.generation) throw failure('Bağlantı iptal edildi.', 499);
      this.hostId = this.me;
      this.host = new GameHost({ id: this.me, name, maxPlayers: Number(maxPlayers), code: this.code });
      this.tickTimer = setInterval(() => this.host?.step(), 50);
      this.publishTimer = setInterval(() => this.publish(), 100);
      this.probeTimer = setInterval(() => this._probeAll(), 2000);
      return { ...this.host.snapshot(this.me), token: this.token };
    } catch (error) {
      if (generation === this.generation) this.close();
      throw error;
    }
  }

  async join({ name, code: roomCode }) {
    if (!/^\d{5}$/.test(roomCode || '')) throw failure('5 haneli oda kodunu yaz.');
    this.close();
    const generation = this.generation;
    this.closing = false;
    try {
      await this._connectRelay();
      const response = await this._control({ type: 'join', code: roomCode });
      this.code = response.code; this.hostId = response.hostId;
      this._peer(this.hostId);
      this.probeTimer = setInterval(() => this._probeAll(), 2000);
      const joined = await this._remote({ action: 'join', name });
      if (generation !== this.generation) throw failure('Bağlantı iptal edildi.', 499);
      this._probeAll();
      return { ...joined, token: this.token };
    } catch (error) {
      if (generation === this.generation) this.close();
      throw error;
    }
  }

  async _connectRelay(resume = false) {
    const generation = this.generation;
    if (!resume) {
      this.configPromise = fetch(new URL('/runtime-config', this.baseUrl), { signal: AbortSignal.timeout(3000), cache: 'no-store' })
        .then(response => response.ok ? response.json() : {})
        .then(config => { if (generation === this.generation && Array.isArray(config.iceServers)) this.iceServers = config.iceServers; })
        .catch(() => {});
    }
    const url = new URL('/room', this.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = this.webSocketFactory(url.href);
    this.ws = ws;
    await new Promise((resolveOpen, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(failure('Oda sunucusuna bağlanılamadı. Siteyi oyun sunucusu üzerinden açın.')), 6000);
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error) { try { ws.close(); } catch { /* A failed connecting socket is already unusable. */ } }
        error ? reject(error) : resolveOpen();
      };
      ws.addEventListener('message', event => {
        if (generation !== this.generation || this.ws !== ws) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'hello') {
          if (!resume) { this.me = message.id; this.token = message.token; finish(); }
          else this._control({ type: 'resume', token: this.token }).then(result => { this.me = result.id; this.token = result.token; finish(); }).catch(finish);
        } else this._serverMessage(message);
      });
      ws.addEventListener('error', () => finish(failure('Oda sunucusu yanıt vermiyor. İnternet bağlantısını kontrol edin.')));
      ws.addEventListener('close', () => {
        finish(failure('Oda sunucusu bağlantısı kapandı.'));
        if (generation !== this.generation || this.ws !== ws || this.closing) return;
        this.ws = null;
        for (const [key, pending] of this.controls) { clearTimeout(pending.timer); pending.reject(failure('Oda sunucusuna yeniden bağlanılıyor.')); this.controls.delete(key); }
        if (this.code) this._scheduleReconnect();
      });
    });
  }

  _scheduleReconnect() {
    if (this.closing || this.reconnectTimer) return;
    const generation = this.generation;
    const attempt = this.reconnectAttempt = (this.reconnectAttempt || 0) + 1;
    if (attempt > 6) { this._terminate('Oda sunucusuyla bağlantı yenilenemedi. Kodla yeniden katılabilirsiniz.'); return; }
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this._connectRelay(true);
        if (generation !== this.generation) return;
        this.reconnectAttempt = 0;
        if (this.host) await this._control({ type: 'capacity', maxPlayers: this.host.state.maxPlayers });
        for (const pending of this.pending.values()) this._sendPacket(this.hostId, pending.packet, 'relay');
        if (this.host) for (const peer of this.peers.values()) if (peer.dc?.readyState !== 'open') this._startRtc(peer.id);
      } catch {
        if (generation === this.generation && !this.closing) this._scheduleReconnect();
      }
    }, Math.min(3000, 250 * 2 ** (attempt - 1)));
  }

  _control(message) {
    return new Promise((resolveControl, reject) => {
      if (this.ws?.readyState !== 1) { reject(failure('Oda sunucusuna bağlı değilsin.')); return; }
      const requestId = `${this.me || 'hello'}-c${++this.rpc}`;
      const timer = setTimeout(() => { this.controls.delete(requestId); reject(failure('Oda sunucusu zamanında yanıt vermedi.')); }, 6000);
      this.controls.set(requestId, { resolve: resolveControl, reject, timer });
      this.ws.send(JSON.stringify({ ...message, requestId }));
    });
  }

  _serverMessage(message) {
    const pending = this.controls.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timer); this.controls.delete(message.requestId);
      message.type === 'error' ? pending.reject(failure(message.reason, message.status)) : pending.resolve(message);
      return;
    }
    if (message.type === 'peer-joined' && this.host) {
      this._peer(message.id);
      this._startRtc(message.id);
      this._probeAll();
    } else if (message.type === 'peer-left' && this.host) {
      this._dropPeer(message.id); this.host.leave(message.id); this.publish();
    } else if (message.type === 'peer-resumed') {
      if (this.host) this._startRtc(message.id);
      this._probeAll();
    } else if (message.type === 'relay') this._packet(message.from, message.data, 'relay');
    else if (message.type === 'signal') this._signal(message.from, message.data).catch(() => {});
    else if (message.type === 'room-closed') this._terminate(message.reason || 'Oda kapandı.');
  }

  _peer(id) {
    if (!this.peers.has(id)) this.peers.set(id, { id, pc: null, dc: null, candidates: [], transport: 'relay', samples: { rtc: [], relay: [] }, probes: new Map(), cache: new Map(), seenRpc: new Set(), lastRpcSequence: -1, rateAt: Date.now(), rate: 0 });
    return this.peers.get(id);
  }

  async _startRtc(id) {
    if (this.forceRelay || this.closing || !this.host) return;
    const peer = this._peer(id);
    if (peer.dc?.readyState === 'open' || peer.negotiating) return;
    peer.negotiating = true;
    try {
      const pc = await this._rtc(peer, true);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._sendSignal(id, { description: pc.localDescription });
    } catch { /* The relay already carries the game if RTC is unavailable. */ }
    finally { peer.negotiating = false; }
  }

  async _rtc(peer, initiator = false) {
    if (this.forceRelay || this.closing) return null;
    if (peer.pc && peer.pc.signalingState !== 'closed' && !['failed', 'closed'].includes(peer.pc.connectionState)) return peer.pc;
    // ICE candidates and the offer can arrive together. They must share one peer connection.
    if (peer.pcPromise) return peer.pcPromise;
    peer.pcPromise = (async () => {
      await this.configPromise;
      if (this.closing || this.peers.get(peer.id) !== peer) return null;
      let pc;
      try { pc = this.rtcFactory({ iceServers: this.iceServers, iceCandidatePoolSize: 0 }); } catch { return null; }
      peer.pc = pc;
      pc.onicecandidate = event => { if (event.candidate) this._sendSignal(peer.id, { candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate }); };
      pc.ondatachannel = event => this._channel(peer, event.channel);
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          peer.transport = 'relay';
          for (const pending of this.pending.values()) this._sendPacket(peer.id, pending.packet, 'relay');
        }
      };
      if (initiator) this._channel(peer, pc.createDataChannel('son-koridor-v2', { ordered: true }));
      return pc;
    })();
    try { return await peer.pcPromise; } finally { peer.pcPromise = null; }
  }

  _channel(peer, channel) {
    peer.dc = channel;
    channel.onmessage = event => {
      if (typeof event.data !== 'string' || event.data.length > 96 * 1024) return;
      try { this._packet(peer.id, JSON.parse(event.data), 'rtc'); } catch { /* Ignore malformed remote packets. */ }
    };
    channel.onopen = () => {
      this._probe(peer);
      for (const delay of [120, 350, 700]) setTimeout(() => { if (!this.closing && this.peers.get(peer.id) === peer) this._probe(peer); }, delay);
    };
    channel.onclose = channel.onerror = () => {
      peer.transport = 'relay';
      if (peer.id === this.hostId) for (const pending of this.pending.values()) this._sendPacket(peer.id, pending.packet, 'relay');
    };
  }

  _sendSignal(to, data) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'signal', to, data }));
  }

  async _signal(from, data) {
    if (this.forceRelay || !data || (this.host ? !this.peers.has(from) : this.hostId && from !== this.hostId)) return;
    const peer = this._peer(from);
    const pc = await this._rtc(peer, false);
    if (!pc) return;
    if (data.description) {
      if (this.host && data.description.type !== 'answer') return;
      if (!this.host && data.description.type !== 'offer') return;
      await pc.setRemoteDescription(data.description);
      for (const candidate of peer.candidates.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
      if (data.description.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this._sendSignal(from, { description: pc.localDescription });
      }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else if (peer.candidates.length < 64) peer.candidates.push(data.candidate);
    }
  }

  _sendPacket(to, packet, path) {
    const peer = this.peers.get(to);
    const selected = path || peer?.transport || 'relay';
    if (selected === 'rtc' && peer?.dc?.readyState === 'open' && peer.dc.bufferedAmount < 256 * 1024) {
      try { peer.dc.send(JSON.stringify(packet)); return true; } catch { peer.transport = 'relay'; }
    }
    if (path === 'rtc') return false;
    if (this.ws?.readyState === 1 && this.ws.bufferedAmount < 512 * 1024) {
      this.ws.send(JSON.stringify({ type: 'relay', to, data: packet }));
      return true;
    }
    if (peer?.dc?.readyState === 'open') {
      try { peer.dc.send(JSON.stringify(packet)); return true; } catch { /* Reconnect will retry pending RPCs. */ }
    }
    return false;
  }

  _probe(peer) {
    for (const path of ['relay', 'rtc']) {
      if (path === 'rtc' && peer.dc?.readyState !== 'open') continue;
      const id = `${this.me}-p${++this.rpc}`;
      peer.probes.set(id, { path, at: now() });
      this._sendPacket(peer.id, { kind: 'ping', id }, path);
    }
    for (const [id, probe] of peer.probes) if (now() - probe.at > 6000) peer.probes.delete(id);
  }

  _probeAll() { for (const peer of this.peers.values()) this._probe(peer); }

  _packet(from, packet, path) {
    if (!packet || typeof packet !== 'object' || (this.host ? !this.peers.has(from) : from !== this.hostId)) return;
    const peer = this._peer(from);
    if (packet.kind === 'ping') { this._sendPacket(from, { kind: 'pong', id: packet.id }, path); return; }
    if (packet.kind === 'pong') {
      const probe = peer.probes.get(packet.id);
      if (!probe || probe.path !== path) return;
      peer.probes.delete(packet.id);
      const sample = Math.max(0.01, now() - probe.at);
      peer.samples[path].push(sample);
      if (peer.samples[path].length > 6) peer.samples[path].shift();
      peer.transport = selectTransport(peer.samples, peer.transport, peer.dc?.readyState === 'open');
      return;
    }
    if (packet.kind === 'snapshot' && !this.host) { this.onState(packet.response); return; }
    if (packet.kind === 'result' && !this.host) {
      const pending = this.pending.get(packet.id);
      if (!pending) return;
      clearTimeout(pending.timeout); clearInterval(pending.retry);
      this.pending.delete(packet.id);
      packet.error ? pending.reject(failure(packet.error, packet.status)) : pending.resolve(packet.response);
      return;
    }
    if (packet.kind !== 'rpc' || !this.host || typeof packet.id !== 'string' || packet.id.length > 120 || !packet.body || typeof packet.body !== 'object') return;
    if (JSON.stringify(packet.body).length > 6000) return;
    if (peer.cache.has(packet.id)) { this._sendPacket(from, peer.cache.get(packet.id)); return; }
    const prefix = `${from}-r`;
    const sequence = packet.id.startsWith(prefix) ? Number(packet.id.slice(prefix.length)) : NaN;
    if (!Number.isSafeInteger(sequence) || sequence < 0) return;
    // Result payloads are bounded, but an evicted result must never execute its action again.
    if (sequence <= peer.lastRpcSequence - 4096 || peer.seenRpc.has(sequence)) {
      this._sendPacket(from, { kind: 'result', id: packet.id, error: 'Bu istek daha önce işlendi; güncel oda durumunu kullan.', status: 409 });
      return;
    }
    peer.lastRpcSequence = Math.max(peer.lastRpcSequence, sequence);
    peer.seenRpc.add(sequence);
    if (peer.seenRpc.size > 4096) for (const prior of peer.seenRpc) if (prior <= peer.lastRpcSequence - 4096) peer.seenRpc.delete(prior);
    const timestamp = Date.now();
    if (timestamp - peer.rateAt > 1000) { peer.rateAt = timestamp; peer.rate = 0; }
    let result;
    try {
      if (++peer.rate > 45) throw failure('Çok fazla istek.', 429);
      const response = packet.body.action === 'join' ? this.host.join(from, packet.body.name) : this.host.request(from, packet.body);
      result = { kind: 'result', id: packet.id, response };
    } catch (error) { result = { kind: 'result', id: packet.id, error: error.message, status: error.status || 400 }; }
    peer.cache.set(packet.id, result);
    if (peer.cache.size > 64) peer.cache.delete(peer.cache.keys().next().value);
    this._sendPacket(from, result);
    if (packet.body.action !== 'sync') this.publish();
  }

  _remote(body) {
    return new Promise((resolveRequest, reject) => {
      const id = `${this.me}-r${++this.rpc}`;
      const packet = { kind: 'rpc', id, body };
      const timeout = setTimeout(() => { const pending = this.pending.get(id); clearInterval(pending?.retry); this.pending.delete(id); reject(failure('Oda sahibi yanıt vermedi. Bağlantını kontrol et.')); }, 8000);
      const retry = setInterval(() => this._sendPacket(this.hostId, packet, 'relay'), 650);
      this.pending.set(id, { resolve: resolveRequest, reject, timeout, retry, packet });
      this._sendPacket(this.hostId, packet);
    });
  }

  publish() {
    if (!this.host) return;
    const own = this.host.snapshot(this.me);
    this.onState(own);
    for (const peer of this.peers.values()) {
      if (!this.host.state.players.some(player => player.id === peer.id)) continue;
      this._sendPacket(peer.id, { kind: 'snapshot', response: { state: own.state, me: peer.id } });
    }
  }

  _dropPeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.dc?.close(); peer.pc?.close(); this.peers.delete(id);
  }

  _terminate(reason) { this.close(); this.onClosed(reason); }

  close() {
    this.closing = true;
    this.generation++;
    clearInterval(this.tickTimer); clearInterval(this.publishTimer); clearInterval(this.probeTimer); clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null; this.reconnectAttempt = 0;
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); clearInterval(pending.retry); pending.reject(failure('Oda kapandı.', 410)); }
    this.pending.clear();
    for (const pending of this.controls.values()) { clearTimeout(pending.timer); pending.reject(failure('Oda kapandı.', 410)); }
    this.controls.clear();
    for (const peer of this.peers.values()) { peer.dc?.close(); peer.pc?.close(); }
    this.peers.clear();
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'leave' }));
    this.ws?.close(); this.ws = null;
    this.host = null; this.me = null; this.token = null; this.code = null; this.hostId = null;
  }
}
