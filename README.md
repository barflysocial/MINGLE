# One Match AI v10

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v10 bug fix
- Fixed the issue where One Match Questions did not start after taking a picture
- Removed the broken `liveChallengeText` dependency from the picture flow
- Added a safe fallback hidden challenge element
- After the user taps **Use This Picture**, the app now moves into Step 2 questions
- Pixel avatar stays hidden until the full profile is complete
- Avatar name still stays hidden until the full profile is complete

## Current setup flow
1. Tap to Enter
2. Confirm 18+ and Terms
3. Step 1: Take Picture
4. Tap **Use This Picture**
5. Step 2: Questions about you
6. Step 3: Questions about who you are looking for
7. Step 4: Avatar + name reveal
8. Venue QR check-in
9. Minimal lobby with countdown
10. Server-time auto-start / host manual fallback

## v9 features retained
- Minimal post-check-in lobby
- Server-time countdown
- Server auto-start when countdown reaches zero
- Host manual Start One Match Round fallback
- Host can edit scheduled auto-start time
- Simplified setup steps
- Single-choice auto-advance
- Multi-answer “Choose up to 3”
- QR scanner fix using `jsQR`
- Custom non-case-sensitive manual venue tokens
- Scrollable Terms and Conditions

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
