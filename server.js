const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST_PIN = process.env.HOST_PIN || '2468';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_ROUNDS = [
  {
    name: 'Round 1: First Spark',
    mission: 'Find one person who picked the same top value as you.',
    prompt: 'Ask: Is loyalty proven by words, time, or actions?',
    durationMinutes: 7
  },
  {
    name: 'Round 2: Green Flag Check',
    mission: 'Talk to someone new and compare your green flags.',
    prompt: 'Ask: What is a green flag you notice quickly?',
    durationMinutes: 7
  },
  {
    name: 'Round 3: Chemistry Challenge',
    mission: 'Build a low-pressure first date together in under three minutes.',
    prompt: 'Plan a $50 date night. Where are you going and why?',
    durationMinutes: 8
  },
  {
    name: 'Round 4: Real Intentions',
    mission: 'Find out whether your dating pace and relationship goals match.',
    prompt: 'Ask: What makes you feel safe enough to keep dating someone?',
    durationMinutes: 8
  },
  {
    name: 'Round 5: Final Spark',
    mission: 'Privately choose who you would like to talk to again.',
    prompt: 'Ask: What was your favorite conversation tonight?',
    durationMinutes: 5
  }
];

function id(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      meta: { createdAt: now(), app: 'Barfly Social SparkGuide AI MVP' },
      events: [
        {
          id: 'event_demo_spark',
          title: 'Barfly Social Spark Rounds',
          venue: 'Demo Venue',
          rsvpCode: 'SPARK',
          hostCode: 'HOST77',
          status: 'rsvp',
          currentRound: 0,
          rounds: DEFAULT_ROUNDS,
          createdAt: now(),
          updatedAt: now()
        }
      ],
      players: [],
      aiThreads: {},
      feedback: [],
      connections: [],
      chats: {},
      reports: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function publicEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    title: event.title,
    venue: event.venue,
    rsvpCode: event.rsvpCode,
    status: event.status,
    currentRound: event.currentRound,
    currentRoundData: event.rounds[event.currentRound] || null,
    rounds: event.rounds.map((r, i) => ({ index: i, name: r.name, mission: r.mission, prompt: r.prompt, durationMinutes: r.durationMinutes }))
  };
}

function publicPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    eventId: player.eventId,
    avatarName: player.avatarName,
    ageConfirmed: player.ageConfirmed,
    rsvpConfirmed: player.rsvpConfirmed,
    checkedIn: player.checkedIn,
    profileComplete: Boolean(player.profileComplete),
    profile: player.profile || {},
    aiSummary: player.aiSummary || '',
    createdAt: player.createdAt
  };
}

