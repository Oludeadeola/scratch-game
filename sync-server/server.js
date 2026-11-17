/**
 * The room server.
 *
 * This is the piece Vercel cannot host. Live co-editing needs a process that
 * stays up and holds open sockets, and a serverless function by definition
 * does not. So the app deploys to Vercel and this deploys next to it on
 * something that allows long-running processes.
 *
 * It is deliberately tiny. It relays Yjs updates between everyone in a room and
 * keeps the current document in memory; it stores nothing on disk and knows
 * nothing about children, names or lessons. That matters twice over:
 *
 *   Privacy — a server that never persists anything cannot leak anything. No
 *   child's name, age or work is written down here. Names travel between peers
 *   as cursor labels and are gone when the room empties.
 *
 *   Durability — because every client keeps the whole project in IndexedDB,
 *   losing this process loses nothing. A restart, a redeploy or a free-tier
 *   spin-down just means the first client back re-seeds the room from its own
 *   copy. That is why an ephemeral filesystem is fine here.
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from '@y/websocket-server/utils';

const PORT = Number(process.env.PORT) || 1234;
// Hosts route to the container's external interface, not to loopback.
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Rooms a client may open.
 *
 * Empty means any, which is right for a single tutor's own classes. Set
 * ALLOWED_ROOM_PREFIX once other teachers share the server, so one class
 * cannot guess its way into another's project.
 */
const ALLOWED_ROOM_PREFIX = process.env.ALLOWED_ROOM_PREFIX || '';

const server = http.createServer((request, response) => {
  // A health endpoint, so the host knows the service is alive and an uptime
  // pinger has something cheap to hit.
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        service: 'mathblocks-sync',
        rooms: wss.clients.size ? undefined : 0,
        connections: wss.clients.size,
        uptimeSeconds: Math.round(process.uptime()),
      }),
    );
    return;
  }
  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (socket, request) => {
  setupWSConnection(socket, request);
});

server.on('upgrade', (request, socket, head) => {
  const roomName = decodeURIComponent((request.url || '/').slice(1).split('?')[0]);

  if (ALLOWED_ROOM_PREFIX && !roomName.startsWith(ALLOWED_ROOM_PREFIX)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

/**
 * Drop sockets that have stopped answering.
 *
 * A child closing a laptop lid does not send a close frame, so without this the
 * server would hold her connection open and her avatar would sit in the room
 * long after she left.
 */
const HEARTBEAT_MS = 30000;
const alive = new WeakSet();

wss.on('connection', (socket) => {
  alive.add(socket);
  socket.on('pong', () => alive.add(socket));
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) {
      socket.terminate();
      continue;
    }
    alive.delete(socket);
    socket.ping();
  }
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`mathblocks sync server listening on ${HOST}:${PORT}`);
  if (ALLOWED_ROOM_PREFIX) {
    console.log(`only serving rooms starting with "${ALLOWED_ROOM_PREFIX}"`);
  }
});

// Hosts send SIGTERM on redeploy. Closing cleanly lets every client see the
// disconnect at once and start reconnecting, instead of waiting to time out.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing`);
    clearInterval(heartbeat);
    for (const socket of wss.clients) socket.close(1012, 'server restarting');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
