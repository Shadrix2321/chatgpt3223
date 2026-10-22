import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  Hg,
  Hf,
  Wf,
  Wg,
  Xg,
  Gg,
  cb,
  pb,
  Ng,
  db,
  fb,
} from "../src/simulation.mjs";
import { wn, pi, Pg, jn, Ff } from "../src/world.mjs";

const base = Date.now();
function game(players = 1) {
  const state = Hg({
    hostId: "host",
    name: "Host",
    seed: 712,
    maxPlayers: 8,
    now: base,
  });
  for (let i = 1; i < players; i++)
    Gg(state, { id: "guest" + i, name: "Guest" + i, now: base });
  Hf(state, base, true);
  return state;
}
function encounter({
  x = -96,
  z = 10,
  yaw = Math.PI,
  px = -96,
  pz = -10,
  crouch = false,
  sprint = false,
  noise = 0,
} = {}) {
  const state = game();
  Object.assign(state.locust, { x, z, yaw, _destination: null, _patrolAt: 0 });
  Object.assign(state.players[0], {
    x: px,
    z: pz,
    crouch,
    sprint,
    noise,
    lastSeen: base + 7000,
    _lastMoveAt: base + 7000,
    _invulnerableUntil: base + 20000,
  });
  return state;
}

test("next night revives eliminated players and heals everyone, preserving campaign totals", () => {
  const state = game(3);
  state.phase = "intermission";
  state.players.forEach((p, i) => {
    p.lives = i;
    p.collectedTotal = 5 + i;
    p.collectedNight = 5;
    p.stamina = 2;
    p.captured = true;
  });
  Wf(state, "host", { type: "next" });
  assert.equal(state.night, 2);
  assert.equal(state.phase, "playing");
  assert.deepEqual(
    state.players.map((p) => p.lives),
    [3, 3, 3],
  );
  assert.deepEqual(
    state.players.map((p) => p.collectedTotal),
    [5, 6, 7],
  );
  assert.ok(
    state.players.every(
      (p) => p.stamina === 100 && !p.captured && p.collectedNight === 0,
    ),
  );
  assert.equal(state.items.length, 17); // 6 + 4*(3-1) + 3
  assert.deepEqual(
    new Set(state.items.map((i) => i.ownerId)),
    new Set(state.players.map((p) => p.id)),
  );
});

test("restart resets totals and nights while preserving room roster", () => {
  const state = game(2);
  state.night = 7;
  state.players[0].collectedTotal = 48;
  Wf(state, "host", { type: "restart" });
  assert.equal(state.night, 1);
  assert.equal(state.players.length, 2);
  assert.ok(
    state.players.every((p) => p.lives === 3 && p.collectedTotal === 0),
  );
  assert.equal(state.items.length, 10);
});

test("Locust sees a standing player down a clear aisle from twenty metres", () => {
  const state = encounter();
  assert.ok(
    pi(state.locust.x, state.locust.z, state.players[0].x, state.players[0].z),
  );
  pb(state, 0.05, base + 7000);
  assert.equal(state.locust.state, "chase");
  assert.equal(state.locust.targetId, "host");
  assert.ok(
    state.events.some((e) => e.type === "alert" && e.playerId === "host"),
  );
});

test("shelves block vision even when target is very close and directly ahead", () => {
  const state = encounter({ x: -104, z: 6, yaw: Math.PI / 2, px: -100, pz: 6 });
  assert.equal(pi(-104, 6, -100, 6), false);
  pb(state, 0.05, base + 7000);
  assert.notEqual(state.locust.state, "chase");
});

test("sprint is audible from behind, walking triggers investigation, crouching remains quiet", () => {
  const sprint = encounter({
    yaw: Math.PI / 2,
    pz: -20,
    sprint: true,
    noise: 1,
  });
  pb(sprint, 0.05, base + 7000);
  assert.equal(sprint.locust.state, "chase");
  const walk = encounter({ yaw: Math.PI / 2, pz: 0, noise: 0.1 });
  pb(walk, 0.05, base + 7000);
  assert.equal(walk.locust.state, "investigate");
  const crouch = encounter({
    yaw: Math.PI / 2,
    pz: 0,
    crouch: true,
    noise: 0.025,
  });
  pb(crouch, 0.05, base + 7000);
  assert.equal(crouch.locust.state, "patrol");
});

