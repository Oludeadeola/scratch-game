/**
 * The lesson route: /p/<class-code>-week-<n>, or <class-code>-early-week-<n>.
 *
 * The URL carries only the room. Who you are lives on your own device, so a
 * teacher can paste one link to the whole class and no child's name ends up in
 * a server log or in a browser history shared with a sibling.
 *
 * The track and week are read out of the room id rather than a query string,
 * so a trimmed or forwarded link still opens exactly the same project.
 */

import EditorClient from '@/components/EditorClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ room: string }>;
}

export default async function LessonPage({ params }: PageProps) {
  const { room } = await params;

  const parsed = Number(room.match(/week-(\d+)$/)?.[1]);
  const week = Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : 1;

  return <EditorClient roomId={room} week={week} />;
}
