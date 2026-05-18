# One Match AI v12

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v12 changes
- Removed the automatic default 10-minute lobby countdown
- Lobby only shows a countdown if the host sets a start time
- If no host start time is set, lobby shows: “Waiting for the host to start the match round.”
- Auto-start only works when:
  - Auto-start is enabled
  - A host-set start time exists
  - Countdown reaches zero
- Manual **Start One Match Round** remains the fallback
- Pixel avatar stays hidden during setup
- “Your One Match Identity” / identity reveal stays hidden until the full profile is complete
- Removed the extra “Answer the profile questions first...” setup message
- Identity reveal is renamed **Identity Ready**
- v11 mobile number + 4-digit PIN flow retained
- 3 wrong PIN attempts = 10-minute lockout
- v10 picture/questions fix retained
- v8 QR scanner and customizable non-case-sensitive venue tokens retained

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

## MVP note
This version does not send real SMS yet. It uses mobile number + PIN for return access. For production, connect Twilio Verify or another SMS provider for first-time phone verification and forgot-PIN reset.
