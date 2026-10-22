import { _n, jn, Bf, wn, pi, da, Ig, Pg, Ff } from "./world.mjs";
var zf = Object.freeze({ walk: 5, sprint: 8, crouch: 2.4 }),
  tb = 15e3,
  nb = 6e3,
  Og = 9e4,
  ib = 9e4,
  Wl = 1e4,
  Ug = 4300,
  bs = _n.safe,
  Ot = (i, e) => Math.hypot(i.x - e.x, i.z - e.z),
  es = (i) => typeof i == "number" && Number.isFinite(i),
  Ri = (i, e, t) => Math.max(e, Math.min(t, i)),
  Yl = (i) => Math.hypot(i.x - bs.x, i.z - bs.z) <= bs.radius,
  ts = (i, e) => i.online !== !1 && e - i.lastSeen <= tb,
  Qt = (i) => {
    throw new Error(i);
  },
  Fg = (i) =>
    String(i || "Oyuncu")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .trim()
      .slice(0, 24) || "Oyuncu";
function kg(i) {
  return (
    (!Number.isInteger(i) || i < 1 || i > 8) &&
      Qt("Oyuncu s\u0131n\u0131r\u0131 1 ile 8 aras\u0131nda olmal\u0131."),
    i
  );
}
function sb(i) {
  let e = i | 0;
  return () => {
    e += 1831565813;
    let t = e;
    return (
      (t = Math.imul(t ^ (t >>> 15), t | 1)),
      (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  };
}
function Gf(i) {
  let e = i * 2.39996323,
    t = Math.min(3.5, 0.65 + Math.sqrt(i) * 0.8),
    n = { x: bs.x + Math.cos(e) * t, z: bs.z + Math.sin(e) * t };
  return wn(n.x, n.z, 0.42) ? { x: bs.x, z: bs.z } : n;
}
function rb() {
  return { x: -34, z: 125 };
}
function Bg(i, e, t) {
  return {
    ...rb(),
    yaw: Math.PI / 2,
    state: "patrol",
    targetId: null,
    moving: !1,
    speed: 0,
    vx: 0,
    vz: 0,
    distanceWalked: 0,
    smashedAt: 0,
    capture: null,
    _path: [],
    _pathAt: 0,
    _destination: { x: 34, z: 125 },
    _patrolIndex: 0,
    _patrolAt: t + 14e3,
    _lastSeenAt: 0,
    _investigateUntil: 0,
    _stuckSeconds: 0,
  };
}
function zg(i, e, t, n) {
  return {
    id: i,
    name: Fg(e),
    appearance: t,
    collectedNight: 0,
    collectedTotal: 0,
    captured: !1,
    captureId: null,
    ...Gf(t),
    yaw: Math.PI,
    crouch: !1,
    sprint: !1,
    moving: !1,
    noise: 0,
    stamina: 100,
    lives: 3,
    online: !0,
    lastSeen: n,
    _lastMoveAt: n,
    _invulnerableUntil: n + 3e3,
    _lastAlertAt: 0,
  };
}
function io(i, e, t, n, s = {}) {
  ((i._eventCounter = (i._eventCounter || 0) + 1),
    i.events.push({
      id: `${t}-${i._eventCounter}`,
      type: e,
      ...(n ? { playerId: n } : {}),
      at: t,
      ...s,
    }),
    (i.events = i.events.filter((r) => t - r.at < 2e4).slice(-24)));
}
function Hf(i, e, t = !1) {
  ((i.nightStartedAt = e),
    (i.locust = Bg(i.seed, i.night, e)),
    (i.fallenShelves = []),
    (i._lastShelfAt = e - Og),
    i.players.forEach((s, r) => {
      (Object.assign(s, Gf(r), {
        captured: !1,
        captureId: null,
        collectedNight: 0,
        moving: !1,
        sprint: !1,
        crouch: !1,
        noise: 0,
        stamina: 100,
        lives: 3,
        _lastMoveAt: e,
        _invulnerableUntil: e + 3e3,
      }),
        t && (s.collectedTotal = 0));
    }),
    t && (i._departedPlayers = []));
  let n = i.players.filter((s) => ts(s, e) && s.lives > 0);
  ((i.items = Bf(i.seed, i.night, n.length).map((s, r) => ({
    ...s,
    ownerId: n[r % n.length]?.id || i.hostId,
    collected: !1,
    collectedBy: null,
  }))),
    (i._checkoutStartedAt = null),
    (i.phase = "playing"),
    io(i, "night", e));
}
function Hg({
  seed: i = Math.floor(Math.random() * 2147483647),
  hostId: e,
  name: t,
  maxPlayers: n = 4,
  now: s = Date.now(),
} = {}) {
  return (
    (typeof e != "string" || !e || e.length > 160) &&
      Qt("Oyuncu kimli\u011Fi ge\xE7ersiz."),
    {
      code: "",
      hostId: e,
      maxPlayers: kg(n),
      seed: Math.floor(i) || 1,
      phase: "lobby",
      night: 1,
      nightStartedAt: 0,
      fallenShelves: [],
      items: [],
      players: [zg(e, t, 0, s)],
      locust: Bg(i, 1, s),
      events: [],
      updatedAt: s,
      _clockMs: s,
      _eventCounter: 0,
      _lastShelfAt: 0,
      _checkoutStartedAt: null,
      _departedPlayers: [],
    }
  );
}
function Xl(i, e, t = !1) {
  if (i.phase !== "playing") return;
  let n = i.players.filter((a) => ts(a, e) && a.lives > 0);
  if (!n.length) return;
  if (t) {
    let a = Bf(i.seed, i.night, n.length),
      c = new Set(i.items.map((l) => l.id));
    for (let l of a)
      c.has(l.id) || i.items.push({ ...l, ownerId: null, collectedBy: null });
  }
  let s = new Set(n.map((a) => a.id));
  if (!(t || i.items.some((a) => !a.collected && !s.has(a.ownerId)))) return;
  let o = new Map(
    n.map((a) => [
      a.id,
      i.items.filter((c) => c.collected && c.ownerId === a.id).length,
    ]),
  );
  for (let a of i.items)
    if (!a.collected) {
      let c = n.reduce((l, h) => (o.get(l.id) <= o.get(h.id) ? l : h));
      ((a.ownerId = c.id), o.set(c.id, o.get(c.id) + 1));
    }
  i._checkoutStartedAt = null;
}
function Vg(i, e, t = Date.now()) {
  let n = i.players.find((s) => s.id === e);
  return (
    n &&
      ((i._departedPlayers ||= []),
      i._departedPlayers.push({
        id: n.id,
        name: n.name,
        appearance: n.appearance,
        collectedNight: n.collectedNight || 0,
        collectedTotal: n.collectedTotal || 0,
      }),
      (i.players = i.players.filter((s) => s.id !== e)),
      Xl(i, t),
      (i._checkoutStartedAt = null),
      (i.updatedAt = t)),
    i
  );
}
function Gg(i, { id: e, name: t, now: n = Date.now() }) {
  (typeof e != "string" || !e || e.length > 160) &&
    Qt("Oyuncu kimli\u011Fi ge\xE7ersiz.");
  let s = i.players.find((a) => a.id === e);
  if (s)
    return (
      (s.name = Fg(t || s.name)),
      (s.online = !0),
      (s.lastSeen = n),
      Xl(i, n, !0),
      i
    );
  ((i.players = i.players.filter(
    (a) => a.online !== !1 && n - a.lastSeen <= 6e4,
  )),
    i.players.length >= i.maxPlayers &&
      Qt(
        "Oda dolu. Ev sahibi oyuncu s\u0131n\u0131r\u0131n\u0131 art\u0131rabilir.",
      ));
  let r = new Set(i.players.map((a) => a.appearance % 8)),
    o = 0;
  for (; r.has(o);) o += 1;
  return (i.players.push(zg(e, t, o, n)), Xl(i, n, !0), (i.updatedAt = n), i);
}
function Vf(i, e, t = [], n = 0.42) {
  let s = Ot(i, e),
    r = Math.max(1, Math.ceil(s / 0.24));
  for (let o = 1; o <= r; o++) {
    let a = o / r;
    if (wn(i.x + (e.x - i.x) * a, i.z + (e.z - i.z) * a, n, t)) return !1;
  }
  return !0;
}
function ob(i, e, t, n) {
  if (e.captured || e.lives <= 0 || i.phase === "won" || i.phase === "lost")
    return;
  (es(t.yaw) && (e.yaw = Math.atan2(Math.sin(t.yaw), Math.cos(t.yaw))),
    (e.crouch = t.crouch === !0),
    (e.stamina = es(e.stamina) ? Ri(e.stamina, 0, 100) : 100),
    (e.sprint = !e.crouch && t.sprint === !0 && e.stamina > 0));
  let s = Ri((n - e._lastMoveAt) / 1e3, 0, 0.75);
  if (((e._lastMoveAt = n), !es(t.x) || !es(t.z))) {
    ((e.moving = !1),
      (e.sprint = !1),
      (e.noise = 0),
      (e.stamina = Math.min(100, e.stamina + 14 * s)));
    return;
  }
  let r = {
      x: Ri(t.x, -_n.width / 2 + 0.5, _n.width / 2 - 0.5),
      z: Ri(t.z, -_n.depth / 2 + 0.5, _n.depth / 2 - 0.5),
    },
    o = Ot(e, r),
    a = e.crouch ? zf.crouch : e.sprint ? zf.sprint : zf.walk,
    c = Math.min(o, a * s),
    l =
      o > 0
        ? { x: e.x + ((r.x - e.x) / o) * c, z: e.z + ((r.z - e.z) / o) * c }
        : { x: e.x, z: e.z },
    h = { x: e.x, z: e.z };
  if (Vf(e, l, i.fallenShelves)) Object.assign(e, l);
  else {
    let u = { x: l.x, z: e.z };
    Vf(e, u, i.fallenShelves) && (e.x = u.x);
    let f = { x: e.x, z: l.z };
    Vf(e, f, i.fallenShelves) && (e.z = f.z);
  }
  ((e.moving = Ot(h, e) > 0.005),
    (e.sprint = e.sprint && e.moving),
    (e.stamina = Ri(e.stamina + (e.sprint ? -22 : 14) * s, 0, 100)),
    (e.noise = e.moving ? (e.crouch ? 0.025 : e.sprint ? 1 : 0.1) : 0));
}
function ab(i, e) {
  let t = i.players.filter((o) => ts(o, e) && o.lives > 0),
    n = t.filter((o) => !o.captured && Yl(o)).length,
    r =
      i.phase === "playing" &&
      i.items.length > 0 &&
      i.items.every((o) => o.collected) &&
      t.length > 0 &&
      n === t.length &&
      i._checkoutStartedAt !== null &&
      i._checkoutStartedAt !== void 0;
  return {
    active: r,
    remainingMs: r ? Math.max(0, Wl - (e - i._checkoutStartedAt)) : Wl,
    durationMs: Wl,
    inside: n,
    required: t.length,
  };
}
function ql(i, e) {
  if (i.phase !== "playing") return;
  let t = i.players.filter((r) => ts(r, e));
  if (t.length && t.every((r) => r.lives <= 0)) {
    i.phase = "lost";
    return;
  }
  Xl(i, e);
  let n = t.filter((r) => r.lives > 0);
  if (!(
    i.items.length &&
    i.items.every((r) => r.collected) &&
    n.length &&
    n.every((r) => !r.captured && Yl(r))
  )) {
    i._checkoutStartedAt = null;
    return;
  }
  ((i._checkoutStartedAt === null || i._checkoutStartedAt === void 0) &&
    (i._checkoutStartedAt = e),
    e - i._checkoutStartedAt >= Wl &&
      ((i.phase = i.night >= 10 ? "won" : "intermission"),
      (i.locust.state = "patrol"),
      (i.locust.targetId = null),
      io(i, "night", e)));
}
function Wf(i, e, t = {}) {
  (!t || typeof t != "object") && Qt("Ge\xE7ersiz oyun komutu.");
  let n = i.players.find((r) => r.id === e);
  n || Qt("Oyuncu odada bulunamad\u0131.");
  let s = Date.now();
  switch (
    ((n.lastSeen = s),
    (n.online = !0),
    ["start", "next", "restart", "capacity"].includes(t.type) &&
      e !== i.hostId &&
      Qt("Bu i\u015Flemi yaln\u0131zca ev sahibi yapabilir."),
    t.type)
  ) {
    case "capacity": {
      i.phase !== "lobby" &&
        Qt(
          "Oyuncu s\u0131n\u0131r\u0131 oyun ba\u015Flamadan de\u011Fi\u015Ftirilebilir.",
        );
      let r = kg(t.maxPlayers);
      (r < i.players.length &&
        Qt(
          "S\u0131n\u0131r odadaki oyuncu say\u0131s\u0131ndan k\xFC\xE7\xFCk olamaz.",
        ),
        (i.maxPlayers = r));
      break;
    }
    case "start":
      (i.phase !== "lobby" && Qt("Oyun zaten ba\u015Flad\u0131."),
        (i.night = 1),
        Hf(i, s, !0));
      break;
    case "next":
      (i.phase !== "intermission" &&
        Qt(
          "\xD6nce al\u0131\u015Fveri\u015Fi bitirip g\xFCvenli alana d\xF6n\xFCn.",
        ),
        i.night >= 10 && Qt("B\xFCt\xFCn geceler tamamland\u0131."),
        (i.night += 1),
        Hf(i, s));
      break;
    case "restart":
      ((i.night = 1), (i.events = []), Hf(i, s, !0));
      break;
    case "collect": {
      (i.phase !== "playing" &&
        Qt("Al\u0131\u015Fveri\u015F hen\xFCz a\xE7\u0131k de\u011Fil."),
        n.lives <= 0 &&
          Qt(
            "Can\u0131n kalmad\u0131; tak\u0131m\u0131n\u0131 izleyebilirsin.",
          ),
        n.captured &&
          Qt(
            "Locust seni yakalad\u0131; \u015Fu anda \xFCr\xFCn alamazs\u0131n.",
          ));
      let r = i.items.find((o) => o.id === t.itemId);
      if ((r || Qt("\xDCr\xFCn bulunamad\u0131."), r.collected)) break;
      (r.ownerId !== n.id &&
        Qt(
          "Bu \xFCr\xFCn tak\u0131m arkada\u015F\u0131n\u0131n listesinde. Kendi i\u015Faretli \xFCr\xFCnlerini topla.",
        ),
        da(n, r, i.fallenShelves) ||
          Qt(
            "\xDCr\xFCn\xFC almak i\xE7in raf\u0131n do\u011Fru taraf\u0131na yakla\u015F.",
          ),
        (r.collected = !0),
        (r.collectedBy = n.id),
        (n.collectedNight = (n.collectedNight || 0) + 1),
        (n.collectedTotal = (n.collectedTotal || 0) + 1),
        ql(i, s));
      break;
    }
    case "move":
      (ob(i, n, t, s), ql(i, s));
      break;
    default:
      Qt("Ge\xE7ersiz oyun komutu.");
  }
  return ((i.updatedAt = s), i);
}
// A deterministic sweep visits every sector, rather than orbiting nearby players.
// Twenty sectors and stride seven are coprime: no sector repeats within a cycle.
function cb(state, monster, now) {
  const visit = monster._patrolIndex++;
  const offset = Math.abs((state.seed + state.night * 13) | 0) % 20;
  const sector = (offset + visit * 7) % 20;
  const random = sb(state.seed + state.night * 4099 + visit * 101);
  const cx = -90 + (sector % 4) * 60;
  const cz = -132 + Math.floor(sector / 4) * 60;
  for (let attempt = 0; attempt < 32; attempt++) {
    const point = {
      x: cx + (random() - 0.5) * 28,
      z: cz + (random() - 0.5) * 22,
    };
    if (!Yl(point) && !wn(point.x, point.z, 0.7, state.fallenShelves)) {
      // Allow enough time to reach distant sectors; a short fixed timer used to
      // make the monster repeatedly abandon long routes before arriving.
      monster._patrolAt =
        now + Math.max(20000, (Ot(monster, point) / 3.1) * 1600);
      monster._patrolSector = sector;
      return point;
    }
  }
  const fallback = { x: cx + 6, z: cz + 12 };
  monster._patrolAt = now + 60000;
  return fallback;
}

function Ng(monster, target, distance, now, dt, fallen = []) {
  if (!target || !es(target.x) || !es(target.z)) return;
  let waypoint = target;
  if (pi(monster.x, monster.z, target.x, target.z, 0.65, fallen)) {
    monster._path = [];
  } else {
    const layout = fallen.map((s) => s.aisleIndex + ":" + s.side).join(",");
    const changed = monster._pathLayout !== layout;
    const targetMoved =
      !monster._pathTarget || Ot(monster._pathTarget, target) > 3;
    const due = now >= (monster._pathAt || 0);
    // A failed route is also throttled. Previously an empty path caused a full
    // graph traversal on every 20 Hz simulation tick.
    if (
      changed ||
      (due &&
        (!monster._path.length || targetMoved || monster._stuckSeconds > 1))
    ) {
      monster._path = Pg(monster.x, monster.z, target.x, target.z, fallen);
      monster._pathTarget = { x: target.x, z: target.z };
      monster._pathAt = now + (monster.state === "chase" ? 700 : 1600);
      monster._pathLayout = layout;
      monster._pathSearches = (monster._pathSearches || 0) + 1;
    }
    while (monster._path.length && Ot(monster, monster._path[0]) < 0.3)
      monster._path.shift();
    if (!monster._path.length) return;
    waypoint = monster._path[0];
  }
  const startX = monster.x,
    startZ = monster.z;
  const desiredYaw = Math.atan2(waypoint.x - monster.x, waypoint.z - monster.z);
  const turn = Math.atan2(
    Math.sin(desiredYaw - monster.yaw),
    Math.cos(desiredYaw - monster.yaw),
  );
  monster.yaw += Ri(turn, -4.2 * dt, 4.2 * dt);
  const alignment = Math.max(0, Math.cos(desiredYaw - monster.yaw));
  const next = Ig(monster, waypoint, distance * alignment * alignment, fallen);
  if (next && es(next.x) && es(next.z) && !wn(next.x, next.z, 0.62, fallen)) {
    monster.x = next.x;
    monster.z = next.z;
  }
  const dx = monster.x - startX,
    dz = monster.z - startZ;
  const travelled = Math.hypot(dx, dz);
  monster.moving = travelled > 0.0001;
  monster.distanceWalked = (monster.distanceWalked || 0) + travelled;
  monster.speed = dt > 0 ? travelled / dt : 0;
  monster.vx = dt > 0 ? dx / dt : 0;
  monster.vz = dt > 0 ? dz / dt : 0;
}
var pa = (i, e) =>
  Math.hypot(
    Math.max(0, Math.abs(i.x - e.x) - e.w / 2),
    Math.max(0, Math.abs(i.z - e.z) - e.d / 2),
  );
function lb(i, e) {
  let t = i._destination;
  if (!t) return !1;
  let n = Math.max(1, Math.ceil(Ot(i, t) / 0.4));
  for (let s = 1; s < n; s++) {
    let r = { x: i.x + ((t.x - i.x) * s) / n, z: i.z + ((t.z - i.z) * s) / n };
    if (pa(r, e) < 0.65) return !0;
  }
  return !1;
}
function hb(i, e) {
  let t = i.locust,
    n = i.fallenShelves || (i.fallenShelves = []);
  if (
    t.state !== "chase" ||
    n.length >= 1 ||
    t._stuckSeconds < 2.4 ||
    e - i.nightStartedAt < ib ||
    e - (i._lastShelfAt || 0) < Og
  )
    return;
  let s = i.players.filter((d) => ts(d, e) && d.lives > 0 && !d.captured);
  if (!s.some((d) => Ot(d, t) <= 55)) return;
  let o = jn
    .map((d, m) => ({ rack: d, aisleIndex: m }))
    .filter(
      ({ rack: d, aisleIndex: m }) =>
        !n.some((_) => _.aisleIndex === m) &&
        pa(t, d) <= 2.4 &&
        lb(t, d) &&
        s.every((_) => pa(_, d) >= 4),
    )
    .sort((d, m) => pa(t, d.rack) - pa(t, m.rack))[0];
  if (!o) return;
  let { rack: a, aisleIndex: c } = o,
    l = {
      id: `shelf-${c}`,
      aisleIndex: c,
      col: a.col,
      row: a.row,
      x: a.x,
      z: a.z,
      side: t.x < a.x ? 1 : -1,
      at: e,
    };
  (n.push(l),
    (i._lastShelfAt = e),
    (t.smashedAt = e),
    (t._stuckSeconds = 0),
    (t._path = []),
    (t._pathAt = 0));
  let h = Ff(l);
  for (let d of i.items)
    if (!d.collected && d.aisleIndex === c) {
      let m = d.side || l.side;
      ((d.x = h.x + m * (h.w / 2 + 0.45)), (d.y = 0.16));
    }
  let { id: u, ...f } = l;
  io(i, "shelf", e, void 0, { shelfId: u, ...f });
}
function ub(i) {
  return i < 1300 ? "grab" : i < 2900 ? "stab" : i < 3900 ? "throw" : "recover";
}
function fb(i, e) {
  let t = i.locust,
    n = t.capture;
  if (!n) return !1;
  ((t.state = "capture"),
    (t.targetId = n.playerId),
    (t.moving = !1),
    (t.speed = 0),
    (t._speed = 0));
  let s = i.players.find((r) => r.id === n.playerId);
  return (
    e - n.startedAt < n.durationMs ||
      (s &&
        ((s.lives = Math.max(0, s.lives - 1)),
        Object.assign(s, Gf(i.players.indexOf(s)), {
          captured: !1,
          captureId: null,
          crouch: !1,
          noise: 0,
          moving: !1,
          sprint: !1,
          stamina: 100,
          _invulnerableUntil: e + 5e3,
          _lastMoveAt: e,
        }),
        io(i, "hit", e, s.id, { captureId: n.id })),
      (t.capture = null),
      (t.state = "patrol"),
      (t.targetId = null),
      (t._destination = null),
      (t._path = []),
      (t._stuckSeconds = 0)),
    !0
  );
}
function db(i, e, t) {
  let n = i.locust;
  n.yaw = Math.atan2(e.x - n.x, e.z - n.z);
  let s = {
    id: `capture-${t}-${e.id}`,
    playerId: e.id,
    startedAt: t,
    durationMs: Ug,
    x: n.x,
    z: n.z,
    yaw: n.yaw,
  };
  ((n.capture = s),
    (n.state = "capture"),
    (n.targetId = e.id),
    (n.moving = !1),
    (n.speed = 0),
    (n.vx = 0),
    (n.vz = 0),
    (n._speed = 0),
    (n._path = []),
    Object.assign(e, {
      captured: !0,
      captureId: s.id,
      moving: !1,
      sprint: !1,
      crouch: !1,
      noise: 0,
    }),
    (i._checkoutStartedAt = null),
    io(i, "capture", t, e.id, { captureId: s.id, durationMs: Ug }));
}
// Perception is independent from render rate and runs at most 6.7 times/sec.
// Memory stores observations only: hidden players do not update pursuit targets.
function perceive(state, monster, candidates, now) {
  let seen = null,
    heard = null,
    seenScore = -Infinity,
    heardScore = -Infinity;
  for (const player of candidates) {
    const distance = Ot(monster, player);
    const range = player.crouch ? 12 : 26;
    const angle = Math.atan2(player.x - monster.x, player.z - monster.z);
    const turn = Math.abs(
      Math.atan2(Math.sin(angle - monster.yaw), Math.cos(angle - monster.yaw)),
    );
    let clear = false;
    if (distance <= Math.max(range, 68))
      clear = pi(
        monster.x,
        monster.z,
        player.x,
        player.z,
        0.08,
        state.fallenShelves,
      );
    if (distance < range && (turn < Math.PI * 0.36 || distance < 3) && clear) {
      const score = range - distance + (player.id === monster.targetId ? 5 : 0);
      if (score > seenScore) {
        seen = player;
        seenScore = score;
      }
    }
    if (player.noise > 0 && now - player._lastMoveAt < 900) {
      let radius = player.crouch ? 2.5 : player.sprint ? 64 : 14;
      if (!clear) radius *= player.sprint ? 0.72 : 0.5;
      if (distance < radius) {
        const score = (radius - distance) / radius + (player.sprint ? 0.5 : 0);
        if (score > heardScore) {
          heard = player;
          heardScore = score;
        }
      }
    }
  }
  const target = seen || (heard?.sprint ? heard : null);
  if (target) {
    const previous = monster._lastObservation;
    const elapsed =
      previous && previous.id === target.id ? (now - previous.at) / 1000 : 0;
    let vx = elapsed > 0 ? (target.x - previous.x) / elapsed : 0;
    let vz = elapsed > 0 ? (target.z - previous.z) / elapsed : 0;
    const observedSpeed = Math.hypot(vx, vz);
    if (observedSpeed > 8) {
      vx *= 8 / observedSpeed;
      vz *= 8 / observedSpeed;
    }
    const lead = seen ? Math.min(0.45, Ot(monster, target) / 24) : 0;
    let destination = { x: target.x + vx * lead, z: target.z + vz * lead };
    if (
      Yl(destination) ||
      wn(destination.x, destination.z, 0.65, state.fallenShelves)
    )
      destination = { x: target.x, z: target.z };
    if (
      (monster.state !== "chase" || monster.targetId !== target.id) &&
      now - target._lastAlertAt > 5000
    ) {
      io(state, "alert", now, target.id);
      target._lastAlertAt = now;
    }
    monster.state = "chase";
    monster.targetId = target.id;
    monster._lastSeenAt = now;
    monster._destination = destination;
    monster._lastKnown = { x: target.x, z: target.z };
    monster._lastObservation = {
      id: target.id,
      x: target.x,
      z: target.z,
      at: now,
    };
  } else if (monster.state === "chase") {
    if (
      !candidates.some((p) => p.id === monster.targetId) ||
      now - monster._lastSeenAt > 2800
    ) {
      monster.state = "investigate";
      monster.targetId = null;
      monster._searchOrigin = monster._lastKnown || monster._destination;
      monster._destination = monster._searchOrigin
        ? { ...monster._searchOrigin }
        : null;
      monster._investigateUntil = now + 10000;
      monster._searchIndex = 0;
    }
  } else if (heard) {
    monster.state = "investigate";
    monster.targetId = null;
    monster._destination = { x: heard.x, z: heard.z };
    monster._searchOrigin = { ...monster._destination };
    monster._investigateUntil = now + 8000;
    monster._searchIndex = 0;
  }
}

function searchPoint(state, monster) {
  const origin = monster._searchOrigin || monster;
  const step = (monster._searchIndex = (monster._searchIndex || 0) + 1);
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = (step + attempt) * 2.39996323;
    const radius = 3 + ((step + attempt) % 4) * 2;
    const point = {
      x: origin.x + Math.cos(angle) * radius,
      z: origin.z + Math.sin(angle) * radius,
    };
    if (!Yl(point) && !wn(point.x, point.z, 0.7, state.fallenShelves))
      return point;
  }
  return null;
}

function pb(state, dt, now) {
  const monster = state.locust;
  monster.moving = false;
  monster.speed = 0;
  monster.vx = 0;
  monster.vz = 0;
  if (fb(state, now)) return;
  if (now - state.nightStartedAt < nb) {
    monster.state = "patrol";
    monster.targetId = null;
    Ng(monster, { x: 34, z: 125 }, 3.1 * dt, now, dt, state.fallenShelves);
    return;
  }
  const candidates = state.players.filter(
    (p) => ts(p, now) && p.lives > 0 && !p.captured && !Yl(p),
  );
  if (now >= (monster._sensesAt || 0)) {
    perceive(state, monster, candidates, now);
    monster._sensesAt = now + 150;
  }
  if (monster.state === "investigate") {
    if (now >= monster._investigateUntil) {
      monster.state = "patrol";
      monster._destination = null;
    } else if (
      !monster._destination ||
      Ot(monster, monster._destination) < 1.2
    ) {
      monster._destination = searchPoint(state, monster);
    }
  }
  if (
    !monster._destination ||
    (monster.state === "patrol" &&
      (Ot(monster, monster._destination) < 1.5 || now >= monster._patrolAt))
  ) {
    monster._destination = cb(state, monster, now);
  }
  const desiredSpeed =
    monster.state === "chase"
      ? Math.min(7.3, 6.65 + (state.night - 1) * 0.075)
      : monster.state === "investigate"
        ? 4.6
        : 3.5 + (state.night - 1) * 0.04;
  monster._speed = Math.min(desiredSpeed, (monster._speed || 0) + dt * 5);
  Ng(
    monster,
    monster._destination,
    monster._speed * dt,
    now,
    dt,
    state.fallenShelves,
  );
  monster._stuckSeconds =
    monster.speed < 0.35 && Ot(monster, monster._destination) > 2
      ? (monster._stuckSeconds || 0) + dt
      : 0;
  if (monster._stuckSeconds > 4 && monster.state !== "chase") {
    monster._destination =
      monster.state === "investigate"
        ? searchPoint(state, monster)
        : cb(state, monster, now);
    monster._pathAt = 0;
    monster._stuckSeconds = 0;
  }
  hb(state, now);
  for (const player of candidates) {
    if (
      Ot(monster, player) < 1.55 &&
      now >= player._invulnerableUntil &&
      pi(monster.x, monster.z, player.x, player.z, 0.08, state.fallenShelves)
    ) {
      db(state, player, now);
      break;
    }
  }
}
function Wg(i, e, t = Date.now()) {
  (es(t) || (t = Date.now()), (i._clockMs = t));
  let n = i.players.find((s) => s.id === i.hostId);
  if (!n || t - n.lastSeen > 3e4) {
    let s = i.players.find((r) => ts(r, t));
    s && (i.hostId = s.id);
  }
  if (
    (i.players.forEach((s) => {
      t - s._lastMoveAt > 700 &&
        ((s.moving = !1), (s.sprint = !1), (s.noise = 0));
    }),
    i.phase === "playing")
  ) {
    let r = es(e) ? Ri(e, 0, 0.5) : 0;
    for (; r > 1e-5 && i.phase === "playing";) {
      let o = Math.min(r, 0.1);
      (pb(i, o, t - (r - o) * 1e3), (r -= o), ql(i, t));
    }
    ql(i, t);
  }
  return (
    (i.events = i.events.filter((s) => t - s.at < 2e4).slice(-24)),
    (i.updatedAt = t),
    i
  );
}
function Xg(i, e = Date.now()) {
  let t = i.locust.capture
      ? {
          ...i.locust.capture,
          elapsedMs: Ri(
            e - i.locust.capture.startedAt,
            0,
            i.locust.capture.durationMs,
          ),
          stage: ub(Math.max(0, e - i.locust.capture.startedAt)),
        }
      : null,
    n = new Map((i._departedPlayers || []).map((s) => [s.id, { ...s }]));
  for (let s of i.players)
    n.set(s.id, {
      id: s.id,
      name: s.name,
      appearance: s.appearance,
      collectedNight: s.collectedNight || 0,
      collectedTotal: s.collectedTotal || 0,
    });
  return {
    code: i.code || "",
    revision: i._revision || 0,
    hostId: i.hostId,
    maxPlayers: i.maxPlayers,
    phase: i.phase,
    night: i.night,
    nightStartedAt: i.nightStartedAt || 0,
    seed: i.seed,
    updatedAt: i.updatedAt,
    blackout:
      i.phase === "playing" && ((e - i.nightStartedAt) / 1e3) % 95 >= 55,
    checkout: ab(i, e),
    results: [...n.values()],
    fallenShelves: (i.fallenShelves || []).map((s) => ({ ...s })),
    items: i.items.map(
      ({
        id: s,
        key: r,
        label: o,
        model: a,
        x: c,
        y: l,
        z: h,
        aisle: u,
        ownerId: f,
        collected: d,
        collectedBy: m,
      }) => ({
        id: s,
        key: r,
        label: o,
        model: a,
        x: c,
        y: l,
        z: h,
        aisle: u,
        ownerId: f,
        collected: d,
        collectedBy: m || null,
      }),
    ),
    players: i.players.map((s) => ({
      id: s.id,
      name: s.name,
      appearance: s.appearance || 0,
      collectedNight: s.collectedNight || 0,
      collectedTotal: s.collectedTotal || 0,
      captured: s.captured === !0,
      captureId: s.captureId || null,
      x: s.x,
      z: s.z,
      yaw: s.yaw,
      crouch: s.crouch,
      sprint: s.sprint,
      moving: s.moving,
      noise: s.noise || 0,
      stamina: es(s.stamina) ? s.stamina : 100,
      lives: s.lives,
      online: ts(s, e),
    })),
    locust: {
      x: i.locust.x,
      z: i.locust.z,
      yaw: i.locust.yaw,
      state: i.locust.state,
      targetId: i.locust.targetId,
      capture: t,
      distanceWalked: i.locust.distanceWalked || 0,
      moving: i.locust.moving === !0,
      speed: i.locust.speed || 0,
      vx: i.locust.vx || 0,
      vz: i.locust.vz || 0,
      smashedAt: i.locust.smashedAt || 0,
    },
    events: i.events.map((s) => ({ ...s })),
  };
}
var $l = class {
  constructor({
    id: e,
    name: t,
    maxPlayers: n,
    code: s,
    seed: r,
    now: o = Date.now(),
  }) {
    ((this.state = Hg({ hostId: e, name: t, maxPlayers: n, seed: r, now: o })),
      (this.state.code = s),
      (this.state._revision = 1),
      (this.lastTick = o),
      (this.ownerId = e));
  }
  step(e = Date.now()) {
    let t = this.state.players.find((n) => n.id === this.ownerId);
    return (
      t && ((t.lastSeen = e), (t.online = !0)),
      (this.state.hostId = this.ownerId),
      Wg(this.state, Math.min(0.25, Math.max(0, (e - this.lastTick) / 1e3)), e),
      (this.lastTick = e),
      this.state._revision++,
      this.snapshot(this.state.hostId, e)
    );
  }
  snapshot(e, t = Date.now()) {
    return { state: Xg(this.state, t), me: e };
  }
  join(e, t) {
    return (
      Gg(this.state, { id: e, name: t }),
      this.state._revision++,
      this.snapshot(e)
    );
  }
  leave(e) {
    this.state.players.find((n) => n.id === e) &&
      (Vg(this.state, e), this.state._revision++);
  }
  request(e, t = {}) {
    if (!t || typeof t != "object" || JSON.stringify(t).length > 6e3)
      throw new Error("Ge\xE7ersiz oyun iste\u011Fi.");
    let n = this.state.players.find((s) => s.id === e && s.online !== !1);
    if (!n) throw new Error("Oturum sona erdi. Odaya yeniden kat\u0131l.");
    if (((n.lastSeen = Date.now()), t.action === "sync")) {
      if (Number.isSafeInteger(t.seq) && t.seq > (n._clientSeq ?? -1)) {
        if (t.move && typeof t.move == "object") {
          let { x: s, z: r, yaw: o, crouch: a, sprint: c } = t.move;
          Wf(this.state, e, {
            type: "move",
            x: s,
            z: r,
            yaw: o,
            crouch: a,
            sprint: c,
          });
        }
        n._clientSeq = t.seq;
      }
    } else if (
      ["start", "next", "restart", "collect", "capacity"].includes(t.action)
    )
      Wf(this.state, e, {
        type: t.action,
        itemId: t.itemId,
        maxPlayers: Number(t.maxPlayers),
      });
    else throw new Error("Ge\xE7ersiz oyun komutu.");
    return (this.state._revision++, this.snapshot(e));
  }
};

export { $l, Hg, Hf, Wf, Wg, Xg, cb, pb, Ng, Gg, db, fb, zf };
