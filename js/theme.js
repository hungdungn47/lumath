// Theme mode: 'system' (follow the OS), 'light' or 'dark'. Loaded in <head> so the
// right palette is on <html data-theme> before first paint.
(function () {
  'use strict';

  const KEY = 'lumath-theme';
  const MODES = ['system', 'light', 'dark'];
  const html = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];

  let mode = 'system';
  try {
    const saved = localStorage.getItem(KEY);
    if (MODES.includes(saved)) mode = saved;
  } catch {}

  const resolve = () => (mode === 'system' ? (mq.matches ? 'light' : 'dark') : mode);
  let resolved = resolve();
  html.dataset.theme = resolved;

  function apply() {
    const next = resolve();
    html.dataset.theme = next;
    syncSwitch();
    if (next === resolved) return;
    resolved = next;
    listeners.forEach((fn) => fn(next));
  }

  // Circular reveal from the clicked button where View Transitions are supported.
  function set(next, evt) {
    if (!MODES.includes(next)) return;
    mode = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    syncSwitch();
    const willChange = resolve() !== resolved;
    if (!willChange || !document.startViewTransition || reduceMotion.matches) return apply();
    const x = evt ? evt.clientX : window.innerWidth;
    const y = evt ? evt.clientY : 0;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }

  mq.addEventListener('change', () => {
    if (mode === 'system') apply();
  });

  function syncSwitch() {
    const box = document.getElementById('theme');
    if (!box) return;
    box.dataset.mode = mode;
    for (const b of box.querySelectorAll('button')) {
      b.classList.toggle('active', b.dataset.mode === mode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('theme');
    if (!box) return;
    for (const b of box.querySelectorAll('button')) b.addEventListener('click', (e) => set(b.dataset.mode, e));
    syncSwitch();
  });

  window.Theme = {
    set,
    onChange: (fn) => listeners.push(fn),
    get mode() {
      return mode;
    },
    get resolved() {
      return resolved;
    },
  };
})();
