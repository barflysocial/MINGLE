const $ = (id) => document.getElementById(id);
const tokenKey = 'oneMatchHostToken';
let hostToken = localStorage.getItem(tokenKey) || '';
let hostState = null;

function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', 'x-host-token': hostToken, ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function msg(id, text, good = false) {
  $(id).textContent = text || '';
  $(id).style.color = good ? 'var(--ok)' : 'var(--gold)';
}

function showDash() {
  $('loginCard').classList.add('hide');
  $('dashboard').classList.remove('hide');
}

function showLogin() {
  $('loginCard').classList.remove('hide');
  $('dashboard').classList.add('hide');
}

async function loadState() {
  if (!hostToken) return showLogin();
  try {
    hostState = await api('/api/host/state');
    showDash();
    render();
  } catch (err) {
    localStorage.removeItem(tokenKey);
    hostToken = '';
    showLogin();
  }
}

function render() {
  const s = hostState;
  const e = s.event;
  $('eventLine').textContent = `${e.title} • ${e.venue} • RSVP: ${e.rsvpCode} • Check-in: ${e.checkinCode}`;
  $('eventTitle').value = e.title || '';
  $('eventVenue').value = e.venue || '';
  $('eventRsvp').value = e.rsvpCode || '';
  $('eventCheckin').value = e.checkinCode || '';
  $('eventRound').value = e.roundLabel || '';
  $('aiModePill').textContent = s.openAIEnabled ? 'OpenAI API enabled' : 'Local rule-based AI mode';
  $('aiModePill').className = `pill ${s.openAIEnabled ? 'ok' : 'warn'}`;

  const ready = s.players.filter(p => p.ready).length;
  const checked = s.players.filter(p => p.checkedIn).length;
  const verified = s.players.filter(p => p.liveVerified).length;
  const chats = s.matches.filter(m => m.chatUnlocked).length;
  $('stats').innerHTML = `
    <div class="stat"><b>${s.players.length}</b><span>Players</span></div>
    <div class="stat"><b>${verified}</b><span>Live verified</span></div>
    <div class="stat"><b>${ready}</b><span>AI profiles ready</span></div>
    <div class="stat"><b>${checked}</b><span>Checked in</span></div>
    <div class="stat"><b>${s.matches.length}</b><span>One Match pairs</span></div>
    <div class="stat"><b>${chats}</b><span>Chats unlocked</span></div>
    <div class="stat"><b>${s.reports.length}</b><span>Safety reports</span></div>`;

  $('playersTable').innerHTML = s.players.map(p => `
    <tr>
      <td><strong>${escapeHTML(p.avatarName)}</strong></td>
      <td>${p.liveVerified ? 'Yes' : 'No'}</td>
      <td>${p.ready ? 'Yes' : 'No'}</td>
      <td>${p.checkedIn ? 'Yes' : 'No'}</td>
      <td>${p.profileCompleteness}%</td>
      <td>${escapeHTML(p.profile?.gender || '')}</td>
      <td>${escapeHTML(p.profile?.intent || '')}</td>
      <td>${escapeHTML(p.profile?.seeking || '')}</td>
      <td>${escapeHTML(p.profile?.ageRange || '')}</td>
      <td>${escapeHTML((p.profile?.values || []).join(', '))}</td>
      <td>${escapeHTML(p.profile?.attractionBalance || '')}</td>
    </tr>`).join('') || '<tr><td colspan="11">No players yet.</td></tr>';

  $('matchesList').innerHTML = s.matches.map(m => `
    <div class="glass">
      <div class="row space">
        <h3>${escapeHTML(m.players.join(' + '))}</h3>
        <span class="pill ok">${m.score}%</span>
      </div>
      <p><strong>Status:</strong> ${escapeHTML(m.status)} • <strong>Chat:</strong> ${m.chatUnlocked ? 'Unlocked' : 'Locked'}</p>
      <p><strong>First Spark:</strong> ${escapeHTML(m.prompt || '')}</p>
      <ul>${(m.reasons || []).map(r => `<li>${escapeHTML(r)}</li>`).join('')}</ul>
    </div>`).join('') || '<div class="notice">No matches yet. Run the One Match AI Funnel after players check in.</div>';

  $('reportsList').innerHTML = s.reports.map(r => `
    <div class="glass">
      <h3>${escapeHTML(r.reporter)} reported ${escapeHTML(r.reported)}</h3>
      <p>${escapeHTML(r.reason || 'No reason provided.')}</p>
      <p class="small">${escapeHTML(r.at)}</p>
    </div>`).join('') || '<div class="notice">No reports.</div>';
}

$('loginBtn').addEventListener('click', async () => {
  try {
    const data = await fetch('/api/host/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('pin').value })
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Login failed');
      return d;
    });
    hostToken = data.hostToken;
    localStorage.setItem(tokenKey, hostToken);
    await loadState();
  } catch (err) { msg('loginMsg', err.message); }
});

$('refreshBtn').addEventListener('click', loadState);

$('saveEventBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/host/event', { method: 'POST', body: {
      title: $('eventTitle').value,
      venue: $('eventVenue').value,
      rsvpCode: $('eventRsvp').value,
      checkinCode: $('eventCheckin').value,
      roundLabel: $('eventRound').value
    }});
    msg('eventMsg', 'Event settings saved.', true);
    await loadState();
  } catch (err) { msg('eventMsg', err.message); }
});

$('runFunnelBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/host/run-funnel', { method: 'POST' });
    msg('controlMsg', data.message, true);
    await loadState();
  } catch (err) { msg('controlMsg', err.message); }
});

$('resetMatchesBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/host/reset-matches', { method: 'POST' });
    msg('controlMsg', data.message, true);
    await loadState();
  } catch (err) { msg('controlMsg', err.message); }
});

$('fullResetBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/host/full-reset', { method: 'POST', body: { confirm: $('resetConfirm').value } });
    msg('controlMsg', data.message, true);
    $('resetConfirm').value = '';
    await loadState();
  } catch (err) { msg('controlMsg', err.message); }
});

loadState();
