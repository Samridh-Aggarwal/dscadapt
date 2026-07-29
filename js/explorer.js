// Pathway explorer. Five columns revealed left to right:
// sector -> measure -> mechanism -> disease category -> disease.
// Each selection lights everything it connects to in the next column.

let px = { sector: null, measure: null, mech: null, cat: null };

function pxSector(id) {
  return DATA.pathways.sectors.find((s) => s.id === id);
}

// Sector palettes ship light and dark variants; pick to match the current theme.
function pxColour(id) {
  const s = pxSector(id);
  if (!s) return null;
  return document.body.classList.contains('dark') ? s.D : s.L;
}

function renderExplorer() {
  px = { sector: null, measure: null, mech: null, cat: null };
  pxRender();
}

function pxReset() {
  renderExplorer();
}

function pxRender() {
  const root = document.getElementById('px-root');
  if (px.sector) pxRenderFlow(root);
  else pxRenderHero(root);
}

function pxRenderHero(root) {
  let h = `<div class="px-hero"><h3>Start with a climate policy sector</h3>
    <p>Each sector has its own set of adaptation measures with distinct infectious
       disease implications.</p><div class="px-sector-grid">`;
  for (const s of DATA.pathways.sectors) {
    const c = pxColour(s.id);
    const n = DATA.pathways.measures.filter((m) => m.sector === s.id).length;
    h += `<button class="px-sector-card" onclick="pxPickSector('${s.id}')"
      style="background:${c.bg};border-color:${c.bd};color:${c.tx}">
      <div class="px-sec-label">Sector</div>
      <div class="px-sec-name">${s.name}</div>
      <div class="px-sec-count">${n} adaptation measure${n !== 1 ? 's' : ''}</div></button>`;
  }
  root.innerHTML = h + '</div></div>';
}

function pxRenderFlow(root) {
  const sec = pxSector(px.sector);
  const sc = pxColour(px.sector);
  const P = DATA.pathways;

  let h = '<button class="px-reset" onclick="pxReset()">← Back to sectors</button>';

  // Only offer the evidence-base link when a document actually exists. Some
  // measures are on the diagram but not yet written up.
  const hasDoc = px.measure && DATA.evidence.documents.some((d) => d.id === px.measure);
  if (hasDoc) {
    h += `<button class="px-learn" onclick="route('evidence');openDocDetail('${px.measure}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
      Learn more in evidence base</button>`;
  }

  h += '<div class="px-flow"><div class="px-flow-inner" id="px-flow-inner">' +
       '<svg class="px-svg" id="px-svg"></svg>';

  // Column 1 — the chosen sector
  h += `<div class="px-col px-col-sector" style="width:200px">
    <div class="px-col-head">Sector</div>
    <div class="px-sec-card" data-pxid="sec" onclick="pxReset()"
      style="background:${sc.bg};border-color:${sc.bd};color:${sc.tx};cursor:pointer">
      <div class="px-sec-label">Selected</div>
      <div class="px-sec-name">${sec.name}</div></div></div>`;

  // Column 2 — every measure in this sector is connected to it, so all are lit.
  h += `<div class="px-col animate-in" style="width:220px;padding-right:40px">
    <div class="px-col-head">Types of measures</div>`;
  for (const m of P.measures.filter((x) => x.sector === px.sector)) {
    const sel = px.measure === m.id;
    const style = `background:${sc.bg};border-color:${sc.bd};color:${sc.tx}` +
                  (sel ? `;box-shadow:0 0 0 2px ${sc.bd}` : '');
    h += `<button class="px-node lit-measure${sel ? ' sel' : ''}" data-pxid="m_${m.id}"
      onclick="pxPickMeasure('${m.id}')" style="${style}">
      <span class="px-node-sub">${m.id}</span>${m.name}</button>`;
  }
  h += '</div>';

  // Column 3 — mechanisms, split into co-benefits and trade-offs
  if (px.measure) {
    const links = P.measureMechanisms[px.measure] || [];
    const connected = new Set(links.map((x) => x.mechanism));
    h += `<div class="px-col animate-in" style="width:240px;padding-right:40px">
      <div class="px-col-head">Co-benefits &amp; trade-offs</div>`;
    for (const [group, list, lit] of [
      ['Co-benefits', P.mechanisms.coBenefit, 'lit-co'],
      ['Trade-offs', P.mechanisms.tradeOff, 'lit-tr'],
    ]) {
      h += `<div class="px-col-sub ${lit === 'lit-co' ? 'co' : 'tr'}">${group}</div>`;
      for (const name of list) {
        const on = connected.has(name);
        const cls = on ? (px.mech === name ? lit + ' sel' : lit) : 'dim';
        const click = on ? ` onclick="pxPickMech(${JSON.stringify(name).replace(/"/g, '&quot;')})"` : '';
        h += `<button class="px-node ${cls}" data-pxid="mc_${name}"${click}>${name}</button>`;
      }
    }
    h += '</div>';
  }

  // Column 4 — disease categories
  if (px.mech) {
    const connected = new Set(P.mechanismCategories[px.mech] || []);
    const isTr = P.mechanisms.tradeOff.includes(px.mech);
    h += `<div class="px-col animate-in" style="width:180px;padding-right:40px">
      <div class="px-col-head">Disease categories</div>`;
    for (const c of P.categories) {
      const on = connected.has(c);
      const lit = isTr ? 'lit-tr' : 'lit-co';
      const cls = on ? (px.cat === c ? lit + ' sel' : lit) : 'dim';
      const click = on ? ` onclick="pxPickCat('${c}')"` : '';
      h += `<button class="px-node ${cls}" data-pxid="ca_${c}"${click}>${c}</button>`;
    }
    h += '</div>';
  }

  // Column 5 — the diseases in the chosen category
  if (px.cat) {
    h += `<div class="px-col animate-in" style="width:190px">
      <div class="px-col-head">Diseases</div>`;
    for (const d of DATA.diseases) {
      const on = d.categories.includes(px.cat);
      const click = on ? ` onclick="showDiseaseProfile(${JSON.stringify(d.name).replace(/"/g, '&quot;')})"` : '';
      h += `<button class="px-node ${on ? 'lit-disease' : 'dim'}" data-pxid="d_${d.name}"${click}>${d.name}</button>`;
    }
    h += '</div>';
  }

  h += '</div></div>' + pxBreadcrumb(sec, sc) + pxLegend(sc);
  root.innerHTML = h;
  setTimeout(pxDrawLines, 80);
}

