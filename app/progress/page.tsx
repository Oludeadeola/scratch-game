'use client';

/**
 * The progress map, written for a parent.
 *
 * The PRD asks for a weekly parent report and a progress map. This is both, on
 * one page a parent can open on a phone: what she has finished, which standard
 * each week practised, and one thing to try away from the screen.
 *
 * It reads the weekly projects straight from this device's own storage, with no
 * socket and no presence, so opening it does not announce a parent as a
 * participant in a dozen lessons and it works with no signal at all.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { challengesFor } from '@/lib/challenges';
import { type Track, trackLabel } from '@/lib/ages';
import {
  type Identity,
  loadIdentity,
  loadLastRoom,
  roomIdFor,
} from '@/lib/identity';
import { openRoom, starsThisWeek } from '@/lib/yroom';

interface WeekProgress {
  week: number;
  stars: number;
  blocks: number;
}

export default function ProgressPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [classCode, setClassCode] = useState('');
  const [track, setTrack] = useState<Track>('core');
  const [progress, setProgress] = useState<WeekProgress[] | null>(null);

  const load = useCallback(
    async (name: string, code: string, which: Track) => {
      setProgress(null);
      const collected: WeekProgress[] = [];
      for (const challenge of challengesFor(which)) {
        const room = openRoom(roomIdFor(code, challenge.week, which), {
          local: true,
        });
        try {
          await room.whenLoaded;
          collected.push({
            week: challenge.week,
            stars: starsThisWeek(room.stars, name, challenge.week),
            blocks: room.events.length,
          });
        } finally {
          room.destroy();
        }
      }
      setProgress(collected);
    },
    [],
  );

  useEffect(() => {
    const who = loadIdentity();
    const last = loadLastRoom();
    setIdentity(who);
    const code = last?.classCode ?? '';
    setClassCode(code);
    if (who && code) void load(who.name, code, track);
  }, [load, track]);

  if (!identity) {
    return (
      <main className="report">
        <div className="report-card">
          <h1 className="report-title">Progress</h1>
          <p className="report-empty">
            Nothing to show yet on this device. Open a lesson first, then come
            back here.
          </p>
          <Link className="btn btn-primary btn-big" href="/">
            Go to lessons
          </Link>
        </div>
      </main>
    );
  }

  const challenges = challengesFor(track);
  const totalStars = progress?.reduce((sum, week) => sum + week.stars, 0) ?? 0;
  const done = progress?.filter((week) => week.stars > 0).length ?? 0;
  const standards = new Set(
    challenges
      .filter((c) => progress?.some((p) => p.week === c.week && p.stars > 0))
      .flatMap((c) => c.standards),
  );

  return (
    <main className="report">
      <div className="report-card">
        <header className="report-head">
          <div>
            <h1 className="report-title">{identity.name}&rsquo;s progress</h1>
            <p className="report-sub">
              {classCode ? `Class ${classCode}` : 'No class yet'} ·{' '}
              {challenges.length} week course
            </p>
          </div>
          <Link className="btn btn-ghost" href="/">
            Lessons
          </Link>
        </header>

        <div className="tracks" role="group" aria-label="Course">
          {(['early', 'core'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`track ${track === option ? 'is-on' : ''}`}
              onClick={() => setTrack(option)}
              aria-pressed={track === option}
            >
              <span className="track-name">{trackLabel(option)}</span>
              <span className="track-meta">
                {challengesFor(option).length} weeks
              </span>
            </button>
          ))}
        </div>

        <div className="report-totals">
          <Total value={String(done)} label="weeks finished" of={`of ${challenges.length}`} />
          <Total value={String(totalStars)} label="stars earned" />
          <Total value={String(standards.size)} label="standards practised" />
        </div>

        {progress === null ? (
          <p className="report-empty">Reading this device&rsquo;s projects…</p>
        ) : (
          <ol className="map">
            {challenges.map((challenge) => {
              const week = progress.find((p) => p.week === challenge.week);
              const stars = week?.stars ?? 0;
              const started = (week?.blocks ?? 0) > 0;
              const status = stars > 0 ? 'done' : started ? 'started' : 'todo';
              return (
                <li key={challenge.week} className={`map-week is-${status}`}>
                  <div className="map-marker" aria-hidden="true">
                    {stars > 0 ? '⭐' : started ? '•' : ''}
                  </div>
                  <div className="map-body">
                    <p className="map-title">
                      <span className="map-week-no">Week {challenge.week}</span>
                      {challenge.project}
                    </p>
                    <p className="map-prompt">{challenge.prompt}</p>
                    <p className="map-standard">
                      {challenge.standards.join(' · ')}
                      {stars > 1 && <span className="map-stars"> · {stars} stars</span>}
                    </p>
                    <p className="map-home">
                      <span className="map-home-label">Try at home</span>
                      {challenge.tryAtHome}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="report-note">
          This page reads only what is saved on this device. Nothing here is sent
          anywhere.
        </p>
      </div>
    </main>
  );
}

function Total({ value, label, of }: { value: string; label: string; of?: string }) {
  return (
    <div className="total">
      <span className="total-value">
        {value}
        {of && <span className="total-of"> {of}</span>}
      </span>
      <span className="total-label">{label}</span>
    </div>
  );
}
