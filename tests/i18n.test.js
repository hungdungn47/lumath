// Run with: node tests/i18n.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.localStorage = { getItem: () => null, setItem: () => {} };
require('../js/i18n.js');
const S = require('../js/solver.js');
const { I18n } = globalThis;

// 1. Both dictionaries define exactly the same keys.
function collectAll() {
  // read the dictionaries straight from the source
  const src = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  const block = (name) => src.slice(src.indexOf(`    ${name}: {`), src.indexOf('\n    },', src.indexOf(`    ${name}: {`)));
  const keys = (b) => [...b.matchAll(/^\s+'?([\w.]+)'?:/gm)].map((m) => m[1]).filter((k) => k !== 'en' && k !== 'vi');
  return { en: keys(block('en')), vi: keys(block('vi')) };
}
const { en, vi } = collectAll();
const missingVi = en.filter((k) => !vi.includes(k));
const missingEn = vi.filter((k) => !en.includes(k));
assert.deepStrictEqual(missingVi, [], 'keys missing in vi: ' + missingVi);
assert.deepStrictEqual(missingEn, [], 'keys missing in en: ' + missingEn);
console.log(`ok   en and vi both have ${en.length} keys`);

// 2. Every literal key referenced in code / HTML exists.
const used = new Set();
for (const f of ['js/app.js', 'js/scene.js', 'js/solver.js', 'index.html']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  for (const m of src.matchAll(/\b[tT]\(\s*'([\w.]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-html|-title|-aria)?="([\w.]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\?\s*'([\w.]+\.\w+)'\s*:\s*'([\w.]+\.\w+)'/g)) used.add(m[1]).add(m[2]);
}
// keys built at runtime: 'preset.' + key, `rel.${rel}`, `end.${lo|hi}`, `sub.say${side}` ...
for (const k of ['overlap', 'disjoint', 'AsubB', 'BsubA', 'stretch', 'inf', 'both', 'reversed']) used.add('preset.' + k);
for (const k of ['overlap', 'disjoint', 'AsubB', 'BsubA']) used.add('rel.' + k);
for (const k of ['end.lo', 'end.hi', 'sub.sayLo', 'sub.sayHi', 'sub.whyLeLo', 'sub.whyLeHi', 'sub.whyLtLo', 'sub.whyLtHi']) used.add(k);
const unknown = [...used].filter((k) => !k.endsWith('.') && !en.includes(k));
assert.deepStrictEqual(unknown, [], 'unknown keys used: ' + unknown);
console.log(`ok   all ${used.size} literal keys used in code exist`);

// 3. Solver text comes out in Vietnamese, math unchanged.
const P = {
  A: { lo: S.parseEndpoint('m-1'), hi: S.parseEndpoint('m+3'), loC: true, hiC: true },
  B: { lo: S.parseEndpoint('-1'), hi: S.parseEndpoint('5'), loC: false, hiC: false },
  rel: 'overlap',
};
I18n.setLang('vi');
let R = S.solve(P);
assert.strictEqual(S.setStr(R.solution), '(−4; 6)');
assert.strictEqual(R.relWords, 'A và B có phần chung');
assert.strictEqual(R.conditions[0].say, 'A phải bắt đầu trước khi B kết thúc');
assert.strictEqual(R.conditions[0].compare, 'đầu mút trái của A < đầu mút phải của B');
assert.throws(() => S.parseEndpoint('x+1'), /Không đọc được/);
assert.strictEqual(S.ineqStr(S.solve({ ...P, rel: 'disjoint' }).solution), 'm ≤ −4  hoặc  m ≥ 6');
console.log('ok   solver speaks Vietnamese:', R.conditions[0].say);

I18n.setLang('en');
R = S.solve(P);
assert.strictEqual(R.conditions[0].say, 'A must start before B ends');
const sub = S.solve({ ...P, rel: 'AsubB' });
assert.strictEqual(sub.conditions[0].why, '“<” because B drops its left end but A keeps it, so A must start strictly inside B.');
console.log('ok   and back to English:', R.conditions[0].say);

console.log('\nall passing');
