export type BackendErrorCode =
  'auth' | 'forbidden' | 'invalid' | 'network' | 'not_found' | 'quota' | 'unknown';

/** A failure the UI can explain. `message` is safe to show to users. */
export class BackendError extends Error {
  readonly code: BackendErrorCode;

  constructor(code: BackendErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackendError';
    this.code = code;
  }
}

const FRIENDLY: Record<BackendErrorCode, string> = {
  auth: 'Please sign in again.',
  forbidden: 'You don’t have permission to do that.',
  invalid: 'Some of the values aren’t valid.',
  network: 'Can’t reach the server. Check your connection and try again.',
  not_found: 'That snippet doesn’t exist or isn’t shared with you.',
  quota: 'You’ve reached the snippet limit for your account.',
  unknown: 'Something went wrong. Please try again.',
};

export function friendlyMessage(error: unknown): string {
  const backendError = toBackendError(error);
  return backendError.message || FRIENDLY[backendError.code];
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** Maps PostgREST / Postgres error codes to BackendError. */
export function fromPostgrestError(error: PostgrestLikeError): BackendError {
  const code = error.code ?? '';
  const message = error.message ?? '';
  if (code === 'PGRST116')
    return new BackendError('not_found', FRIENDLY.not_found, { cause: error });
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST302') {
    return new BackendError('forbidden', FRIENDLY.forbidden, { cause: error });
  }
  if (code === '54000')
    return new BackendError('quota', message || FRIENDLY.quota, { cause: error });
  if (code === '22P02') return new BackendError('not_found', FRIENDLY.not_found, { cause: error });
  if (code === '23503')
    return new BackendError('invalid', 'That language isn’t supported.', { cause: error });
  if (code.startsWith('22') || code.startsWith('23')) {
    return new BackendError('invalid', FRIENDLY.invalid, { cause: error });
  }
  if (isNetworkMessage(message))
    return new BackendError('network', FRIENDLY.network, { cause: error });
  return new BackendError('unknown', FRIENDLY.unknown, { cause: error });
}

function isNetworkMessage(message: string): boolean {
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(
    message,
  );
}

/** Normalises anything thrown by a backend call. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof TypeError && isNetworkMessage(error.message)) {
    return new BackendError('network', FRIENDLY.network, { cause: error });
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return fromPostgrestError(error as PostgrestLikeError);
  }
  if (error instanceof Error && isNetworkMessage(error.message)) {
    return new BackendError('network', FRIENDLY.network, { cause: error });
  }
  return new BackendError('unknown', FRIENDLY.unknown, { cause: error });
}
