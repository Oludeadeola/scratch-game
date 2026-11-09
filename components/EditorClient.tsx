'use client';

/**
 * Keeps the editor out of server rendering entirely.
 *
 * The editor opens a Yjs room on mount, and that room attaches IndexedDB for
 * offline editing and auto-save. IndexedDB does not exist on the server, so the
 * whole subtree has to be client-only. A server component cannot ask for
 * `ssr: false` itself, so the lesson route renders this instead.
 */

import dynamic from 'next/dynamic';
import type { Role } from '@/lib/yroom';

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <p className="boot-text">Opening your project…</p>
    </div>
  ),
});

export interface EditorClientProps {
  roomId: string;
  name: string;
  role: Role;
  week: number;
}

export default function EditorClient(props: EditorClientProps) {
  return <Editor {...props} />;
}
