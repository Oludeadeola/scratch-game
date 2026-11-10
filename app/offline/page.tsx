/**
 * Shown when the app is opened with no connection and the requested page was
 * never cached. Deliberately calm: work is not lost, it is on the device.
 */

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="report">
      <div className="report-card">
        <h1 className="report-title">You are offline</h1>
        <p className="report-empty">
          Your project is safe on this device. Open a lesson and keep building —
          everything you do will reach your teacher as soon as you are back
          online.
        </p>
        <Link className="btn btn-primary btn-big" href="/">
          Go to lessons
        </Link>
      </div>
    </main>
  );
}
