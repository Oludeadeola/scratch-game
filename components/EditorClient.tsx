'use client';

/**
 * Keeps the editor out of server rendering, and answers "who is this?" before
 * the lesson opens.
 *
 * The editor attaches IndexedDB on mount, which does not exist on the server,
 * so the whole subtree must be client-only — and a server component cannot ask
 * for `ssr: false` itself.
 *
 * Because the link carries no name, a child who taps a shared link on a fresh
 * device lands here with no identity. Rather than bounce her back to the join
 * screen and lose the room, we ask the two questions inline and go straight in.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  MAX_AGE,
  MIN_AGE,
  type Mode,
  modeDescription,
  modeForAge,
  modeLabel,
} from '@/lib/ages';
import { type Identity, loadIdentity, saveIdentity } from '@/lib/identity';
import ErrorBoundary from './ErrorBoundary';

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <p className="boot-text">Opening your project…</p>
    </div>
  ),
});

export interface EditorClientProps {
  roomId: string;
  week: number;
}

export default function EditorClient({ roomId, week }: EditorClientProps) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setIdentity(loadIdentity());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="boot">
        <p className="boot-text">Opening your project…</p>
      </div>
    );
  }

  if (!identity) {
    return <WhoAreYou roomId={roomId} onReady={setIdentity} />;
  }

  return (
    <ErrorBoundary>
      <Editor
        roomId={roomId}
        week={week}
        name={identity.name}
        role={identity.role}
        mode={identity.mode}
      />
    </ErrorBoundary>
  );
}

function WhoAreYou({
  roomId,
  onReady,
}: {
  roomId: string;
  onReady: (identity: Identity) => void;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(7);

  const mode: Mode = modeForAge(age);
  const classCode = roomId.replace(/-week-\d+$/, '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const identity: Identity = { name: trimmed, age, role: 'student', mode };
    saveIdentity(identity);
    onReady(identity);
  }

  return (
    <main className="join">
      <form className="join-card" onSubmit={submit}>
        <h1 className="join-title">Welcome!</h1>
        <p className="join-sub">
          You are joining class <strong>{classCode}</strong>. Two quick
          questions and you are in.
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
            autoFocus
          />
        </label>

        <div className="field">
          <span>How old are you?</span>
          <div className="ages" role="group" aria-label="Your age">
            {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={`age ${age === value ? 'is-on' : ''}`}
                  onClick={() => setAge(value)}
                  aria-pressed={age === value}
                >
                  {value}
                </button>
              ),
            )}
          </div>
          <p className="age-note">
            This picks your blocks and stays on this device.
          </p>
        </div>

        <div className={`mode-card is-${mode}`}>
          <span className="mode-name">{modeLabel(mode)} blocks</span>
          <p className="mode-desc">{modeDescription(mode)}</p>
        </div>

        <button type="submit" className="btn btn-primary btn-big">
          Join the lesson
        </button>
      </form>
    </main>
  );
}
