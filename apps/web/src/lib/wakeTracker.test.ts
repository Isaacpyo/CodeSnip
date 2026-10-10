import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWakeTracker, type WakeState } from './wakeTracker';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('wake tracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays idle for fast requests', async () => {
    const tracker = createWakeTracker({ slowAfterMs: 1000 });
    const states: WakeState[] = [];
    tracker.subscribe((s) => states.push(s));
    const req = deferred();
    const tracked = tracker.track(req.promise);
    await vi.advanceTimersByTimeAsync(500);
    req.resolve();
    await tracked;
    await vi.advanceTimersByTimeAsync(5000);
    expect(states).toEqual([]);
    expect(tracker.getState()).toBe('idle');
  });

  it('goes slow, then very slow, then back to idle when the request settles', async () => {
    const tracker = createWakeTracker({ slowAfterMs: 1000, verySlowAfterMs: 5000 });
    const states: WakeState[] = [];
    tracker.subscribe((s) => states.push(s));
    const req = deferred();
    const tracked = tracker.track(req.promise);

    await vi.advanceTimersByTimeAsync(1000);
    expect(tracker.getState()).toBe('slow');
    await vi.advanceTimersByTimeAsync(4000);
    expect(tracker.getState()).toBe('very-slow');

    req.reject(new Error('boom'));
    await expect(tracked).rejects.toThrow('boom');
    expect(states).toEqual(['slow', 'very-slow', 'idle']);
  });

  it('stays slow while any request is still pending', async () => {
    const tracker = createWakeTracker({ slowAfterMs: 1000 });
    const first = deferred();
    const second = deferred();
    const a = tracker.track(first.promise);
    await vi.advanceTimersByTimeAsync(800);
    const b = tracker.track(second.promise);
    await vi.advanceTimersByTimeAsync(300);
    expect(tracker.getState()).toBe('slow');
    first.resolve();
    await a;
    // second is only 300ms old: no longer slow
    expect(tracker.getState()).toBe('idle');
    await vi.advanceTimersByTimeAsync(700);
    expect(tracker.getState()).toBe('slow');
    second.resolve();
    await b;
    expect(tracker.getState()).toBe('idle');
  });

  it('wraps fetch', async () => {
    const tracker = createWakeTracker({ slowAfterMs: 1000 });
    const res = deferred<Response>();
    const fetchImpl = vi.fn(() => res.promise);
    const wrapped = tracker.wrapFetch(fetchImpl as unknown as typeof fetch);
    const call = wrapped('https://example.test');
    await vi.advanceTimersByTimeAsync(1000);
    expect(tracker.getState()).toBe('slow');
    res.resolve(new Response('ok'));
    await call;
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test', undefined);
    expect(tracker.getState()).toBe('idle');
  });

  it('unsubscribes', async () => {
    const tracker = createWakeTracker({ slowAfterMs: 10 });
    const listener = vi.fn();
    const off = tracker.subscribe(listener);
    off();
    const req = deferred();
    void tracker.track(req.promise);
    await vi.advanceTimersByTimeAsync(20);
    expect(listener).not.toHaveBeenCalled();
    req.resolve();
  });
});
