# One Match AI v17

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v17 changes
- Added public pre-signup preview page after Tap to Enter
- Users can see participating venues before signup
- Users can see public interest hot spots before signup
- Added bottom **TAP TO MINGLE** button to begin profile setup
- Added drink specials to venue/event settings
- Drink specials show on:
  - public pre-signup venue cards
  - user venue/check-in cards
  - host venue cards
- Host can add/edit drink specials per venue/event

## Public preview flow
1. Title screen
2. Tap to Enter
3. Public preview:
   - Participating venues
   - Venue logos
   - Addresses
   - Free/Paid status
   - Payment link when paid
   - Seat availability
   - Drink specials
   - Interest hot spots
4. Tap to Mingle
5. Begin mobile number + PIN signup/profile setup

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
