'use client';

/**
 * The lesson screen: palette and script on the left, stage and challenge on
 * the right, one toolbar across the top.
 *
 * Shared Run works by bumping a counter in the room's metadata. Every client
 * watching that counter starts playing the same program at the same moment.
 * Because the interpreter is deterministic, that is enough to keep two screens
 * identical without streaming a single frame between them.
 *
 * The component is split in two on purpose. `Editor` owns the room's lifetime
 * and nothing else; `Lesson` owns the lesson and can assume the room exists.
 * Creating the room in a `useMemo` and destroying it in an effect looks tidier
 * but is wrong: React may run an effect's cleanup and then re-run the effect on
 * the same memoised value, leaving the lesson holding a destroyed document.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Blockly from 'blockly/core';
import {
  type Challenge,
  type CheckResult,
  challengeForWeek,
  checkChallenge,
} from '@/lib/challenges';
import { EMPTY_PROGRAM, type Program } from '@/lib/program';
import { type Frame, type RobotState, collectFrames, freshState } from '@/lib/runtime';
import { type Mode, modeLabel } from '@/lib/ages';
import { speak, speakProgram, stopSpeaking } from '@/lib/speech';
import {
  type Participant,
  type Role,
  type Room,
  type RoomMeta,
  awardStar,
  colourForClientId,
  completeChallenge,
  openRoom,
  readMeta,
  starsThisWeek,
  triggerSharedRun,
  writeMeta,
} from '@/lib/yroom';
import { clearScript } from '@/lib/sync';
import BlocklyPane from './BlocklyPane';
import Stage from './Stage';
import ChallengeCard from './ChallengeCard';
import { Avatars, type PresenceEntry } from './Presence';

/** Milliseconds between frames. Slow mode is the PRD's step-by-step run. */
const FRAME_MS = { normal: 160, slow: 750 } as const;

export interface EditorProps {
  roomId: string;
  name: string;
  role: Role;
  mode: Mode;
  week: number;
}

export default function Editor(props: EditorProps) {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    const opened = openRoom(props.roomId);
    setRoom(opened);
    return () => {
      opened.destroy();
      setRoom(null);
    };
  }, [props.roomId]);

  if (!room) {
    return (
      <div className="boot">
        <p className="boot-text">Opening your project…</p>
      </div>
    );
  }

  // Keying on the room guarantees the lesson's own state resets with it.
  return <Lesson key={props.roomId} room={room} {...props} />;
}

