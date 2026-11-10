/*
 * Proves the sync model end to end, against a real y-websocket server.
 *
 * This is the claim Phase 1 exists to support, so it should not rest on
 * "it looked fine in two browser windows". Three things are checked:
 *
 *   1. An edit made by one client reaches another.
 *   2. Two clients editing at the same moment keep BOTH edits, and agree on
 *      the order — which is what stops a teacher's block from deleting a
 *      child's block when they drag together.
 *   3. A client that was offline while edits happened catches up on reconnect.
 *
 * Run with:  npm run verify:sync
 */

const { spawn } = require('child_process');
const path = require('path');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const WebSocket = require('ws');

const PORT = 1239;
const URL = `ws://localhost:${PORT}`;
const ROOM = 'verify-' + Date.now();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(name) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(URL, ROOM, doc, {
    WebSocketPolyfill: WebSocket,
    connect: true,
  });
  return { name, doc, provider, events: doc.getArray('events') };
}

function whenSynced(client, timeoutMs = 8000) {
  if (client.provider.synced) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${client.name} never synced`)),
      timeoutMs,
    );
    client.provider.once('sync', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Waits until `check` holds, or gives up. Avoids arbitrary long sleeps. */
async function until(check, label, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return Date.now() - started;
    await wait(25);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

let failures = 0;
function assert(ok, label, detail) {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    if (detail) console.log(`        ${detail}`);
  }
}

async function main() {
  console.log(`starting sync server on ${PORT}…`);
  const serverBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'y-websocket.cmd' : 'y-websocket',
  );
  const server = spawn(serverBin, [], {
    env: { ...process.env, PORT: String(PORT), HOST: 'localhost' },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });

  // Give the server a moment to bind before the first client dials in.
  await wait(1800);

  const teacher = connect('teacher');
  const student = connect('student');

  try {
    await Promise.all([whenSynced(teacher), whenSynced(student)]);
    console.log('both clients connected\n');

    /* 1. One edit travels. ------------------------------------------- */
    teacher.events.push(['{"type":"create","blockId":"a"}']);
    const latency = await until(
      () => student.events.length === 1,
      'student receives the teacher edit',
    );
    assert(
      student.events.get(0) === '{"type":"create","blockId":"a"}',
      `an edit reaches the other screen (${latency}ms)`,
    );

    /* 2. Simultaneous edits both survive. ---------------------------- */
    // Pushed in the same tick from both sides, with no coordination: this is
    // the "two people drag at once" case from the PRD's risk table.
    teacher.events.push(['{"type":"create","blockId":"t1"}']);
    student.events.push(['{"type":"create","blockId":"s1"}']);

    await until(
      () => teacher.events.length === 3 && student.events.length === 3,
      'both clients see three events',
    );

    const teacherView = teacher.events.toArray();
    const studentView = student.events.toArray();

    assert(
      teacherView.length === 3 && studentView.length === 3,
      'concurrent edits are both kept, neither is lost',
      `teacher saw ${teacherView.length}, student saw ${studentView.length}`,
    );
    assert(
      JSON.stringify(teacherView) === JSON.stringify(studentView),
      'both clients agree on the order of those edits',
      `teacher: ${JSON.stringify(teacherView)}\n        student: ${JSON.stringify(studentView)}`,
    );

    /* 3. Offline edits catch up. ------------------------------------- */
    student.provider.disconnect();
    await wait(300);
    teacher.events.push(['{"type":"create","blockId":"while-away"}']);
    await wait(400);
    assert(
      student.events.length === 3,
      'an offline client does not see edits made while it was away',
    );

    student.provider.connect();
    const catchUp = await until(
      () => student.events.length === 4,
      'student catches up after reconnect',
    );
    assert(
      student.events.get(3) === '{"type":"create","blockId":"while-away"}',
      `a reconnecting client catches up (${catchUp}ms)`,
    );

    /* Convergence of the whole document. ----------------------------- */
    assert(
      Y.encodeStateVector(teacher.doc).toString() ===
        Y.encodeStateVector(student.doc).toString(),
      'both documents converge to identical state',
    );
  } finally {
    teacher.provider.destroy();
    student.provider.destroy();
    teacher.doc.destroy();
    student.doc.destroy();
    server.kill();
  }

  console.log(`\n${failures ? `${failures} failed` : 'all sync checks passed'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error('\nsync check could not run:', error.message);
  process.exit(1);
});
