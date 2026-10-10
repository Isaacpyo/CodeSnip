import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import { useBackend } from '../backend/context';
import type { Scope, SearchParams, Snippet, SnippetInput } from '../backend/types';

export const PAGE_SIZE = 24;

export const queryKeys = {
  snippets: ['snippets'] as const,
  search: (params: Omit<SearchParams, 'offset'>) => ['snippets', 'search', params] as const,
  facets: (scope: Scope) => ['snippets', 'facets', scope] as const,
  detail: (id: string) => ['snippets', 'detail', id] as const,
  profile: (userId: string | undefined) => ['profile', userId] as const,
  capabilities: ['auth', 'capabilities'] as const,
};

export function useSnippetSearch(
  params: Omit<SearchParams, 'offset' | 'pageSize'>,
  enabled = true,
) {
  const backend = useBackend();
  const full = { ...params, pageSize: PAGE_SIZE };
  return useInfiniteQuery({
    queryKey: queryKeys.search(full),
    queryFn: ({ pageParam }) => backend.snippets.search({ ...full, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useFacets(scope: Scope, enabled = true) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.facets(scope),
    queryFn: () => backend.snippets.facets(scope),
    enabled,
  });
}

export function useSnippet(id: string | undefined) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.detail(id ?? ''),
    queryFn: () => backend.snippets.get(id!),
    enabled: Boolean(id),
  });
}

export function useProfile() {
  const backend = useBackend();
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile(user?.id),
    queryFn: () => backend.auth.getProfile(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
}

export function useAuthCapabilities() {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: () => backend.auth.capabilities(),
    staleTime: Infinity,
  });
}

/** After any write, refresh lists and facets; keep the detail cache in sync. */
function useSnippetCacheSync() {
  const queryClient = useQueryClient();
  return (snippet?: Snippet, removedId?: string) => {
    if (snippet) queryClient.setQueryData(queryKeys.detail(snippet.id), snippet);
    if (removedId) queryClient.removeQueries({ queryKey: queryKeys.detail(removedId) });
    void queryClient.invalidateQueries({ queryKey: ['snippets', 'search'] });
    void queryClient.invalidateQueries({ queryKey: ['snippets', 'facets'] });
  };
}

export function useCreateSnippet() {
  const backend = useBackend();
  const sync = useSnippetCacheSync();
  return useMutation({
    mutationFn: (input: SnippetInput) => backend.snippets.create(input),
    onSuccess: (snippet) => sync(snippet),
  });
}

export function useUpdateSnippet() {
  const backend = useBackend();
  const sync = useSnippetCacheSync();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SnippetInput> }) =>
      backend.snippets.update(id, patch),
    onSuccess: (snippet) => sync(snippet),
  });
}

export function useDeleteSnippet() {
  const backend = useBackend();
  const sync = useSnippetCacheSync();
  return useMutation({
    mutationFn: (id: string) => backend.snippets.remove(id),
    onSuccess: (_void, id) => sync(undefined, id),
  });
}

export function useImportSnippets() {
  const backend = useBackend();
  const sync = useSnippetCacheSync();
  return useMutation({
    mutationFn: (inputs: SnippetInput[]) => backend.snippets.importMany(inputs),
    onSuccess: () => sync(),
  });
}
