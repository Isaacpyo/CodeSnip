import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createMemoryBackend } from '../backend/memory';
import type { Backend } from '../backend/types';
import { createWakeTracker } from '../lib/wakeTracker';
import { AppProviders } from '../providers';
import { createQueryClient } from '../queryClient';
import { routes } from '../routes';

/** Renders the real app (all routes and providers) on the mock backend. */
export function renderApp(path = '/', backend: Backend = createMemoryBackend({ storage: null })) {
  const tracker = createWakeTracker();
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <AppProviders backend={{ backend, tracker }} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, user, router, backend, tracker };
}
