/**
 * In-browser mock backend (VITE_BACKEND=mock). Implements the same Backend
 * contract as Supabase on top of localStorage, seeded with the same demo data,
 * and enforces the same rules the database does: RLS visibility/ownership,
 * input constraints and the per-account quota. Lets the app, unit tests and
 * the e2e smoke test run with no keys or containers.
 */
import { DEMO_SNIPPETS, DEMO_USERS, DEMO_USER_ID } from './demoData';
import { BackendError } from './errors';
import type {
  AuthUser,
  Backend,
  Facets,
  Profile,
  Scope,
  SearchPage,
  SearchParams,
  Snippet,
  SnippetInput,
  SnippetSummary,
} from './types';
import { snippetInputSchema } from '../lib/validation';
import { rankMatch } from '../lib/textSearch';
import type { WakeTracker } from '../lib/wakeTracker';

export const STORAGE_KEY = 'codesnip:mock-db:v1';
export const DEMO_PASSWORD = 'codesnip-demo';
const SNIPPET_QUOTA = 2000;
const PREVIEW_CHARS = 600;

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isDemo: boolean;
}

interface StoredSnippet extends SnippetInput {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface Db {
  version: 1;
  users: StoredUser[];
  snippets: StoredSnippet[];
  sessionUserId: string | null;
}

export interface MemoryBackendOptions {
  /** Defaults to window.localStorage; pass null for a purely in-memory store. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Artificial latency per call, to make loading states visible. */
  latencyMs?: number;
  tracker?: WakeTracker;
  now?: () => Date;
  newId?: () => string;
}

async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`codesnip-mock:${email.toLowerCase()}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function seed(now: Date): Promise<Db> {
  const users = await Promise.all(
    DEMO_USERS.map(async (u) => ({
      ...u,
      // Only the demo account has a known password, as in seed.sql.
      passwordHash: u.isDemo ? await hashPassword(u.email, DEMO_PASSWORD) : crypto.randomUUID(),
    })),
  );
  const at = (secondsAgo: number) => new Date(now.getTime() - secondsAgo * 1000).toISOString();
  const snippets = DEMO_SNIPPETS.map(({ createdAgo, updatedAgo, ...s }) => ({
    ...s,
    createdAt: at(createdAgo),
    updatedAt: at(updatedAgo),
  }));
  return { version: 1, users, snippets, sessionUserId: null };
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // storage disabled (e.g. privacy mode)
  }
}

export function createMemoryBackend(options: MemoryBackendOptions = {}): Backend {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const latencyMs = options.latencyMs ?? 0;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const listeners = new Set<(user: AuthUser | null) => void>();

  let dbPromise: Promise<Db> | undefined;
  const load = (): Promise<Db> => {
    dbPromise ??= (async () => {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Db;
          if (parsed.version === 1) return parsed;
        } catch {
          // corrupted: fall through and reseed
        }
      }
      const fresh = await seed(now());
      storage?.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    })();
    return dbPromise;
  };
  const save = (db: Db) => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      throw new BackendError('quota', 'Browser storage is full. Export and delete some snippets.');
    }
  };

  /** Every call goes through here: latency, wake tracking and defensive copies. */
  const run = <T>(fn: (db: Db) => T | Promise<T>): Promise<T> => {
    const work = (async () => {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      const db = await load();
      return structuredClone(await fn(db));
    })();
    return options.tracker ? options.tracker.track(work) : work;
  };

  const currentUser = (db: Db): StoredUser | null =>
    db.users.find((u) => u.id === db.sessionUserId) ?? null;

  const requireUser = (db: Db): StoredUser => {
    const user = currentUser(db);
    if (!user) throw new BackendError('auth', 'Please sign in first.');
    return user;
  };

  const toAuthUser = (user: StoredUser | null): AuthUser | null =>
    user ? { id: user.id, email: user.email } : null;

  const setSession = (db: Db, userId: string | null) => {
    db.sessionUserId = userId;
    save(db);
    const user = toAuthUser(currentUser(db));
    queueMicrotask(() => listeners.forEach((listener) => listener(user)));
  };

  // RLS mirror -------------------------------------------------------------
  const canRead = (s: StoredSnippet, uid: string | null) =>
    s.visibility === 'public' || s.ownerId === uid;
  const inScope = (s: StoredSnippet, scope: Scope, uid: string | null) =>
    scope === 'mine' ? uid !== null && s.ownerId === uid : s.visibility === 'public';

  const authorOf = (db: Db, ownerId: string, uid: string | null) => {
    const owner = db.users.find((u) => u.id === ownerId);
    // Profiles are only visible to their owner or once the user has published something.
    const visible =
      owner &&
      (owner.id === uid ||
        db.snippets.some((s) => s.ownerId === owner.id && s.visibility === 'public'));
    return visible ? { name: owner.displayName, avatarUrl: null } : { name: null, avatarUrl: null };
  };

  const toSnippet = (db: Db, s: StoredSnippet, uid: string | null): Snippet => ({
    ...s,
    author: authorOf(db, s.ownerId, uid),
  });

  const validate = (input: SnippetInput): SnippetInput => {
    const result = snippetInputSchema.safeParse(input);
    if (!result.success) {
      throw new BackendError('invalid', result.error.issues[0]?.message ?? 'Invalid snippet.');
    }
    return result.data;
  };

  const assertQuota = (db: Db, ownerId: string, adding: number) => {
    const owned = db.snippets.filter((s) => s.ownerId === ownerId).length;
    if (owned + adding > SNIPPET_QUOTA) {
      throw new BackendError(
        'quota',
        `Snippet limit reached: each account can store up to ${SNIPPET_QUOTA} snippets`,
      );
    }
  };

  return {
    kind: 'mock',

    auth: {
      getUser: () => run((db) => toAuthUser(currentUser(db))),

      onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      capabilities: async () => ({ github: false, emailConfirmation: false }),

      signInWithPassword: (email, password) =>
        run(async (db) => {
          const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
          if (!user || user.passwordHash !== (await hashPassword(user.email, password))) {
            throw new BackendError('auth', 'Invalid email or password.');
          }
          setSession(db, user.id);
        }),

      signUp: ({ email, password, displayName }) =>
        run(async (db) => {
          const normalized = email.trim().toLowerCase();
          if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
            throw new BackendError('auth', 'An account with this email already exists.');
          }
          const user: StoredUser = {
            id: newId(),
            email: normalized,
            passwordHash: await hashPassword(normalized, password),
            displayName: displayName?.trim() || normalized.split('@')[0] || 'You',
            isDemo: false,
          };
          db.users.push(user);
          setSession(db, user.id);
          return { needsConfirmation: false };
        }),

      signInWithGitHub: async () => {
        throw new BackendError('invalid', 'GitHub sign-in needs the Supabase backend.');
      },

      signInAsDemo: () => run((db) => setSession(db, DEMO_USER_ID)),

      signOut: () => run((db) => setSession(db, null)),

      getProfile: () =>
        run((db): Profile | null => {
          const user = currentUser(db);
          return user
            ? { id: user.id, displayName: user.displayName, avatarUrl: null, isDemo: user.isDemo }
            : null;
        }),
    },

    snippets: {
      search: (params: SearchParams) =>
        run((db): SearchPage => {
          const uid = db.sessionUserId;
          const pageSize = Math.min(Math.max(params.pageSize ?? 24, 1), 100);
          const offset = Math.max(params.offset ?? 0, 0);
          const wantedTags = (params.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);

          const hits = db.snippets
            .filter((s) => canRead(s, uid) && inScope(s, params.scope, uid))
            .filter((s) => wantedTags.every((t) => s.tags.includes(t)))
            .filter((s) => !params.language || s.language === params.language)
            .map((s) => ({ s, rank: rankMatch(s, params.search ?? '') }))
            .filter((hit): hit is { s: StoredSnippet; rank: number } => hit.rank !== null)
            .sort(
              (a, b) =>
                b.rank - a.rank ||
                b.s.updatedAt.localeCompare(a.s.updatedAt) ||
                a.s.id.localeCompare(b.s.id),
            );

          const items: SnippetSummary[] = hits
            .slice(offset, offset + pageSize)
            .map(({ s, rank }) => {
              const { code, ...rest } = toSnippet(db, s, uid);
              return { ...rest, codePreview: code.slice(0, PREVIEW_CHARS), rank };
            });
          const next = offset + items.length;
          return { items, total: hits.length, nextOffset: next < hits.length ? next : null };
        }),

      facets: (scope) =>
        run((db): Facets => {
          const uid = db.sessionUserId;
          const visible = db.snippets.filter((s) => canRead(s, uid) && inScope(s, scope, uid));
          const count = (values: string[]) => {
            const counts = new Map<string, number>();
            values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
            return [...counts]
              .map(([value, n]) => ({ value, count: n }))
              .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
          };
          return {
            tags: count(visible.flatMap((s) => s.tags)),
            languages: count(visible.map((s) => s.language)),
          };
        }),

      get: (id) =>
        run((db) => {
          const s = db.snippets.find((x) => x.id === id);
          return s && canRead(s, db.sessionUserId) ? toSnippet(db, s, db.sessionUserId) : null;
        }),

      create: (input) =>
        run((db) => {
          const user = requireUser(db);
          const value = validate(input);
          assertQuota(db, user.id, 1);
          const stamp = now().toISOString();
          const s: StoredSnippet = {
            ...value,
            id: newId(),
            ownerId: user.id,
            createdAt: stamp,
            updatedAt: stamp,
          };
          db.snippets.push(s);
          save(db);
          return toSnippet(db, s, user.id);
        }),

      update: (id, patch) =>
        run((db) => {
          const user = requireUser(db);
          const s = db.snippets.find((x) => x.id === id && x.ownerId === user.id);
          if (!s) throw new BackendError('not_found', 'That snippet doesn’t exist or isn’t yours.');
          const value = validate({ ...s, ...patch });
          Object.assign(s, value, { updatedAt: now().toISOString() });
          save(db);
          return toSnippet(db, s, user.id);
        }),

      remove: (id) =>
        run((db) => {
          const user = requireUser(db);
          const index = db.snippets.findIndex((x) => x.id === id && x.ownerId === user.id);
          if (index === -1)
            throw new BackendError('not_found', 'That snippet doesn’t exist or isn’t yours.');
          db.snippets.splice(index, 1);
          save(db);
        }),

      importMany: (inputs) =>
        run((db) => {
          const user = requireUser(db);
          const values = inputs.map(validate);
          assertQuota(db, user.id, values.length);
          const stamp = now().toISOString();
          db.snippets.push(
            ...values.map((v) => ({
              ...v,
              id: newId(),
              ownerId: user.id,
              createdAt: stamp,
              updatedAt: stamp,
            })),
          );
          save(db);
          return values.length;
        }),

      exportAll: () =>
        run((db) => {
          const user = requireUser(db);
          return db.snippets
            .filter((s) => s.ownerId === user.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((s) => toSnippet(db, s, user.id));
        }),
    },
  };
}