test("crouching reduces visual detection distance without making the player invisible nearby", () => {
  const distant = encounter({ crouch: true });
  pb(distant, 0.05, base + 7000);
  assert.equal(distant.locust.state, "patrol");
  const near = encounter({ pz: 3, crouch: true });
  pb(near, 0.05, base + 7000);
  assert.equal(near.locust.state, "chase");
});

test("pursuit predicts observed movement and remembers last sight without tracking hidden coordinates", () => {
  const state = encounter();
  pb(state, 0.05, base + 7000);
  state.players[0].z = -11;
  pb(state, 0.05, base + 7200);
  assert.ok(state.locust._destination.z < -11);
  assert.ok(state.locust._destination.z >= -14.6);
  const observed = { ...state.locust._lastKnown };
  const target = { ...state.locust._destination };
  state.players[0].x = 24;
  state.players[0].z = 6;
  pb(state, 0.05, base + 7400);
  assert.deepEqual(state.locust._destination, target);
  pb(state, 0.05, base + 10200);
  assert.equal(state.locust.state, "investigate");
  assert.equal(state.locust.targetId, null);
  assert.deepEqual(state.locust._searchOrigin, observed);
});

test("safe-area players cannot be detected or captured", () => {
  const state = encounter({
    x: 0,
    z: 135,
    yaw: 0,
    px: 0,
    pz: 148,
    sprint: true,
    noise: 1,
  });
  pb(state, 0.05, base + 7000);
  assert.equal(state.locust.state, "patrol");
  assert.equal(state.players[0].captured, false);
});

test("patrol visits all twenty world sectors independent of player location", () => {
  const state = game();
  const sectors = new Set();
  const points = [];
  for (let i = 0; i < 20; i++) {
    const p = cb(state, state.locust, base + i * 1000);
    points.push(p);
    sectors.add(state.locust._patrolSector);
    assert.equal(wn(p.x, p.z, 0.7, state.fallenShelves), false);
  }
  assert.equal(sectors.size, 20);
  assert.ok(
    Math.min(...points.map((p) => p.x)) < -80 &&
      Math.max(...points.map((p) => p.x)) > 80,
  );
  assert.ok(
    Math.min(...points.map((p) => p.z)) < -120 &&
      Math.max(...points.map((p) => p.z)) > 100,
  );
});

test("cached route goes around shelves and every segment respects creature clearance", () => {
  const start = { x: -108, z: 6 },
    goal = { x: -96, z: 6 };
  assert.equal(pi(start.x, start.z, goal.x, goal.z, 0.65), false);
  const path = Pg(start.x, start.z, goal.x, goal.z);
  assert.ok(path.length >= 2);
  let from = start;
  for (const p of path) {
    assert.ok(pi(from.x, from.z, p.x, p.z, 0.65));
    from = p;
  }
  assert.deepEqual(path.at(-1), goal);
  assert.deepEqual(Pg(start.x, start.z, goal.x, goal.z), path);
});

test("fallen shelves update collision, sight lines, and navigation caches", () => {
  const fall = { aisleIndex: 0, side: 1 };
  const obstacle = Ff(fall);
  assert.ok(obstacle.w > jn[0].w);
  assert.ok(wn(obstacle.x, obstacle.z, 0.65, [fall]));
  assert.equal(
    pi(obstacle.x - 5, obstacle.z, obstacle.x + 5, obstacle.z, 0.65, [fall]),
    false,
  );
  const start = { x: obstacle.x - 7, z: obstacle.z },
    goal = { x: obstacle.x + 7, z: obstacle.z };
  const path = Pg(start.x, start.z, goal.x, goal.z, [fall]);
  assert.ok(path.length);
  let from = start;
  for (const p of path) {
    assert.ok(pi(from.x, from.z, p.x, p.z, 0.65, [fall]));
    from = p;
  }
});

