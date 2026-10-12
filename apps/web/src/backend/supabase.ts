import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { BackendError, toBackendError } from './errors';
import type {
  AuthCapabilities,
  AuthUser,
  Backend,
  FacetCount,
  Facets,
  SearchPage,
  Snippet,
  SnippetInput,
  SnippetSummary,
  Visibility,
} from './types';
import type { WakeTracker } from '../lib/wakeTracker';

export interface SupabaseBackendConfig {
  url: string;
  anonKey: string;
  demoEmail: string;
  demoPassword: string;
  tracker?: WakeTracker;
}

type Client = SupabaseClient<Database>;
type SnippetRow = Database['public']['Tables']['snippets']['Row'];
type SearchRow = Database['public']['Functions']['search_snippets']['Returns'][number];

const SNIPPET_COLUMNS =
  'id, owner_id, title, description, code, language, tags, visibility, created_at, updated_at, author:profiles(display_name, avatar_url)' as const;
const EXPORT_PAGE = 1000;

type SnippetWithAuthor = Omit<SnippetRow, 'search_vector'> & {
  author: { display_name: string; avatar_url: string | null } | null;
};

export function rowToSnippet(row: SnippetWithAuthor): Snippet {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    code: row.code,
    language: row.language,
    tags: row.tags,
    visibility: row.visibility as Visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: { name: row.author?.display_name ?? null, avatarUrl: row.author?.avatar_url ?? null },
  };
}

export function searchRowToSummary(row: SearchRow): SnippetSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    codePreview: row.code_preview,
    language: row.language,
    tags: row.tags,
    visibility: row.visibility as Visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // The RPC left-joins profiles, so these are null when the author is hidden.
    author: { name: row.author_name ?? null, avatarUrl: row.author_avatar_url ?? null },
    rank: row.rank,
  };
}

export function facetRowsToFacets(rows: { kind: string; value: string; count: number }[]): Facets {
  const pick = (kind: string): FacetCount[] =>
    rows.filter((r) => r.kind === kind).map((r) => ({ value: r.value, count: Number(r.count) }));
  return { tags: pick('tag'), languages: pick('language') };
}

const toAuthUser = (user: User | null | undefined): AuthUser | null =>
  user ? { id: user.id, email: user.email ?? null } : null;

type Result = { data: unknown; error: unknown };

/** Unwraps a supabase-js result, converting errors into BackendError. */
function unwrapMaybe<R extends Result>(result: R): R['data'] {
  if (result.error) throw toBackendError(result.error);
  return result.data;
}

function unwrap<R extends Result>(result: R): NonNullable<R['data']> {
  const data = unwrapMaybe(result);
  if (data === null || data === undefined) {
    throw new BackendError('unknown', 'The server returned an empty response.');
  }
  return data as NonNullable<R['data']>;
}

async function call<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toBackendError(error);
  }
}

function authError(error: { message?: string; status?: number; code?: string } | null): never {
  const message = error?.message ?? '';
  if (/invalid login credentials/i.test(message)) {
    throw new BackendError('auth', 'Invalid email or password.', { cause: error });
  }
  if (/email not confirmed/i.test(message)) {
    throw new BackendError('auth', 'Confirm your email address first: check your inbox.', {
      cause: error,
    });
  }
  if (/already registered|already exists/i.test(message)) {
    throw new BackendError('auth', 'An account with this email already exists.', { cause: error });
  }
  if (error?.status === 429) {
    throw new BackendError('auth', 'Too many attempts. Wait a minute and try again.', {
      cause: error,
    });
  }
  if (error?.code === 'weak_password' || /password/i.test(message)) {
    throw new BackendError('invalid', message, { cause: error });
  }
  if (/fetch/i.test(message)) throw toBackendError(new TypeError(message));
  throw new BackendError('auth', message || 'Sign-in failed. Please try again.', { cause: error });
}

