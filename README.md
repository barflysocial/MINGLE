# One Match AI v15

Render-ready Node app for the One Match AI Mingle dating-event concept.

## v15 changes
- Added rich link preview support
- Added Open Graph meta tags
- Added Twitter/X large-card meta tags
- Added a 1200x630 preview image: `/one-match-ai-preview.png`
- Server now injects absolute preview URLs for Render/custom domains
- Optional `WEB_BASE_URL` environment variable supported for clean canonical link previews

## Rich link preview details
The app now supports previews for text messages and social sharing when the app URL is pasted.

Preview title:
- One Match AI Mingle

Preview description:
- Live verified. Pixel private. One strongest match at participating venues.

Preview image:
- `/one-match-ai-preview.png`

## Optional Render environment variable
Set this only if you want to force the preview URL to your custom domain:

`WEB_BASE_URL=https://your-domain.com`

If not set, the server uses the request host from Render.

## Previous features retained
- Mobile number + 4-digit PIN
- 3 wrong PIN attempts = 10-minute lockout
- QR venue check-in
- No visible player Refresh / Leave Device Session buttons
- Smoking and Drugs added to Dealbreakers
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
