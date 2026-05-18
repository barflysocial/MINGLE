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

async function apiText(path) {
  const res = await fetch(path, { headers: { 'x-host-token': hostToken } });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Request failed');
  return text;
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
  $('eventLine').textContent = `${e.title} • ${e.venue} • RSVP: ${e.rsvpCode}`;
  $('eventTitle').value = e.title || '';
  $('eventVenue').value = e.venue || '';
  $('eventRsvp').value = e.rsvpCode || '';
  $('eventRound').value = e.roundLabel || '';
  $('aiModePill').textContent = s.openAIEnabled ? 'OpenAI API enabled' : 'Local rule-based AI mode';
  $('aiModePill').className = `pill ${s.openAIEnabled ? 'ok' : 'warn'}`;

  const ready = s.players.filter(p => p.ready).length;
  const checked = s.players.filter(p => p.checkedIn).length;
  const verified = s.players.filter(p => p.liveVerified).length;
  const cross = s.matches.filter(m => m.crossVenue).length;
  const chats = s.matches.filter(m => m.chatUnlocked).length;
  $('stats').innerHTML = `
    <div class="stat"><b>${s.players.length}</b><span>Players</span></div>
    <div class="stat"><b>${verified}</b><span>Live verified</span></div>
    <div class="stat"><b>${ready}</b><span>Profiles ready</span></div>
    <div class="stat"><b>${checked}</b><span>Venue checked in</span></div>
    <div class="stat"><b>${s.matches.length}</b><span>One Match pairs</span></div>
    <div class="stat"><b>${cross}</b><span>Cross-venue</span></div>
    <div class="stat"><b>${chats}</b><span>Chats unlocked</span></div>
    <div class="stat"><b>${s.reports.length}</b><span>Safety reports</span></div>`;

  renderVenues();

  $('playersTable').innerHTML = s.players.map(p => `
    <tr>
      <td><strong>${escapeHTML(p.avatarName || 'Name pending')}</strong></td>
      <td>${p.liveVerified ? 'Yes' : 'No'}</td>
      <td>${p.ready ? 'Yes' : 'No'} (${p.profileCompleteness}%)</td>
      <td>${p.checkedIn ? 'Yes' : 'No'}</td>
      <td>${escapeHTML(p.checkedInVenueName || '')}</td>
      <td>${escapeHTML(p.profile?.matchScope || '')}</td>
      <td>${escapeHTML(p.profile?.intent || '')}</td>
      <td>${escapeHTML(p.profile?.seeking || '')}</td>
      <td>${escapeHTML(p.profile?.ageRange || '')}</td>
    </tr>`).join('') || '<tr><td colspan="9">No players yet.</td></tr>';

  $('matchesList').innerHTML = s.matches.map(m => `
    <div class="glass">
      <div class="row space wrap">
        <h3>${escapeHTML(m.players.join(' + '))}</h3>
        <span class="pill ${m.crossVenue ? 'warn' : 'ok'}">${m.crossVenue ? 'Cross-venue' : 'Same venue'}</span>
      </div>
      <p><strong>Score:</strong> ${m.score}% • <strong>Status:</strong> ${escapeHTML(m.status)} • <strong>Chat:</strong> ${m.chatUnlocked ? 'Unlocked' : 'Locked'}</p>
      <p><strong>Venues:</strong> ${escapeHTML((m.venues || []).filter(Boolean).join(' + '))}</p>
      ${m.confirmedMeetVenue ? `<p><strong>Meet-up confirmed:</strong> ${escapeHTML(m.confirmedMeetVenue)}</p>` : ''}
      <p><strong>First Spark:</strong> ${escapeHTML(m.prompt || '')}</p>
      <ul>${(m.reasons || []).map(r => `<li>${escapeHTML(r)}</li>`).join('')}</ul>
    </div>`).join('') || '<div class="notice">No matches yet. Start the One Match Round after players check in.</div>';

  $('reportsList').innerHTML = s.reports.map(r => `
    <div class="glass">
      <h3>${escapeHTML(r.reporter)} reported ${escapeHTML(r.reported)}</h3>
      <p>${escapeHTML(r.reason || 'No reason provided.')}</p>
      <p class="small">${escapeHTML(r.at)}</p>
    </div>`).join('') || '<div class="notice">No reports.</div>';
}

function renderVenues() {
  const venues = hostState.venues || [];
  $('venuesHostList').innerHTML = venues.map(v => `
    <div class="venueHostCard glass" id="venue_${escapeHTML(v.id)}">
      <div class="row space wrap">
        <div>
          <h3>${escapeHTML(v.name)}</h3>
          <p class="small">${escapeHTML(v.address || v.city || '')}</p>
          <p class="small">${escapeHTML(v.eventTitle || 'Mingle Night')} • ${escapeHTML(v.eventTime || 'Tonight')}</p>
          <p class="small">Token: ${escapeHTML(v.token || '')}</p>
        </div>
        <span class="pill ${v.status === 'open' ? 'ok' : 'warn'}">${escapeHTML(v.status || 'open')}</span>
      </div>
      <div class="row wrap">
        <button class="secondary showQrBtn" data-venue="${escapeHTML(v.id)}">Show Check-In QR</button>
        <button class="secondary toggleVenueBtn" data-venue="${escapeHTML(v.id)}" data-status="${v.status === 'open' ? 'closed' : 'open'}">${v.status === 'open' ? 'Close Check-In' : 'Open Check-In'}</button>
      </div>
      <div class="qrBox hide" id="qr_${escapeHTML(v.id)}"></div>
    </div>
  `).join('') || '<div class="notice">No venues yet.</div>';

  document.querySelectorAll('.showQrBtn').forEach(btn => btn.addEventListener('click', () => showQr(btn.dataset.venue)));
  document.querySelectorAll('.toggleVenueBtn').forEach(btn => btn.addEventListener('click', () => toggleVenue(btn.dataset.venue, btn.dataset.status)));
}

async function showQr(venueId) {
  try {
    const box = $(`qr_${venueId}`);
    const svg = await apiText(`/api/host/venue/${venueId}/qr`);
    box.innerHTML = `<div class="qrInner">${svg}</div><p class="small">Display this QR at the venue. Users scan it after their profile is complete.</p>`;
    box.classList.toggle('hide');
  } catch (err) { msg('venueMsg', err.message); }
}

async function toggleVenue(venueId, status) {
  try {
    await api(`/api/host/venue/${venueId}/status`, { method: 'POST', body: { status } });
    msg('venueMsg', 'Venue status updated.', true);
    await loadState();
  } catch (err) { msg('venueMsg', err.message); }
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
    await api('/api/host/event', { method: 'POST', body: {
      title: $('eventTitle').value,
      venue: $('eventVenue').value,
      rsvpCode: $('eventRsvp').value,
      roundLabel: $('eventRound').value
    }});
    msg('eventMsg', 'Event settings saved.', true);
    await loadState();
  } catch (err) { msg('eventMsg', err.message); }
});

$('addVenueBtn').addEventListener('click', async () => {
  try {
    await api('/api/host/venue', { method: 'POST', body: {
      name: $('newVenueName').value,
      address: $('newVenueAddress').value,
      eventTitle: $('newVenueEvent').value,
      eventTime: $('newVenueTime').value
    }});
    $('newVenueName').value = '';
    $('newVenueAddress').value = '';
    msg('venueMsg', 'Venue added.', true);
    await loadState();
  } catch (err) { msg('venueMsg', err.message); }
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
