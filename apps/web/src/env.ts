/**
 * Runtime configuration from Vite env vars (see .env.example).
 *
 * VITE_BACKEND=supabase  real Supabase (needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
 * VITE_BACKEND=mock      in-browser mock backend, no keys needed
 * unset                  supabase when a URL is configured, otherwise mock
 */
export type BackendKind = 'supabase' | 'mock';

export interface AppEnv {
  backend: BackendKind;
  supabaseUrl: string;
  supabaseAnonKey: string;
  demoEmail: string;
  demoPassword: string;
  mockLatencyMs: number;
}

type RawEnv = Partial<Record<string, string | boolean | undefined>>;

export function readEnv(raw: RawEnv = import.meta.env): AppEnv {
  const str = (key: string) => {
    const value = raw[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const supabaseUrl = str('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const supabaseAnonKey = str('VITE_SUPABASE_ANON_KEY');
  const requested = str('VITE_BACKEND');

  let backend: BackendKind;
  if (requested === 'mock' || requested === 'supabase') backend = requested;
  else backend = supabaseUrl && supabaseAnonKey ? 'supabase' : 'mock';

  if (backend === 'supabase' && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn(
      'VITE_BACKEND=supabase but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing; using the mock backend.',
    );
    backend = 'mock';
  }

  const latency = Number.parseInt(str('VITE_MOCK_LATENCY_MS'), 10);
  return {
    backend,
    supabaseUrl,
    supabaseAnonKey,
    demoEmail: str('VITE_DEMO_EMAIL') || 'demo@codesnip.dev',
    demoPassword: str('VITE_DEMO_PASSWORD') || 'codesnip-demo',
    mockLatencyMs: Number.isFinite(latency) && latency >= 0 ? latency : 150,
  };
}
