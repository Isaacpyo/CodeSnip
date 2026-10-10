import { QueryClient } from '@tanstack/react-query';
import { BackendError } from './backend/errors';

const RETRYABLE = new Set(['network', 'unknown']);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry transient failures only; "not found" or "forbidden" won't fix themselves.
        retry: (failureCount, error) =>
          failureCount < 2 && (!(error instanceof BackendError) || RETRYABLE.has(error.code)),
      },
      mutations: { retry: false },
    },
  });
}
