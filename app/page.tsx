'use client';

/**
 * The join screen.
 *
 * A teacher sends one link and a 7-year-old taps it, so joining asks for as
 * little as it can: who you are, how old you are, and which class. No email, no
 * password, no date of birth.
 *
 * The age question is the one that shapes everything downstream. It picks
 * between the two editors — picture blocks for 4-7, worded blocks for 8+ — and
 * it never leaves this device.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CHALLENGES } from '@/lib/challenges';
import {
  MAX_AGE,
  MIN_AGE,
  type Mode,
  modeDescription,
  modeForAge,
  modeLabel,
  suggestedGrade,
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
  /** Null means "follow the age". A teacher can pin a mode for a child. */
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);

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
  const mode: Mode = isTeacher ? 'builder' : (modeOverride ?? modeForAge(age));
  const challenge = CHALLENGES.find((c) => c.week === week);

  function join(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !classCode.trim()) return;

    saveIdentity({ name: trimmed, age: isTeacher ? 30 : age, role, mode });
    saveLastRoom({ classCode, week });

    // Only the room goes in the URL. A teacher can paste this link to the whole
    // class without it carrying anybody's name.
    router.push(`/p/${roomIdFor(classCode, week)}`);
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
                  setModeOverride(null);
                }}
              />
              {option === 'student' ? 'Student' : 'Teacher'}
            </label>
          ))}
        </fieldset>

        {!isTeacher && (
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
                      setModeOverride(null);
                    }}
                    aria-pressed={age === value}
                  >
                    {value}
                  </button>
                ),
              )}
            </div>
            <p className="age-note">
              Usually {suggestedGrade(age)}. We only keep this on your device.
            </p>
          </div>
        )}

        <div className={`mode-card is-${mode}`}>
          <div className="mode-head">
            <span className="mode-name">{modeLabel(mode)} blocks</span>
            {!isTeacher && (
              <button
                type="button"
                className="mode-switch"
                onClick={() =>
                  setModeOverride(mode === 'junior' ? 'builder' : 'junior')
                }
              >
                Use {modeLabel(mode === 'junior' ? 'builder' : 'junior')} instead
              </button>
            )}
          </div>
          <p className="mode-desc">{modeDescription(mode)}</p>
          <p className="mode-sample" aria-hidden="true">
            {mode === 'junior' ? '🏁 ➡️ 5 🔁 4 🏆 ➕ 5' : 'when Run is clicked → move 5 steps'}
          </p>
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
            {CHALLENGES.map((c) => (
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