function splitTokens(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  return String(value || '')
    .split(/[,;|/]+/)
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function profileText(player) {
  const p = player.profile || {};
  return [p.goal, p.values, p.interests, p.energy, p.pace, p.greenFlags, p.dealbreakers]
    .flatMap(splitTokens)
    .join(' ');
}

function overlap(a, b) {
  const aa = new Set(splitTokens(a));
  const bb = new Set(splitTokens(b));
  let count = 0;
  aa.forEach(x => { if (bb.has(x)) count += 1; });
  return count;
}

function compatibility(a, b) {
  const ap = a.profile || {};
  const bp = b.profile || {};
  let score = 35;
  const reasons = [];

  const valueOverlap = overlap(ap.values, bp.values);
  if (valueOverlap > 0) {
    score += Math.min(25, valueOverlap * 9);
    reasons.push(`You share ${valueOverlap} core value${valueOverlap === 1 ? '' : 's'}.`);
  }

  const interestOverlap = overlap(ap.interests, bp.interests);
  if (interestOverlap > 0) {
    score += Math.min(15, interestOverlap * 5);
    reasons.push(`You have ${interestOverlap} interest overlap${interestOverlap === 1 ? '' : 's'}.`);
  }

  if (String(ap.goal || '').toLowerCase() && String(ap.goal || '').toLowerCase() === String(bp.goal || '').toLowerCase()) {
    score += 12;
    reasons.push('Your dating goals appear aligned.');
  }

  if (String(ap.pace || '').toLowerCase() && String(ap.pace || '').toLowerCase() === String(bp.pace || '').toLowerCase()) {
    score += 8;
    reasons.push('You prefer a similar dating pace.');
  }

  if (String(ap.energy || '').toLowerCase() && String(ap.energy || '').toLowerCase() === String(bp.energy || '').toLowerCase()) {
    score += 6;
    reasons.push('Your social energy looks similar.');
  } else if (ap.energy && bp.energy) {
    score += 3;
    reasons.push('Your social energy may balance each other if communication is clear.');
  }

  const dealA = splitTokens(ap.dealbreakers);
  const textB = profileText(b);
  const possibleConflict = dealA.find(d => d.length > 2 && textB.includes(d));
  if (possibleConflict) {
    score -= 15;
    reasons.push('There may be a dealbreaker to clarify before moving forward.');
  }

  score = Math.max(0, Math.min(99, Math.round(score)));
  if (!reasons.length) reasons.push('There is enough profile information to start a low-pressure conversation.');

  return {
    score,
    reasons,
    icebreaker: buildIcebreaker(a, b)
  };
}

function buildIcebreaker(a, b) {
  const sharedValues = splitTokens(a.profile?.values).filter(v => splitTokens(b.profile?.values).includes(v));
  const sharedInterests = splitTokens(a.profile?.interests).filter(v => splitTokens(b.profile?.interests).includes(v));
  if (sharedValues.length) {
    const value = titleCase(sharedValues[0]);
    return `You both mentioned ${value}. Ask: what does ${value.toLowerCase()} look like in real dating, not just words?`;
  }
  if (sharedInterests.length) {
    const interest = titleCase(sharedInterests[0]);
    return `You both like ${interest}. Ask: what is your perfect ${interest.toLowerCase()} night?`;
  }
  return 'Ask: what makes a first conversation feel natural instead of forced?';
}

function titleCase(s) {
  return String(s || '').replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));
}

const bannedPatterns = [
  /\b(kill|hurt|stalk|threaten|force|rape)\b/i,
  /\b(send nudes|nude pics|explicit photo|sex now)\b/i,
  /\b(address|where do you live|home alone)\b/i,
  /\b(bitch|whore|slut|cunt)\b/i
];

function safetyCheck(text) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, reason: 'Message cannot be empty.' };
  if (value.length > 700) return { ok: false, reason: 'Message is too long for this MVP.' };
  for (const pattern of bannedPatterns) {
    if (pattern.test(value)) {
      return {
        ok: false,
        reason: 'This message may violate safety boundaries. Rewrite it to be respectful, non-sexual, and non-invasive.'
      };
    }
  }
  return { ok: true };
}

function sparkGuideReply(player, message, db) {
  const text = String(message || '').toLowerCase();
  const p = player.profile || {};
  const event = db.events.find(e => e.id === player.eventId);
  const currentRound = event?.rounds?.[event.currentRound];

  if (/what.*say|icebreaker|start|opening|talk/.test(text)) {
    return `Start low-pressure. Try: “What made you come out tonight, and what kind of connection are you open to?” If the conversation feels good, follow with: “What is a green flag you notice fast?”`;
  }
  if (/match|who|compatible|spark/.test(text)) {
    const matches = getMatches(db, player.id).slice(0, 1);
    if (matches.length) {
      const m = matches[0];
      return `${m.avatarName} is your strongest current suggestion at ${m.score}%. ${m.reasons.join(' ')} Icebreaker: ${m.icebreaker}`;
    }
    return 'I need more checked-in players with completed profiles before I can suggest strong matches. For now, focus on values, pace, and conversation comfort.';
  }
  if (/red flag|danger|unsafe|creepy|pressure/.test(text)) {
    return 'Trust discomfort early. You can end the conversation, block/report in the app, and alert the host. A good match respects “no,” pace, privacy, and boundaries.';
  }
  if (/profile|bio|about me|summary/.test(text)) {
    return `Your current dating profile reads: ${player.aiSummary || summarizeProfile(p)} You can improve it by being clear about your goal, pace, and one real green flag.`;
  }
  if (/round|mission|game/.test(text)) {
    if (currentRound) return `Current mission: ${currentRound.mission} Prompt: ${currentRound.prompt}`;
    return 'The host has not started a live round yet. Use this time to finish your profile and check in.';
  }

  const profileHint = p.goal ? `Since you chose “${p.goal},”` : 'Since this is a dating game,';
  return `${profileHint} keep the next step simple: ask one values question, one fun question, and one pace question. Good chemistry should feel curious, respectful, and mutual—not pressured.`;
}

