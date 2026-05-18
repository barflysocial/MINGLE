const $ = (id) => document.getElementById(id);
const state = {
  playerId: localStorage.getItem('oneMatchPlayerId') || null,
  player: null,
  question: null,
  match: null,
  venues: [],
  publicPreview: null,
  authPhone: '',
  authExisting: false,
  event: null,
  serverOffsetMs: 0,
  selected: new Set(),
  timer: null,
  lobbyTimer: null,
  stream: null,
  qrStream: null,
  qrLoop: null,
  capturedReal: null,
  capturedAvatar: null,
  qrCanvas: null
};

const SETUP_STAGES = [
  'liveVerify',
  'identity',
  'ageRange',
  'orientation',
  'who',
  'values',
  'pace',
  'energy',
  'communication',
  'dealbreakers',
  'greenflags',
  'chemistry',
  'dateStyle',
  'heightImportance',
  'heightPreference',
  'buildSelf',
  'buildPreference',
  'styleSelf',
  'stylePreference',
  'attractionBalance',
  'matchScope',
  'intent',
  'followupPriority',
  'followupNonNegotiable',
  'complete'
];

function enableAntiCheatMode() {
  const blockedEvents = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'];
  blockedEvents.forEach(eventName => {
    document.addEventListener(eventName, (event) => {
      const allowed = event.target?.closest?.('[data-allow-paste="true"]');
      if (!allowed) event.preventDefault();
    });
  });
  document.addEventListener('selectstart', (event) => {
    const allowed = event.target?.closest?.('input, textarea, [data-allow-paste="true"]');
    if (!allowed) event.preventDefault();
  });
}
enableAntiCheatMode();

