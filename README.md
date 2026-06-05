# NeuroSynth — Thrombolysis Net-Clinical-Benefit Explorer

A single-file, **fully offline** dashboard for acute-stroke thrombolysis
(alteplase / tenecteplase). It pools randomised-trial log odds ratios for
benefit and harm with a REML random-effects model, applies a log-linear
time-to-treatment decay, and runs a correlated Monte-Carlo simulation to show
the probability that treatment yields a positive net clinical benefit for a
given patient risk profile. Outputs include a forest plot, a Grotta ordinal
(mRS) shift bar, a 100-patient waffle, a bivariate density, a net-benefit
histogram, and NNT / NNH / tipping-point metrics.

**Live app:** open `index.html` (or the GitHub Pages link). No build step, no
network, no external CDN.

## Layout

```
index.html   single-file UI (loads engine.js; spins up a Blob worker that
             also importScripts engine.js)
engine.js    pure statistical core — runs in Node, the browser main thread,
             and the worker (single source of truth)
tests.js     Node test harness, 29 assertions
LICENSE      MIT
```

## Statistical core (`engine.js`)

| Function | What it does |
|---|---|
| `runREML(data, kEff, kSe)` | REML random-effects pooling of a log-OR column: 50-iteration Fisher-scoring `tau^2`, pooled `mu`, pooling SE, and per-study forest rows (95% normal CI on the log scale) |
| `applyOrdinalShift(dist, OR)` | proportional-odds cumulative shift of a 7-category mRS distribution by a common odds ratio |
| `oddsToAbs(base, logOR)` | baseline probability + log-OR → absolute risk difference |
| `buildHistogram(sortedArr, bins)` | equal-width histogram binner (upper edge exclusive) |

The stochastic Monte-Carlo sampler (Box–Muller via `Math.random`, the
time-decay penalty, and the correlated draw of benefit/harm) stays inline in
the worker — only deterministic, pure functions were extracted.

## Fixes applied during revival (2026-06-05)

- **Offline**: removed the Google Fonts `<link>` (the page now loads no
  external resource; system fonts fall back). Verified zero `http(s)://`
  references remain.
- **Single source of truth**: extracted the pure stat functions (`runREML`,
  `applyOrdinalShift`, `oddsToAbs`, `buildHistogram`) verbatim into `engine.js`
  and deleted the inline duplicates. Both the main thread (`<script
  src="engine.js">`) and the Blob worker (`importScripts`) now share one copy.
- **Empty guard**: `runREML([])` now returns `null` instead of producing
  `NaN`.
- Added `tests.js` (29 assertions, all passing) with hand-derived expectations.
- Added Pages scaffold (`.nojekyll`, this README, `.gitignore`); renamed
  `Neurosynth.html` → `index.html`.

The REML / ordinal-shift / odds-conversion math was independently reviewed and
found correct; it was left unchanged. The "Clinical Edition" label from the old
title is **not** retained as a claim — this is a research / teaching
visualisation, not a validated clinical tool.

## Tests

```
node tests.js
# 29 passed, 0 failed
```

Checks include a hand-computed `oddsToAbs` (base 0.30, OR 2 → +0.16154), an
`applyOrdinalShift` invariance/sum-to-1 set with a hand-derived OR=1.75 first
threshold (0.20729), a two-identical-study REML case (`tau^2=0`, `mu=0.5`,
`se=√(1/50)`), a `k=1` non-NaN guard, a heterogeneous bracketing case, the
empty-input guard, and an upper-edge-exclusive histogram.

## Caveats

REML can be unstable for very small *k*; the bundled set has 5 trials. The
time-decay curve is extrapolated from alteplase (Emberson et al. 2014) and
applied to TNK only as a plausibility assumption. Pooled estimates and
simulated NNT/NNH are **hypothesis-generating** and depend on user-set baseline
risk — treat them as a transparency aid for exploring trade-offs, not as a
decision rule. MIT licensed.
