'use client';

/**
 * Presence: who is here, where their pointer is, and who has a hand up.
 *
 * Cursor positions travel through Yjs awareness, not the document, so they are
 * never saved and never replayed. Positions are stored as a fraction of the
 * editor pane rather than pixels, so a teacher on a laptop and a child on an
 * iPad point at the same block.
 */

import type { Participant } from '@/lib/yroom';

export interface PresenceEntry extends Participant {
  clientId: number;
  isSelf: boolean;
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

/** Other people's cursors, drawn over the editor pane. */
export function Cursors({ people }: { people: PresenceEntry[] }) {
  return (
    <div className="cursors" aria-hidden="true">
      {people
        .filter((person) => !person.isSelf && person.cursor)
        .map((person) => (
          <div
            key={person.clientId}
            className="cursor"
            style={{
              left: `${(person.cursor as { x: number }).x * 100}%`,
              top: `${(person.cursor as { y: number }).y * 100}%`,
              color: person.colour,
            }}
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
            <span
              className="cursor-name"
              style={{ backgroundColor: person.colour }}
            >
              {person.name}
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
