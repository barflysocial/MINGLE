const app = document.getElementById('app');
const landingTemplate = document.getElementById('landingTemplate');
const local = {
  get playerId() { return localStorage.getItem('spark_player_id'); },
  set playerId(value) { value ? localStorage.setItem('spark_player_id', value) : localStorage.removeItem('spark_player_id'); },
  get host() { return localStorage.getItem('spark_host') === 'true'; },
  set host(value) { value ? localStorage.setItem('spark_host', 'true') : localStorage.removeItem('spark_host'); },
};

let state = {
  view: 'landing',
  player: null,
  event: null,
  matches: [],
  connections: [],
  hostEvents: [],
  selectedEventId: null,
  hostDashboard: null,
  chatId: null,
  chatMessages: []
};

const api = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setError(message) {
  const existing = document.querySelector('.error');
  if (existing) existing.remove();
  if (!message) return;
  const div = document.createElement('div');
  div.className = 'error';
  div.textContent = message;
  app.prepend(div);
}

function toast(message, type = 'success') {
  const div = document.createElement('div');
  div.className = type;
  div.textContent = message;
  app.prepend(div);
  setTimeout(() => div.remove(), 4000);
}

function currentRoundHtml() {
  const round = state.event?.currentRoundData;
  if (!round) return '<p class="muted">The host has not opened a round yet.</p>';
  return `
    <div class="mini-card glow">
      <div class="mini-title">${escapeHtml(round.name)}</div>
      <h3>${escapeHtml(round.mission)}</h3>
      <p>${escapeHtml(round.prompt)}</p>
      <span class="pill teal">${round.durationMinutes} minutes</span>
    </div>`;
}

function navTabs(active = 'dashboard') {
  return `
    <div class="nav-tabs">
      <button class="${active === 'dashboard' ? 'active' : ''}" data-player-tab="dashboard">Dashboard</button>
      <button class="${active === 'onboarding' ? 'active' : ''}" data-player-tab="onboarding">AI Profile</button>
      <button class="${active === 'matches' ? 'active' : ''}" data-player-tab="matches">Matches</button>
      <button class="${active === 'connections' ? 'active' : ''}" data-player-tab="connections">Unlocked Chat</button>
      <button class="${active === 'safety' ? 'active' : ''}" data-player-tab="safety">Safety</button>
      <button class="ghost" data-action="leave-player">Leave</button>
    </div>`;
}

function renderLanding() {
  state.view = 'landing';
  app.innerHTML = '';
  app.appendChild(landingTemplate.content.cloneNode(true));
  app.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.view === 'player') renderPlayerEntry();
    if (btn.dataset.view === 'host') renderHostLogin();
  }));
}

function renderPlayerEntry() {
  state.view = 'player-entry';
  app.innerHTML = `
    <section class="grid two">
      <div class="card">
        <h2>Join Spark Rounds</h2>
        <p>Create a private dating avatar, enter the RSVP code, and let SparkGuide build your dating profile.</p>
        <form id="joinForm" class="form-grid">
          <label>Avatar name
            <input name="avatarName" placeholder="Example: Velvet Storm" autocomplete="off" required>
          </label>
          <label>RSVP code
            <input name="rsvpCode" value="SPARK" autocomplete="off" required>
          </label>
          <label class="checkline"><input type="checkbox" name="ageConfirmed" required> I confirm I am 18 or older.</label>
          <button class="primary" type="submit">RSVP as Player</button>
          <button class="ghost" type="button" data-action="landing">Back</button>
        </form>
      </div>
      <div class="card">
        <h3>How this works</h3>
        <p>Players are known by avatar first. AI suggests who to talk to and what to ask. Chat unlocks only after mutual interest.</p>
        <div class="pill-row">
          <span class="pill hot">No swiping</span>
          <span class="pill teal">Mutual unlock only</span>
          <span class="pill">Block/report built in</span>
        </div>
      </div>
    </section>`;
  document.getElementById('joinForm').addEventListener('submit', joinPlayer);
  app.querySelector('[data-action="landing"]').addEventListener('click', renderLanding);
}

