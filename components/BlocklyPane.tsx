'use client';

/**
 * The Blockly workspace, wired to the shared room.
 *
 * Three things here are worth knowing about.
 *
 * Tap to add. In Junior mode a tap on a palette block snaps it onto the end of
 * the script instead of leaving it floating. Dragging accurately is genuinely
 * hard at five, and a block that lands nowhere is the most common way a young
 * child gets stuck.
 *
 * Cursors in workspace coordinates. A pointer position is sent as a point in
 * the workspace, not a fraction of the pane, so when a teacher on a laptop
 * points at `repeat 4 times`, the child on an iPad sees the cursor on that
 * block — whatever her zoom and scroll happen to be.
 *
 * Locking with `inert`. A scrim over the top stops the mouse but not the
 * keyboard, and dropping edits on the sync side instead would let a locked
 * student's workspace drift permanently out of step with the room. `inert`
 * removes the whole subtree from pointer and keyboard interaction, which is
 * what a lock actually means.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import {
  type NumberPadRequest,
  HAT_BLOCK,
  lastBlockInScript,
  registerBlocks,
  setNumberPadHandler,
  themeFor,
  toolboxFor,
  tooltipForType,
  workspaceToProgram,
} from '@/lib/blocks';
import { type Mode, settingsForMode } from '@/lib/ages';
import { HAT_ID, bindWorkspace } from '@/lib/sync';
import type { Program } from '@/lib/program';
import type { Room } from '@/lib/yroom';
import { speak } from '@/lib/speech';
import NumberPad from './NumberPad';
import { Cursors, type PresenceEntry } from './Presence';

/** Cursor updates per second. Enough to feel live, cheap enough for a 3G link. */
const CURSOR_INTERVAL_MS = 50;

export interface BlocklyPaneProps {
  room: Room;
  mode: Mode;
  locked: boolean;
  people: PresenceEntry[];
  onProgramChange: (program: Program) => void;
  onWorkspaceReady: (workspace: Blockly.WorkspaceSvg | null) => void;
  /** Pointer position in workspace coordinates, or null when off-canvas. */
  onPointerMove?: (point: { x: number; y: number } | null) => void;
  /** The block this person is dragging right now, or null. */
  onDragChange?: (blockId: string | null) => void;
}

