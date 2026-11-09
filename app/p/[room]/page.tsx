/**
 * The lesson route: /p/<class-code>-week-<n>
 *
 * One URL per project, which is the link the teacher sends. Name, role and
 * week ride along in the query string so a tapped link needs no sign-in.
 */

import EditorClient from '@/components/EditorClient';
import type { Role } from '@/lib/yroom';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ room: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { room } = await params;
  const query = await searchParams;

  const name = (first(query.name) ?? 'Guest').slice(0, 24);
  const role: Role = first(query.role) === 'teacher' ? 'teacher' : 'student';

  // The week lives in the room id, so a shared link always opens the same
  // week even if the query string is trimmed off.
  const fromRoom = Number(room.match(/week-(\d+)$/)?.[1]);
  const fromQuery = Number(first(query.week));
  const week = clampWeek(fromRoom || fromQuery || 1);

  return <EditorClient roomId={room} name={name} role={role} week={week} />;
}

function clampWeek(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.round(value)));
}
