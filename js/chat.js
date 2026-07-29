// Scenario conversation: sending questions, rendering answers, and the saved
// session list with its PDF exports.

/* ------------------------------------------------------------ composer --- */

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// Enter sends, Shift+Enter inserts a newline.
function composerKeydown(e, submit) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

function wireCards() {
  document.querySelectorAll('.entry-card').forEach((c) => {
    c.addEventListener('click', () => {
      const i = document.getElementById('main-input');
      i.value = c.dataset.prompt;
      autosize(i);
      i.focus();
      i.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  const main = document.getElementById('main-input');
  const followup = document.getElementById('followup-field');
  main.addEventListener('input', () => autosize(main));
  followup.addEventListener('input', () => autosize(followup));
  main.addEventListener('keydown', (e) => composerKeydown(e, submitMainQuery));
  followup.addEventListener('keydown', (e) => composerKeydown(e, submitFollowup));
}

/* -------------------------------------------------------------- render --- */

// Backend source titles are prefixed with the internal section number
// ("4.1.9 Trade-off: ..."). The number is needed to find the document but is
// meaningless to a reader, so it is used for routing and stripped for display.
function stripSectionNumber(title) {
  return title.replace(/^\d+(?:\.\d+)*\.?\s+/, '');
}

// Matched on the source filename rather than the section number, because two
// source documents are both numbered 5.1 (hydropower and tourism seasons).
function docIdForOrigin(origin) {
  if (!origin) return null;
  const doc = DATA.evidence.documents.find((d) => origin.endsWith(d.source));
  return doc ? doc.id : null;
}

function renderSourcePanel(sources) {
  const count = (t) => sources.filter((s) => s.type === t).length;
  const ev = count('evidence'), web = count('web'), ecdc = count('ecdc');

  let h = `<div class="source-panel" onclick="this.classList.toggle('expanded')">
    <div class="source-header"><h4>Sources (${ev} passage${ev !== 1 ? 's' : ''}` +
    `${web ? ' + ' + web + ' web' : ''}${ecdc ? ' + ECDC data' : ''})</h4>
    <div class="toggle"></div></div><div class="source-list">`;

  for (const s of sources) {
    const pid = s.type === 'evidence' ? docIdForOrigin(s.origin) : null;
    const jump = pid
      ? ` onclick="event.stopPropagation();route('evidence');openDocDetail('${pid}')"`
      : '';
    const score = s.score != null ? s.score.toFixed(2) : (s.type === 'ecdc' ? 'data' : 'web');
    h += `<div class="source-item"${jump}>
      <div class="source-score ${s.type}">${score}</div>
      <div class="source-info">
        <div class="source-title">${escapeHtml(stripSectionNumber(s.title))}</div>
        <div class="source-origin">${escapeHtml(s.origin)}</div>
      </div></div>`;
  }

  return h + `</div><div class="source-legend">
    <span><span class="legend-dot ev"></span>Evidence base</span>
    <span><span class="legend-dot wb"></span>Web search</span>
    <span><span class="legend-dot ec"></span>ECDC data</span></div></div>`;
}

// `refs` is still honoured but the backend currently writes its reference list
// into the answer body, so it arrives empty.
function renderMsg(role, content, time, meta, refs, sources, thinking) {
  const t = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const who = role === 'user' ? 'You' : 'DSCAdapt · ' + S.settings.audience;

  let h = `<div class="message"><div class="msg-header">
    <span class="msg-label ${role}">${who}</span>
    <span class="msg-time">${t}${meta ? ' · ' + (meta.duration || '') : ''}</span></div>`;

  if (thinking) {
    h += `<div class="thinking"><span class="thinking-dot"></span><span class="thinking-dot"></span>
      <span class="thinking-dot"></span>Retrieving from evidence base…</div>`;
  } else {
    h += `<div class="msg-body ${role}-msg">${content}`;
    if (refs && refs.length) {
      h += '<div class="ref-block"><h5>References</h5>';
      refs.forEach((r) => { h += `<div class="ref-item">${r}</div>`; });
      h += '</div>';
    }
    h += '</div>';
    if (meta) {
      h += `<div class="msg-meta"><span>${meta.words} words</span>
        <span>${meta.passages} passages</span><span>${meta.web}</span>
        <span>Route: ${meta.route}</span></div>`;
    }
  }

  h += '</div>';
  if (sources && sources.length) h += renderSourcePanel(sources);
  return h;
}

function renderSidePanel() {
  const s = (S.activeSession && S.activeSession.settings) || S.settings;
  document.getElementById('panel-settings').innerHTML = [
    ['Mode', s.audience], ['Country', s.country],
    ['Language', s.language], ['Length', s.length],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v || '\u2014')}</dd>`).join('');
}

function renderSessionInfo() {
  if (!S.activeSession) return;
  const t = S.activeSession.messages.filter((m) => m.role === 'user').length;
  document.getElementById('session-info').textContent =
    `Session #${S.activeSession.id} · ${t} turn${t !== 1 ? 's' : ''}`;
  updateBriefingBtn();
}

function scrollChat() {
  const el = document.getElementById('chat-scroll');
  if (!el) return;
  if (el.scrollTo) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  else el.scrollTop = el.scrollHeight;
}

/* ------------------------------------------------------------ sessions --- */

function genSessionId() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const taken = new Set((S.sessions || []).map((s) => s.id));
  let id;
  do {
    id = '';
    for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * 36)];
  } while (taken.has(id));
  return id;
}

