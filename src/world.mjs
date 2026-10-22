// Recovered world layout and collision rules from the original game.
var _n = { width: 240, depth: 320, safe: { x: 0, z: 148, radius: 10 } },
  rr = [
    { key: "milk", label: "S\xFCt", model: "carton" },
    { key: "bread", label: "Ekmek", model: "loaf" },
    { key: "apple", label: "Elma", model: "apple" },
    { key: "can", label: "Konserve", model: "can" },
    { key: "oil", label: "S\u0131v\u0131 ya\u011F", model: "bottle-oil" },
    { key: "soda", label: "Gazoz", model: "soda-bottle" },
    { key: "banana", label: "Muz", model: "banana" },
    { key: "cereal", label: "Kahvalt\u0131l\u0131k", model: "carton-small" },
    { key: "honey", label: "Bal", model: "honey" },
    { key: "pasta", label: "Makarna", model: "bag" },
    { key: "orange", label: "Portakal", model: "orange" },
    { key: "coffee", label: "Kahve", model: "can-small" },
    { key: "juice", label: "Meyve suyu", model: "carton" },
    { key: "rice", label: "Pirin\xE7", model: "bag" },
    { key: "flour", label: "Un", model: "bag" },
    { key: "lentils", label: "Mercimek", model: "bag" },
    { key: "beans", label: "Fasulye konservesi", model: "can" },
    { key: "corn", label: "M\u0131s\u0131r konservesi", model: "can-small" },
    { key: "tea", label: "\xC7ay", model: "carton-small" },
    { key: "biscuits", label: "Bisk\xFCvi", model: "carton-small" },
    { key: "jam", label: "Re\xE7el", model: "honey" },
    { key: "vinegar", label: "Sirke", model: "bottle-oil" },
    { key: "water", label: "Maden suyu", model: "soda-bottle" },
    { key: "toast", label: "Tost ekme\u011Fi", model: "loaf" },
  ],
  jn = [];
for (let i = 0; i < 18; i++)
  for (let e = 0; e < 8; e++)
    jn.push({
      x: -102 + i * 12,
      z: -130 + e * 34,
      w: 2.1,
      d: 19.2,
      col: i,
      row: e,
      aisle: i + 1,
    });
var fa = [
    ...jn,
    ...Array.from({ length: 9 }, (i, e) => -144 + e * 34).flatMap((i) =>
      [-114, -54, 54, 114].map((e) => ({
        x: e,
        z: i,
        w: 0.6,
        d: 0.6,
        kind: "column",
      })),
    ),
    ...[-110, -90, -70, -50, -30, 30, 50, 70, 90, 110].map((i) => ({
      x: i,
      z: 137,
      w: 4,
      d: 6,
      kind: "checkout",
    })),
    ...Array.from({ length: 16 }, (i, e) => ({
      x: -116,
      z: -136 + e * 17.5,
      w: 3,
      d: 4,
      kind: "freezer",
    })),
    ...Array.from({ length: 16 }, (i, e) => ({
      x: 116,
      z: -136 + e * 17.5,
      w: 3,
      d: 4,
      kind: "freezer",
    })),
    ...Array.from({ length: 10 }, (i, e) => ({
      x: -100 + e * 22,
      z: -151,
      w: 4,
      d: 3,
      kind: "produce",
    })),
  ],
  Bl = 2.85,
  kl = 1.12,
  to = new Map();
