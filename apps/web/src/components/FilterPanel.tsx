import { Box, Button, Heading, HStack, Skeleton, Stack, Tag, Text, Wrap } from '@chakra-ui/react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Facets } from '../backend/types';
import type { SearchFilters } from '../hooks/useSearchFilters';
import { languageLabel } from '../lib/languages';

interface FilterPanelProps {
  facets: UseQueryResult<Facets>;
  filters: SearchFilters;
  onLanguage: (language: string | null) => void;
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  active: boolean;
}

const MAX_TAGS_SHOWN = 30;

export function FilterPanel({
  facets,
  filters,
  onLanguage,
  onToggleTag,
  onClear,
  active,
}: FilterPanelProps) {
  return (
    <Stack gap="6" as="nav" aria-label="Filters">
      <HStack justify="space-between">
        <Heading as="h2" size="sm">
          Filters
        </Heading>
        <Button size="xs" variant="ghost" onClick={onClear} disabled={!active}>
          Clear all
        </Button>
      </HStack>

      <Box>
        <Text
          as="h3"
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          color="fg.muted"
          mb="2"
        >
          Language
        </Text>
        {facets.isPending ? (
          <Stack gap="2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height="6" />
            ))}
          </Stack>
        ) : facets.isError ? (
          <Text fontSize="sm" color="fg.error">
            Couldn’t load filters.
          </Text>
        ) : facets.data.languages.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No languages yet.
          </Text>
        ) : (
          <Stack gap="0.5" role="radiogroup" aria-label="Language">
            {[
              { value: '', count: facets.data.languages.reduce((s, l) => s + l.count, 0) },
              ...facets.data.languages,
            ].map(({ value, count }) => {
              const selected = (filters.language ?? '') === value;
              return (
                <Button
                  key={value || 'all'}
                  role="radio"
                  aria-checked={selected}
                  size="sm"
                  variant={selected ? 'subtle' : 'ghost'}
                  colorPalette={selected ? 'teal' : 'gray'}
                  justifyContent="space-between"
                  fontWeight={selected ? 'semibold' : 'normal'}
                  onClick={() => onLanguage(value || null)}
                >
                  <span>{value ? languageLabel(value) : 'All languages'}</span>
                  <Text as="span" color="fg.muted" fontSize="xs">
                    {count}
                  </Text>
                </Button>
              );
            })}
          </Stack>
        )}
      </Box>

      <Box>
        <Text
          as="h3"
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          color="fg.muted"
          mb="2"
        >
          Tags
        </Text>
        {facets.isPending ? (
          <Skeleton height="16" />
        ) : facets.isError ? null : facets.data.tags.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No tags yet.
          </Text>
        ) : (
          <Wrap gap="1.5">
            {facets.data.tags.slice(0, MAX_TAGS_SHOWN).map(({ value, count }) => {
              const selected = filters.tags.includes(value);
              return (
                <Tag.Root
                  key={value}
                  asChild
                  size="md"
                  variant={selected ? 'solid' : 'surface'}
                  colorPalette="teal"
                  cursor="pointer"
                >
                  <button type="button" aria-pressed={selected} onClick={() => onToggleTag(value)}>
                    <Tag.Label>
                      #{value}{' '}
                      <Text as="span" opacity={0.7}>
                        {count}
                      </Text>
                    </Tag.Label>
                  </button>
                </Tag.Root>
              );
            })}
          </Wrap>
        )}
      </Box>
    </Stack>
  );
}
