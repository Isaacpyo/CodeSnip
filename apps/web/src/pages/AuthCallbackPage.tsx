import { Alert, Button, Center, Container, Spinner, Stack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Navigate, Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/context';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const TIMEOUT_MS = 15_000;

function readCallbackError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('error_description') ?? hash.get('error_description');
}

/** Landing spot for OAuth and email-confirmation redirects. supabase-js exchanges the code on load. */
export function AuthCallbackPage() {
  useDocumentTitle('Signing in');
  const { status } = useAuth();
  const [error] = useState(readCallbackError);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  if (status === 'signed-in') return <Navigate to="/app" replace />;

  if (error || timedOut) {
    return (
      <Container maxW="md" px="4">
        <Stack gap="4">
          <Alert.Root status="error" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Sign-in didn’t complete</Alert.Title>
              <Alert.Description>
                {error ?? 'The sign-in link may have expired. Please try again.'}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
          <Button asChild colorPalette="teal" alignSelf="flex-start">
            <RouterLink to="/login">Back to sign in</RouterLink>
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Center py="20">
      <Stack align="center" gap="3">
        <Spinner size="lg" />
        <Text color="fg.muted">Signing you in…</Text>
      </Stack>
    </Center>
  );
}
