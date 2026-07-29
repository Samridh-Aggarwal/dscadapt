# DSCAdapt frontend

Static single-page interface for DSCAdapt, a decision-support tool on climate
adaptation and infectious disease risk. No build step, no framework, no
dependencies — open the folder on a web server and it runs.

## Layout

```
index.html        markup only
app.css           all styling, light and dark
js/app.js         state, storage, data loading, routing, disease highlighting
js/chat.js        scenario conversation, sessions, PDF exports
js/evidence.js    evidence base tab, document detail, disease profiles
js/explorer.js    pathway explorer
js/review.js      document reviewer tab
data/*.json       all content
```

Scripts load in that order and share one global scope. `js/app.js` must come
first: it defines `S` (application state) and `DATA` (loaded content), which
every other file reads.

## Content lives in data/

Nothing in `data/` requires knowing JavaScript. Edit the JSON and reload.

- **`diseases.json`** — 24 diseases and 5 vectors. Each entry carries its
  aliases, tooltip, categories and full profile in one place, so renaming a
  disease cannot leave the tooltip and the profile out of step.
- **`evidence.json`** — the 27 pathway documents grouped into 8 families.
  `co` and `tr` are the totals recorded in the source document; `mechanisms`
  is what has been transcribed so far. Where they differ the detail panel says
  "Showing 3 of 7", rather than pretending the shorter list is complete.
- **`pathways.json`** — the explorer graph: sectors, measures, mechanisms,
  disease categories and the links between them.

To write up a mechanism, add a `detail` field to it in `evidence.json`. Until
then the panel shows a placeholder. Nothing else needs changing.

## Running locally

The content is fetched at runtime, and browsers block `fetch` from `file://`.
Serve the folder over HTTP:

```
python -m http.server 8000
```

then open `http://localhost:8000`. Opening `index.html` directly will show a
message explaining this.

## Backend

`API_URL` at the top of `js/app.js` points at the FastAPI backend. That one
constant is the whole connection — change it to switch environments.

Endpoints used: `/ask`, `/evaluate`, `/extract`, `/transcript`, `/briefing`.
