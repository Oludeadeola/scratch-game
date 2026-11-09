# MathBlocks Live

A Scratch-style block editor built for live one-to-one tutoring. A teacher and a
young student open the same project from different countries, drag blocks into
the same script, and the app marks the maths by itself.

This repo is **Phase 1** of the PRD: the block editor, the stage, live
co-editing, auto-save, the number pad and read aloud. Class codes, parent
consent and the teacher's class list are Phase 2.

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, put in a name and a class code, pick a week, and
press Start.

### Seeing two people at once

Live sync needs a room server. In a second terminal:

```bash
npm run sync
```

Then open the same class code and week in two browser windows (use one normal
and one private window, so they get separate identities). Drag a block in one
and it appears in the other.

Without the sync server the editor still works: it saves to IndexedDB on the
device and picks the room up when a server is reachable. That is the same path
a student takes when her internet drops mid-lesson.

To point at a hosted room server instead, set:

```
NEXT_PUBLIC_SYNC_URL=wss://your-sync-host
```

## How it is put together

| Layer | Choice |
| --- | --- |
| App and hosting | Next.js App Router, deploys to Vercel |
| Block editor | Google Blockly, Zelos renderer, custom theme |
| Shared project | Yjs document per project |
| Offline and auto-save | IndexedDB, via `y-indexeddb` |
| Live sync | WebSocket provider, via `y-websocket` |

### How a change travels

A child drags a block. Blockly describes that edit as a small, replayable event
addressed by block id. We append the event's JSON to a `Y.Array`. Yjs picks one
order for everyone's appends, each client replays that order into its own
workspace, and both people keep their edit when they drag at the same moment.

Using Blockly's own event format means we never diff two workspaces. Two details
make it hold up:

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
miss shows which rule is still open rather than just failing.

## Layout

```
app/
  page.tsx            join screen
  p/[room]/page.tsx   the lesson, one URL per project
components/
  Editor.tsx          shell: toolbar, presence, shared run
  BlocklyPane.tsx     the workspace, bound to the room
  Stage.tsx           robot, number line, pen trail, score
  ChallengeCard.tsx   prompt, predict-first, auto-marking
  NumberPad.tsx       big touch keypad for every number field
  Presence.tsx        cursors and avatars
lib/
  program.ts          the executable shape of a script
  runtime.ts          the interpreter, one frame per block
  challenges.ts       the twelve weeks and their rules
  blocks.ts           Blockly definitions, palette, theme
  sync.ts             Blockly <-> Yjs binding
  yroom.ts            the shared room
  speech.ts           read aloud
```

## Not built yet

Phase 2 and 3 from the PRD: class codes with picture passwords, parent consent,
the teacher's class list, Bring everyone here, Supabase persistence, AI hints,
the 3rd grade pack.

The event log is also not compacted yet. A long-running project replays its
whole history on join, which is fine for a lesson and will need a periodic
snapshot before real classes run on it.
