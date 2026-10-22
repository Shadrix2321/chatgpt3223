import { Lg } from './renderer.mjs';
import { Gl } from './audio.mjs';
import { Mh } from './network.mjs';
import { _n, Rg, wn, da } from './world.mjs';
const mn = { lerp: (a, b, t) => a + (b - a) * t };
class ea {
  constructor() { this.last = performance.now(); }
  getDelta() { const now = performance.now(), dt = (now - this.last) / 1000; this.last = now; return dt; }
}
const preferences = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem('son-koridor-settings-v2') || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return {
      quality: ['auto', 'ultraLow', 'low', 'medium', 'high'].includes(stored.quality) ? stored.quality : 'auto',
      fps: [30, 45, 60].includes(Number(stored.fps)) ? Number(stored.fps) : 60,
    };
  }
  catch { return {}; }
})();
const savePreferences = () => { try { localStorage.setItem('son-koridor-settings-v2', JSON.stringify(preferences)); } catch {} };
let renderedAt = 0, hudKey = '', frameFps = 0, lastDrawAt = 0, drawFrameEMA = 0;
var La = (i, e, t) => i + (e - i) * t;
function q0(i = 0, e = 0, t = 0) {
  return i + Math.atan2(Math.sin(e - i), Math.cos(e - i)) * t;
}
var Jb = (i) =>
    i < 1300 ? "grab" : i < 2900 ? "stab" : i < 3900 ? "throw" : "recover",
  bh = class {
    constructor({ delayMs: e = 110, maxExtrapolationMs: t = 120 } = {}) {
      ((this.delayMs = e), (this.maxExtrapolationMs = t), this.reset());
    }
    reset() {
      ((this.entries = []),
        (this.key = ""),
        (this.offset = null),
        (this.lastRenderTime = -1 / 0));
    }
    push(e, t = performance.now()) {
      if (!e) return;
      let n = e.code + ":" + e.nightStartedAt + ":" + e.phase;
      n !== this.key && (this.reset(), (this.key = n));
      let s = e.updatedAt || Date.now(),
        r = this.entries.at(-1);
      if (r && s < r.at) return;
      let o = t - s;
      this.offset === null
        ? (this.offset = o)
        : (this.offset = o < this.offset ? o : Math.min(o, this.offset + 0.2));
      let a = { at: s, state: e };
      (r?.at === s
        ? (this.entries[this.entries.length - 1] = a)
        : this.entries.push(a),
        this.entries.length > 32 && this.entries.shift());
    }
    sample(e = performance.now()) {
      if (!this.entries.length) return null;
      let t = this.entries.at(-1),
        n = e - this.offset - this.delayMs;
      ((n = Math.max(
        this.lastRenderTime,
        Math.min(n, t.at + this.maxExtrapolationMs),
      )),
        (this.lastRenderTime = n));
      let s = this.entries[0],
        r = s;
      for (let p of this.entries) {
        if ((p.at <= n && (s = p), p.at >= n)) {
          r = p;
          break;
        }
        r = p;
      }
      r.at < s.at && (r = s);
      let o =
          r.at > s.at
            ? Math.max(0, Math.min(1, (n - s.at) / (r.at - s.at)))
            : 1,
        a = Math.max(0, Math.min(this.maxExtrapolationMs, n - r.at)) / 1e3,
        c = t.state,
        l = new Map(s.state.players.map((p) => [p.id, p])),
        h = new Map(r.state.players.map((p) => [p.id, p])),
        u = c.players.map((p) => {
          let T = l.get(p.id) || p,
            E = h.get(p.id) || p;
          if (
            T.captured !== E.captured ||
            T.lives !== E.lives ||
            Math.hypot(E.x - T.x, E.z - T.z) > 5
          )
            return { ...p };
          let v = (r.at - s.at) / 1e3,
            w = v > 0 ? (E.x - T.x) / v : 0,
            C = v > 0 ? (E.z - T.z) / v : 0;
          return {
            ...p,
            x: La(T.x, E.x, o) + w * a,
            z: La(T.z, E.z, o) + C * a,
            yaw: q0(T.yaw, E.yaw, o),
            renderSpeed: Math.hypot(w, C),
          };
        }),
        f = s.state.locust,
        d = r.state.locust,
        m = c.locust,
        _ = { ...m };
      if (f && d && !m.capture && Math.hypot(d.x - f.x, d.z - f.z) < 12) {
        let p = (r.at - s.at) / 1e3,
          T = Number.isFinite(d.vx) ? d.vx : p > 0 ? (d.x - f.x) / p : 0,
          E = Number.isFinite(d.vz) ? d.vz : p > 0 ? (d.z - f.z) / p : 0;
        _ = {
          ...m,
          x: La(f.x, d.x, o) + T * a,
          z: La(f.z, d.z, o) + E * a,
          yaw: q0(f.yaw, d.yaw, o),
          distanceWalked:
            La(f.distanceWalked || 0, d.distanceWalked || 0, o) +
            (d.moving ? Math.hypot(T, E) * a : 0),
        };
      }
      let g = e - this.offset;
      if (m.capture) {
        let p = { ...m.capture },
          T = Math.max(0, Math.min(p.durationMs, g - p.startedAt));
        ((p.elapsedMs = T), (p.stage = Jb(T)), (_.capture = p));
      }
      return { ...c, players: u, locust: _, renderTime: n, hostNow: g };
    }
  };