async function joinPlayer(event) {
  event.preventDefault();
  setError('');
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/player/join', {
      method: 'POST',
      body: JSON.stringify({
        avatarName: form.get('avatarName'),
        rsvpCode: form.get('rsvpCode'),
        ageConfirmed: form.get('ageConfirmed') === 'on'
      })
    });
    state.player = data.player;
    state.event = data.event;
    local.playerId = data.player.id;
    renderPlayerOnboarding();
  } catch (err) {
    setError(err.message);
  }
}

async function loadPlayer() {
  if (!local.playerId) return false;
  try {
    const data = await api(`/api/player/${local.playerId}`);
    state.player = data.player;
    state.event = data.event;
    return true;
  } catch {
    local.playerId = null;
    return false;
  }
}

function renderPlayerDashboard() {
  const p = state.player;
  const e = state.event;
  const statusClass = e.status === 'live' ? 'live' : 'wait';
  app.innerHTML = `
    ${navTabs('dashboard')}
    <section class="grid two">
      <div class="card">
        <div class="panel-title">
          <div>
            <p class="tag">Player Dashboard</p>
            <h2>${escapeHtml(p.avatarName)}</h2>
          </div>
          <span class="status ${statusClass}">${escapeHtml(e.status)}</span>
        </div>
        <p><strong>${escapeHtml(e.title)}</strong> at ${escapeHtml(e.venue)}</p>
        <div class="status-bar">
          <span class="status">RSVP Confirmed</span>
          <span class="status ${p.checkedIn ? 'live' : 'wait'}">${p.checkedIn ? 'Checked In' : 'Not Checked In'}</span>
          <span class="status ${p.profileComplete ? 'live' : 'wait'}">${p.profileComplete ? 'Profile Complete' : 'Profile Needed'}</span>
        </div>
        ${!p.checkedIn ? checkInFormHtml() : ''}
        ${!p.profileComplete ? '<div class="error">Finish your AI Profile so SparkGuide can suggest compatible players.</div>' : ''}
      </div>
      <div class="card">
        <p class="tag">Live Mission</p>
        ${currentRoundHtml()}
      </div>
    </section>
    <section class="card">
      <p class="tag">SparkGuide AI Coach</p>
      <h3>Ask for conversation help, match suggestions, or safety guidance.</h3>
      ${sparkChatHtml()}
    </section>`;
  wirePlayerNav();
  const checkForm = document.getElementById('checkInForm');
  if (checkForm) checkForm.addEventListener('submit', checkInPlayer);
  wireSparkChat();
}

function checkInFormHtml() {
  return `
    <hr>
    <form id="checkInForm" class="form-grid">
      <label>Host check-in code
        <input name="hostCode" value="HOST77" required>
      </label>
      <button class="secondary" type="submit">Check In</button>
    </form>`;
}

async function checkInPlayer(event) {
  event.preventDefault();
  setError('');
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/player/checkin', {
      method: 'POST',
      body: JSON.stringify({ playerId: state.player.id, hostCode: form.get('hostCode') })
    });
    state.player = data.player;
    state.event = data.event;
    toast('Checked in. You are ready for the host to start the game.');
    renderPlayerDashboard();
  } catch (err) {
    setError(err.message);
  }
}

