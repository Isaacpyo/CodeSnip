import { describe, expect, it } from 'vitest';
import { COMMUNITY_USER_ID, DEMO_SNIPPETS, DEMO_USER_ID } from './demoData';
import { BackendError } from './errors';
import { createMemoryBackend, DEMO_PASSWORD, STORAGE_KEY } from './memory';
import type { SnippetInput } from './types';

const ADA_PRIVATE = '5a1e0002-0000-4000-8000-000000000005';
const DEMO_PUBLIC = '5a1e0001-0000-4000-8000-000000000001';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const input: SnippetInput = {
  title: 'New one',
  description: '',
  code: 'console.log(1)',
  language: 'javascript',
  tags: ['Test'],
  visibility: 'private',
};

async function asDemo() {
  const backend = createMemoryBackend({ storage: memoryStorage() });
  await backend.auth.signInAsDemo();
  return backend;
}

async function asNewUser(storage = memoryStorage()) {
  const backend = createMemoryBackend({ storage });
  await backend.auth.signUp({
    email: 'new@test.dev',
    password: 'password123',
    displayName: 'Newbie',
  });
  return backend;
}

const expectError = async (promise: Promise<unknown>, code: BackendError['code']) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe('memory backend: auth', () => {
  it('starts signed out, signs in with the demo password, and signs out', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    expect(await backend.auth.getUser()).toBeNull();
    await backend.auth.signInWithPassword('DEMO@codesnip.dev', DEMO_PASSWORD);
    expect(await backend.auth.getUser()).toEqual({ id: DEMO_USER_ID, email: 'demo@codesnip.dev' });
    expect(await backend.auth.getProfile()).toMatchObject({
      displayName: 'Demo User',
      isDemo: true,
    });
    await backend.auth.signOut();
    expect(await backend.auth.getUser()).toBeNull();
  });

  it('rejects wrong passwords and duplicate sign-ups', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    await expectError(backend.auth.signInWithPassword('demo@codesnip.dev', 'nope'), 'auth');
    await expectError(backend.auth.signInWithPassword('ada@codesnip.dev', ''), 'auth');
    await expectError(
      backend.auth.signUp({ email: 'demo@codesnip.dev', password: 'whatever1' }),
      'auth',
    );
  });

  it('notifies listeners on sign-in and sign-out', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    const events: (string | null)[] = [];
    backend.auth.onChange((user) => events.push(user?.id ?? null));
    await backend.auth.signInAsDemo();
    await backend.auth.signOut();
    await Promise.resolve();
    expect(events).toEqual([DEMO_USER_ID, null]);
  });

  it('persists to storage and survives a reload', async () => {
    const storage = memoryStorage();
    const first = await asNewUser(storage);
    const created = await first.snippets.create(input);
    const reloaded = createMemoryBackend({ storage });
    expect(await reloaded.auth.getUser()).toMatchObject({ email: 'new@test.dev' });
    expect(await reloaded.snippets.get(created.id)).toMatchObject({ title: 'New one' });
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });

  it('does not support GitHub', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    expect(await backend.auth.capabilities()).toEqual({ github: false, emailConfirmation: false });
    await expectError(backend.auth.signInWithGitHub('/'), 'invalid');
  });
});

describe('memory backend: visibility rules mirror RLS', () => {
  it('anonymous visitors see public snippets only', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    const page = await backend.snippets.search({ scope: 'public', pageSize: 100 });
    expect(page.total).toBe(DEMO_SNIPPETS.filter((s) => s.visibility === 'public').length);
    expect(await backend.snippets.get(ADA_PRIVATE)).toBeNull();
    expect((await backend.snippets.search({ scope: 'mine' })).total).toBe(0);
  });

  it('signed-in users see their own snippets in "mine" and never others’ private ones', async () => {
    const backend = await asDemo();
    const mine = await backend.snippets.search({ scope: 'mine', pageSize: 100 });
    expect(mine.total).toBe(DEMO_SNIPPETS.filter((s) => s.ownerId === DEMO_USER_ID).length);
    expect(mine.items.every((s) => s.ownerId === DEMO_USER_ID)).toBe(true);
    expect(await backend.snippets.get(ADA_PRIVATE)).toBeNull();
    const pub = await backend.snippets.search({ scope: 'public', search: 'analytical' });
    expect(pub.total).toBe(0);
  });

  it('only owners can update or delete', async () => {
    const backend = await asNewUser();
    await expectError(backend.snippets.update(DEMO_PUBLIC, { title: 'pwned' }), 'not_found');
    await expectError(backend.snippets.remove(DEMO_PUBLIC), 'not_found');
    expect(await backend.snippets.get(DEMO_PUBLIC)).toMatchObject({ title: 'useDebounce hook' });
  });

  it('writes require a session', async () => {
    const backend = createMemoryBackend({ storage: memoryStorage() });
    await expectError(backend.snippets.create(input), 'auth');
    await expectError(backend.snippets.importMany([input]), 'auth');
    await expectError(backend.snippets.exportAll(), 'auth');
  });

  it('shows author names to the owner and for published authors', async () => {
    const backend = await asNewUser();
    const created = await backend.snippets.create(input);
    expect(created.author.name).toBe('Newbie'); // visible to themselves
    await backend.auth.signOut();
    const page = await backend.snippets.search({ scope: 'public', pageSize: 100 });
    expect(page.items.find((s) => s.ownerId === COMMUNITY_USER_ID)?.author.name).toBe(
      'Ada Lovelace',
    );
  });
});

