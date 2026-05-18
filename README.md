# One Match AI v18

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v18 changes
- Added `/demo` public demo page
- Added `/demo-host` host demo page
- Added background auto-refresh:
  - public preview refreshes every 20 seconds
  - player app refreshes after profile/lobby states
  - lobby polls for host manual start even when no start time is set
- Added small preview refresh icon
- Public preview renamed **Match Radius** to **Mingle Options Tonight**
- Host venue cards now separate:
  - **Venue Info**: venue name, venue address, venue logo URL, Save Venue
  - **Event Info**: city, event title, event time, paid/free, payment link, drink specials, seat cap, token, Save Event
- Host label renamed **Round Label** to **Match Round Name**

## Public preview flow
1. Title screen
2. Tap to Enter
3. Public preview:
   - participating venues
   - venue logos
   - addresses
   - free/paid status
   - payment link when paid
   - seat availability
   - drink specials
   - interest hot spots
   - Mingle Options Tonight
4. Tap to Mingle
5. Begin phone + PIN signup/profile setup

## Demo routes
- `/demo` = guest-side demo preview
- `/demo-host` = host dashboard demo preview

## Previous features retained
- Rich link previews
- Host venue logo/address/payment/seat cap/delete event
- Host Interest Hot Spots panel
- QR venue check-in
- Mobile number + 4-digit PIN
- 3 wrong PIN attempts = 10-minute lockout
- No pixel avatar during setup
- Identity reveal only after profile completion
- No lobby timer unless host sets a start time

## Routes
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard
- `/demo` = guest demo
- `/demo-host` = host demo

## Demo host login
- Host PIN: `2468`

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank

## Optional Render environment variables
- `HOST_PIN=2468`
- `WEB_BASE_URL=https://your-domain.com`
- Optional later: `OPENAI_API_KEY=...`