function renderPlayerOnboarding() {
  const p = state.player || { profile: {} };
  app.innerHTML = `
    ${navTabs('onboarding')}
    <section class="grid two">
      <div class="card">
        <p class="tag">AI Onboarding</p>
        <h2>Build your dating avatar profile</h2>
        <p>SparkGuide uses this to suggest who to talk to and how to start the conversation. Keep it honest and simple.</p>
        <form id="profileForm" class="form-grid">
          <label>Dating goal
            <select name="goal" required>
              ${option('', 'Choose one', p.profile.goal)}
              ${option('serious relationship', 'Serious relationship', p.profile.goal)}
              ${option('casual dating', 'Casual dating', p.profile.goal)}
              ${option('friendship first', 'Friendship first', p.profile.goal)}
              ${option('open to connection', 'Open to connection', p.profile.goal)}
            </select>
          </label>
          <label>Top values <span class="muted">comma separated</span>
            <input name="values" value="${escapeHtml(p.profile.values || '')}" placeholder="loyalty, humor, peace" required>
          </label>
          <label>Interests <span class="muted">comma separated</span>
            <input name="interests" value="${escapeHtml(p.profile.interests || '')}" placeholder="live music, food, sports, travel">
          </label>
          <label>Social energy
            <select name="energy">
              ${option('', 'Choose one', p.profile.energy)}
              ${option('quiet', 'Quiet / reserved', p.profile.energy)}
              ${option('balanced', 'Balanced', p.profile.energy)}
              ${option('social', 'Social / outgoing', p.profile.energy)}
            </select>
          </label>
          <label>Dating pace
            <select name="pace" required>
              ${option('', 'Choose one', p.profile.pace)}
              ${option('slow burn', 'Slow burn', p.profile.pace)}
              ${option('steady and intentional', 'Steady and intentional', p.profile.pace)}
              ${option('chemistry first', 'Chemistry first', p.profile.pace)}
            </select>
          </label>
          <label>Green flags
            <input name="greenFlags" value="${escapeHtml(p.profile.greenFlags || '')}" placeholder="consistent, kind, communicates clearly">
          </label>
          <label>Dealbreakers
            <input name="dealbreakers" value="${escapeHtml(p.profile.dealbreakers || '')}" placeholder="dishonesty, pressure, drama">
          </label>
          <button class="primary" type="submit">Save AI Profile</button>
        </form>
      </div>
      <div class="card">
        <p class="tag">SparkGuide Preview</p>
        <h3>What the AI will do</h3>
        <p>It will turn your answers into compatibility reasons, safer conversation prompts, and match suggestions during live rounds.</p>
        <div class="mini-card">
          <div class="mini-title">Example</div>
          <p>“You both value loyalty and prefer a slow-burn pace. Ask: what does consistency look like in real dating?”</p>
        </div>
      </div>
    </section>`;
  wirePlayerNav();
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${String(selected || '') === String(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

async function saveProfile(event) {
  event.preventDefault();
  setError('');
  const f = new FormData(event.currentTarget);
  const profile = Object.fromEntries(f.entries());
  try {
    const data = await api('/api/player/profile', {
      method: 'POST',
      body: JSON.stringify({ playerId: state.player.id, profile })
    });
    state.player = data.player;
    toast('AI profile saved. SparkGuide can now suggest matches.');
    renderPlayerDashboard();
  } catch (err) {
    setError(err.message);
  }
}

function sparkChatHtml() {
  return `
    <div class="chat-window" id="sparkChatWindow">
      <div class="bubble ai"><small>SparkGuide AI</small>Ask me: “Who should I talk to?”, “What should I say?”, or “What is tonight’s mission?”</div>
    </div>
    <form class="chat-compose" id="sparkChatForm">
      <input name="message" placeholder="Ask SparkGuide..." autocomplete="off" required>
      <button class="secondary" type="submit">Send</button>
    </form>`;
}

function wireSparkChat() {
  const form = document.getElementById('sparkChatForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.message;
    const text = input.value.trim();
    if (!text) return;
    appendBubble('sparkChatWindow', 'user', state.player.avatarName, text);
    input.value = '';
    try {
      const data = await api('/api/spark/chat', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.player.id, message: text })
      });
      appendBubble('sparkChatWindow', 'ai', 'SparkGuide AI', data.reply);
    } catch (err) {
      appendBubble('sparkChatWindow', 'system', 'Safety', err.message);
    }
  });
}

