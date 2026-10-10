import { createContext, useContext } from 'react';
import type { WakeTracker } from '../lib/wakeTracker';
import type { Backend } from './types';

export interface BackendContextValue {
  backend: Backend;
  tracker: WakeTracker;
}

export const BackendContext = createContext<BackendContextValue | null>(null);

function useBackendContext(): BackendContextValue {
  const value = useContext(BackendContext);
  if (!value) throw new Error('useBackend must be used inside <BackendContext.Provider>');
  return value;
}

export function useBackend(): Backend {
  return useBackendContext().backend;
}

export function useWakeTracker(): WakeTracker {
  return useBackendContext().tracker;
}