export function createSupabaseBackend(config: SupabaseBackendConfig): Backend {
  const baseFetch: typeof fetch = (...args) => fetch(...args);
  const client: Client = createClient<Database>(config.url, config.anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: config.tracker ? config.tracker.wrapFetch(baseFetch) : baseFetch },
  });

  let capabilities: Promise<AuthCapabilities> | undefined;

  const currentUserId = async (): Promise<string> => {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new BackendError('auth', 'Please sign in first.');
    return id;
  };

  return {
    kind: 'supabase',

    auth: {
      async getUser() {
        const { data, error } = await client.auth.getSession();
        if (error) throw toBackendError(error);
        return toAuthUser(data.session?.user);
      },

      onChange(listener) {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          listener(toAuthUser(session?.user));
        });
        return () => data.subscription.unsubscribe();
      },

      capabilities() {
        capabilities ??= (async () => {
          try {
            const res = await fetch(`${config.url}/auth/v1/settings`, {
              headers: { apikey: config.anonKey },
            });
            if (!res.ok) throw new Error(`settings ${res.status}`);
            const settings = (await res.json()) as {
              external?: Record<string, boolean>;
              mailer_autoconfirm?: boolean;
            };
            return {
              github: Boolean(settings.external?.github),
              emailConfirmation: settings.mailer_autoconfirm === false,
            };
          } catch {
            capabilities = undefined; // retry next time
            return { github: false, emailConfirmation: true };
          }
        })();
        return capabilities;
      },

      async signInWithPassword(email, password) {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) authError(error);
      },

      async signUp({ email, password, displayName }) {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: displayName?.trim() ? { display_name: displayName.trim() } : {},
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) authError(error);
        return { needsConfirmation: !data.session };
      },

      async signInWithGitHub(redirectTo) {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo },
        });
        if (error) authError(error);
      },

      async signInAsDemo() {
        const { error } = await client.auth.signInWithPassword({
          email: config.demoEmail,
          password: config.demoPassword,
        });
        if (error) authError(error);
      },

      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw toBackendError(error);
      },

      async getProfile() {
        const { data } = await client.auth.getSession();
        const id = data.session?.user.id;
        if (!id) return null;
        const row = unwrapMaybe(
          await call(() =>
            client
              .from('profiles')
              .select('id, display_name, avatar_url, is_demo')
              .eq('id', id)
              .maybeSingle(),
          ),
        );
        return row
          ? {
              id: row.id,
              displayName: row.display_name,
              avatarUrl: row.avatar_url,
              isDemo: row.is_demo,
            }
          : null;
      },
    },

    snippets: {
      async search(params): Promise<SearchPage> {
        const pageSize = params.pageSize ?? 24;
        const offset = params.offset ?? 0;
        const rows = unwrap(
          await call(() =>
            client.rpc('search_snippets', {
              search: params.search ?? '',
              tag_filter: params.tags ?? [],
              lang: params.language ?? '',
              scope: params.scope,
              page_size: pageSize,
              page_offset: offset,
            }),
          ),
        );
        const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
        const next = offset + rows.length;
        return {
          items: rows.map(searchRowToSummary),
          total,
          nextOffset: next < total ? next : null,
        };
      },

      async facets(scope) {
        const rows = unwrap(await call(() => client.rpc('snippet_facets', { scope })));
        return facetRowsToFacets(rows);
      },

      async get(id) {
        const row = unwrapMaybe(
          await call(() =>
            client.from('snippets').select(SNIPPET_COLUMNS).eq('id', id).maybeSingle(),
          ),
        );
        return row ? rowToSnippet(row) : null;
      },

      async create(input: SnippetInput) {
        const row = unwrap(
          await call(() => client.from('snippets').insert(input).select(SNIPPET_COLUMNS).single()),
        );
        return rowToSnippet(row);
      },

      async update(id, patch) {
        // RLS makes other users' rows invisible to UPDATE: zero rows -> PGRST116 -> not_found.
        const row = unwrap(
          await call(() =>
            client.from('snippets').update(patch).eq('id', id).select(SNIPPET_COLUMNS).single(),
          ),
        );
        return rowToSnippet(row);
      },

      async remove(id) {
        const rows = unwrap(
          await call(() => client.from('snippets').delete().eq('id', id).select('id')),
        );
        if (rows.length === 0) {
          throw new BackendError('not_found', 'That snippet doesn’t exist or isn’t yours.');
        }
      },

      async importMany(inputs) {
        if (inputs.length === 0) return 0;
        const rows = unwrap(await call(() => client.from('snippets').insert(inputs).select('id')));
        return rows.length;
      },

      async exportAll() {
        const ownerId = await currentUserId();
        const all: Snippet[] = [];
        for (let from = 0; ; from += EXPORT_PAGE) {
          const rows = unwrap(
            await call(() =>
              client
                .from('snippets')
                .select(SNIPPET_COLUMNS)
                .eq('owner_id', ownerId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true })
                .range(from, from + EXPORT_PAGE - 1),
            ),
          );
          all.push(...rows.map(rowToSnippet));
          if (rows.length < EXPORT_PAGE) return all;
        }
      },
    },
  };
}
