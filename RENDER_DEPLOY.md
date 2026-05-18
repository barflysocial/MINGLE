# Render Deploy Notes — One Match AI v18

Upload the contents of this folder to GitHub so `package.json` is at the repo root.

Render:
- Web Service
- Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: blank

Routes:
- `/` or `/play` = Mingle/player experience
- `/host` = Host dashboard
- `/demo` = guest demo
- `/demo-host` = host demo

Environment:
- `HOST_PIN=2468`
- Optional: `WEB_BASE_URL=https://your-domain.com`

NPM dependencies:
- `qrcode` for host QR code generation
- `jsqr` for cross-browser user QR scanning
