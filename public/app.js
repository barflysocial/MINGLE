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
  $('playerTitle').textContent = `${state.player.avatarName}'s One Match AI session`;
  const verification = state.player.liveVerified ? 'Live verified' : 'Live verification required';
  const check = state.player.checkedIn ? 'Checked in' : 'Not checked in';
  const ready = state.player.ready ? 'AI profile ready' : 'AI profile in progress';
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
  $('myAvatarName').textContent = state.player.avatarName;
  $('myAvatarMeta').textContent = state.player.liveVerified
    ? 'Live verified. Your cartoon avatar is public first. Your real photo stays hidden until mutual reveal.'
    : 'Avatar not verified yet.';
  $('profilePill').textContent = state.player.liveVerified ? 'Live Verified Avatar' : 'Pending';
  $('profilePill').className = `pill ${state.player.liveVerified ? 'ok' : 'warn'}`;
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
    shuffleOptions(q.options).forEach(option => {
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
  $('checkinBtn').disabled = !state.player.liveVerified || !state.player.ready || state.player.checkedIn;
  $('findMatchBtn').disabled = !state.player.liveVerified || !state.player.ready || !state.player.checkedIn;
  if (state.player.checkedIn) showMessage('checkinMsg', 'You are checked in. One Match AI can include you in the funnel.', true);
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
  const ctx = sourceCanvas.getContext('2d');
  const tctx = targetCanvas.getContext('2d');
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const avg = (r + g + b) / 3;
    const levels = 5;
    const quant = Math.round(avg / (255 / (levels - 1))) * (255 / (levels - 1));
    data[i] = Math.min(255, quant + (r - avg) * 0.45);
    data[i + 1] = Math.min(255, quant + (g - avg) * 0.45);
    data[i + 2] = Math.min(255, quant + (b - avg) * 0.45);
  }

  // Add simple edge darkening.
  for (let y = 1; y < sourceCanvas.height - 1; y++) {
    for (let x = 1; x < sourceCanvas.width - 1; x++) {
      const idx = (y * sourceCanvas.width + x) * 4;
      const right = idx + 4;
      const down = idx + sourceCanvas.width * 4;
      const diff = Math.abs(data[idx] - data[right]) + Math.abs(data[idx] - data[down]);
      if (diff > 60) {
        data[idx] *= 0.55;
        data[idx + 1] *= 0.55;
        data[idx + 2] *= 0.55;
      }
    }
  }

  tctx.putImageData(imgData, 0, 0);
  tctx.globalAlpha = 0.18;
  tctx.fillStyle = '#7d4cff';
  tctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  tctx.globalAlpha = 1;
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

$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/player/start', {
      method: 'POST',
      body: {
        avatarName: $('avatarName').value,
        rsvpCode: $('rsvpCode').value,
        ageConfirmed: $('ageConfirmed').checked
      }
    });
    state.playerId = data.player.id;
    localStorage.setItem('oneMatchPlayerId', state.playerId);
    state.player = data.player;
    state.question = data.question;
    state.match = null;
    showMessage('joinMsg', 'Profile created. Next step: take your live selfie.', true);
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
    $('aiLine').textContent = data.aiLine || 'Got it. Let us keep narrowing.';
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
