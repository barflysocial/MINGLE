# One Match AI v6

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v6 changes
- More readable **TAP TO ENTER** title-screen button
- More complete Terms and Conditions with no MVP/test placeholder wording
- Pixelated privacy avatar replaces cartoon avatar wording and effect
- Real photo stays locked by default
- Real photo reveal only after confirmed mutual match logic
- Venue check-in only appears after profile is fully built and avatar name is revealed
- Venue check-in uses camera QR scanning
- Participating venues are displayed to users
- Each participating venue has its own check-in QR code
- Host can view venue QR codes in `/host`
- Matching can be same-venue only or across participating venues
- Cross-venue matching only happens when both users opt in
- Cross-venue meetup requires live-verified photos to display before choosing where to meet
- Cross-venue meet location is confirmed only if both people choose the same participating venue

## Routes
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard

## Demo codes
- Host PIN: `2468`
- RSVP Code: `ONEMATCH`

## Default venue QR tokens
These are built into the starter data so you can test without opening the QR:
- `VENUE-URBAN-DENHAM-77`
- `VENUE-PELICAN-MARS-77`
- `VENUE-TOPGOLF-BR-77`

In real use, the host dashboard displays actual QR codes for each venue.

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank

## Environment variables
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=...`

## MVP notes
This build still uses `data/db.json`. For production, upgrade to PostgreSQL so venue sessions, check-ins, used avatar names, and match records persist reliably across deploys.
