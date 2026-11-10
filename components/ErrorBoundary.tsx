'use client';

/**
 * Catches a render crash in the editor.
 *
 * A thrown error inside React unmounts the whole tree, which mid-lesson means a
 * 7-year-old staring at a white screen while her teacher watches. The project
 * itself is safe in IndexedDB either way, so the only job here is to say so
 * plainly and offer the one button that fixes it.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // No telemetry service yet, and none should be added without thinking
    // about what a children's product is allowed to report.
    console.error('[mathblocks] editor crashed', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="report">
        <div className="report-card">
          <h1 className="report-title">Something went wrong</h1>
          <p className="report-empty">
            Your blocks are saved. Reloading will bring the project straight
            back.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => window.location.reload()}
          >
            Reload the lesson
          </button>
          <p className="report-note">{error.message}</p>
        </div>
      </main>
    );
  }
}
