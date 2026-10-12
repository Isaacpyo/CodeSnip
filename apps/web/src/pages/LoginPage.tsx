import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Field,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { useDemoSignIn } from '../auth/useDemoSignIn';
import { useBackend } from '../backend/context';
import { friendlyMessage } from '../backend/errors';
import { useAuthCapabilities } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { emailSchema, passwordSchema } from '../lib/validation';
import { GitHubIcon } from '../ui/GitHubIcon';

type Mode = 'sign-in' | 'sign-up';
type Errors = Partial<Record<'email' | 'password' | 'displayName', string>>;

function validate(mode: Mode, email: string, password: string): Errors {
  const errors: Errors = {};
  const e = emailSchema.safeParse(email.trim());
  if (!e.success) errors.email = e.error.issues[0]?.message;
  if (mode === 'sign-up') {
    const p = passwordSchema.safeParse(password);
    if (!p.success) errors.password = p.error.issues[0]?.message;
  } else if (!password) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { status } = useAuth();
  const backend = useBackend();
  const navigate = useNavigate();
  const location = useLocation();
  const capabilities = useAuthCapabilities();
  const demo = useDemoSignIn();
  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === 'sign-in') {
        await backend.auth.signInWithPassword(email, password);
        return { needsConfirmation: false };
      }
      return backend.auth.signUp({ email, password, displayName });
    },
    onSuccess: ({ needsConfirmation }) => {
      if (needsConfirmation) setConfirmationSent(true);
      else navigate(from, { replace: true });
    },
  });

  const github = useMutation({
    mutationFn: () => backend.auth.signInWithGitHub(`${window.location.origin}/auth/callback`),
  });

  if (status === 'signed-in' && !submit.isPending) return <Navigate to={from} replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(mode, email, password);
    setErrors(found);
    if (Object.keys(found).length === 0) submit.mutate();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setConfirmationSent(false);
    submit.reset();
  };

  return (
    <Container maxW="md" px="4">
      <Stack gap="6">
        <Box textAlign="center">
          <Heading as="h1" size="2xl">
            Welcome to CodeSnip
          </Heading>
          <Text color="fg.muted" mt="2">
            Sign in to manage your snippets.
          </Text>
        </Box>

        <Card.Root variant="outline">
          <Card.Body gap="5">
            <Button
              colorPalette="teal"
              variant="subtle"
              size="lg"
              onClick={demo.signIn}
              loading={demo.pending}
              loadingText="Starting demo…"
            >
              <Sparkles /> Try the demo, no sign-up
            </Button>

            {capabilities.data?.github && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => github.mutate()}
                loading={github.isPending}
              >
                <GitHubIcon /> Continue with GitHub
              </Button>
            )}
            {github.isError && (
              <Text color="fg.error" fontSize="sm">
                {friendlyMessage(github.error)}
              </Text>
            )}

            <HStack>
              <Separator flex="1" />
              <Text fontSize="sm" color="fg.muted" flexShrink="0">
                or with email
              </Text>
              <Separator flex="1" />
            </HStack>

            <Tabs.Root
              value={mode}
              onValueChange={(e) => switchMode(e.value as Mode)}
              variant="enclosed"
              fitted
            >
              <Tabs.List>
                <Tabs.Trigger value="sign-in">Sign in</Tabs.Trigger>
                <Tabs.Trigger value="sign-up">Create account</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>

            {confirmationSent ? (
              <Alert.Root status="success" role="status">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Check your inbox</Alert.Title>
                  <Alert.Description>
                    We sent a confirmation link to {email}. Open it to finish creating your account.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ) : (
              <form
                onSubmit={onSubmit}
                noValidate
                aria-label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
              >
                <Stack gap="4">
                  {mode === 'sign-up' && (
                    <Field.Root>
                      <Field.Label>Display name</Field.Label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="nickname"
                        maxLength={80}
                        placeholder="Shown on snippets you publish"
                      />
                      <Field.HelperText>Optional.</Field.HelperText>
                    </Field.Root>
                  )}
                  <Field.Root invalid={Boolean(errors.email)} required>
                    <Field.Label>
                      Email <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                    <Field.ErrorText>{errors.email}</Field.ErrorText>
                  </Field.Root>
                  <Field.Root invalid={Boolean(errors.password)} required>
                    <Field.Label>
                      Password <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    />
                    {mode === 'sign-up' && !errors.password && (
                      <Field.HelperText>At least 8 characters.</Field.HelperText>
                    )}
                    <Field.ErrorText>{errors.password}</Field.ErrorText>
                  </Field.Root>

                  {submit.isError && (
                    <Alert.Root status="error" role="alert">
                      <Alert.Indicator />
                      <Alert.Title>{friendlyMessage(submit.error)}</Alert.Title>
                    </Alert.Root>
                  )}

                  <Button type="submit" colorPalette="teal" loading={submit.isPending}>
                    {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                  </Button>
                </Stack>
              </form>
            )}
          </Card.Body>
        </Card.Root>

        {backend.kind === 'mock' && (
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Offline demo mode: accounts you create live in this browser only. GitHub sign-in needs
            the Supabase backend.
          </Text>
        )}
      </Stack>
    </Container>
  );
}
