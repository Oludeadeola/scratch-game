'use client';

/**
 * The challenge card: the whole "learn faster" loop in one panel.
 *
 * Before Run it asks her to predict. After Run it marks the work against the
 * week's rules and shows her guess next to what actually happened. The teacher
 * never has to be the one who checks.
 */

import { useEffect, useState } from 'react';
import type { Challenge, CheckResult } from '@/lib/challenges';
import type { Mode } from '@/lib/ages';
import { speak, speechSupported } from '@/lib/speech';

export interface ChallengeCardProps {
  challenge: Challenge;
  /** Null until the first run of this script. */
  result: CheckResult | null;
  /** What she is typing now. */
  prediction: string;
  /**
   * The guess as it stood when Run was pressed, or null if she has not run
   * yet. Frozen so the answer cannot be back-filled after the robot shows it,
   * which would make the whole predict-first exercise pointless.
   */
  lockedPrediction: string | null;
  onPredictionChange: (value: string) => void;
  mode: Mode;
  /** Stars earned on this challenge so far, including teacher bonuses. */
  stars: number;
  /** True while a run is playing, so we hide last run's marking. */
  running: boolean;
}

export default function ChallengeCard({
  challenge,
  result,
  prediction,
  lockedPrediction,
  onPredictionChange,
  stars,
  running,
  mode,
}: ChallengeCardProps) {
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => setCanSpeak(speechSupported()), []);

  // In Junior mode the challenge is read aloud on arrival, because the child
  // it is written for cannot yet read it.
  useEffect(() => {
    if (mode !== 'junior' || !speechSupported()) return;
    const timer = setTimeout(() => speak(challenge.prompt), 600);
    return () => clearTimeout(timer);
  }, [mode, challenge.prompt]);

  const showResult = result !== null && !running;
  const actual = showResult ? challenge.predictActual(result.state) : null;
  const guessed = (lockedPrediction ?? prediction).trim();
  const predictionRight =
    actual !== null && guessed !== '' && guessed.toLowerCase() === actual.toLowerCase();

  return (
    <section className="card challenge" aria-label="This week's challenge">
      <header className="challenge-head">
        <span className="challenge-week">Week {challenge.week}</span>
        <span className="challenge-standard">
          {challenge.standards.join(' · ')}
        </span>
      </header>

      <h2 className="challenge-project">{challenge.project}</h2>

      <div className="challenge-prompt-row">
        <p className="challenge-prompt">{challenge.prompt}</p>
        {canSpeak && (
          <button
            type="button"
            className="btn btn-speak"
            onClick={() => speak(challenge.prompt)}
            aria-label="Read the challenge out loud"
            title="Read it out loud"
          >
            🔊
          </button>
        )}
      </div>

      {/* Predict first */}
      <div className="predict">
        <label className="predict-label" htmlFor="prediction">
          {challenge.predictQuestion}
        </label>
        <input
          id="prediction"
          className="predict-input"
          value={lockedPrediction ?? prediction}
          onChange={(event) => onPredictionChange(event.target.value)}
          placeholder="Your guess"
          inputMode="numeric"
          autoComplete="off"
          readOnly={lockedPrediction !== null}
        />
        {showResult && (
          <p className={`predict-compare ${predictionRight ? 'is-right' : ''}`}>
            <span>
              You guessed <strong>{guessed || '—'}</strong>
            </span>
            <span aria-hidden="true">→</span>
            <span>
              It was <strong>{actual}</strong>
            </span>
            {predictionRight && <span className="predict-tick">Spot on!</span>}
          </p>
        )}
      </div>

      {/* Marking */}
      {showResult && (
        <div className={`marking ${result.passed ? 'is-passed' : ''}`}>
          {result.passed ? (
            <p className="marking-headline">
              <span aria-hidden="true">⭐</span> Challenge complete!
            </p>
          ) : (
            <p className="marking-headline">Nearly there — check these:</p>
          )}
          <ul className="marking-list">
            {result.results.map((rule) => (
              <li
                key={rule.label}
                className={rule.passed ? 'rule is-passed' : 'rule'}
              >
                <span className="rule-mark" aria-hidden="true">
                  {rule.passed ? '✓' : '○'}
                </span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stars > 0 && (
        <p className="stars" aria-label={`${stars} stars earned`}>
          {'⭐'.repeat(Math.min(stars, 5))}
          {stars > 5 && <span className="stars-count"> ×{stars}</span>}
        </p>
      )}
    </section>
  );
}
