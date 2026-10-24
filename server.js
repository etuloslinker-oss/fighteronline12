// Relay server for the lockstep fighting game.
// Both browsers run the same simulation; this server only creates 4-letter rooms
// and forwards the small input / handshake messages between the two players.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
// Optional: comma-separated list of allowed site origins, e.g. "https://my-game.vercel.app"
// Leave empty to allow any origin.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const CORS = { 'Access-Control-Allow-Origin': '*' };
const server = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS });
    return res.end('ok rooms=' + rooms.size);
  }
  res.writeHead(404, CORS);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048, perMessageDeflate: false });
const rooms = new Map(); // code -> { host, guest }

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 / 0)
function newCode() {
  for (let n = 0; n < 200; n++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const RELAY = new Set(['p', 'q', 's', 'c', 'g', 'r', 'i']); // ping, pong, start, choice, go, rematch, input

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  if (room.host === ws) {
    rooms.delete(room.code);
    if (room.guest) {
      send(room.guest, { t: 'closed' });
      room.guest.room = null;
      room.guest.close();
    }
  } else if (room.guest === ws) {
    room.guest = null;
    send(room.host, { t: 'left' });
  }
}

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (ALLOWED.length && origin && !ALLOWED.includes(origin)) return ws.close(1008, 'origin not allowed');

  ws.isAlive = true;
  ws.room = null;
  ws.tokens = 400; ws.tokT = Date.now();
  if (ws._socket) ws._socket.setNoDelay(true); // send small packets immediately (low latency)
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    // simple rate limit: 400 burst, refilled at 300 msgs/sec
    const now = Date.now();
    ws.tokens = Math.min(400, ws.tokens + (now - ws.tokT) * 0.3); ws.tokT = now;
    if (--ws.tokens < 0) return ws.close(1008, 'too many messages');

    const raw = data.toString();
    let m;
    try { m = JSON.parse(raw); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'host') {
      if (ws.room) return;
      const code = newCode();
      if (!code) { send(ws, { t: 'err', msg: 'Server is busy, try again.' }); return; }
      const room = { code, host: ws, guest: null };
      rooms.set(code, room);
      ws.room = room;
      send(ws, { t: 'hosted', c: code });
    } else if (m.t === 'join') {
      if (ws.room) return;
      const code = String(m.c || '').trim().toUpperCase().slice(0, 4);
      const room = rooms.get(code);
      if (!room) return send(ws, { t: 'err', msg: 'Room ' + code + ' was not found.' });
      if (room.guest) return send(ws, { t: 'err', msg: 'Room ' + code + ' is full.' });
      room.guest = ws;
      ws.room = room;
      send(ws, { t: 'joined', c: code });
      send(room.host, { t: 'peer' });
    } else if (RELAY.has(m.t) && ws.room) {
      const room = ws.room;
      const other = room.host === ws ? room.guest : room.host;
      if (other && other.readyState === 1) other.send(raw); // forward unchanged
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

// drop dead connections (also keeps proxies from idling the socket out)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);

server.listen(PORT, () => console.log('relay listening on :' + PORT));
