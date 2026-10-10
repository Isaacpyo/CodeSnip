import { Box, Button, Container, Flex, Heading, HStack, Text } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { Download, FolderOpen, Plus, SearchX, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useBackend } from '../backend/context';
import { ImportDialog } from '../components/ImportDialog';
import { SnippetBrowser } from '../components/SnippetBrowser';
import { EmptyView } from '../components/StateViews';
import { useProfile } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { downloadJson, pluralize } from '../lib/format';
import { buildExport, exportFilename } from '../lib/importExport';
import { notify } from '../ui/notify';

export function LibraryPage() {
  useDocumentTitle('My snippets');
  const backend = useBackend();
  const profile = useProfile();
  const [importOpen, setImportOpen] = useState(false);

  const exportAll = useMutation({
    mutationFn: () => backend.snippets.exportAll(),
    onSuccess: (snippets) => {
      if (snippets.length === 0) {
        notify.info('Nothing to export yet');
        return;
      }
      downloadJson(exportFilename(), buildExport(snippets));
      notify.success(`Exported ${pluralize(snippets.length, 'snippet')}`);
    },
    onError: (error) => notify.error(error, 'Export failed'),
  });

  return (
    <Container maxW="7xl" px={{ base: '3', md: '6' }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'flex-end' }}
        gap="4"
        mb="6"
        direction={{ base: 'column', md: 'row' }}
      >
        <Box>
          <Heading as="h1" size="2xl">
            My snippets
          </Heading>
          <Text color="fg.muted" mt="1">
            {profile.data?.isDemo
              ? 'You’re in the shared demo account. Feel free to edit; demo data is reset regularly.'
              : 'Private unless you choose to share them.'}
          </Text>
        </Box>
        <HStack gap="2" flexWrap="wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload /> Import
          </Button>
          <Button
            variant="outline"
            onClick={() => exportAll.mutate()}
            loading={exportAll.isPending}
            loadingText="Exporting…"
          >
            <Download /> Export
          </Button>
          <Button asChild colorPalette="teal">
            <RouterLink to="/app/new">
              <Plus /> New snippet
            </RouterLink>
          </Button>
        </HStack>
      </Flex>

      <SnippetBrowser
        scope="mine"
        hrefFor={(s) => `/app/snippets/${s.id}`}
        searchPlaceholder="Search your snippets…"
        renderEmpty={(filtered, clear) =>
          filtered ? (
            <EmptyView
              icon={<SearchX />}
              title="No snippets match"
              description="Try a different search or clear the filters."
            >
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            </EmptyView>
          ) : (
            <EmptyView
              icon={<FolderOpen />}
              title="Your library is empty"
              description="Save your first snippet, or import a JSON export."
            >
              <Button asChild colorPalette="teal">
                <RouterLink to="/app/new">
                  <Plus /> New snippet
                </RouterLink>
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload /> Import
              </Button>
            </EmptyView>
          )
        }
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </Container>
  );
}
