import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Icon,
  Link,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  ArrowRight,
  ClipboardCopy,
  Code2,
  FileJson,
  Search,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { Navigate, Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/context';
import { useDemoSignIn } from '../auth/useDemoSignIn';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const FEATURES = [
  {
    icon: Code2,
    title: 'A real code editor',
    body: 'Monaco, the editor behind VS Code, with syntax highlighting for 30 languages.',
  },
  {
    icon: Search,
    title: 'Find anything fast',
    body: 'Ranked full-text search across titles, descriptions, tags and code, plus tag and language filters.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    body: 'Postgres row level security decides who can read every snippet, not just the UI.',
  },
  {
    icon: Share2,
    title: 'Share with a link',
    body: 'Make a snippet public and send the link. Anyone can read it, no account needed.',
  },
  {
    icon: ClipboardCopy,
    title: 'One-click copy',
    body: 'Copy straight from the library or a shared page.',
  },
  {
    icon: FileJson,
    title: 'Import and export',
    body: 'Take your whole library with you as JSON, or bring one in.',
  },
];

export function LandingPage() {
  const { status } = useAuth();
  const demo = useDemoSignIn();
  useDocumentTitle(undefined);

  if (status === 'signed-in') return <Navigate to="/app" replace />;

  return (
    <Container maxW="6xl" px={{ base: '4', md: '6' }}>
      <Stack gap={{ base: '12', md: '16' }}>
        <Stack gap="6" align="center" textAlign="center" pt={{ base: '6', md: '16' }}>
          <Badge colorPalette="teal" variant="surface" size="lg">
            Snippet manager
          </Badge>
          <Heading as="h1" size={{ base: '3xl', md: '5xl' }} maxW="3xl" lineHeight="1.1">
            Your code snippets, searchable and shareable.
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg' }} color="fg.muted" maxW="2xl">
            Keep the snippets you keep rewriting in one place. Tag them, search them, copy them in a
            click and share the good ones.
          </Text>
          <HStack gap="3" flexWrap="wrap" justify="center">
            <Button
              size="lg"
              colorPalette="teal"
              onClick={demo.signIn}
              loading={demo.pending}
              loadingText="Starting demo…"
            >
              Try the demo <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <RouterLink to="/login">Sign in or sign up</RouterLink>
            </Button>
          </HStack>
          <Link asChild fontSize="sm" color="fg.muted">
            <RouterLink to="/explore">Or browse public snippets without an account</RouterLink>
          </Link>
        </Stack>

        <Box as="section" aria-labelledby="features-heading">
          <Heading as="h2" id="features-heading" size="lg" mb="6" textAlign="center">
            What you get
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
            {FEATURES.map(({ icon, title, body }) => (
              <Card.Root key={title} variant="subtle">
                <Card.Body gap="2">
                  <Icon as={icon} boxSize="6" color="teal.fg" aria-hidden />
                  <Heading as="h3" size="md">
                    {title}
                  </Heading>
                  <Text color="fg.muted" fontSize="sm">
                    {body}
                  </Text>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        </Box>
      </Stack>
    </Container>
  );
}
