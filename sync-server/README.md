# MathBlocks sync server

The room server for live co-editing. Everything else deploys to Vercel; this
cannot, because it has to hold sockets open for the length of a lesson and a
serverless function cannot.

It relays Yjs updates between everyone in a room, keeps the current document in
memory, and stores nothing. It knows nothing about children, names or lessons.

## Deploying to Render

1. Render dashboard → **New** → **Blueprint**
2. Pick this repo. It reads `render.yaml` at the root and creates one service.
3. When it is live, copy the URL. It will look like
   `https://mathblocks-sync.onrender.com`.
4. On Vercel, set the app's environment variable:

   ```
   NEXT_PUBLIC_SYNC_URL = wss://mathblocks-sync.onrender.com
   ```

   `wss://`, not `ws://` and not `https://`. A browser on an HTTPS page blocks
   a plain `ws://` socket as mixed content.

5. Redeploy the Vercel app so it picks the variable up.

## The free tier, honestly

Since February 2026 a free Render service stays awake while it is receiving
WebSocket messages, so it will not fall asleep during a lesson. It still spins
down after 15 minutes with no traffic at all, and waking takes about a minute.

In practice that means the first lesson after a quiet spell waits about a
minute to connect. Three ways to deal with it, in order of how much they cost:

- Open the class link a minute before the lesson starts.
- Point an uptime pinger at `/health` every 10 minutes.
- Move to a paid instance, which does not sleep. The PRD's budget is under $25
  a month, so this fits.

**Losing this service loses no work.** Every client keeps the whole project in
IndexedDB, so a restart, a redeploy or a spin-down just means the first client
back re-seeds the room from its own copy. That is why the ephemeral filesystem
on the free tier does not matter here.

## Running it locally

```bash
cd sync-server
npm install
npm start           # listens on 1234
```

Or from the app's own directory, `npm run sync`, which runs the same thing.

Check it: `curl http://localhost:1234/health`

## Testing it

From the repo root, against a server you already have running:

```bash
SYNC_URL=ws://127.0.0.1:1234 node scripts/check-sync.cjs
```

That proves an edit travels, that two simultaneous edits both survive in an
agreed order, and that a disconnected client catches up on reconnect.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `1234` | Render sets this itself. |
| `HOST` | `0.0.0.0` | Must not be loopback, or the platform cannot route to it. |
| `ALLOWED_ROOM_PREFIX` | none | Rooms must start with this. Leave unset for a single tutor's own classes; set it once other teachers share the server, so one class cannot guess its way into another's project. |
