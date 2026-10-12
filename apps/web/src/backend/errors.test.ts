import { describe, expect, it } from 'vitest';
import { BackendError, friendlyMessage, fromPostgrestError, toBackendError } from './errors';

describe('error mapping', () => {
  it.each([
    ['PGRST116', 'not_found'],
    ['42501', 'forbidden'],
    ['54000', 'quota'],
    ['23514', 'invalid'],
    ['23503', 'invalid'],
    ['22P02', 'not_found'],
    ['XX000', 'unknown'],
  ] as const)('maps Postgres/PostgREST code %s to %s', (code, expected) => {
    expect(fromPostgrestError({ code, message: 'x' }).code).toBe(expected);
  });

  it('keeps the quota message from the database', () => {
    expect(fromPostgrestError({ code: '54000', message: 'Snippet limit reached' }).message).toBe(
      'Snippet limit reached',
    );
  });

  it('recognises network failures', () => {
    expect(toBackendError(new TypeError('Failed to fetch')).code).toBe('network');
    expect(
      toBackendError({
        code: '',
        message: 'TypeError: NetworkError when attempting to fetch resource.',
      }).code,
    ).toBe('network');
  });

  it('passes BackendErrors through and wraps unknown values', () => {
    const original = new BackendError('auth', 'nope');
    expect(toBackendError(original)).toBe(original);
    expect(toBackendError('weird').code).toBe('unknown');
  });

  it('produces user-safe messages', () => {
    expect(friendlyMessage(new BackendError('forbidden', ''))).toMatch(/permission/);
    expect(friendlyMessage(new Error('internal stack details'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
