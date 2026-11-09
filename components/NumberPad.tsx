'use client';

/**
 * The big number pad.
 *
 * Tapping any number on a block opens this instead of a text cursor. Keys are
 * large touch targets so a 7-year-old can hit them on an iPad, and the value is
 * clamped to the block's own range so a child cannot put 900 into "turn".
 */

import { useEffect, useState } from 'react';
import type { NumberPadRequest } from '@/lib/blocks';

export interface NumberPadProps {
  request: NumberPadRequest | null;
  onClose: () => void;
}

export default function NumberPad({ request, onClose }: NumberPadProps) {
  const [draft, setDraft] = useState('0');

  useEffect(() => {
    if (request) setDraft(String(request.initial));
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      // The pad is the point, but a teacher on a laptop should not be forced
      // to use the mouse.
      if (event.key === 'Escape') cancel();
      else if (event.key === 'Enter') confirm();
      else if (event.key === 'Backspace') setDraft((d) => d.slice(0, -1) || '0');
      else if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === '-') toggleSign();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, draft]);

  if (!request) return null;

  const { min, max } = request;
  const allowNegative = min < 0;
  const value = Number(draft);
  const valid = Number.isFinite(value) && value >= min && value <= max;

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
      </div>
    </div>
  );
}
