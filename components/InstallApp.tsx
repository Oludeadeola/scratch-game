'use client';

/**
 * "Add to home screen".
 *
 * Two different worlds here. Chrome, Edge and Android fire
 * `beforeinstallprompt`, which we capture and replay when the user taps our own
 * button. Safari on iPad and iPhone fires nothing at all and has no API, so the
 * only honest thing to do is show the child where the buttons are.
 *
 * Both paths end with the app on the home screen, opening without browser
 * chrome. It is still the same web app — nothing is downloaded from a store.
 */

import { useCallback, useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'mathblocks:install-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS reports it here instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so the touch check is what catches it.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export default function InstallApp() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Storage unavailable; just show the button.
    }
    setEligible(true);

    const onPrompt = (event: Event) => {
      // Stop the browser's own mini-infobar so our button is the only ask.
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setEligible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setEligible(false);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Then it comes back next time, which is acceptable.
    }
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') dismiss();
      setDeferred(null);
      return;
    }
    // Safari: no API, so show the steps.
    setShowIosHelp(true);
  }, [deferred, dismiss]);

  // Nothing to offer on a desktop browser that will not install it.
  if (!eligible || (!deferred && !isIos())) return null;

  return (
    <div className="install">
      <button type="button" className="btn btn-install" onClick={install}>
        <span aria-hidden="true">📲</span> Add to home screen
      </button>
      <button
        type="button"
        className="install-dismiss"
        onClick={dismiss}
        aria-label="Not now"
      >
        Not now
      </button>

      {showIosHelp && (
        <div
          className="install-help"
          role="dialog"
          aria-label="How to add MathBlocks to your home screen"
        >
          <p className="install-help-title">Two taps to add it</p>
          <ol className="install-help-steps">
            <li>
              Tap <strong>Share</strong> <span aria-hidden="true">⬆️</span> at the
              bottom of Safari
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </li>
          </ol>
          <button type="button" className="btn btn-ghost" onClick={() => setShowIosHelp(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