export default function BlocklyPane({
  room,
  mode,
  locked,
  people,
  onProgramChange,
  onWorkspaceReady,
  onPointerMove,
  onDragChange,
}: BlocklyPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [padRequest, setPadRequest] = useState<NumberPadRequest | null>(null);
  /** Bumped on zoom and scroll so remote cursors re-project. */
  const [viewportTick, setViewportTick] = useState(0);
  const [ready, setReady] = useState(false);

  const changeRef = useRef(onProgramChange);
  changeRef.current = onProgramChange;
  const dragRef = useRef(onDragChange);
  dragRef.current = onDragChange;
  const lastCursorSent = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const settings = settingsForMode(mode);
    registerBlocks(mode);

    const workspace = Blockly.inject(host, {
      toolbox: toolboxFor(mode),
      theme: themeFor(mode),
      renderer: 'zelos',
      horizontalLayout: settings.horizontalToolbox,
      toolboxPosition: settings.horizontalToolbox ? 'start' : 'start',
      trashcan: true,
      sounds: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: {
        controls: true,
        wheel: false,
        startScale: settings.startScale,
        minScale: 0.5,
        maxScale: 2,
      },
      grid: settings.snap
        ? { spacing: 28, length: 3, colour: '#e2e8f0', snap: true }
        : undefined,
    });

    workspaceRef.current = workspace;
    onWorkspaceReady(workspace);

    let teardown: (() => void) | null = null;
    let disposed = false;

    bindWorkspace({
      workspace,
      room,
      onChange: () => changeRef.current(workspaceToProgram(workspace)),
    }).then((off) => {
      if (disposed) off();
      else {
        teardown = off;
        setReady(true);
      }
    });

    /* Tap to add, and the drag indicator. */
    const uiListener = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.VIEWPORT_CHANGE) {
        setViewportTick((tick) => tick + 1);
        return;
      }

      if (event.type === Blockly.Events.BLOCK_DRAG) {
        const dragEvent = event as Blockly.Events.Abstract & {
          isStart?: boolean;
          blockId?: string;
        };
        dragRef.current?.(dragEvent.isStart ? (dragEvent.blockId ?? null) : null);
        return;
      }

      if (event.type !== Blockly.Events.BLOCK_CREATE) return;
      const blockId = (event as Blockly.Events.Abstract & { blockId?: string }).blockId;
      if (!blockId || blockId === HAT_ID) return;

      // Give Blockly a tick to finish its own drag bookkeeping before we
      // decide whether this block was tapped or dragged.
      setTimeout(() => {
        const block = workspace.getBlockById(blockId);
        if (!block || block.isDisposed()) return;

        if (settings.speakOnAdd) speak(tooltipForType(block.type));
        if (!settings.tapToAdd) return;
        if (workspace.isDragging()) return;
        // Already attached somewhere: nothing to do.
        if (block.getParent()) return;

        const last = lastBlockInScript(workspace, HAT_ID);
        if (!last || last.id === block.id) return;
        if (last.nextConnection && block.previousConnection) {
          last.nextConnection.connect(block.previousConnection);
        }
      }, 0);
    };
    workspace.addChangeListener(uiListener);

    const onResize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResize);
      workspace.removeChangeListener(uiListener);
      teardown?.();
      workspace.dispose();
      workspaceRef.current = null;
      onWorkspaceReady(null);
      setReady(false);
    };
    // Rebuilt when the room or the mode changes; both mean a different editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, mode]);

  // The number pad handler is global to Blockly, so it is owned by whichever
  // pane is currently mounted.
  useEffect(() => {
    setNumberPadHandler(setPadRequest);
    return () => setNumberPadHandler(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Cursors                                                           */
  /* ---------------------------------------------------------------- */

  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const workspace = workspaceRef.current;
      const host = hostRef.current;
      if (!workspace || !host || !onPointerMove) return;

      const now = Date.now();
      if (now - lastCursorSent.current < CURSOR_INTERVAL_MS) return;
      lastCursorSent.current = now;

      const rect = host.getBoundingClientRect();
      const origin = workspace.getOriginOffsetInPixels();
      onPointerMove({
        x: (event.clientX - rect.left - origin.x) / workspace.scale,
        y: (event.clientY - rect.top - origin.y) / workspace.scale,
      });
    },
    [onPointerMove],
  );

  /** Projects everyone else's workspace point back into pane pixels. */
  const cursors = (() => {
    void viewportTick; // re-projected whenever the view moves
    const workspace = workspaceRef.current;
    if (!workspace || !ready) return [];
    const origin = workspace.getOriginOffsetInPixels();
    const scale = workspace.scale;
    return people
      .filter((person) => !person.isSelf && person.cursor)
      .map((person) => ({
        clientId: person.clientId,
        name: person.name,
        colour: person.colour,
        left: origin.x + (person.cursor as { x: number }).x * scale,
        top: origin.y + (person.cursor as { y: number }).y * scale,
      }));
  })();

  /* Outline the block someone else is dragging. */
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const touched: SVGElement[] = [];
    for (const person of people) {
      if (person.isSelf || !person.draggingBlockId) continue;
      const svg = workspace.getBlockById(person.draggingBlockId)?.getSvgRoot();
      if (!svg) continue;
      svg.style.filter = `drop-shadow(0 0 7px ${person.colour})`;
      touched.push(svg);
    }
    return () => {
      for (const svg of touched) svg.style.filter = '';
    };
  }, [people]);

  return (
    <div className="pane">
      <div
        ref={hostRef}
        className="pane-blockly"
        onPointerMove={handlePointer}
        onPointerLeave={() => onPointerMove?.(null)}
        // `inert` is what makes the lock real: no pointer, no keyboard, no
        // focus. React 19 passes it through to the DOM attribute.
        inert={locked}
      />

      <Cursors cursors={cursors} />

      {locked && (
        <div className="pane-lock" role="status">
          <div className="pane-lock-card">
            <span className="pane-lock-icon" aria-hidden="true">
              ✋
            </span>
            <strong>Watch your teacher</strong>
            <span>You can see everything. You can edit again in a moment.</span>
          </div>
        </div>
      )}

      <NumberPad request={padRequest} onClose={() => setPadRequest(null)} />
    </div>
  );
}

/** Re-exported so the editor can seed an empty script hint. */
export { HAT_BLOCK };