function pxBreadcrumb(sec, sc) {
  let h = `<div class="px-bc"><span class="px-bc-item"
    style="background:${sc.bg};color:${sc.tx}">${sec.name}</span>`;
  if (px.measure) {
    const m = DATA.pathways.measures.find((x) => x.id === px.measure);
    h += `<span class="px-bc-sep">→</span><span class="px-bc-item"
      style="background:var(--surface-alt);color:var(--text)">${m.name}</span>`;
  }
  if (px.mech) {
    const isTr = DATA.pathways.mechanisms.tradeOff.includes(px.mech);
    h += `<span class="px-bc-sep">→</span><span class="px-bc-item"
      style="background:${isTr ? 'var(--web-bg)' : 'var(--accent-light)'};
      color:${isTr ? 'var(--web-accent)' : 'var(--accent-dark)'}">${px.mech}</span>`;
  }
  if (px.cat) {
    const n = DATA.diseases.filter((d) => d.categories.includes(px.cat)).length;
    h += `<span class="px-bc-sep">→</span><span class="px-bc-item"
        style="background:var(--surface-alt);color:var(--text)">${px.cat}</span>
      <span class="px-bc-sep">→</span><span class="px-bc-item"
        style="background:var(--disease-light);color:var(--disease-dark)">
        ${n} disease${n !== 1 ? 's' : ''}</span>`;
  }
  return h + '</div>';
}

function pxLegend(sc) {
  return `<div class="px-legend">
    <div class="px-legend-item"><span class="px-legend-line" style="background:${sc.bd}"></span>Sector path</div>
    <div class="px-legend-item"><span class="px-legend-line" style="background:var(--accent)"></span>Co-benefit</div>
    <div class="px-legend-item"><span class="px-legend-line" style="background:var(--web-accent)"></span>Trade-off</div>
    <div class="px-legend-item"><span class="px-legend-line" style="background:var(--disease)"></span>Disease link</div>
  </div>`;
}

function pxDrawLines() {
  const inner = document.getElementById('px-flow-inner');
  const svg = document.getElementById('px-svg');
  if (!inner || !svg) return;

  const box = inner.getBoundingClientRect();
  svg.setAttribute('width', box.width);
  svg.setAttribute('height', box.height);
  svg.style.width = box.width + 'px';
  svg.style.height = box.height + 'px';

  let paths = '';
  const link = (fromId, toId, colour, width, opacity) => {
    const f = inner.querySelector(`[data-pxid="${fromId}"]`);
    const t = inner.querySelector(`[data-pxid="${toId}"]`);
    if (!f || !t) return;
    const fr = f.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const x1 = fr.right - box.left, y1 = fr.top + fr.height / 2 - box.top;
    const x2 = tr.left - box.left, y2 = tr.top + tr.height / 2 - box.top;
    const dx = Math.abs(x2 - x1) * 0.48;
    paths += `<path d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}"
      stroke="${colour}" stroke-width="${width}" fill="none" opacity="${opacity}"/>`;
  };

  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim() || '#0F6E56';
  const warm = style.getPropertyValue('--web-accent').trim() || '#D97706';
  const disease = style.getPropertyValue('--disease').trim() || '#7C3AED';
  const sc = pxColour(px.sector);
  const P = DATA.pathways;

  // Sector fans out to every measure it contains; the selected one is emphasised.
  for (const m of P.measures.filter((x) => x.sector === px.sector)) {
    const on = m.id === px.measure;
    link('sec', 'm_' + m.id, sc.bd, on ? 2.5 : 1.2, on ? 0.75 : 0.3);
  }

  if (px.measure) {
    for (const x of P.measureMechanisms[px.measure] || []) {
      link('m_' + px.measure, 'mc_' + x.mechanism, x.type === 'tr' ? warm : accent, 2, 0.65);
    }
  }
  if (px.mech) {
    const isTr = P.mechanisms.tradeOff.includes(px.mech);
    for (const c of P.mechanismCategories[px.mech] || []) {
      link('mc_' + px.mech, 'ca_' + c, isTr ? warm : accent, 2, 0.65);
    }
  }
  if (px.cat) {
    for (const d of DATA.diseases.filter((x) => x.categories.includes(px.cat))) {
      link('ca_' + px.cat, 'd_' + d.name, disease, 1.8, 0.65);
    }
  }

  svg.innerHTML = paths;
}

function pxPickSector(id) { px = { sector: id, measure: null, mech: null, cat: null }; pxRender(); }
function pxPickMeasure(id) { px.measure = id; px.mech = null; px.cat = null; pxRender(); }
function pxPickMech(name) { px.mech = name; px.cat = null; pxRender(); }
function pxPickCat(name) { px.cat = name; pxRender(); }

window.addEventListener('resize', () => {
  if (S.activeTab === 'pathways' && px.sector) pxDrawLines();
});