function summarizeProfile(profile = {}) {
  const parts = [];
  if (profile.goal) parts.push(`looking for ${profile.goal}`);
  if (profile.pace) parts.push(`prefers a ${profile.pace} pace`);
  if (profile.values) parts.push(`values ${profile.values}`);
  if (profile.energy) parts.push(`social energy is ${profile.energy}`);
  if (!parts.length) return 'Profile is not complete yet.';
  return titleCase(parts.join(', ')) + '.';
}

function getMatches(db, playerId) {
  const player = db.players.find(p => p.id === playerId);
  if (!player) return [];
  const blocked = new Set(player.blockedPlayerIds || []);
  return db.players
    .filter(other => other.id !== player.id)
    .filter(other => other.eventId === player.eventId)
    .filter(other => other.checkedIn && other.profileComplete)
    .filter(other => !blocked.has(other.id))
    .filter(other => !(other.blockedPlayerIds || []).includes(player.id))
    .map(other => {
      const c = compatibility(player, other);
      return { playerId: other.id, avatarName: other.avatarName, score: c.score, reasons: c.reasons, icebreaker: c.icebreaker };
    })
    .sort((a, b) => b.score - a.score);
}

function createConnectionIfMutual(db, eventId, fromPlayerId, toPlayerId, choice) {
  const positive = new Set(['spark', 'maybe', 'friend']);
  if (!positive.has(choice)) return null;
  const reciprocal = db.feedback.find(f => f.eventId === eventId && f.fromPlayerId === toPlayerId && f.toPlayerId === fromPlayerId && positive.has(f.choice));
  if (!reciprocal) return null;
  const existing = db.connections.find(c => c.eventId === eventId && c.playerIds.includes(fromPlayerId) && c.playerIds.includes(toPlayerId));
  if (existing) return existing;
  const chatId = id('chat');
  const connection = {
    id: id('conn'),
    eventId,
    playerIds: [fromPlayerId, toPlayerId].sort(),
    type: choice === 'friend' || reciprocal.choice === 'friend' ? 'friend-vibe' : 'mutual-spark',
    chatId,
    createdAt: now()
  };
  db.connections.push(connection);
  db.chats[chatId] = [
    {
      id: id('msg'),
      from: 'SparkGuide AI',
      text: 'You both showed mutual interest. Keep it respectful and simple: what was your favorite moment from tonight?',
      at: now(),
      system: true
    }
  ];
  return connection;
}

