// Interval-relation solver: turns "find m such that A ? B" into linear
// inequalities in m and solves them exactly. Works in the browser and in node.
(function (root) {
  'use strict';

  const EPS = 1e-9;
  // Translated text when the i18n layer is loaded; otherwise the raw key.
  const T = (k, p) => (typeof I18n !== 'undefined' ? I18n.t(k, p) : k);
  const snap = (x) => (Number.isFinite(x) ? Math.round(x * 1e9) / 1e9 : x);

  // ---------- number formatting ----------

  function frac(x) {
    if (x === Infinity) return '+∞';
    if (x === -Infinity) return '−∞';
    x = snap(x);
    for (let d = 1; d <= 24; d++) {
      const n = x * d;
      if (Math.abs(n - Math.round(n)) < 1e-7) {
        const ni = Math.round(n);
        if (ni === 0) return '0';
        const body = d === 1 ? String(Math.abs(ni)) : `${Math.abs(ni)}/${d}`;
        return (ni < 0 ? '−' : '') + body;
      }
    }
    return (x < 0 ? '−' : '') + String(+Math.abs(x).toFixed(3));
  }

  function linStr(a, b) {
    a = snap(a);
    b = snap(b);
    let s = '';
    if (a !== 0) {
      const fa = frac(a);
      const coef = a === 1 ? '' : a === -1 ? '−' : fa.includes('/') ? `(${fa})` : fa;
      s = coef + 'm';
    }
    if (b !== 0 || a === 0) {
      if (s) s += b < 0 ? ' − ' + frac(-b) : ' + ' + frac(b);
      else s = frac(b);
    }
    return s;
  }

  const epStr = (e) => (e.inf ? (e.inf > 0 ? '+∞' : '−∞') : linStr(e.a, e.b));
  const opSym = (op) => ({ '<': '<', '<=': '≤', '>': '>', '>=': '≥' })[op];

  // ---------- parsing ----------

  function parseNum(t) {
    t = t.replace(/[()]/g, '');
    if (t === '') return 1;
    let v;
    if (t.includes('/')) {
      const [p, q] = t.split('/');
      v = Number(p) / Number(q);
    } else v = Number(t);
    if (!Number.isFinite(v)) throw new Error(T('err.read', { s: t }));
    return v;
  }

  // Accepts things like "m-1", "2m+1", "-m + 3", "m/2", "(1/2)m", "5", "-inf", "+∞".
  function parseEndpoint(str) {
    let s = String(str)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[−–]/g, '-')
      .replace(/,/g, '.')
      .replace(/infinity|∞/g, 'inf')
      .replace(/\*/g, '');
    if (s === '') throw new Error(T('err.empty'));
    if (s === 'inf' || s === '+inf') return { inf: 1 };
    if (s === '-inf') return { inf: -1 };
    if (s.includes('inf')) throw new Error(T('err.inf'));

    const terms = s.match(/[+-]?[^+-]+/g);
    if (!terms || terms.join('') !== s) throw new Error(T('err.read', { s: str }));
    let a = 0;
    let b = 0;
    for (const term of terms) {
      const sign = term[0] === '-' ? -1 : 1;
      const t = term.replace(/^[+-]/, '');
      if (t.includes('m')) {
        const [before, after] = t.split('m');
        if (t.split('m').length > 2) throw new Error(T('err.read', { s: str }));
        let c = parseNum(before);
        if (after) {
          if (!after.startsWith('/')) throw new Error(T('err.read', { s: str }));
          c /= parseNum(after.slice(1));
        }
        a += sign * c;
      } else {
        b += sign * parseNum(t);
      }
    }
    return { inf: 0, a: snap(a), b: snap(b) };
  }

  const evalEp = (e, m) => (e.inf ? e.inf * Infinity : e.a * m + e.b);

  // ---------- interval sets in m ----------
  // A set is a sorted array of {lo, hi, loC, hiC}; lo/hi may be ±Infinity.

  const ALL = () => [{ lo: -Infinity, hi: Infinity, loC: false, hiC: false }];
  const EMPTY = () => [];

  const valid = (iv) => iv.lo < iv.hi || (iv.lo === iv.hi && iv.loC && iv.hiC);

  function intersect(S, T) {
    const out = [];
    for (const s of S) {
      for (const t of T) {
        let lo, loC, hi, hiC;
        if (s.lo > t.lo) [lo, loC] = [s.lo, s.loC];
        else if (t.lo > s.lo) [lo, loC] = [t.lo, t.loC];
        else [lo, loC] = [s.lo, s.loC && t.loC];
        if (s.hi < t.hi) [hi, hiC] = [s.hi, s.hiC];
        else if (t.hi < s.hi) [hi, hiC] = [t.hi, t.hiC];
        else [hi, hiC] = [s.hi, s.hiC && t.hiC];
        const iv = { lo, hi, loC, hiC };
        if (valid(iv)) out.push(iv);
      }
    }
    return union(out, []);
  }

  function union(S, T) {
    const all = [...S, ...T].map((iv) => ({ ...iv })).sort((p, q) => p.lo - q.lo || (q.loC ? 1 : 0) - (p.loC ? 1 : 0));
    const out = [];
    for (const iv of all) {
      const cur = out[out.length - 1];
      if (cur && (cur.hi > iv.lo || (cur.hi === iv.lo && (cur.hiC || iv.loC)))) {
        if (iv.hi > cur.hi) [cur.hi, cur.hiC] = [iv.hi, iv.hiC];
        else if (iv.hi === cur.hi) cur.hiC = cur.hiC || iv.hiC;
      } else out.push(iv);
    }
    return out;
  }

  function contains(S, m) {
    const near = (x, y) => Math.abs(x - y) < 1e-6;
    return S.some((iv) => {
      const okLo = near(m, iv.lo) ? iv.loC : m > iv.lo;
      const okHi = near(m, iv.hi) ? iv.hiC : m < iv.hi;
      return okLo && okHi;
    });
  }

  function setStr(S) {
    if (!S.length) return '∅';
    return S.map((iv) => {
      if (iv.lo === -Infinity && iv.hi === Infinity) return 'ℝ';
      if (iv.lo === iv.hi) return `{${frac(iv.lo)}}`;
      return `${iv.loC ? '[' : '('}${frac(iv.lo)}; ${frac(iv.hi)}${iv.hiC ? ']' : ')'}`;
    }).join(' ∪ ');
  }

  function ineqStr(S) {
    if (!S.length) return T('ineq.none');
    return S.map((iv) => {
      if (iv.lo === -Infinity && iv.hi === Infinity) return T('ineq.all');
      if (iv.lo === iv.hi) return `m = ${frac(iv.lo)}`;
      if (iv.lo === -Infinity) return `m ${iv.hiC ? '≤' : '<'} ${frac(iv.hi)}`;
      if (iv.hi === Infinity) return `m ${iv.loC ? '≥' : '>'} ${frac(iv.lo)}`;
      return `${frac(iv.lo)} ${iv.loC ? '≤' : '<'} m ${iv.hiC ? '≤' : '<'} ${frac(iv.hi)}`;
    }).join(`  ${T('ineq.or')}  `);
  }

  // ---------- one comparison "X op Y" between two endpoints ----------

  function solveAtom(X, op, Y) {
    const atom = { X, Y, op, lines: [`${epStr(X)} ${opSym(op)} ${epStr(Y)}`] };
    if (X.inf || Y.inf) {
      let v;
      if (X.inf === -1) v = Y.inf === -1 ? op === '<=' : true;
      else if (Y.inf === 1) v = X.inf === 1 ? op === '<=' : true;
      else v = false;
      atom.constant = v;
      atom.set = v ? ALL() : EMPTY();
      atom.lines.push(T(v ? 'atom.infTrue' : 'atom.infFalse'));
      return atom;
    }
    const a = snap(X.a - Y.a);
    const b = snap(X.b - Y.b);
    if (Math.abs(a) < EPS) {
      const v = op === '<' ? b < -EPS : b <= EPS;
      atom.constant = v;
      atom.set = v ? ALL() : EMPTY();
      atom.lines.push(T(v ? 'atom.cancelTrue' : 'atom.cancelFalse', { expr: `${frac(b)} ${opSym(op)} 0` }));
      return atom;
    }
    const r = snap(-b / a);
    atom.bound = r;
    if (Math.abs(a - 1) > EPS || Math.abs(X.a - 1) > EPS || Y.a !== 0) {
      atom.lines.push(`${linStr(a, 0)} ${opSym(op)} ${frac(-b)}`);
    }
    if (a > 0) {
      atom.dir = op;
      atom.set = [{ lo: -Infinity, hi: r, loC: false, hiC: op === '<=' }];
    } else {
      atom.dir = op === '<' ? '>' : '>=';
      atom.flipped = true;
      atom.set = [{ lo: r, hi: Infinity, loC: op === '<=', hiC: false }];
    }
    atom.result = `m ${opSym(atom.dir)} ${frac(r)}`;
    if (atom.lines[atom.lines.length - 1] !== atom.result) atom.lines.push(atom.result);
    return atom;
  }

  // ---------- relations ----------

  const RELATIONS = {
    overlap: { sym: 'A ∩ B ≠ ∅', combine: 'and' },
    disjoint: { sym: 'A ∩ B = ∅', combine: 'or' },
    AsubB: { sym: 'A ⊂ B', combine: 'and' },
    BsubA: { sym: 'B ⊂ A', combine: 'and' },
  };

  const endName = (ref) => T(`end.${ref.slice(2)}`, { name: ref[0] });

  // Overlap: X's left end must come before Y's right end.
  function overlapSpec(P, X, Y) {
    const le = P[X].loC && P[Y].hiC;
    return {
      refs: [`${X}.lo`, `${Y}.hi`],
      op: le ? '<=' : '<',
      say: T('overlap.say', { X, Y }),
      why: T(le ? 'overlap.whyLe' : 'overlap.whyLt'),
    };
  }

  // Disjoint: `first` ends before `second` starts.
  function disjointSpec(P, first, second, sayKey) {
    const lt = P[first].hiC && P[second].loC;
    return {
      refs: [`${first}.hi`, `${second}.lo`],
      op: lt ? '<' : '<=',
      say: T(sayKey),
      why: T(lt ? 'disjoint.whyLt' : 'disjoint.whyLe'),
    };
  }

  // Subset inner ⊂ outer, at one end ('lo' or 'hi').
  function subSpec(P, inner, outer, end) {
    const closedKey = end === 'lo' ? 'loC' : 'hiC';
    const le = P[outer][closedKey] || !P[inner][closedKey];
    const side = end === 'lo' ? 'Lo' : 'Hi';
    return {
      refs: end === 'lo' ? [`${outer}.lo`, `${inner}.lo`] : [`${inner}.hi`, `${outer}.hi`],
      op: le ? '<=' : '<',
      say: T(`sub.say${side}`, { inner, outer }),
      why: T(`sub.why${le ? 'Le' : 'Lt'}${side}`, { inner, outer }),
    };
  }

  function conditionSpecs(P) {
    switch (P.rel) {
      case 'overlap':
        return [overlapSpec(P, 'A', 'B'), overlapSpec(P, 'B', 'A')];
      case 'disjoint':
        return [disjointSpec(P, 'A', 'B', 'disjoint.sayLeft'), disjointSpec(P, 'B', 'A', 'disjoint.sayRight')];
      case 'AsubB':
        return [subSpec(P, 'A', 'B', 'lo'), subSpec(P, 'A', 'B', 'hi')];
      case 'BsubA':
        return [subSpec(P, 'B', 'A', 'lo'), subSpec(P, 'B', 'A', 'hi')];
      default:
        throw new Error('Unknown relation ' + P.rel);
    }
  }

  // P = { A: {lo, hi, loC, hiC}, B: {...}, rel } where lo/hi are parsed endpoints.
  function solve(P) {
    const get = (ref) => P[ref[0]][ref.slice(2)];

    const validity = [];
    for (const name of ['A', 'B']) {
      const S = P[name];
      const op = S.loC && S.hiC ? '<=' : '<';
      const atom = solveAtom(S.lo, op, S.hi);
      atom.refs = [`${name}.lo`, `${name}.hi`];
      atom.kind = 'validity';
      atom.say = T('valid.say', { name });
      atom.why = T(op === '<=' ? 'valid.whyLe' : 'valid.whyLt', { name });
      if (atom.constant === true) continue; // nothing to say
      validity.push(atom);
    }

    const rel = RELATIONS[P.rel];
    const conditions = conditionSpecs(P).map((spec) => {
      const atom = solveAtom(get(spec.refs[0]), spec.op, get(spec.refs[1]));
      return Object.assign(atom, spec, {
        kind: 'condition',
        compare: `${endName(spec.refs[0])} ${opSym(spec.op)} ${endName(spec.refs[1])}`,
      });
    });

    const condSet = rel.combine === 'and'
      ? conditions.reduce((acc, c) => intersect(acc, c.set), ALL())
      : conditions.reduce((acc, c) => union(acc, c.set), EMPTY());
    const solution = validity.reduce((acc, v) => intersect(acc, v.set), condSet);

    const crit = new Set();
    for (const at of [...validity, ...conditions]) if (at.bound !== undefined) crit.add(at.bound);
    for (const iv of solution) for (const x of [iv.lo, iv.hi]) if (Number.isFinite(x)) crit.add(x);
    const criticals = [...crit].sort((p, q) => p - q);

    return { rel: P.rel, relSym: rel.sym, relWords: T(`rel.${P.rel}`), combine: rel.combine, validity, conditions, condSet, solution, criticals };
  }

  const api = { parseEndpoint, evalEp, solve, solveAtom, contains, intersect, union, setStr, ineqStr, frac, linStr, epStr, opSym, RELATIONS, ALL, EMPTY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Solver = api;
})(this);
