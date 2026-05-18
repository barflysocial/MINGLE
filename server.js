const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let QRCode = null;
try { QRCode = require('qrcode'); } catch (err) { QRCode = null; }

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const HOST_PIN = process.env.HOST_PIN || '2468';
const DEFAULT_RSVP = process.env.RSVP_CODE || 'ONEMATCH';
const DEFAULT_CHECKIN = process.env.CHECKIN_CODE || 'HOST77';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const STAGE_ORDER = [
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
  'followupNonNegotiable'
];

const QUESTIONS = {
  identity: {
    field: 'gender',
    question: 'I am...',
    helper: 'Choose the label you want One Match AI to use for matching. This is not shown as a public profile label.',
    options: ['Man', 'Woman', 'Nonbinary', 'Prefer to self-describe later', 'Prefer not to say']
  },
  orientation: {
    field: 'orientation',
    question: 'My sexual / dating preference is...',
    helper: 'This helps One Match AI understand who you are open to meeting. Keep it simple for the live-event MVP.',
    options: ['Heterosexual', 'Gay / lesbian', 'Bisexual', 'Pansexual / open to compatibility', 'Questioning / figuring it out', 'Prefer not to say']
  },
  who: {
    field: 'seeking',
    question: 'I am interested in meeting...',
    helper: 'This is treated as a hard matching filter when possible.',
    options: ['Women', 'Men', 'Men and women', 'Nonbinary people', 'Anyone compatible']
  },
  intent: {
    field: 'intent',
    question: 'I am looking for...',
    helper: 'One Match AI uses this to remove people with the wrong intentions.',
    options: ['Serious relationship', 'Friendship first', 'Open to dating', 'Casual dating', 'Not sure yet']
  },
  ageRange: {
    field: 'ageRange',
    question: 'My age range is...',
    helper: 'Age range helps One Match AI avoid obvious mismatches without displaying exact age publicly.',
    options: ['18–24', '25–34', '35–44', '45–54', '55+', 'Prefer not to say']
  },
  preferredAgeRange: {
    field: 'preferredAgeRange',
    multi: true,
    max: 3,
    question: 'I am open to meeting someone age...',
    helper: 'Choose up to 3. This is one of the few appearance-related hard filters.',
    options: ['18–24', '25–34', '35–44', '45–54', '55+', 'Open to the right person']
  },
  values: {
    field: 'values',
    multi: true,
    max: 3,
    question: 'The values that matter most to me are...',
    helper: 'Choose up to 3. These become the strongest compatibility signals.',
    options: ['Loyalty', 'Peace', 'Humor', 'Faith', 'Family', 'Ambition', 'Honesty', 'Adventure', 'Stability', 'Romance']
  },
  pace: {
    field: 'pace',
    question: 'My dating pace is...',
    helper: 'This helps avoid pairing a slow-burn person with someone who pressures too quickly.',
    options: ['Slow burn', 'Natural pace', 'Fast chemistry', 'Friends first']
  },
  energy: {
    field: 'energy',
    question: 'My social energy is...',
    helper: 'This helps match people who enjoy similar social settings.',
    options: ['Calm and quiet', 'Balanced', 'Outgoing', 'High-energy nightlife']
  },
  communication: {
    field: 'communication',
    question: 'I connect best with communication that is...',
    helper: 'This tells the AI how to guide the first conversation.',
    options: ['Direct and honest', 'Gentle and patient', 'Playful and funny', 'Deep and thoughtful', 'Low-pressure']
  },
  dealbreakers: {
    field: 'dealbreakers',
    multi: true,
    max: 3,
    question: 'My dealbreakers are...',
    helper: 'Choose up to 3. Dealbreakers help eliminate poor fits before ranking.',
    options: ['Drama', 'Inconsistency', 'Heavy partying', 'Poor communication', 'Rushing intimacy', 'No ambition', 'Does not want commitment', 'Dishonesty']
  },
  greenflags: {
    field: 'greenflags',
    multi: true,
    max: 3,
    question: 'Green flags that make me more interested are...',
    helper: 'Choose up to 3. These help explain why a match is worth your time.',
    options: ['Consistency', 'Kindness', 'Good listener', 'Family-minded', 'Makes me laugh', 'Emotionally available', 'Hard working', 'Spiritual values']
  },
  chemistry: {
    field: 'chemistry',
    question: 'Chemistry starts fastest for me through...',
    helper: 'This breaks ties when several people look compatible.',
    options: ['Shared humor', 'Deep conversation', 'Physical attraction', 'Emotional safety', 'Shared ambition', 'Playful banter']
  },
  dateStyle: {
    field: 'dateStyle',
    question: 'My most comfortable first-date style is...',
    helper: 'This is used after a mutual match to suggest the next real-world step.',
    options: ['Coffee or dessert', 'Drinks and conversation', 'Trivia or game night', 'Dinner', 'Live music', 'Walk and talk']
  },
  heightImportance: {
    field: 'heightImportance',
    question: 'Height is...',
    helper: 'This is a soft attraction preference, not a public label.',
    options: ['Not important', 'Slight preference', 'Important', 'Very important']
  },
  heightPreference: {
    field: 'heightPreference',
    question: 'My height preference is...',
    helper: 'This is used softly. One Match AI should not force shallow filtering.',
    options: ['No preference', 'Shorter than me', 'Around my height', 'Taller than me', 'Open if the vibe is right']
  },
  buildSelf: {
    field: 'buildSelf',
    question: 'My general build is...',
    helper: 'Weight is not asked. This stays private and helps avoid awkward mismatches.',
    options: ['Slim', 'Athletic', 'Average', 'Curvy / thick', 'Plus-size', 'Muscular', 'Prefer not to say']
  },
  buildPreference: {
    field: 'buildPreference',
    question: 'My body-type preference is...',
    helper: 'This is a soft signal only. Chemistry, values, and safety still matter most.',
    options: ['No strong preference', 'Slim / athletic', 'Average / balanced', 'Curvy / thick', 'Plus-size', 'Muscular', 'Open to chemistry']
  },
  styleSelf: {
    field: 'styleSelf',
    question: 'My personal style is usually...',
    helper: 'Style is safer and more useful than filtering by complexion.',
    options: ['Casual and laid-back', 'Polished / professional', 'Sporty / active', 'Nightlife / stylish', 'Artistic / unique', 'Natural look', 'Glam look']
  },
  stylePreference: {
    field: 'stylePreference',
    question: 'The style that usually catches my attention is...',
    helper: 'This is a soft attraction preference. One Match AI does not use skin complexion as a filter.',
    options: ['No specific type', 'Casual and laid-back', 'Polished / professional', 'Sporty / active', 'Nightlife / stylish', 'Artistic / unique', 'Natural look', 'Glam look']
  },
  attractionBalance: {
    field: 'attractionBalance',
    question: 'For me, attraction and connection work like this...',
    helper: 'This helps One Match AI balance appearance preferences with deeper compatibility.',
    options: ['Physical attraction matters most', 'Both matter equally', 'Emotional connection matters more', 'Values come first, chemistry still matters', 'I am open if the vibe is right']
  },
  matchScope: {
    field: 'matchScope',
    question: 'Who should One Match AI consider?',
    helper: 'Cross-venue matching only happens when both people allow it. If you match across venues, both of you must agree where to meet.',
    options: ['Same venue only', 'Across participating venues for my best match']
  },
  followupPriority: {
    field: 'followupPriority',
    question: 'If One Match AI has multiple good options, it should prioritize...',
    helper: 'This is the tie-breaker that helps reduce the room to one strongest match.',
    options: ['Long-term values', 'Easy conversation', 'Emotional safety', 'Lifestyle fit', 'Physical chemistry', 'Shared goals']
  },
  followupNonNegotiable: {
    field: 'followupNonNegotiable',
    question: 'One thing my match should understand about me is...',
    helper: 'Multiple choice keeps the live event fast and reduces copy/paste cheating.',
    options: ['I move slowly and need patience', 'Consistency matters more than words', 'I am busy but intentional', 'Family is a major part of my life', 'Honest communication is non-negotiable', 'I prefer low-pressure dating', 'Faith or values are important to me', 'I need laughter and playfulness']
  }
};

