'use client';

/**
 * The Blockly workspace, wired to the shared room.
 *
 * Blockly touches the DOM directly and has no server rendering story, so this
 * component is always mounted client-side only (see Editor.tsx).
 */

import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import {
  THEME,
  TOOLBOX,
  type NumberPadRequest,
  registerBlocks,
  setNumberPadHandler,
  workspaceToProgram,
} from '@/lib/blocks';
import { bindWorkspace } from '@/lib/sync';
import type { Program } from '@/lib/program';
import type { Room } from '@/lib/yroom';
import NumberPad from './NumberPad';

export interface BlocklyPaneProps {
  room: Room;
  /** Students cannot edit while the teacher has screens locked. */
  locked: boolean;
  /** Fires whenever the script changes, local or remote. */
  onProgramChange: (program: Program) => void;
  /** Hands the live workspace up so the runner can highlight blocks. */
  onWorkspaceReady: (workspace: Blockly.WorkspaceSvg) => void;
  /** Reports pointer position in workspace coordinates, for live cursors. */
  onPointerMove?: (point: { x: number; y: number } | null) => void;
}

export default function BlocklyPane({
  room,
  locked,
  onProgramChange,
  onWorkspaceReady,
  onPointerMove,
}: BlocklyPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [padRequest, setPadRequest] = useState<NumberPadRequest | null>(null);

  // Keep the latest callbacks reachable from the one-shot init effect without
  // tearing the workspace down whenever a parent re-renders.
  const changeRef = useRef(onProgramChange);
  changeRef.current = onProgramChange;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    registerBlocks();
    setNumberPadHandler(setPadRequest);

    const workspace = Blockly.inject(host, {
      toolbox: TOOLBOX,
      theme: THEME,
      renderer: 'zelos',
      trashcan: true,
      sounds: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: false, startScale: 0.9, minScale: 0.5, maxScale: 1.6 },
      grid: { spacing: 28, length: 3, colour: '#e2e8f0', snap: true },
    });

    workspaceRef.current = workspace;
    onWorkspaceReady(workspace);

    let teardown: (() => void) | null = null;
    let disposed = false;

    bindWorkspace({
      workspace,
      room,
      isLocked: () => lockedRef.current,
      onChange: () => changeRef.current(workspaceToProgram(workspace)),
    }).then((off) => {
      if (disposed) off();
      else teardown = off;
    });

    const onResize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      setNumberPadHandler(null);
      teardown?.();
      workspace.dispose();
      workspaceRef.current = null;
    };
    // The workspace is created once per room and torn down with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  function handlePointer(event: React.PointerEvent<HTMLDivElement>) {
    const workspace = workspaceRef.current;
    if (!workspace || !onPointerMove) return;
    const host = hostRef.current;
    if (!host) return;
    const bounds = host.getBoundingClientRect();
    onPointerMove({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  }

  return (
    <div className="pane">
      <div
        ref={hostRef}
        className="pane-blockly"
        onPointerMove={handlePointer}
        onPointerLeave={() => onPointerMove?.(null)}
      />

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