describe('memory backend: snippets', () => {
  it('creates, updates and deletes, normalising input like the database', async () => {
    const backend = await asNewUser();
    const created = await backend.snippets.create({
      ...input,
      title: '  Spaced ',
      tags: ['B', 'a', 'b'],
    });
    expect(created).toMatchObject({ title: 'Spaced', tags: ['b', 'a'], visibility: 'private' });

    const updated = await backend.snippets.update(created.id, { visibility: 'public' });
    expect(updated.visibility).toBe('public');
    expect(updated.title).toBe('Spaced');

    await backend.snippets.remove(created.id);
    expect(await backend.snippets.get(created.id)).toBeNull();
  });

  it('rejects invalid input', async () => {
    const backend = await asNewUser();
    await expectError(backend.snippets.create({ ...input, title: '' }), 'invalid');
    await expectError(backend.snippets.create({ ...input, language: 'cobol' }), 'invalid');
  });

  it('searches with prefixes, tags and language, ranked and paginated', async () => {
    const backend = await asDemo();
    const hits = await backend.snippets.search({ scope: 'mine', search: 'debou' });
    expect(hits.items.map((s) => s.title)).toEqual(['useDebounce hook']);

    const tagged = await backend.snippets.search({ scope: 'mine', tags: ['http', 'fetch'] });
    expect(tagged.items.map((s) => s.title)).toEqual(['fetch with a timeout']);

    const python = await backend.snippets.search({ scope: 'mine', language: 'python' });
    expect(python.total).toBe(2);

    const page1 = await backend.snippets.search({ scope: 'mine', pageSize: 5 });
    expect(page1.items).toHaveLength(5);
    expect(page1.nextOffset).toBe(5);
    const last = await backend.snippets.search({ scope: 'mine', pageSize: 5, offset: 10 });
    expect(last.nextOffset).toBeNull();
    expect(page1.items[0]!.codePreview.length).toBeLessThanOrEqual(600);
  });

  it('computes facets for the scope', async () => {
    const backend = await asDemo();
    const facets = await backend.snippets.facets('mine');
    expect(facets.tags).toContainEqual({ value: 'http', count: 3 });
    expect(facets.languages.reduce((sum, l) => sum + l.count, 0)).toBe(12);
  });

  it('imports atomically and exports only the caller’s snippets', async () => {
    const backend = await asNewUser();
    expect(await backend.snippets.importMany([input, { ...input, title: 'Second' }])).toBe(2);
    await expectError(backend.snippets.importMany([input, { ...input, title: '' }]), 'invalid');
    const exported = await backend.snippets.exportAll();
    expect(exported.map((s) => s.title).sort()).toEqual(['New one', 'Second']);
  });

  it('enforces the per-account quota', async () => {
    const backend = await asNewUser();
    const many = Array.from({ length: 2000 }, (_, i) => ({ ...input, title: `n${i}` }));
    expect(await backend.snippets.importMany(many)).toBe(2000);
    await expectError(backend.snippets.create(input), 'quota');
  });

  it('returns copies, so callers cannot mutate the store', async () => {
    const backend = await asDemo();
    const s = await backend.snippets.get(DEMO_PUBLIC);
    s!.title = 'mutated';
    expect((await backend.snippets.get(DEMO_PUBLIC))!.title).toBe('useDebounce hook');
  });
});
