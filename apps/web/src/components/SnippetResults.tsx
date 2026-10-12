import { Box, Button, HStack, SimpleGrid, Spinner, Text, VisuallyHidden } from '@chakra-ui/react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SearchPage, SnippetSummary } from '../backend/types';
import { pluralize } from '../lib/format';
import { CardGridSkeleton, ErrorView } from './StateViews';

interface SnippetResultsProps {
  query: UseInfiniteQueryResult<InfiniteData<SearchPage>>;
  renderCard: (snippet: SnippetSummary) => ReactNode;
  /** Shown when there are no results. */
  empty: ReactNode;
}

/** Loading / error / empty / list + "load more", shared by Library and Explore. */
export function SnippetResults({ query, renderCard, empty }: SnippetResultsProps) {
  if (query.isPending) return <CardGridSkeleton />;
  if (query.isError && !query.data)
    return (
      <ErrorView
        error={query.error}
        title="Couldn’t load snippets"
        onRetry={() => void query.refetch()}
      />
    );

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;

  return (
    <Box>
      <HStack justify="space-between" mb="3" minHeight="6">
        <Text fontSize="sm" color="fg.muted" aria-live="polite" data-testid="result-count">
          {pluralize(total, 'snippet')}
        </Text>
        {query.isFetching && !query.isFetchingNextPage && (
          <HStack gap="2" color="fg.muted" fontSize="sm">
            <Spinner size="xs" />
            <VisuallyHidden>Updating results</VisuallyHidden>
          </HStack>
        )}
      </HStack>

      {items.length === 0 ? (
        empty
      ) : (
        <SimpleGrid
          columns={{ base: 1, md: 2, xl: 3 }}
          gap="4"
          opacity={query.isPlaceholderData ? 0.6 : 1}
        >
          {items.map((snippet) => (
            <Box key={snippet.id}>{renderCard(snippet)}</Box>
          ))}
        </SimpleGrid>
      )}

      {query.isError && query.data && (
        <Box mt="4">
          <ErrorView
            error={query.error}
            title="Couldn’t load more"
            onRetry={() => void query.fetchNextPage()}
          />
        </Box>
      )}

      {query.hasNextPage && (
        <HStack justify="center" mt="6">
          <Button
            variant="outline"
            onClick={() => void query.fetchNextPage()}
            loading={query.isFetchingNextPage}
            loadingText="Loading…"
          >
            Load more ({items.length} of {total})
          </Button>
        </HStack>
      )}
    </Box>
  );
}
