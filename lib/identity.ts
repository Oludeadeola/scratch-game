/**
 * Who is using this device.
 *
 * Deliberately local-only. The child's name and age are kept in this browser
 * and are never put in the URL, never written to the shared document, and never
 * sent to a server. The name does travel to the people in the same room, as a
 * cursor label, because that is the point of the room — but it reaches them
 * over the realtime channel, not through our logs.
 *
 * That is also why the lesson link carries only the room: a teacher can paste
 * the same link to the whole class without it carrying anybody's name, and
 * without a child's name ending up in a server access log.
 */

import { type Mode, clampAge, modeForAge } from './ages';

export interface Identity {
  name: string;
  age: number;
  role: 'teacher' | 'student';
  /** Normally derived from age, but a teacher can override it for a child. */
  mode: Mode;
}

const KEY = 'mathblocks:identity';

export function loadIdentity(): Identity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (!parsed.name) return null;

    const role = parsed.role === 'teacher' ? 'teacher' : 'student';
    // A teacher is an adult; age only shapes a child's editor.
    const age = role === 'teacher' ? 30 : clampAge(Number(parsed.age));
    const mode: Mode =
      parsed.mode === 'junior' || parsed.mode === 'builder'
        ? parsed.mode
        : role === 'teacher'
          ? 'builder'
          : modeForAge(age);

    return { name: String(parsed.name).slice(0, 24), age, role, mode };
  } catch {
    // Private browsing, cleared storage, or a corrupt value. Treat all three
    // the same: nobody is signed in on this device yet.
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Storage being unavailable must not block a child from joining a lesson;
    // the identity simply does not survive a reload.
  }
}

export function clearIdentity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

/** The last class code and week used on this device, to prefill the join form. */
const LAST_ROOM_KEY = 'mathblocks:last-room';

export interface LastRoom {
  classCode: string;
  week: number;
}

export function loadLastRoom(): LastRoom | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastRoom>;
    if (!parsed.classCode) return null;
    return {
      classCode: String(parsed.classCode),
      week: Number(parsed.week) || 1,
    };
  } catch {
    return null;
  }
}

export function saveLastRoom(room: LastRoom): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_ROOM_KEY, JSON.stringify(room));
  } catch {
    // Ignored, as above.
  }
}

/** Turns a free-typed class code into the shape used in a URL. */
export function normaliseClassCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9- ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function roomIdFor(classCode: string, week: number): string {
  return `${normaliseClassCode(classCode) || 'class'}-week-${week}`;
}
