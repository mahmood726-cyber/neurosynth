# E156-PROTOCOL — NeuroSynth (Thrombolysis Net-Benefit Explorer)

- **Project:** neurosynth (GitHub repo `neurosynth`, user `mahmood726-cyber`)
- **Revived:** 2026-06-05 (from a single-file `Neurosynth.html` dump)
- **Type:** single-file offline browser tool + Node-testable engine
- **Dashboard:** GitHub Pages (`index.html`)

## What changed in the revival

- Made **fully offline**: removed the Google Fonts CDN `<link>`; the app now
  loads no external resource (system fonts fall back). Zero `http(s)://`
  references remain.
- Extracted the pure statistical core (`runREML`, `applyOrdinalShift`,
  `oddsToAbs`, `buildHistogram`) into `engine.js` as a single source of truth;
  deleted the inline duplicates. The main thread loads it via
  `<script src="engine.js">` and the Blob worker via `importScripts`.
- Added an **empty guard** to `runREML` (returns `null` instead of `NaN`).
- Added `tests.js` (29 assertions, all passing, hand-derived expectations).
- Added Pages scaffold (`.nojekyll`, README, `.gitignore`); renamed
  `Neurosynth.html` → `index.html`. Dropped the unsupported "Clinical Edition"
  claim from the description.

## Body (E156 draft — CURRENT BODY)

For a given acute-stroke patient, does intravenous thrombolysis deliver net
clinical benefit once treatment delay and haemorrhage harm are weighed? This
dashboard pools randomised-trial log odds ratios for functional
benefit and symptomatic-bleed harm from five landmark trials: NINDS, ECASS III,
ATLANTIS, IST-3 and EPITHET. It fits a REML random-effects model, applies a
log-linear time-decay penalty, and runs fifty thousand correlated Monte-Carlo
draws to estimate the probability of net benefit for a user-set risk profile.
Across default early-window settings that probability is high but collapses
toward equipoise as delay and bleed risk rise. A revival audit made the tool
fully offline and extracted its core into a single tested source of truth behind
twenty-nine hand-checked assertions. The pooled signal depends strongly on the
user's assumed baseline risk, so the model is a transparency aid for trade-offs,
not a clinical decision rule. Treatment value is therefore best read as
conditional on time and risk, not a fixed effect.

SUBMITTED: [ ]