function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function cleanPhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function cleanPin(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

function resetAuthPanel() {
  state.authPhone = '';
  state.authExisting = false;
  if ($('phoneStep')) $('phoneStep').classList.remove('hide');
  if ($('pinStep')) $('pinStep').classList.add('hide');
  if ($('phoneNumber')) $('phoneNumber').value = '';
  if ($('pinInput')) $('pinInput').value = '';
  showMessage('joinMsg', '');
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showMessage(id, text, good = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || '';
  el.style.color = good ? 'var(--ok)' : 'var(--gold)';
}

function showApp() {
  $('landing').classList.add('hide');
  $('app').classList.remove('hide');
}

function showLanding() {
  $('landing').classList.remove('hide');
  $('app').classList.add('hide');
  $('titleScreen').classList.remove('hide');
  if ($('previewPanel')) $('previewPanel').classList.add('hide');
  $('joinPanel').classList.add('hide');
  resetAuthPanel();
}

function showJoinPanel() {
  showPreviewPanel();
}

async function showPreviewPanel() {
  $('titleScreen').classList.add('hide');
  $('joinPanel').classList.add('hide');
  if ($('previewPanel')) $('previewPanel').classList.remove('hide');
  await loadPublicPreview();
}

function showSignupPanel() {
  $('titleScreen').classList.add('hide');
  if ($('previewPanel')) $('previewPanel').classList.add('hide');
  $('joinPanel').classList.remove('hide');
  resetAuthPanel();
}

async function loadPublicPreview() {
  try {
    const data = await api('/api/public-preview');
    state.publicPreview = data;
    renderPublicPreview();
  } catch (err) {
    if ($('publicVenuesList')) $('publicVenuesList').innerHTML = '<div class="notice">Preview unavailable right now.</div>';
  }
}

function publicHotSpotBlock(title, items = []) {
  return `
    <div class="glass">
      <h3>${escapeHTML(title)}</h3>
      ${items.slice(0, 5).map(item => `
        <div class="row space">
          <span>${escapeHTML(item.label)}</span>
          <strong>${item.count}</strong>
        </div>
      `).join('') || '<p class="small">Building now</p>'}
    </div>
  `;
}

function renderPublicPreview() {
  const data = state.publicPreview || {};
  const venues = data.venues || [];
  if ($('publicVenuesList')) {
    $('publicVenuesList').innerHTML = venues.map(v => `
      <div class="venueCard publicVenueCard">
        ${v.logoUrl ? `<img class="venueLogo smallVenueLogo" src="${escapeHTML(v.logoUrl)}" alt="${escapeHTML(v.name)} logo" />` : ''}
        <div>
          <strong>${escapeHTML(v.name)}</strong>
          <p class="small">${escapeHTML(v.address || v.city || '')}</p>
          <p class="small">${escapeHTML(v.eventTitle || 'Mingle Night')} • ${escapeHTML(v.eventTime || 'Tonight')}</p>
          <p class="small">${v.isPaid ? 'Paid event' : 'Free event'}${v.seatCap ? ` • ${v.isFull ? 'Full' : `${v.seatsRemaining} seats available`}` : ''}</p>
          ${v.drinkSpecials ? `<p class="drinkSpecial">Drink Special: ${escapeHTML(v.drinkSpecials)}</p>` : ''}
          ${v.isPaid && v.paymentLink ? `<a class="button secondary" href="${escapeHTML(v.paymentLink)}" target="_blank" rel="noopener">Payment Link</a>` : ''}
        </div>
        <span class="pill ${v.status === 'open' && !v.isFull ? 'ok' : 'warn'}">${v.isFull ? 'Full' : escapeHTML(v.status || 'open')}</span>
      </div>
    `).join('') || '<div class="notice">No participating venues listed yet.</div>';
  }

  const hot = data.hotSpots || {};
  if ($('publicHotSpotsList')) {
    $('publicHotSpotsList').innerHTML = [
      publicHotSpotBlock('Looking For', hot.intent),
      publicHotSpotBlock('Match Radius', hot.matchScope)
    ].join('');
  }
}


async function loadPlayer() {
  if (!state.playerId) return;
  try {
    const data = await api(`/api/player/${state.playerId}`);
    state.player = data.player;
    state.question = data.question;
    state.match = data.match;
    state.event = data.event || state.event;
    if (state.event?.serverTime) state.serverOffsetMs = Date.parse(state.event.serverTime) - Date.now();
    state.venues = data.venues || [];
    render();
  } catch (err) {
    localStorage.removeItem('oneMatchPlayerId');
    state.playerId = null;
    stopCamera();
    stopQrScanner();
    showLanding();
  }
}

async function loadVenues() {
  try {
    const data = await api('/api/venues');
    state.venues = data.venues || [];
    renderVenues();
  } catch {}
}


function setupStepInfo() {
  const stage = state.question?.stage;
  if (!state.player?.liveVerified || stage === 'liveVerify') {
    return { step: 3, total: 6, label: 'Step 3: Take Picture', percent: 42 };
  }

  const aboutYou = new Set([
    'identity','ageRange','orientation','values','pace','energy','communication','dealbreakers',
    'greenflags','chemistry','dateStyle','heightImportance','heightPreference','buildSelf',
    'buildPreference','styleSelf','stylePreference','attractionBalance'
  ]);

  const lookingFor = new Set(['who','preferredAgeRange','matchScope','intent','followupPriority','followupNonNegotiable']);

  if (state.player?.ready && state.player?.avatarNameAssigned) {
    return { step: 6, total: 6, label: 'Step 6: Identity Ready', percent: 100 };
  }
  if (aboutYou.has(stage)) {
    return { step: 4, total: 6, label: 'Step 4: Questions About You', percent: 52 + Math.round((SETUP_STAGES.indexOf(stage) / SETUP_STAGES.length) * 22) };
  }
  if (lookingFor.has(stage)) {
    return { step: 5, total: 6, label: 'Step 5: Who You’re Looking For', percent: 78 + Math.round((SETUP_STAGES.indexOf(stage) / SETUP_STAGES.length) * 12) };
  }
  return { step: 4, total: 6, label: 'Profile Setup', percent: 55 };
}

function updateSetupProgress() {
  const info = setupStepInfo();
  const percent = Math.max(0, Math.min(100, info.percent));
  if ($('setupProgressText')) $('setupProgressText').textContent = `${info.label} • Step ${info.step} of ${info.total}`;
  if ($('setupProgressPercent')) $('setupProgressPercent').textContent = `${percent}%`;
  if ($('setupProgressFill')) $('setupProgressFill').style.width = `${percent}%`;
  if ($('setupProgressTitle')) $('setupProgressTitle').textContent = state.player?.ready ? 'Setup Complete' : 'Profile Setup';
}


function render() {
  if (!state.player) return;
  showApp();
  if ($('topStatusCard')) $('topStatusCard').classList.add('hide');
  $('playerTitle').textContent = state.player.avatarName ? `${state.player.avatarName} • Mingle` : 'Mingle Setup';
  const verification = state.player.liveVerified ? 'Live verified' : 'Live verification required';
  const check = state.player.checkedIn ? `Checked in at ${state.player.checkedInVenueName || 'venue'}` : 'Not checked in';
  const ready = state.player.ready ? 'Preferences complete' : 'Preferences in progress';
  $('playerStatus').textContent = `${verification} • ${ready} • ${check}`;
  updateSetupProgress();

  const inLobby = !!(state.player.checkedIn && !state.match);
  if (inLobby) {
    renderWaiting();
    renderMatch();
    return;
  }
  renderVerification();
  renderProfileCard();
  renderQuestion();
  renderCheckin();
  renderWaiting();
  renderMatch();
}

function renderVerification() {
  const verified = !!state.player.liveVerified;
  $('verificationCard').classList.toggle('hide', verified);

  // Hide avatar/profile identity until full setup is complete.
  const revealIdentity = !!(state.player.ready && state.player.avatarNameAssigned && state.player.avatarImage && state.player.avatarName);
  $('profileCard').classList.toggle('hide', !revealIdentity);
  $('profileCard').classList.toggle('setup-hidden', !revealIdentity);
  if (!revealIdentity) $('profileCard').style.display = 'none';

  const challengeEl = $('liveChallengeText');
  if (challengeEl) challengeEl.textContent = state.player.liveChallenge || 'Complete the challenge shown here.';

  $('verifyPill').textContent = verified ? 'Verified' : 'Required';
  $('verifyPill').className = `pill ${verified ? 'ok' : 'warn'}`;
  if (verified) stopCamera();

  if (state.capturedReal && $('realPreview')) $('realPreview').src = state.capturedReal;
  if (state.capturedAvatar && $('avatarPreview')) { $('avatarPreview').src = state.capturedAvatar; $('avatarPreview').classList.add('hide'); }
}

function renderProfileCard() {
  const card = $('profileCard');
  const revealIdentity = !!(state.player.ready && state.player.avatarNameAssigned && state.player.avatarImage && state.player.avatarName);

  if (!revealIdentity) {
    card.classList.add('hide', 'setup-hidden');
    card.style.display = 'none';
    card.innerHTML = '';
    return;
  }

  card.style.display = '';
  card.classList.remove('hide', 'setup-hidden');
  card.innerHTML = `
    <h2>Identity Ready</h2>
    <div class="profileHero revealHero cleanReveal">
      <img class="avatarLarge" src="${state.player.avatarImage}" alt="Your pixel avatar" />
      <div>
        <h3>${escapeHTML(state.player.avatarName)}</h3>
        <button class="hot" type="button" onclick="document.getElementById('checkinCard')?.scrollIntoView({behavior:'smooth', block:'start'});">Check In at Venue</button>
      </div>
    </div>
  `;
}

function renderQuestion() {
  const q = state.question || {};
  state.selected = new Set();
  if ($('aiLine')) $('aiLine').classList.add('hide');

  $('questionText').textContent = q.question || '';
  $('choices').innerHTML = '';
  $('freeAnswerWrap').classList.add('hide');
  $('answerBtn').classList.add('hide');
  $('answerBtn').disabled = false;
  $('answerBtn').textContent = 'Continue';
  if ($('doneMultiBtn')) $('doneMultiBtn').classList.add('hide');

  const helperText = q.multi ? `Choose up to ${q.max || 3}` : '';
  if ($('questionHelper')) {
    $('questionHelper').textContent = helperText;
    $('questionHelper').classList.toggle('hide', !helperText);
  }

  if ($('progressPill')) $('progressPill').classList.add('hide');

  if (q.liveVerify) {
    $('questionText').textContent = 'Step 3: Take Picture';
    if ($('questionHelper')) {
      $('questionHelper').textContent = '';
      $('questionHelper').classList.add('hide');
    }
    $('choices').innerHTML = '';
    return;
  }

  if (q.complete) {
    $('questionText').textContent = 'Identity Ready';
    $('choices').innerHTML = '<div class="notice">Your profile is complete. Check in at a participating venue when you arrive.</div>';
    return;
  }

  if (q.options && q.options.length) {
    if (q.multi && $('doneMultiBtn')) {
      $('doneMultiBtn').classList.remove('hide');
      $('doneMultiBtn').disabled = true;
      $('doneMultiBtn').textContent = 'Done';
    }

    q.options.forEach(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.textContent = option;
      btn.addEventListener('click', async () => {
        if (q.multi) {
          if (state.selected.has(option)) state.selected.delete(option);
          else if (state.selected.size < (q.max || 3)) state.selected.add(option);
          [...$('choices').children].forEach(child => child.classList.toggle('selected', state.selected.has(child.textContent)));
          if ($('doneMultiBtn')) $('doneMultiBtn').disabled = state.selected.size === 0;
          if (state.selected.size >= (q.max || 3)) await submitCurrentAnswer([...state.selected]);
          return;
        }
        state.selected = new Set([option]);
        btn.classList.add('selected');
        await submitCurrentAnswer(option);
      });
      $('choices').appendChild(btn);
    });
  } else {
    $('freeAnswerWrap').classList.remove('hide');
    $('freeAnswer').value = '';
    $('answerBtn').classList.remove('hide');
  }
}

function renderVenues() {
  const wrap = $('venuesList');
  if (!wrap) return;
  wrap.innerHTML = (state.venues || []).map(v => `
    <div class="venueCard">
      ${v.logoUrl ? `<img class="venueLogo smallVenueLogo" src="${escapeHTML(v.logoUrl)}" alt="${escapeHTML(v.name)} logo" />` : ''}
      <div>
        <strong>${escapeHTML(v.name)}</strong>
        <p class="small">${escapeHTML(v.address || v.city || '')}</p>
        <p class="small">${escapeHTML(v.eventTitle || 'Mingle Night')} • ${escapeHTML(v.eventTime || 'Tonight')}</p>
        <p class="small">${v.isPaid ? 'Paid event' : 'Free event'}${v.isPaid && v.paymentLink ? ' • Payment required before check-in' : ''}</p>
        ${v.drinkSpecials ? `<p class="drinkSpecial">Drink Special: ${escapeHTML(v.drinkSpecials)}</p>` : ''}
        ${v.isPaid && v.paymentLink ? `<a class="button secondary" href="${escapeHTML(v.paymentLink)}" target="_blank" rel="noopener">Payment Link</a>` : ''}
      </div>
      <span class="pill ${v.status === 'open' ? 'ok' : 'warn'}">${escapeHTML(v.status || 'open')}</span>
    </div>
  `).join('') || '<div class="notice">No participating venues listed yet.</div>';
}

function renderCheckin() {
  const canShow = !!(state.player.liveVerified && state.player.ready && state.player.avatarNameAssigned);
  $('checkinCard').classList.toggle('hide', !canShow || state.player.checkedIn);
  if (canShow && !state.player.checkedIn) {
    renderVenues();
    showMessage('checkinMsg', 'Scan the QR code at your participating venue to enter the matching pool.', true);
  }
}

function renderWaiting() {
  const waiting = !!(state.player.checkedIn && !state.match);
  $('waitingCard').classList.toggle('hide', !waiting);
  const setupIds = ['topStatusCard','setupProgressCard','verificationCard','profileCard','aiCard','checkinCard'];
  setupIds.forEach(id => { if ($(id)) $(id).classList.toggle('hide', waiting); });

  if (waiting) {
    if ($('lobbyAvatar')) $('lobbyAvatar').src = state.player.avatarImage || '';
    if ($('lobbyName')) $('lobbyName').textContent = state.player.avatarName || 'Mingle Lobby';
    if ($('lobbyVenue')) $('lobbyVenue').textContent = state.player.checkedInVenueName ? `Checked in at ${state.player.checkedInVenueName}` : '';
    startLobbyCountdown();
  } else {
    stopLobbyCountdown();
  }
}

function serverNowMs() {
  return Date.now() + (state.serverOffsetMs || 0);
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes}:${seconds}`;
  const hours = Math.floor(minutes / 60);
  const rem = String(minutes % 60).padStart(2, '0');
  return `${hours}:${rem}:${seconds}`;
}

function stopLobbyCountdown() {
  if (state.lobbyTimer) clearInterval(state.lobbyTimer);
  state.lobbyTimer = null;
}

function startLobbyCountdown() {
  stopLobbyCountdown();
  const startsAt = state.event?.roundStartsAt;
  const startMs = Date.parse(startsAt || '');
  const countdownBlock = document.querySelector('.countdownBlock');

  const tick = async () => {
    if (!startsAt || !Number.isFinite(startMs)) {
      if (countdownBlock) countdownBlock.classList.add('hide');
      if ($('lobbyCountdown')) $('lobbyCountdown').textContent = '';
      $('waitingText').textContent = 'Waiting for the host to start the match round.';
      return;
    }

    if (countdownBlock) countdownBlock.classList.remove('hide');
    const left = startMs - serverNowMs();
    if (left > 0) {
      $('lobbyCountdown').textContent = formatCountdown(left);
      $('waitingText').textContent = state.event?.autoStartEnabled
        ? 'Stay nearby. The match round will start automatically from server time.'
        : 'Stay nearby. The host has scheduled a start time, but manual start is still available.';
    } else {
      $('lobbyCountdown').textContent = 'Starting…';
      $('waitingText').textContent = state.event?.autoStartEnabled
        ? 'The server is starting the match round. If nothing changes, the host can start it manually.'
        : 'Waiting for the host to start the match round.';
      if (state.event?.autoStartEnabled && !state._pollingLobby) {
        state._pollingLobby = true;
        setTimeout(async () => {
          state._pollingLobby = false;
          await loadPlayer();
        }, 2500);
      }
    }
  };
  tick();
  state.lobbyTimer = setInterval(tick, 1000);
}

function renderMatch() {
  const match = state.match;
  $('matchCard').classList.toggle('hide', !match || !match.other);
  $('chatCard').classList.toggle('hide', !match?.chatUnlocked);
  if (!match || !match.other) {
    if (match?.noMatchMessage) showMessage('checkinMsg', match.noMatchMessage);
    return;
  }
  $('waitingCard').classList.add('hide');
  if ($('topStatusCard')) $('topStatusCard').classList.add('hide');
  stopLobbyCountdown();
  $('matchIntro').textContent = `Your strongest match tonight is ${match.other.avatarName}.`;
  $('scorePill').textContent = `${match.score}% match`;
  $('matchAvatar').src = match.other.avatarImage || state.player.avatarImage || '';
  $('matchVenueLine').textContent = match.crossVenue
    ? `Cross-venue match: ${match.myVenue?.name || 'your venue'} + ${match.otherVenue?.name || 'their venue'}`
    : `Same-venue match: ${match.myVenue?.name || state.player.checkedInVenueName || 'venue'}`;
  $('reasonList').innerHTML = (match.reasons || []).map(r => `<li>${escapeHTML(r)}</li>`).join('');
  $('sparkPrompt').textContent = match.prompt || '';
  $('ratingMsg').textContent = match.myRating ? `Your private rating: ${match.myRating}` : '';
  if (match.firstSparkStartedAt) startLocalTimer(match.firstSparkStartedAt);
  else $('sparkTimer').textContent = 'Not started';
  renderChat();
}

function startLocalTimer(startIso) {
  clearInterval(state.timer);
  const start = new Date(startIso).getTime();
  const total = 7 * 60 * 1000;
  function tick() {
    const left = Math.max(0, total - (Date.now() - start));
    const min = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
    $('sparkTimer').textContent = left ? `${min}:${sec} left` : 'Time is up — rate privately';
    $('sparkTimer').className = `pill ${left ? 'warn' : 'ok'}`;
  }
  tick();
  state.timer = setInterval(tick, 1000);
}

function renderChat() {
  const match = state.match;
  if (!match?.chatUnlocked) return;
  $('chatBox').innerHTML = (match.chat || []).map(m => {
    const cls = m.fromMe ? 'me' : (m.avatarName === 'One Match AI' ? 'system' : 'other');
    return `<div class="bubble ${cls}"><strong>${escapeHTML(m.fromMe ? 'You' : m.avatarName)}</strong><br>${escapeHTML(m.text)}</div>`;
  }).join('');
  $('datePlan').classList.toggle('hide', !match.datePlan);
  $('datePlan').textContent = match.datePlan || '';

  $('crossVenueCard').classList.toggle('hide', !match.crossVenue);
  $('sameVenueReveal').classList.toggle('hide', !!match.crossVenue);

  if (match.crossVenue) renderCrossVenueFlow(match);
  else renderSameVenuePhotoReveal(match);

  const mutual = match.myContactRequest && match.otherContactRequest;
  if (mutual) $('contactMsg').textContent = `Both contact preferences are saved. You: ${match.myContactRequest.type}. Match: ${match.otherContactRequest.type}.`;
}

function renderSameVenuePhotoReveal(match) {
  if (match.revealUnlocked) {
    $('revealMsg').textContent = 'Both of you agreed. Real live photos are now revealed.';
    $('revealMsg').style.color = 'var(--ok)';
    $('revealedWrap').classList.remove('hide');
    if (match.myRealPhoto) $('myRevealImgSame').src = match.myRealPhoto;
    if (match.otherRealPhoto) $('otherRevealImgSame').src = match.otherRealPhoto;
  } else {
    $('revealedWrap').classList.add('hide');
    if (match.myRevealRequest && !match.otherRevealRequest) showMessage('revealMsg', 'Your request is saved. Photos reveal only if the other person agrees too.');
    else if (!match.myRevealRequest && match.otherRevealRequest) showMessage('revealMsg', 'Your match is open to real-photo reveal. If you agree, request it here.');
    else showMessage('revealMsg', '');
  }
}

function renderCrossVenueFlow(match) {
  if (match.meetInterest?.both) {
    showMessage('meetMsg', 'Both of you are open to meeting tonight. Live-verified photos are displayed before venue selection.', true);
  } else if (match.meetInterest?.mine) {
    showMessage('meetMsg', 'Your meet-up interest is saved. Venue choice opens if your match agrees too.');
  } else if (match.meetInterest?.other) {
    showMessage('meetMsg', 'Your match is open to meeting tonight. Tap if you are open too.');
  } else {
    showMessage('meetMsg', 'Cross-venue meetup requires both people to agree first.');
  }

  $('photoRevealWrap').classList.toggle('hide', !match.revealUnlocked);
  if (match.revealUnlocked) {
    if (match.myRealPhoto) $('myRevealImg').src = match.myRealPhoto;
    if (match.otherRealPhoto) $('otherRevealImg').src = match.otherRealPhoto;
  }

  const canChooseVenue = !!(match.crossVenue && match.meetInterest?.both && match.revealUnlocked);
  $('meetVenueWrap').classList.toggle('hide', !canChooseVenue);
  if (canChooseVenue) {
    const options = [match.myVenue, match.otherVenue].filter(Boolean);
    $('meetVenueChoices').innerHTML = options.map(v => `
      <button class="choice meetVenueBtn" data-venue="${escapeHTML(v.id)}">
        <strong>${escapeHTML(v.name)}</strong><br>
        <span class="small">${escapeHTML(v.address || v.city || '')}</span>
      </button>
    `).join('');
    document.querySelectorAll('.meetVenueBtn').forEach(btn => btn.addEventListener('click', () => chooseMeetVenue(btn.dataset.venue)));
    if (match.meetVenueChoice?.confirmedVenue) {
      $('meetVenueChoices').insertAdjacentHTML('beforeend', `<div class="notice">Meet-up confirmed at ${escapeHTML(match.meetVenueChoice.confirmedVenue.name)}.</div>`);
    } else if (match.meetVenueChoice?.mine) {
      $('meetVenueChoices').insertAdjacentHTML('beforeend', `<div class="notice">Your venue choice is saved. It confirms only if both people choose the same venue.</div>`);
    }
  }
}

async function startCamera() {
  try {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    state.stream = stream;
    $('liveVideo').srcObject = stream;
    $('liveVideo').classList.remove('hide');
    $('avatarPreview').classList.add('hide');
    $('retakeBtn').classList.add('hide');
    $('submitVerificationBtn').classList.add('hide');
    $('captureBtn').classList.remove('hide');
    showMessage('verifyMsg', 'Camera is ready. Take your picture when you are ready.', true);
  } catch (err) {
    showMessage('verifyMsg', 'Camera access failed. Please allow camera permission.');
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  if ($('liveVideo')) $('liveVideo').srcObject = null;
}

function createCartoonAvatar(sourceCanvas, targetCanvas) {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const size = 720;
  const pixel = 30;
  const pad = 52;
  const card = size - pad * 2;

  targetCanvas.width = size;
  targetCanvas.height = size;

  const temp = document.createElement('canvas');
  temp.width = card;
  temp.height = card;
  const t = temp.getContext('2d');
  const crop = Math.min(srcW, srcH);
  const sx = Math.max(0, (srcW - crop) / 2);
  const sy = Math.max(0, (srcH - crop) / 2);
  t.drawImage(sourceCanvas, sx, sy, crop, crop, 0, 0, card, card);

  const small = document.createElement('canvas');
  small.width = Math.ceil(card / pixel);
  small.height = Math.ceil(card / pixel);
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(temp, 0, 0, small.width, small.height);

  const ctx = targetCanvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#140d2d');
  bg.addColorStop(.45, '#7b1fb3');
  bg.addColorStop(1, '#00d9ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Rounded-square privacy avatar card.
  ctx.save();
  roundRect(ctx, pad, pad, card, card, 42);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, pad, pad, card, card);

  // Slight dark privacy tint.
  ctx.fillStyle = 'rgba(10,8,24,.18)';
  ctx.fillRect(pad, pad, card, card);

  // Pixel grid overlay.
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  for (let x = pad; x <= pad + card; x += pixel) {
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + card); ctx.stroke();
  }
  for (let y = pad; y <= pad + card; y += pixel) {
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + card, y); ctx.stroke();
  }
  ctx.restore();

  // Neon rounded-square frame.
  ctx.lineWidth = 16;
  const ring = ctx.createLinearGradient(0, 0, size, 0);
  ring.addColorStop(0, '#ff6bd6');
  ring.addColorStop(.5, '#ffffff');
  ring.addColorStop(1, '#4de8ff');
  ctx.strokeStyle = ring;
  roundRect(ctx, pad - 8, pad - 8, card + 16, card + 16, 50);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  roundRect(ctx, pad + 12, pad + 12, card - 24, card - 24, 32);
  ctx.stroke();

  // Badge.
  ctx.fillStyle = 'rgba(10,8,25,.82)';
  roundRect(ctx, 92, 622, 536, 58, 22);
  ctx.fill();
  ctx.font = 'bold 27px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE VERIFIED PIXEL AVATAR', size / 2, 660);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function captureLiveSelfie() {
  const video = $('liveVideo');
  if (!video.srcObject) return showMessage('verifyMsg', 'Start the camera first.');
  const realCanvas = $('realCanvas');
  const avatarCanvas = $('avatarCanvas');
  const width = video.videoWidth || 480;
  const height = video.videoHeight || 360;
  realCanvas.width = width;
  realCanvas.height = height;
  realCanvas.getContext('2d').drawImage(video, 0, 0, width, height);
  createCartoonAvatar(realCanvas, avatarCanvas);
  state.capturedReal = realCanvas.toDataURL('image/jpeg', 0.82);
  state.capturedAvatar = avatarCanvas.toDataURL('image/jpeg', 0.82);
  $('realPreview').src = state.capturedReal;
  $('avatarPreview').src = state.capturedAvatar;
  // Do not reveal the pixel avatar during setup. It is revealed after the profile is complete.
  $('avatarPreview').classList.add('hide');
  $('liveVideo').classList.add('hide');
  $('captureBtn').classList.add('hide');
  $('retakeBtn').classList.remove('hide');
  $('submitVerificationBtn').classList.remove('hide');
  showMessage('verifyMsg', 'Picture captured. Tap Use This Picture to start the setup questions.', true);
}

function retakeCapture() {
  state.capturedReal = null;
  state.capturedAvatar = null;
  $('realPreview').removeAttribute('src');
  $('avatarPreview').removeAttribute('src');
  $('avatarPreview').classList.add('hide');
  $('liveVideo').classList.remove('hide');
  $('captureBtn').classList.remove('hide');
  $('retakeBtn').classList.add('hide');
  $('submitVerificationBtn').classList.add('hide');
  showMessage('verifyMsg', 'Retake ready. Take another picture when ready.', true);
}

async function submitVerification() {
  if (!state.capturedReal || !state.capturedAvatar) return showMessage('verifyMsg', 'Capture a live selfie first.');
  try {
    const data = await api(`/api/player/${state.playerId}/live-verify`, {
      method: 'POST',
      body: { challenge: state.player.liveChallenge, realImage: state.capturedReal, avatarImage: state.capturedAvatar }
    });
    state.player = data.player;
    state.question = data.question;
    showMessage('verifyMsg', 'Picture saved. Starting Step 2: questions about you.', true);
    stopCamera();
    render();
  } catch (err) { showMessage('verifyMsg', err.message); }
}

function extractTokenFromQr(raw) {
  const value = String(raw || '').trim();
  try {
    const u = new URL(value);
    return u.searchParams.get('checkinToken') || u.searchParams.get('token') || u.searchParams.get('venue') || value;
  } catch {
    return value;
  }
}

async function startQrScanner() {
  if (!state.player?.ready || !state.player?.avatarNameAssigned) {
    return showMessage('checkinMsg', 'Finish your profile before venue check-in.');
  }
  $('qrScanner').classList.remove('hide');
  $('manualTokenWrap').classList.add('hide');
  showMessage('qrMsg', 'Opening camera...', true);

  try {
    stopQrScanner();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false
    });
    state.qrStream = stream;
    $('qrVideo').srcObject = stream;
    await $('qrVideo').play().catch(() => {});

    if (typeof window.jsQR !== 'function') {
      $('manualTokenWrap').classList.remove('hide');
      showMessage('qrMsg', 'QR scanner library did not load. You can enter the venue token manually.');
      return;
    }

    state.qrCanvas = document.createElement('canvas');
    const ctx = state.qrCanvas.getContext('2d', { willReadFrequently: true });

    const scan = async () => {
      if (!state.qrStream) return;
      const video = $('qrVideo');
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth && video.videoHeight) {
        state.qrCanvas.width = video.videoWidth;
        state.qrCanvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, state.qrCanvas.width, state.qrCanvas.height);
        const imageData = ctx.getImageData(0, 0, state.qrCanvas.width, state.qrCanvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const token = extractTokenFromQr(code.data);
          await completeQrCheckin(token);
          return;
        }
      }
      state.qrLoop = requestAnimationFrame(scan);
    };

    state.qrLoop = requestAnimationFrame(scan);
    showMessage('qrMsg', 'Point your camera at the venue QR code.', true);
  } catch {
    $('manualTokenWrap').classList.remove('hide');
    showMessage('qrMsg', 'Camera access failed. Allow camera permission or enter the venue token.');
  }
}

function stopQrScanner() {
  if (state.qrLoop) cancelAnimationFrame(state.qrLoop);
  state.qrLoop = null;
  if (state.qrStream) {
    state.qrStream.getTracks().forEach(track => track.stop());
    state.qrStream = null;
  }
  state.qrCanvas = null;
  if ($('qrVideo')) $('qrVideo').srcObject = null;
}


async function completeQrCheckin(token) {
  try {
    const data = await api(`/api/player/${state.playerId}/checkin`, { method: 'POST', body: { token } });
    state.player = data.player;
    stopQrScanner();
    $('qrScanner').classList.add('hide');
    showMessage('checkinMsg', data.message, true);
    await loadPlayer();
  } catch (err) { showMessage('qrMsg', err.message); }
}

async function chooseMeetVenue(venueId) {
  try {
    const data = await api(`/api/match/${state.match.id}/meet-venue`, { method: 'POST', body: { playerId: state.playerId, venueId } });
    state.match = data.match;
    showMessage('meetMsg', data.message, true);
    renderChat();
  } catch (err) { showMessage('meetMsg', err.message); }
}

$('titleScreen').addEventListener('click', showJoinPanel);
$('tapToEnterBtn').addEventListener('click', (e) => { e.stopPropagation(); showJoinPanel(); });
if ($('tapToMingleBtn')) $('tapToMingleBtn').addEventListener('click', showSignupPanel);
$('termsLink').addEventListener('click', () => $('termsModal').classList.remove('hide'));
$('closeTermsBtn').addEventListener('click', () => $('termsModal').classList.add('hide'));
$('termsModal').addEventListener('click', (e) => { if (e.target.id === 'termsModal') $('termsModal').classList.add('hide'); });

if ($('phoneNumber')) $('phoneNumber').addEventListener('input', () => {
  $('phoneNumber').value = cleanPhone($('phoneNumber').value);
});
if ($('pinInput')) $('pinInput').addEventListener('input', () => {
  $('pinInput').value = cleanPin($('pinInput').value);
});

$('phoneNextBtn').addEventListener('click', async () => {
  const phone = cleanPhone($('phoneNumber').value);
  if (phone.length !== 10) return showMessage('joinMsg', 'Enter a valid 10-digit mobile number.');
  if (!$('ageConfirmed').checked) return showMessage('joinMsg', 'Confirm you are 18 or older.');
  if (!$('termsAccepted').checked) return showMessage('joinMsg', 'Agree to the Terms and Conditions to continue.');

  try {
    const data = await api('/api/auth/check-phone', { method: 'POST', body: { phone } });
    state.authPhone = phone;
    state.authExisting = !!data.exists;
    $('phoneStep').classList.add('hide');
    $('pinStep').classList.remove('hide');
    $('pinInput').value = '';
    if (state.authExisting) {
      $('pinStepTitle').textContent = 'Return to Profile';
      $('pinStepText').textContent = `Enter your 4-digit PIN for the profile ending in ${data.phoneLast4}.`;
      $('pinSubmitBtn').textContent = 'RETURN TO PROFILE';
    } else {
      $('pinStepTitle').textContent = 'Step 2: Create 4-Digit PIN';
      $('pinStepText').textContent = 'Create a 4-digit PIN. You will use your mobile number and PIN to return to this profile.';
      $('pinSubmitBtn').textContent = 'CREATE PROFILE';
    }
    showMessage('joinMsg', '');
  } catch (err) { showMessage('joinMsg', err.message); }
});

$('backToPhoneBtn').addEventListener('click', () => {
  $('pinStep').classList.add('hide');
  $('phoneStep').classList.remove('hide');
  $('pinInput').value = '';
  showMessage('joinMsg', '');
});

$('pinSubmitBtn').addEventListener('click', async () => {
  const pin = cleanPin($('pinInput').value);
  if (pin.length !== 4) return showMessage('joinMsg', 'Enter a 4-digit PIN.');
  try {
    const path = state.authExisting ? '/api/auth/login' : '/api/auth/create';
    const body = state.authExisting
      ? { phone: state.authPhone, pin }
      : { phone: state.authPhone, pin, ageConfirmed: $('ageConfirmed').checked, termsAccepted: $('termsAccepted').checked };
    const data = await api(path, { method: 'POST', body });
    state.playerId = data.player.id;
    localStorage.setItem('oneMatchPlayerId', state.playerId);
    state.player = data.player;
    state.question = data.question;
    state.match = data.match || null;
    state.event = data.event || state.event;
    if (state.event?.serverTime) state.serverOffsetMs = Date.parse(state.event.serverTime) - Date.now();
    state.venues = data.venues || state.venues || [];
    showMessage('joinMsg', state.authExisting ? 'Profile loaded.' : 'Profile created. Step 3: take your live picture.', true);
    render();
  } catch (err) { showMessage('joinMsg', err.message); }
});


$('startCameraBtn').addEventListener('click', startCamera);
$('captureBtn').addEventListener('click', captureLiveSelfie);
$('retakeBtn').addEventListener('click', retakeCapture);
$('submitVerificationBtn').addEventListener('click', submitVerification);
$('scanQrBtn').addEventListener('click', startQrScanner);
$('stopQrBtn').addEventListener('click', () => { stopQrScanner(); $('qrScanner').classList.add('hide'); });
$('manualCheckinBtn').addEventListener('click', () => completeQrCheckin(($('manualToken').value || '').trim()));
$('refreshMatchBtn').addEventListener('click', loadPlayer);

async function submitCurrentAnswer(forcedAnswer = null) {
  const q = state.question;
  if (!q || q.complete || q.liveVerify) return;
  const textAnswer = $('freeAnswer').value.trim();
  const answer = forcedAnswer !== null ? forcedAnswer : (q.options?.length ? [...state.selected] : textAnswer);
  if ((Array.isArray(answer) && !answer.length) || (!Array.isArray(answer) && !answer)) {
    $('aiLine').textContent = 'Choose an answer before moving forward.';
    return;
  }
  try {
    const data = await api(`/api/player/${state.playerId}/answer`, { method: 'POST', body: { stage: q.stage, answer, textAnswer } });
    state.player = data.player;
    state.question = data.question;
    if ($('aiLine')) { $('aiLine').textContent = ''; $('aiLine').classList.add('hide'); }
    render();
  } catch (err) { $('aiLine').textContent = err.message; }
}

$('answerBtn').addEventListener('click', () => submitCurrentAnswer());
if ($('doneMultiBtn')) $('doneMultiBtn').addEventListener('click', () => {
  if (state.selected.size) submitCurrentAnswer([...state.selected]);
});

$('startSparkBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/start-spark`, { method: 'POST', body: { playerId: state.playerId } });
    state.match = data.match;
    renderMatch();
  } catch (err) { showMessage('ratingMsg', err.message); }
});