const BAD_WORDS = [
  'nude', 'nudes', 'sex now', 'send pics', 'kill yourself', 'slut', 'whore', 'bitch', 'dick pic', 'explicit'
];

const LIVE_CHALLENGES = [
  'Blink twice, then smile.',
  'Turn your head slightly to the left, then look forward.',
  'Hold up two fingers and smile.',
  'Nod once, then look straight into the camera.',
  'Look right, then give a small smile.'
];

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      event: defaultEvent(), players: [], matches: [], reports: [], blocks: []
    }, null, 2));
  }
}

function defaultEvent() {
  return {
    id: 'demo-event',
    title: 'One Match AI Demo Night',
    venue: 'Barfly Social',
    rsvpCode: DEFAULT_RSVP,
    checkinCode: DEFAULT_CHECKIN,
    status: 'open',
    roundLabel: 'AI Matchmaker Funnel',
    roundStartsAt: null,
    autoStartEnabled: false,
    roundStatus: 'waiting_for_host',
    roundStartedAt: null,
    createdAt: new Date().toISOString()
  };
}


function ensureRoundSettings(db) {
  db.event ||= defaultEvent();
  if (!('roundStartsAt' in db.event)) db.event.roundStartsAt = null;
  if (typeof db.event.autoStartEnabled !== 'boolean') db.event.autoStartEnabled = false;
  db.event.roundStatus ||= db.event.roundStartedAt ? 'started' : (db.event.roundStartsAt ? 'scheduled' : 'waiting_for_host');
  return db.event;
}

function publicEvent(db) {
  ensureRoundSettings(db);
  return {
    ...db.event,
    serverTime: now()
  };
}

function maybeAutoStartRound(db) {
  ensureRoundSettings(db);
  if (!db.event.autoStartEnabled) return null;
  if (!db.event.roundStartsAt) {
    db.event.roundStatus = db.event.roundStartedAt ? 'started' : 'waiting_for_host';
    return null;
  }
  if (db.event.roundStartedAt) return null;
  const starts = Date.parse(db.event.roundStartsAt || '');
  if (!Number.isFinite(starts)) {
    db.event.roundStatus = 'waiting_for_host';
    return null;
  }
  if (Date.now() < starts) {
    db.event.roundStatus = 'scheduled';
    return null;
  }
  const eligible = db.players.filter(p => p.liveVerified && p.checkedIn && p.ready && !p.matchId);
  if (eligible.length < 2) {
    db.event.roundStatus = 'waiting_for_players';
    db.event.lastAutoCheckAt = now();
    return null;
  }
  const created = runMatchFunnel(db);
  db.event.roundStartedAt = now();
  db.event.roundStatus = 'started';
  db.event.lastAutoStartAt = now();
  db.event.lastAutoCreatedMatches = created.length;
  return created;
}



function defaultVenues() {
  return [
    {
      id: 'urban-denham',
      name: 'Urban Daiquiris Denham Springs',
      address: 'Denham Springs, LA',
      city: 'Denham Springs',
      eventTitle: 'Mingle Night',
      eventTime: 'Tonight',
      status: 'open',
      token: 'VENUE-URBAN-DENHAM-77',
      createdAt: new Date().toISOString()
    },
    {
      id: 'pelican-to-mars',
      name: 'Pelican to Mars',
      address: 'Baton Rouge, LA',
      city: 'Baton Rouge',
      eventTitle: 'Mingle Night',
      eventTime: 'Tonight',
      status: 'open',
      token: 'VENUE-PELICAN-MARS-77',
      createdAt: new Date().toISOString()
    },
    {
      id: 'topgolf-baton-rouge',
      name: 'Topgolf Baton Rouge',
      address: 'Baton Rouge, LA',
      city: 'Baton Rouge',
      eventTitle: 'Singles Game Night',
      eventTime: 'Tonight',
      status: 'open',
      token: 'VENUE-TOPGOLF-BR-77',
      createdAt: new Date().toISOString()
    }
  ];
}

