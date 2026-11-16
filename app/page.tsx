'use client';

/**
 * The join screen.
 *
 * A teacher sends one link and a 7-year-old taps it, so this asks as little as
 * it can: who you are, how old you are, which class. No email, no password, no
 * date of birth.
 *
 * Age is the question that shapes everything downstream — the blocks in the
 * palette, how big a number the pad offers, whether a tap places a block, and
 * which track of challenges you start on. So the screen shows what the age you
 * picked actually gets you, rather than asking and silently deciding.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { challengesFor } from '@/lib/challenges';
import {
  MAX_AGE,
  MIN_AGE,
  type Track,
  modeLabel,
  profileForAge,
  suggestedGrade,
  trackLabel,
} from '@/lib/ages';
import {
  loadIdentity,
  loadLastRoom,
  roomIdFor,
  saveIdentity,
  saveLastRoom,
} from '@/lib/identity';
import InstallApp from '@/components/InstallApp';

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState(7);
  const [classCode, setClassCode] = useState('sunshine');
  const [week, setWeek] = useState(1);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  /** Null means "whatever this age suggests". */
  const [trackOverride, setTrackOverride] = useState<Track | null>(null);

  useEffect(() => {
    const who = loadIdentity();
    if (who) {
      setName(who.name);
      setRole(who.role);
      if (who.role === 'student') setAge(who.age);
    }
    const last = loadLastRoom();
    if (last) {
      setClassCode(last.classCode);
      setWeek(last.week);
    }
  }, []);

  const isTeacher = role === 'teacher';
  const profile = profileForAge(age);
  const track: Track = trackOverride ?? (isTeacher ? 'core' : profile.track);
  const weeks = useMemo(() => challengesFor(track), [track]);

  // A track change can leave the chosen week off the end of the shorter one.
  useEffect(() => {
    if (week > weeks.length) setWeek(1);
  }, [weeks.length, week]);

  const challenge = weeks.find((c) => c.week === week);

  function join(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !classCode.trim()) return;

    saveIdentity({ name: trimmed, age: isTeacher ? 30 : age, role });
    saveLastRoom({ classCode, week });

    // Only the room goes in the URL, so a teacher can paste this link to the
    // whole class without it carrying anybody's name.
    router.push(`/p/${roomIdFor(classCode, week, track)}`);
  }

  return (
    <main className="join">
      <form className="join-card" onSubmit={join}>
        <h1 className="join-title">MathBlocks Live</h1>
        <p className="join-sub">
          Build the same project with your teacher, wherever you both are.
        </p>

        <label className="field">
          <span>Your first name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada"
            autoComplete="off"
            required
            maxLength={24}
          />
        </label>

        <fieldset className="roles">
          <legend>I am the</legend>
          {(['student', 'teacher'] as const).map((option) => (
            <label key={option} className={`role ${role === option ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => {
                  setRole(option);
                  setTrackOverride(null);
                }}
              />
              {option === 'student' ? 'Student' : 'Teacher'}
            </label>
          ))}
        </fieldset>

        {!isTeacher && (
          <>
            <div className="field">
              <span>How old are you?</span>
              <div className="ages" role="group" aria-label="Your age">
                {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      className={`age ${age === value ? 'is-on' : ''}`}
                      onClick={() => {
                        setAge(value);
                        setTrackOverride(null);
                      }}
                      aria-pressed={age === value}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
              <p className="age-note">
                Usually {suggestedGrade(age)}. This stays on your device.
              </p>
            </div>

            <div className={`mode-card is-${profile.mode}`}>
              <div className="mode-head">
                <span className="mode-name">
                  Age {profile.age} · {profile.title}
                </span>
                <span className="mode-tag">{modeLabel(profile.mode)}</span>
              </div>
              <p className="mode-desc">{profile.unlocks}</p>

              <ul className="limits">
                <Limit label="Blocks" value={String(profile.blocks.length)} />
                <Limit label="Numbers to" value={String(profile.maxNumber)} />
                <Limit label="Repeat to" value={String(profile.maxRepeat)} />
                <Limit
                  label="Loop in loop"
                  value={profile.allowNesting ? 'yes' : 'not yet'}
                />
              </ul>

              <p className="mode-sample" aria-hidden="true">
                {profile.mode === 'junior'
                  ? '🏁  ➡️ 5   🔁 4   🏆 ➕ 5'
                  : 'when Run is clicked → move 5 steps → repeat 4 times'}
              </p>
            </div>
          </>
        )}

        <div className="field">
          <span>Course</span>
          <div className="tracks" role="group" aria-label="Course">
            {(['early', 'core'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`track ${track === option ? 'is-on' : ''}`}
                onClick={() => setTrackOverride(option)}
                aria-pressed={track === option}
              >
                <span className="track-name">{trackLabel(option)}</span>
                <span className="track-meta">
                  {challengesFor(option).length} weeks ·{' '}
                  {option === 'early' ? 'ages 4–6' : 'ages 7+'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Class code</span>
          <input
            value={classCode}
            onChange={(event) => setClassCode(event.target.value)}
            placeholder="sunshine"
            autoComplete="off"
            required
            maxLength={32}
          />
        </label>

        <label className="field">
          <span>Week</span>
          <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
            {weeks.map((c) => (
              <option key={c.week} value={c.week}>
                Week {c.week} — {c.project}
              </option>
            ))}
          </select>
        </label>

        {challenge && <p className="join-challenge">{challenge.prompt}</p>}

        <button type="submit" className="btn btn-primary btn-big">
          Start
        </button>

        <div className="join-foot">
          <Link href="/progress" className="join-link">
            See progress
          </Link>
          <InstallApp />
        </div>
      </form>
    </main>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="limit">
      <span className="limit-value">{value}</span>
      <span className="limit-label">{label}</span>
    </li>
  );
}
