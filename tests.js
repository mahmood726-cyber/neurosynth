/*
 * Node tests for the NeuroSynth engine. Run: node tests.js
 *
 * Every expected value is hand-derived independently below — these are NOT a
 * re-run of the engine's own arithmetic.
 */
const { runREML, applyOrdinalShift, oddsToAbs, buildHistogram } = require('./engine.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log(' FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
function close(a, b, tol) { return Math.abs(a - b) < (tol || 1e-6); }
function finite(x) { return typeof x === 'number' && Number.isFinite(x); }

// ----------------------------------------------------------------------------
// oddsToAbs(base, logOR): absolute risk difference from baseline prob + logOR.
//   base=0.30, OR=2 (logOR=ln2):  odds = 0.3/0.7 = 0.4285714
//   new odds = 0.8571429 -> p = 0.8571429/1.8571429 = 0.4615385
//   diff = 0.4615385 - 0.30 = 0.1615385
// ----------------------------------------------------------------------------
ok('oddsToAbs base=0.3 OR=2 -> +0.1615385',
   close(oddsToAbs(0.30, Math.log(2)), 0.1615385, 1e-6),
   'got ' + oddsToAbs(0.30, Math.log(2)));
// logOR = 0 means OR=1, no change -> diff exactly 0
ok('oddsToAbs logOR=0 -> 0', close(oddsToAbs(0.30, 0), 0, 1e-12));
// protective logOR (OR<1) -> negative risk difference
//   base=0.5, OR=0.5: odds=1, new=0.5, p=1/3=0.333333, diff=-0.166667
ok('oddsToAbs base=0.5 OR=0.5 -> -0.1666667',
   close(oddsToAbs(0.50, Math.log(0.5)), -0.1666667, 1e-6),
   'got ' + oddsToAbs(0.50, Math.log(0.5)));

// ----------------------------------------------------------------------------
// applyOrdinalShift(dist, OR): proportional-odds cumulative shift.
//   OR = 1 leaves the distribution unchanged.
// ----------------------------------------------------------------------------
const baseDist = [0.13, 0.18, 0.16, 0.14, 0.13, 0.10, 0.16];
const sameDist = applyOrdinalShift(baseDist, 1);
ok('ordinalShift OR=1 unchanged (cat 0)', close(sameDist[0], 0.13, 1e-9), 'got ' + sameDist[0]);
ok('ordinalShift OR=1 unchanged (cat 3)', close(sameDist[3], 0.14, 1e-9), 'got ' + sameDist[3]);
ok('ordinalShift OR=1 sums to 1', close(sameDist.reduce((a,b)=>a+b,0), 1, 1e-9));
// Any OR must preserve total probability (=1) and a favourable OR>1 shifts mass
// toward the good (low-mRS) categories: cat 0 must increase vs baseline.
const shifted = applyOrdinalShift(baseDist, 1.75);
ok('ordinalShift OR=1.75 sums to 1', close(shifted.reduce((a,b)=>a+b,0), 1, 1e-9));
ok('ordinalShift OR=1.75 increases good outcome (cat 0)', shifted[0] > baseDist[0],
   'got ' + shifted[0]);
// Hand check of the first cumulative threshold under OR=1.75:
//   cum0 = 0.13 -> odds = 0.13/0.87 = 0.1494253
//   new odds = 0.1494253*1.75 = 0.2614943 -> p = 0.2614943/1.2614943 = 0.2073...
//   so new cat0 prob = 0.207290 (first bin == first cumulative)
ok('ordinalShift OR=1.75 cat0 = 0.207290',
   close(shifted[0], 0.207290, 1e-5), 'got ' + shifted[0]);

// ----------------------------------------------------------------------------
// runREML: REML random-effects pooling on log-OR scale.
// Two IDENTICAL studies => zero heterogeneity is forced (all residuals 0):
//   y=0.5, se=0.2 -> v=0.04, w=1/0.04=25 each, sum w = 50
//   mu = 0.5, tau2 = 0, se_pool = sqrt(1/50) = sqrt(0.02) = 0.1414214
// ----------------------------------------------------------------------------
const twoSame = runREML(
  [{id:'A', e:0.5, s:0.2}, {id:'B', e:0.5, s:0.2}], 'e', 's');
ok('REML identical: mu = 0.5', close(twoSame.mu, 0.5, 1e-9), 'got ' + twoSame.mu);
ok('REML identical: tau2 = 0', close(twoSame.tau2, 0, 1e-12), 'got ' + twoSame.tau2);
ok('REML identical: se_pool = sqrt(1/50)', close(twoSame.se_pool, Math.sqrt(1/50), 1e-9),
   'got ' + twoSame.se_pool);
ok('REML identical: 2 forest rows', twoSame.forest.length === 2);
// forest CI for study A: 0.5 +/- 1.96*0.2 = [0.108, 0.892]
ok('REML forest CI lo = 0.108', close(twoSame.forest[0].lo, 0.108, 1e-9), 'got ' + twoSame.forest[0].lo);
ok('REML forest CI hi = 0.892', close(twoSame.forest[0].hi, 0.892, 1e-9), 'got ' + twoSame.forest[0].hi);

// k = 1 must NOT produce NaN. Single study y=0.3, se=0.2 -> v=0.04.
//   For one study mu == y == 0.3, and the REML score is identically 0 so tau2
//   stays at its 0.02 initialisation; se_pool = sqrt(v + tau2) = sqrt(0.06).
const one = runREML([{id:'X', e:0.3, s:0.2}], 'e', 's');
ok('REML k=1: mu finite & = 0.3', finite(one.mu) && close(one.mu, 0.3, 1e-9), 'got ' + one.mu);
ok('REML k=1: se_pool finite = sqrt(0.06)', finite(one.se_pool) && close(one.se_pool, Math.sqrt(0.06), 1e-9),
   'got ' + one.se_pool);
ok('REML k=1: tau2 finite (no NaN)', finite(one.tau2), 'got ' + one.tau2);

// Heterogeneous two-study case: results must be finite and bracketed by inputs.
//   y1=0.6 (se 0.1), y2=0.2 (se 0.3). The pooled mu must lie between 0.2 and
//   0.6 and be pulled toward the more precise study (0.6).
const het = runREML([{id:'P', e:0.6, s:0.1}, {id:'Q', e:0.2, s:0.3}], 'e', 's');
ok('REML het: mu finite', finite(het.mu) && finite(het.se_pool) && finite(het.tau2), 'got ' + het.mu);
ok('REML het: mu within (0.2, 0.6)', het.mu > 0.2 && het.mu < 0.6, 'got ' + het.mu);
ok('REML het: mu closer to precise study (>0.4)', het.mu > 0.4, 'got ' + het.mu);
ok('REML het: tau2 >= 0', het.tau2 >= 0, 'got ' + het.tau2);

// Empty guard.
ok('REML empty -> null', runREML([], 'e', 's') === null);

// ----------------------------------------------------------------------------
// buildHistogram(sortedArr, bins): equal-width binning, upper-edge exclusive.
//   arr = [-1, 0, 0, 1, 2], bins=4: min=-1, max=2, step=0.75
//   bin centres: -0.625, 0.125, 0.875, 1.625
//   counts: -1 in bin0; 0,0 in bin1; 1 in bin2; 2 excluded (== max) -> bin3 = 0
// ----------------------------------------------------------------------------
const hist = buildHistogram([-1, 0, 0, 1, 2], 4);
ok('hist: 4 bins', hist.length === 4);
ok('hist: bin0 count 1 @ -0.625', hist[0].y === 1 && close(hist[0].x, -0.625, 1e-9),
   'got ' + JSON.stringify(hist[0]));
ok('hist: bin1 count 2 @ 0.125', hist[1].y === 2 && close(hist[1].x, 0.125, 1e-9),
   'got ' + JSON.stringify(hist[1]));
ok('hist: bin2 count 1 @ 0.875', hist[2].y === 1 && close(hist[2].x, 0.875, 1e-9),
   'got ' + JSON.stringify(hist[2]));
ok('hist: bin3 count 0 (max excluded) @ 1.625', hist[3].y === 0 && close(hist[3].x, 1.625, 1e-9),
   'got ' + JSON.stringify(hist[3]));
ok('hist: counted points = 4 (upper edge exclusive)',
   hist.reduce((a,b)=>a+b.y,0) === 4);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