function Lesson({
  room,
  name,
  role,
  mode,
  week,
}: EditorProps & { room: Room }) {
  const [meta, setMeta] = useState<RoomMeta>(() => ({
    locked: false,
    runToken: 0,
    runSpeed: 'normal',
    week,
  }));
  const [program, setProgram] = useState<Program>(EMPTY_PROGRAM);
  const [robot, setRobot] = useState<RobotState>(() => freshState());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [prediction, setPrediction] = useState('');
  /** The guess as it stood when Run was pressed. Locked so it cannot be edited after. */
  const [lockedPrediction, setLockedPrediction] = useState<string | null>(null);
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const [stars, setStars] = useState(0);
  const [online, setOnline] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [copied, setCopied] = useState(false);

  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const programRef = useRef<Program>(EMPTY_PROGRAM);
  programRef.current = program;
  const predictionRef = useRef('');
  predictionRef.current = prediction;
  /** Bumped to cancel an in-flight run. */
  const runSeqRef = useRef(0);
  /** The run token already played, so opening a saved project does not auto-run. */
  const playedTokenRef = useRef<number | null>(null);

  const locked = meta.locked && role === 'student';
  const challenge: Challenge = challengeForWeek(meta.week);

  /* ---------------------------------------------------------------- */
  /* Presence                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const { awareness } = room;
    const self: Participant = {
      name,
      colour: colourForClientId(awareness.clientID),
      role,
      cursor: null,
      handRaised: false,
      draggingBlockId: null,
    };
    awareness.setLocalState(self as unknown as Record<string, unknown>);

    const sync = () => {
      const entries: PresenceEntry[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const person = state as unknown as Participant;
        if (!person?.name) return;
        entries.push({ ...person, clientId, isSelf: clientId === awareness.clientID });
      });
      entries.sort((a, b) => (a.role === b.role ? 0 : a.role === 'teacher' ? -1 : 1));
      setPeople(entries);
    };

    awareness.on('change', sync);
    sync();
    return () => {
      awareness.off('change', sync);
      awareness.setLocalState(null);
    };
  }, [room, name, role]);

  useEffect(() => {
    const provider = room.websocket;
    if (!provider) return;
    const onStatus = (event: { status: string }) =>
      setOnline(event.status === 'connected');
    provider.on('status', onStatus);
    return () => provider.off('status', onStatus);
  }, [room]);

  const reportCursor = useCallback(
    (point: { x: number; y: number } | null) => {
      room.awareness.setLocalStateField('cursor', point);
    },
    [room],
  );

  const reportDrag = useCallback(
    (blockId: string | null) => {
      room.awareness.setLocalStateField('draggingBlockId', blockId);
    },
    [room],
  );

  /* ---------------------------------------------------------------- */
  /* Room meta and stars                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const apply = () => setMeta(readMeta(room.meta));
    room.meta.observe(apply);
    room.whenLoaded.then(() => {
      if (room.meta.get('week') === undefined) writeMeta(room.meta, { week });
      apply();
    });
    return () => room.meta.unobserve(apply);
  }, [room, week]);

  useEffect(() => {
    const apply = () => setStars(starsThisWeek(room.stars, name, meta.week));
    room.stars.observe(apply);
    apply();
    return () => room.stars.unobserve(apply);
  }, [room, name, meta.week]);

  /* ---------------------------------------------------------------- */
  /* Running                                                           */
  /* ---------------------------------------------------------------- */

  const highlight = useCallback((blockId: string | null) => {
    workspaceRef.current?.highlightBlock(blockId);
  }, []);

  const play = useCallback(
    async (speed: RoomMeta['runSpeed']) => {
      const seq = (runSeqRef.current += 1);
      const frames: Frame[] = collectFrames(programRef.current);

      // Freeze the guess at the moment Run is pressed, so the answer cannot be
      // back-filled once the robot has shown it.
      setLockedPrediction(predictionRef.current);
      setRunning(true);
      setResult(null);
      setRobot(freshState());
      stopSpeaking();

      const gap = FRAME_MS[speed];
      for (const frame of frames) {
        if (runSeqRef.current !== seq) {
          highlight(null);
          return;
        }
        highlight(frame.blockId);
        setRobot(frame.state);
        await wait(gap + frame.pauseMs);
      }

      if (runSeqRef.current !== seq) return;
      highlight(null);
      setRunning(false);

      const marked = checkChallenge(challenge, programRef.current);
      setResult(marked);
      if (marked.passed) {
        const firstTime = completeChallenge(
          room.completions,
          room.stars,
          name,
          meta.week,
        );
        if (firstTime) speak('Challenge complete! You earned a star.');
      }
    },
    [challenge, highlight, meta.week, name, room.completions, room.stars],
  );

  // Shared run: everyone watching this project reacts to the same token.
  useEffect(() => {
    if (playedTokenRef.current === null) {
      playedTokenRef.current = meta.runToken;
      return;
    }
    if (meta.runToken === playedTokenRef.current) return;
    playedTokenRef.current = meta.runToken;
    void play(meta.runSpeed);
  }, [meta.runToken, meta.runSpeed, play]);

  function stop() {
    runSeqRef.current += 1;
    highlight(null);
    setRunning(false);
    stopSpeaking();
  }

  function resetStage() {
    stop();
    setRobot(freshState());
    setResult(null);
    setLockedPrediction(null);
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    room.awareness.setLocalStateField('handRaised', next);
  }

  async function copyClassLink() {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked, usually on an insecure origin. Select it instead so
      // the teacher can copy it by hand rather than hunt for the URL bar.
      window.prompt('Copy this class link', link);
    }
  }

  const empty = program.nodes.length === 0;

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">MathBlocks&nbsp;Live</span>
          <span className={`conn ${online ? 'is-online' : ''}`}>
            {online ? 'Live' : 'Offline — saving on this device'}
            <span className="conn-mode"> · {modeLabel(mode)}</span>
          </span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-run"
            onClick={() => triggerSharedRun(room.meta, 'normal')}
            disabled={empty}
          >
            ▶ Run
          </button>
          <button
            type="button"
            className="btn btn-slow"
            onClick={() => triggerSharedRun(room.meta, 'slow')}
            disabled={empty}
          >
            🐢 Slow
          </button>
          <button type="button" className="btn btn-ghost" onClick={stop} disabled={!running}>
            ■ Stop
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetStage}>
            ↺ Reset
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => speakProgram(programRef.current)}
            title="Read my blocks out loud"
          >
            🔊 My blocks
          </button>

          {role === 'student' && (
            <button
              type="button"
              className={`btn ${handRaised ? 'btn-hand-up' : 'btn-ghost'}`}
              onClick={toggleHand}
            >
              ✋ {handRaised ? 'Hand up' : 'Raise hand'}
            </button>
          )}

          {role === 'teacher' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={copyClassLink}>
                🔗 {copied ? 'Link copied' : 'Class link'}
              </button>
              <button
                type="button"
                className={`btn ${meta.locked ? 'btn-locked' : 'btn-ghost'}`}
                onClick={() => writeMeta(room.meta, { locked: !meta.locked })}
              >
                {meta.locked ? '🔒 Unlock screens' : '🔓 Lock screens'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => awardStar(room.stars, name, meta.week)}
                title="Send this student an extra star"
              >
                ⭐ Send star
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (workspaceRef.current) clearScript(workspaceRef.current);
                }}
              >
                Clear script
              </button>
            </>
          )}
        </div>

        <Avatars people={people} />
      </header>

      <main className="layout">
        <section className="layout-editor">
          <BlocklyPane
            room={room}
            mode={mode}
            locked={locked}
            people={people}
            onProgramChange={setProgram}
            onWorkspaceReady={(workspace) => {
              workspaceRef.current = workspace;
            }}
            onPointerMove={reportCursor}
            onDragChange={reportDrag}
          />
          {empty && (
            <p className="pane-hint" role="note">
              {mode === 'junior'
                ? 'Tap a block to add it 👆'
                : 'Drag a block under the start block to begin'}
            </p>
          )}
        </section>

        <section className="layout-side">
          <Stage state={robot} running={running} />
          <ChallengeCard
            challenge={challenge}
            result={result}
            prediction={prediction}
            lockedPrediction={lockedPrediction}
            onPredictionChange={setPrediction}
            stars={stars}
            running={running}
            mode={mode}
          />
        </section>
      </main>
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
