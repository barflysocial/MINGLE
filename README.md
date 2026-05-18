# One Match AI v8

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v8 changes
- Replaced browser-native QR detection with a cross-browser QR scanner using `jsQR`
- Removed the “browser does not support automatic QR detection” issue
- Venue manual token fallback is still available
- Manual tokens are now case-insensitive
- Host can customize each venue’s QR/manual token
- Added custom token field when creating a venue
- Existing venue QR codes update when the token is changed
- Terms and Conditions modal is scrollable on mobile and desktop

## Key flow
- User taps title graphic
- User confirms 18+ and agrees to Terms
- User completes live photo verification
- App creates a pixelated privacy avatar
- User answers one-question-at-a-time setup
- Avatar name is revealed after setup
- Venue check-in appears
- User scans venue QR code
- User enters waiting room until host starts the match round

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