var fe = (i) => document.getElementById(i),
  Rt = (i, e = !0) => fe(i).classList.toggle("hidden", !e),
  Oa = (i) =>
    String(i).replace(
      /[&<>"']/g,
      (e) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[e],
    ),
  os = fe("game"),
  Li = new Gl(),
  nn = new Set(),
  jb = new ea();
os.tabIndex = 0;
var ht,
  he = null,
  kt = null,
  Ih = !1,
  Kd = !1,
  Qb = Date.now(),
  In = 0,
  wh = 0,
  qn = !1,
  Jd = !0,
  Pi = 100,
  fr = !1,
  dr = !1,
  rs = !1,
  jd = "",
  Qd = "",
  Y0 = 0,
  hr = 0,
  ei = null,
  Z0 = 0,
  ep = 0,
  Ua = new Set(),
  Eh = 3,
  J0 = 0,
  tp = 0,
  j0 = !0,
  et = { x: 0, z: 148 },
  ap = new bh(),
  np = 0.0019,
  Ah = !1,
  cp = !1,
  lp = 0,
  $0 = "",
  ip,
  sp = 0,
  Q0 = 0,
  rp = "",
  op = 0,
  K0 = [
    "#315b80",
    "#a54c3e",
    "#58745b",
    "#b18a36",
    "#79678f",
    "#558e96",
    "#8e565f",
    "#9c9b89",
  ],
  Ch = (i) => K0[(Number(i?.appearance) || 0) % K0.length],
  uo = () => he?.items.filter((i) => i.ownerId === kt?.me) || [],
  ti = () => he?.players.find((i) => i.id === kt?.me);
function eT() {
  let i = he.code + ":" + he.nightStartedAt;
  i === $0 ||
    (($0 = i), he.updatedAt - he.nightStartedAt > 6500) ||
    ((fe("intro-night-number").textContent = String(he.night).padStart(2, "0")),
    (fe("intro-night-copy").textContent =
      `Senin listende ${uo().length} \xFCr\xFCn var. Ekibin toplam ${he.items.length} \xFCr\xFCn\xFC toplamal\u0131. Sepetini doldur, teslimat alan\u0131na d\xF6n.`),
    Rt("night-intro"),
    fe("night-intro").classList.remove("active"),
    fe("night-intro").offsetWidth,
    fe("night-intro").classList.add("active"),
    (lp = performance.now() + 5200),
    nn.clear(),
    clearTimeout(ip),
    (ip = setTimeout(() => {
      (Rt("night-intro", !1), fe("night-intro").classList.remove("active"));
    }, 5200)));
}
function Rh(i, e = 3500) {
  ((fe("toast").textContent = i),
    fe("toast").classList.add("show"),
    (Z0 = performance.now() + e));
}
function Fa(i) {
  fe("menuError").textContent = i;
}
var hp = new Mh({
  onState: (i) => {
    kt && Ph(i);
  },
  onClosed: (i) => {
    kt && (Dh(!1), Fa(i));
  },
});
async function up(i, e = {}) {
  return hp.request(i, e);
}
function Ph(i, e = !1) {
  if (
    !i?.state ||
    (!i.token && (!kt || i.me !== kt.me || i.state.code !== kt.code)) ||
    (he && he.code === i.state.code && i.state.revision <= he.revision && !e)
  )
    return;
  let t = he;
  ((he = i.state),
    (op = performance.now()),
    ap.push(he, op),
    i.token && (kt = { code: he.code, me: i.me, token: i.token }));
  let n = he.players.find((o) => o.id === kt?.me);
  if (!n) {
    (Dh(!1),
      Fa("Oturumun sona erdi. Oda koduyla yeniden kat\u0131labilirsin."));
    return;
  }
  (e ||
    he.night !== t?.night ||
    (he.phase === "playing" && t?.phase !== "playing")) &&
    ((et.x = n.x),
    (et.z = n.z),
    (Pi = n.stamina ?? 100),
    (In = he.locust ? Math.atan2(n.x - he.locust.x, n.z - he.locust.z) : 0),
    (wh = -0.015),
    (Eh = n.lives),
    (fr = !1),
    (dr = !1),
    (rs = !1),
    (tp = performance.now() + 500));
  let s = he.locust?.capture;
  (n.captured &&
    (nn.clear(),
    (dr = !1),
    (rs = !1),
    (qn = !1),
    Rt("pause", !1),
    s?.playerId === n.id &&
      s.id !== rp &&
      ((rp = s.id), Li.play("jumpscare", 0.7))),
    n.lives < Eh &&
      ((et.x = n.x),
      (et.z = n.z),
      (tp = performance.now() + 700),
      (Pi = 100),
      (fe("damage").style.opacity = ".55"),
      setTimeout(() => (fe("damage").style.opacity = "0"), 650)),
    (Eh = n.lives),
    Math.hypot(n.x - et.x, n.z - et.z) > 3 && ((et.x = n.x), (et.z = n.z)),
    Number.isFinite(n.stamina) && (Pi = Math.min(Pi + 5, n.stamina)));
  for (let o of he.events)
    if (
      !Ua.has(o.id) &&
      (Ua.add(o.id),
      o.type === "alert" && o.playerId === kt.me && Li.play("alert", 0.65),
      o.type === "shelf" && he.updatedAt - o.at < 2500)
    ) {
      let a = Math.hypot(o.x - et.x, o.z - et.z);
      (Li.shelfCollapse(o, et, In),
        a < 65 &&
          ((sp = performance.now() + 850),
          (Q0 = Math.max(0.006, 0.04 * (1 - a / 65)))));
    }
  Ua.size > 200 && (Ua = new Set(he.events.map((o) => o.id)));
  let r =
    he.night +
    ":" +
    he.items
      .map((o) =>
        [o.id, o.ownerId, o.collected, o.collectedBy, o.x, o.y, o.z].join(","),
      )
      .join(";");
  (r !== Qd &&
    (t &&
      he.items.some(
        (o) =>
          o.collected &&
          o.collectedBy === kt.me &&
          !t.items.find((a) => a.id === o.id)?.collected,
      ) &&
      Li.pickup(),
    ht.setItems(he.items, kt.me),
    (Qd = r)),
    tT(),
    he.phase === "playing" && eT(),
    nT(),
    (ep = 0),
    (fe("connection").textContent =
      he.maxPlayers === 1 ? "TEK OYUNCULU" : "ODAYA BA\u011ELI"));
}
function tT() {
  let i = he.phase,
    e = i === "playing",
    t = kt.me === he.hostId;
  if (
    (Rt("menu", !1),
    Rt("lobby", i === "lobby"),
    Rt("hud", e),
    Rt("result", ["intermission", "won", "lost"].includes(i)),
    i === "lobby" &&
      ((fe("copyCode").textContent = he.code),
      (fe("lobbyCapacity").value = he.maxPlayers),
      (fe("lobbyCapacity").disabled = !t),
      (fe("roster").innerHTML = he.players
        .map(
          (n) =>
            `<div class="playerrow"><span class="player-identity"><i class="player-swatch" style="--player-color:${Ch(n)}" aria-hidden="true"></i>${Oa(n.name)}${n.id === kt.me ? " <small>SEN</small>" : ""}</span><span>${n.id === he.hostId ? "EV SAH\u0130B\u0130" : n.online ? "HAZIR" : "BA\u011ELANTI YOK"}</span></div>`,
        )
        .join("")),
      (fe("start").disabled = !t),
      (fe("lobbyNote").textContent = t
        ? `${he.players.length} / ${he.maxPlayers} ki\u015Fi. Haz\u0131r oldu\u011Funuzda geceyi ba\u015Flat.`
        : "Ev sahibinin geceyi ba\u015Flatmas\u0131 bekleniyor.")),
    i !== jd &&
      (e
        ? ((qn = !1), Rt("pause", !1), fp())
        : (document.exitPointerLock?.(), Rt("pause", !1), (qn = !1)),
      (jd = i)),
    ["intermission", "won", "lost"].includes(i))
  ) {
    ((fe("resultKicker").textContent =
      i === "lost"
        ? "VARD\u0130YA YARIM KALDI"
        : i === "won"
          ? "10 GECE TAMAMLANDI"
          : "TESL\u0130MAT ALINDI"),
      (fe("resultTitle").textContent =
        i === "lost"
          ? "Market kazand\u0131."
          : i === "won"
            ? "Son koridordan \xE7\u0131kt\u0131n\u0131z."
            : `${he.night}. gece geride kald\u0131.`),
      (fe("resultText").textContent =
        i === "lost"
          ? "Ekibin b\xFCt\xFCn canlar\u0131 t\xFCkendi. Yeniden deneyebilirsiniz."
          : i === "won"
            ? "On gece boyunca kendi listelerinizi tamamlad\u0131n\u0131z. G\xFCn \u0131\u015F\u0131\u011F\u0131na \xE7\u0131kma zaman\u0131."
            : "Sepetler teslim edildi. Bir sonraki gece her oyuncuya yeni bir liste verilecek."));
    let n = he.results?.length
      ? he.results
      : he.players.map((s) => ({
          ...s,
          collectedNight: he.items.filter((r) => r.collectedBy === s.id).length,
        }));
    ((fe("resultsBody").innerHTML = [...n]
      .sort((s, r) => r.collectedNight - s.collectedNight)
      .map(
        (s) =>
          `<tr class="${s.id === kt.me ? "is-me" : ""}"><th scope="row"><span class="player-identity"><i class="player-swatch" style="--player-color:${Ch(s)}" aria-hidden="true"></i>${Oa(s.name)}${s.id === kt.me ? " <small>SEN</small>" : ""}</span></th><td>${s.collectedNight ?? 0}</td><td>${s.collectedTotal ?? s.collectedNight ?? 0}</td></tr>`,
      )
      .join("")),
      Rt("next", i === "intermission"),
      (fe("next").disabled = !t),
      Rt("restart", i !== "intermission"),
      (fe("restart").disabled = !t));
  }
}
function nT() {
  if (!he) return;
  const nextKey = JSON.stringify([he.night, he.items.map(x => [x.id,x.collected,x.ownerId]), he.players.map(x => [x.id,x.lives,x.captured,x.online,x.collectedNight])]);
  if (nextKey === hudKey) return;
  hudKey = nextKey;
  let i = ti(),
    e = uo(),
    t = e.filter((r) => r.collected).length,
    n = he.items.filter((r) => r.collected).length;
  ((fe("nightNo").textContent = String(he.night).padStart(2, "0")),
    (fe("roomLabel").textContent =
      `ODA ${he.code} \xB7 ${he.players.filter((r) => r.online).length}/${he.maxPlayers}`),
    (fe("progress").textContent = `${t} / ${e.length}`),
    (fe("listbar").style.width = `${(t / e.length) * 100 || 0}%`),
    (fe("teamProgress").textContent = `EK\u0130P ${n} / ${he.items.length}`));
  let s = new Map();
  for (let r of e) {
    s.has(r.key) || s.set(r.key, { label: r.label, total: 0, done: 0 });
    let o = s.get(r.key);
    (o.total++, (o.done += r.collected ? 1 : 0));
  }
  ((fe("shoppingList").innerHTML = [...s.values()]
    .map(
      (r) =>
        `<div class="grocery ${r.total === r.done ? "done" : ""}"><span><i class="check"></i>${Oa(r.label)}</span><span class="count">${r.done}/${r.total}</span></div>`,
    )
    .join("")),
    (fe("objective").textContent =
      t === e.length
        ? "Sepetin haz\u0131r. Teslimat alan\u0131na d\xF6n; herkes gelince 10 saniye bekleyin."
        : "Sana ait i\u015Faretli \xFCr\xFCnlere yakla\u015F. E ile sepetine koy."),
    (fe("lives").textContent =
      "\u25CF ".repeat(Math.max(0, i.lives)) +
      "\u25CB ".repeat(Math.max(0, 3 - i.lives))),
    (fe("teammates").innerHTML = he.players
      .filter((r) => r.id !== kt.me)
      .map((r) => {
        let o = he.items.filter((c) => c.ownerId === r.id),
          a = o.filter((c) => c.collected).length;
        return `<div class="teammate"><span class="player-identity"><i class="player-swatch" style="--player-color:${Ch(r)}" aria-hidden="true"></i>${Oa(r.name)}</span><span>${r.online ? (r.lives ? (r.captured ? "YAKALANDI" : `${a}/${o.length}`) : "ELEND\u0130") : "\xC7EVR\u0130MDI\u015EI"}</span></div>`;
      })
      .join("")));
}
function iT(i) {
  if (!he) return;
  let e = he.checkout,
    t = uo().every((a) => a.collected),
    n = he.items.length > 0 && he.items.every((a) => a.collected);
  if (
    (Rt("checkoutPanel", he.phase === "playing" && (t || e?.active)),
    !t && !e?.active)
  )
    return;
  let s = e?.active ? Math.max(0, (e.remainingMs ?? 1e4) - (i - op)) : 1e4;
  ((fe("checkoutTitle").textContent = e?.active
    ? "TESL\u0130MAT ALINIYOR"
    : n
      ? "TESL\u0130MAT ALANINA D\xD6N"
      : "SEPET\u0130N HAZIR"),
    (fe("checkoutSeconds").textContent = e?.active
      ? String(Math.ceil(s / 1e3)).padStart(2, "0")
      : "10"));
  let r = Array.isArray(e?.inside) ? e.inside.length : (e?.inside ?? 0),
    o = Array.isArray(e?.required)
      ? e.required.length
      : (e?.required ??
        he.players.filter((a) => a.online && a.lives > 0).length);
  ((fe("checkoutDetail").textContent = e?.active
    ? "Herkes alanda kalmal\u0131."
    : n
      ? `${r} / ${o} oyuncu teslimat alan\u0131nda.`
      : "Ekibinin listelerini tamamlamas\u0131 bekleniyor."),
    (fe("checkoutBar").style.width = e?.active
      ? `${Math.min(100, 100 * (1 - s / (e.durationMs || 1e4)))}%`
      : "0%"));
}
async function Lh(i = !1, e = !1) {
  if (j0 || Kd) return;
  ((Kd = !0),
    Fa(""),
    document
      .querySelectorAll("#menu button")
      .forEach((s) => (s.disabled = !0)));
  let t = fe(e ? "join" : i ? "solo" : "create"),
    n = t.innerHTML;
  t.textContent = e
    ? "BA\u011ELANIYOR\u2026"
    : i
      ? "BA\u015ELIYOR\u2026"
      : "ODA A\xC7ILIYOR\u2026";
  try {
    Li.init().catch(() => {});
    let s = await up(
      e ? "join" : "create",
      e
        ? { code: fe("roomcode").value.trim(), name: fe("name").value }
        : {
            name: fe("name").value,
            maxPlayers: i ? 1 : Number(fe("capacity").value),
          },
    );
    (Ph(s, !0), (Ih = !0), i && (await fo("start")));
  } catch (s) {
    Fa(s.message);
  } finally {
    ((Kd = !1),
      (t.innerHTML = n),
      document
        .querySelectorAll("#menu button")
        .forEach((s) => (s.disabled = !1)));
  }
}
async function fo(i, e = {}) {
  try {
    let t = await up(i, e);
    Ph(t);
  } catch (t) {
    (Rh(t.message),
      he?.phase === "lobby" && (fe("lobbyNote").textContent = t.message));
  }
}
async function Dh(i = !0) {
  (hp.close(),
    ap.reset(),
    (Ih = !1),
    (kt = null),
    (he = null),
    (jd = ""),
    (Qd = ""),
    (hudKey = ""),
    (lp = 0),
    (rp = ""),
    (Eh = 3),
    Ua.clear(),
    (ei = null),
    clearTimeout(ip),
    Rt("night-intro", !1),
    document.exitPointerLock?.(),
    Rt("hud", !1),
    Rt("lobby", !1),
    Rt("pause", !1),
    Rt("result", !1),
    Rt("menu", !0),
    ht?.setItems([]),
    (fr = !1),
    (dr = !1),
    (rs = !1),
    (qn = !1),
    nn.clear());
}
function sT() {
  return { x: et.x, z: et.z, yaw: In, crouch: fr, sprint: rs, moving: dr };
}
var Na = !1;
async function e_() {
  if (!Ih || !kt || Na) return;
  Na = !0;
  let i = performance.now();
  try {
    Ph(await up("sync", { seq: ++Qb, move: sT() }));
    let e = Math.round(performance.now() - i);
    fe("connection").textContent =
      he.maxPlayers === 1 ? "TEK OYUNCULU" : `ODA \xB7 ${e} ms`;
  } catch (e) {
    (ep++,
      (fe("connection").textContent = "BA\u011ELANTI YEN\u0130LEN\u0130YOR"),
      ep === 3 &&
        Rh(
          "Odayla ba\u011Flant\u0131 zay\u0131flad\u0131. Yeniden ba\u011Flan\u0131l\u0131yor.",
          5e3,
        ),
      [401, 404, 410].includes(e.status) && (await Dh(!1), Fa(e.message)));
  } finally {
    ((Na = !1), (J0 = performance.now()));
  }
}
function ka(i) {
  !he ||
    he.phase !== "playing" ||
    ti()?.captured ||
    ((qn = i),
    Rt("pause", i),
    Rt("closeSettings", !1),
    Rt("resume", !0),
    i ? (document.exitPointerLock?.(), nn.clear()) : fp());
}
function rT() {
  he &&
    ((ei = uo()
      .filter((i) => !i.collected)
      .map((i) => ({ ...i, d: Math.hypot(i.x - et.x, i.z - et.z) }))
      .sort((i, e) => i.d - e.d)[0]),
    (fe("interaction").style.display =
      ei && ei.d < 2.8 && da(et, ei, he.fallenShelves) && !qn && !ti()?.captured
        ? "block"
        : "none"),
    ei && (fe("interaction").textContent = `E  \xB7  ${ei.label} sepete koy`));
}
async function oT() {
  if (
    he?.phase !== "playing" ||
    qn ||
    ti()?.captured ||
    !ti()?.lives ||
    !ei ||
    ei.ownerId !== kt?.me ||
    !da(et, ei, he.fallenShelves)
  )
    return;
  let i = ei.id;
  for (; Na;) await new Promise((e) => setTimeout(e, 25));
  kt &&
    (await e_(),
    !(!kt || ti()?.captured) && (await fo("collect", { itemId: i })));
}
function aT() {
  let i = fe("minimap").getContext("2d"),
    e = 210,
    t = 250,
    n = e / _n.width,
    s = t / _n.depth;
  ((i.fillStyle = "#0e1c15"), i.fillRect(0, 0, e, t));
  let r = (a) => (a + 120) * n,
    o = (a) => (a + 160) * s;
  i.fillStyle = "#4c5c43";
  for (let a of Rg(he?.fallenShelves))
    i.fillRect(
      r(a.x - a.w / 2),
      o(a.z - a.d / 2),
      Math.max(1, a.w * n),
      a.d * s,
    );
  ((i.strokeStyle = "#47653f"), (i.lineWidth = 0.5));
  for (let a = 0; a <= t; a += 26)
    (i.beginPath(), i.moveTo(0, a), i.lineTo(e, a), i.stroke());
  ((i.fillStyle = "#43846a"),
    i.beginPath(),
    i.arc(r(0), o(148), 10 * n, 0, Math.PI * 2),
    i.fill());
  for (let a of uo())
    a.collected ||
      ((i.fillStyle = "#e2d597"),
      i.beginPath(),
      i.arc(r(a.x), o(a.z), 2.2, 0, Math.PI * 2),
      i.fill());
  for (let a of he?.players || [])
    a.id === kt?.me ||
      !a.online ||
      !a.lives ||
      ((i.fillStyle = Ch(a)),
      i.beginPath(),
      i.arc(r(a.x), o(a.z), 2.7, 0, Math.PI * 2),
      i.fill());
  (i.save(),
    i.translate(r(et.x), o(et.z)),
    i.rotate(-In),
    (i.fillStyle = "#dceec3"),
    i.beginPath(),
    i.moveTo(0, -5),
    i.lineTo(-3.5, 4),
    i.lineTo(3.5, 4),
    i.closePath(),
    i.fill(),
    i.restore());
}
function cT() {
  if (!he || !ht) return;
  let i = uo(),
    e = i.every((a) => a.collected),
    t = e
      ? [
          {
            id: "safe",
            label: "TESL\u0130MAT ALANI",
            x: 0,
            y: 2,
            z: 148,
            safe: !0,
          },
        ]
      : i
          .filter((a) => !a.collected)
          .sort(
            (a, c) =>
              Math.hypot(a.x - et.x, a.z - et.z) -
              Math.hypot(c.x - et.x, c.z - et.z),
          )
          .slice(0, 8),
    n = "",
    r = [];
  for (let a of t) {
    const screen = ht.camera.worldToScreen({x:a.x,y:a.y+1,z:a.z});
    if (!screen || screen.z <= 0 || screen.x < 0 || screen.x > innerWidth || screen.y < 0 || screen.y > innerHeight) continue;
    let l = screen.x, h = screen.y;
    if (r.some((f) => Math.abs(f.x - l) < 100 && Math.abs(f.y - h) < 55))
      continue;
    r.push({ x: l, y: h });
    let u = Math.round(Math.hypot(a.x - et.x, a.z - et.z));
    n += `<div class="marker ${a.safe ? "safe" : ""}" style="left:${l}px;top:${h}px"><b>${a.safe ? "\u2302" : "\u25C7"}</b>${Oa(a.label)}<br><small>${u} m${a.aisle ? " \xB7 RAF " + String(a.aisle).padStart(2, "0") : ""}</small></div>`;
  }
  fe("markers").innerHTML = n;
  let o = e ? { x: 0, z: 148, label: "TESL\u0130MAT ALANI" } : ei;
  if (o) {
    let a = Math.atan2(o.x - et.x, et.z - o.z) + In;
    ((a = Math.atan2(Math.sin(a), Math.cos(a))),
      (fe("direction").textContent =
        `${a < -0.35 ? "\u2190" : a > 0.35 ? "\u2192" : "\u2191"} ${o.label.toLocaleUpperCase("tr-TR")} \xB7 ${Math.round(Math.hypot(o.x - et.x, o.z - et.z))} m`));
  }
}
function lT(i, e) {
  let t = ti();
  if (
    !t ||
    !t.lives ||
    t.captured ||
    qn ||
    e < tp ||
    e < lp ||
    he.phase !== "playing"
  ) {
    ((dr = !1), (rs = !1));
    return;
  }
  (nn.has("ArrowLeft") && (In += 1.4 * i),
    nn.has("ArrowRight") && (In -= 1.4 * i));
  let n =
      (nn.has("KeyW") || nn.has("ArrowUp") ? 1 : 0) -
      (nn.has("KeyS") || nn.has("ArrowDown") ? 1 : 0),
    s = (nn.has("KeyD") ? 1 : 0) - (nn.has("KeyA") ? 1 : 0),
    r = Math.hypot(n, s);
  ((fr = nn.has("KeyC")),
    (dr = r > 0),
    (rs = dr && !fr && (nn.has("ShiftLeft") || nn.has("ShiftRight")) && Pi > 1),
    rs ? (Pi = Math.max(0, Pi - 22 * i)) : (Pi = Math.min(100, Pi + 14 * i)));
  let o = fr ? 2.4 : rs ? 8 : 5;
  if (r) {
    let a = ((-Math.sin(In) * n + Math.cos(In) * s) / r) * o * i,
      c = ((-Math.cos(In) * n - Math.sin(In) * s) / r) * o * i,
      l = Math.ceil(Math.hypot(a, c) / 0.2);
    for (let h = 0; h < l; h++)
      (wn(et.x + a / l, et.z, 0.42, he.fallenShelves) || (et.x += a / l),
        wn(et.x, et.z + c / l, 0.42, he.fallenShelves) || (et.z += c / l));
  }
}
var hT =
    typeof location < "u" &&
    new URLSearchParams(location.search).has("diagnostics"),
  Da = 0,
  Zd = 0,
  Th = [];
function uT(i) {
  if (hT && (Da || (Da = i), Zd && Th.push(i - Zd), (Zd = i), i - Da > 5e3)) {
    let e = [...Th].sort((t, n) => t - n);
    (console.info(
      "FRAME_DIAGNOSTICS " +
        JSON.stringify({
          fps: Math.round((Th.length * 1e3) / (i - Da)),
          p95Ms: Math.round(e[Math.floor(e.length * 0.95)] || 0),
          calls: ht.renderer.info.render.calls,
          triangles: ht.renderer.info.render.triangles,
          phase: he?.phase || "menu",
        }),
    ),
      (Da = i),
      (Th = []));
  }
}
function t_(i) {
  if ((requestAnimationFrame(t_), !ht)) return;
  if (document.hidden) {
    jb.getDelta(); renderedAt = 0; lastDrawAt = 0; drawFrameEMA = 0; frameFps = 0;
    Da = 0; Zd = 0; Th = [];
    return;
  }
  const userFrameLimit = Number(preferences.fps || 60);
  const presetFrameLimit = Number(ht.metrics?.fpsLimit);
  const frameLimit = Number.isFinite(presetFrameLimit) && presetFrameLimit > 0
    ? Math.min(userFrameLimit, presetFrameLimit)
    : userFrameLimit;
  const interval = 1000 / frameLimit;
  const elapsed = i - renderedAt;
  if (renderedAt && elapsed < interval - 0.5) return;
  // Retain fractional frame time: e.g. 45 FPS on a 60 Hz display alternates
  // one/two display intervals instead of rounding every frame down to 30 FPS.
  renderedAt = renderedAt ? i - (Math.max(0, elapsed - interval) % interval) : i;
  const rawDelta = jb.getDelta();
  let e = Math.min(rawDelta, 0.06);
  const movementDelta = Math.min(rawDelta, 0.25);
  const actualQuality = ht.metrics?.activeQuality || preferences.quality || 'auto';
  if (document.body.dataset.graphics !== actualQuality) document.body.dataset.graphics = actualQuality;
  if (((hr += e), he?.phase === "playing")) {
    (lT(movementDelta, i), (ht.camera.position.x = et.x), (ht.camera.position.z = et.z));
    let s = fr ? 1.05 : 1.72,
      r = dr && !qn ? Math.sin(hr * (rs ? 15 : 9)) * (fr ? 0.014 : 0.035) : 0,
      o = i < sp ? Q0 * Math.max(0, (sp - i) / 850) : 0;
    ((ht.camera.position.y = mn.lerp(
      ht.camera.position.y,
      s + r,
      Math.min(1, e * 12),
    )),
      ht.camera.rotation.set(
        wh + Math.sin(hr * 67) * o,
        In + Math.cos(hr * 53) * o,
        Math.sin(hr * 41) * o * 0.5,
        "YXZ",
      ),
      (ht.camera.fov = mn.lerp(ht.camera.fov, rs ? 76 : 70, e * 5)),
      ht.camera.updateProjectionMatrix(),
      (fe("stamina").style.width = Pi + "%"),
      (fe("stance").textContent = ti()?.lives
        ? ti()?.captured
          ? ""
          : fr
            ? "SESS\u0130Z Y\xDCR\xDCYORSUN"
            : rs
              ? "KO\u015EUYORSUN"
              : dr
                ? "Y\xDCR\xDCYORSUN"
                : "AYAKTA"
        : "ELEND\u0130N \xB7 EK\u0130B\u0130N\u0130 BEKLE"),
      i - Y0 > (document.body.dataset.graphics === 'ultraLow' ? 220 : 140) && (rT(), aT(), cT(), iT(i), (Y0 = i)));
    let a = he.players.find((c) => c.id === kt?.me);
    ((fe("noise").style.width = (a?.noise || 0) * 100 + "%"),
      (fe("powerState").textContent = he.blackout
        ? "ELEKTR\u0130K KES\u0130K \xB7 FENER\u0130N\u0130 KULLAN"
        : "FLORESANLAR A\xC7IK"));
  } else
    he
      ? (ht.camera.position.set(0, 1.8, 148), ht.camera.lookAt(0, 2, -40))
      : (ht.camera.position.set(3 + Math.sin(hr * 0.035) * 2, 1.85, 126),
        ht.camera.lookAt(14, 2, -30));
  let t = ap.sample(i) || he,
    n = ht.update(t, kt?.me, e, hr, Jd);
  if (he?.phase === "playing") {
    let s = ht.capturePose?.(t, ti(), t.hostNow);
    (s &&
      (ht.camera.position.set(s.position.x, s.position.y, s.position.z),
      ht.camera.lookAt(s.lookAt.x, s.lookAt.y, s.lookAt.z),
      (ht.camera.rotation.z = s.roll || 0),
      (ht.camera.fov = 75),
      ht.camera.updateProjectionMatrix(),
      (fe("markers").innerHTML = ""),
      (fe("interaction").style.display = "none")),
      Li.update(n, et, In, i));
  } else Li.update(null, et, In, i);
  const framesBefore = ht.metrics?.renderedFrames;
  const rendered = ht.renderer.render(ht.scene, ht.camera);
  const framesAfter = ht.metrics?.renderedFrames;
  const didDraw = Number.isFinite(framesBefore) && Number.isFinite(framesAfter)
    ? framesAfter > framesBefore
    : rendered === true;
  // Diagnostics count completed graphics draws, not RAF callbacks or skipped
  // renderer calls. This remains correct if the renderer rejects a frame.
  if (didDraw) {
    if (lastDrawAt && i > lastDrawAt) {
      const drawInterval = i - lastDrawAt;
      drawFrameEMA = drawFrameEMA ? drawFrameEMA * 0.95 + drawInterval * 0.05 : drawInterval;
      frameFps = 1000 / drawFrameEMA;
    }
    lastDrawAt = i;
    uT(i);
  }
  if (i > Z0) fe("toast").classList.remove("show");
}
fe("solo").onclick = () => Lh(!0);
fe("create").onclick = () => Lh();
fe("join").onclick = () => Lh(!1, !0);
fe("roomcode").addEventListener(
  "input",
  (i) => (i.target.value = i.target.value.replace(/\D/g, "")),
);
fe("roomcode").addEventListener("keydown", (i) => {
  i.key === "Enter" && Lh(!1, !0);
});
fe("start").onclick = () => {
  (Li.init().catch(() => {}), fo("start"));
};
fe("next").onclick = () => fo("next");
fe("restart").onclick = () => fo("restart");
fe("lobbyCapacity").onchange = (i) =>
  fo("capacity", { maxPlayers: Number(i.target.value) });
fe("copyCode").onclick = async () => {
  try {
    (await navigator.clipboard.writeText(he.code),
      (fe("lobbyNote").textContent = "Oda kodu kopyaland\u0131."));
  } catch {
    fe("lobbyNote").textContent = `Oda kodu: ${he.code}`;
  }
};
document.querySelectorAll(".leave").forEach((i) => (i.onclick = () => Dh()));
fe("resume").onclick = () => ka(!1);
fe("pauseButton").onclick = () => ka(!0);
fe("volume").oninput = (i) => Li.setVolume(Number(i.target.value) / 100);
fe("sensitivity").oninput = (i) => (np = Number(i.target.value) * 22e-6);
fe("quality").onchange = (i) => {
  preferences.quality = i.target.value;
  ht.quality(preferences.quality);
  document.body.dataset.graphics = preferences.quality;
  savePreferences();
};
fe('fpsLimit').onchange = (i) => { preferences.fps = Number(i.target.value); savePreferences(); };
fe("settingsButton").onclick = () => {
  (Rt("pause", !0), Rt("resume", !1), Rt("closeSettings", !0));
};
fe("closeSettings").onclick = () => Rt("pause", !1);
fe("creditsButton").onclick = () => fe("credits").showModal();
fe("closeCredits").onclick = () => fe("credits").close();
function fp() {
  if (!(he?.phase !== "playing" || qn || ti()?.captured)) {
    if ((Li.ctx?.resume(), os.focus(), !os.requestPointerLock)) {
      ((Ah = !0),
        Rh(
          "Sol t\u0131kla s\xFCr\xFCkleyerek veya \u2190 \u2192 tu\u015Flar\u0131yla etrafa bak.",
        ));
      return;
    }
    try {
      os.requestPointerLock()?.catch?.(() => {
        ((Ah = !0),
          Rh(
            "Sol t\u0131kla s\xFCr\xFCkleyerek veya \u2190 \u2192 tu\u015Flar\u0131yla etrafa bak.",
          ));
      });
    } catch {
      Ah = !0;
    }
  }
}
os.onclick = fp;
os.addEventListener("mousedown", (i) => {
  i.button === 0 && he?.phase === "playing" && !qn && ((cp = !0), os.focus());
});
window.addEventListener("mouseup", () => (cp = !1));
document.addEventListener("mousemove", (i) => {
  (document.pointerLockElement !== os && !(Ah && cp)) ||
    qn ||
    ti()?.captured ||
    he?.phase !== "playing" ||
    ((In -= i.movementX * np),
    (wh = Math.max(-1.35, Math.min(1.35, wh - i.movementY * np))));
});
document.addEventListener("pointerlockchange", () => {
  !document.pointerLockElement && he?.phase === "playing" && !qn && ka(!0);
});
window.addEventListener("keydown", (i) => {
  ["INPUT", "SELECT", "TEXTAREA"].includes(i.target.tagName) ||
    (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      i.code,
    ) && i.preventDefault(),
    nn.add(i.code),
    !i.repeat &&
      (i.code === "KeyE" && oT(),
      i.code === "KeyF" && (Jd = !Jd),
      i.code === "KeyM" && fe("hud").classList.toggle("bigmap"),
      i.code === "Escape" && he?.phase === "playing" && ka(!0)));
});
window.addEventListener("keyup", (i) => nn.delete(i.code));
window.addEventListener("blur", () => {
  (nn.clear(), he?.phase === "playing" && ka(!0));
});
window.addEventListener("pagehide", () => hp.close());
async function fT() {
  try {
    ((ht = await Lg(os, (i) => {
      ((fe("loadbar").style.width = `${Math.round(i * 100)}%`),
        (fe("loadtext").textContent =
          `Raflar ve modeller haz\u0131rlan\u0131yor\u2026 %${Math.round(i * 100)}`));
    })),
      ht.quality(preferences.quality || 'auto'),
      fe('quality').value = preferences.quality || 'auto',
      fe('fpsLimit').value = String(preferences.fps || 60),
      document.body.dataset.graphics = preferences.quality || 'auto',
      (j0 = !1),
      Rt("loading", !1),
      Rt("menu"),
      requestAnimationFrame(t_));
  } catch (i) {
    ((fe("loadtext").textContent =
      "Y\xFCkleme ba\u015Far\u0131s\u0131z: " + i.message),
      (fe("loading").querySelector("b").textContent =
        "Market a\xE7\u0131lamad\u0131."),
      console.error(i));
  }
}
setInterval(() => {
  Ih &&
    !Na &&
    performance.now() - J0 > (he?.phase === "playing" ? 220 : 850) &&
    e_();
}, 100);
fT();
if (hT) {
  Object.defineProperty(window, '__SK_DIAGNOSTICS__', { get: () => ({
    engine: 'PlayCanvas', phase: he?.phase || 'menu',
    state: he ? structuredClone(he) : null,
    position: {...et}, crouch: fr, cameraY: ht?.camera.position.y,
    fps: Math.round(frameFps), renderer: ht?.metrics,
    draw: ht?.renderer.info.render, network: hp.stats,
    quality: preferences.quality || 'auto',
  }) });
}