// Write the in-progress session back into the saved list. Every exit path must
// call this; loadSession used to only handle the insert case, so continuing an
// existing session and then opening another one silently dropped the new turns.
function stashActiveSession() {
  if (!S.activeSession || S.activeSession.messages.length === 0) return;
  const existing = S.sessions.find((s) => s.id === S.activeSession.id);
  if (existing) Object.assign(existing, S.activeSession);
  else S.sessions.unshift(S.activeSession);
}

function showLanding() {
  document.getElementById('scenario-conversation').classList.add('hidden');
  document.getElementById('scenario-landing').classList.remove('hidden');
}

function showConversation() {
  document.getElementById('scenario-landing').classList.add('hidden');
  document.getElementById('scenario-conversation').classList.remove('hidden');
}

function newSession() {
  stashActiveSession();
  S.activeSession = null;
  localStorage.removeItem(LS.active);
  save();
  showLanding();
  const input = document.getElementById('main-input');
  input.value = '';
  autosize(input);
  route('scenario');
}

function startSession(q) {
  stashActiveSession();
  S.activeSession = {
    id: genSessionId(),
    created: Date.now(),
    settings: { ...S.settings },
    title: q.slice(0, 80),
    messages: [],
  };
  showConversation();
  renderSidePanel();
  document.getElementById('chat-area').innerHTML = '';
  save();
  sendMessage(q);
}

function restoreSession() {
  if (!S.activeSession) return;
  showConversation();
  renderSidePanel();
  const chat = document.getElementById('chat-area');
  chat.innerHTML = '';
  S.activeSession.messages.forEach((m) => {
    chat.insertAdjacentHTML('beforeend',
      renderMsg(m.role, m.content, m.time, m.meta, m.refs, m.sources));
  });
  renderSessionInfo();
}

function loadSession(id) {
  stashActiveSession();
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return;
  S.activeSession = JSON.parse(JSON.stringify(s));
  save();
  route('scenario');
  setTimeout(restoreSession, 50);
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this session?')) return;
  S.sessions = S.sessions.filter((s) => s.id !== id);
  if (S.activeSession && S.activeSession.id === id) {
    S.activeSession = null;
    localStorage.removeItem(LS.active);
  }
  save();
  renderSessions();
}

function renderSessions() {
  const c = document.getElementById('session-list-container');
  const all = [...S.sessions];
  if (S.activeSession && S.activeSession.messages.length > 0 &&
      !all.find((s) => s.id === S.activeSession.id)) {
    all.unshift(S.activeSession);
  }

  if (!all.length) {
    c.innerHTML = `<div class="empty-state"><h3>No sessions yet.</h3>
      <p>Start a scenario analysis and it will be saved here automatically.</p>
      <button class="btn-primary" onclick="route('scenario')">Start a scenario</button></div>`;
    return;
  }

  let h = '<div class="session-list">';
  for (const s of all) {
    const created = new Date(s.created);
    const date = created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const turns = s.messages.filter((m) => m.role === 'user').length;
    const first = s.messages.find((m) => m.role === 'user');
    const summary = first ? first.content.slice(0, 180) + (first.content.length > 180 ? '…' : '') : '';
    const set = s.settings || {};
    h += `<div class="session-card" onclick="loadSession('${s.id}')">
      <div class="session-head">
        <div class="session-title">${escapeHtml(s.title)}</div>
        <div class="session-time">${date} · ${time}</div></div>
      <div class="session-summary">${summary}</div>
      <div class="session-meta">
        <span class="tag">${set.audience || '—'}</span>
        <span class="tag">${set.country || '—'}</span>
        <span class="tag">${set.language || '—'}</span>
        <span class="tag">${set.length || '—'}</span>
        <span>${turns} turn${turns !== 1 ? 's' : ''}</span>
        <span style="font-family:var(--mono);font-size:11px;color:var(--text-tertiary)">#${s.id}</span>
        <span style="margin-left:auto"><button class="btn-secondary"
          style="padding:4px 10px;font-size:11px;color:var(--danger)"
          onclick="deleteSession('${s.id}',event)">Delete</button></span>
      </div></div>`;
  }
  c.innerHTML = h + '</div>';
}

