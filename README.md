# MathBlocks Live

A block-coding editor built for live one-to-one maths tutoring. A teacher and a
young student open the same project from different countries, drag blocks into
the same script, and the app marks the maths by itself.

**What it does that Scratch and ScratchJr cannot.** Scratch's editor is
single-user, and ScratchJr is a separate app for younger children. Here a
6-year-old sees picture blocks, her teacher sees worded blocks, and they are
editing *the same script at the same time*. Age changes how a block reads, never
what it is.

```
Junior  (ages 4-7)    🏁  ➡️ 5   🔁 4   🏆 ➕ 5
Builder (ages 8+)     when Run is clicked → move 5 steps → repeat 4 times
```

## Running it

```bash
npm install
npm run dev          # the app on http://localhost:3000
npm run sync         # the room server, in a second terminal
```

Open the app, give a name and an age, pick a week, press Start.

### Seeing two people at once

With `npm run sync` running, open the same class code and week in two windows —
one normal and one private, so they are two different people. Drag a block in
one and it appears in the other, with that person's cursor on the block they are
pointing at.

Try it with two different ages. A 6-year-old's window shows `➡️ 5`; the other
shows `move 5 steps`. Same script.

Without the sync server the editor still works: it saves to IndexedDB and picks
the room up when a server is reachable. That is the same path a student takes
when her internet drops mid-lesson.

To point at a hosted room server, set `NEXT_PUBLIC_SYNC_URL=wss://your-host`.

### Installing it on a phone or iPad

It is a web app, and it is installable. Nothing comes from an app store.

- **Android / Chrome / Edge** — an "Add to home screen" button appears on the
  join screen.
- **iPad / iPhone** — Safari gives no install API, so the same button shows the
  two taps: **Share** → **Add to Home Screen**.

Once added it opens full screen with no browser chrome, and a service worker
caches the shell so it still opens with no signal. Installability needs HTTPS,
so it works on `localhost` and on a deployed site, but not over plain HTTP on a
LAN address.

## Checking it

```bash
npm run verify:all
```

- `verify` builds a real script for each of the twelve weeks and asserts the
  challenge checker marks it correctly, plus near-misses that must *fail* and a
  runaway-loop guard. A child told she got it wrong when she got it right is the
  worst bug this app can have.
- `verify:sync` starts a real room server and two clients, then proves an edit
  travels, that two simultaneous edits both survive in an agreed order, and that
  a disconnected client catches up on reconnect.

## How it is put together

| Layer | Choice |
| --- | --- |
| App and hosting | Next.js App Router, deploys to Vercel |
| Block editor | Google Blockly, Zelos renderer, two themes |
| Shared project | Yjs document per project |
| Offline and auto-save | IndexedDB, via `y-indexeddb` |
| Live sync | WebSocket provider, via `y-websocket` |
| Installable | Web app manifest and a service worker |

### How a change travels

A child drags a block. Blockly describes that edit as a small, replayable event
addressed by block id. We append the event's JSON to a `Y.Array`. Yjs picks one
order for everyone's appends, each client replays that order into its own
workspace, and both people keep their edit when they drag at the same moment.

Using Blockly's own event format means we never diff two workspaces, and it is
what lets the two age modes share one document: events carry block types and
field values, never labels.

Two details make it hold up:

- The `when Run is clicked` hat block is created locally on every client with a
  fixed id and is never logged, so nobody ends up with two of them.
- Remote events are applied with Blockly's event system switched off. Blockly
  flushes its event queue on a timer, so a plain "am I applying?" flag races and
  echoes.

### How a shared Run works

Pressing Run bumps a counter in the room's shared metadata. Every client
watching that counter starts playing at the same moment. The interpreter is
deterministic and does no I/O, so both screens land on the same pixels without
streaming a single frame between them.

### How a challenge is marked

Each of the twelve weeks stores its rules as predicates over the program the
student built and the state the robot ended in — "you used a repeat block", "the
score is 50", "you drew a square: 4 equal sides, back where it started". A near
miss shows which rule is still open rather than just failing. The star is
awarded once, not once per press of Run.

## Privacy

The students are under 13 and in the US, so COPPA shapes the design from the
start.

- A child's name and age live in her own browser. They are never in the URL,
  never in the shared document, and never sent to a server. A class link can be
  pasted to a whole class without carrying anybody's name.
- Age is asked in years, never as a date of birth, and is used only to pick
  which editor she sees.
- Read aloud uses the browser's own speech synthesis. No audio leaves the
  device.
- The progress page reads only this device's own storage.

Still outstanding before real classes: parent consent, teacher-created accounts
with picture passwords, and a legal review.

## Layout

```
app/
  page.tsx            join: name, age, class code, week
  p/[room]/page.tsx   the lesson, one URL per project
  progress/page.tsx   the twelve-week map, written for a parent
  manifest.ts         web app manifest
components/
  Editor.tsx          room lifetime, toolbar, presence, shared run
  BlocklyPane.tsx     the workspace, tap-to-add, live cursors
  Stage.tsx           robot, number line, pen trail, score
  ChallengeCard.tsx   prompt, predict-first, auto-marking
  NumberPad.tsx       big touch keypad for every number field
  InstallApp.tsx      add to home screen, including the iOS path
lib/
  ages.ts             age -> Junior or Builder, and what each changes
  identity.ts         who is on this device; local only
  program.ts          the executable shape of a script
  runtime.ts          the interpreter, one frame per block
  challenges.ts       the twelve weeks, their rules and home activities
  blocks.ts           block definitions in two wordings
  sync.ts             Blockly <-> Yjs binding
  yroom.ts            the shared room
public/
  sw.js               service worker: installable, opens offline
```

## Not built yet

Parent consent and teacher-created student accounts, the teacher's class list,
Bring everyone here, Supabase persistence, AI hints, the 3rd grade pack.

The event log is also not compacted. A project replays its whole history on
join, which is fine for a week's work and will need a periodic snapshot before a
project runs for a term.
