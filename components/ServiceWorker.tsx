'use client';

/**
 * Registers the service worker.
 *
 * Registration waits for `load` so it never competes with the first paint of
 * the editor, which is the slow bit on a school Chromebook.
 */

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // A worker registered from a dev server caches half-built assets and then
    // serves them after a code change, which looks like a haunted app.
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unavailable worker costs offline support, nothing else.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
