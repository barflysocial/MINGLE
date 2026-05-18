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

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value) {
  if (!value) return '';
  return new Date(value).toISOString();
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
  $('eventLine').textContent = `${e.title} • ${e.venue} • Round: ${e.roundStatus || 'scheduled'} • Starts: ${e.roundStartsAt ? new Date(e.roundStartsAt).toLocaleString() : 'not set'}`;
  $('eventTitle').value = e.title || '';
  $('eventVenue').value = e.venue || '';
  $('eventRsvp').value = e.rsvpCode || '';
  $('eventRound').value = e.roundLabel || '';
  $('eventRoundStart').value = toDatetimeLocal(e.roundStartsAt);
  $('eventAutoStart').checked = e.autoStartEnabled !== false;
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
    <div class="stat"><b>${s.reports.length}</b><span>Safety reports</span></div>
    <div class="stat"><b>${escapeHTML(e.roundStatus || 'scheduled')}</b><span>Round status</span></div>`;

  renderVenues();
  renderHotSpots();

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

function renderHotSpots() {
  const hot = hostState.hotSpots || {};
  const total = hot.totalCheckedInReady || 0;
  if ($('hotSpotCount')) $('hotSpotCount').textContent = `${total} checked in`;

  const section = (title, items) => `
    <div class="glass">
      <h3>${escapeHTML(title)}</h3>
      ${(items || []).slice(0, 6).map(item => `
        <div class="row space">
          <span>${escapeHTML(item.label)}</span>
          <strong>${item.count}</strong>
        </div>
      `).join('') || '<p class="small">No data yet.</p>'}
    </div>`;

  if ($('hotSpotsList')) {
    $('hotSpotsList').innerHTML = [
      section('Looking For', hot.intent),
      section('Match Radius', hot.matchScope),
      section('Age Groups', hot.ageRange),
      section('Top Values', hot.values)
    ].join('');
  }
}

function renderVenues() {
  const venues = hostState.venues || [];
  $('venuesHostList').innerHTML = venues.map(v => `
    <div class="venueHostCard glass" id="venue_${escapeHTML(v.id)}">
      <div class="row space wrap">
        <div class="row wrap" style="align-items:center">
          ${v.logoUrl ? `<img class="venueLogo" src="${escapeHTML(v.logoUrl)}" alt="${escapeHTML(v.name)} logo" />` : ''}
          <div>
            <h3>${escapeHTML(v.name)}</h3>
            <p class="small">${escapeHTML(v.address || '')}${v.city ? ' • ' + escapeHTML(v.city) : ''}</p>
            <p class="small">${escapeHTML(v.eventTitle || 'Mingle Night')} • ${escapeHTML(v.eventTime || 'Tonight')}</p>
            <p class="small">${v.isPaid ? 'Paid event' : 'Free event'}${v.paymentLink ? ' • Payment link added' : ''}</p>
            <p class="small">Checked in: ${v.checkedInCount || 0}${v.seatCap ? ` / ${v.seatCap}` : ''}${v.isFull ? ' • FULL' : ''}</p>
            <p class="small">Token: ${escapeHTML(v.token || '')}</p>
          </div>
        </div>
        <span class="pill ${v.status === 'open' ? 'ok' : 'warn'}">${escapeHTML(v.status || 'open')}</span>
      </div>

      <div class="grid2 venueEditGrid">
        <input id="name_${escapeHTML(v.id)}" value="${escapeHTML(v.name || '')}" placeholder="Venue name" />
        <input id="address_${escapeHTML(v.id)}" value="${escapeHTML(v.address || '')}" placeholder="Venue address" />
        <input id="city_${escapeHTML(v.id)}" value="${escapeHTML(v.city || '')}" placeholder="City" />
        <input id="logo_${escapeHTML(v.id)}" value="${escapeHTML(v.logoUrl || '')}" placeholder="Venue logo URL" />
        <input id="event_${escapeHTML(v.id)}" value="${escapeHTML(v.eventTitle || '')}" placeholder="Event title" />
        <input id="time_${escapeHTML(v.id)}" value="${escapeHTML(v.eventTime || '')}" placeholder="Event time" />
        <select id="paid_${escapeHTML(v.id)}">
          <option value="free" ${!v.isPaid ? 'selected' : ''}>Free event</option>
          <option value="paid" ${v.isPaid ? 'selected' : ''}>Paid event</option>
        </select>
        <input id="payment_${escapeHTML(v.id)}" value="${escapeHTML(v.paymentLink || '')}" placeholder="Payment link" />
        <input id="cap_${escapeHTML(v.id)}" type="number" min="0" value="${Number(v.seatCap) || 0}" placeholder="Seat cap" />
        <input id="token_${escapeHTML(v.id)}" value="${escapeHTML(v.token || '')}" placeholder="Custom QR/manual token" />
      </div>

      <div class="row wrap">
        <button class="secondary saveVenueBtn" data-venue="${escapeHTML(v.id)}">Save Venue</button>
        <button class="secondary showQrBtn" data-venue="${escapeHTML(v.id)}">Show Check-In QR</button>
        <button class="secondary toggleVenueBtn" data-venue="${escapeHTML(v.id)}" data-status="${v.status === 'open' ? 'closed' : 'open'}">${v.status === 'open' ? 'Close Check-In' : 'Open Check-In'}</button>
        <input class="deleteConfirm" id="delete_${escapeHTML(v.id)}" placeholder="Type DELETE" />
        <button class="danger deleteVenueBtn" data-venue="${escapeHTML(v.id)}">Delete Event</button>
      </div>
      <div class="qrBox hide" id="qr_${escapeHTML(v.id)}"></div>
    </div>
  `).join('') || '<div class="notice">No venues yet.</div>';

  document.querySelectorAll('.showQrBtn').forEach(btn => btn.addEventListener('click', () => showQr(btn.dataset.venue)));
  document.querySelectorAll('.toggleVenueBtn').forEach(btn => btn.addEventListener('click', () => toggleVenue(btn.dataset.venue, btn.dataset.status)));
  document.querySelectorAll('.saveVenueBtn').forEach(btn => btn.addEventListener('click', () => saveVenue(btn.dataset.venue)));
  document.querySelectorAll('.deleteVenueBtn').forEach(btn => btn.addEventListener('click', () => deleteVenue(btn.dataset.venue)));
}

async function saveVenue(venueId) {
  try {
    await api(`/api/host/venue/${venueId}/update`, { method: 'POST', body: {
      name: $(`name_${venueId}`).value,
      address: $(`address_${venueId}`).value,
      city: $(`city_${venueId}`).value,
      logoUrl: $(`logo_${venueId}`).value,
      eventTitle: $(`event_${venueId}`).value,
      eventTime: $(`time_${venueId}`).value,
      isPaid: $(`paid_${venueId}`).value === 'paid',
      paymentLink: $(`payment_${venueId}`).value,
      seatCap: $(`cap_${venueId}`).value,
      token: $(`token_${venueId}`).value
    }});
    await api(`/api/host/venue/${venueId}/token`, { method: 'POST', body: { token: $(`token_${venueId}`).value } });
    msg('venueMsg', 'Venue/event saved. QR code updated.', true);
    await loadState();
  } catch (err) { msg('venueMsg', err.message); }
}

async function deleteVenue(venueId) {
  try {
    const confirm = $(`delete_${venueId}`).value;
    const data = await api(`/api/host/venue/${venueId}/delete`, { method: 'POST', body: { confirm } });
    msg('venueMsg', data.message, true);
    await loadState();
  } catch (err) { msg('venueMsg', err.message); }
}

async function saveVenueToken(venueId) {
  try {
    const input = $(`token_${venueId}`);
    await api(`/api/host/venue/${venueId}/token`, { method: 'POST', body: { token: input.value } });
    msg('venueMsg', 'Venue token saved. QR code updated.', true);
    await loadState();
  } catch (err) { msg('venueMsg', err.message); }
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
      roundLabel: $('eventRound').value,
      roundStartsAt: fromDatetimeLocal($('eventRoundStart').value),
      autoStartEnabled: $('eventAutoStart').checked
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
      city: $('newVenueCity').value,
      logoUrl: $('newVenueLogo').value,
      eventTitle: $('newVenueEvent').value,
      eventTime: $('newVenueTime').value,
      isPaid: $('newVenuePaid').value === 'paid',
      paymentLink: $('newVenuePayment').value,
      seatCap: $('newVenueCap').value,
      token: $('newVenueToken').value
    }});
    $('newVenueName').value = '';
    $('newVenueAddress').value = '';
    $('newVenueCity').value = '';
    $('newVenueLogo').value = '';
    $('newVenuePayment').value = '';
    $('newVenueCap').value = '50';
    $('newVenueToken').value = '';
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
