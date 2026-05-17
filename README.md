# One Match AI v5

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v5 changes
- Title screen shows only the realistic Mingle graphic
- Bottom title-screen callout: TAP TO ENTER
- Tap opens the Join Mingle RSVP screen
- Join Mingle includes RSVP code, 18+ checkbox, Terms checkbox, Terms hyperlink, and ENTER button
- Removed visible “User Mode” wording from the player-facing app
- Avatar name is not revealed at RSVP
- Avatar name is assigned and revealed only after live photo verification and all preference questions are complete
- Multiple-choice answers stay in fixed logical order; no random shuffling
- Profile/setup questions come first
- “I am looking for…” comes after profile/preferences
- Venue check-in is emphasized before anyone enters the matching pool
- Host mode remains separate at `/host`

## Routes
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard

## Demo codes
- Host PIN: `2468`
- RSVP Code: `ONEMATCH`
- Check-in Code: `HOST77`

## Render settings
- Service Type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank

## MVP notes
The current build uses `data/db.json`. For production, upgrade to PostgreSQL so the no-repeat avatar name registry persists across deploys and resets.
