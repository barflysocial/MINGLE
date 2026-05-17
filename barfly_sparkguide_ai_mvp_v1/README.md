# Barfly Social SparkGuide AI MVP

This is a first working MVP for a gamified dating app experience.

The app turns dating into a live social game:

- Players join with an RSVP code
- Players use private avatar names
- Players confirm 18+
- SparkGuide AI helps build a dating profile
- Host check-in code is required before matching
- The host controls event status and live rounds
- Rule-based AI suggests compatible players and icebreakers
- Players privately choose Strong Spark / Maybe / Friend Vibe / No Connection
- Chat unlocks only when interest is mutual
- Basic safety filtering blocks aggressive, explicit, invasive, or threatening messages
- Players can report/block
- Host dashboard shows players, reports, feedback count, and unlocked connection count

## Demo codes

- Host PIN: `2468`
- RSVP code: `SPARK`
- Player check-in code: `HOST77`

## Local setup

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## How to test mutual chat unlock

1. Open the app in one browser and join as Player 1.
2. Complete the AI Profile.
3. Check in using `HOST77`.
4. Open a private/incognito browser or a second device.
5. Join as Player 2.
6. Complete the AI Profile.
7. Check in using `HOST77`.
8. Have both players go to **Matches**.
9. Player 1 selects `Strong Spark`, `Maybe`, or `Friend Vibe` for Player 2.
10. Player 2 selects `Strong Spark`, `Maybe`, or `Friend Vibe` for Player 1.
11. The app unlocks a private chat.

## Render deployment

1. Create a new Web Service on Render.
2. Connect the GitHub repo that contains this folder.
3. Set build command to blank or:

```bash
npm install
```

4. Set start command to:

```bash
npm start
```

5. Add environment variable if you want to change the host PIN:

```text
HOST_PIN=your-private-host-pin
```

6. Deploy.

## Current architecture

This MVP is intentionally dependency-free. It uses:

- Node built-in `http` server
- Static HTML/CSS/JS frontend
- JSON file storage at `data/db.json`

This makes it easy to deploy and understand. For production, replace the JSON database with PostgreSQL.

## Important production upgrades

Before using this with the public, upgrade these areas:

1. User authentication and verified phone/email login
2. PostgreSQL database
3. Stronger moderation and abuse detection
4. Real consent controls for photo/contact sharing
5. Host-level player removal/suspension tools
6. Better audit logs for reports and safety incidents
7. Real AI integration with a protected server-side API key
8. Terms, privacy policy, and age-gate language reviewed by an attorney
9. Event-level capacity limits
10. Separate production and test environments

## Files

```text
server.js             API server and JSON database logic
public/index.html     Main HTML shell
public/styles.css     Mobile-friendly neon Barfly styling
public/app.js         Player and host frontend app
data/db.json          Demo database seed
package.json          Node start script
```

## Matching logic

The MVP matching system scores players by:

- Shared core values
- Shared interests
- Same dating goal
- Same dating pace
- Similar social energy
- Possible dealbreaker conflicts

It then generates a reason and icebreaker prompt.

This is a rule-based SparkGuide MVP. It is built to be replaced or enhanced with a true LLM matchmaking layer later.
