# Fighter online: Render (backend) + Vercel (frontend)

```
fighter-online/
  backend/    Node WebSocket relay -> deploy on Render
  frontend/   the game (static)    -> deploy on Vercel
  render.yaml optional Render blueprint
```

The game is lockstep: both browsers run the same simulation and only inputs travel.
The backend just makes 4-letter rooms and forwards messages between the two players.

## 1. Push to GitHub
Put this whole `fighter-online` folder in a GitHub repo.

## 2. Backend on Render
1. Render dashboard -> New -> Web Service -> pick your repo.
2. Root Directory: `backend`
3. Build Command: `npm install`   Start Command: `npm start`
4. Instance type: Free is fine. Deploy.
5. Copy the URL, e.g. `https://fighter-relay.onrender.com`. Opening `/healthz` should say `ok rooms=0`.

(Or use New -> Blueprint with `render.yaml`.)

Optional env var: `ALLOWED_ORIGINS=https://your-game.vercel.app` to only accept connections from your site.

## 3. Point the frontend at it
Edit `frontend/config.js`:
```js
window.GAME_SERVER = 'wss://fighter-relay.onrender.com';
```
(`wss://` + your Render host, no trailing slash, no `/ws`.)

## 4. Frontend on Vercel
1. Vercel -> Add New Project -> same repo.
2. Root Directory: `frontend`, Framework Preset: Other, no build command.
3. Deploy. Open the Vercel URL.

## Playing
Player 1 clicks Host a room and shares the code, or the link `https://your-game.vercel.app/?room=ABCD`. Player 2 opens the link or types the code and clicks Join.

## Notes
- Render free instances sleep after ~15 min idle. The first connection can take up to a minute; the page pings `/healthz` on load to wake it. Host first, then share the code.
- Rooms live in memory; a restart clears them.
- Run locally: `cd backend && npm install && npm start`, then set `window.GAME_SERVER = 'ws://localhost:3000'` and open `frontend/index.html` through any static server.
