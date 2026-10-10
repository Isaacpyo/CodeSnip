import {
  Avatar,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react';
import { GitFork, LogIn, Pencil } from 'lucide-react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/context';
import { LanguageBadge, TagList, VisibilityBadge } from '../components/Badges';
import { CopyButton } from '../components/CopyButton';
import { LazyCodeEditor } from '../components/LazyCodeEditor';
import { ErrorView } from '../components/StateViews';
import { useCreateSnippet, useSnippet } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate, shareUrl } from '../lib/format';
import { isUuid } from '../lib/validation';
import { notify } from '../ui/notify';
import { NotFoundPage } from './NotFoundPage';

/** /s/:id: the read-only page a share link opens. Works signed out. */
export function SharedSnippetPage() {
  const { id } = useParams();
  const valid = isUuid(id);
  const snippet = useSnippet(valid ? id : undefined);
  const { user } = useAuth();
  const navigate = useNavigate();
  const fork = useCreateSnippet();
  useDocumentTitle(
    snippet.data?.title ?? (snippet.isPending && valid ? 'Loading…' : 'Snippet not found'),
  );

  if (!valid) return <NotFoundPage title="Snippet not found" />;
  if (snippet.isPending) {
    return (
      <Container
        maxW="5xl"
        px={{ base: '3', md: '6' }}
        aria-busy="true"
        aria-label="Loading snippet"
      >
        <Stack gap="4">
          <Skeleton height="9" width="60%" />
          <Skeleton height="5" width="30%" />
          <Skeleton height="80" />
        </Stack>
      </Container>
    );
  }
  if (snippet.isError) {
    return (
      <Container maxW="5xl" px={{ base: '3', md: '6' }}>
        <ErrorView
          error={snippet.error}
          title="Couldn’t load this snippet"
          onRetry={() => void snippet.refetch()}
        />
      </Container>
    );
  }
  if (!snippet.data) {
    return (
      <NotFoundPage
        title="Snippet not found"
        description="This snippet doesn’t exist, or its owner has made it private."
      />
    );
  }

  const s = snippet.data;
  const isOwner = user?.id === s.ownerId;

  const saveCopy = () =>
    fork.mutate(
      {
        title: s.title,
        description: s.description,
        code: s.code,
        language: s.language,
        tags: s.tags,
        visibility: 'private',
      },
      {
        onSuccess: (created) => {
          notify.success('Saved to your library');
          navigate(`/app/snippets/${created.id}`);
        },
        onError: (error) => notify.error(error, 'Couldn’t save a copy'),
      },
    );

  return (
    <Container maxW="5xl" px={{ base: '3', md: '6' }}>
      <Stack gap="5">
        <Stack gap="3">
          <Heading as="h1" size={{ base: 'xl', md: '2xl' }} wordBreak="break-word">
            {s.title}
          </Heading>
          <HStack gap="3" flexWrap="wrap" color="fg.muted" fontSize="sm">
            {s.author.name && (
              <HStack gap="1.5">
                <Avatar.Root size="2xs" colorPalette="teal">
                  <Avatar.Fallback name={s.author.name} />
                  {s.author.avatarUrl && <Avatar.Image src={s.author.avatarUrl} alt="" />}
                </Avatar.Root>
                <Text>{s.author.name}</Text>
              </HStack>
            )}
            <Text>Updated {formatDate(s.updatedAt)}</Text>
            <LanguageBadge language={s.language} />
            {isOwner && <VisibilityBadge visibility={s.visibility} />}
          </HStack>
          {s.description && <Text>{s.description}</Text>}
          <TagList
            tags={s.tags}
            onTagClick={(tag) => navigate(`/explore?tags=${encodeURIComponent(tag)}`)}
          />
        </Stack>

        <HStack gap="2" flexWrap="wrap">
          <CopyButton text={s.code} colorPalette="teal" label="Copy code" />
          {s.visibility === 'public' && (
            <CopyButton
              text={shareUrl(s.id)}
              variant="outline"
              label="Copy link"
              successMessage="Link copied"
            />
          )}
          {isOwner ? (
            <Button asChild variant="outline">
              <RouterLink to={`/app/snippets/${s.id}`}>
                <Pencil /> Edit
              </RouterLink>
            </Button>
          ) : user ? (
            <Button
              variant="outline"
              onClick={saveCopy}
              loading={fork.isPending}
              loadingText="Saving…"
            >
              <GitFork /> Save a copy
            </Button>
          ) : (
            <Button asChild variant="outline">
              <RouterLink to="/login" state={{ from: `/s/${s.id}` }}>
                <LogIn /> Sign in to save a copy
              </RouterLink>
            </Button>
          )}
        </HStack>

        <Box>
          <LazyCodeEditor
            value={s.code}
            language={s.language}
            readOnly
            ariaLabel={`Code: ${s.title}`}
          />
        </Box>
      </Stack>
    </Container>
  );
}
