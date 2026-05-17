const $ = (id) => document.getElementById(id);
const state = {
  playerId: localStorage.getItem('oneMatchPlayerId') || null,
  player: null,
  question: null,
  match: null,
  selected: new Set(),
  timer: null,
  stream: null,
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

function shuffleOptions(options = []) {
  const arr = [...options];
  let seed = `${state.playerId || ''}-${state.question?.stage || ''}`.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
    render();
  } catch (err) {
    localStorage.removeItem('oneMatchPlayerId');
    state.playerId = null;
    stopCamera();
    showLanding();
  }
}

function render() {
  if (!state.player) return;
  showApp();
  $('playerTitle').textContent = state.player.avatarName ? `${state.player.avatarName} • Mingle` : 'Mingle Setup';
  const verification = state.player.liveVerified ? 'Live verified' : 'Live verification required';
  const check = state.player.checkedIn ? 'Checked in' : 'Not checked in';
  const ready = state.player.ready ? 'Preferences complete' : 'Preferences in progress';
  $('playerStatus').textContent = `${verification} • ${ready} • ${check}`;

  renderVerification();
  renderProfileCard();
  renderQuestion();
  renderCheckin();
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
    $('myAvatarMeta').textContent = 'This is your assigned One Match AI avatar name. It cannot be changed. Your cartoon avatar is public first. Your real photo stays hidden until mutual reveal.';
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
    $('questionHelper').textContent = 'Complete your live camera capture above. After that, One Match AI will start the question flow.';
    $('choices').innerHTML = '<div class="notice">Start the live camera, complete the random challenge, capture your selfie, and submit your avatar.</div>';
    $('answerBtn').disabled = true;
    return;
  }

  $('progressPill').textContent = q.complete ? 'Profile Ready' : `Question: ${q.stage || ''}`;
  $('progressPill').className = `pill ${q.complete ? 'ok' : 'warn'}`;

  if (q.complete) {
    $('choices').innerHTML = '<div class="notice">Your private dating fingerprint is complete. Check in, then run the One Match funnel.</div>';
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

function renderCheckin() {
  $('checkinBtn').disabled = !state.player.liveVerified || !state.player.ready || !state.player.avatarNameAssigned || state.player.checkedIn;
  $('findMatchBtn').disabled = !state.player.liveVerified || !state.player.ready || !state.player.avatarNameAssigned || !state.player.checkedIn;
  if (state.player.checkedIn) showMessage('checkinMsg', 'You are checked in at the venue. One Match AI can include you in the matching pool.', true);
}

function renderMatch() {
  const match = state.match;
  $('matchCard').classList.toggle('hide', !match || !match.other);
  $('chatCard').classList.toggle('hide', !match?.chatUnlocked);
  if (!match || !match.other) {
    if (match?.noMatchMessage) showMessage('checkinMsg', match.noMatchMessage);
    return;
  }
  $('matchIntro').textContent = `Your strongest match tonight is ${match.other.avatarName}.`;
  $('scorePill').textContent = `${match.score}% match`;
  $('matchAvatar').src = match.other.avatarImage || state.player.avatarImage || '';
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

  if (match.revealUnlocked) {
    $('revealMsg').textContent = 'Both of you agreed. Real live photos are now revealed.';
    $('revealMsg').style.color = 'var(--ok)';
    $('revealedWrap').classList.remove('hide');
    if (match.myRealPhoto) $('myRevealImg').src = match.myRealPhoto;
    if (match.otherRealPhoto) $('otherRevealImg').src = match.otherRealPhoto;
  } else {
    $('revealedWrap').classList.add('hide');
    if (match.myRevealRequest && !match.otherRevealRequest) {
      $('revealMsg').textContent = 'Your request is saved. Photos reveal only if the other person agrees too.';
      $('revealMsg').style.color = 'var(--gold)';
    } else if (!match.myRevealRequest && match.otherRevealRequest) {
      $('revealMsg').textContent = 'Your match is open to a real-photo reveal. If you agree, request it here.';
      $('revealMsg').style.color = 'var(--gold)';
    } else {
      $('revealMsg').textContent = '';
    }
  }

  const mutual = match.myContactRequest && match.otherContactRequest;
  if (mutual) {
    $('contactMsg').textContent = `Both contact preferences are saved. You: ${match.myContactRequest.type}. Match: ${match.otherContactRequest.type}.`;
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
  targetCanvas.width = size;
  targetCanvas.height = size;

  const temp = document.createElement('canvas');
  temp.width = size;
  temp.height = size;
  const t = temp.getContext('2d', { willReadFrequently: true });

  // Center-crop the live selfie into a square avatar canvas.
  const crop = Math.min(srcW, srcH);
  const sx = Math.max(0, (srcW - crop) / 2);
  const sy = Math.max(0, (srcH - crop) / 2);
  t.drawImage(sourceCanvas, sx, sy, crop, crop, 0, 0, size, size);

  let img = t.getImageData(0, 0, size, size);
  let data = img.data;

  // Strong cartoon posterization + saturation boost.
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Contrast boost.
    r = (r - 128) * 1.22 + 128;
    g = (g - 128) * 1.22 + 128;
    b = (b - 128) * 1.22 + 128;

    // Saturation boost.
    const avg = (r + g + b) / 3;
    r = avg + (r - avg) * 1.45;
    g = avg + (g - avg) * 1.45;
    b = avg + (b - avg) * 1.45;

    // Fewer color bands creates the cartoon look.
    const levels = 7;
    r = Math.round(Math.max(0, Math.min(255, r)) / (255 / (levels - 1))) * (255 / (levels - 1));
    g = Math.round(Math.max(0, Math.min(255, g)) / (255 / (levels - 1))) * (255 / (levels - 1));
    b = Math.round(Math.max(0, Math.min(255, b)) / (255 / (levels - 1))) * (255 / (levels - 1));

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  t.putImageData(img, 0, 0);

  // Edge detection layer for ink-like outlines.
  const edgeCanvas = document.createElement('canvas');
  edgeCanvas.width = size;
  edgeCanvas.height = size;
  const ectx = edgeCanvas.getContext('2d', { willReadFrequently: true });
  ectx.drawImage(temp, 0, 0);
  const edgeData = ectx.getImageData(0, 0, size, size);
  const ed = edgeData.data;
  const copy = new Uint8ClampedArray(ed);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      const ir = (y * size + (x + 1)) * 4;
      const id = ((y + 1) * size + x) * 4;

      const l1 = copy[i] * 0.299 + copy[i + 1] * 0.587 + copy[i + 2] * 0.114;
      const l2 = copy[ir] * 0.299 + copy[ir + 1] * 0.587 + copy[ir + 2] * 0.114;
      const l3 = copy[id] * 0.299 + copy[id + 1] * 0.587 + copy[id + 2] * 0.114;
      const diff = Math.abs(l1 - l2) + Math.abs(l1 - l3);

      if (diff > 34) {
        ed[i] = 18;
        ed[i + 1] = 11;
        ed[i + 2] = 30;
        ed[i + 3] = 220;
      } else {
        ed[i + 3] = 0;
      }
    }
  }
  ectx.putImageData(edgeData, 0, 0);

  const ctx = targetCanvas.getContext('2d');

  // Neon avatar background.
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#18102f');
  bg.addColorStop(0.45, '#7b1fb3');
  bg.addColorStop(1, '#00d9ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Soft bokeh dots.
  for (let i = 0; i < 32; i++) {
    const x = (Math.sin(i * 17.41) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 11.23) * 0.5 + 0.5) * size;
    const radius = 8 + (i % 5) * 5;
    ctx.globalAlpha = 0.12 + (i % 3) * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#ff6bd6' : '#4de8ff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Circular portrait mask.
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.39, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(temp, 0, 0);
  ctx.drawImage(edgeCanvas, 0, 0);
  ctx.restore();

  // Darken outside a little for portrait focus.
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Neon ring and avatar badge.
  ctx.lineWidth = 16;
  const ring = ctx.createLinearGradient(0, 0, size, 0);
  ring.addColorStop(0, '#ff6bd6');
  ring.addColorStop(0.5, '#ffffff');
  ring.addColorStop(1, '#4de8ff');
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.405, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.43, 0, Math.PI * 2);
  ctx.stroke();

  // Add clear label so users know this is the public avatar, not raw photo.
  ctx.fillStyle = 'rgba(10,8,25,.72)';
  roundRect(ctx, 130, 610, 460, 58, 22);
  ctx.fill();
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE VERIFIED AVATAR', size / 2, 648);
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
  if (!video.srcObject) {
    showMessage('verifyMsg', 'Start the camera first.');
    return;
  }
  const realCanvas = $('realCanvas');
  const avatarCanvas = $('avatarCanvas');
  const width = video.videoWidth || 480;
  const height = video.videoHeight || 360;
  realCanvas.width = width;
  realCanvas.height = height;
  const ctx = realCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  createCartoonAvatar(realCanvas, avatarCanvas);
  state.capturedReal = realCanvas.toDataURL('image/jpeg', 0.82);
  state.capturedAvatar = avatarCanvas.toDataURL('image/jpeg', 0.82);
  $('realPreview').src = state.capturedReal;
  $('avatarPreview').src = state.capturedAvatar;
  showMessage('verifyMsg', 'Captured. If this looks right, submit your avatar. Or retake it.', true);
}

