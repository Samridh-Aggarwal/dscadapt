// Application shell: persisted state, data loading, theme, tab routing and the
// disease-name highlighting shared by the chat and evidence views.
//
// Load order matters. This file must come first; app.js defines DATA and S,
// which every other script reads. init() runs last, after data has arrived.

const API_URL = 'https://samridhaggarwal-dscadapt-api.hf.space';

const LS = {
  sessions: 'dscadapt.sessions.v2',
  settings: 'dscadapt.settings.v2',
  active: 'dscadapt.active.v2',
  theme: 'dscadapt.theme',
};

const TABS = ['scenario', 'document', 'export', 'evidence', 'pathways', 'about'];

// Shown in place of a mechanism's detail when it has not been written up yet.
const NO_DETAIL = 'Not yet written up in the evidence base.';

let S = {
  activeTab: 'scenario',
  settings: { audience: 'Policymaker', country: 'All Europe', language: 'English', length: 'Standard' },
  activeSession: null,
  sessions: [],
  evidenceFilter: 'all',
  evidenceQuery: '',
};

// Populated by loadData() before any view renders.
const DATA = { diseases: null, vectors: null, evidence: null, pathways: null };

/* ---------------------------------------------------------------- data --- */

async function loadData() {
  const get = async (name) => {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`${name}.json returned ${res.status}`);
    return res.json();
  };
  const [diseases, evidence, pathways] = await Promise.all([
    get('diseases'), get('evidence'), get('pathways'),
  ]);
  DATA.diseases = diseases.diseases;
  DATA.vectors = diseases.vectors;
  DATA.evidence = evidence;
  DATA.pathways = pathways;
  buildDiseaseIndex();
}

