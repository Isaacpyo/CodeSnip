import { Box, Button, Container, Heading, Text } from '@chakra-ui/react';
import { Compass, SearchX } from 'lucide-react';
import { SnippetBrowser } from '../components/SnippetBrowser';
import { EmptyView } from '../components/StateViews';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function ExplorePage() {
  useDocumentTitle('Explore');
  return (
    <Container maxW="7xl" px={{ base: '3', md: '6' }}>
      <Box mb="6">
        <Heading as="h1" size="2xl">
          Explore
        </Heading>
        <Text color="fg.muted" mt="1">
          Snippets people have chosen to share publicly.
        </Text>
      </Box>
      <SnippetBrowser
        scope="public"
        hrefFor={(s) => `/s/${s.id}`}
        searchPlaceholder="Search public snippets…"
        renderEmpty={(filtered, clear) =>
          filtered ? (
            <EmptyView
              icon={<SearchX />}
              title="No public snippets match"
              description="Try a different search or clear the filters."
            >
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            </EmptyView>
          ) : (
            <EmptyView
              icon={<Compass />}
              title="Nothing shared yet"
              description="Public snippets will show up here."
            />
          )
        }
      />
    </Container>
  );
}