function Ff(i) {
  let e = jn[i.aisleIndex],
    t = (e.w / 2) * Math.cos(kl),
    n = Bl * Math.sin(kl);
  return {
    ...e,
    x: e.x + i.side * (e.w / 2 - t + n / 2),
    w: t * 2 + n,
    kind: "fallen",
  };
}
function Rg(i = []) {
  return kf(i).obstacles;
}
function kf(i = []) {
  let e = i
    .map((o) => o.aisleIndex + ":" + o.side)
    .sort()
    .join(",");
  if (to.has(e)) return to.get(e);
  let t = new Map(i.map((o) => [o.aisleIndex, o])),
    n = fa.map((o, a) => (a < jn.length && t.has(a) ? Ff(t.get(a)) : o)),
    s = new Map();
  for (let o of n)
    for (
      let a = Math.floor((o.x - o.w / 2 - 2) / 8);
      a <= Math.floor((o.x + o.w / 2 + 2) / 8);
      a++
    )
      for (
        let c = Math.floor((o.z - o.d / 2 - 2) / 8);
        c <= Math.floor((o.z + o.d / 2 + 2) / 8);
        c++
      ) {
        let l = a + "," + c;
        (s.has(l) || s.set(l, []), s.get(l).push(o));
      }
  let r = { obstacles: n, spatial: s };
  return (to.set(e, r), to.size > 16 && to.delete(to.keys().next().value), r);
}
function wn(i, e, t = 0.4, n = []) {
  return !Number.isFinite(i) ||
    !Number.isFinite(e) ||
    Math.abs(i) > _n.width / 2 - t ||
    Math.abs(e) > _n.depth / 2 - t
    ? !0
    : (
        kf(n).spatial.get(Math.floor(i / 8) + "," + Math.floor(e / 8)) || []
      ).some(
        (s) =>
          Math.abs(i - s.x) < s.w / 2 + t && Math.abs(e - s.z) < s.d / 2 + t,
      );
}
// Exact segment/AABB visibility with a spatial-grid traversal. This replaces
// distance/0.2 samples and repeated hash lookups for every sight/path ray.
function pi(x0, z0, x1, z1, radius = 0.08, fallen = []) {
  if (![x0, z0, x1, z1, radius].every(Number.isFinite) || radius < 0)
    return false;
  const halfW = _n.width / 2 - radius,
    halfD = _n.depth / 2 - radius;
  if (
    Math.abs(x0) > halfW ||
    Math.abs(x1) > halfW ||
    Math.abs(z0) > halfD ||
    Math.abs(z1) > halfD
  )
    return false;
  const dx = x1 - x0,
    dz = z1 - z0;
  const map = kf(fallen);
  const tested = new Set();
  function blocks(obstacle) {
    if (tested.has(obstacle)) return false;
    tested.add(obstacle);
    const minX = obstacle.x - obstacle.w / 2 - radius,
      maxX = obstacle.x + obstacle.w / 2 + radius;
    const minZ = obstacle.z - obstacle.d / 2 - radius,
      maxZ = obstacle.z + obstacle.d / 2 + radius;
    let enter = 0,
      exit = 1;
    if (Math.abs(dx) < 1e-10) {
      if (x0 <= minX || x0 >= maxX) return false;
    } else {
      let a = (minX - x0) / dx,
        b = (maxX - x0) / dx;
      if (a > b) [a, b] = [b, a];
      enter = Math.max(enter, a);
      exit = Math.min(exit, b);
    }
    if (Math.abs(dz) < 1e-10) {
      if (z0 <= minZ || z0 >= maxZ) return false;
    } else {
      let a = (minZ - z0) / dz,
        b = (maxZ - z0) / dz;
      if (a > b) [a, b] = [b, a];
      enter = Math.max(enter, a);
      exit = Math.min(exit, b);
    }
    return enter < exit - 1e-9 && exit > 0 && enter < 1;
  }
  // Larger radii are uncommon; the spatial index has a two-unit margin.
  if (radius > 2) return !map.obstacles.some(blocks);
  let cellX = Math.floor(x0 / 8),
    cellZ = Math.floor(z0 / 8);
  const endX = Math.floor(x1 / 8),
    endZ = Math.floor(z1 / 8);
  const stepX = Math.sign(dx),
    stepZ = Math.sign(dz);
  const deltaX = dx ? 8 / Math.abs(dx) : Infinity,
    deltaZ = dz ? 8 / Math.abs(dz) : Infinity;
  let nextX = dx ? ((cellX + (stepX > 0 ? 1 : 0)) * 8 - x0) / dx : Infinity;
  let nextZ = dz ? ((cellZ + (stepZ > 0 ? 1 : 0)) * 8 - z0) / dz : Infinity;
  for (let guard = 0; guard < 128; guard++) {
    const obstacles = map.spatial.get(cellX + "," + cellZ);
    if (obstacles)
      for (const obstacle of obstacles) if (blocks(obstacle)) return false;
    if (cellX === endX && cellZ === endZ) return true;
    if (nextX < nextZ) {
      cellX += stepX;
      nextX += deltaX;
    } else if (nextZ < nextX) {
      cellZ += stepZ;
      nextZ += deltaZ;
    } else {
      cellX += stepX;
      cellZ += stepZ;
      nextX += deltaX;
      nextZ += deltaZ;
    }
  }
  return false;
}
function da(i, e, t = []) {
  return (
    Math.hypot(i.x - e.x, i.z - e.z) <= 3 && pi(i.x, i.z, e.x, e.z, 0.04, t)
  );
}
function Ig(i, e, t, n = []) {
  let s = e.x - i.x,
    r = e.z - i.z,
    o = Math.hypot(s, r);
  if (!o) return { x: i.x, z: i.z };
  let a = Math.min(Math.max(0, t), o),
    c = Math.ceil(a / 0.2),
    { x: l, z: h } = i;
  for (let u = 0; u < c; u++) {
    let f = l + ((s / o) * a) / c,
      d = h + ((r / o) * a) / c;
    (wn(f, h, 0.65, n) || (l = f), wn(l, d, 0.65, n) || (h = d));
  }
  return { x: l, z: h };
}
var no = 4,
  Xn = _n.width / no,
  zl = _n.depth / no;
