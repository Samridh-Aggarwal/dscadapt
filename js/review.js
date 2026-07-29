// Document reviewer. Sends a pasted or uploaded policy document to /evaluate
// and renders the considerations it returns as margin comments.

function noticeBox(msg) {
  return `<div style="padding:16px;border:1px solid var(--border);border-radius:12px;
    background:var(--surface);color:var(--text-secondary)">${escapeHtml(msg)}</div>`;
}

function resetDropzone(sub) {
  document.getElementById('dropzone-title').textContent = 'Drop a document here';
  document.getElementById('dropzone-sub').textContent = sub || 'or click to browse · PDF, Word, or text';
}

function wireDropzone() {
  const dz = document.getElementById('dropzone');
  const file = document.getElementById('file-input');

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  file.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
  document.getElementById('doc-review-btn').addEventListener('click', () => {
    const t = document.getElementById('doc-paste').value.trim();
    if (t) runEvaluate(t);
  });
}

// PDF and Word go to the backend for text extraction; plain text is read here.
function handleFile(f) {
  const name = (f.name || '').toLowerCase();
  const fail = (msg) => {
    resetDropzone('or click to browse');
    document.getElementById('doc-result').innerHTML = noticeBox(msg);
  };

  document.getElementById('dropzone-title').textContent = f.name;

  if (name.endsWith('.pdf') || name.endsWith('.docx')) {
    document.getElementById('dropzone-sub').textContent = 'extracting text…';
    const body = new FormData();
    body.append('file', f);
    fetch(API_URL + '/extract', { method: 'POST', body })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return fail(d.error);
        document.getElementById('doc-paste').value = d.text;
        document.getElementById('dropzone-sub').textContent =
          `extracted ${d.chars.toLocaleString()} characters · reviewing…`;
        runEvaluate(d.text);
      })
      .catch(() => fail('Could not reach the extraction service. Try again, or paste the text.'));
    return;
  }

  document.getElementById('dropzone-sub').textContent = 'reviewing…';
  const reader = new FileReader();
  reader.onload = (e) => runEvaluate(e.target.result);
  reader.readAsText(f);
}

async function runEvaluate(text) {
  const out = document.getElementById('doc-result');
  const country = (document.getElementById('doc-country') || {}).value || 'All Europe';
  out.innerHTML = `<div style="text-align:center;color:var(--text-tertiary);padding:40px">
    Reviewing the document… this takes a few seconds.</div>`;
  try {
    const res = await fetch(API_URL + '/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, country }),
    });
    const data = await res.json();
    if (data.error) {
      out.innerHTML = noticeBox(data.error);
      return;
    }
    renderEval(data);
  } catch (e) {
    out.innerHTML = noticeBox(
      "Couldn't reach the reviewer. The service may be waking up — wait a moment and try again.");
  }
}

function wireResetButton(out) {
  document.getElementById('doc-reset-btn').addEventListener('click', () => {
    out.innerHTML = '';
    document.getElementById('doc-paste').value = '';
    resetDropzone();
  });
}

function renderEval(data) {
  const out = document.getElementById('doc-result');
  const resetBtn = '<button class="btn-secondary" id="doc-reset-btn">Review another</button>';

  if (data.out_of_scope) {
    out.innerHTML = noticeBox(data.note || '') + `<div style="margin-top:14px">${resetBtn}</div>`;
    wireResetButton(out);
    return;
  }

  const raw = (data.comments || '').trim();
  let cards = '';

  if (!raw || /NO GROUNDED CONSIDERATIONS/i.test(raw)) {
    cards = noticeBox('No infectious-disease gaps were flagged for this document against the evidence base.');
  } else {
    for (const block of raw.split(/\n\s*\n/)) {
      const consideration = block.match(/CONSIDERATION:\s*([\s\S]+)/i);
      if (!consideration) continue;
      const passage = block.match(/PASSAGE:\s*(.+)/i);
      const quoted = passage ? passage[1].trim().replace(/^["']|["']$/g, '') : '';
      cards += `<div style="border:1px solid var(--border);border-left:3px solid var(--accent);
        border-radius:10px;background:var(--surface);padding:16px;margin-bottom:14px">` +
        (quoted ? `<div style="font-style:italic;color:var(--text-secondary);font-size:13px;
          margin-bottom:8px">\u201c${escapeHtml(quoted)}\u201d</div>` : '') +
        `<div style="font-size:14px;line-height:1.55">${escapeHtml(consideration[1].trim())}</div></div>`;
    }
  }

  out.innerHTML = `<div style="font-size:13px;color:var(--text-tertiary);
      background:var(--accent-light);border-radius:10px;padding:12px 14px;margin-bottom:18px">
      ${escapeHtml(data.note || '')}</div>${cards}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      <button class="btn-primary" id="doc-discuss-btn">Discuss in a session</button>${resetBtn}</div>`;

  const discuss = document.getElementById('doc-discuss-btn');
  if (discuss) {
    discuss.addEventListener('click', () => {
      const measures = (data.shortlist || []).slice(0, 4).join(', ');
      askAbout('Discuss infectious-disease considerations for a policy covering ' + measures);
    });
  }
  wireResetButton(out);
}