function appendBubble(windowId, role, name, text) {
  const win = document.getElementById(windowId);
  if (!win) return;
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.innerHTML = `<small>${escapeHtml(name)}</small>${escapeHtml(text)}`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

async function renderMatches() {
  setError('');
  try {
    const data = await api(`/api/matches/${state.player.id}`);
    state.matches = data.matches;
  } catch (err) {
    setError(err.message);
  }
  app.innerHTML = `
    ${navTabs('matches')}
    <section class="card">
      <div class="panel-title">
        <div>
          <p class="tag">AI Match Suggestions</p>
          <h2>Suggested conversations</h2>
        </div>
        <button class="secondary" data-action="refresh-matches">Refresh</button>
      </div>
      <p>These are compatibility suggestions, not rankings. Private feedback unlocks chat only when interest is mutual.</p>
      <div id="matchesList">${matchesHtml()}</div>
    </section>`;
  wirePlayerNav();
  app.querySelector('[data-action="refresh-matches"]').addEventListener('click', renderMatches);
  app.querySelectorAll('[data-feedback]').forEach(btn => btn.addEventListener('click', saveFeedback));
}

function matchesHtml() {
  if (!state.player.profileComplete) return '<div class="error">Finish your AI Profile first.</div>';
  if (!state.player.checkedIn) return '<div class="error">Check in with the host code before matching.</div>';
  if (!state.matches.length) return '<p class="muted">No checked-in compatible players yet. Add a second demo player in another browser/device to test mutual unlock.</p>';
  return state.matches.map(m => `
    <article class="match-card">
      <div class="match-top">
        <div>
          <h3>${escapeHtml(m.avatarName)}</h3>
          <p>${m.reasons.map(escapeHtml).join(' ')}</p>
        </div>
        <div class="score">${m.score}%</div>
      </div>
      <div class="mini-card"><div class="mini-title">Icebreaker</div><p>${escapeHtml(m.icebreaker)}</p></div>
      <div class="button-row">
        <button class="ok" data-feedback="spark" data-target="${m.playerId}">Strong Spark</button>
        <button data-feedback="maybe" data-target="${m.playerId}">Maybe</button>
        <button data-feedback="friend" data-target="${m.playerId}">Friend Vibe</button>
        <button class="ghost" data-feedback="no" data-target="${m.playerId}">No Connection</button>
      </div>
    </article>`).join('');
}

async function saveFeedback(event) {
  const btn = event.currentTarget;
  setError('');
  try {
    const data = await api('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ fromPlayerId: state.player.id, toPlayerId: btn.dataset.target, choice: btn.dataset.feedback })
    });
    if (data.connectionUnlocked) {
      toast('Mutual interest unlocked a private chat.');
      await renderConnections();
    } else {
      toast('Private feedback saved. Chat unlocks only if interest is mutual.');
    }
  } catch (err) {
    setError(err.message);
  }
}

async function renderConnections() {
  setError('');
  try {
    const data = await api(`/api/connections/${state.player.id}`);
    state.connections = data.connections;
  } catch (err) {
    setError(err.message);
  }
  app.innerHTML = `
    ${navTabs('connections')}
    <section class="grid two">
      <div class="card">
        <p class="tag">Unlocked Connections</p>
        <h2>Mutual chats</h2>
        ${connectionsHtml()}
      </div>
      <div class="card" id="chatPanel">
        <p class="tag">Chat</p>
        <p class="muted">Select an unlocked connection. Messages are filtered for basic safety.</p>
      </div>
    </section>`;
  wirePlayerNav();
  app.querySelectorAll('[data-open-chat]').forEach(btn => btn.addEventListener('click', () => openChat(btn.dataset.openChat)));
}

function connectionsHtml() {
  if (!state.connections.length) return '<p class="muted">No mutual chats yet. Give private feedback after conversations to unlock chat.</p>';
  return state.connections.map(c => `
    <article class="match-card">
      <div class="match-top">
        <div>
          <h3>${escapeHtml(c.otherAvatarName)}</h3>
          <p>${escapeHtml(c.type)}</p>
        </div>
      </div>
      <div class="button-row">
        <button class="secondary" data-open-chat="${c.chatId}">Open Chat</button>
        <button class="danger" data-report-target="${c.otherPlayerId}">Report/Block</button>
      </div>
    </article>`).join('');
}

