# One Match AI v9

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v9 changes
- Minimal lobby after venue check-in
  - Shows only the user’s avatar name
  - Shows the rounded-square pixelated profile picture
  - Shows a countdown until the match round starts
- Countdown uses server time, not the user’s phone clock
- Server can auto-start the One Match round when countdown reaches zero
- Host manual **Start One Match Round** remains as a fallback
- Host can edit the scheduled auto-start time
- Host can enable/disable server auto-start
- Setup flow simplified into clear steps:
  - Step 1: Take Picture
  - Step 2: Answer questions about you
  - Step 3: Answer questions about who you are looking for
  - Step 4: Identity ready / venue check-in
- Progress bar stays at the top of setup
- Picture-taking section simplified
  - No three-box layout
  - No lengthy directions
  - Take Picture → preview pixel avatar → Use This Picture or Retake
- Single-choice answers auto-save and auto-advance
- Multi-answer questions use “Choose up to 3”
  - Selecting 3 auto-saves and advances
  - Selecting 1 or 2 allows the small **Done** link
  - No large Continue button
- Rounded-square pixel avatar retained
- v8 QR scanner fix retained
  - Uses `jsQR`
  - Manual tokens are not case-sensitive
  - Host can customize venue tokens
- Scrollable Terms and Conditions retained

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

## MVP note
This build uses `data/db.json`. For production, upgrade to PostgreSQL so venue sessions, check-ins, used avatar names, countdowns, and match records persist reliably across deploys.