test("failed navigation is throttled instead of repeating a graph search every tick", () => {
  const state = game();
  const m = state.locust;
  Object.assign(m, {
    x: -108,
    z: 6,
    yaw: 0,
    _path: [],
    _pathAt: 0,
    _pathLayout: undefined,
  });
  const blocked = { x: -102, z: 6 };
  for (let i = 0; i < 20; i++) Ng(m, blocked, 0.1, base + i * 50, 0.05, []);
  assert.ok(
    m._pathSearches <= 2,
    `performed ${m._pathSearches} searches in one second`,
  );
});

test("capture animation removes one life only after4300ms and releases the player", () => {
  const state = game();
  db(state, state.players[0], base + 7000);
  assert.equal(state.players[0].lives, 3);
  assert.equal(state.players[0].captured, true);
  fb(state, base + 11299);
  assert.equal(state.players[0].lives, 3);
  assert.equal(Xg(state, base + 9500).locust.capture.stage, "stab");
  fb(state, base + 11300);
  assert.equal(state.players[0].lives, 2);
  assert.equal(state.players[0].captured, false);
  assert.equal(state.locust.capture, null);
});

test("twenty-hertz host simulation remains collision-safe over a minute", () => {
  const state = game(8);
  const started = performance.now();
  for (let frame = 0; frame < 1200; frame++) {
    const now = base + 7000 + frame * 50;
    state.players.forEach((p) => (p.lastSeen = now));
    Wg(state, 0.05, now);
    assert.equal(
      wn(state.locust.x, state.locust.z, 0.62, state.fallenShelves),
      false,
    );
  }
  const elapsed = performance.now() - started;
  console.log(
    `AI/navigation benchmark:1200 ticks,8 players,${elapsed.toFixed(1)}ms total (${(elapsed / 1200).toFixed(3)}ms/tick)`,
  );
  assert.ok(Number.isFinite(state.locust.distanceWalked));
  assert.ok(state.locust.distanceWalked > 50);
});

test("personal ownership and ten-second team delivery remain enforced", () => {
  const state = game(2);
  const item = state.items.find((i) => i.ownerId === "guest1");
  Object.assign(state.players[0], {
    x: item.x + (item.side || 1) * 0.6,
    z: item.z,
  });
  assert.throws(
    () => Wf(state, "host", { type: "collect", itemId: item.id }),
    /takım arkadaşının/,
  );
  state.items.forEach((i) => {
    i.collected = true;
    i.collectedBy = i.ownerId;
  });
  state.players.forEach((p, i) =>
    Object.assign(p, { x: i, z: 148, lastSeen: base }),
  );
  Wg(state, 0, base);
  assert.equal(state.phase, "playing");
  assert.equal(Xg(state, base).checkout.remainingMs, 10000);
  Wg(state, 0, base + 9999);
  assert.equal(state.phase, "playing");
  Wg(state, 0, base + 10000);
  assert.equal(state.phase, "intermission");
  assert.equal(state.night, 1);
});

test("sweep actually reaches every region over sustained simulation, not only waypoint generation", () => {
  const state = game();
  const sectors = new Set();
  let minX = 0,
    maxX = 0,
    minZ = 0,
    maxZ = 0;
  for (let frame = 0; frame < 24000; frame++) {
    const now = base + frame * 50;
    state.players[0].lastSeen = now;
    Wg(state, 0.05, now);
    const m = state.locust;
    minX = Math.min(minX, m.x);
    maxX = Math.max(maxX, m.x);
    minZ = Math.min(minZ, m.z);
    maxZ = Math.max(maxZ, m.z);
    if (m._patrolSector != null) sectors.add(m._patrolSector);
  }
  assert.equal(sectors.size, 20);
  assert.ok(minX < -80 && maxX > 80 && minZ < -120 && maxZ > 100);
  assert.ok(
    state.locust._pathSearches < 100,
    "patrol should reuse routes rather than pathfind every tick",
  );
});
