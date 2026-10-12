import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('WakeBanner', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('appears while a request is slow and disappears when it completes', async () => {
    const { tracker } = renderApp('/explore');
    let finish!: () => void;
    act(() => {
      void tracker.track(new Promise<void>((resolve) => (finish = resolve)));
    });
    expect(screen.queryByTestId('wake-banner')).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2600));
    expect(screen.getByTestId('wake-banner')).toHaveTextContent('Waking up the server');

    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(screen.getByTestId('wake-banner')).toHaveTextContent('Still waking up');

    await act(async () => finish());
    expect(screen.queryByTestId('wake-banner')).not.toBeInTheDocument();
  });
});
