import { Badge, Tag, Wrap } from '@chakra-ui/react';
import { Globe, Lock } from 'lucide-react';
import { languageLabel } from '../lib/languages';
import type { Visibility } from '../backend/types';

export function LanguageBadge({ language }: { language: string }) {
  return (
    <Badge variant="subtle" colorPalette="teal" fontFamily="mono" size="sm">
      {languageLabel(language)}
    </Badge>
  );
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const isPublic = visibility === 'public';
  return (
    <Badge variant="outline" colorPalette={isPublic ? 'green' : 'gray'} size="sm" gap="1">
      {isPublic ? <Globe size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
      {isPublic ? 'Public' : 'Private'}
    </Badge>
  );
}

export function TagList({
  tags,
  onTagClick,
  activeTags = [],
}: {
  tags: readonly string[];
  onTagClick?: (tag: string) => void;
  activeTags?: readonly string[];
}) {
  if (tags.length === 0) return null;
  return (
    <Wrap gap="1.5" aria-label="Tags">
      {tags.map((tag) =>
        onTagClick ? (
          <Tag.Root
            key={tag}
            asChild
            size="sm"
            variant={activeTags.includes(tag) ? 'solid' : 'surface'}
            colorPalette="teal"
            cursor="pointer"
            position="relative"
            zIndex="1"
          >
            <button
              type="button"
              aria-pressed={activeTags.includes(tag)}
              aria-label={`Filter by tag ${tag}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              <Tag.Label>#{tag}</Tag.Label>
            </button>
          </Tag.Root>
        ) : (
          <Tag.Root key={tag} size="sm" variant="surface">
            <Tag.Label>#{tag}</Tag.Label>
          </Tag.Root>
        ),
      )}
    </Wrap>
  );
}
