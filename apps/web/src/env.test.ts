import { describe, expect, it, vi } from 'vitest';
import { readEnv } from './env';

describe('readEnv', () => {
  it('defaults to the mock backend when Supabase is not configured', () => {
    expect(readEnv({}).backend).toBe('mock');
  });

  it('uses Supabase when a URL and key are present', () => {
    const env = readEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co/',
      VITE_SUPABASE_ANON_KEY: 'key',
    });
    expect(env).toMatchObject({ backend: 'supabase', supabaseUrl: 'https://abc.supabase.co' });
  });

  it('honours an explicit VITE_BACKEND=mock even with keys', () => {
    expect(
      readEnv({
        VITE_BACKEND: 'mock',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'key',
      }).backend,
    ).toBe('mock');
  });

  it('falls back to mock (with a warning) when supabase is requested without keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readEnv({ VITE_BACKEND: 'supabase' }).backend).toBe('mock');
    expect(warn).toHaveBeenCalled();
  });

  it('reads demo credentials and mock latency with safe defaults', () => {
    expect(readEnv({})).toMatchObject({
      demoEmail: 'demo@codesnip.dev',
      demoPassword: 'codesnip-demo',
      mockLatencyMs: 150,
    });
    expect(readEnv({ VITE_MOCK_LATENCY_MS: '0' }).mockLatencyMs).toBe(0);
    expect(readEnv({ VITE_MOCK_LATENCY_MS: 'abc' }).mockLatencyMs).toBe(150);
  });
});
