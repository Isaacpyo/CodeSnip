import {
  Alert,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  List,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { FileUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useImportSnippets } from '../hooks/queries';
import { pluralize } from '../lib/format';
import { ImportFileError, planImport, type ImportPlan } from '../lib/importExport';
import { notify } from '../ui/notify';

const MAX_ISSUES_SHOWN = 5;

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [keepVisibility, setKeepVisibility] = useState(false);
  const importSnippets = useImportSnippets();

  const result = useMemo((): { plan: ImportPlan } | { error: string } | null => {
    if (!file) return null;
    try {
      return { plan: planImport(file.text, { keepVisibility }) };
    } catch (error) {
      return {
        error: error instanceof ImportFileError ? error.message : 'Couldn’t read that file.',
      };
    }
  }, [file, keepVisibility]);

  const reset = () => {
    setFile(null);
    setKeepVisibility(false);
    importSnippets.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const plan = result && 'plan' in result ? result.plan : null;

  const confirm = () => {
    if (!plan || plan.snippets.length === 0) return;
    importSnippets.mutate(plan.snippets, {
      onSuccess: (count) => {
        notify.success(`Imported ${pluralize(count, 'snippet')}`);
        close(false);
      },
      onError: (error) => notify.error(error, 'Import failed'),
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => close(e.open)}
      placement="center"
      size={{ base: 'full', sm: 'md' }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Import snippets</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Text fontSize="sm" color="fg.muted">
                  Choose a CodeSnip export (.json) or a JSON array of objects with{' '}
                  <code>title</code>, <code>code</code> and optional <code>description</code>,{' '}
                  <code>language</code>, <code>tags</code>.
                </Text>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  data-testid="import-file-input"
                  onChange={async (e) => {
                    const picked = e.target.files?.[0];
                    if (picked) setFile({ name: picked.name, text: await picked.text() });
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  alignSelf="flex-start"
                >
                  <FileUp /> {file ? 'Choose another file' : 'Choose file'}
                </Button>
                {file && (
                  <Text fontSize="sm">
                    Selected: <strong>{file.name}</strong>
                  </Text>
                )}

                {result && 'error' in result && (
                  <Alert.Root status="error" role="alert">
                    <Alert.Indicator />
                    <Alert.Title>{result.error}</Alert.Title>
                  </Alert.Root>
                )}

                {plan && (
                  <Stack gap="3" aria-live="polite">
                    <Alert.Root status={plan.snippets.length ? 'success' : 'warning'}>
                      <Alert.Indicator />
                      <Alert.Title>
                        {plan.snippets.length
                          ? `${pluralize(plan.snippets.length, 'snippet')} ready to import`
                          : 'Nothing to import'}
                        {plan.errors.length ? `, ${plan.errors.length} will be skipped` : ''}
                      </Alert.Title>
                    </Alert.Root>
                    <IssueList title="Skipped" issues={plan.errors} />
                    <IssueList title="Imported with changes" issues={plan.warnings} />
                    <Checkbox.Root
                      checked={keepVisibility}
                      onCheckedChange={(e) => setKeepVisibility(e.checked === true)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>
                        Keep public/private settings from the file (otherwise everything is private)
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </Stack>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="teal"
                disabled={!plan || plan.snippets.length === 0}
                loading={importSnippets.isPending}
                onClick={confirm}
              >
                Import {plan?.snippets.length ? pluralize(plan.snippets.length, 'snippet') : ''}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function IssueList({
  title,
  issues,
}: {
  title: string;
  issues: { index: number; message: string }[];
}) {
  if (issues.length === 0) return null;
  return (
    <Box>
      <Text fontSize="sm" fontWeight="medium">
        {title}
      </Text>
      <List.Root fontSize="sm" color="fg.muted" ps="5">
        {issues.slice(0, MAX_ISSUES_SHOWN).map((issue) => (
          <List.Item key={`${issue.index}-${issue.message}`}>
            #{issue.index}: {issue.message}
          </List.Item>
        ))}
        {issues.length > MAX_ISSUES_SHOWN && (
          <List.Item>…and {issues.length - MAX_ISSUES_SHOWN} more</List.Item>
        )}
      </List.Root>
    </Box>
  );
}
