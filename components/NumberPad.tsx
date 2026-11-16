'use client';

/**
 * The number pad.
 *
 * Tapping any number on a block opens this instead of a text cursor. It comes
 * in two shapes, because "choose a number" means something different at four
 * and at eleven:
 *
 *   Small range (10 or less)  — every number laid out as its own button. A
 *                               four-year-old picks 3 by pressing 3, with no
 *                               concept of digits, no backspace, no mistakes.
 *   Larger range              — a keypad, entered digit by digit.
 *
 * The ceiling comes from the child's age, intersected with the block's own
 * range. The block's range is the same on every client; the age cap only
 * narrows what *this* child can choose, so a teacher setting 15 on a
 * five-year-old's script still arrives intact.
 */

import { useEffect, useMemo, useState } from 'react';
import type { NumberPadRequest } from '@/lib/blocks';

/** At or below this many options, show the numbers themselves. */
const GRID_LIMIT = 10;

export interface NumberPadProps {
  request: NumberPadRequest | null;
  /** The largest number this child's age allows. */
  ageMax: number;
  onClose: () => void;
}

export default function NumberPad({ request, ageMax, onClose }: NumberPadProps) {
  const [draft, setDraft] = useState('0');

  useEffect(() => {
    if (request) setDraft(String(request.initial));
  }, [request]);

  const bounds = useMemo(() => {
    if (!request) return { min: 0, max: 0 };
    return {
      min: request.min,
      // Never widen the block's own range, only narrow it.
      max: Math.min(request.max, ageMax),
    };
  }, [request, ageMax]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
      else if (event.key === 'Enter') confirm();
      else if (event.key === 'Backspace') setDraft((d) => d.slice(0, -1) || '0');
      else if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === '-') toggleSign();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, draft, bounds.min, bounds.max]);

  if (!request) return null;

  const { min, max } = bounds;
  const allowNegative = min < 0;
  const value = Number(draft);
  const valid = Number.isFinite(value) && value >= min && value <= max;
  // A short, all-positive range is picked rather than typed.
  const useGrid = min >= 0 && max <= GRID_LIMIT;

  function press(digit: string) {
    setDraft((current) => {
      const negative = current.startsWith('-');
      const digits = (negative ? current.slice(1) : current).replace(/^0$/, '');
      const next = digits + digit;
      if (next.length > 4) return current;
      return (negative ? '-' : '') + next;
    });
  }

  function backspace() {
    setDraft((current) => {
      const next = current.slice(0, -1);
      return next === '' || next === '-' ? '0' : next;
    });
  }

  function toggleSign() {
    if (!allowNegative) return;
    setDraft((current) =>
      current.startsWith('-') ? current.slice(1) : '-' + current,
    );
  }

  function choose(picked: number) {
    request?.resolve(picked);
    onClose();
  }

  function confirm() {
    if (!valid) return;
    request?.resolve(value);
    onClose();
  }

  function cancel() {
    request?.resolve(null);
    onClose();
  }

  return (
    <div className="pad-backdrop" onClick={cancel} role="presentation">
      <div
        className="pad"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a number"
      >
        {useGrid ? (
          <>
            <p className="pad-ask">How many?</p>
            <div className="pad-grid">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`pad-choice ${option === request.initial ? 'is-on' : ''}`}
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="pad-actions">
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pad-readout" aria-live="polite">
              {draft}
            </div>
            <p className="pad-range">
              {allowNegative ? `${min} to ${max}` : `0 to ${max}`}
            </p>

            <div className="pad-keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="pad-key"
                  onClick={() => press(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className="pad-key pad-key-soft"
                onClick={toggleSign}
                disabled={!allowNegative}
                aria-label="Plus or minus"
              >
                ±
              </button>
              <button type="button" className="pad-key" onClick={() => press('0')}>
                0
              </button>
              <button
                type="button"
                className="pad-key pad-key-soft"
                onClick={backspace}
                aria-label="Delete the last digit"
              >
                ⌫
              </button>
            </div>

            <div className="pad-actions">
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirm}
                disabled={!valid}
              >
                {valid ? 'OK' : `Pick ${min}–${max}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
