import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { normalizeTags } from '../lib/tags';

export interface SearchFilters {
  q: string;
  tags: string[];
  language: string | null;
}

/** Search text and filters live in the URL so they survive reloads and can be shared. */
export function useSearchFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<SearchFilters>(
    () => ({
      q: params.get('q') ?? '',
      tags: normalizeTags((params.get('tags') ?? '').split(',')),
      language: params.get('lang') || null,
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<SearchFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const set = (key: string, value: string) =>
            value ? next.set(key, value) : next.delete(key);
          if (patch.q !== undefined) set('q', patch.q);
          if (patch.tags !== undefined) set('tags', normalizeTags(patch.tags).join(','));
          if (patch.language !== undefined) set('lang', patch.language ?? '');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const toggleTag = useCallback(
    (tag: string) =>
      update({
        tags: filters.tags.includes(tag)
          ? filters.tags.filter((t) => t !== tag)
          : [...filters.tags, tag],
      }),
    [filters.tags, update],
  );

  const clear = useCallback(() => update({ q: '', tags: [], language: null }), [update]);
  const active = Boolean(filters.q || filters.tags.length || filters.language);

  return { filters, update, toggleTag, clear, active };
}
