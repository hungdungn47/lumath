// Full-screen animated backdrop: drifting stars, slow nebula glows, the odd shooting star.
(function () {
  'use strict';

  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let stars = [];
  let shooters = [];
  const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const blobs = [
    { hue: '99,102,241', x: 0.2, y: 0.25, r: 0.45, sp: 0.05 },
    { hue: '34,211,238', x: 0.85, y: 0.3, r: 0.35, sp: 0.07 },
    { hue: '192,132,252', x: 0.6, y: 0.85, r: 0.5, sp: 0.04 },
  ];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 7000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: Math.random() * 0.9 + 0.1,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / W;
    mouse.y = e.clientY / H;
  });
  resize();

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const time = t / 1000;
    mouse.sx += (mouse.x - mouse.sx) * 0.03;
    mouse.sy += (mouse.y - mouse.sy) * 0.03;

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);

    for (const b of blobs) {
      const bx = (b.x + Math.sin(time * b.sp) * 0.08) * W;
      const by = (b.y + Math.cos(time * b.sp * 1.3) * 0.06) * H;
      const r = b.r * Math.max(W, H);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, `rgba(${b.hue},0.13)`);
      g.addColorStop(1, `rgba(${b.hue},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const px = (mouse.sx - 0.5) * 30;
    const py = (mouse.sy - 0.5) * 30;
    for (const s of stars) {
      if (!reduceMotion) {
        s.x -= s.z * 6 * dt;
        if (s.x < -4) s.x = W + 4;
      }
      const a = 0.25 + 0.55 * s.z * (0.6 + 0.4 * Math.sin(time * 2 * s.z + s.tw));
      ctx.fillStyle = `rgba(226,232,240,${a})`;
      ctx.beginPath();
      ctx.arc(s.x - px * s.z, s.y - py * s.z, s.z * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduceMotion && Math.random() < dt * 0.25) {
      shooters.push({ x: Math.random() * W, y: Math.random() * H * 0.4, vx: -500 - Math.random() * 300, vy: 200 + Math.random() * 120, age: 0 });
    }
    for (const s of shooters) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = Math.max(0, 1 - s.age / 0.9);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      ctx.stroke();
    }
    shooters = shooters.filter((s) => s.age < 0.9);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
