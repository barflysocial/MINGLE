# Render Deployment Settings

Use **New Web Service** in Render, not Static Site.

## Required Render Fields

- Runtime: Node
- Branch: main
- Root Directory: leave blank if these files are at the top of your GitHub repo
- Build Command: `npm install`
- Start Command: `npm start`
- Auto Deploy: Yes

## Environment Variables

Add:

- `HOST_PIN=2468`

You can change the host pin later in Render without editing GitHub.

## GitHub Repo Root Must Look Like This

```text
package.json
server.js
render.yaml
public/
data/
README.md
RENDER_DEPLOY.md
.gitignore
```

If Render says it cannot find `package.json`, your files are not at the repo root or your Render Root Directory is wrong.
