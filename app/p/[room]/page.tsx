/**
 * The lesson route: /p/<class-code>-week-<n>
 *
 * The URL carries only the room. Who you are lives on your own device, so a
 * teacher can paste one link to the whole class and no child's name ends up in
 * a server log or a browser history shared with a sibling.
 */

import EditorClient from '@/components/EditorClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ room: string }>;
}

export default async function LessonPage({ params }: PageProps) {
  const { room } = await params;

  // The week lives in the room id, so a shared link always opens the same week.
  const parsed = Number(room.match(/week-(\d+)$/)?.[1]);
  const week = Number.isFinite(parsed) ? Math.min(12, Math.max(1, parsed)) : 1;

  return <EditorClient roomId={room} week={week} />;
}
