# Feed backend

The app already has the client wired (`src/services/feedRemote.js`). You just need
a server that implements two endpoints. This is a complete, minimal example.

## What it has to do

```
GET  /feed?limit=50&clientId=<id>
     → 200  [{ id, ts, name, emoji, title, subtitle? }]
     Return recent milestones from OTHER people (exclude the given clientId).

POST /feed
     body: { clientId, ts, emoji, title, subtitle? }
     → store the milestone so others see it. The server assigns a display name
       to each clientId (the app is anonymous — it only sends an id).
```

The app sends an anonymous, persistent `clientId` per device. The server maps
each `clientId` to a friendly display name so real names show up in the feed.

---

## Minimal server (Node + Express + SQLite)

Persists to a file, works locally right away.

```
mkdir feed-backend && cd feed-backend
npm init -y
npm install express better-sqlite3 cors
```

`server.js`:

```js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const db = new Database('feed.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (clientId TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT, ts INTEGER, emoji TEXT, title TEXT, subtitle TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts DESC);
`);

const ADJ = ['Rápido', 'Forte', 'Ágil', 'Feroz', 'Calmo', 'Bravo'];
const NOUN = ['Lobo', 'Tigre', 'Falcão', 'Urso', 'Puma', 'Águia'];
function nameFor(clientId) {
  let row = db.prepare('SELECT name FROM clients WHERE clientId = ?').get(clientId);
  if (row) return row.name;
  const n = `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
  db.prepare('INSERT INTO clients (clientId, name) VALUES (?, ?)').run(clientId, n);
  return n;
}

const app = express();
app.use(cors());
app.use(express.json());

// naive rate limit: max 20 posts / minute per client
const hits = new Map();
function rateLimited(clientId) {
  const now = Date.now();
  const arr = (hits.get(clientId) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(clientId, arr);
  return arr.length > 20;
}

app.get('/feed', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const clientId = String(req.query.clientId || '');
  const rows = db
    .prepare('SELECT * FROM events WHERE clientId != ? ORDER BY ts DESC LIMIT ?')
    .all(clientId, limit);
  res.json(
    rows.map((e) => ({
      id: String(e.id),
      ts: e.ts,
      name: nameFor(e.clientId),
      emoji: e.emoji,
      title: e.title,
      subtitle: e.subtitle || undefined,
    }))
  );
});

app.post('/feed', (req, res) => {
  const { clientId, ts, emoji, title, subtitle } = req.body || {};
  if (!clientId || !title) return res.status(400).json({ error: 'clientId e title obrigatórios' });
  if (rateLimited(clientId)) return res.status(429).json({ error: 'slow down' });

  // validação / sanitização (o title vem do utilizador -> é mostrado a outros)
  const clean = (s, max) => String(s || '').replace(/[<>]/g, '').slice(0, max);
  nameFor(clientId); // garante que o cliente tem nome
  db.prepare('INSERT INTO events (clientId, ts, emoji, title, subtitle) VALUES (?, ?, ?, ?, ?)').run(
    String(clientId).slice(0, 64),
    Number(ts) || Date.now(),
    clean(emoji, 8),
    clean(title, 120),
    clean(subtitle, 120) || null
  );
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log('feed backend up'));
```

Run it: `node server.js`. Test:

```
curl -X POST localhost:3000/feed -H 'content-type: application/json' \
  -d '{"clientId":"c_test","ts":0,"emoji":"💪","title":"completou o Dia 3"}'
curl 'localhost:3000/feed?limit=50&clientId=c_me'
```

Then in the app's `.env`: `EXPO_PUBLIC_FEED_API_URL=http://<your-ip>:3000` (for a
phone on the same wifi use your machine's LAN IP, not `localhost`).

---

## Deploying it (so it works from the store)

The server above needs to stay running. Options, cheapest first:

- **Render / Railway / Fly.io** — push the repo, they run `node server.js`. Free
  tiers exist. Note: on free tiers the local `feed.db` file may reset on redeploy
  (ephemeral disk). For durable storage use a hosted DB instead of the SQLite file:
- **Turso (libSQL)** or **Neon (Postgres)** — free hosted DB. Swap `better-sqlite3`
  for their client; the two queries stay basically the same.
- **Supabase** — Postgres + auto REST. You can skip Express entirely and point the
  app at a Supabase Edge Function, but the custom `{name, emoji, title}` shape means
  a small function anyway, so the Express route above is usually simpler.

Once deployed, set `EXPO_PUBLIC_FEED_API_URL=https://your-app.onrender.com` in your
EAS build env and the feed goes live — no app code changes.

---

## Before real users

- **clientId is spoofable** (anyone can send any id). Fine for a social feed; if you
  later gate rewards on it, add real auth (e.g. Expo Auth / a JWT).
- **User-generated `title` is shown to others** — keep the length caps + `<>` strip
  above, and consider a profanity filter and/or a moderation/report flow.
- **Privacy** — decide what you publish. Right now every milestone is public. You may
  want a per-user "share to feed" toggle in the app before shipping.
