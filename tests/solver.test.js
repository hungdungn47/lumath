// Run with: node tests/solver.test.js
const assert = require('assert');
const S = require('../js/solver.js');

function answer(A, B, rel) {
  const P = {
    A: { lo: S.parseEndpoint(A[1]), hi: S.parseEndpoint(A[2]), loC: A[0] === '[', hiC: A[3] === ']' },
    B: { lo: S.parseEndpoint(B[1]), hi: S.parseEndpoint(B[2]), loC: B[0] === '[', hiC: B[3] === ']' },
    rel,
  };
  return S.setStr(S.solve(P).solution);
}

const cases = [
  // A = [m-1; m+3], B = (-1; 5)
  [['[', 'm-1', 'm+3', ']'], ['(', '-1', '5', ')'], 'overlap', '(−4; 6)'],
  [['[', 'm-1', 'm+3', ']'], ['(', '-1', '5', ')'], 'disjoint', '(−∞; −4] ∪ [6; +∞)'],
  [['[', 'm-1', 'm+3', ']'], ['(', '-1', '5', ')'], 'AsubB', '(0; 2)'],
  [['[', 'm-1', 'm+3', ']'], ['(', '-1', '5', ')'], 'BsubA', '∅'],
  // closed/closed touching counts as overlap
  [['[', 'm-1', 'm+3', ']'], ['[', '-1', '5', ']'], 'overlap', '[−4; 6]'],
  [['[', 'm-1', 'm+3', ']'], ['[', '-1', '5', ']'], 'disjoint', '(−∞; −4) ∪ (6; +∞)'],
  // B inside A
  [['(', 'm', 'm+5', ')'], ['[', '1', '3', ']'], 'BsubA', '(−2; 1)'],
  // validity condition matters: A = [m; 2m+1] needs m >= -1
  [['[', 'm', '2m+1', ']'], ['(', '1', '4', ')'], 'overlap', '(0; 4)'],
  [['[', 'm', '2m+1', ']'], ['(', '1', '4', ')'], 'disjoint', '[−1; 0] ∪ [4; +∞)'],
  // infinite B
  [['(', 'm', 'm+1', ')'], ['(', '-inf', '3', ']'], 'disjoint', '[3; +∞)'],
  [['(', 'm', 'm+1', ')'], ['(', '-inf', '3', ']'], 'AsubB', '(−∞; 2]'],
  // negative coefficient flips the inequality
  [['[', '-m', '-m+2', ']'], ['[', '0', '1', ']'], 'AsubB', '∅'],
  [['[', '-m', '-m+2', ']'], ['[', '0', '4', ']'], 'AsubB', '[−2; 0]'],
  // fractions
  [['[', '2m', '2m+1', ']'], ['(', '0', '3', ')'], 'AsubB', '(0; 1)'],
  [['[', 'm/2', 'm/2+1', ']'], ['[', '0', '3', ']'], 'AsubB', '[0; 4]'],
];

let fails = 0;
for (const [A, B, rel, want] of cases) {
  const got = answer(A, B, rel);
  const label = `A=${A[0]}${A[1]}; ${A[2]}${A[3]}  B=${B[0]}${B[1]}; ${B[2]}${B[3]}  ${rel}`;
  if (got === want) console.log(`ok   ${label} → ${got}`);
  else {
    fails++;
    console.log(`FAIL ${label} → got ${got}, want ${want}`);
  }
}

assert.deepStrictEqual(S.parseEndpoint(' -2m + 1/2 '), { inf: 0, a: -2, b: 0.5 });
assert.deepStrictEqual(S.parseEndpoint('-∞'), { inf: -1 });
assert.throws(() => S.parseEndpoint('m+'));
assert.throws(() => S.parseEndpoint('x+1'));
assert.strictEqual(S.linStr(-1, 3), '−m + 3');
assert.strictEqual(S.frac(-3.5), '−7/2');

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log('\nall passing');
