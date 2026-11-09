'use client';

/**
 * The lesson screen: palette and script on the left, stage and challenge on
 * the right, one toolbar across the top.
 *
 * Shared Run works by bumping a counter in the room's meta map. Every client
 * watching that counter starts playing the same program at the same moment.
 * Because the interpreter is deterministic, that is enough to keep the two
 * screens identical without streaming a single frame between them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type * as Blockly from 'blockly/core';
import {
  type Challenge,
  type CheckResult,
  challengeForWeek,
  checkChallenge,
} from '@/lib/challenges';
import { EMPTY_PROGRAM, type Program } from '@/lib/program';
import { type Frame, type RobotState, collectFrames, freshState } from '@/lib/runtime';
import { speak, speakProgram, stopSpeaking } from '@/lib/speech';
import {
  type Participant,
  type Role,
  type RoomMeta,
  awardStar,
  colourForClientId,
  openRoom,
  readMeta,
  starsThisWeek,
  triggerSharedRun,
  writeMeta,
} from '@/lib/yroom';
import { clearScript } from '@/lib/sync';
import Stage from './Stage';
import ChallengeCard from './ChallengeCard';
import { Avatars, Cursors, type PresenceEntry } from './Presence';

// Blockly reaches straight for the DOM and cannot be server rendered.
const BlocklyPane = dynamic(() => import('./BlocklyPane'), {
  ssr: false,
  loading: () => <div className="pane pane-loading">Loading blocks…</div>,
});

/** Milliseconds between frames. Slow mode is the PRD's step-by-step run. */
const FRAME_MS = { normal: 160, slow: 750 } as const;

export interface EditorProps {
  roomId: string;
  name: string;
  role: Role;
  week: number;
}

export default function Editor({ roomId, name, role, week }: EditorProps) {
  const room = useMemo(() => openRoom(roomId), [roomId]);
  useEffect(() => () => room.destroy(), [room]);

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
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const [stars, setStars] = useState(0);
  const [online, setOnline] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const programRef = useRef<Program>(EMPTY_PROGRAM);
  programRef.current = program;
  /** Bumped to cancel an in-flight run. */
  const runSeqRef = useRef(0);
  /** The run token we have already played, so a reload does not auto-run. */
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
        entries.push({
          ...person,
          clientId,
          isSelf: clientId === awareness.clientID,
        });
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
      const current = room.awareness.getLocalState() as unknown as Participant | null;
      if (!current) return;
      room.awareness.setLocalStateField('cursor', point);
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
      // Seed the week on first open; later opens keep whatever is stored.
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
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.highlightBlock(blockId);
  }, []);

  const play = useCallback(
    async (speed: RoomMeta['runSpeed']) => {
      const seq = (runSeqRef.current += 1);
      const frames: Frame[] = collectFrames(programRef.current);

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
        awardStar(room.stars, name, meta.week);
        speak('Challenge complete! You earned a star.');
      }
    },
    [challenge, highlight, meta.week, name, room.stars],
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
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    room.awareness.setLocalStateField('handRaised', next);
  }

  /* ---------------------------------------------------------------- */

  const empty = program.nodes.length === 0;

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">MathBlocks&nbsp;Live</span>
          <span className={`conn ${online ? 'is-online' : ''}`}>
            {online ? 'Live' : 'Offline — saving on this device'}
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
              <label className="week-picker">
                Week
                <select
                  value={meta.week}
                  onChange={(event) =>
                    writeMeta(room.meta, { week: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
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
            locked={locked}
            onProgramChange={setProgram}
            onWorkspaceReady={(workspace) => {
              workspaceRef.current = workspace;
            }}
            onPointerMove={reportCursor}
          />
          <Cursors people={people} />
        </section>

        <section className="layout-side">
          <Stage state={robot} running={running} />
          <ChallengeCard
            challenge={challenge}
            result={result}
            prediction={prediction}
            onPredictionChange={setPrediction}
            stars={stars}
            running={running}
          />
        </section>
      </main>
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
