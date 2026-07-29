// Evidence base tab: the document grid, the document detail panel with its
// expandable mechanisms, and the disease profile modal.

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

// Evidence-strip tags on the landing page jump straight to a filtered view.
const EVIDENCE_JUMP = {
  water: 'water', flood: 'water', green: 'buildings', building: 'buildings',
  retrofit: 'buildings', coastal: 'coastal', farming: 'food', food: 'food',
  tourism: 'tourism', transport: 'transport', barcelona: 'case',
};

/* ---------------------------------------------------------------- grid --- */

// Searches everything a reader might reasonably type: the title, the summary,
// the sector, and the mechanism and disease names inside each document.
function docMatches(doc, q) {
  if (!q) return true;
  const parts = [doc.title, doc.summary, doc.family];
  for (const m of doc.mechanisms || []) parts.push(m.m, m.d);
  return parts.join(' ').toLowerCase().includes(q);
}

function renderEvidence() {
  const c = document.getElementById('evidence-results');
  const q = S.evidenceQuery.toLowerCase().trim();
  const f = S.evidenceFilter;

  const matched = DATA.evidence.documents.filter(
    (d) => (f === 'all' || d.family === f) && docMatches(d, q));

  if (!matched.length) {
    c.innerHTML = `<div class="empty-state"><h3>Nothing matches.</h3>
      <p>Try a different search or filter.</p></div>`;
    return;
  }

  let h = '';
  for (const fam of DATA.evidence.families) {
    const docs = matched.filter((d) => d.family === fam.family);
    if (!docs.length) continue;
    h += `<div class="pathway-group"><h3>${fam.name}
      <span class="count">${docs.length} doc${docs.length !== 1 ? 's' : ''}</span></h3>
      <div class="doc-grid">`;
    for (const d of docs) {
      h += `<div class="doc-card" onclick="openDocDetail('${d.id}')">
        <div class="doc-id">Pathway ${d.id}</div>
        <div class="doc-title">${escapeHtml(d.title)}</div>
        <div class="doc-summary">${escapeHtml(d.summary)}</div>
        <div class="doc-chips">
          <span class="doc-chip co">${d.co} co-benefit${d.co !== 1 ? 's' : ''}</span>
          <span class="doc-chip tr">${d.tr} trade-off${d.tr !== 1 ? 's' : ''}</span>
        </div></div>`;
    }
    h += '</div></div>';
  }
  c.innerHTML = h;
}

function wireEvidence() {
  document.getElementById('evidence-search').addEventListener('input', (e) => {
    S.evidenceQuery = e.target.value;
    renderEvidence();
  });
  document.querySelectorAll('#filter-chips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filter-chips .chip').forEach((x) => x.classList.remove('active'));
      chip.classList.add('active');
      S.evidenceFilter = chip.dataset.filter;
      renderEvidence();
    });
  });
}

function openEvidence(hint) {
  S.evidenceFilter = EVIDENCE_JUMP[hint] || 'all';
  document.querySelectorAll('#filter-chips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.filter === S.evidenceFilter);
  });
  route('evidence');
}

/* -------------------------------------------------------- detail panel --- */

function toggleMech(btn) {
  const item = btn.closest('.section-item');
  const open = item.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
}

function mechanismHtml(m) {
  const cls = m.t === 'co-benefit' ? 'co-benefit' : 'trade-off';
  const detail = m.detail && m.detail.length
    ? m.detail
    : `<p class="mech-empty">${NO_DETAIL}</p>`;
  return `<div class="section-item ${cls} has-detail">
    <button class="mech-head" aria-expanded="false" onclick="toggleMech(this)">
      <span class="mech-head-text">
        <span class="section-item-type">${m.t}</span>
        <strong>${escapeHtml(m.m)}</strong><br>
        <span style="font-size:11.5px;opacity:.8">Diseases: ${escapeHtml(m.d)}</span>
      </span>
      <span class="mech-chevron">${CHEVRON}</span>
    </button>
    <div class="mech-detail"><div class="mech-detail-inner"><div class="mech-body">
      <div class="mech-detail-body">${detail}</div>
    </div></div></div>
  </div>`;
}

function openDocDetail(id) {
  const d = DATA.evidence.documents.find((x) => x.id === id);
  if (!d) return;
  const fam = DATA.evidence.families.find((f) => f.family === d.family);

  // co and tr are the totals recorded in the source document. The mechanisms
  // array is a partial transcription, so say so rather than quietly showing less.
  const listed = (d.mechanisms || []).length;
  const total = d.co + d.tr;
  const connections = listed < total
    ? `Showing ${listed} of ${total} documented connections`
    : `${total} documented connection${total !== 1 ? 's' : ''}`;

  let h = `<div class="doc-id">Pathway ${d.id} · ${fam ? fam.name : ''}</div>
    <h2>${escapeHtml(d.title)}</h2>
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:18px;
      padding-bottom:14px;border-bottom:1px solid var(--border-light)">${connections}</div>`;

  if (d.intro) {
    h += `<p style="font-size:14px;line-height:1.7;margin-bottom:14px">${d.intro}</p>`;
    if (d.measures) {
      h += `<p style="font-size:13px;font-weight:600;margin-bottom:8px">Key adaptation measures include:</p>
        <ul class="measure-list">${d.measures}</ul>`;
    }
  } else {
    h += `<p style="font-size:14px;line-height:1.7;margin-bottom:18px">${escapeHtml(d.summary)}</p>`;
  }

  if (d.mechanisms) {
    h += '<div style="margin-bottom:16px">' + d.mechanisms.map(mechanismHtml).join('') + '</div>';
  }

  const ask = `What are the co-benefits and trade-offs of ${d.title.toLowerCase()} for infectious disease risk?`;
  h += `<div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn-primary" onclick="askAbout(${JSON.stringify(ask).replace(/"/g, '&quot;')})">Ask about this</button>
    <button class="btn-secondary" onclick="closeDocDetail()">Close</button></div>`;

  document.getElementById('doc-detail-content').innerHTML = h;
  document.getElementById('doc-detail-overlay').classList.add('open');
}

function askAbout(question) {
  closeDocDetail();
  route('scenario');
  setTimeout(() => {
    const i = document.getElementById('main-input');
    i.value = question;
    autosize(i);
    i.focus();
  }, 100);
}

function closeDocDetail(e) {
  if (e && e.target.closest('.detail-panel')) return;
  document.getElementById('doc-detail-overlay').classList.remove('open');
}

/* ------------------------------------------------------ disease modal --- */

function showDiseaseProfile(name) {
  const d = PROFILE_BY_NAME.get(name);
  if (!d) return;
  const sources = d.profile.sources
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a></li>`)
    .join('');
  document.getElementById('disease-profile-title').textContent = d.name;
  document.getElementById('disease-profile-body').innerHTML =
    `<p>${d.profile.body}</p><h4>Sources</h4><ul class="dp-sources">${sources}</ul>`;
  document.getElementById('disease-profile-overlay').classList.add('open');
}

function closeDiseaseProfile(e) {
  if (e && e.target.closest('.dp-panel')) return;
  document.getElementById('disease-profile-overlay').classList.remove('open');
}
