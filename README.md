# One Match AI v11

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v11 changes
- Signup now starts with mobile number and PIN:
  - Step 1: Enter 10-digit mobile number
  - Step 2: Create 4-digit PIN or return with existing PIN
  - Step 3: Take live picture
  - Step 4: Questions about you
  - Step 5: Questions about who you are looking for
  - Step 6: Reveal identity
- Returning users can reopen their profile with:
  - 10-digit mobile number
  - 4-digit PIN
- 3 wrong PIN attempts triggers a 10-minute lockout
- Phone number is private
- Host/user screens show only phone verification and last 4 digits where needed
- PIN is stored as a hash, not plain text
- “Your One Match Identity” card is hidden by default and only appears after the full profile is complete
- v10 bug fix retained: questions start after **Use This Picture**
- v9 server-time countdown and auto-start retained
- v8 QR scanner fix retained
- Venue QR/manual token check-in retained

## Current user flow
1. Tap to Enter
2. Step 1: Enter 10-digit mobile number
3. Step 2: Create/enter 4-digit PIN
4. Step 3: Take live picture
5. Step 4: Questions about you
6. Step 5: Questions about who you are looking for
7. Step 6: Pixel avatar + avatar name reveal
8. Venue QR check-in
9. Minimal lobby with server-time countdown
10. Auto-start or host manual start fallback

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
