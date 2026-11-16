'use client';

/**
 * The welcome moment.
 *
 * A lesson opens with the robot saying hello to the child by name, and the
 * child pressing one big button to start. That button is not decoration: no
 * browser will speak until the page has been tapped, so rather than have the
 * greeting silently fail, the tap *is* the greeting.
 *
 * It also sets up what she is about to do, out loud, which matters for a
 * six-year-old who cannot yet read the challenge card.
 */

import { useEffect, useRef, useState } from 'react';
import { speechSupported, stopSpeaking } from '@/lib/speech';
import { speakWelcome, welcomeScript } from '@/lib/voice';

export interface WelcomeProps {
  name: string;
  project: string;
  prompt: string;
  returning: boolean;
  /** Stars already earned on this project, so a return visit can say so. */
  stars: number;
  onStart: () => void;
}

export default function Welcome({
  name,
  project,
  prompt,
  returning,
  stars,
  onStart,
}: WelcomeProps) {
  const [canSpeak, setCanSpeak] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => setCanSpeak(speechSupported()), []);
  useEffect(() => () => stopSpeaking(), []);

  const script = welcomeScript({ name, project, prompt, returning });

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;
    if (canSpeak) speakWelcome({ name, project, prompt, returning });
    // Let the card fall away before the editor appears, so the change of
    // screen does not feel like a jump cut.
    setLeaving(true);
    window.setTimeout(onStart, 420);
  }

  return (
    <div className={`welcome ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true">
      <div className="welcome-card">
        <div className="welcome-robot" aria-hidden="true">
          <RobotWave />
        </div>

        <h1 className="welcome-heading">{script.heading}</h1>

        <div className="welcome-lines">
          {script.lines.map((line, index) => (
            <p key={index} className="welcome-line">
              {line}
            </p>
          ))}
        </div>

        {stars > 0 && (
          <p className="welcome-stars" aria-label={`${stars} stars so far`}>
            {'⭐'.repeat(Math.min(stars, 5))}
            <span className="welcome-stars-note">
              {stars === 1 ? '1 star so far' : `${stars} stars so far`}
            </span>
          </p>
        )}

        <button type="button" className="btn btn-start" onClick={start} autoFocus>
          Let&rsquo;s go!
        </button>

        {!canSpeak && (
          <p className="welcome-quiet">
            This browser cannot read out loud, so everything is written down too.
          </p>
        )}
      </div>
    </div>
  );
}

/** The same robot as the stage, waving. */
function RobotWave() {
  return (
    <svg viewBox="0 0 120 100" className="welcome-robot-svg">
      <g className="welcome-arm">
        <rect x={84} y={34} width={10} height={26} rx={5} fill="#1d6fd0" />
      </g>
      <rect x={28} y={26} width={56} height={52} rx={16} fill="#1d6fd0" />
      <rect x={38} y={38} width={36} height={18} rx={6} fill="#e0f2fe" />
      <circle cx={49} cy={47} r={4.5} fill="#0f172a" />
      <circle cx={63} cy={47} r={4.5} fill="#0f172a" />
      <rect x={42} y={64} width={28} height={5} rx={2.5} fill="#bae6fd" />
      {[48, 56, 64].map((x) => (
        <rect key={x} x={x} y={60} width={3} height={13} rx={1.5} fill="#bae6fd" />
      ))}
      <rect x={52} y={14} width={4} height={12} rx={2} fill="#94a3b8" />
      <circle cx={54} cy={12} r={5} fill="#f59e0b" />
    </svg>
  );
}
