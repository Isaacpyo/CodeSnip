/**
 * Tracks in-flight backend requests and reports when one is slow. Free-tier
 * backends (paused Supabase projects, cold starts) can take seconds to answer
 * the first request; the UI shows a "waking the server" banner instead of a
 * page that looks frozen.
 */
export type WakeState = 'idle' | 'slow' | 'very-slow';

export interface WakeTrackerOptions {
  slowAfterMs?: number;
  verySlowAfterMs?: number;
}

export interface WakeTracker {
  /** Wrap any promise so its duration counts toward the wake state. */
  track<T>(promise: Promise<T>): Promise<T>;
  /** A fetch implementation that tracks every request. */
  wrapFetch(fetchImpl: typeof fetch): typeof fetch;
  getState(): WakeState;
  subscribe(listener: (state: WakeState) => void): () => void;
}

export function createWakeTracker({
  slowAfterMs = 2500,
  verySlowAfterMs = 15000,
}: WakeTrackerOptions = {}): WakeTracker {
  const pending = new Map<number, number>(); // id -> start time
  const listeners = new Set<(state: WakeState) => void>();
  let nextId = 0;
  let state: WakeState = 'idle';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setState = (next: WakeState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  // Recompute from the oldest pending request and schedule the next change.
  const evaluate = () => {
    clearTimeout(timer);
    timer = undefined;
    if (pending.size === 0) return setState('idle');
    const oldest = Math.min(...pending.values());
    const age = Date.now() - oldest;
    if (age >= verySlowAfterMs) return setState('very-slow');
    if (age >= slowAfterMs) {
      setState('slow');
      timer = setTimeout(evaluate, verySlowAfterMs - age);
      return;
    }
    setState('idle');
    timer = setTimeout(evaluate, slowAfterMs - age);
  };

  const track = <T>(promise: Promise<T>): Promise<T> => {
    const id = nextId++;
    pending.set(id, Date.now());
    evaluate();
    return promise.finally(() => {
      pending.delete(id);
      evaluate();
    });
  };

  return {
    track,
    wrapFetch: (fetchImpl) => (input, init) => track(fetchImpl(input, init)),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