function showDataError(err) {
  document.querySelector('main').innerHTML =
    `<div class="data-error">
      <h3>Could not load the evidence data</h3>
      <p>The files in <code>data/</code> did not load: ${escapeHtml(err.message)}</p>
      <p>If you opened this page as a local file, the browser blocks these requests.
         Serve the folder over HTTP instead — <code>python -m http.server 8000</code> —
         and open <code>localhost:8000</code>.</p>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ------------------------------------------------------- disease index --- */

// One matcher per alias, longest first, so "Lyme disease" is consumed before
// "Lyme" can match inside it. Aliases are stored as plain text and escaped
// here, which is why hovering "Ae. albopictus" now finds its tooltip.
let DISEASE_MATCHERS = [];
let TIP_BY_ALIAS = new Map();
let PROFILE_BY_NAME = new Map();

function buildDiseaseIndex() {
  const entries = [];
  for (const d of DATA.diseases) {
    PROFILE_BY_NAME.set(d.name, d);
    for (const a of d.aliases) entries.push([a, d.tooltip]);
  }
  for (const v of DATA.vectors) {
    for (const a of v.aliases) entries.push([a, v.tooltip]);
  }
  entries.sort((a, b) => b[0].length - a[0].length);

  DISEASE_MATCHERS = entries.map(([alias]) => {
    const body = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pre = /^\w/.test(alias) ? '\\b' : '';
    const post = /\w$/.test(alias) ? '\\b' : '';
    return new RegExp(pre + '(' + body + ')' + post, 'gi');
  });

  TIP_BY_ALIAS = new Map(entries.map(([alias, tip]) => [alias.toLowerCase(), tip]));
}

// Only rewrites text that sits outside HTML tags, so a disease name can never
// be injected into an attribute of a span the backend already emitted.
function mapTextOutsideTags(html, fn) {
  return html.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part : fn(part))).join('');
}

function highlightDiseases(text) {
  const found = [];
  let h = mapTextOutsideTags(text, (seg) => {
    for (const re of DISEASE_MATCHERS) {
      seg = seg.replace(re, (m) => {
        found.push(m);
        return `{_D${found.length - 1}_}`;
      });
    }
    return seg;
  });
  h = h.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  if (!h.startsWith('<p')) h = '<p>' + h + '</p>';
  found.forEach((m, i) => {
    h = h.replace(`{_D${i}_}`, `<strong class="disease-term">${m}</strong>`);
  });
  return h;
}

document.addEventListener('mouseover', (e) => {
  if (!e.target.classList.contains('disease-term')) return;
  const tip = TIP_BY_ALIAS.get(e.target.textContent.toLowerCase());
  if (!tip) return;
  let el = document.getElementById('dtip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dtip';
    el.style.cssText = 'position:fixed;max-width:280px;padding:8px 12px;background:#1a1a18;' +
      'color:#faf8f0;font-size:12px;line-height:1.5;border-radius:6px;pointer-events:none;' +
      'z-index:200;opacity:0;transition:opacity .15s';
    document.body.appendChild(el);
  }
  el.textContent = tip;
  const r = e.target.getBoundingClientRect();
  el.style.left = Math.min(r.left, window.innerWidth - 290) + 'px';
  el.style.top = (r.bottom + 6) + 'px';
  el.style.opacity = '1';
});

document.addEventListener('mouseout', (e) => {
  if (!e.target.classList.contains('disease-term')) return;
  const el = document.getElementById('dtip');
  if (el) el.style.opacity = '0';
});

/* ------------------------------------------------------------- storage --- */

function load() {
  try {
    const s = localStorage.getItem(LS.settings);
    if (s) S.settings = { ...S.settings, ...JSON.parse(s) };
    const ss = localStorage.getItem(LS.sessions);
    if (ss) S.sessions = JSON.parse(ss);
    const a = localStorage.getItem(LS.active);
    if (a) S.activeSession = JSON.parse(a);
  } catch (e) {
    console.warn('could not read saved state', e);
  }
}

function save() {
  try {
    localStorage.setItem(LS.settings, JSON.stringify(S.settings));
    localStorage.setItem(LS.sessions, JSON.stringify(S.sessions));
    if (S.activeSession) localStorage.setItem(LS.active, JSON.stringify(S.activeSession));
    else localStorage.removeItem(LS.active);
  } catch (e) {
    console.warn('could not save state', e);
  }
}

/* --------------------------------------------------------------- theme --- */

function initTheme() {
  if (localStorage.getItem(LS.theme) === 'dark') document.body.classList.add('dark');
  updateThemeBtn();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(LS.theme, document.body.classList.contains('dark') ? 'dark' : 'light');
  updateThemeBtn();
  if (S.activeTab === 'pathways') renderExplorer();
}

function updateThemeBtn() {
  document.getElementById('theme-btn').textContent =
    document.body.classList.contains('dark') ? '☀ Light' : '☽ Dark';
}

/* ------------------------------------------------------------- routing --- */

function route(tab) {
  S.activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'evidence') renderEvidence();
  if (tab === 'export') renderSessions();
  if (tab === 'pathways') renderExplorer();
  location.hash = tab;
}

window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1);
  if (TABS.includes(t) && t !== S.activeTab) route(t);
});

/* ------------------------------------------------------- setup controls --- */

const LENGTH_HINT = { Brief: '100–200 words', Standard: '200–400 words', Detailed: '400–700 words' };

function wireSetup() {
  const toggle = document.querySelectorAll('#audience-toggle span');
  toggle.forEach((el) => {
    el.addEventListener('click', () => {
      toggle.forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      S.settings.audience = el.dataset.value;
      save();
    });
    el.classList.toggle('active', el.dataset.value === S.settings.audience);
  });

  const country = document.getElementById('country-select');
  const language = document.getElementById('language-select');
  const length = document.getElementById('length-select');

  country.addEventListener('change', () => { S.settings.country = country.value; save(); });
  language.addEventListener('change', () => { S.settings.language = language.value; save(); });
  length.addEventListener('change', () => {
    S.settings.length = length.value;
    document.getElementById('length-meta').textContent =
      `Response length: ${length.value.toLowerCase()} (${LENGTH_HINT[length.value]})`;
    save();
  });

  country.value = S.settings.country;
  language.value = S.settings.language;
  length.value = S.settings.length;
}

/* ---------------------------------------------------------------- boot --- */

async function init() {
  fetch(API_URL).catch(() => {});  // wake the Space early, ignore the result
  load();
  initTheme();

  try {
    await loadData();
  } catch (err) {
    showDataError(err);
    return;
  }

  document.getElementById('evidence-summary').textContent =
    `Evidence base: ${DATA.evidence.documents.length} pathway documents · ` +
    `${DATA.pathways.measures.length} measures · ${DATA.pathways.sectors.length} adaptation sectors`;

  wireSetup();
  wireCards();
  wireDropzone();
  wireEvidence();

  if (S.activeSession && S.activeSession.messages.length > 0) restoreSession();

  const t = location.hash.slice(1);
  if (TABS.includes(t)) route(t);
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDocDetail(); closeDiseaseProfile(); }
});
