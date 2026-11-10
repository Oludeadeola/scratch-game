'use client';

/**
 * Presence: who is here, where they are pointing, and who has a hand up.
 *
 * Cursor positions travel through Yjs awareness rather than the document, so
 * they are never saved and never replayed. The projection from workspace
 * coordinates to pixels happens in the editor pane, which is the only place
 * that knows the current zoom and scroll.
 */

import type { Participant } from '@/lib/yroom';

export interface PresenceEntry extends Participant {
  clientId: number;
  isSelf: boolean;
}

export interface CursorPixel {
  clientId: number;
  name: string;
  colour: string;
  left: number;
  top: number;
}

export function Avatars({ people }: { people: PresenceEntry[] }) {
  return (
    <div className="avatars" aria-label="People in this project">
      {people.map((person) => (
        <span
          key={person.clientId}
          className={`avatar ${person.role === 'teacher' ? 'is-teacher' : ''}`}
          style={{ backgroundColor: person.colour }}
          title={`${person.name}${person.isSelf ? ' (you)' : ''}`}
        >
          {initials(person.name)}
          {person.handRaised && (
            <span className="avatar-hand" aria-label="Hand raised">
              ✋
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Cursors({ cursors }: { cursors: CursorPixel[] }) {
  if (!cursors.length) return null;
  return (
    <div className="cursors" aria-hidden="true">
      {cursors.map((cursor) => (
        <div
          key={cursor.clientId}
          className="cursor"
          style={{ left: cursor.left, top: cursor.top, color: cursor.colour }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path
              d="M3 2 L17 11 L10 12 L13 19 L10 20 L7 13 L3 17 Z"
              fill="currentColor"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <span className="cursor-name" style={{ backgroundColor: cursor.colour }}>
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