async function handleApi(req, res, url) {
  const db = readDb();
  const method = req.method;
  const pathname = url.pathname;

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, app: 'SparkGuide AI MVP', time: now() });
    }

    if (method === 'GET' && pathname === '/api/events/by-code') {
      const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
      const event = db.events.find(e => e.rsvpCode.toUpperCase() === code);
      if (!event) return sendJson(res, 404, { error: 'No event found for that RSVP code.' });
      return sendJson(res, 200, { event: publicEvent(event) });
    }

    if (method === 'POST' && pathname === '/api/player/join') {
      const body = await parseBody(req);
      const avatarName = String(body.avatarName || '').trim();
      const code = String(body.rsvpCode || '').trim().toUpperCase();
      if (!body.ageConfirmed) return sendJson(res, 400, { error: 'Players must confirm they are 18+.' });
      if (avatarName.length < 2) return sendJson(res, 400, { error: 'Enter an avatar name.' });
      const event = db.events.find(e => e.rsvpCode.toUpperCase() === code);
      if (!event) return sendJson(res, 404, { error: 'Invalid RSVP code.' });
      if (['ended'].includes(event.status)) return sendJson(res, 400, { error: 'This event has ended.' });
      const duplicate = db.players.find(p => p.eventId === event.id && p.avatarName.toLowerCase() === avatarName.toLowerCase());
      if (duplicate) return sendJson(res, 400, { error: 'That avatar name is already being used for this event.' });
      const player = {
        id: id('player'),
        eventId: event.id,
        avatarName,
        ageConfirmed: true,
        rsvpConfirmed: true,
        checkedIn: false,
        profileComplete: false,
        profile: {},
        aiSummary: '',
        blockedPlayerIds: [],
        createdAt: now(),
        updatedAt: now()
      };
      db.players.push(player);
      writeDb(db);
      return sendJson(res, 201, { player: publicPlayer(player), event: publicEvent(event) });
    }

    if (method === 'POST' && pathname === '/api/player/checkin') {
      const body = await parseBody(req);
      const player = db.players.find(p => p.id === body.playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      const event = db.events.find(e => e.id === player.eventId);
      if (!event) return sendJson(res, 404, { error: 'Event not found.' });
      const code = String(body.hostCode || '').trim().toUpperCase();
      if (code !== event.hostCode.toUpperCase()) return sendJson(res, 403, { error: 'Incorrect host check-in code.' });
      player.checkedIn = true;
      player.updatedAt = now();
      writeDb(db);
      return sendJson(res, 200, { player: publicPlayer(player), event: publicEvent(event) });
    }

    if (method === 'GET' && pathname.startsWith('/api/player/')) {
      const playerId = pathname.split('/').pop();
      const player = db.players.find(p => p.id === playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      const event = db.events.find(e => e.id === player.eventId);
      return sendJson(res, 200, { player: publicPlayer(player), event: publicEvent(event) });
    }

    if (method === 'POST' && pathname === '/api/player/profile') {
      const body = await parseBody(req);
      const player = db.players.find(p => p.id === body.playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      const allowed = ['goal', 'values', 'interests', 'energy', 'pace', 'greenFlags', 'dealbreakers'];
      const profile = {};
      for (const key of allowed) profile[key] = String(body.profile?.[key] || '').trim();
      if (!profile.goal || !profile.values || !profile.pace) {
        return sendJson(res, 400, { error: 'Goal, values, and pace are required.' });
      }
      player.profile = profile;
      player.profileComplete = true;
      player.aiSummary = summarizeProfile(profile);
      player.updatedAt = now();
      writeDb(db);
      return sendJson(res, 200, { player: publicPlayer(player) });
    }

    if (method === 'POST' && pathname === '/api/spark/chat') {
      const body = await parseBody(req);
      const player = db.players.find(p => p.id === body.playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      const safe = safetyCheck(body.message);
      if (!safe.ok) return sendJson(res, 400, { error: safe.reason });
      const answer = sparkGuideReply(player, body.message, db);
      db.aiThreads[player.id] = db.aiThreads[player.id] || [];
      db.aiThreads[player.id].push({ id: id('ai'), role: 'user', text: body.message, at: now() });
      db.aiThreads[player.id].push({ id: id('ai'), role: 'assistant', text: answer, at: now() });
      writeDb(db);
      return sendJson(res, 200, { reply: answer, thread: db.aiThreads[player.id] });
    }

    if (method === 'GET' && pathname.startsWith('/api/matches/')) {
      const playerId = pathname.split('/').pop();
      const player = db.players.find(p => p.id === playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      return sendJson(res, 200, { matches: getMatches(db, playerId) });
    }

    if (method === 'POST' && pathname === '/api/feedback') {
      const body = await parseBody(req);
      const from = db.players.find(p => p.id === body.fromPlayerId);
      const to = db.players.find(p => p.id === body.toPlayerId);
      if (!from || !to) return sendJson(res, 404, { error: 'Player not found.' });
      if (from.eventId !== to.eventId) return sendJson(res, 400, { error: 'Players are not in the same event.' });
      const choice = String(body.choice || '').trim().toLowerCase();
      if (!['spark', 'maybe', 'friend', 'no'].includes(choice)) return sendJson(res, 400, { error: 'Invalid feedback choice.' });
      db.feedback = db.feedback.filter(f => !(f.fromPlayerId === from.id && f.toPlayerId === to.id));
      db.feedback.push({ id: id('feed'), eventId: from.eventId, fromPlayerId: from.id, toPlayerId: to.id, choice, at: now() });
      const connection = createConnectionIfMutual(db, from.eventId, from.id, to.id, choice);
      writeDb(db);
      return sendJson(res, 200, { saved: true, connectionUnlocked: Boolean(connection), connection });
    }

    if (method === 'GET' && pathname.startsWith('/api/connections/')) {
      const playerId = pathname.split('/').pop();
      const player = db.players.find(p => p.id === playerId);
      if (!player) return sendJson(res, 404, { error: 'Player not found.' });
      const connections = db.connections
        .filter(c => c.playerIds.includes(playerId))
        .map(c => {
          const otherId = c.playerIds.find(pid => pid !== playerId);
          const other = db.players.find(p => p.id === otherId);
          return { id: c.id, chatId: c.chatId, type: c.type, otherPlayerId: otherId, otherAvatarName: other?.avatarName || 'Unknown', createdAt: c.createdAt };
        });
      return sendJson(res, 200, { connections });
    }

    if (method === 'GET' && pathname.startsWith('/api/chats/')) {
      const chatId = pathname.split('/').pop();
      const chat = db.chats[chatId];
      if (!chat) return sendJson(res, 404, { error: 'Chat not found.' });
      return sendJson(res, 200, { messages: chat });
    }

    if (method === 'POST' && pathname.match(/^\/api\/chats\/[^/]+\/message$/)) {
      const chatId = pathname.split('/')[3];
      const body = await parseBody(req);
      const connection = db.connections.find(c => c.chatId === chatId);
      if (!connection) return sendJson(res, 404, { error: 'Connection chat not found.' });
      if (!connection.playerIds.includes(body.fromPlayerId)) return sendJson(res, 403, { error: 'You are not part of this chat.' });
      const safe = safetyCheck(body.text);
      if (!safe.ok) return sendJson(res, 400, { error: safe.reason });
      const player = db.players.find(p => p.id === body.fromPlayerId);
      const msg = { id: id('msg'), from: player?.avatarName || 'Player', fromPlayerId: body.fromPlayerId, text: String(body.text).trim(), at: now() };
      db.chats[chatId] = db.chats[chatId] || [];
      db.chats[chatId].push(msg);
      writeDb(db);
      return sendJson(res, 201, { message: msg, messages: db.chats[chatId] });
    }

    if (method === 'POST' && pathname === '/api/block') {
      const body = await parseBody(req);
      const from = db.players.find(p => p.id === body.fromPlayerId);
      const target = db.players.find(p => p.id === body.targetPlayerId);
      if (!from || !target) return sendJson(res, 404, { error: 'Player not found.' });
      from.blockedPlayerIds = Array.from(new Set([...(from.blockedPlayerIds || []), target.id]));
      db.connections = db.connections.filter(c => !(c.playerIds.includes(from.id) && c.playerIds.includes(target.id)));
      writeDb(db);
      return sendJson(res, 200, { blocked: true });
    }

    if (method === 'POST' && pathname === '/api/report') {
      const body = await parseBody(req);
      const from = db.players.find(p => p.id === body.fromPlayerId);
      const target = db.players.find(p => p.id === body.targetPlayerId);
      if (!from || !target) return sendJson(res, 404, { error: 'Player not found.' });
      db.reports.push({ id: id('report'), eventId: from.eventId, fromPlayerId: from.id, targetPlayerId: target.id, reason: String(body.reason || '').slice(0, 1000), at: now() });
      from.blockedPlayerIds = Array.from(new Set([...(from.blockedPlayerIds || []), target.id]));
      writeDb(db);
      return sendJson(res, 200, { reported: true, blocked: true });
    }

    if (method === 'POST' && pathname === '/api/host/login') {
      const body = await parseBody(req);
      if (String(body.pin || '') !== HOST_PIN) return sendJson(res, 403, { error: 'Invalid host PIN.' });
      return sendJson(res, 200, { ok: true, hostToken: 'demo-host-token' });
    }

    if (method === 'GET' && pathname === '/api/host/events') {
      return sendJson(res, 200, {
        events: db.events.map(e => ({ ...publicEvent(e), hostCode: e.hostCode, playerCount: db.players.filter(p => p.eventId === e.id).length, checkedInCount: db.players.filter(p => p.eventId === e.id && p.checkedIn).length }))
      });
    }

    if (method === 'POST' && pathname === '/api/host/events') {
      const body = await parseBody(req);
      const title = String(body.title || '').trim();
      const venue = String(body.venue || '').trim() || 'Venue';
      const rsvpCode = String(body.rsvpCode || '').trim().toUpperCase();
      const hostCode = String(body.hostCode || '').trim().toUpperCase();
      if (!title || !rsvpCode || !hostCode) return sendJson(res, 400, { error: 'Title, RSVP code, and host code are required.' });
      if (db.events.some(e => e.rsvpCode.toUpperCase() === rsvpCode)) return sendJson(res, 400, { error: 'RSVP code already exists.' });
      const event = { id: id('event'), title, venue, rsvpCode, hostCode, status: 'rsvp', currentRound: 0, rounds: DEFAULT_ROUNDS, createdAt: now(), updatedAt: now() };
      db.events.push(event);
      writeDb(db);
      return sendJson(res, 201, { event: publicEvent(event) });
    }

    if (method === 'PATCH' && pathname.match(/^\/api\/host\/events\/[^/]+$/)) {
      const eventId = pathname.split('/').pop();
      const event = db.events.find(e => e.id === eventId);
      if (!event) return sendJson(res, 404, { error: 'Event not found.' });
      const body = await parseBody(req);
      if (body.status && ['draft', 'rsvp', 'checkin', 'live', 'ended'].includes(body.status)) event.status = body.status;
      if (Number.isInteger(body.currentRound) && body.currentRound >= 0 && body.currentRound < event.rounds.length) event.currentRound = body.currentRound;
      if (body.nextRound) event.currentRound = Math.min(event.rounds.length - 1, event.currentRound + 1);
      event.updatedAt = now();
      writeDb(db);
      return sendJson(res, 200, { event: publicEvent(event) });
    }

    if (method === 'GET' && pathname.match(/^\/api\/host\/events\/[^/]+\/dashboard$/)) {
      const eventId = pathname.split('/')[4];
      const event = db.events.find(e => e.id === eventId);
      if (!event) return sendJson(res, 404, { error: 'Event not found.' });
      const players = db.players.filter(p => p.eventId === event.id).map(publicPlayer);
      const reports = db.reports.filter(r => r.eventId === event.id).map(r => {
        const from = db.players.find(p => p.id === r.fromPlayerId);
        const target = db.players.find(p => p.id === r.targetPlayerId);
        return { ...r, fromAvatarName: from?.avatarName || 'Unknown', targetAvatarName: target?.avatarName || 'Unknown' };
      });
      return sendJson(res, 200, { event: publicEvent(event), players, reports, feedbackCount: db.feedback.filter(f => f.eventId === event.id).length, connectionCount: db.connections.filter(c => c.eventId === event.id).length });
    }

    if (method === 'POST' && pathname.match(/^\/api\/host\/events\/[^/]+\/reset$/)) {
      const eventId = pathname.split('/')[4];
      const event = db.events.find(e => e.id === eventId);
      if (!event) return sendJson(res, 404, { error: 'Event not found.' });
      const playerIds = db.players.filter(p => p.eventId === eventId).map(p => p.id);
      db.players = db.players.filter(p => p.eventId !== eventId);
      db.feedback = db.feedback.filter(f => f.eventId !== eventId);
      db.connections = db.connections.filter(c => c.eventId !== eventId);
      db.reports = db.reports.filter(r => r.eventId !== eventId);
      for (const pid of playerIds) delete db.aiThreads[pid];
      event.status = 'rsvp';
      event.currentRound = 0;
      event.updatedAt = now();
      writeDb(db);
      return sendJson(res, 200, { reset: true, event: publicEvent(event) });
    }

    return notFound(res);
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Server error' });
  }
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

ensureDb();
server.listen(PORT, () => {
  console.log(`SparkGuide AI MVP running on http://localhost:${PORT}`);
});
