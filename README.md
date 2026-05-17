# One Match AI — Anti-Cheat + Preferences Build

Render-ready Node app for a live-event AI dating concept.

## New in this build
- Anti-copy/paste mode in the player app
- Tap-based multiple-choice matchmaking questions
- "I am", sexual/dating preference, "interested in meeting", and "looking for" questions
- Age-range matching
- Attraction preferences handled safely as soft signals
- No skin complexion filter
- Height, build, style, and attraction balance handled as private/soft preferences
- Live camera capture only
- Random liveness challenge prompt
- Cartoon avatar generated from live selfie in-browser
- Real photo hidden first
- Mutual real-photo reveal only after mutual match and unlocked chat

## Core flow
1. RSVP into the session
2. Create a private avatar name
3. Take a live selfie in the app
4. Generate a cartoon avatar
5. Answer tap-based One Match AI questions
6. Check in with the host code
7. Find one strongest match
8. Complete the First Spark round
9. Mutual chat unlocks only after both people show interest
10. Optional mutual real-photo reveal

## Demo codes
- Host PIN: `2468`
- RSVP Code: `ONEMATCH`
- Check-in Code: `HOST77`

## Run locally
```bash
npm install
npm start
```

Then open `http://localhost:3000`

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank if `package.json` is at the repo root

## Environment variable
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=...`

## Important MVP notes
The anti-cheat layer blocks copy/paste inside the app, randomizes tap options, and removes long-answer prompts. It does not stop someone from using another device.

The cartoon avatar is generated client-side with a simple stylized canvas effect. The liveness portion uses a live camera plus a random challenge prompt, but it is still an MVP and not a full biometric anti-spoofing system.

This app stores data in `data/db.json`. That is fine for testing and small pilots. For production, upgrade to PostgreSQL.