function retakeCapture() {
  state.capturedReal = null;
  state.capturedAvatar = null;
  $('realPreview').removeAttribute('src');
  $('avatarPreview').removeAttribute('src');
  showMessage('verifyMsg', 'Retake ready. Complete the challenge again if needed, then capture another selfie.', true);
}

async function submitVerification() {
  if (!state.capturedReal || !state.capturedAvatar) {
    showMessage('verifyMsg', 'Capture a live selfie first.');
    return;
  }
  try {
    const data = await api(`/api/player/${state.playerId}/live-verify`, {
      method: 'POST',
      body: {
        challenge: state.player.liveChallenge,
        realImage: state.capturedReal,
        avatarImage: state.capturedAvatar
      }
    });
    state.player = data.player;
    state.question = data.question;
    showMessage('verifyMsg', data.message || 'Live verification complete.', true);
    stopCamera();
    render();
  } catch (err) {
    showMessage('verifyMsg', err.message);
  }
}


$('titleScreen').addEventListener('click', showJoinPanel);
$('tapToEnterBtn').addEventListener('click', (e) => { e.stopPropagation(); showJoinPanel(); });
$('termsLink').addEventListener('click', () => $('termsModal').classList.remove('hide'));
$('closeTermsBtn').addEventListener('click', () => $('termsModal').classList.add('hide'));
$('termsModal').addEventListener('click', (e) => {
  if (e.target.id === 'termsModal') $('termsModal').classList.add('hide');
});

