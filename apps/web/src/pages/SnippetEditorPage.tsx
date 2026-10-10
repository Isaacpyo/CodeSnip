import {
  Box,
  Button,
  Container,
  Field,
  Grid,
  Heading,
  HStack,
  Input,
  Kbd,
  NativeSelect,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { ArrowLeft, Save, Share2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, Link as RouterLink, useBlocker, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/context';
import type { Snippet, SnippetInput, Visibility } from '../backend/types';
import { VisibilityBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CopyButton } from '../components/CopyButton';
import { LazyCodeEditor } from '../components/LazyCodeEditor';
import { ShareDialog } from '../components/ShareDialog';
import { ErrorView } from '../components/StateViews';
import { TagInput } from '../components/TagInput';
import { useCreateSnippet, useDeleteSnippet, useSnippet, useUpdateSnippet } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LANGUAGES } from '../lib/languages';
import { LIMITS, isUuid, validateSnippet, type SnippetFieldErrors } from '../lib/validation';
import { notify } from '../ui/notify';
import { NotFoundPage } from './NotFoundPage';

const EMPTY: SnippetInput = {
  title: '',
  description: '',
  code: '',
  language: 'typescript',
  tags: [],
  visibility: 'private',
};

const toInput = (s: Snippet): SnippetInput => ({
  title: s.title,
  description: s.description,
  code: s.code,
  language: s.language,
  tags: s.tags,
  visibility: s.visibility,
});

const sameInput = (a: SnippetInput, b: SnippetInput) => JSON.stringify(a) === JSON.stringify(b);

/** /app/new and /app/snippets/:id */
export function SnippetEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const snippet = useSnippet(isUuid(id) ? id : undefined);

  if (id === undefined) return <SnippetForm key="new" />;
  if (!isUuid(id)) return <NotFoundPage title="Snippet not found" />;
  if (snippet.isPending) return <EditorSkeleton />;
  if (snippet.isError) {
    return (
      <Container maxW="6xl" px={{ base: '3', md: '6' }}>
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
        description="It may have been deleted, or it isn’t yours."
      />
    );
  }
  // Someone else's public snippet: show the read-only page instead.
  if (snippet.data.ownerId !== user?.id) return <Navigate to={`/s/${id}`} replace />;
  return <SnippetForm key={snippet.data.id} snippet={snippet.data} />;
}

function EditorSkeleton() {
  return (
    <Container maxW="6xl" px={{ base: '3', md: '6' }} aria-busy="true" aria-label="Loading snippet">
      <Stack gap="5">
        <Skeleton height="8" width="40%" />
        <Skeleton height="10" />
        <Skeleton height="16" />
        <Skeleton height="96" />
      </Stack>
    </Container>
  );
}

