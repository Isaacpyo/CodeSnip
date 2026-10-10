import { Badge, Box, Button, CloseButton, Drawer, Grid, HStack, Portal } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useBackend } from '../backend/context';
import { BackendError } from '../backend/errors';
import type { Scope, SnippetSummary } from '../backend/types';
import { queryKeys, useFacets, useSnippetSearch } from '../hooks/queries';
import { useSearchFilters } from '../hooks/useSearchFilters';
import { FilterPanel } from './FilterPanel';
import { SearchBar } from './SearchBar';
import { SnippetCard } from './SnippetCard';
import { SnippetResults } from './SnippetResults';

interface SnippetBrowserProps {
  scope: Scope;
  hrefFor: (snippet: SnippetSummary) => string;
  /** Rendered when nothing matches. `filtered` is true when search/filters are active. */
  renderEmpty: (filtered: boolean, clear: () => void) => ReactNode;
  searchPlaceholder?: string;
}

/** Search box + filter sidebar (drawer on mobile) + result grid, driven by URL params. */
export function SnippetBrowser({
  scope,
  hrefFor,
  renderEmpty,
  searchPlaceholder,
}: SnippetBrowserProps) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const { filters, update, toggleTag, clear, active } = useSearchFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = useSnippetSearch({
    scope,
    search: filters.q,
    tags: filters.tags,
    language: filters.language,
  });
  const facets = useFacets(scope);
  const activeCount = filters.tags.length + (filters.language ? 1 : 0);

  const loadCode = (id: string) => async () => {
    const snippet = await queryClient.fetchQuery({
      queryKey: queryKeys.detail(id),
      queryFn: () => backend.snippets.get(id),
    });
    if (!snippet) throw new BackendError('not_found', 'That snippet no longer exists.');
    return snippet.code;
  };

  const panel = (
    <FilterPanel
      facets={facets}
      filters={filters}
      onLanguage={(language) => update({ language })}
      onToggleTag={toggleTag}
      onClear={clear}
      active={active}
    />
  );

  return (
    <Box>
      <HStack gap="2" mb="6">
        <Box flex="1">
          <SearchBar
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder={searchPlaceholder}
          />
        </Box>
        <Button
          variant="outline"
          hideFrom="lg"
          onClick={() => setDrawerOpen(true)}
          aria-label="Show filters"
        >
          <SlidersHorizontal />
          Filters
          {activeCount > 0 && (
            <Badge colorPalette="teal" variant="solid" size="sm">
              {activeCount}
            </Badge>
          )}
        </Button>
      </HStack>

      <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: '240px minmax(0, 1fr)' }} gap="8">
        <Box hideBelow="lg">{panel}</Box>
        <SnippetResults
          query={search}
          empty={renderEmpty(active, clear)}
          renderCard={(snippet) => (
            <SnippetCard
              snippet={snippet}
              href={hrefFor(snippet)}
              showAuthor={scope === 'public'}
              showVisibility={scope === 'mine'}
              activeTags={filters.tags}
              onTagClick={toggleTag}
              loadCode={loadCode(snippet.id)}
            />
          )}
        />
      </Grid>

      <Drawer.Root open={drawerOpen} onOpenChange={(e) => setDrawerOpen(e.open)} placement="start">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Filters</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>{panel}</Drawer.Body>
              <Drawer.Footer>
                <Button colorPalette="teal" width="full" onClick={() => setDrawerOpen(false)}>
                  Show results
                </Button>
              </Drawer.Footer>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" aria-label="Close filters" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Box>
  );
}