function ensureVenues(db) {
  db.venues ||= defaultVenues();
  if (!db.venues.length) db.venues = defaultVenues();
  db.venues.forEach(v => {
    v.id ||= slugify(v.name || 'venue') + '-' + crypto.randomBytes(2).toString('hex');
    v.status ||= 'open';
    v.token ||= `VENUE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    v.eventTitle ||= 'Mingle Night';
    v.eventTime ||= 'Tonight';
    v.createdAt ||= now();
  });
  return db.venues;
}

function slugify(value) {
  return lower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'venue';
}

function publicVenue(venue) {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address || '',
    city: venue.city || '',
    eventTitle: venue.eventTitle || 'Mingle Night',
    eventTime: venue.eventTime || 'Tonight',
    status: venue.status || 'open'
  };
}

function findVenueByToken(db, token) {
  ensureVenues(db);
  const cleaned = lower(normalize(token));
  return db.venues.find(v => lower(normalize(v.token)) === cleaned || lower(normalize(v.id)) === cleaned);
}

function venueForPlayer(db, player) {
  if (!player?.checkedInVenueId) return null;
  ensureVenues(db);
  return db.venues.find(v => v.id === player.checkedInVenueId) || null;
}

function checkinPayloadForVenue(req, venue) {
  const origin = `https://${req.headers.host || 'onematch.ai'}`;
  return `${origin}/play?checkinToken=${encodeURIComponent(venue.token)}&venue=${encodeURIComponent(venue.id)}`;
}


function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(raw || '{}');
    db.event ||= defaultEvent();
    ensureRoundSettings(db);
    db.players ||= [];
    db.matches ||= [];
    db.reports ||= [];
    db.blocks ||= [];
    db.usedAvatarNames ||= [];
    ensureVenues(db);
    return db;
  } catch (err) {
    return { event: defaultEvent(), venues: defaultVenues(), players: [], matches: [], reports: [], blocks: [], usedAvatarNames: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function now() { return new Date().toISOString(); }


function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function phoneHash(phone) {
  return hashValue(`phone:${normalizePhone(phone)}:${HOST_PIN}`);
}

function pinHash(phone, pin) {
  return hashValue(`pin:${normalizePhone(phone)}:${String(pin)}:${HOST_PIN}`);
}

function findPlayerByPhone(db, phone) {
  const hash = phoneHash(phone);
  return db.players.find(p => p.phoneHash === hash);
}

function publicAuthPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    phoneVerified: !!player.phoneVerified,
    phoneLast4: player.phoneLast4 || '',
    lockoutUntil: player.lockoutUntil || null
  };
}

function authLockoutMessage(player) {
  if (!player?.lockoutUntil) return '';
  const until = Date.parse(player.lockoutUntil);
  if (Number.isFinite(until) && Date.now() < until) {
    const mins = Math.ceil((until - Date.now()) / 60000);
    return `Too many wrong PIN attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
  }
  return '';
}



const AVATAR_ADJECTIVES = ['Amber','Velvet','Golden','Silver','Neon','Midnight','Bright','Lucky','Royal','Blue','Crimson','Emerald','Starlit','Cosmic','Dream','Lunar','Solar','True','Wild','Kind','Magic','Urban','Smooth','Electric','Crystal','Radiant','Hidden','Bold','Gentle','Vivid'];
const AVATAR_NOUNS = ['Nova','Echo','River','Sky','Bloom','Ember','Halo','Storm','Lane','Glow','Spark','Moon','Comet','Flame','Vibe','Jewel','Wave','Haven','Pulse','Muse','Star','Charm','Quest','Signal','Garden','Harbor','Crown','Tempo','Verse','Orbit'];
const BLOCKED_NAME_WORDS = ['sex','nude','xxx','porn','slut','whore','bitch','dick','ass','fuck','shit','kill','hate','phone','instagram','snap','cashapp','venmo','email'];

function isCleanAvatarName(name) {
  const clean = lower(name).replace(/[^a-z0-9 ]/g, '');
  return !BLOCKED_NAME_WORDS.some(word => clean.includes(word));
}

function allUsedAvatarNames(db) {
  db.usedAvatarNames ||= [];
    ensureVenues(db);
  return new Set([...db.usedAvatarNames.map(lower), ...db.players.map(p => lower(p.avatarName))]);
}

function generateAvatarName(db) {
  const used = allUsedAvatarNames(db);
  const total = AVATAR_ADJECTIVES.length * AVATAR_NOUNS.length;
  const start = crypto.randomInt(total);
  for (let offset = 0; offset < total; offset++) {
    const index = (start + offset) % total;
    const first = AVATAR_ADJECTIVES[Math.floor(index / AVATAR_NOUNS.length)];
    const second = AVATAR_NOUNS[index % AVATAR_NOUNS.length];
    const name = `${first} ${second}`;
    if (!used.has(lower(name)) && isCleanAvatarName(name)) {
      db.usedAvatarNames.push(name);
      return name;
    }
  }
  let name;
  do { name = `Spark ${crypto.randomBytes(4).toString('hex').toUpperCase()}`; } while (used.has(lower(name)));
  db.usedAvatarNames.push(name);
  return name;
}


function pickLiveChallenge(seed = '') {
  const source = String(seed || crypto.randomBytes(4).toString('hex'));
  const sum = source.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return LIVE_CHALLENGES[sum % LIVE_CHALLENGES.length];
}

function normalize(value) {
  return String(value || '').trim();
}

function lower(value) {
  return normalize(value).toLowerCase();
}

function uniqueArray(values) {
  const arr = Array.isArray(values) ? values : [values];
  return [...new Set(arr.map(v => normalize(v)).filter(Boolean))];
}

function publicPlayer(player) {
  return {
    id: player.id,
    avatarName: player.avatarName || null,
    avatarNameAssigned: !!player.avatarName,
    phoneVerified: !!player.phoneVerified,
    phoneLast4: player.phoneLast4 || '',
    checkedIn: !!player.checkedIn,
    checkedInVenueId: player.checkedInVenueId || null,
    checkedInVenueName: player.checkedInVenueName || null,
    waitingForHost: !!(player.checkedIn && player.ready && !player.matchId),
    ready: !!player.ready,
    stage: player.stage,
    profile: player.profile,
    matchId: player.matchId || null,
    liveVerified: !!player.liveVerified,
    liveChallenge: player.liveChallenge || null,
    avatarImage: player.avatarImage || null,
    liveVerifiedAt: player.liveVerifiedAt || null,
    createdAt: player.createdAt
  };
}

function hostPlayer(player) {
  return {
    ...publicPlayer(player),
    rsvpOk: player.rsvpOk,
    profileCompleteness: profileCompleteness(player),
    matchScope: player.profile?.matchScope || '',
    checkedInVenueId: player.checkedInVenueId || null,
    checkedInVenueName: player.checkedInVenueName || '',
    phoneVerified: !!player.phoneVerified,
    phoneLast4: player.phoneLast4 || ''
  };
}

function profileCompleteness(player) {
  const profile = player.profile || {};
  const total = STAGE_ORDER.length;
  const done = STAGE_ORDER.filter(stage => {
    const q = QUESTIONS[stage];
    const value = profile[q.field];
    return Array.isArray(value) ? value.length : !!value;
  }).length;
  return Math.round((done / total) * 100);
}

function nextStage(player) {
  const profile = player.profile || {};
  for (const stage of STAGE_ORDER) {
    const q = QUESTIONS[stage];
    const value = profile[q.field];
    if (Array.isArray(value) ? value.length === 0 : !value) return stage;
  }
  return 'complete';
}

function getQuestionForPlayer(player) {
  if (!player.liveVerified) {
    return {
      stage: 'liveVerify',
      complete: false,
      liveVerify: true,
      question: 'Complete your live verified cartoon avatar first.',
      helper: 'One Match AI uses camera-only capture plus a random live challenge to reduce catfishing. Saved photos are not allowed.',
      options: []
    };
  }
  const stage = nextStage(player);
  if (stage === 'complete') {
    return {
      stage: 'complete',
      complete: true,
      question: 'Your One Match AI profile is ready. Your assigned avatar name is now revealed. Check in at the venue with the host code to enter the matching pool.',
      helper: 'No endless swiping. No one enters matching until the venue host check-in is complete.',
      options: []
    };
  }
  return { stage, complete: false, ...QUESTIONS[stage] };
}

function updateProfileAnswer(player, stage, answer, textAnswer) {
  const q = QUESTIONS[stage];
  if (!q) return;
  player.profile ||= {};
  if (q.multi) {
    const values = uniqueArray(answer);
    player.profile[q.field] = values.slice(0, q.max || 4);
  } else {
    player.profile[q.field] = normalize(textAnswer || answer);
  }
  player.stage = nextStage(player);
  player.ready = player.stage === 'complete';
  player.updatedAt = now();
  player.aiLog ||= [];
  player.aiLog.push({ at: now(), stage, answer: player.profile[q.field] });
}

function isMessageUnsafe(text) {
  const message = lower(text);
  return BAD_WORDS.some(bad => message.includes(bad));
}

function canPotentiallyMatch(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (!a.liveVerified || !b.liveVerified) return false;
  if (!a.checkedIn || !b.checkedIn || !a.ready || !b.ready) return false;
  if (!a.checkedInVenueId || !b.checkedInVenueId) return false;
  if (a.blockedUserIds?.includes(b.id) || b.blockedUserIds?.includes(a.id)) return false;

  const sameVenue = a.checkedInVenueId === b.checkedInVenueId;
  const aCross = lower(a.profile?.matchScope) === 'across participating venues for my best match';
  const bCross = lower(b.profile?.matchScope) === 'across participating venues for my best match';
  if (!sameVenue && !(aCross && bCross)) return false;

  const aSeeking = lower(a.profile?.seeking || 'anyone compatible');
  const bSeeking = lower(b.profile?.seeking || 'anyone compatible');
  const aGender = lower(a.profile?.gender || 'prefer not to say');
  const bGender = lower(b.profile?.gender || 'prefer not to say');

  function seekingAllows(seeking, gender) {
    if (seeking === 'anyone compatible') return true;
    if (seeking === 'men') return ['man', 'male', 'men'].includes(gender);
    if (seeking === 'women') return ['woman', 'female', 'women'].includes(gender);
    if (seeking === 'men and women') return ['man', 'male', 'men', 'woman', 'female', 'women'].includes(gender);
    if (seeking === 'nonbinary people') return gender.includes('nonbinary');
    return true;
  }

  if (!seekingAllows(aSeeking, bGender)) return false;
  if (!seekingAllows(bSeeking, aGender)) return false;

  const aPreferredAges = uniqueArray(a.profile?.preferredAgeRange).map(lower);
  const bPreferredAges = uniqueArray(b.profile?.preferredAgeRange).map(lower);
  const aAge = lower(a.profile?.ageRange);
  const bAge = lower(b.profile?.ageRange);
  if (aPreferredAges.length && !aPreferredAges.includes('open to the right person') && bAge && !aPreferredAges.includes(bAge)) return false;
  if (bPreferredAges.length && !bPreferredAges.includes('open to the right person') && aAge && !bPreferredAges.includes(aAge)) return false;
  return true;
}

function overlapScore(aValues, bValues, weight) {
  const a = new Set(uniqueArray(aValues).map(lower));
  const b = new Set(uniqueArray(bValues).map(lower));
  let score = 0;
  for (const item of a) if (b.has(item)) score += weight;
  return score;
}

function exactScore(a, b, weight) {
  return lower(a) && lower(a) === lower(b) ? weight : 0;
}

function softIntentScore(a, b) {
  const x = lower(a), y = lower(b);
  if (!x || !y) return 0;
  if (x === y) return 20;
  const serious = ['serious relationship', 'friendship first', 'open to dating'];
  const casual = ['casual dating', 'not sure yet', 'open to dating'];
  if (serious.includes(x) && serious.includes(y)) return 10;
  if (casual.includes(x) && casual.includes(y)) return 8;
  if ((x === 'serious relationship' && y === 'casual dating') || (y === 'serious relationship' && x === 'casual dating')) return -35;
  return 0;
}

function dealbreakerPenalty(a, b) {
  let penalty = 0;
  const aBreakers = uniqueArray(a.profile?.dealbreakers).map(lower);
  const bBreakers = uniqueArray(b.profile?.dealbreakers).map(lower);
  const aIntent = lower(a.profile?.intent);
  const bIntent = lower(b.profile?.intent);
  if (aBreakers.includes('does not want commitment') && bIntent === 'casual dating') penalty -= 25;
  if (bBreakers.includes('does not want commitment') && aIntent === 'casual dating') penalty -= 25;
  if (aBreakers.includes('heavy partying') && lower(b.profile?.energy) === 'high-energy nightlife') penalty -= 12;
  if (bBreakers.includes('heavy partying') && lower(a.profile?.energy) === 'high-energy nightlife') penalty -= 12;
  if (aBreakers.includes('poor communication') && lower(b.profile?.communication) === 'low-pressure') penalty -= 8;
  if (bBreakers.includes('poor communication') && lower(a.profile?.communication) === 'low-pressure') penalty -= 8;
  if (aBreakers.includes('rushing intimacy') && lower(b.profile?.pace) === 'fast chemistry') penalty -= 10;
  if (bBreakers.includes('rushing intimacy') && lower(a.profile?.pace) === 'fast chemistry') penalty -= 10;
  return penalty;
}

function compatibility(a, b) {
  if (!canPotentiallyMatch(a, b)) return null;
  let score = 50;
  score += softIntentScore(a.profile?.intent, b.profile?.intent);
  score += overlapScore(a.profile?.values, b.profile?.values, 8);
  score += overlapScore(a.profile?.greenflags, b.profile?.greenflags, 4);
  score += exactScore(a.profile?.pace, b.profile?.pace, 12);
  score += exactScore(a.profile?.communication, b.profile?.communication, 10);
  score += exactScore(a.profile?.chemistry, b.profile?.chemistry, 8);
  score += exactScore(a.profile?.dateStyle, b.profile?.dateStyle, 5);
  score += exactScore(a.profile?.followupPriority, b.profile?.followupPriority, 10);
  score += exactScore(a.profile?.attractionBalance, b.profile?.attractionBalance, 4);

  // Appearance preferences are soft signals only. Age and seeking are handled as filters.
  score += exactScore(a.profile?.stylePreference, b.profile?.styleSelf, 3);
  score += exactScore(b.profile?.stylePreference, a.profile?.styleSelf, 3);

  const aBuildPref = lower(a.profile?.buildPreference);
  const bBuildPref = lower(b.profile?.buildPreference);
  const aBuild = lower(a.profile?.buildSelf);
  const bBuild = lower(b.profile?.buildSelf);
  if (aBuildPref && aBuildPref !== 'no strong preference' && aBuildPref !== 'open to chemistry' && bBuild && aBuildPref.includes(bBuild.split(' ')[0])) score += 2;
  if (bBuildPref && bBuildPref !== 'no strong preference' && bBuildPref !== 'open to chemistry' && aBuild && bBuildPref.includes(aBuild.split(' ')[0])) score += 2;

  const sameVenue = a.checkedInVenueId === b.checkedInVenueId;
  if (sameVenue) score += 4;
  else score += 8; // both opted into cross-venue matching, so reward best-match flexibility.

  score += dealbreakerPenalty(a, b);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const sharedValues = common(a.profile?.values, b.profile?.values);
  const sharedGreen = common(a.profile?.greenflags, b.profile?.greenflags);
  const differences = [];
  if (lower(a.profile?.energy) !== lower(b.profile?.energy)) differences.push('different social energy');
  if (lower(a.profile?.pace) !== lower(b.profile?.pace)) differences.push('different dating pace');
  if (lower(a.profile?.communication) !== lower(b.profile?.communication)) differences.push('different communication style');

  const reasons = [];
  if (a.checkedInVenueId && b.checkedInVenueId && a.checkedInVenueId !== b.checkedInVenueId) {
    reasons.push('Cross-venue match: both of you allowed One Match AI to search across participating venues for the strongest match.');
  } else if (a.checkedInVenueId && b.checkedInVenueId) {
    reasons.push('Same-venue match: both of you are checked into the same location.');
  }
  if (sharedValues.length) reasons.push(`Shared values: ${sharedValues.join(', ')}.`);
  if (a.profile?.intent && b.profile?.intent) reasons.push(`Dating intention fit: ${a.profile.intent} / ${b.profile.intent}.`);
  if (lower(a.profile?.pace) === lower(b.profile?.pace) && a.profile?.pace) reasons.push(`Both prefer a ${a.profile.pace.toLowerCase()} pace.`);
  if (lower(a.profile?.communication) === lower(b.profile?.communication) && a.profile?.communication) reasons.push(`Both connect through ${a.profile.communication.toLowerCase()} communication.`);
  if (sharedGreen.length) reasons.push(`Green flags you both notice: ${sharedGreen.join(', ')}.`);
  if (a.profile?.attractionBalance && b.profile?.attractionBalance && lower(a.profile.attractionBalance) === lower(b.profile.attractionBalance)) {
    reasons.push(`Attraction balance fit: you both described attraction/connection in a similar way.`);
  }
  if (a.profile?.stylePreference && b.profile?.styleSelf && lower(a.profile.stylePreference) === lower(b.profile.styleSelf)) {
    reasons.push(`Soft attraction signal: their style matches something that catches your attention.`);
  }
  if (b.profile?.stylePreference && a.profile?.styleSelf && lower(b.profile.stylePreference) === lower(a.profile.styleSelf)) {
    reasons.push(`Soft attraction signal: your style matches something that catches their attention.`);
  }
  if (differences.length) reasons.push(`Watch point: ${differences.join(', ')}. Use the prompt to see if that feels balanced or conflicting.`);
  if (!reasons.length) reasons.push('The AI found enough lifestyle and conversation overlap to make this worth a first spark round.');

  const prompt = firstSparkPrompt(a, b, sharedValues);
  return { score, reasons, prompt, sharedValues, differences };
}

function common(aValues, bValues) {
  const a = uniqueArray(aValues);
  const bLower = new Set(uniqueArray(bValues).map(lower));
  return a.filter(item => bLower.has(lower(item)));
}

function firstSparkPrompt(a, b, sharedValues = []) {
  const value = sharedValues[0] || a.profile?.followupPriority || 'connection';
  const chemistry = a.profile?.chemistry || b.profile?.chemistry || 'honest conversation';
  const options = [
    `First Spark Question: What does ${String(value).toLowerCase()} look like in a real relationship?`,
    `Mini Mission: Plan a low-pressure first date together in 3 minutes. You both have to agree on the place, vibe, and one question you would ask there.`,
    `Chemistry Challenge: Each person answers this: what makes you feel safe enough to be yourself?`,
    `Real Talk Prompt: You both value ${String(value).toLowerCase()}. How would someone prove that with actions instead of words?`,
    `Light Prompt: Build a $50 date night together. The goal is ${String(chemistry).toLowerCase()}, not showing off.`
  ];
  const seed = (a.id + b.id).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return options[seed % options.length];
}

function runMatchFunnel(db) {
  const players = db.players.filter(p => p.liveVerified && p.checkedIn && p.ready && !p.matchId);
  const pairs = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const result = compatibility(players[i], players[j]);
      if (result) pairs.push({ a: players[i], b: players[j], ...result });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const used = new Set();
  const created = [];
  for (const pair of pairs) {
    if (used.has(pair.a.id) || used.has(pair.b.id)) continue;
    if (pair.score < 55) continue;
    const match = {
      id: id('match'),
      playerA: pair.a.id,
      playerB: pair.b.id,
      score: pair.score,
      reasons: pair.reasons,
      prompt: pair.prompt,
      status: 'revealed',
      firstSparkStartedAt: null,
      ratings: {},
      chatUnlocked: false,
      chat: [],
      contactRequests: {},
      revealRequests: {},
      meetInterest: {},
      meetVenueChoices: {},
      confirmedMeetVenueId: null,
      crossVenue: pair.a.checkedInVenueId !== pair.b.checkedInVenueId,
      venueA: pair.a.checkedInVenueId || null,
      venueB: pair.b.checkedInVenueId || null,
      datePlan: null,
      createdAt: now()
    };
    db.matches.push(match);
    pair.a.matchId = match.id;
    pair.b.matchId = match.id;
    pair.a.updatedAt = now();
    pair.b.updatedAt = now();
    used.add(pair.a.id);
    used.add(pair.b.id);
    created.push(match);
  }

  // Players still unmatched receive a transparent status. They can be rerun after new players join.
  db.players.forEach(p => {
    if (p.liveVerified && p.checkedIn && p.ready && !p.matchId) {
      p.noMatchMessage = 'One Match AI did not find a strong enough match yet. This is better than forcing a bad match. Try again when more players join.';
      p.updatedAt = now();
    }
  });
  return created;
}

function getMatchForPlayer(db, playerId) {
  const player = db.players.find(p => p.id === playerId);
  if (!player?.matchId) return null;
  return db.matches.find(m => m.id === player.matchId) || null;
}

function publicMatch(db, match, viewerId) {
  if (!match) return null;
  const viewer = db.players.find(p => p.id === viewerId);
  const otherId = match.playerA === viewerId ? match.playerB : match.playerA;
  const other = db.players.find(p => p.id === otherId);
  const bothRated = !!match.ratings?.[match.playerA] && !!match.ratings?.[match.playerB];
  const mutualReveal = !!(match.revealRequests?.[match.playerA] && match.revealRequests?.[match.playerB]);
  const bothMeetInterested = !!(match.meetInterest?.[match.playerA] && match.meetInterest?.[match.playerB]);
  const crossVenuePhotoUnlocked = !!(match.crossVenue && bothMeetInterested);
  const revealUnlocked = mutualReveal || crossVenuePhotoUnlocked;
  const myVenue = venueForPlayer(db, viewer);
  const otherVenue = venueForPlayer(db, other);
  const confirmedVenue = match.confirmedMeetVenueId ? db.venues.find(v => v.id === match.confirmedMeetVenueId) : null;
  return {
    id: match.id,
    score: match.score,
    other: other ? { id: other.id, avatarName: other.avatarName, avatarImage: other.avatarImage || null, liveVerified: !!other.liveVerified } : null,
    reasons: match.reasons,
    prompt: match.prompt,
    status: match.status,
    firstSparkStartedAt: match.firstSparkStartedAt,
    myRating: match.ratings?.[viewerId] || null,
    bothRated,
    chatUnlocked: !!match.chatUnlocked,
    chat: match.chatUnlocked ? match.chat.map(c => ({
      at: c.at,
      fromMe: c.from === viewerId,
      avatarName: c.from === 'system' ? 'One Match AI' : (db.players.find(p => p.id === c.from)?.avatarName || 'One Match AI Guest'),
      text: c.text
    })) : [],
    datePlan: match.datePlan,
    crossVenue: !!match.crossVenue,
    myVenue: myVenue ? publicVenue(myVenue) : null,
    otherVenue: otherVenue ? publicVenue(otherVenue) : null,
    meetInterest: {
      mine: !!match.meetInterest?.[viewerId],
      other: !!match.meetInterest?.[otherId],
      both: bothMeetInterested
    },
    meetVenueChoice: {
      mine: match.meetVenueChoices?.[viewerId] || null,
      other: match.meetVenueChoices?.[otherId] || null,
      confirmedVenue: confirmedVenue ? publicVenue(confirmedVenue) : null
    },
    myContactRequest: match.contactRequests?.[viewerId] || null,
    otherContactRequest: match.chatUnlocked ? (match.contactRequests?.[otherId] || null) : null,
    myRevealRequest: !!match.revealRequests?.[viewerId],
    otherRevealRequest: match.chatUnlocked ? !!match.revealRequests?.[otherId] : false,
    revealUnlocked,
    photoRevealReason: crossVenuePhotoUnlocked ? 'Cross-venue meetup requires both live-verified photos to be displayed before choosing where to meet.' : null,
    myRealPhoto: revealUnlocked ? (viewer?.livePhoto || null) : null,
    otherRealPhoto: revealUnlocked ? (other?.livePhoto || null) : null,
    noMatchMessage: viewer?.noMatchMessage || null
  };
}

function hostMatch(db, match) {
  const a = db.players.find(p => p.id === match.playerA);
  const b = db.players.find(p => p.id === match.playerB);
  const venueA = a ? venueForPlayer(db, a) : null;
  const venueB = b ? venueForPlayer(db, b) : null;
  const confirmedVenue = match.confirmedMeetVenueId ? db.venues.find(v => v.id === match.confirmedMeetVenueId) : null;
  return {
    id: match.id,
    players: [a?.avatarName || 'Pending Avatar A', b?.avatarName || 'Pending Avatar B'],
    venues: [venueA?.name || '', venueB?.name || ''],
    crossVenue: !!match.crossVenue,
    score: match.score,
    status: match.status,
    chatUnlocked: !!match.chatUnlocked,
    ratings: match.ratings || {},
    meetInterest: match.meetInterest || {},
    confirmedMeetVenue: confirmedVenue?.name || '',
    prompt: match.prompt,
    reasons: match.reasons,
    revealUnlocked: !!(match.revealRequests?.[match.playerA] && match.revealRequests?.[match.playerB]) || !!(match.crossVenue && match.meetInterest?.[match.playerA] && match.meetInterest?.[match.playerB]),
    createdAt: match.createdAt
  };
}

function maybeUnlockChat(match) {
  const aRating = match.ratings?.[match.playerA];
  const bRating = match.ratings?.[match.playerB];
  const positive = ['Strong Spark', 'Interested'];
  if (positive.includes(aRating) && positive.includes(bRating)) {
    match.chatUnlocked = true;
    match.status = 'chat_unlocked';
    if (!match.chat?.length) {
      match.chat ||= [];
      match.chat.push({
        at: now(),
        from: 'system',
        text: 'One Match AI unlocked this chat because you both showed mutual interest. Keep it respectful and low-pressure.'
      });
    }
  } else if (aRating && bRating) {
    match.status = 'closed_no_mutual';
    match.chatUnlocked = false;
  }
}

async function maybeOpenAI(system, user, fallback) {
  if (!OPENAI_API_KEY) return fallback;
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_output_tokens: 350
      })
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data.output_text || data.output?.flatMap(o => o.content || []).map(c => c.text || '').join('\n') || '';
    return text.trim() || fallback;
  } catch (err) {
    return fallback;
  }
}

async function aiDatePlan(playerA, playerB) {
  const fallback = [
    'Trivia or game night: low pressure, built-in conversation, easy way to see teamwork.',
    'Coffee or dessert: short, safe, and simple enough to extend if the energy is good.',
    'Live music or a casual lounge: enough atmosphere to relax without forcing constant talking.'
  ];
  const system = 'You are One Match AI, a respectful dating matchmaker. Suggest safe, low-pressure first-date ideas. Do not use explicit content. Keep it concise.';
  const user = `Player A profile: ${JSON.stringify(playerA.profile)}\nPlayer B profile: ${JSON.stringify(playerB.profile)}\nSuggest 3 first date ideas with one-sentence reasons.`;
  const text = await maybeOpenAI(system, user, fallback.map((x, i) => `${i + 1}. ${x}`).join('\n'));
  return text;
}

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

async function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

function serveStatic(req, res) {
  let requested = decodeURIComponent(req.url.split('?')[0]);
  if (requested === '/vendor/jsQR.js') {
    const vendorPath = path.join(__dirname, 'node_modules', 'jsqr', 'dist', 'jsQR.js');
    return fs.readFile(vendorPath, (err, data) => {
      if (err) return sendText(res, 404, 'QR scanner library not installed. Run npm install.');
      sendText(res, 200, data, 'application/javascript; charset=utf-8');
    });
  }
  if (requested === '/' || requested === '/play') requested = '/index.html';
  if (requested === '/host') requested = '/host.html';
  const safePath = path.normalize(requested).replace(/^\.+[\\/]/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    sendText(res, 200, data, types[ext] || 'application/octet-stream');
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const db = readDb();
  const autoCreated = maybeAutoStartRound(db);
  if (autoCreated) writeDb(db);

  if (method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, app: 'One Match AI', time: now(), openAIEnabled: !!OPENAI_API_KEY });
  }

  if (method === 'GET' && url.pathname === '/api/event') {
    return send(res, 200, { event: publicEvent(db) });
  }

  if (method === 'GET' && url.pathname === '/api/venues') {
    ensureVenues(db);
    return send(res, 200, { venues: db.venues.map(publicVenue) });
  }

  if (method === 'POST' && url.pathname === '/api/auth/check-phone') {
    const body = await parseBody(req);
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) return send(res, 400, { error: 'Enter a valid 10-digit mobile number.' });
    const existing = findPlayerByPhone(db, phone);
    const lockout = authLockoutMessage(existing);
    if (lockout) return send(res, 423, { exists: true, locked: true, lockoutUntil: existing.lockoutUntil, error: lockout });
    return send(res, 200, { exists: !!existing, phoneLast4: phone.slice(-4), locked: false });
  }

  if (method === 'POST' && url.pathname === '/api/auth/create') {
    const body = await parseBody(req);
    const phone = normalizePhone(body.phone);
    const pin = normalize(body.pin);
    const ageConfirmed = !!body.ageConfirmed;
    const termsAccepted = !!body.termsAccepted;
    if (!isValidPhone(phone)) return send(res, 400, { error: 'Enter a valid 10-digit mobile number.' });
    if (!isValidPin(pin)) return send(res, 400, { error: 'Create a 4-digit PIN.' });
    if (!ageConfirmed) return send(res, 400, { error: 'You must confirm you are 18+ to join.' });
    if (!termsAccepted) return send(res, 400, { error: 'You must agree to the Terms and Conditions to enter.' });
    const existing = findPlayerByPhone(db, phone);
    if (existing) return send(res, 409, { error: 'A profile already exists for this mobile number. Return with your PIN.' });

    const playerId = id('player');
    const player = {
      id: playerId,
      phoneHash: phoneHash(phone),
      phoneLast4: phone.slice(-4),
      phoneVerified: true,
      pinHash: pinHash(phone, pin),
      pinCreatedAt: now(),
      pinAttempts: 0,
      lockoutUntil: null,
      avatarName: null,
      avatarNameAssignedAt: null,
      ageConfirmed: true,
      termsAccepted: true,
      termsAcceptedAt: now(),
      rsvpOk: true,
      checkedIn: false,
      ready: false,
      stage: 'liveVerify',
      liveVerified: false,
      liveChallenge: pickLiveChallenge(playerId + now()),
      avatarImage: null,
      livePhoto: null,
      profile: {},
      aiLog: [],
      blockedUserIds: [],
      createdAt: now(),
      updatedAt: now()
    };
    db.players.push(player);
    writeDb(db);
    return send(res, 201, { player: publicPlayer(player), question: getQuestionForPlayer(player), match: null, event: publicEvent(db), venues: db.venues.map(publicVenue) });
  }

  if (method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const phone = normalizePhone(body.phone);
    const pin = normalize(body.pin);
    if (!isValidPhone(phone)) return send(res, 400, { error: 'Enter a valid 10-digit mobile number.' });
    if (!isValidPin(pin)) return send(res, 400, { error: 'Enter your 4-digit PIN.' });
    const player = findPlayerByPhone(db, phone);
    if (!player) return send(res, 404, { error: 'No profile found for this mobile number. Create a new profile first.' });
    const lockout = authLockoutMessage(player);
    if (lockout) return send(res, 423, { error: lockout, lockoutUntil: player.lockoutUntil });
    if (player.pinHash !== pinHash(phone, pin)) {
      player.pinAttempts = (player.pinAttempts || 0) + 1;
      if (player.pinAttempts >= 3) {
        player.lockoutUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        player.pinAttempts = 0;
        writeDb(db);
        return send(res, 423, { error: 'Too many wrong PIN attempts. Profile access is locked for 10 minutes.', lockoutUntil: player.lockoutUntil });
      }
      writeDb(db);
      return send(res, 403, { error: `Wrong PIN. Attempt ${player.pinAttempts} of 3.` });
    }
    player.pinAttempts = 0;
    player.lockoutUntil = null;
    player.lastLoginAt = now();
    player.updatedAt = now();
    writeDb(db);
    const match = getMatchForPlayer(db, player.id);
    return send(res, 200, { player: publicPlayer(player), question: getQuestionForPlayer(player), match: publicMatch(db, match, player.id), event: publicEvent(db), venues: db.venues.map(publicVenue) });
  }

  if (method === 'POST' && url.pathname === '/api/player/start') {
    return send(res, 410, { error: 'Use mobile number and PIN signup.' });
    const body = await parseBody(req);
    const ageConfirmed = !!body.ageConfirmed;
    const termsAccepted = !!body.termsAccepted;
    if (!ageConfirmed) return send(res, 400, { error: 'You must confirm you are 18+ to join.' });
    if (!termsAccepted) return send(res, 400, { error: 'You must agree to the Terms and Conditions to enter.' });
    const playerId = id('player');
    const player = {
      id: playerId,
      avatarName: null,
      avatarNameAssignedAt: null,
      ageConfirmed: true,
      termsAccepted: true,
      termsAcceptedAt: now(),
      rsvpOk: true,
      checkedIn: false,
      ready: false,
      stage: 'liveVerify',
      liveVerified: false,
      liveChallenge: pickLiveChallenge(playerId + now()),
      avatarImage: null,
      livePhoto: null,
      profile: {},
      aiLog: [],
      blockedUserIds: [],
      createdAt: now(),
      updatedAt: now()
    };
    db.players.push(player);
    writeDb(db);
    return send(res, 201, { player: publicPlayer(player), question: getQuestionForPlayer(player) });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/player\/[^/]+\/live-verify$/)) {
    const playerId = url.pathname.split('/')[3];
    const player = db.players.find(p => p.id === playerId);
    if (!player) return send(res, 404, { error: 'Player not found.' });
    const body = await parseBody(req);
    const realImage = normalize(body.realImage);
    const avatarImage = normalize(body.avatarImage);
    const challenge = normalize(body.challenge);
    if (!realImage.startsWith('data:image/') || !avatarImage.startsWith('data:image/')) return send(res, 400, { error: 'Live capture failed. Try again.' });
    if (challenge && challenge !== player.liveChallenge) return send(res, 400, { error: 'Live challenge mismatch. Please try again.' });
    player.liveVerified = true;
    player.liveVerifiedAt = now();
    player.livePhoto = realImage;
    player.avatarImage = avatarImage;
    player.stage = nextStage(player);
    player.ready = player.stage === 'complete';
    player.updatedAt = now();
    writeDb(db);
    return send(res, 200, { player: publicPlayer(player), question: getQuestionForPlayer(player), message: 'Live selfie verified. Your pixelated privacy avatar is ready.' });
  }

  if (method === 'GET' && url.pathname.startsWith('/api/player/')) {
    const parts = url.pathname.split('/');
    const playerId = parts[3];
    const player = db.players.find(p => p.id === playerId);
    if (!player) return send(res, 404, { error: 'Player not found.' });
    const match = getMatchForPlayer(db, player.id);
    return send(res, 200, { player: publicPlayer(player), question: getQuestionForPlayer(player), match: publicMatch(db, match, player.id), event: publicEvent(db), venues: db.venues.map(publicVenue) });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/player\/[^/]+\/answer$/)) {
    const playerId = url.pathname.split('/')[3];
    const player = db.players.find(p => p.id === playerId);
    if (!player) return send(res, 404, { error: 'Player not found.' });
    const body = await parseBody(req);
    if (!player.liveVerified) return send(res, 400, { error: 'Complete live verification before answering AI matchmaker questions.' });
    const stage = body.stage || nextStage(player);
    updateProfileAnswer(player, stage, body.answer, body.textAnswer);
    if (player.ready && !player.avatarName) {
      player.avatarName = generateAvatarName(db);
      player.avatarNameAssignedAt = now();
      player.updatedAt = now();
    }
    // Clear stale no-match status when a player updates their profile.
    delete player.noMatchMessage;
    writeDb(db);
    const fallback = `Got it. ${getQuestionForPlayer(player).complete ? 'Your One Match AI profile is ready.' : 'Let us keep narrowing.'}`;
    const aiLine = await maybeOpenAI(
      'You are One Match AI, a private dating matchmaker. Reply warmly in one short sentence after a user answers a profile question. Never be sexual. Never promise soulmate results.',
      `Question stage: ${stage}. Answer: ${JSON.stringify(body.answer || body.textAnswer)}. Next stage: ${nextStage(player)}.`,
      fallback
    );
    return send(res, 200, { player: publicPlayer(player), question: getQuestionForPlayer(player), aiLine });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/player\/[^/]+\/checkin$/)) {
    const playerId = url.pathname.split('/')[3];
    const player = db.players.find(p => p.id === playerId);
    if (!player) return send(res, 404, { error: 'Player not found.' });
    const body = await parseBody(req);
    const token = normalize(body.token || body.checkinToken || body.checkinCode);
    if (!player.liveVerified) return send(res, 400, { error: 'Complete live photo verification first.' });
    if (!player.ready || !player.avatarName) return send(res, 400, { error: 'Finish your profile before venue check-in.' });
    const venue = findVenueByToken(db, token);
    if (!venue || lower(venue.status) !== 'open') return send(res, 403, { error: 'Invalid or inactive venue QR code.' });
    if (player.checkedIn && player.checkedInVenueId && player.checkedInVenueId !== venue.id) {
      return send(res, 409, { error: `You are already checked in at ${player.checkedInVenueName || 'another venue'}. Ask the host before switching venues.` });
    }
    player.checkedIn = true;
    player.checkedInVenueId = venue.id;
    player.checkedInVenueName = venue.name;
    player.checkedInAt = now();
    player.updatedAt = now();
    writeDb(db);
    return send(res, 200, { player: publicPlayer(player), venue: publicVenue(venue), message: `Checked in at ${venue.name}. You are in the Mingle waiting room until the host starts the match round.` });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/player\/[^/]+\/find-match$/)) {
    const playerId = url.pathname.split('/')[3];
    const player = db.players.find(p => p.id === playerId);
    if (!player) return send(res, 404, { error: 'Player not found.' });
    if (!player.liveVerified || !player.checkedIn || !player.ready) return send(res, 400, { error: 'Finish live verification, profile setup, and venue check-in first.' });
    const match = getMatchForPlayer(db, player.id);
    return send(res, 200, { player: publicPlayer(player), match: publicMatch(db, match, player.id), message: match ? 'One Match AI found your strongest match for this session.' : 'You are checked in and waiting for the host to start the match round.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/start-spark$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    match.status = 'first_spark';
    match.firstSparkStartedAt ||= now();
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: 'First Spark Round started. Talk in person, then rate privately.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/rate$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const rating = normalize(body.rating);
    const allowed = ['Strong Spark', 'Interested', 'Friend Vibe', 'No Connection'];
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!allowed.includes(rating)) return send(res, 400, { error: 'Invalid rating.' });
    match.ratings ||= {};
    match.ratings[playerId] = rating;
    maybeUnlockChat(match);
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: match.chatUnlocked ? 'Mutual interest confirmed. Chat unlocked.' : 'Your private response was saved.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/chat$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const text = normalize(body.text).slice(0, 1000);
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Chat unlocks only after mutual interest.' });
    if (!text) return send(res, 400, { error: 'Message cannot be empty.' });
    if (isMessageUnsafe(text)) {
      return send(res, 400, { error: 'One Match AI safety check blocked this message. Keep it respectful and low-pressure.' });
    }
    match.chat ||= [];
    match.chat.push({ at: now(), from: playerId, text });
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId) });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/date-plan$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Plan unlocks after mutual interest.' });
    const a = db.players.find(p => p.id === match.playerA);
    const b = db.players.find(p => p.id === match.playerB);
    match.datePlan = await aiDatePlan(a, b);
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId) });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/contact$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Contact sharing unlocks after mutual interest.' });
    match.contactRequests ||= {};
    match.contactRequests[playerId] = {
      type: normalize(body.type || 'In-app only').slice(0, 40),
      value: normalize(body.value || '').slice(0, 120),
      at: now()
    };
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: 'Contact preference saved. It only matters if both people agree.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/meet-interest$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const interested = !!body.interested;
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Meet-up choices unlock after mutual interest.' });
    if (!match.crossVenue) return send(res, 400, { error: 'Meet-up venue choice is only needed for cross-venue matches.' });
    match.meetInterest ||= {};
    if (interested) match.meetInterest[playerId] = { at: now() };
    else delete match.meetInterest[playerId];
    const both = !!(match.meetInterest[match.playerA] && match.meetInterest[match.playerB]);
    if (both) {
      match.status = 'cross_venue_photo_required';
      match.chat ||= [];
      match.chat.push({ at: now(), from: 'system', text: 'Both people are open to meeting tonight. Because this is a cross-venue match, live-verified photos are now displayed before choosing where to meet.' });
    }
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: both ? 'Both agreed to consider meeting. Live-verified photos are now displayed.' : 'Your meet-up interest was saved. Venue choices open if both people agree.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/meet-venue$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const venueId = normalize(body.venueId);
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Venue choice unlocks after mutual interest.' });
    if (!match.crossVenue) return send(res, 400, { error: 'Venue choice is only needed for cross-venue matches.' });
    if (!(match.meetInterest?.[match.playerA] && match.meetInterest?.[match.playerB])) return send(res, 403, { error: 'Both people must agree to consider meeting before choosing a venue.' });
    const allowedVenues = [match.venueA, match.venueB].filter(Boolean);
    if (!allowedVenues.includes(venueId)) return send(res, 400, { error: 'Choose one of the two checked-in venues.' });
    match.meetVenueChoices ||= {};
    match.meetVenueChoices[playerId] = venueId;
    const otherId = match.playerA === playerId ? match.playerB : match.playerA;
    if (match.meetVenueChoices[otherId] && match.meetVenueChoices[otherId] === venueId) {
      match.confirmedMeetVenueId = venueId;
      match.status = 'meetup_confirmed';
      const venue = db.venues.find(v => v.id === venueId);
      match.chat ||= [];
      match.chat.push({ at: now(), from: 'system', text: `Meet-up confirmed at ${venue?.name || 'the selected venue'}. Both people chose the same participating venue.` });
    } else {
      match.status = 'choosing_meet_venue';
    }
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: match.confirmedMeetVenueId ? 'Meet-up venue confirmed.' : 'Your venue choice was saved. It confirms only if both people choose the same venue.' });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/match\/[^/]+\/reveal-photo$/)) {
    const matchId = url.pathname.split('/')[3];
    const body = await parseBody(req);
    const playerId = body.playerId;
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return send(res, 404, { error: 'Match not found.' });
    if (![match.playerA, match.playerB].includes(playerId)) return send(res, 403, { error: 'Not your match.' });
    if (!match.chatUnlocked) return send(res, 403, { error: 'Photo reveal unlocks after mutual interest.' });
    match.revealRequests ||= {};
    match.revealRequests[playerId] = { at: now() };
    if (match.revealRequests[match.playerA] && match.revealRequests[match.playerB]) match.status = 'photo_revealed';
    writeDb(db);
    return send(res, 200, { match: publicMatch(db, match, playerId), message: (match.revealRequests[match.playerA] && match.revealRequests[match.playerB]) ? 'Both people agreed. Live verified photos are now revealed.' : 'Your reveal request was saved. Photos reveal only if both people agree.' });
  }

  if (method === 'POST' && url.pathname === '/api/report') {
    const body = await parseBody(req);
    const reporterId = body.reporterId;
    const reportedId = body.reportedId;
    const reason = normalize(body.reason).slice(0, 500);
    const reporter = db.players.find(p => p.id === reporterId);
    const reported = db.players.find(p => p.id === reportedId);
    if (!reporter || !reported) return send(res, 404, { error: 'Player not found.' });
    db.reports.push({ id: id('report'), reporterId, reportedId, reason, at: now() });
    reporter.blockedUserIds ||= [];
    if (!reporter.blockedUserIds.includes(reportedId)) reporter.blockedUserIds.push(reportedId);
    db.blocks.push({ id: id('block'), blockerId: reporterId, blockedId: reportedId, at: now() });
    writeDb(db);
    return send(res, 200, { message: 'Reported and blocked. The host can review the report.' });
  }

  // Host APIs
  if (method === 'POST' && url.pathname === '/api/host/login') {
    const body = await parseBody(req);
    if (normalize(body.pin) !== HOST_PIN) return send(res, 403, { error: 'Wrong host PIN.' });
    return send(res, 200, { ok: true, hostToken: 'local-host-token' });
  }

  if (url.pathname.startsWith('/api/host/')) {
    const token = req.headers['x-host-token'];
    if (token !== 'local-host-token') return send(res, 401, { error: 'Host login required.' });
  }

  if (method === 'GET' && url.pathname === '/api/host/state') {
    return send(res, 200, {
      event: publicEvent(db),
      venues: db.venues.map(v => ({ ...publicVenue(v), token: v.token })),
      players: db.players.map(hostPlayer),
      matches: db.matches.map(m => hostMatch(db, m)),
      reports: db.reports.map(r => ({
        ...r,
        reporter: db.players.find(p => p.id === r.reporterId)?.avatarName || 'Pending Avatar',
        reported: db.players.find(p => p.id === r.reportedId)?.avatarName || 'Pending Avatar'
      })),
      openAIEnabled: !!OPENAI_API_KEY
    });
  }

  if (method === 'POST' && url.pathname === '/api/host/event') {
    const body = await parseBody(req);
    db.event.title = normalize(body.title || db.event.title).slice(0, 120);
    db.event.venue = normalize(body.venue || db.event.venue).slice(0, 120);
    db.event.rsvpCode = normalize(body.rsvpCode || db.event.rsvpCode).toUpperCase().slice(0, 24);
    db.event.checkinCode = normalize(body.checkinCode || db.event.checkinCode).toUpperCase().slice(0, 24);
    db.event.roundLabel = normalize(body.roundLabel || db.event.roundLabel).slice(0, 80);
    if ('roundStartsAt' in body) {
      const rawStart = normalize(body.roundStartsAt);
      if (!rawStart) {
        db.event.roundStartsAt = null;
        db.event.roundStartedAt = null;
        db.event.roundStatus = 'waiting_for_host';
      } else {
        const parsed = new Date(rawStart);
        if (!Number.isNaN(parsed.getTime())) {
          db.event.roundStartsAt = parsed.toISOString();
          db.event.roundStartedAt = null;
          db.event.roundStatus = 'scheduled';
        }
      }
    }
    if (typeof body.autoStartEnabled === 'boolean') {
      db.event.autoStartEnabled = body.autoStartEnabled && !!db.event.roundStartsAt;
      if (!db.event.autoStartEnabled && !db.event.roundStartedAt) db.event.roundStatus = db.event.roundStartsAt ? 'scheduled' : 'waiting_for_host';
    }
    db.event.updatedAt = now();
    writeDb(db);
    return send(res, 200, { event: publicEvent(db) });
  }

  if (method === 'POST' && url.pathname === '/api/host/venue') {
    const body = await parseBody(req);
    ensureVenues(db);
    const name = normalize(body.name).slice(0, 120);
    if (!name) return send(res, 400, { error: 'Venue name is required.' });
    const venue = {
      id: slugify(name) + '-' + crypto.randomBytes(2).toString('hex'),
      name,
      address: normalize(body.address || '').slice(0, 160),
      city: normalize(body.city || '').slice(0, 80),
      eventTitle: normalize(body.eventTitle || 'Mingle Night').slice(0, 120),
      eventTime: normalize(body.eventTime || 'Tonight').slice(0, 80),
      status: normalize(body.status || 'open').toLowerCase() === 'closed' ? 'closed' : 'open',
      token: normalize(body.token || `VENUE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`).slice(0, 80),
      createdAt: now()
    };
    db.venues.push(venue);
    writeDb(db);
    return send(res, 200, { venue: { ...publicVenue(venue), token: venue.token } });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/host\/venue\/[^/]+\/token$/)) {
    const venueId = url.pathname.split('/')[4];
    const body = await parseBody(req);
    ensureVenues(db);
    const venue = db.venues.find(v => v.id === venueId);
    if (!venue) return send(res, 404, { error: 'Venue not found.' });
    const token = normalize(body.token).slice(0, 80);
    if (!token) return send(res, 400, { error: 'Custom token is required.' });
    const duplicate = db.venues.find(v => v.id !== venueId && lower(normalize(v.token)) === lower(token));
    if (duplicate) return send(res, 409, { error: 'Another venue already uses that token.' });
    venue.token = token;
    venue.updatedAt = now();
    writeDb(db);
    return send(res, 200, { venue: { ...publicVenue(venue), token: venue.token } });
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/host\/venue\/[^/]+\/status$/)) {
    const venueId = url.pathname.split('/')[4];
    const body = await parseBody(req);
    ensureVenues(db);
    const venue = db.venues.find(v => v.id === venueId);
    if (!venue) return send(res, 404, { error: 'Venue not found.' });
    venue.status = normalize(body.status || venue.status).toLowerCase() === 'closed' ? 'closed' : 'open';
    venue.updatedAt = now();
    writeDb(db);
    return send(res, 200, { venue: { ...publicVenue(venue), token: venue.token } });
  }

  if (method === 'GET' && url.pathname.match(/^\/api\/host\/venue\/[^/]+\/qr$/)) {
    const venueId = url.pathname.split('/')[4];
    ensureVenues(db);
    const venue = db.venues.find(v => v.id === venueId);
    if (!venue) return send(res, 404, { error: 'Venue not found.' });
    const payload = checkinPayloadForVenue(req, venue);
    let svg;
    if (QRCode) {
      svg = await QRCode.toString(payload, { type: 'svg', margin: 2, width: 320, errorCorrectionLevel: 'M' });
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="white"/><rect x="20" y="20" width="280" height="280" fill="none" stroke="black" stroke-width="6"/><text x="160" y="145" font-size="18" text-anchor="middle" fill="black">QR package not installed</text><text x="160" y="180" font-size="14" text-anchor="middle" fill="black">${venue.token}</text></svg>`;
    }
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(svg);
  }

  if (method === 'POST' && url.pathname === '/api/host/run-funnel') {
    const created = runMatchFunnel(db);
    db.event.roundStartedAt = now();
    db.event.roundStatus = 'started';
    db.event.lastManualStartAt = now();
    db.event.lastManualCreatedMatches = created.length;
    writeDb(db);
    return send(res, 200, { created: created.map(m => hostMatch(db, m)), message: `${created.length} One Match pair(s) created.` });
  }

  if (method === 'POST' && url.pathname === '/api/host/reset-matches') {
    db.matches = [];
    db.event.roundStartedAt = null;
    db.event.roundStatus = db.event.roundStartsAt ? 'scheduled' : 'waiting_for_host';
    db.players.forEach(p => { delete p.matchId; delete p.noMatchMessage; });
    writeDb(db);
    return send(res, 200, { message: 'Matches reset. Player profiles remain.' });
  }

  if (method === 'POST' && url.pathname === '/api/host/full-reset') {
    const body = await parseBody(req);
    if (normalize(body.confirm).toUpperCase() !== 'RESET') return send(res, 400, { error: 'Type RESET to confirm full reset.' });
    const fresh = { event: { ...defaultEvent(), title: db.event.title, venue: db.event.venue, rsvpCode: db.event.rsvpCode, checkinCode: db.event.checkinCode }, venues: db.venues || defaultVenues(), players: [], matches: [], reports: [], blocks: [], usedAvatarNames: db.usedAvatarNames || [] };
    writeDb(fresh);
    return send(res, 200, { message: 'Full reset complete.' });
  }

  return send(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApi(req, res);
    return serveStatic(req, res);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Server error.' });
  }
});

server.listen(PORT, () => {
  ensureDb();
  console.log(`One Match AI running on port ${PORT}`);
});
