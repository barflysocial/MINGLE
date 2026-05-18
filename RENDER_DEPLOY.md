# Render Deploy Notes — One Match AI v7

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

Environment:
- `HOST_PIN=2468`

The app includes `qrcode` as an npm dependency so the host dashboard can display venue QR codes.
