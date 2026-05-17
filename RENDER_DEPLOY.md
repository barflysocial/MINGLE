# Render Deploy Notes

## GitHub repo layout
Make sure these files are at the top level of the repo:
- `package.json`
- `server.js`
- `render.yaml`
- `public/`
- `data/`

Do **not** upload only the ZIP file.

## Render settings
- **Type:** Web Service
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Root Directory:** leave blank if `package.json` is at the repo root

## Environment Variables
- `HOST_PIN=2468`
- Optional later: `OPENAI_API_KEY=your_key_here`

## Camera note
This build uses `getUserMedia`, so the site should be served over HTTPS in production. Render provides HTTPS automatically.
