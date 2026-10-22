const Nl = path => path;
var Vl = (i, e, t) => Math.max(e, Math.min(t, i)),
  Dg = 155,
  Gl = class {
    constructor() {
      ((this.volume = 0.65),
        (this.buffers = {}),
        (this.lastStep = -1 / 0),
        (this.lastMonster = null),
        (this.stepDistance = 0),
        (this.stepIndex = 0),
        (this.ready = !1));
    }
    async init() {
      if (this.ready) {
        await this.ctx.resume();
        return;
      }
      let e = window.AudioContext || window.webkitAudioContext;
      if (!e) return;
      ((this.ctx = new e()),
        (this.ready = !0),
        (this.master = this.ctx.createGain()),
        (this.master.gain.value = this.volume),
        this.master.connect(this.ctx.destination),
        (this.echo = this.ctx.createConvolver()));
      let t = 1.15,
        n = Math.ceil(this.ctx.sampleRate * t),
        s = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
      for (let l = 0; l < 2; l++) {
        let h = s.getChannelData(l);
        for (let u = 0; u < n; u++) {
          let f = u / this.ctx.sampleRate,
            d = Math.exp(-f * 5.5) * 0.45;
          h[u] = f > 0.035 ? (Math.random() * 2 - 1) * d : 0;
        }
      }
      this.echo.buffer = s;
      let r = this.ctx.createBiquadFilter();
      ((r.type = "lowpass"), (r.frequency.value = 3600));
      let o = this.ctx.createGain();
      ((o.gain.value = 0.24),
        this.echo.connect(r).connect(o).connect(this.master),
        await Promise.all(
          [
            "alert",
            "jumpscare",
            "footstep1",
            "footstep2",
            "footstep3",
            "footstep4",
          ].map(async (l) => {
            let h = new AbortController(),
              u = setTimeout(() => h.abort(), 6e3);
            try {
              let f = await fetch(Nl(`assets/audio/${l}.mp3`), {
                signal: h.signal,
              });
              if (!f.ok) throw new Error("Ses dosyas\u0131 bulunamad\u0131");
              this.buffers[l] = await this.ctx.decodeAudioData(
                await f.arrayBuffer(),
              );
            } catch {
              console.warn("Ses y\xFCklenemedi:", l);
            } finally {
              clearTimeout(u);
            }
          }),
        ));
      let a = this.ctx.createOscillator(),
        c = this.ctx.createGain();
      ((a.frequency.value = 57),
        (c.gain.value = 0.009),
        a.connect(c).connect(this.master),
        a.start());
    }
    setVolume(e) {
      ((this.volume = Vl(Number(e) || 0, 0, 1)),
        this.master &&
          this.master.gain.setTargetAtTime(
            this.volume,
            this.ctx.currentTime,
            0.05,
          ));
    }
    play(e, t = 0.6, n = 0, s = {}) {
      if (!this.ctx || !this.buffers[e]) return;
      let r = this.ctx.createBufferSource(),
        o = this.ctx.createGain();
      ((r.buffer = this.buffers[e]),
        (r.playbackRate.value = s.rate || 1),
        (o.gain.value = Vl(t, 0, 1.5)));
      let a = this.ctx.createBiquadFilter();
      ((a.type = "lowpass"), (a.frequency.value = s.cutoff || 18e3));
      let c = this.ctx.createStereoPanner
        ? this.ctx.createStereoPanner()
        : this.ctx.createGain();
      (c.pan && (c.pan.value = Vl(n, -1, 1)),
        r.connect(a).connect(o).connect(c).connect(this.master),
        s.echo && this.echo && c.connect(this.echo),
        r.start(this.ctx.currentTime + Math.max(0, s.delay || 0)),
        (r.onended = () => {
          (r.disconnect(), a.disconnect(), o.disconnect(), c.disconnect());
        }));
    }
    spatial(e, t, n, s = Dg) {
      let r = Math.hypot(e.x - t.x, e.z - t.z),
        o = Math.atan2(e.x - t.x, t.z - e.z) + n,
        a = Math.max(0, 1 - r / s);
      return {
        distance: r,
        pan: Math.sin(o) * 0.88,
        level: (0.9 * Math.pow(a, 0.8)) / Math.pow(1 + r / 55, 0.55),
        cutoff: Math.max(1900, 14e3 / (1 + r / 32)),
      };
    }
    update(e, t, n, s) {
      if (!e) {
        ((this.lastMonster = null), (this.stepDistance = 0));
        return;
      }
      let r = Number.isFinite(e.distanceWalked) ? e.distanceWalked : null,
        o = this.lastMonster,
        a = 0;
      if (o) {
        let u = Math.hypot(e.x - o.x, e.z - o.z);
        u > 20 || (r !== null && o.travelled !== null && r < o.travelled)
          ? ((this.stepDistance = 0), (this.lastStep = -1 / 0))
          : (a = r !== null && o.travelled !== null ? r - o.travelled : u);
      }
      ((this.lastMonster = { x: e.x, z: e.z, travelled: r }),
        (this.stepDistance += Vl(a, 0, 4)));
      let c = e.state === "chase" ? 1.75 : 1.65,
        l = e.state === "chase" ? 260 : 410;
      if (this.stepDistance < c || s - this.lastStep < l) return;
      ((this.stepDistance = Math.min(c, this.stepDistance - c)),
        (this.lastStep = s));
      let h = this.spatial(e, t, n);
      h.distance >= Dg ||
        ((this.stepIndex = (this.stepIndex + 1) % 4),
        this.play(`footstep${this.stepIndex + 1}`, h.level, h.pan, {
          cutoff: h.cutoff,
          echo: !0,
          rate: e.state === "chase" ? 1.04 : 0.96,
        }));
    }
    shelfCollapse(e, t, n) {
      if (!this.ctx || !Number.isFinite(e?.x) || !Number.isFinite(e?.z)) return;
      let s = this.spatial(e, t, n, 190);
      if (s.distance >= 190) return;
      let r = Math.min(0.9, s.level * 1.35);
      (this.play("footstep3", r, s.pan, {
        rate: 0.65,
        cutoff: s.cutoff,
        echo: !0,
      }),
        this.play("footstep1", r * 0.62, s.pan, {
          delay: 0.16,
          rate: 0.78,
          cutoff: s.cutoff,
          echo: !0,
        }),
        this.play("footstep4", r * 0.55, s.pan, {
          delay: 0.38,
          rate: 0.7,
          cutoff: s.cutoff,
          echo: !0,
        }));
      let o = this.ctx.createOscillator(),
        a = this.ctx.createGain(),
        c = this.ctx.currentTime;
      ((o.type = "sine"),
        o.frequency.setValueAtTime(74, c),
        o.frequency.exponentialRampToValueAtTime(31, c + 0.65),
        a.gain.setValueAtTime(1e-4, c),
        a.gain.exponentialRampToValueAtTime(Math.max(2e-4, r * 0.12), c + 0.04),
        a.gain.exponentialRampToValueAtTime(1e-4, c + 0.85));
      let l = this.ctx.createStereoPanner
        ? this.ctx.createStereoPanner()
        : this.ctx.createGain();
      (l.pan && (l.pan.value = s.pan),
        o.connect(a).connect(l).connect(this.master),
        o.start(),
        o.stop(c + 0.9),
        (o.onended = () => {
          (o.disconnect(), a.disconnect(), l.disconnect());
        }));
    }
    pickup() {
      if (!this.ctx) return;
      let e = this.ctx.createOscillator(),
        t = this.ctx.createGain(),
        n = this.ctx.currentTime;
      ((e.type = "sine"),
        e.frequency.setValueAtTime(600, n),
        e.frequency.exponentialRampToValueAtTime(900, n + 0.12),
        t.gain.setValueAtTime(0.06, n),
        t.gain.exponentialRampToValueAtTime(0.001, n + 0.17),
        e.connect(t).connect(this.master),
        e.start(),
        e.stop(n + 0.18),
        (e.onended = () => {
          (e.disconnect(), t.disconnect());
        }));
    }
  };

export { Gl };
