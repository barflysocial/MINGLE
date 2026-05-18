# One Match AI v7

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v7 changes
- Removed RSVP code from the Join Mingle screen
- Join Mingle now only requires:
  - 18+ confirmation
  - Terms and Conditions agreement
  - ENTER
- Setup page simplified
- One question appears at a time
- Single-choice answers auto-save and auto-advance
- Multi-select questions use a **Continue** button
- Added setup progress bar with step count and percent complete
- Tap to Enter is now an elegant overlay that does not take over the title graphic
- Pixel avatar now uses a rounded-square privacy card instead of a circle
- Venue check-in remains hidden until profile setup is complete
- Venue QR check-in still controls entry into the matching pool
- Participating venue list and host venue QR dashboard remain included
- Same-venue and cross-venue matching logic remains included
- Cross-venue meetup requires live-verified photo display before venue choice

## Routes
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard

## Demo host login
- Host PIN: `2468`

## Default venue QR tokens
These are included for testing if you cannot scan the QR:
- `VENUE-URBAN-DENHAM-77`
- `VENUE-PELICAN-MARS-77`
- `VENUE-TOPGOLF-BR-77`

In normal use, the host dashboard displays the actual QR code for each venue.

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank

## Environment variables
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=...`

## MVP note
This build uses `data/db.json`. For production, upgrade to PostgreSQL so venue sessions, check-ins, used avatar names, and match records persist reliably across deploys.
