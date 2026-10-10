import type { AppEnv } from '../env';
import type { WakeTracker } from '../lib/wakeTracker';
import { createMemoryBackend } from './memory';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

export function createBackend(env: AppEnv, tracker: WakeTracker): Backend {
  if (env.backend === 'supabase') {
    return createSupabaseBackend({
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      demoEmail: env.demoEmail,
      demoPassword: env.demoPassword,
      tracker,
    });
  }
  return createMemoryBackend({ latencyMs: env.mockLatencyMs, tracker });
}

export type * from './types';
export { BackendError, friendlyMessage } from './errors';