async function openChat(chatId) {
  state.chatId = chatId;
  const panel = document.getElementById('chatPanel');
  try {
    const data = await api(`/api/chats/${chatId}`);
    state.chatMessages = data.messages;
  } catch (err) {
    panel.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    return;
  }
  panel.innerHTML = `
    <p class="tag">Unlocked Chat</p>
    <div class="chat-window" id="mutualChatWindow">
      ${state.chatMessages.map(m => `<div class="bubble ${m.system ? 'system' : (m.fromPlayerId === state.player.id ? 'user' : 'ai')}"><small>${escapeHtml(m.from)}</small>${escapeHtml(m.text)}</div>`).join('')}
    </div>
    <form class="chat-compose" id="mutualChatForm">
      <input name="text" placeholder="Write a respectful message..." autocomplete="off" required>
      <button class="secondary" type="submit">Send</button>
    </form>`;
  document.getElementById('mutualChatForm').addEventListener('submit', sendMutualChat);
  const win = document.getElementById('mutualChatWindow');
  win.scrollTop = win.scrollHeight;
}

async function sendMutualChat(event) {
  event.preventDefault();
  const text = event.currentTarget.text.value.trim();
  if (!text) return;
  try {
    const data = await api(`/api/chats/${state.chatId}/message`, {
      method: 'POST',
      body: JSON.stringify({ fromPlayerId: state.player.id, text })
    });
    state.chatMessages = data.messages;
    event.currentTarget.text.value = '';
    await openChat(state.chatId);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderSafety() {
  app.innerHTML = `
    ${navTabs('safety')}
    <section class="grid two">
      <div class="card">
        <p class="tag">Safety Shield</p>
        <h2>Block or report</h2>
        <p>Use this if a player pressures you, sends invasive messages, harasses you, or makes you uncomfortable.</p>
        <form id="reportForm" class="form-grid">
          <label>Target player ID or avatar name
            <input name="target" placeholder="Use exact avatar name from matches/connections" required>
          </label>
          <label>Reason
            <textarea name="reason" placeholder="Briefly describe what happened"></textarea>
          </label>
          <button class="danger" type="submit">Report and Block</button>
        </form>
      </div>
      <div class="card">
        <h3>Boundaries built into MVP</h3>
        <p>No chat before mutual interest. Basic moderation blocks aggressive, explicit, invasive, or threatening content. Reports appear in the host dashboard.</p>
      </div>
    </section>`;
  wirePlayerNav();
  document.getElementById('reportForm').addEventListener('submit', reportByName);
}

async function reportByName(event) {
  event.preventDefault();
  const targetText = new FormData(event.currentTarget).get('target').trim().toLowerCase();
  const reason = new FormData(event.currentTarget).get('reason');
  const matches = await api(`/api/matches/${state.player.id}`);
  const connections = await api(`/api/connections/${state.player.id}`);
  const possible = [
    ...matches.matches.map(m => ({ id: m.playerId, name: m.avatarName })),
    ...connections.connections.map(c => ({ id: c.otherPlayerId, name: c.otherAvatarName }))
  ];
  const target = possible.find(p => p.id === targetText || p.name.toLowerCase() === targetText);
  if (!target) return setError('Could not find that player from your match/connection list.');
  try {
    await api('/api/report', { method: 'POST', body: JSON.stringify({ fromPlayerId: state.player.id, targetPlayerId: target.id, reason }) });
    toast('Report saved and player blocked.');
    renderPlayerDashboard();
  } catch (err) {
    setError(err.message);
  }
}

function wirePlayerNav() {
  app.querySelectorAll('[data-player-tab]').forEach(btn => btn.addEventListener('click', async () => {
    const tab = btn.dataset.playerTab;
    await loadPlayer();
    if (tab === 'dashboard') renderPlayerDashboard();
    if (tab === 'onboarding') renderPlayerOnboarding();
    if (tab === 'matches') renderMatches();
    if (tab === 'connections') renderConnections();
    if (tab === 'safety') renderSafety();
  }));
  app.querySelectorAll('[data-action="leave-player"]').forEach(btn => btn.addEventListener('click', () => { local.playerId = null; state.player = null; renderLanding(); }));
}

function renderHostLogin() {
  app.innerHTML = `
    <section class="grid two">
      <div class="card">
        <p class="tag">Host Access</p>
        <h2>Host Dashboard</h2>
        <form id="hostLoginForm" class="form-grid">
          <label>Host PIN
            <input name="pin" value="2468" type="password" required>
          </label>
          <button class="primary" type="submit">Enter Dashboard</button>
          <button class="ghost" type="button" data-action="landing">Back</button>
        </form>
      </div>
      <div class="card">
        <h3>Host controls</h3>
        <p>Create event codes, open check-in, start live rounds, move rounds forward, watch player count, and review reports.</p>
      </div>
    </section>`;
  document.getElementById('hostLoginForm').addEventListener('submit', hostLogin);
  app.querySelector('[data-action="landing"]').addEventListener('click', renderLanding);
}

async function hostLogin(event) {
  event.preventDefault();
  setError('');
  const pin = new FormData(event.currentTarget).get('pin');
  try {
    await api('/api/host/login', { method: 'POST', body: JSON.stringify({ pin }) });
    local.host = true;
    await renderHostDashboard();
  } catch (err) {
    setError(err.message);
  }
}

async function renderHostDashboard() {
  try {
    const data = await api('/api/host/events');
    state.hostEvents = data.events;
    state.selectedEventId = state.selectedEventId || state.hostEvents[0]?.id;
    if (state.selectedEventId) {
      const dash = await api(`/api/host/events/${state.selectedEventId}/dashboard`);
      state.hostDashboard = dash;
    }
  } catch (err) {
    setError(err.message);
  }
  const selected = state.hostDashboard;
  app.innerHTML = `
    <section class="card">
      <div class="panel-title">
        <div>
          <p class="tag">Host Dashboard</p>
          <h2>Spark Rounds Control</h2>
        </div>
        <button class="ghost" data-action="logout-host">Log out</button>
      </div>
      <div class="button-row">
        ${state.hostEvents.map(e => `<button class="${state.selectedEventId === e.id ? 'secondary' : ''}" data-select-event="${e.id}">${escapeHtml(e.title)}</button>`).join('')}
      </div>
    </section>
    <section class="grid two">
      <div class="card">
        <p class="tag">Create Event</p>
        <form id="createEventForm" class="form-grid">
          <label>Title <input name="title" placeholder="Singles Night at Venue" required></label>
          <label>Venue <input name="venue" placeholder="Venue name"></label>
          <label>RSVP Code <input name="rsvpCode" placeholder="MINGLE" required></label>
          <label>Check-in Code <input name="hostCode" placeholder="HOST77" required></label>
          <button class="primary" type="submit">Create Event</button>
        </form>
      </div>
      <div class="card">
        <p class="tag">Selected Event</p>
        ${selected ? hostSelectedHtml(selected) : '<p>No event selected.</p>'}
      </div>
    </section>
    ${selected ? hostTablesHtml(selected) : ''}`;
  app.querySelector('[data-action="logout-host"]').addEventListener('click', () => { local.host = false; renderLanding(); });
  app.querySelectorAll('[data-select-event]').forEach(btn => btn.addEventListener('click', async () => { state.selectedEventId = btn.dataset.selectEvent; await renderHostDashboard(); }));
  document.getElementById('createEventForm').addEventListener('submit', createEvent);
  app.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => updateEvent({ status: btn.dataset.status })));
  app.querySelectorAll('[data-round]').forEach(btn => btn.addEventListener('click', () => updateEvent({ currentRound: Number(btn.dataset.round), status: 'live' })));
  app.querySelectorAll('[data-next-round]').forEach(btn => btn.addEventListener('click', () => updateEvent({ nextRound: true, status: 'live' })));
  app.querySelectorAll('[data-reset-event]').forEach(btn => btn.addEventListener('click', resetEvent));
}

