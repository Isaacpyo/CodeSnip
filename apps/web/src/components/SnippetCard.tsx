import { Box, Card, HStack, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import type { SnippetSummary } from '../backend/types';
import { timeAgo } from '../lib/format';
import { LanguageBadge, TagList, VisibilityBadge } from './Badges';
import { CopyButton } from './CopyButton';

const PREVIEW_LINES = 6;

interface SnippetCardProps {
  snippet: SnippetSummary;
  href: string;
  showAuthor?: boolean;
  showVisibility?: boolean;
  activeTags?: readonly string[];
  onTagClick?: (tag: string) => void;
  /** Loads the full code for the copy button (the card only has a preview). */
  loadCode: () => Promise<string>;
}

export function SnippetCard({
  snippet,
  href,
  showAuthor = false,
  showVisibility = true,
  activeTags,
  onTagClick,
  loadCode,
}: SnippetCardProps) {
  const preview = snippet.codePreview.split('\n').slice(0, PREVIEW_LINES).join('\n');
  return (
    <LinkBox asChild>
      <Card.Root
        variant="outline"
        size="sm"
        transition="border-color 0.15s, box-shadow 0.15s"
        _hover={{ borderColor: 'teal.muted', shadow: 'sm' }}
        _focusWithin={{ borderColor: 'teal.solid' }}
        height="full"
        data-testid="snippet-card"
      >
        <Card.Body gap="3">
          <HStack justify="space-between" align="flex-start" gap="2">
            <Box minWidth="0">
              <LinkOverlay asChild>
                <RouterLink to={href}>
                  <Text fontWeight="semibold" lineClamp={2} wordBreak="break-word">
                    {snippet.title}
                  </Text>
                </RouterLink>
              </LinkOverlay>
              {showAuthor && snippet.author.name && (
                <Text fontSize="xs" color="fg.muted">
                  by {snippet.author.name}
                </Text>
              )}
            </Box>
            <CopyButton
              text={loadCode}
              iconOnly
              size="xs"
              variant="ghost"
              label={`Copy code of ${snippet.title}`}
              position="relative"
              zIndex="1"
            />
          </HStack>

          {snippet.description && (
            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
              {snippet.description}
            </Text>
          )}

          <Box
            as="pre"
            fontFamily="mono"
            fontSize="xs"
            lineHeight="1.5"
            bg="bg.muted"
            borderRadius="md"
            p="3"
            overflow="hidden"
            whiteSpace="pre"
            maxHeight="9.5em"
            aria-hidden="true"
            css={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent)' }}
          >
            {preview}
          </Box>

          <TagList tags={snippet.tags} onTagClick={onTagClick} activeTags={activeTags} />

          <HStack justify="space-between" mt="auto" gap="2" flexWrap="wrap">
            <HStack gap="1.5">
              <LanguageBadge language={snippet.language} />
              {showVisibility && <VisibilityBadge visibility={snippet.visibility} />}
            </HStack>
            <Text
              fontSize="xs"
              color="fg.muted"
              title={new Date(snippet.updatedAt).toLocaleString()}
            >
              Updated {timeAgo(snippet.updatedAt)}
            </Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    </LinkBox>
  );
}
