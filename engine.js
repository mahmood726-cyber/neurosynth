/*
 * NeuroSynth engine — pure statistical core for the thrombolysis (tPA/TNK)
 * net-clinical-benefit dashboard.
 *
 * Extracted VERBATIM from the dashboard's inline web-worker so the statistical
 * core is a single source of truth, importable under Node for testing and
 * shared by both the page's main thread and its computation worker
 * (the worker pulls these in via importScripts('engine.js')).
 *
 * Only PURE, deterministic functions live here. The stochastic Monte-Carlo
 * sampler (Box–Muller via Math.random) stays inline in the worker.
 *
 * Method: REML random-effects pooling of log odds ratios (50-iteration
 * Fisher-scoring update for tau^2), a proportional-odds ordinal shift of an
 * mRS distribution, baseline-odds -> absolute-risk conversion, and a simple
 * histogram binner. Faithful to the shipped app — no methodology changes;
 * the REML/ordinal/odds math was independently verified during the 2026-06
 * revival and left unchanged.
 */

// REML random-effects pooling of an effect column (kEff) with its SE column
// (kSe). Returns the pooled mean mu (on the log-OR scale), the pooling SE,
// tau^2, and per-study forest rows (point + 95% normal CI on the log scale).
function runREML(data, kEff, kSe) {
  if (!data || data.length === 0) return null;   // empty guard (revival)
  const y = data.map(d=>d[kEff]);
  const v = data.map(d=>d[kSe]**2);
  let tau2 = 0.02;
  for(let i=0; i<50; i++) {
    const w = v.map(x => 1/(x+tau2));
    const sw = w.reduce((a,b)=>a+b,0);
    const sw2 = w.reduce((a,b)=>a+b*b,0);
    const sw3 = w.reduce((a,b)=>a+b*b*b,0);
    const mu = w.reduce((a,b,j)=>a+b*y[j],0)/sw;
    let q = 0;
    y.forEach((val,j) => q += w[j]*w[j]*((val-mu)**2 - v[j] - tau2 + 1/sw));
    // REML expected (Fisher) information for tau2 = 0.5*tr(P^2), which is
    // always >= 0. The previous form 0.5*(sw2 - sw2^2/sw) dropped the sw3
    // term and went negative when weights are large (small variances),
    // so the 1e-12 floor made the Newton step explode (tau2 -> ~1e14 on
    // dat.bcg). Viechtbauer (2005) REML Fisher scoring.
    const info = 0.5*(sw2 - 2*sw3/sw + (sw2*sw2)/(sw*sw));
    const d = (0.5*q)/Math.max(info, 1e-12);
    tau2 = Math.max(0, tau2+d);
    if(Math.abs(d) < 1e-9) break;
  }
  const w = v.map(x => 1/(x+tau2));
  const sw = w.reduce((a,b)=>a+b,0);
  return {
    mu: w.reduce((a,b,j)=>a+b*y[j],0)/sw,
    se_pool: Math.sqrt(1/sw),
    tau2,
    forest: data.map((d,i)=>({ id: d.id, val: d[kEff], lo: d[kEff]-1.96*d[kSe], hi: d[kEff]+1.96*d[kSe] }))
  };
}

// Proportional-odds ordinal shift: given a 7-category (mRS 0..6) probability
// distribution and a common odds ratio, shift every cumulative-probability
// threshold by OR on the odds scale and re-difference to a new distribution.
function applyOrdinalShift(dist, OR) {
  let cum = [];
  let sum = 0;
  for(let p of dist) { sum+=p; cum.push(sum); }
  cum[cum.length-1] = 1.0;
  let newCum = cum.map(p => {
    if(p >= 1) return 1;
    const odds = p / (1-p);
    const newOdds = odds * OR;
    return newOdds / (1+newOdds);
  });
  let newDist = [];
  let prev = 0;
  for(let c of newCum) { newDist.push(c - prev); prev = c; }
  return newDist;
}

// Convert a baseline event probability + a log odds ratio into the ABSOLUTE
// risk difference (new probability minus baseline).
function oddsToAbs(base, logOR) {
  const o = base/(1-base);
  const n = o*Math.exp(logOR);
  return (n/(1+n)) - base;
}

// Equal-width histogram binner over a pre-sorted ascending array.
function buildHistogram(arr, bins) {
  const min = arr[0], max = arr[arr.length-1];
  const step = (max-min)/bins;
  const res = [];
  let current = min;
  let idx = 0;
  for(let i=0; i<bins; i++) {
    let count = 0;
    const next = current + step;
    while(idx < arr.length && arr[idx] < next) { count++; idx++; }
    res.push({ x: current + step/2, y: count });
    current = next;
  }
  return res;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runREML, applyOrdinalShift, oddsToAbs, buildHistogram };
}
