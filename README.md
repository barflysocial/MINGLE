# One Match AI v16

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v16 changes
Host dashboard upgrades:
- Add venue logo URL
- Add/edit venue address and city
- Mark event as Free or Paid
- Add payment link
- Set seat cap
- Show checked-in count and seats remaining per venue
- Prevent venue check-in when the seat cap is full
- Delete event/venue with DELETE confirmation
- Host Interest Hot Spots panel:
  - Looking For
  - Match Radius
  - Age Groups
  - Top Values

User-facing retained:
- Venue list can display logo, paid/free status, payment link, address, and event time
- QR venue check-in still required
- No visible player Refresh / Leave Device Session buttons
- No pixel avatar during setup
- Identity reveal only after profile completion
- No lobby timer unless host sets a start time

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

## Optional Render environment variable
- `WEB_BASE_URL=https://your-domain.com`
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=...`