function hostSelectedHtml(dash) {
  const e = dash.event;
  return `
    <h3>${escapeHtml(e.title)}</h3>
    <p>${escapeHtml(e.venue)}</p>
    <div class="status-bar">
      <span class="status ${e.status === 'live' ? 'live' : 'wait'}">${escapeHtml(e.status)}</span>
      <span class="status">RSVP: ${escapeHtml(e.rsvpCode)}</span>
      <span class="status">Players: ${dash.players.length}</span>
      <span class="status">Checked in: ${dash.players.filter(p => p.checkedIn).length}</span>
    </div>
    ${currentHostRoundHtml(e)}
    <div class="button-row">
      <button data-status="rsvp">Open RSVP</button>
      <button data-status="checkin">Open Check-in</button>
      <button class="ok" data-status="live">Start Live</button>
      <button data-next-round="true">Next Round</button>
      <button data-status="ended">End Event</button>
      <button class="danger" data-reset-event="true">Full Reset</button>
    </div>`;
}

function currentHostRoundHtml(e) {
  const round = e.currentRoundData;
  if (!round) return '';
  return `<div class="mini-card"><div class="mini-title">Current Round</div><p><strong>${escapeHtml(round.name)}</strong><br>${escapeHtml(round.mission)}<br>${escapeHtml(round.prompt)}</p></div>`;
}