function SnippetForm({ snippet }: { snippet?: Snippet }) {
  const isNew = !snippet;
  useDocumentTitle(isNew ? 'New snippet' : snippet.title);
  const navigate = useNavigate();
  const create = useCreateSnippet();
  const update = useUpdateSnippet();
  const remove = useDeleteSnippet();

  const initial = useMemo(() => (snippet ? toInput(snippet) : EMPTY), [snippet]);
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<SnippetFieldErrors>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const skipBlocker = useRef(false);
  const ids = { title: useId(), language: useId(), tags: useId(), code: useId() };

  const dirty = !sameInput(values, baseline);
  const saving = create.isPending || update.isPending;

  const set = <K extends keyof SnippetInput>(key: K, value: SnippetInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const save = useCallback(() => {
    if (saving) return;
    const result = validateSnippet(values);
    if (!result.ok) {
      setErrors(result.errors);
      notify.warning('Please fix the highlighted fields');
      return;
    }
    setErrors({});
    if (isNew) {
      create.mutate(result.value, {
        onSuccess: (created) => {
          notify.success('Snippet saved');
          skipBlocker.current = true;
          navigate(`/app/snippets/${created.id}`, { replace: true });
        },
        onError: (error) => notify.error(error, 'Couldn’t save the snippet'),
      });
    } else {
      update.mutate(
        { id: snippet.id, patch: result.value },
        {
          onSuccess: (saved) => {
            const next = toInput(saved);
            setBaseline(next);
            setValues(next);
            notify.success('Changes saved');
          },
          onError: (error) => notify.error(error, 'Couldn’t save your changes'),
        },
      );
    }
  }, [create, isNew, navigate, saving, snippet, update, values]);

  const changeVisibility = (visibility: Visibility) => {
    if (!snippet) return;
    update.mutate(
      { id: snippet.id, patch: { visibility } },
      {
        onSuccess: () => {
          setBaseline((b) => ({ ...b, visibility }));
          setValues((v) => ({ ...v, visibility }));
          notify.success(
            visibility === 'public' ? 'Snippet is now public' : 'Snippet is now private',
          );
        },
        onError: (error) => notify.error(error, 'Couldn’t change visibility'),
      },
    );
  };

  const confirmDelete = () => {
    if (!snippet) return;
    remove.mutate(snippet.id, {
      onSuccess: () => {
        notify.success('Snippet deleted');
        skipBlocker.current = true;
        navigate('/app', { replace: true });
      },
      onError: (error) => notify.error(error, 'Couldn’t delete the snippet'),
    });
  };

  // Cmd/Ctrl+S anywhere on the page (Monaco handles it while focused).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Warn before losing unsaved work: closing the tab, or navigating in-app.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skipBlocker.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save();
  };

  return (
    <Container maxW="6xl" px={{ base: '3', md: '6' }}>
      <Stack gap="5">
        <HStack justify="space-between" flexWrap="wrap" gap="2">
          <Button asChild variant="ghost" size="sm" ms="-2">
            <RouterLink to="/app">
              <ArrowLeft /> My snippets
            </RouterLink>
          </Button>
          <HStack gap="2" flexWrap="wrap">
            {!isNew && <VisibilityBadge visibility={baseline.visibility} />}
            <CopyButton
              text={values.code}
              size="sm"
              variant="outline"
              label="Copy code"
              disabled={!values.code}
            />
            {!isNew && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                  <Share2 /> Share
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="red"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 /> Delete
                </Button>
              </>
            )}
            <Button
              size="sm"
              colorPalette="teal"
              onClick={save}
              loading={saving}
              loadingText="Saving…"
            >
              <Save /> Save
            </Button>
          </HStack>
        </HStack>

        <HStack justify="space-between" align="baseline" flexWrap="wrap">
          <Heading as="h1" size="xl">
            {isNew ? 'New snippet' : 'Edit snippet'}
          </Heading>
          <Text fontSize="sm" color={dirty ? 'orange.fg' : 'fg.muted'} aria-live="polite">
            {dirty ? 'Unsaved changes' : isNew ? '' : 'All changes saved'}
          </Text>
        </HStack>

        <form onSubmit={onSubmit} noValidate aria-label={isNew ? 'New snippet' : 'Edit snippet'}>
          <Stack gap="5">
            <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap="4">
              <Field.Root invalid={Boolean(errors.title)} required>
                <Field.Label htmlFor={ids.title}>
                  Title <Field.RequiredIndicator />
                </Field.Label>
                <Input
                  id={ids.title}
                  value={values.title}
                  onChange={(e) => set('title', e.target.value)}
                  maxLength={LIMITS.title}
                  placeholder="e.g. useDebounce hook"
                  autoFocus={isNew}
                />
                <Field.ErrorText>{errors.title}</Field.ErrorText>
              </Field.Root>
              <Field.Root invalid={Boolean(errors.language)}>
                <Field.Label htmlFor={ids.language}>Language</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    id={ids.language}
                    value={values.language}
                    onChange={(e) => set('language', e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{errors.language}</Field.ErrorText>
              </Field.Root>
            </Grid>

            <Field.Root invalid={Boolean(errors.description)}>
              <Field.Label>Description</Field.Label>
              <Textarea
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={LIMITS.description}
                rows={2}
                autoresize
                placeholder="What is it for? When would you reach for it?"
              />
              <Field.HelperText>
                {values.description.length}/{LIMITS.description}
              </Field.HelperText>
              <Field.ErrorText>{errors.description}</Field.ErrorText>
            </Field.Root>

            <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap="4" alignItems="start">
              <Field.Root invalid={Boolean(errors.tags)}>
                <Field.Label htmlFor={ids.tags}>Tags</Field.Label>
                <TagInput
                  id={ids.tags}
                  value={values.tags}
                  onChange={(tags) => set('tags', tags)}
                  invalid={Boolean(errors.tags)}
                />
                <Field.ErrorText>{errors.tags}</Field.ErrorText>
              </Field.Root>
              <Field.Root>
                <Field.Label>Visibility</Field.Label>
                <Switch.Root
                  checked={values.visibility === 'public'}
                  onCheckedChange={(e) => set('visibility', e.checked ? 'public' : 'private')}
                  colorPalette="teal"
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Label>Public</Switch.Label>
                </Switch.Root>
                <Field.HelperText>
                  {values.visibility === 'public'
                    ? 'Anyone with the link can view it, and it appears on Explore.'
                    : 'Only you can see it.'}
                </Field.HelperText>
              </Field.Root>
            </Grid>

            <Box>
              <HStack justify="space-between" mb="1.5" flexWrap="wrap">
                <Text id={ids.code} fontSize="sm" fontWeight="medium">
                  Code{' '}
                  <Text as="span" color="fg.error" aria-hidden>
                    *
                  </Text>
                </Text>
                <Text fontSize="xs" color="fg.muted" hideBelow="md">
                  <Kbd size="sm">Ctrl/⌘</Kbd> + <Kbd size="sm">S</Kbd> saves ·{' '}
                  <Kbd size="sm">Ctrl+M</Kbd> toggles Tab focus
                </Text>
              </HStack>
              <LazyCodeEditor
                value={values.code}
                language={values.language}
                onChange={(code) => set('code', code)}
                onSave={save}
                height="min(60vh, 560px)"
                ariaLabel="Code editor"
              />
              {errors.code && (
                <Text color="fg.error" fontSize="sm" mt="1.5" role="alert">
                  {errors.code}
                </Text>
              )}
            </Box>

            <HStack justify="flex-end">
              <Button type="submit" colorPalette="teal" loading={saving} loadingText="Saving…">
                <Save /> {isNew ? 'Create snippet' : 'Save changes'}
              </Button>
            </HStack>
          </Stack>
        </form>
      </Stack>

      {snippet && (
        <>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete this snippet?"
            confirmLabel="Delete"
            destructive
            loading={remove.isPending}
            onConfirm={confirmDelete}
          >
            “{snippet.title}” will be permanently deleted. Share links to it will stop working.
          </ConfirmDialog>
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            snippetId={snippet.id}
            visibility={baseline.visibility}
            onChangeVisibility={changeVisibility}
            pending={update.isPending}
          />
        </>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        destructive
        onConfirm={() => blocker.proceed?.()}
      >
        You have changes that haven’t been saved yet.
      </ConfirmDialog>
    </Container>
  );
}