/* --------------------------------------------------------------- send --- */

function submitMainQuery() {
  const i = document.getElementById('main-input');
  const q = i.value.trim();
  if (!q) return;
  startSession(q);
  i.value = '';
  autosize(i);
}

function submitFollowup() {
  const i = document.getElementById('followup-field');
  const q = i.value.trim();
  if (!q || !S.activeSession) return;
  sendMessage(q);
  i.value = '';
  autosize(i);
}

async function sendMessage(q) {
  const cfg = (S.activeSession && S.activeSession.settings) || S.settings;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const chat = document.getElementById('chat-area');

  S.activeSession.messages.push({ role: 'user', content: q, time });
  chat.insertAdjacentHTML('beforeend', renderMsg('user', escapeHtml(q), time));
  renderSessionInfo();
  save();

  const pending = 't-' + Date.now();
  chat.insertAdjacentHTML('beforeend',
    `<div id="${pending}">${renderMsg('assistant', '', null, null, null, null, true)}</div>`);
  scrollChat();

  try {
    const history = S.activeSession.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: stripTags(m.content) }))
      .slice(0, -1);

    const res = await fetch(API_URL + '/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        country: cfg.country,
        language: cfg.language,
        audience: cfg.audience,
        length: cfg.length,
        history,
        session_id: S.activeSession.id,
      }),
    });
    if (!res.ok) throw new Error('API returned ' + res.status);

    const data = await res.json();
    document.getElementById(pending)?.remove();
    const body = highlightDiseases(data.body);
    const meta = { ...data.meta };
    chat.insertAdjacentHTML('beforeend',
      renderMsg('assistant', body, time, meta, null, data.sources));
    S.activeSession.messages.push({ role: 'assistant', content: body, time, meta, sources: data.sources });
    save();
    renderSessionInfo();
    scrollChat();
  } catch (e) {
    document.getElementById(pending)?.remove();
    chat.insertAdjacentHTML('beforeend', renderMsg('assistant',
      '<p>Could not reach the DSCAdapt backend. The server may be waking up from sleep — ' +
      'please try again in 30–60 seconds.</p>' +
      `<p style="font-size:12px;color:var(--text-tertiary)">Error: ${escapeHtml(e.message)}</p>`,
      time));
    scrollChat();
  }
}

// Answers are stored with their highlight markup for redisplay, but the model
// should receive plain prose — it is told to emit no markup, so feeding its own
// tags back would contradict that.
function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

/* ------------------------------------------------------------ exports --- */

function countSubstantive() {
  if (!S.activeSession) return 0;
  return S.activeSession.messages.filter(
    (m) => m.role === 'assistant' && ['domain', 'both', 'web'].includes(m.meta && m.meta.route)).length;
}

function updateBriefingBtn() {
  const btn = document.getElementById('briefing-btn');
  if (!btn) return;
  const ok = countSubstantive() >= 2;
  btn.disabled = !ok;
  btn.title = ok ? 'Generate a session briefing (PDF)'
                 : 'Ask at least two substantive questions to enable the briefing';
}

async function downloadFile(path, body, filename, failMsg) {
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(failMsg);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf() {
  if (!S.activeSession || !S.activeSession.messages.length) {
    alert('No conversation to export.');
    return;
  }
  const cfg = S.activeSession.settings || S.settings;
  try {
    await downloadFile('/transcript', {
      history: S.activeSession.messages.map((m) => ({ role: m.role, content: m.content })),
      audience: cfg.audience, country: cfg.country, language: cfg.language,
    }, 'IDAlert_Transcript_' + new Date().toISOString().slice(0, 10) + '.pdf',
       'Transcript generation failed');
  } catch (e) {
    alert('Could not generate the transcript. The server may be sleeping — try again in 30s.\n' + e.message);
  }
}

async function downloadBriefing() {
  if (!S.activeSession || countSubstantive() < 2) {
    alert('Ask at least two substantive questions before generating a briefing.');
    return;
  }
  const btn = document.getElementById('briefing-btn');
  const label = btn.textContent;
  btn.textContent = 'Generating…';
  btn.disabled = true;
  const cfg = S.activeSession.settings || S.settings;
  try {
    await downloadFile('/briefing', {
      history: S.activeSession.messages.map((m) => ({
        role: m.role, content: m.content, route: m.meta && m.meta.route, sources: m.sources,
      })),
      audience: cfg.audience, country: cfg.country, language: cfg.language,
    }, 'IDAlert_Briefing_' + new Date().toISOString().slice(0, 10) + '.pdf',
       'Briefing generation failed');
  } catch (e) {
    alert('Could not generate the briefing. The server may be sleeping or busy — try again in 30s.\n' + e.message);
  } finally {
    btn.textContent = label;
    updateBriefingBtn();
  }
}
