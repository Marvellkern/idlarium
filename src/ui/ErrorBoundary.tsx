import { Component, type ReactNode } from "react";

/** Keeps one broken panel from taking the whole game down. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="pointer-events-auto fixed inset-x-0 top-1/3 z-50 flex justify-center px-4">
        <div className="glass-strong max-w-sm p-4 text-center">
          <p className="font-extrabold">Something got tangled in the reeds.</p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Your progress is safe.</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-xl bg-ink px-4 font-extrabold text-white"
            onClick={() => {
              this.props.onReset?.();
              this.setState({ error: null });
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
