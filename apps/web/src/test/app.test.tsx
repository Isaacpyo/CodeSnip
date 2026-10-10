import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryBackend } from '../backend/memory';
import { renderApp } from './renderApp';

// Monaco can't run in jsdom; swap in a textarea with the same contract.
vi.mock('../components/CodeEditor', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
    readOnly,
  }: {
    value: string;
    onChange?: (v: string) => void;
    ariaLabel: string;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

async function signedInDemo() {
  const backend = createMemoryBackend({ storage: null });
  await backend.auth.signInAsDemo();
  return backend;
}

describe('CodeSnip app (mock backend)', () => {
  it('lets a visitor start the demo from the landing page', async () => {
    const { user, router } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: /try the demo/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(await screen.findByRole('heading', { name: 'My snippets' })).toBeInTheDocument();
    expect(await screen.findByText('useDebounce hook')).toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('12 snippets');
  });

  it('redirects signed-out visitors from /app to the login page', async () => {
    const { router } = renderApp('/app');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(
      await screen.findByRole('heading', { name: /welcome to codesnip/i }),
    ).toBeInTheDocument();
  });

  it('validates the sign-in form and shows server errors', async () => {
    const { user } = renderApp('/login');
    const form = await screen.findByRole('form', { name: 'Sign in' });
    await user.click(within(form).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    await user.type(within(form).getByLabelText(/email/i), 'demo@codesnip.dev');
    await user.type(within(form).getByLabelText(/password/i), 'wrong-password');
    await user.click(within(form).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('searches and filters the library through the URL', async () => {
    const { user, router } = renderApp('/app', await signedInDemo());
    await screen.findByText('useDebounce hook');
    await user.type(screen.getByRole('searchbox', { name: /search snippets/i }), 'debou');
    await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('1 snippet'));
    expect(router.state.location.search).toBe('?q=debou');
    expect(screen.queryByText('Delete merged git branches')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    await waitFor(() =>
      expect(screen.getByTestId('result-count')).toHaveTextContent('12 snippets'),
    );
    const card = (await screen.findByText('Delete merged git branches')).closest(
      '[data-testid="snippet-card"]',
    ) as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Filter by tag git' }));
    await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('1 snippet'));
    expect(router.state.location.search).toBe('?tags=git');
  });

  it('creates a snippet, validates it, and shows it in the library', async () => {
    const { user, router } = renderApp('/app/new', await signedInDemo());
    await user.click(await screen.findByRole('button', { name: /create snippet/i }));
    expect(await screen.findByText('Give your snippet a title.')).toBeInTheDocument();
    expect(screen.getByText('Add some code.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/title/i), 'Hello world');
    await user.type(screen.getByLabelText('Tags'), 'greeting,');
    await user.type(await screen.findByLabelText('Code editor'), 'console.log("hi")');
    await user.click(screen.getByRole('button', { name: /create snippet/i }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/app\/snippets\/[0-9a-f-]{36}$/),
    );
    expect(await screen.findByRole('heading', { name: 'Edit snippet' })).toBeInTheDocument();
    expect(screen.getByText('#greeting')).toBeInTheDocument();
  });

  it('shows public snippets to signed-out visitors and hides private ones', async () => {
    renderApp('/s/5a1e0001-0000-4000-8000-000000000001');
    expect(await screen.findByRole('heading', { name: 'useDebounce hook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in to save a copy/i })).toBeInTheDocument();
    const code = await screen.findByLabelText('Code: useDebounce hook');
    await waitFor(() =>
      expect((code as HTMLTextAreaElement).value).toContain('export function useDebounce'),
    );
  });

  it('treats a private snippet link as not found', async () => {
    renderApp('/s/5a1e0002-0000-4000-8000-000000000005');
    expect(await screen.findByRole('heading', { name: 'Snippet not found' })).toBeInTheDocument();
    expect(screen.getByText(/made it private/)).toBeInTheDocument();
  });

  it('shows an empty state for a new account', async () => {
    const backend = createMemoryBackend({ storage: null });
    await backend.auth.signUp({ email: 'fresh@test.dev', password: 'password123' });
    renderApp('/app', backend);
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    const backend = await signedInDemo();
    const search = vi
      .spyOn(backend.snippets, 'search')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { user } = renderApp('/app', backend);
    expect(await screen.findByText('Couldn’t load snippets')).toBeInTheDocument();
    expect(screen.getByText(/can’t reach the server/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('useDebounce hook')).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('labels the offline mock mode honestly', async () => {
    renderApp('/');
    expect(await screen.findByText(/offline demo mode/i)).toBeInTheDocument();
  });
});
