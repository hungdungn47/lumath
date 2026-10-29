// UI controller: problem builder, m slider / autoplay, walkthrough, step panel.
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const C = window.SceneColors;
  const { frac, epStr, opSym, setStr, ineqStr } = Solver;
  const t = I18n.t;

  const PRESETS = [
    { key: 'overlap', math: 'A = [m−1; m+3], B = (−1; 5)', A: ['[', 'm-1', 'm+3', ']'], B: ['(', '-1', '5', ')'], rel: 'overlap' },
    { key: 'disjoint', math: 'A = [m−1; m+3], B = (−1; 5)', A: ['[', 'm-1', 'm+3', ']'], B: ['(', '-1', '5', ')'], rel: 'disjoint' },
    { key: 'AsubB', math: 'A = [m−1; m+3], B = (−1; 5)', A: ['[', 'm-1', 'm+3', ']'], B: ['(', '-1', '5', ')'], rel: 'AsubB' },
    { key: 'BsubA', math: 'A = (m; m+5), B = [1; 3]', A: ['(', 'm', 'm+5', ')'], B: ['[', '1', '3', ']'], rel: 'BsubA' },
    { key: 'stretch', math: 'A = [m; 2m+1], B = (1; 4)', A: ['[', 'm', '2m+1', ']'], B: ['(', '1', '4', ')'], rel: 'overlap' },
    { key: 'inf', math: 'A = (m; m+1), B = (−∞; 3]', A: ['(', 'm', 'm+1', ')'], B: ['(', '-inf', '3', ']'], rel: 'disjoint' },
    { key: 'both', math: 'A = [m; m+2], B = [2m−1; 2m+3]', A: ['[', 'm', 'm+2', ']'], B: ['[', '2m-1', '2m+3', ']'], rel: 'AsubB' },
    { key: 'reversed', math: 'A = [−m; 3−m], B = [0; 5]', A: ['[', '-m', '3-m', ']'], B: ['[', '0', '5', ']'], rel: 'AsubB' },
  ];

  const state = {
    A: { lo: 'm-1', hi: 'm+3', loC: true, hiC: true },
    B: { lo: '-1', hi: '5', loC: false, hiC: false },
    rel: 'overlap',
  };

  const scene = new Scene($('#scene'));
  const slider = $('#mslider');
  let P = null;
  let R = null;
  let revealed = false;
  let playing = false;
  let phase = 0;
  let dragging = false;
  let tween = null;
  let walkToken = 0;

  // ---------- builder ----------

  const sel = $('#preset');
  function fillPresets() {
    const keep = sel.value;
    sel.innerHTML = '';
    PRESETS.forEach((p, i) => sel.add(new Option(`${t('preset.' + p.key)}: ${p.math}`, i)));
    sel.add(new Option(t('preset.custom'), 'custom'));
    if (keep) sel.value = keep;
  }
  fillPresets();

  function loadPreset(p) {
    for (const name of ['A', 'B']) {
      const [l, lo, hi, r] = p[name];
      Object.assign(state[name], { lo, hi, loC: l === '[', hiC: r === ']' });
    }
    state.rel = p.rel;
    syncInputs();
    rebuild();
  }

  function syncInputs() {
    for (const row of $$('.set-row')) {
      const S = state[row.dataset.set];
      row.querySelector('input[data-end=lo]').value = S.lo;
      row.querySelector('input[data-end=hi]').value = S.hi;
    }
    syncBrackets();
    for (const b of $$('#rels button')) b.classList.toggle('active', b.dataset.rel === state.rel);
  }

  function syncBrackets() {
    for (const row of $$('.set-row')) {
      const S = state[row.dataset.set];
      const lo = row.querySelector('.br[data-end=lo]');
      const hi = row.querySelector('.br[data-end=hi]');
      const infLo = /inf|∞/i.test(S.lo);
      const infHi = /inf|∞/i.test(S.hi);
      lo.textContent = S.loC && !infLo ? '[' : '(';
      hi.textContent = S.hiC && !infHi ? ']' : ')';
      lo.disabled = infLo;
      hi.disabled = infHi;
    }
  }

  let inputTimer = 0;
  for (const row of $$('.set-row')) {
    const S = state[row.dataset.set];
    for (const inp of row.querySelectorAll('input')) {
      inp.addEventListener('input', () => {
        S[inp.dataset.end] = inp.value;
        sel.value = 'custom';
        syncBrackets();
        clearTimeout(inputTimer);
        inputTimer = setTimeout(rebuild, 300);
      });
    }
    for (const br of row.querySelectorAll('.br')) {
      br.addEventListener('click', () => {
        const key = br.dataset.end === 'lo' ? 'loC' : 'hiC';
        S[key] = !S[key];
        sel.value = 'custom';
        br.classList.remove('flip');
        void br.offsetWidth;
        br.classList.add('flip');
        syncBrackets();
        rebuild();
      });
    }
  }

  for (const b of $$('#rels button')) {
    b.addEventListener('click', () => {
      state.rel = b.dataset.rel;
      syncInputs();
      rebuild();
    });
  }

  sel.addEventListener('change', () => {
    if (sel.value !== 'custom') loadPreset(PRESETS[+sel.value]);
  });

  // ---------- solve + render ----------

  function parseSet(name) {
    const S = state[name];
    const lo = Solver.parseEndpoint(S.lo);
    const hi = Solver.parseEndpoint(S.hi);
    if (lo.inf === 1) throw new Error(t('err.loInf', { name }));
    if (hi.inf === -1) throw new Error(t('err.hiInf', { name }));
    return { lo, hi, loC: S.loC && !lo.inf, hiC: S.hiC && !hi.inf };
  }

  function rebuild() {
    const err = $('#error');
    for (const i of $$('.set-row input')) i.classList.remove('bad');
    let newP;
    try {
      newP = { A: parseSet('A'), B: parseSet('B'), rel: state.rel };
    } catch (e) {
      err.textContent = e.message;
      for (const row of $$('.set-row')) {
        for (const inp of row.querySelectorAll('input')) {
          try {
            Solver.parseEndpoint(inp.value);
          } catch {
            inp.classList.add('bad');
          }
        }
      }
      return;
    }
    err.textContent = '';
    cancelWalk();
    if (tween) {
      tween.resolve();
      tween = null;
    }
    P = newP;
    R = Solver.solve(P);
    scene.setProblem(P, R);

    slider.min = scene.mMin;
    slider.max = scene.mMax;
    const start = scene.mMin + (scene.mMax - scene.mMin) * 0.15;
    scene.m = scene.targetM = Math.round(start * 10) / 10;
    slider.value = scene.m;
    scene.prevPaintM = null;

    revealed = false;
    $('#explain').hidden = true;
    $('#chips').innerHTML = '';
    $('#reveal').textContent = t('btn.reveal');
    renderStatement();
    renderSteps();
    renderAnswer();
  }

  const setText = (S) => `${S.loC ? '[' : '('}${epStr(S.lo)}; ${epStr(S.hi)}${S.hiC ? ']' : ')'}`;

  function renderStatement() {
    const el = $('#statement');
    el.innerHTML = t('stmt', {
      A: `<span class="A">A = ${setText(P.A)}</span>`,
      B: `<span class="B">B = ${setText(P.B)}</span>`,
      rel: `<span class="rel">${R.relSym}</span>`,
      words: R.relWords,
    });
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function stepHTML(atom, idx, color, tag, delay) {
    const lines = atom.lines.map((l, i) => {
      const last = i === atom.lines.length - 1;
      return `${i ? '<span class="arrow">⇔</span>' : ''}<span class="${last && i ? 'res' : ''}">${l}</span>`;
    });
    if (atom.flipped) lines.push(`<span class="note">${t('steps.flip')}</span>`);
    return `
      <div class="step" data-i="${idx}" style="--c:${color}; animation-delay:${delay}ms">
        <div class="step-head"><span class="tag">${tag}</span><span class="say">${atom.say}</span><span class="live"></span></div>
        ${atom.kind === 'condition' ? `<div class="compare">${atom.compare}</div>` : ''}
        <div class="math">${lines.join('')}</div>
        <div class="why">${atom.why}</div>
      </div>`;
  }

  function renderSteps() {
    const nV = R.validity.length;
    const parts = [];
    const need = t(R.combine === 'and' ? 'steps.needAll' : 'steps.needOne');
    parts.push(`<div class="intro">${t('steps.intro', { rel: R.relSym, words: R.relWords, need })}</div>`);
    scene.tracks.forEach((t, i) => {
      const tag = t.atom.kind === 'validity' ? 'V' : circled(i - nV);
      // CSS variables (not t.color) so the cards follow theme changes without re-rendering
      const color = t.atom.kind === 'validity' ? 'var(--validity)' : `var(--atom-${(i - nV) % 4})`;
      parts.push(stepHTML(t.atom, i, color, tag, i * 120));
    });

    const tags = R.conditions.map((_, i) => circled(i));
    const combineText = R.combine === 'and'
      ? t('steps.combineAnd', { tags: tags.join(` ${t('word.and')} `) })
      : t('steps.combineOr', { tags: tags.join(` ${t('word.or')} `) });
    const vText = nV ? `<div class="why">${t('steps.combineV')}</div>` : '';
    parts.push(`
      <div class="step combine" data-i="answer" style="animation-delay:${scene.tracks.length * 120}ms">
        <div class="step-head"><span class="tag">✓</span><span class="say">${t('steps.combine')}</span><span class="live"></span></div>
        <div class="why">${combineText}: <span style="font-family:var(--mono);color:var(--strong)">${setStr(R.condSet)}</span></div>
        ${vText}
      </div>`);
    $('#steps').innerHTML = parts.join('');

    for (const el of $$('.step')) {
      const key = el.dataset.i === 'answer' ? 'answer' : +el.dataset.i;
      el.addEventListener('mouseenter', () => {
        if (!walking()) scene.focus = key;
      });
      el.addEventListener('mouseleave', () => {
        if (!walking()) scene.focus = null;
      });
      el.addEventListener('click', () => {
        cancelWalk();
        stopPlay();
        scene.focus = key;
        const target = key === 'answer' ? insidePoint(R.solution) : scene.tracks[key].atom.bound;
        if (target !== undefined && target !== null) tweenTo(target, 0.9);
      });
    }
  }

  function renderAnswer() {
    const empty = !R.solution.length;
    let note = '';
    if (empty) note = t('answer.empty');
    else if (R.solution.some((iv) => iv.lo === iv.hi)) note = t('answer.point');
    $('#answer').innerHTML = `
      <div class="answer-label">${t('answer.label')}</div>
      <div class="answer-main">m ∈ ${setStr(R.solution)}</div>
      <div class="answer-sub">${ineqStr(R.solution)}</div>
      ${note ? `<div class="answer-note">${note}</div>` : ''}
      <div class="answer-note">${t('answer.track', { rel: R.relSym })}</div>`;
  }

  function renderChips() {
    const box = $('#chips');
    if (!R.criticals.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `<span class="lbl">${t('chips.label')}</span>` +
      R.criticals.map((c, i) => `<button class="chip" data-m="${c}" style="animation-delay:${i * 80}ms">m = ${frac(c)}</button>`).join('');
    for (const ch of box.querySelectorAll('.chip')) {
      ch.addEventListener('click', () => {
        cancelWalk();
        stopPlay();
        tweenTo(+ch.dataset.m, 0.8);
      });
    }
  }

  function insidePoint(S) {
    if (!S.length) return null;
    const iv = S[0];
    if (Number.isFinite(iv.lo) && Number.isFinite(iv.hi)) return (iv.lo + iv.hi) / 2;
    if (Number.isFinite(iv.lo)) return iv.lo + Math.max(1, (scene.mMax - scene.mMin) * 0.1);
    if (Number.isFinite(iv.hi)) return iv.hi - Math.max(1, (scene.mMax - scene.mMin) * 0.1);
    return 0;
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    scene.reveal(true);
    $('#explain').hidden = false;
    $('#reveal').textContent = t('btn.revealed');
    renderChips();
    renderSteps();
  }

  // ---------- motion ----------

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tweenTo(m, dur = 1) {
    if (tween) tween.resolve();
    return new Promise((resolve) => {
      tween = { from: scene.targetM, to: m, t: 0, dur, resolve };
    });
  }

  function stopPlay() {
    playing = false;
    $('#play').textContent = '▶';
    $('#play').classList.remove('playing');
  }

  function startPlay() {
    cancelWalk();
    if (tween) {
      tween.resolve();
      tween = null;
    }
    playing = true;
    const u = clamp01((scene.m - scene.mMin) / (scene.mMax - scene.mMin));
    phase = Math.acos(1 - 2 * u);
    $('#play').textContent = '❚❚';
    $('#play').classList.add('playing');
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  scene.onTick = (dt) => {
    if (!R) return;
    if (playing) {
      phase += dt * 0.55;
      const u = 0.5 - 0.5 * Math.cos(phase);
      scene.targetM = scene.mMin + (scene.mMax - scene.mMin) * u;
    } else if (tween) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur);
      scene.targetM = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) {
        scene.targetM = tween.to;
        const done = tween.resolve;
        tween = null;
        setTimeout(done, 200); // let the eased value land first
      }
    }
    if (!dragging) slider.value = scene.m;
    updateLive();
  };

  // live ✓/✗ badges on the steps
  let liveKey = '';
  function updateLive() {
    if (!revealed) return;
    const marks = scene.tracks.map((t) => Solver.contains(t.atom.set, scene.m));
    marks.push(Solver.contains(R.solution, scene.m));
    const key = marks.join() + scene.focus;
    if (key === liveKey) return;
    liveKey = key;
    for (const el of $$('.step')) {
      const i = el.dataset.i === 'answer' ? marks.length - 1 : +el.dataset.i;
      const live = el.querySelector('.live');
      live.textContent = t(marks[i] ? 'live.true' : 'live.false', { m: dec(scene.m) });
      live.className = 'live ' + (marks[i] ? 'ok' : 'bad');
      el.classList.toggle('focus', scene.focus === (el.dataset.i === 'answer' ? 'answer' : i));
    }
  }
  // refresh the m value in badges even when truth doesn't change
  setInterval(() => {
    liveKey = '';
  }, 120);

  const dec = (v) => String(Math.round(v * 100) / 100).replace('-', '−');

  slider.addEventListener('pointerdown', () => {
    dragging = true;
    cancelWalk();
    stopPlay();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  slider.addEventListener('input', () => {
    cancelWalk();
    stopPlay();
    if (tween) {
      tween.resolve();
      tween = null;
    }
    scene.targetM = +slider.value;
  });

  $('#play').addEventListener('click', () => (playing ? stopPlay() : startPlay()));
  $('#reveal').addEventListener('click', reveal);
  $('#walk').addEventListener('click', walkthrough);

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input:not([type=range]), select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? stopPlay() : startPlay();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      cancelWalk();
      stopPlay();
      const d = (e.shiftKey ? 1 : 0.1) * (e.code === 'ArrowLeft' ? -1 : 1);
      scene.targetM = Math.max(scene.mMin, Math.min(scene.mMax, Math.round((scene.targetM + d) * 100) / 100));
    } else if (e.key === 'r' || e.key === 'R') reveal();
  });

  // ---------- walkthrough ----------

  const walking = () => walkActive;
  let walkActive = false;

  function cancelWalk() {
    walkToken++;
    walkActive = false;
    $('#walk').textContent = t('btn.walk');
  }

  async function walkthrough() {
    if (walkActive) {
      cancelWalk();
      scene.focus = null;
      return;
    }
    cancelWalk();
    stopPlay();
    const tok = walkToken;
    walkActive = true;
    $('#walk').textContent = t('btn.stop');
    reveal();
    const alive = () => tok === walkToken;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const span = scene.mMax - scene.mMin;

    for (let i = 0; i < scene.tracks.length && alive(); i++) {
      const atom = scene.tracks[i].atom;
      scene.focus = i;
      const el = document.querySelector(`.step[data-i="${i}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (atom.bound === undefined) {
        await wait(1800);
        continue;
      }
      // start on the failing side, stop on the boundary, then step into the passing side
      const passDir = atom.dir === '<' || atom.dir === '<=' ? -1 : 1;
      const d = Math.max(1, span * 0.14);
      await tweenTo(clampM(atom.bound - passDir * d), 1.1);
      if (!alive()) break;
      await wait(450);
      await tweenTo(atom.bound, 1.0);
      if (!alive()) break;
      await wait(1300);
      await tweenTo(clampM(atom.bound + passDir * d), 1.0);
      if (!alive()) break;
      await wait(700);
    }
    if (!alive()) return;

    scene.focus = 'answer';
    const el = document.querySelector('.step[data-i="answer"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const target = insidePoint(R.solution);
    if (target !== null) await tweenTo(clampM(target), 1.2);
    if (!alive()) return;
    for (const iv of R.solution) {
      const a = Math.max(scene.mPx(iv.lo), scene.padL);
      const b = Math.min(scene.mPx(iv.hi), scene.W - scene.mPadR);
      for (let k = 0; k <= 4; k++) scene.burst(a + ((b - a) * k) / 4, scene.answerY(), C.yes, 26, 200);
    }
    await wait(2200);
    if (!alive()) return;
    scene.focus = null;
    cancelWalk();
  }

  const clampM = (m) => Math.max(scene.mMin, Math.min(scene.mMax, m));

  // ---------- language ----------

  const langBox = $('#lang');

  function syncLangSwitch() {
    langBox.dataset.lang = I18n.lang;
    for (const b of langBox.querySelectorAll('button')) b.classList.toggle('active', b.dataset.lang === I18n.lang);
  }

  for (const b of langBox.querySelectorAll('button')) b.addEventListener('click', () => I18n.setLang(b.dataset.lang));

  // Re-translate everything in place: m, reveal state and the animation keep going.
  I18n.onChange(() => {
    syncLangSwitch();
    I18n.applyStatic(document);
    fillPresets();
    $('#walk').textContent = t(walkActive ? 'btn.stop' : 'btn.walk');
    $('#reveal').textContent = t(revealed ? 'btn.revealed' : 'btn.reveal');
    if ($('#error').textContent) {
      rebuild(); // re-raises the parse error in the new language
    } else if (P) {
      R = Solver.solve(P);
      scene.setText(R);
      renderStatement();
      renderSteps();
      renderAnswer();
      if (revealed) renderChips();
      liveKey = '';
    }
    for (const el of $$('.builder, .explain .panel, .controls')) {
      el.classList.remove('relang');
      void el.offsetWidth;
      el.classList.add('relang');
    }
  });

  // ---------- go ----------

  syncLangSwitch();
  I18n.applyStatic(document);
  $('#walk').textContent = t('btn.walk');
  loadPreset(PRESETS[0]);
})();