function QM(i, e) {
  return (
    Math.max(0, Math.min(Xn - 1, Math.floor((i + 120) / no))) +
    Xn * Math.max(0, Math.min(zl - 1, Math.floor((e + 160) / no)))
  );
}
function ua(i) {
  return {
    x: -120 + ((i % Xn) + 0.5) * no,
    z: -160 + (Math.floor(i / Xn) + 0.5) * no,
  };
}
function eb(i) {
  let e = kf(i);
  if (e.grid) return e.grid;
  let t = new Uint8Array(Xn * zl);
  for (let n = 0; n < t.length; n++) {
    let s = ua(n);
    t[n] = wn(s.x, s.z, 0.65, i) ? 1 : 0;
  }
  return ((e.grid = t), t);
}
function Cg(i, e, t, n, s = !0) {
  let r = QM(i, e),
    o = r % Xn,
    a = Math.floor(r / Xn),
    c = [];
  for (let l = -4; l <= 4; l++)
    for (let h = -4; h <= 4; h++) {
      if (o + h < 0 || o + h >= Xn || a + l < 0 || a + l >= zl) continue;
      let u = r + h + l * Xn;
      if (t[u]) continue;
      let f = ua(u);
      c.push({ i: u, p: f, d: Math.hypot(i - f.x, e - f.z) });
    }
  return (
    c.sort((l, h) => l.d - h.d),
    c.find((l) => !s || pi(i, e, l.p.x, l.p.z, 0.65, n))?.i ?? -1
  );
}
function navigationCache(fallen) {
  const layout = kf(fallen);
  if (layout.navigation) return layout.navigation;
  const size = Xn * zl;
  return (layout.navigation = {
    edges: new Uint8Array(size),
    known: new Uint8Array(size),
    visited: new Uint32Array(size),
    previous: new Int32Array(size),
    queue: new Int32Array(size),
    generation: 0,
    centers: Array.from({ length: size }, (_, i) => ua(i)),
  });
}
function Pg(x, z, targetX, targetZ, fallen = []) {
  if (pi(x, z, targetX, targetZ, 0.65, fallen))
    return [{ x: targetX, z: targetZ }];
  const grid = eb(fallen),
    cache = navigationCache(fallen);
  const start = Cg(x, z, grid, fallen),
    goal = Cg(
      targetX,
      targetZ,
      grid,
      fallen,
      !wn(targetX, targetZ, 0.65, fallen),
    );
  if (start < 0 || goal < 0) return [];
  cache.generation = (cache.generation + 1) >>> 0;
  if (!cache.generation) {
    cache.visited.fill(0);
    cache.generation = 1;
  }
  const generation = cache.generation;
  const { queue, previous, visited, centers, edges, known } = cache;
  let tail = 1;
  queue[0] = start;
  previous[start] = start;
  visited[start] = generation;
  const offsets = [1, -1, Xn, -Xn];
  for (let head = 0; head < tail && visited[goal] !== generation; head++) {
    const current = queue[head];
    if (!known[current]) {
      const col = current % Xn,
        row = Math.floor(current / Xn),
        point = centers[current];
      for (let direction = 0; direction < 4; direction++) {
        if (
          (direction === 0 && col === Xn - 1) ||
          (direction === 1 && col === 0) ||
          (direction === 2 && row === zl - 1) ||
          (direction === 3 && row === 0)
        )
          continue;
        const next = current + offsets[direction];
        if (grid[next]) continue;
        const end = centers[next];
        if (pi(point.x, point.z, end.x, end.z, 0.65, fallen))
          edges[current] |= 1 << direction;
      }
      known[current] = 1;
    }
    for (let direction = 0; direction < 4; direction++) {
      if (!(edges[current] & (1 << direction))) continue;
      const next = current + offsets[direction];
      if (visited[next] === generation) continue;
      visited[next] = generation;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (visited[goal] !== generation) return [];
  const route = [];
  for (let current = goal; ; current = previous[current]) {
    route.push(centers[current]);
    if (current === start) break;
  }
  route.reverse();
  const last = route[route.length - 1];
  if (pi(last.x, last.z, targetX, targetZ, 0.65, fallen))
    route.push({ x: targetX, z: targetZ });
  const path = [];
  let point = { x, z };
  for (let i = 0; i < route.length;) {
    let next = i;
    if (!pi(point.x, point.z, route[next].x, route[next].z, 0.65, fallen))
      return [];
    while (
      next + 1 < route.length &&
      pi(point.x, point.z, route[next + 1].x, route[next + 1].z, 0.65, fallen)
    )
      next++;
    path.push({ x: route[next].x, z: route[next].z });
    point = route[next];
    i = next + 1;
  }
  return path;
}
function Hl(i) {
  let e = i >>> 0;
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
function Bf(i, e, t = 1) {
  let n = Math.max(1, Math.min(8, Math.floor(t) || 1)),
    s = Hl(i + e * 7919),
    r = [],
    o = new Set(),
    a = 6 + 4 * (n - 1) + (e - 1) * 3,
    c = jn.filter((l) => e >= 4 || l.row >= 4 - e);
  for (let l = 0; l < a; l++) {
    let h;
    do h = Math.floor(s() * c.length * 2);
    while (o.has(h));
    o.add(h);
    let u = c[Math.floor(h / 2)],
      f = h % 2 ? 1 : -1,
      d = rr[Math.floor(s() * rr.length)];
    r.push({
      id: `n${e}-${l}`,
      key: d.key,
      label: d.label,
      model: d.model,
      x: u.x + f * 1.35,
      y: 1 + (l % 2) * 0.7,
      z: u.z + (s() - 0.5) * 16,
      aisle: u.aisle,
      aisleIndex: jn.indexOf(u),
      side: f,
      collected: !1,
    });
  }
  return r;
}

export {
  _n,
  rr,
  jn,
  fa,
  Bl,
  kl,
  Ff,
  Rg,
  kf,
  wn,
  pi,
  da,
  Ig,
  Pg,
  Hl,
  Bf,
  QM,
  ua,
  eb,
  Cg,
};
