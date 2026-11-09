'use client';

/**
 * The join screen.
 *
 * The PRD's first use case is a teacher sending one link and a 7-year-old
 * tapping it — no email, no password. So joining asks for a first name, a class
 * code and nothing else. The class code plus the week is the project key, which
 * is what gives "one project per student per week".
 *
 * Phase 2 replaces this with teacher-created students and a picture password.
 * Nothing here is stored off the device.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHALLENGES } from '@/lib/challenges';

const STORAGE_KEY = 'mathblocks:last-join';

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [classCode, setClassCode] = useState('sunshine');
  const [week, setWeek] = useState(1);
  const [role, setRole] = useState<'student' | 'teacher'>('student');

  // Remember the last join on this device so a child is not typing her name
  // again every lesson.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.name) setName(parsed.name);
      if (parsed.classCode) setClassCode(parsed.classCode);
      if (parsed.role) setRole(parsed.role);
    } catch {
      // A blocked or full localStorage is not a reason to fail the join.
    }
  }, []);

  function join(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const code = classCode.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed || !code) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: trimmed, classCode: code, role }),
      );
    } catch {
      // Fine. The query string below carries everything we need anyway.
    }

    const params = new URLSearchParams({ name: trimmed, role, week: String(week) });
    router.push(`/p/${code}-week-${week}?${params}`);
  }

  const challenge = CHALLENGES.find((c) => c.week === week);

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
            {CHALLENGES.map((c) => (
              <option key={c.week} value={c.week}>
                Week {c.week} — {c.project}
              </option>
            ))}
          </select>
        </label>

        {challenge && <p className="join-challenge">{challenge.prompt}</p>}

        <fieldset className="roles">
          <legend>I am the</legend>
          {(['student', 'teacher'] as const).map((option) => (
            <label key={option} className={`role ${role === option ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
              />
              {option === 'student' ? 'Student' : 'Teacher'}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="btn btn-primary btn-big">
          Start
        </button>

        <p className="join-note">
          Everyone who opens the same class code and week lands in the same
          project.
        </p>
      </form>
    </main>
  );
}
