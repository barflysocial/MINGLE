# One Match AI v14

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v14 changes
- Removed visible **Refresh** button from the player side
- Removed visible **Leave Device Session** button from the player side
- Added **Smoking** and **Drugs** to Dealbreakers
- Simplified final identity reveal:
  - Identity Ready
  - Pixel avatar
  - Avatar name
  - Check In at Venue button
- Removed extra explanation text under Identity Ready
- v13 cleanup retained:
  - no pixel avatar during setup
  - no static identity box during setup
  - no extra helper/subtext except “Choose up to 3”
  - no extra player setup pill boxes

## Current user flow
1. Tap to Enter
2. Step 1: Enter 10-digit mobile number
3. Step 2: Create or enter 4-digit PIN
4. Step 3: Take live picture
5. Step 4: Questions about you
6. Step 5: Questions about who you are looking for
7. Step 6: Identity Ready — pixel avatar + avatar name reveal
8. Venue QR check-in
9. Minimal lobby
   - If host set start time: countdown
   - If no start time: waiting for host

## Routes
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard

## Demo host login
- Host PIN: `2468`

## Default venue QR/manual tokens
Manual token input is not case-sensitive:
- `VENUE-URBAN-DENHAM-77`
- `VENUE-PELICAN-MARS-77`
- `VENUE-TOPGOLF-BR-77`

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank

## Environment variables
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=...`