document.querySelectorAll('.rateBtn').forEach(btn => btn.addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/rate`, { method: 'POST', body: { playerId: state.playerId, rating: btn.dataset.rating } });
    state.match = data.match;
    showMessage('ratingMsg', data.message, true);
    renderMatch();
  } catch (err) { showMessage('ratingMsg', err.message); }
}));

$('sendChatBtn').addEventListener('click', async () => {
  const text = $('chatInput').value.trim();
  if (!text) return;
  try {
    const data = await api(`/api/match/${state.match.id}/chat`, { method: 'POST', body: { playerId: state.playerId, text } });
    state.match = data.match;
    $('chatInput').value = '';
    renderChat();
  } catch (err) { alert(err.message); }
});

$('datePlanBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/date-plan`, { method: 'POST', body: { playerId: state.playerId } });
    state.match = data.match;
    renderChat();
  } catch (err) { alert(err.message); }
});

$('meetTonightBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/meet-interest`, { method: 'POST', body: { playerId: state.playerId, interested: true } });
    state.match = data.match;
    showMessage('meetMsg', data.message, true);
    renderChat();
  } catch (err) { showMessage('meetMsg', err.message); }
});

$('revealBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/reveal-photo`, { method: 'POST', body: { playerId: state.playerId } });
    state.match = data.match;
    showMessage('revealMsg', data.message, true);
    renderChat();
  } catch (err) { showMessage('revealMsg', err.message); }
});

$('contactBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/match/${state.match.id}/contact`, { method: 'POST', body: { playerId: state.playerId, type: $('contactType').value, value: $('contactValue').value } });
    state.match = data.match;
    showMessage('contactMsg', data.message, true);
    renderChat();
  } catch (err) { showMessage('contactMsg', err.message); }
});

$('reportBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/report', { method: 'POST', body: { reporterId: state.playerId, reportedId: state.match?.other?.id, reason: $('reportReason').value } });
    showMessage('reportMsg', data.message, true);
  } catch (err) { showMessage('reportMsg', err.message); }
});

if ($('refreshBtn')) $('refreshBtn').addEventListener('click', loadPlayer);
if ($('leaveBtn')) $('leaveBtn').addEventListener('click', () => {
  localStorage.removeItem('oneMatchPlayerId');
  stopCamera();
  stopQrScanner();
  location.reload();
});

window.addEventListener('beforeunload', () => { stopCamera(); stopQrScanner(); });
loadVenues();
loadPlayer();
