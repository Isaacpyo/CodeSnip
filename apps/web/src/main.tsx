import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createBackend } from './backend';
import { readEnv } from './env';
import { createWakeTracker } from './lib/wakeTracker';
import { AppProviders } from './providers';
import { createQueryClient } from './queryClient';
import { routes } from './routes';

const env = readEnv();
const tracker = createWakeTracker();
const backend = createBackend(env, tracker);
const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders backend={{ backend, tracker }} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
