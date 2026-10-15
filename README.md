# CS-44 · BIS Evidence Dashboard

Teaching-innovation evidence across the 2024–2026 Business Information Systems unit outlines.

**Live page:** enable GitHub Pages on this repository (Settings → Pages → Branch `main`, folder `/root`).

## What this is

A read-only view of a saved analysis. It shows, for each of the eight taxonomy
categories, how many units carry positive evidence, how many evidence items there
are, the score those items add up to, and how much is still waiting on review.
Every figure can be opened down to the sentence in the outline that produced it.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Presentation |
| `app.js` | Rendering and interaction |
| `data.js` | The saved analysis — units, categories, evidence text |
| `history-data.js` | 2024–2026 results under the recovered v6.3 rules |
| `dataset.js` | Year switching |
| `annual.js` | Annual trend charts |
| `trends.js` | Weekly trend charts |
| `evidence-core.js`, `assistant.js` | Source-grounded question answering |
| `favicon.svg` | Icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Where the numbers come from

- Text: the saved capture of the public unit outlines, 11 September 2026.
- Rules: taxonomy v6.3, 48 scoring rules, 7 October 2026.
- Scores: produced by `src/run_pipeline.py` in the project repository against that
  saved text, not by a database run. No database batch matching these rules exists
  yet, so these figures cannot be reconciled against `database/reports/`.
- The page only adds up the records stored in `data.js`. It never re-scores text.

Results are preliminary. No human review has been recorded against them.

## Updating the data

Regenerate `data.js` from a pipeline run with `make_data_js.py`, then replace the
file here. The asset links in `index.html` carry a version string; change it when
you replace a file so browsers do not serve a cached copy.

Project repository: https://github.com/ruochentang2-code/infs6600-taxonomy-pilot

## Weekly trend charts

`trends.js` adds two SVG line charts using positive evidence in the saved Weekly schedule records, grouped by the week number in the item label. No new source data or historical snapshots are invented. The category selector controls both charts; the study-level selector controls volume only. UG/PG counts deduplicate units within each week. Multi-category matches count separately in evidence volume. Missing outlines and review-only records are excluded. Zero indicates no saved match, not a verified absence of activity. Weeks from different sessions are pooled by teaching-week number.

Deploy by replacing index.html and styles.css and adding trends.js alongside the existing app.js and data.js. This package also contains the unchanged original assets. The hosted site must be deployed from the repository that actually owns its GitHub Pages configuration.

Validation: JavaScript syntax checks; headless Edge page loading without JavaScript errors; study-level and category filtering; 390px mobile viewport without horizontal page overflow; desktop screenshot inspected.

## Evidence assistant

The page now includes all-section source search via evidence-core.js and assistant.js, with optional model explanations configured in assistant-config.js. Static search needs no key or backend. The sibling assistant-server folder contains the optional Node backend and automated tests. See ../使用说明-证据助手.md for Chinese preview, configuration, deployment and verification instructions. Never place server .env files or model keys in this public website directory.

## Historical comparison

The original 2026 `data.js` is byte-identical to the provided repository (SHA-256 `10A429F34C551D9C12943A16C64D8BBEF9D54A44777CFE4B5625B05F6344C776`). The recovered 48-rule v6.3 configuration was verified by reproducing every original 2026 unit/category summary, evidence item, review item, matched phrase, score and failure-register entry. The same configuration is then applied to the collected 2024 and 2025 outlines. Annual charts default to the 22 courses available in all three years; the all-available option reports changing coverage explicitly.

## Free-tier AI deployment

Static source search works on GitHub Pages without an API. For AI explanations, deploy the sibling `cloudflare-worker` package, store `GEMINI_API_KEY` and `ASSISTANT_ACCESS_TOKEN` as Worker secrets, then set the Worker HTTPS origin in `assistant-config.js`. The browser sends the selected dataset, filters and question to the Worker; the Worker retrieves saved records and calls Gemini with a JSON schema. Model citations are checked against supplied record IDs before display. Never put the Gemini key in this folder.