function hostTablesHtml(dash) {
  return `
    <section class="grid two">
      <div class="card">
        <p class="tag">Round Controls</p>
        <div class="button-row">
          ${dash.event.rounds.map(r => `<button data-round="${r.index}">${escapeHtml(r.name)}</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <p class="tag">Event Stats</p>
        <div class="status-bar">
          <span class="status">Feedback: ${dash.feedbackCount}</span>
          <span class="status">Connections: ${dash.connectionCount}</span>
          <span class="status ${dash.reports.length ? 'wait' : 'live'}">Reports: ${dash.reports.length}</span>
        </div>
      </div>
    </section>
    <section class="grid two">
      <div class="card">
        <p class="tag">Players</p>
        <table class="table"><thead><tr><th>Avatar</th><th>Status</th><th>Profile</th></tr></thead><tbody>
          ${dash.players.map(p => `<tr><td>${escapeHtml(p.avatarName)}</td><td>${p.checkedIn ? 'Checked in' : 'RSVP only'}</td><td>${p.profileComplete ? escapeHtml(p.aiSummary) : 'Incomplete'}</td></tr>`).join('') || '<tr><td colspan="3">No players yet.</td></tr>'}
        </tbody></table>
      </div>
      <div class="card">
        <p class="tag">Reports</p>
        <table class="table"><thead><tr><th>From</th><th>Target</th><th>Reason</th></tr></thead><tbody>
          ${dash.reports.map(r => `<tr><td>${escapeHtml(r.fromAvatarName)}</td><td>${escapeHtml(r.targetAvatarName)}</td><td>${escapeHtml(r.reason)}</td></tr>`).join('') || '<tr><td colspan="3">No reports.</td></tr>'}
        </tbody></table>
      </div>
    </section>`;
}

async function createEvent(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/host/events', { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) });
    state.selectedEventId = data.event.id;
    toast('Event created.');
    await renderHostDashboard();
  } catch (err) {
    setError(err.message);
  }
}

async function updateEvent(payload) {
  try {
    await api(`/api/host/events/${state.selectedEventId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await renderHostDashboard();
  } catch (err) {
    setError(err.message);
  }
}

async function resetEvent() {
  const ok = confirm('This removes all players, feedback, chats, and reports for this event. Continue?');
  if (!ok) return;
  try {
    await api(`/api/host/events/${state.selectedEventId}/reset`, { method: 'POST', body: '{}' });
    toast('Event reset complete.');
    await renderHostDashboard();
  } catch (err) {
    setError(err.message);
  }
}

async function boot() {
  document.getElementById('resetLocalBtn').addEventListener('click', () => {
    localStorage.removeItem('spark_player_id');
    localStorage.removeItem('spark_host');
    state = { view: 'landing', player: null, event: null, matches: [], connections: [], hostEvents: [], selectedEventId: null, hostDashboard: null, chatId: null, chatMessages: [] };
    renderLanding();
  });
  if (local.playerId && await loadPlayer()) return renderPlayerDashboard();
  if (local.host) return renderHostDashboard();
  renderLanding();
}

boot();
