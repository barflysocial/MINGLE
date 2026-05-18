const $ = (id) => document.getElementById(id);
const state = {
  playerId: localStorage.getItem('oneMatchPlayerId') || null,
  player: null,
  question: null,
  match: null,
  venues: [],
  selected: new Set(),
  timer: null,
  stream: null,
  qrStream: null,
  qrLoop: null,
  capturedReal: null,
  capturedAvatar: null
};

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
  $('joinPanel').classList.add('hide');
}

function showJoinPanel() {
  $('titleScreen').classList.add('hide');
  $('joinPanel').classList.remove('hide');
}

async function loadPlayer() {
  if (!state.playerId) return;
  try {
    const data = await api(`/api/player/${state.playerId}`);
    state.player = data.player;
    state.question = data.question;
    state.match = data.match;
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

function render() {
  if (!state.player) return;
  showApp();
  $('playerTitle').textContent = state.player.avatarName ? `${state.player.avatarName} • Mingle` : 'Mingle Setup';
  const verification = state.player.liveVerified ? 'Live verified' : 'Live verification required';
  const check = state.player.checkedIn ? `Checked in at ${state.player.checkedInVenueName || 'venue'}` : 'Not checked in';
  const ready = state.player.ready ? 'Preferences complete' : 'Preferences in progress';
  $('playerStatus').textContent = `${verification} • ${ready} • ${check}`;

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
  $('profileCard').classList.toggle('hide', !verified && !state.player.avatarImage);
  $('liveChallengeText').textContent = state.player.liveChallenge || 'Complete the challenge shown here.';
  $('verifyPill').textContent = verified ? 'Verified' : 'Required';
  $('verifyPill').className = `pill ${verified ? 'ok' : 'warn'}`;
  if (verified) stopCamera();
  if (state.capturedReal) $('realPreview').src = state.capturedReal;
  if (state.capturedAvatar) $('avatarPreview').src = state.capturedAvatar;
}

function renderProfileCard() {
  const hasAvatar = !!state.player.avatarImage;
  $('profileCard').classList.toggle('hide', !hasAvatar);
  if (!hasAvatar) return;
  $('myAvatarImage').src = state.player.avatarImage;
  if (state.player.avatarNameAssigned && state.player.avatarName) {
    $('myAvatarName').textContent = state.player.avatarName;
    $('myAvatarMeta').textContent = 'This is your assigned One Match AI avatar name. It cannot be changed. Your pixel avatar is public first. Your real photo stays locked unless reveal is required by confirmed mutual interest.';
    $('profilePill').textContent = 'Identity Ready';
    $('profilePill').className = 'pill ok';
  } else {
    $('myAvatarName').textContent = 'Name revealed after setup';
    $('myAvatarMeta').textContent = 'Finish your live photo and preference questions. Then One Match AI will reveal your assigned avatar name.';
    $('profilePill').textContent = 'Setup in progress';
    $('profilePill').className = 'pill warn';
  }
}

function renderQuestion() {
  const q = state.question || {};
  state.selected = new Set();
  $('questionText').textContent = q.question || '';
  $('questionHelper').textContent = q.helper || '';
  $('choices').innerHTML = '';
  $('freeAnswerWrap').classList.add('hide');
  $('answerBtn').disabled = false;

  if (q.liveVerify) {
    $('progressPill').textContent = 'Live Verify First';
    $('progressPill').className = 'pill warn';
    $('questionText').textContent = 'Live verification comes first.';
    $('questionHelper').textContent = 'Complete your live camera capture above. After that, the preference questions begin.';
    $('choices').innerHTML = '<div class="notice">Start the live camera, complete the random challenge, capture your selfie, and submit your pixel avatar.</div>';
    $('answerBtn').disabled = true;
    return;
  }

  $('progressPill').textContent = q.complete ? 'Profile Ready' : `Question: ${q.stage || ''}`;
  $('progressPill').className = `pill ${q.complete ? 'ok' : 'warn'}`;

  if (q.complete) {
    $('choices').innerHTML = '<div class="notice">Your profile is complete. Venue check-in is now available. Scan the venue QR code when you arrive.</div>';
    $('answerBtn').disabled = true;
    return;
  }

  if (q.options && q.options.length) {
    q.options.forEach(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.textContent = option;
      btn.addEventListener('click', () => {
        if (q.multi) {
          if (state.selected.has(option)) state.selected.delete(option);
          else if (state.selected.size < (q.max || 4)) state.selected.add(option);
        } else {
          state.selected = new Set([option]);
        }
        [...$('choices').children].forEach(child => child.classList.toggle('selected', state.selected.has(child.textContent)));
      });
      $('choices').appendChild(btn);
    });
  } else {
    $('freeAnswerWrap').classList.remove('hide');
    $('freeAnswer').value = '';
  }
}

function renderVenues() {
  const wrap = $('venuesList');
  if (!wrap) return;
  wrap.innerHTML = (state.venues || []).map(v => `
    <div class="venueCard">
      <div>
        <strong>${escapeHTML(v.name)}</strong>
        <p class="small">${escapeHTML(v.address || v.city || '')}</p>
        <p class="small">${escapeHTML(v.eventTitle || 'Mingle Night')} • ${escapeHTML(v.eventTime || 'Tonight')}</p>
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
  if (waiting) {
    $('waitingText').textContent = `You are checked in at ${state.player.checkedInVenueName || 'the venue'}. One Match AI is waiting for the host to start the match round.`;
  }
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
    showMessage('verifyMsg', 'Camera is live. Complete the challenge, then capture your selfie.', true);
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
  const pixel = 28;
  targetCanvas.width = size;
  targetCanvas.height = size;

  const temp = document.createElement('canvas');
  temp.width = size;
  temp.height = size;
  const t = temp.getContext('2d');
  const crop = Math.min(srcW, srcH);
  const sx = Math.max(0, (srcW - crop) / 2);
  const sy = Math.max(0, (srcH - crop) / 2);
  t.drawImage(sourceCanvas, sx, sy, crop, crop, 0, 0, size, size);

  const small = document.createElement('canvas');
  small.width = Math.ceil(size / pixel);
  small.height = Math.ceil(size / pixel);
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

  // Draw large pixel blocks in a circular mask.
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.39, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, size, size);
  ctx.restore();

  // Add privacy mosaic grid.
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.39, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  for (let x = 0; x < size; x += pixel) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let y = 0; y < size; y += pixel) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  ctx.restore();

  const ring = ctx.createLinearGradient(0, 0, size, 0);
  ring.addColorStop(0, '#ff6bd6');
  ring.addColorStop(.5, '#ffffff');
  ring.addColorStop(1, '#4de8ff');
  ctx.lineWidth = 16;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.405, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(10,8,25,.78)';
  roundRect(ctx, 122, 610, 476, 58, 22);
  ctx.fill();
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE VERIFIED PIXEL AVATAR', size / 2, 648);
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
  showMessage('verifyMsg', 'Captured. If this looks right, submit your pixel avatar. Or retake it.', true);
}

function retakeCapture() {
  state.capturedReal = null;
  state.capturedAvatar = null;
  $('realPreview').removeAttribute('src');
  $('avatarPreview').removeAttribute('src');
  showMessage('verifyMsg', 'Retake ready. Complete the challenge again, then capture another selfie.', true);
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
    showMessage('verifyMsg', data.message || 'Live verification complete.', true);
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
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
    state.qrStream = stream;
    $('qrVideo').srcObject = stream;
    if (!('BarcodeDetector' in window)) {
      $('manualTokenWrap').classList.remove('hide');
      showMessage('qrMsg', 'QR camera opened, but this browser does not support automatic QR detection. Use the manual token field or try Chrome/Safari on mobile.');
      return;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const scan = async () => {
      if (!state.qrStream) return;
      try {
        const codes = await detector.detect($('qrVideo'));
        if (codes.length) {
          const token = extractTokenFromQr(codes[0].rawValue);
          await completeQrCheckin(token);
          return;
        }
      } catch {}
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
$('termsLink').addEventListener('click', () => $('termsModal').classList.remove('hide'));
$('closeTermsBtn').addEventListener('click', () => $('termsModal').classList.add('hide'));
$('termsModal').addEventListener('click', (e) => { if (e.target.id === 'termsModal') $('termsModal').classList.add('hide'); });

$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/player/start', {
      method: 'POST',
      body: { rsvpCode: $('rsvpCode').value, ageConfirmed: $('ageConfirmed').checked, termsAccepted: $('termsAccepted').checked }
    });
    state.playerId = data.player.id;
    localStorage.setItem('oneMatchPlayerId', state.playerId);
    state.player = data.player;
    state.question = data.question;
    state.match = null;
    showMessage('joinMsg', 'RSVP accepted. Next step: live selfie verification.', true);
    await loadVenues();
    render();
  } catch (err) { showMessage('joinMsg', err.message); }
});

$('startCameraBtn').addEventListener('click', startCamera);
$('captureBtn').addEventListener('click', captureLiveSelfie);
$('retakeBtn').addEventListener('click', retakeCapture);
$('submitVerificationBtn').addEventListener('click', submitVerification);
$('scanQrBtn').addEventListener('click', startQrScanner);
$('stopQrBtn').addEventListener('click', () => { stopQrScanner(); $('qrScanner').classList.add('hide'); });
$('manualCheckinBtn').addEventListener('click', () => completeQrCheckin($('manualToken').value));
$('refreshMatchBtn').addEventListener('click', loadPlayer);

$('answerBtn').addEventListener('click', async () => {
  const q = state.question;
  if (!q || q.complete || q.liveVerify) return;
  const textAnswer = $('freeAnswer').value.trim();
  const answer = q.options?.length ? [...state.selected] : textAnswer;
  if ((Array.isArray(answer) && !answer.length) || (!Array.isArray(answer) && !answer)) {
    $('aiLine').textContent = 'Choose or write an answer before moving forward.';
    return;
  }
  try {
    const data = await api(`/api/player/${state.playerId}/answer`, { method: 'POST', body: { stage: q.stage, answer, textAnswer } });
    state.player = data.player;
    state.question = data.question;
    $('aiLine').textContent = data.player?.avatarNameAssigned ? `Your setup is complete. Your avatar name is ${data.player.avatarName}. Venue check-in is now available.` : (data.aiLine || 'Got it. Let us keep narrowing.');
    render();
  } catch (err) { $('aiLine').textContent = err.message; }
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

$('refreshBtn').addEventListener('click', loadPlayer);
$('leaveBtn').addEventListener('click', () => {
  localStorage.removeItem('oneMatchPlayerId');
  stopCamera();
  stopQrScanner();
  location.reload();
});

window.addEventListener('beforeunload', () => { stopCamera(); stopQrScanner(); });
loadVenues();
loadPlayer();
