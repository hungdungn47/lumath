// Canvas scene: the x number line with sets A and B on top, the m-axis with
// condition tracks below, plus all particle effects.
(function () {
  'use strict';

  // Canvas colors per theme. Colors passed to rgba() must be 6-digit hex.
  const PALETTES = {
    dark: {
      A: '#22d3ee',
      B: '#c084fc',
      inter: '#fbbf24',
      yes: '#34d399',
      no: '#fb7185',
      validity: '#94a3b8',
      atoms: ['#60a5fa', '#f472b6', '#fb923c', '#a3e635'],
      text: '#e2e8f0',
      strong: '#f8fafc',
      dim: '#64748b',
      faint: 'rgba(148,163,184,0.18)',
      axis: '#94a3b8',
      accent: '#a5b4fc',
      hint: '#cbd5e1',
      crit: '#fde68a',
      hole: '#0b1022',
      blend: 'lighter',
    },
    light: {
      A: '#0891b2',
      B: '#9333ea',
      inter: '#d97706',
      yes: '#059669',
      no: '#e11d48',
      validity: '#64748b',
      atoms: ['#2563eb', '#db2777', '#ea580c', '#65a30d'],
      text: '#0f172a',
      strong: '#0f172a',
      dim: '#64748b',
      faint: 'rgba(15,23,42,0.12)',
      axis: '#64748b',
      accent: '#6366f1',
      hint: '#334155',
      crit: '#b45309',
      hole: '#ffffff',
      blend: 'source-over',
    },
  };
  // Mutated in place on theme change so every holder of SceneColors sees the new palette.
  const C = { ...PALETTES[Theme.resolved] };
  const FONT = '"Space Grotesk", ui-sans-serif, system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const PAINT_N = 600;
  const t = (k, p) => I18n.t(k, p);

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dec = (v) => {
    const r = Math.round(v * 100) / 100;
    return (Object.is(r, -0) ? 0 : r).toString().replace('-', '−');
  };

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function niceStep(span, target) {
    const raw = span / target;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }

  class Scene {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.rings = [];
      this.trail = [];
      this.m = 0;
      this.targetM = 0;
      this.focus = null; // index into tracks, 'answer', or null
      this.revealed = false;
      this.revealT = 0;
      this.time = 0;
      this.truth = null;
      this.onTick = null;
      this.onTruthChange = null;
      this.W = 800;
      this.H = 600;
      new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
      Theme.onChange((theme) => {
        Object.assign(C, PALETTES[theme]);
        if (this.tracks) this.recolor();
      });
      this.resize();
      let last = performance.now();
      const loop = (t) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        this.step(dt);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // ---------- setup ----------

    setProblem(P, R) {
      this.P = P;
      this.R = R;
      this.tracks = [...R.validity, ...R.conditions].map((atom) => ({ atom }));
      this.recolor();

      const cr = R.criticals;
      if (cr.length) {
        const lo = cr[0];
        const hi = cr[cr.length - 1];
        const span = Math.max(hi - lo, 4);
        this.mMin = Math.floor(lo - span * 0.6);
        this.mMax = Math.ceil(hi + span * 0.6);
      } else {
        this.mMin = -6;
        this.mMax = 6;
      }

      const xs = [];
      for (let i = 0; i <= 60; i++) {
        const m = lerp(this.mMin, this.mMax, i / 60);
        for (const e of [P.A.lo, P.A.hi, P.B.lo, P.B.hi]) if (!e.inf) xs.push(e.a * m + e.b);
      }
      let xMin = Math.min(...xs);
      let xMax = Math.max(...xs);
      if (xMax - xMin < 4) {
        const c = (xMin + xMax) / 2;
        xMin = c - 2;
        xMax = c + 2;
      }
      const pad = (xMax - xMin) * 0.06;
      this.xMin = xMin - pad;
      this.xMax = xMax + pad;

      this.paint = new Int8Array(PAINT_N);
      this.prevPaintM = null;
      this.truth = null;
      this.trail = [];
      this.revealed = false;
      this.revealT = 0;
      this.focus = null;
      this.resize();
    }

    recolor() {
      const nV = this.R.validity.length;
      this.tracks.forEach((tr, i) => {
        tr.color = i < nV ? C.validity : C.atoms[(i - nV) % C.atoms.length];
      });
    }

    // Same problem, freshly translated solver output (language switch).
    setText(R) {
      this.R = R;
      const atoms = [...R.validity, ...R.conditions];
      this.tracks.forEach((tr, i) => (tr.atom = atoms[i]));
    }

    reveal(on = true) {
      this.revealed = on;
      if (!on) this.revealT = 0;
    }

    resize() {
      const parent = this.cv.parentElement;
      const W = parent.clientWidth;
      const nTracks = this.tracks ? this.tracks.length + 1 : 3;
      this.L = {
        rowA: 104,
        rowB: 164,
        axis: 226,
        divider: 292,
        mHead: 322,
        tracksTop: 346,
        trackH: 44,
      };
      this.L.mAxis = this.L.tracksTop + nTracks * this.L.trackH + 18;
      const H = this.L.mAxis + 58;
      const dpr = window.devicePixelRatio || 1;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.height = H + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = W;
      this.H = H;
      this.padL = W < 520 ? 22 : 44;
      this.padR = W < 520 ? 22 : 44;
      this.mPadR = W < 520 ? 44 : 76;
    }

    xPx(x) {
      if (x === -Infinity) return -20;
      if (x === Infinity) return this.W + 20;
      return this.padL + ((x - this.xMin) / (this.xMax - this.xMin)) * (this.W - this.padL - this.padR);
    }

    mPx(m) {
      if (m === -Infinity) return this.padL - 6;
      if (m === Infinity) return this.W - this.mPadR + 6;
      return this.padL + ((m - this.mMin) / (this.mMax - this.mMin)) * (this.W - this.padL - this.mPadR);
    }

    // ---------- simulation ----------

    step(dt) {
      this.time += dt;
      if (this.onTick) this.onTick(dt);
      if (!this.P) return;

      const k = 1 - Math.exp(-dt * 11);
      this.m += (this.targetM - this.m) * k;
      if (Math.abs(this.targetM - this.m) < 1e-4) this.m = this.targetM;

      if (this.revealed) this.revealT = Math.min(1, this.revealT + dt * 0.9);

      this.paintExplored();

      const truth = Solver.contains(this.R.solution, this.m);
      if (this.truth !== null && truth !== this.truth) this.celebrate(truth);
      this.truth = truth;

      // trail of A
      const a = this.setAt('A');
      const p1 = this.xPx(a.lo);
      const p2 = this.xPx(a.hi);
      const lastT = this.trail[this.trail.length - 1];
      if (!lastT || Math.abs(lastT.p1 - p1) > 0.6 || Math.abs(lastT.p2 - p2) > 0.6) {
        this.trail.push({ p1, p2 });
        if (this.trail.length > 14) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();

      // sparks rising from A ∩ B
      const I = this.intersection();
      if (I) {
        const q1 = clamp(this.xPx(I.lo), 0, this.W);
        const q2 = clamp(this.xPx(I.hi), 0, this.W);
        const rate = clamp((q2 - q1) / 14, 0.6, 7) * dt * 60;
        for (let i = 0; i < rate; i++) {
          if (Math.random() > rate - i) break;
          this.spawn({
            x: rand(q1, q2), y: this.L.axis, vx: rand(-14, 14), vy: rand(-70, -25),
            life: rand(0.6, 1.4), size: rand(0.8, 2.4), color: C.inter, drag: 0.98, g: -10,
          });
        }
      }

      // ambient glints along the answer track once revealed
      if (this.revealT > 0.95) {
        for (const iv of this.R.solution) {
          const q1 = clamp(this.mPx(iv.lo), this.padL, this.W - this.mPadR);
          const q2 = clamp(this.mPx(iv.hi), this.padL, this.W - this.mPadR);
          if (Math.random() < ((q2 - q1) / 400) * dt * 60) {
            this.spawn({ x: rand(q1, q2), y: this.answerY(), vx: rand(-6, 6), vy: rand(-28, -8), life: rand(0.5, 1.1), size: rand(0.8, 1.8), color: C.yes, g: 0 });
          }
        }
      }

      for (const p of this.particles) {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.age += dt;
      }
      this.particles = this.particles.filter((p) => p.age < p.life);
      for (const r of this.rings) r.age += dt;
      this.rings = this.rings.filter((r) => r.age < r.life);
    }

    spawn(o) {
      if (this.particles.length > 900) return;
      this.particles.push(Object.assign({ drag: 0.97, g: 60, age: 0 }, o));
    }

    burst(x, y, color, n = 60, speed = 260) {
      for (let i = 0; i < n; i++) {
        const ang = rand(0, Math.PI * 2);
        const v = rand(speed * 0.25, speed);
        this.spawn({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: rand(0.5, 1.2), size: rand(1, 3.2), color, drag: 0.94, g: 120 });
      }
      this.rings.push({ x, y, color, age: 0, life: 0.8, r0: 4, r1: 70 });
    }

    celebrate(truth) {
      const color = truth ? C.yes : C.no;
      const a = this.setAt('A');
      const cx = clamp((this.xPx(a.lo) + this.xPx(a.hi)) / 2, 30, this.W - 30);
      this.burst(cx, this.L.rowA, color, truth ? 70 : 30, truth ? 300 : 180);
      this.burst(this.mPx(this.m), this.L.mAxis, color, truth ? 50 : 24, truth ? 240 : 150);
      if (this.onTruthChange) this.onTruthChange(truth);
    }

    paintExplored() {
      const idx = (m) => clamp(Math.round(((m - this.mMin) / (this.mMax - this.mMin)) * (PAINT_N - 1)), 0, PAINT_N - 1);
      const cur = idx(this.m);
      const prev = this.prevPaintM === null ? cur : idx(this.prevPaintM);
      const [i0, i1] = prev < cur ? [prev, cur] : [cur, prev];
      for (let i = i0; i <= i1; i++) {
        const m = lerp(this.mMin, this.mMax, i / (PAINT_N - 1));
        this.paint[i] = Solver.contains(this.R.solution, m) ? 1 : -1;
      }
      this.prevPaintM = this.m;
    }

    setAt(name) {
      const S = this.P[name];
      return { lo: Solver.evalEp(S.lo, this.m), hi: Solver.evalEp(S.hi, this.m), loC: S.loC, hiC: S.hiC };
    }

    intersection() {
      const a = this.setAt('A');
      const b = this.setAt('B');
      if (a.lo > a.hi || b.lo > b.hi) return null;
      const I = Solver.intersect([a], [b]);
      return I.length ? I[0] : null;
    }

    answerY() {
      return this.L.tracksTop + this.tracks.length * this.L.trackH + 26;
    }

    // ---------- drawing ----------

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);
      if (!this.P) return;
      this.drawTop();
      this.drawStatus();
      this.drawMSection();
      this.drawParticles();
    }

    text(str, x, y, { color = C.text, size = 13, weight = 500, align = 'left', font = FONT, glow = 0 } = {}) {
      const ctx = this.ctx;
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
      }
      ctx.fillText(str, x, y);
      ctx.shadowBlur = 0;
      return ctx.measureText(str).width;
    }

    pill(x, y, label, color, { size = 12, align = 'center', fill = 0.16 } = {}) {
      const ctx = this.ctx;
      ctx.font = `600 ${size}px ${FONT}`;
      const w = ctx.measureText(label).width + 18;
      const h = size + 12;
      const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      ctx.beginPath();
      ctx.roundRect(left, y - h / 2, w, h, h / 2);
      ctx.fillStyle = rgba(color, fill);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
      this.text(label, left + w / 2, y + 0.5, { color, size, weight: 600, align: 'center' });
      return w;
    }

    drawTop() {
      const ctx = this.ctx;
      const { axis } = this.L;

      // axis with ticks
      ctx.strokeStyle = rgba(C.axis, 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, axis);
      ctx.lineTo(this.W - 8, axis);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.W - 8, axis);
      ctx.lineTo(this.W - 16, axis - 5);
      ctx.moveTo(this.W - 8, axis);
      ctx.lineTo(this.W - 16, axis + 5);
      ctx.stroke();
      this.text('x', this.W - 12, axis - 16, { color: C.dim, size: 13, align: 'center', font: MONO });

      const step = niceStep(this.xMax - this.xMin, this.W < 520 ? 7 : 14);
      for (let v = Math.ceil(this.xMin / step) * step; v <= this.xMax; v += step) {
        const px = this.xPx(v);
        ctx.strokeStyle = rgba(C.axis, 0.35);
        ctx.beginPath();
        ctx.moveTo(px, axis - 4);
        ctx.lineTo(px, axis + 4);
        ctx.stroke();
        this.text(dec(v), px, axis + 16, { color: C.dim, size: 11, align: 'center', font: MONO });
      }

      // intersection glow on the axis
      const I = this.intersection();
      if (I) {
        const q1 = this.xPx(I.lo);
        const q2 = this.xPx(I.hi);
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 5);
        ctx.save();
        ctx.shadowColor = C.inter;
        ctx.shadowBlur = 22 * pulse;
        ctx.strokeStyle = C.inter;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(clamp(q1, -10, this.W + 10), axis);
        ctx.lineTo(clamp(q2, -10, this.W + 10), axis);
        ctx.stroke();
        ctx.restore();
        const mid = clamp((clamp(q1, 0, this.W) + clamp(q2, 0, this.W)) / 2, 40, this.W - 40);
        this.text('A ∩ B', mid, axis - 16, { color: C.inter, size: 12, weight: 700, align: 'center', glow: 10 });
      }

      // focus highlight (drawn under the bands)
      const ft = typeof this.focus === 'number' ? this.tracks[this.focus] : null;
      if (ft) {
        const holds = Solver.contains(ft.atom.set, this.m);
        const col = holds ? C.yes : C.no;
        for (const ref of ft.atom.refs) {
          const S = this.setAt(ref[0]);
          const v = S[ref.slice(2)];
          if (!Number.isFinite(v)) continue;
          const px = this.xPx(v);
          const g = ctx.createLinearGradient(0, this.L.rowA - 40, 0, axis);
          g.addColorStop(0, rgba(ft.color, 0));
          g.addColorStop(1, rgba(ft.color, 0.28));
          ctx.fillStyle = g;
          ctx.fillRect(px - 9, this.L.rowA - 40, 18, axis - this.L.rowA + 40);
          const r = 11 + 3 * Math.sin(this.time * 6);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(px, axis, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // ghost trail of A
      this.trail.forEach((t, i) => {
        const a = (i / this.trail.length) * 0.07;
        if (t.p2 > t.p1) {
          ctx.fillStyle = rgba(C.A, a);
          ctx.beginPath();
          ctx.roundRect(t.p1, this.L.rowA - 13, t.p2 - t.p1, 26, 8);
          ctx.fill();
        }
      });

      this.drawBand('B', this.L.rowB);
      this.drawBand('A', this.L.rowA);

      // touching endpoints flash
      const a = this.setAt('A');
      const b = this.setAt('B');
      const tol = (this.xMax - this.xMin) * 0.0015;
      for (const [va, ca] of [[a.lo, a.loC], [a.hi, a.hiC]]) {
        for (const [vb, cb] of [[b.lo, b.loC], [b.hi, b.hiC]]) {
          if (Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < tol) {
            const px = this.xPx(va);
            const shared = ca && cb;
            this.text(t(shared ? 'scene.touchShared' : 'scene.touchNot'), clamp(px, 90, this.W - 90), axis + 56, {
              color: shared ? C.inter : C.no, size: 11, weight: 600, align: 'center', glow: 8,
            });
          }
        }
      }
    }

    drawBand(name, y) {
      const ctx = this.ctx;
      const color = C[name];
      const S = this.setAt(name);
      const P = this.P[name];
      const { axis } = this.L;
      const p1 = this.xPx(S.lo);
      const p2 = this.xPx(S.hi);
      const h = 26;

      // set name + current value
      const valueStr = `${name} = ${S.loC ? '[' : '('}${Number.isFinite(S.lo) ? dec(S.lo) : '−∞'}; ${Number.isFinite(S.hi) ? dec(S.hi) : '+∞'}${S.hiC ? ']' : ')'}`;

      if (S.lo > S.hi || (S.lo === S.hi && !(S.loC && S.hiC))) {
        // empty set at this m
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = rgba(C.no, 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(Math.min(p1, p2), y - h / 2, Math.abs(p2 - p1) || 2, h, 8);
        ctx.stroke();
        ctx.setLineDash([]);
        this.text(t('scene.empty', { name }), clamp((p1 + p2) / 2, 140, this.W - 140), y, { color: C.no, size: 12, weight: 600, align: 'center', glow: 6 });
        this.text(name, 14, y, { color, size: 18, weight: 700, glow: 12 });
        return;
      }

      // drop lines to the axis
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = rgba(color, 0.45);
      ctx.lineWidth = 1;
      for (const p of [p1, p2]) {
        if (p < 0 || p > this.W) continue;
        ctx.beginPath();
        ctx.moveTo(p, y + h / 2);
        ctx.lineTo(p, axis);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // body
      const L = clamp(p1, -30, this.W + 30);
      const R = clamp(p2, -30, this.W + 30);
      const g = ctx.createLinearGradient(L, 0, R, 0);
      const span = Math.max(R - L, 1);
      g.addColorStop(0, rgba(color, S.lo === -Infinity ? 0 : 0.42));
      g.addColorStop(Math.min(0.5, 60 / span), rgba(color, 0.3));
      g.addColorStop(Math.max(0.5, 1 - 60 / span), rgba(color, 0.3));
      g.addColorStop(1, rgba(color, S.hi === Infinity ? 0 : 0.42));
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(L, y - h / 2, R - L, h, 7);
      ctx.fill();
      ctx.restore();
      // shimmering highlight sweeping across the band
      const sx = L + ((this.time * 0.35 + (name === 'A' ? 0 : 0.5)) % 1) * (R - L);
      const sg = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
      sg.addColorStop(0, rgba('#ffffff', 0));
      sg.addColorStop(0.5, rgba('#ffffff', 0.13));
      sg.addColorStop(1, rgba('#ffffff', 0));
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(L, y - h / 2, R - L, h, 7);
      ctx.clip();
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 40, y - h / 2, 80, h);
      ctx.restore();

      // brackets / infinity arrows
      this.bracket(p1, y, 'L', S.loC, color, S.lo === -Infinity);
      this.bracket(p2, y, 'R', S.hiC, color, S.hi === Infinity);

      // endpoint dots on the axis
      for (const [p, closed] of [[p1, S.loC], [p2, S.hiC]]) {
        if (p < 0 || p > this.W) continue;
        ctx.beginPath();
        ctx.arc(p, axis, 5, 0, Math.PI * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = closed ? color : C.hole;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // endpoint labels (A above its band, B below its band)
      const labelY = name === 'A' ? y - 28 : this.L.axis + 36;
      const labels = [];
      for (const [e, v, p] of [[P.lo, S.lo, p1], [P.hi, S.hi, p2]]) {
        if (e.inf) continue;
        const str = e.a === 0 ? dec(v) : `${Solver.linStr(e.a, e.b)} = ${dec(v)}`;
        ctx.font = `600 12px ${MONO}`;
        labels.push({ str, p, w: ctx.measureText(str).width });
      }
      if (labels.length === 2) {
        const [l1, l2] = labels;
        const need = (l1.w + l2.w) / 2 + 10;
        if (l2.p - l1.p < need) {
          const c = (l1.p + l2.p) / 2;
          l1.p = c - need / 2;
          l2.p = c + need / 2;
        }
      }
      for (const l of labels) {
        this.text(l.str, clamp(l.p, l.w / 2 + 4, this.W - l.w / 2 - 4), labelY, { color, size: 12, weight: 600, align: 'center', font: MONO, glow: name === 'B' ? 6 : 0 });
      }

      // set name at the far left, current interval near it
      this.text(name, 14, y, { color, size: 18, weight: 700, glow: 12 });
      if (name === 'A' || this.W > 700) {
        const nameY = name === 'A' ? y - 52 : y + 50;
        const valX = clamp((clamp(p1, 0, this.W) + clamp(p2, 0, this.W)) / 2, 80, this.W - 80);
        if (name === 'A') this.text(valueStr, valX, nameY, { color: rgba(color, 0.75), size: 12, weight: 500, align: 'center', font: MONO });
      }
    }

    bracket(x, y, side, closed, color, infinite) {
      const ctx = this.ctx;
      if (infinite) {
        const ax = side === 'L' ? 14 : this.W - 14;
        const s = side === 'L' ? -1 : 1;
        this.text(side === 'L' ? '−∞' : '+∞', ax - s * 4, y - 22, { color, size: 12, weight: 600, align: 'center', font: MONO });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax - s * 10, y - 6);
        ctx.lineTo(ax, y);
        ctx.lineTo(ax - s * 10, y + 6);
        ctx.stroke();
        return;
      }
      if (x < -10 || x > this.W + 10) return;
      const h = 40;
      const s = side === 'L' ? 1 : -1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      if (closed) {
        ctx.moveTo(x + s * 8, y - h / 2);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x + s * 8, y + h / 2);
      } else {
        ctx.moveTo(x + s * 9, y - h / 2);
        ctx.quadraticCurveTo(x - s * 7, y, x + s * 9, y + h / 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawStatus() {
      const ok = this.truth;
      const col = ok ? C.yes : C.no;
      const left = Math.max(8, this.padL - 30);
      const w = this.pill(left, 30, this.R.relSym, C.accent, { size: 13, align: 'left', fill: 0.1 });
      this.pill(left + w + 8, 30, t(ok ? 'scene.true' : 'scene.false'), col, { size: 13, align: 'left', fill: 0.18 });
      this.text(`m = ${dec(this.m)}`, this.W - 16, 30, { color: C.strong, size: 20, weight: 700, align: 'right', font: MONO, glow: 14 });

      const ft = typeof this.focus === 'number' ? this.tracks[this.focus] : null;
      if (ft && this.W > 560) {
        const holds = Solver.contains(ft.atom.set, this.m);
        this.pill(this.W / 2 + 40, 30, `${ft.atom.lines[0]}   ${holds ? '✓' : '✗'}`, ft.color, { size: 13 });
      }
    }

    drawMSection() {
      const ctx = this.ctx;
      const { divider, mHead, tracksTop, trackH, mAxis } = this.L;
      const x0 = this.padL;
      const x1 = this.W - this.mPadR;

      const dg = ctx.createLinearGradient(0, 0, this.W, 0);
      dg.addColorStop(0, rgba(C.axis, 0));
      dg.addColorStop(0.5, rgba(C.axis, 0.25));
      dg.addColorStop(1, rgba(C.axis, 0));
      ctx.fillStyle = dg;
      ctx.fillRect(0, divider, this.W, 1);

      const headX = x0 - 30 > 8 ? x0 - 30 : 8;
      const headW = this.text(t('scene.mAxis'), headX, mHead, { color: C.accent, size: 11, weight: 700 });
      if (this.W > 560) this.text(t('scene.legend'), headX + headW + 24, mHead, { color: C.dim, size: 11 });

      // tracks (revealed progressively)
      const items = [...this.tracks.map((t, i) => ({ ...t, i })), { answer: true, color: C.yes }];
      if (!this.revealed && this.revealT === 0) {
        const cy = tracksTop + (items.length * trackH) / 2 - 6;
        this.text(t('scene.hint1'), (x0 + x1) / 2, cy - 10, { color: rgba(C.hint, 0.7), size: 13, align: 'center' });
        this.text(t('scene.hint2'), (x0 + x1) / 2, cy + 12, { color: rgba(C.hint, 0.5), size: 12, align: 'center' });
      } else {
        items.forEach((it, k) => {
          const prog = clamp(this.revealT * (items.length + 1) - k, 0, 1);
          if (prog <= 0) return;
          const y = tracksTop + k * trackH;
          const isFocus = it.answer ? this.focus === 'answer' : this.focus === it.i;
          const barY = it.answer ? this.answerY() : y + 26;
          const set = it.answer ? this.R.solution : it.atom.set;
          const holds = Solver.contains(set, this.m);

          ctx.save();
          ctx.globalAlpha = prog * (this.focus === null || isFocus ? 1 : 0.45);

          if (isFocus) {
            ctx.fillStyle = rgba(it.color, 0.07);
            ctx.beginPath();
            ctx.roundRect(4, y + 2, this.W - 8, trackH - 4 + (it.answer ? 8 : 0), 8);
            ctx.fill();
          }

          let label;
          if (it.answer) {
            const AND = t('scene.AND');
            const conds = this.R.conditions.map((_, i) => circled(i)).join(` ${this.R.combine === 'and' ? AND : t('scene.OR')} `);
            const v = this.R.validity.length ? ` ${AND} V` : '';
            label = `${t('scene.answer')} = ${this.R.combine === 'or' && v ? '(' + conds + ')' : conds}${v}`;
          } else {
            const tag = it.atom.kind === 'validity' ? 'V' : circled(it.i - this.R.validity.length);
            label = `${tag}  ${it.atom.result || it.atom.lines[it.atom.lines.length - 1]}`;
          }
          this.text(label, x0 - 30 > 8 ? x0 - 30 : 8, y + 10, { color: it.color, size: 12, weight: 700, font: it.answer ? FONT : MONO, glow: 6 });

          // faint rail
          ctx.strokeStyle = C.faint;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, barY);
          ctx.lineTo(x1, barY);
          ctx.stroke();

          // the set, grown from the left by prog
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y, x0 + (x1 - x0 + 20) * prog, trackH + 20);
          ctx.clip();
          this.drawMSet(set, barY, it.color, it.answer ? 9 : 6);
          ctx.restore();

          // ✓ / ✗ at the right
          this.text(holds ? '✓' : '✗', this.W - this.mPadR / 2, barY, { color: holds ? C.yes : C.no, size: 16, weight: 700, align: 'center', glow: 8 });
          ctx.restore();
        });

        // critical values: dashed guides through all tracks
        if (this.revealT > 0.6) {
          ctx.save();
          ctx.globalAlpha = clamp((this.revealT - 0.6) / 0.4, 0, 1);
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = rgba(C.hint, 0.25);
          for (const c of this.R.criticals) {
            const px = this.mPx(c);
            if (px < x0 - 1 || px > x1 + 1) continue;
            ctx.beginPath();
            ctx.moveTo(px, tracksTop + 14);
            ctx.lineTo(px, mAxis);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // m axis with exploration paint
      ctx.strokeStyle = rgba(C.axis, 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 - 10, mAxis);
      ctx.lineTo(x1 + 14, mAxis);
      ctx.stroke();
      this.text('m', x1 + 22, mAxis, { color: C.dim, size: 13, font: MONO });

      this.drawPaint(mAxis);

      const step = niceStep(this.mMax - this.mMin, this.W < 520 ? 6 : 12);
      const critLabels = this.revealT > 0.6 ? this.R.criticals : [];
      for (let v = Math.ceil(this.mMin / step) * step; v <= this.mMax + 1e-9; v += step) {
        const px = this.mPx(v);
        ctx.strokeStyle = rgba(C.axis, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, mAxis - 4);
        ctx.lineTo(px, mAxis + 4);
        ctx.stroke();
        const near = critLabels.some((c) => Math.abs(this.mPx(c) - px) < 18);
        if (!near) this.text(dec(v), px, mAxis + 18, { color: C.dim, size: 11, align: 'center', font: MONO });
      }
      for (const c of critLabels) {
        const px = this.mPx(c);
        if (px < x0 - 1 || px > x1 + 1) continue;
        this.text(Solver.frac(c), px, mAxis + 18, { color: C.crit, size: 12, weight: 700, align: 'center', font: MONO, glow: 6 });
      }

      // the scanner: current m
      const mx = this.mPx(clamp(this.m, this.mMin, this.mMax));
      const col = this.truth ? C.yes : C.no;
      const sg = ctx.createLinearGradient(0, tracksTop, 0, mAxis);
      sg.addColorStop(0, rgba(col, 0));
      sg.addColorStop(1, rgba(col, 0.7));
      ctx.fillStyle = sg;
      ctx.fillRect(mx - 1, tracksTop, 2, mAxis - tracksTop);
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(mx, mAxis - 3);
      ctx.lineTo(mx - 8, mAxis - 15);
      ctx.lineTo(mx + 8, mAxis - 15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx, mAxis, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawMSet(S, y, color, thick) {
      const ctx = this.ctx;
      const x0 = this.padL;
      const x1 = this.W - this.mPadR;
      ctx.save();
      ctx.lineCap = 'butt';
      for (const iv of S) {
        const a = clamp(this.mPx(iv.lo), x0 - 6, x1 + 6);
        const b = clamp(this.mPx(iv.hi), x0 - 6, x1 + 6);
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(a, y);
        ctx.lineTo(Math.max(b, a + 0.01), y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        for (const [v, closed, px] of [[iv.lo, iv.loC, a], [iv.hi, iv.hiC, b]]) {
          if (!Number.isFinite(v)) {
            // arrow for infinity
            const s = v > 0 ? 1 : -1;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px - s * 7, y - thick);
            ctx.lineTo(px + s * 2, y);
            ctx.lineTo(px - s * 7, y + thick);
            ctx.stroke();
            continue;
          }
          ctx.beginPath();
          ctx.arc(px, y, thick * 0.5 + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = closed ? color : C.hole;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawPaint(y) {
      const ctx = this.ctx;
      const x0 = this.padL;
      const x1 = this.W - this.mPadR;
      ctx.save();
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      let i = 0;
      while (i < PAINT_N) {
        const v = this.paint[i];
        let j = i;
        while (j + 1 < PAINT_N && this.paint[j + 1] === v) j++;
        if (v !== 0) {
          const col = v > 0 ? C.yes : C.no;
          ctx.strokeStyle = rgba(col, v > 0 ? 0.85 : 0.55);
          ctx.shadowColor = col;
          ctx.shadowBlur = v > 0 ? 12 : 4;
          ctx.beginPath();
          ctx.moveTo(lerp(x0, x1, i / (PAINT_N - 1)), y);
          ctx.lineTo(lerp(x0, x1, j / (PAINT_N - 1)) + 0.5, y);
          ctx.stroke();
        }
        i = j + 1;
      }
      ctx.restore();
    }

    drawParticles() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = C.blend;
      for (const p of this.particles) {
        const t = p.age / p.life;
        ctx.globalAlpha = (1 - t) * (t < 0.1 ? t * 10 : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const r of this.rings) {
        const t = r.age / r.life;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(r.r0, r.r1, 1 - Math.pow(1 - t, 3)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function circled(i) {
    return '①②③④⑤⑥'[i] || String(i + 1);
  }

  window.Scene = Scene;
  window.SceneColors = C;
  window.circled = circled;
})();