$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/player/start', {
      method: 'POST',
      body: {
        rsvpCode: $('rsvpCode').value,
        ageConfirmed: $('ageConfirmed').checked,
        termsAccepted: $('termsAccepted').checked
      }
    });
    state.playerId = data.player.id;
    localStorage.setItem('oneMatchPlayerId', state.playerId);
    state.player = data.player;
    state.question = data.question;
    state.match = null;
    showMessage('joinMsg', 'RSVP accepted. Next step: live selfie verification.', true);
    render();
  } catch (err) {
    showMessage('joinMsg', err.message);
  }
});

$('startCameraBtn').addEventListener('click', startCamera);
$('captureBtn').addEventListener('click', captureLiveSelfie);
$('retakeBtn').addEventListener('click', retakeCapture);
$('submitVerificationBtn').addEventListener('click', submitVerification);

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
    $('aiLine').textContent = data.player?.avatarNameAssigned ? `Your setup is complete. Your avatar name is ${data.player.avatarName}. Check in at the venue when you arrive.` : (data.aiLine || 'Got it. Let us keep narrowing.');
    render();
  } catch (err) {
    $('aiLine').textContent = err.message;
  }
});

$('checkinBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/player/${state.playerId}/checkin`, { method: 'POST', body: { checkinCode: $('checkinCode').value } });
    state.player = data.player;
    showMessage('checkinMsg', data.message, true);
    await loadPlayer();
  } catch (err) { showMessage('checkinMsg', err.message); }
});

$('findMatchBtn').addEventListener('click', async () => {
  try {
    const data = await api(`/api/player/${state.playerId}/find-match`, { method: 'POST' });
    state.player = data.player || state.player;
    state.match = data.match;
    showMessage('checkinMsg', data.message || 'Funnel complete.', !!data.match);
    render();
  } catch (err) { showMessage('checkinMsg', err.message); }
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
  location.reload();
});

window.addEventListener('beforeunload', stopCamera);
loadPlayer();
