import { describe, expect, it } from 'vitest';
import {
  ADA_ID,
  ADA_PRIVATE_SNIPPET_ID,
  DEMO_ID,
  DEMO_PRIVATE_SNIPPET_ID,
  DEMO_PUBLIC_SNIPPET_ID,
  withTx,
} from './db';

const INSUFFICIENT_PRIVILEGE = '42501';

describe('RLS is enabled everywhere', () => {
  it('has row level security on every table in the public schema', async () => {
    await withTx(async (tx) => {
      const rows = await tx.rows<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
    });
  });
});

describe('snippets: anonymous visitors', () => {
  it('can read public snippets only', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const rows = await tx.rows<{ visibility: string }>('select visibility from public.snippets');
      expect(rows.length).toBeGreaterThanOrEqual(7);
      expect(rows.every((r) => r.visibility === 'public')).toBe(true);
    });
  });

  it('cannot read a private snippet even by id', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const rows = await tx.rows('select id from public.snippets where id = $1', [
        ADA_PRIVATE_SNIPPET_ID,
      ]);
      expect(rows).toEqual([]);
    });
  });

  it('cannot insert, update or delete', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const insert = await tx.error(`insert into public.snippets (title, code) values ('x', 'y')`);
      expect(insert.code).toBe(INSUFFICIENT_PRIVILEGE);
      const update = await tx.error(`update public.snippets set title = 'pwned' where id = $1`, [
        DEMO_PUBLIC_SNIPPET_ID,
      ]);
      expect(update.code).toBe(INSUFFICIENT_PRIVILEGE);
      const del = await tx.error(`delete from public.snippets where id = $1`, [
        DEMO_PUBLIC_SNIPPET_ID,
      ]);
      expect(del.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });
});

describe('snippets: signed-in users', () => {
  it('see their own private snippets plus everyone’s public ones', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const rows = await tx.rows<{ owner_id: string; visibility: string }>(
        'select owner_id, visibility from public.snippets',
      );
      const foreignPrivate = rows.filter(
        (r) => r.owner_id !== DEMO_ID && r.visibility === 'private',
      );
      expect(foreignPrivate).toEqual([]);
      expect(rows.some((r) => r.owner_id === DEMO_ID && r.visibility === 'private')).toBe(true);
      expect(rows.some((r) => r.owner_id === ADA_ID && r.visibility === 'public')).toBe(true);
    });
  });

  it('cannot read another user’s private snippet', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      expect(
        await tx.rows('select id from public.snippets where id = $1', [ADA_PRIVATE_SNIPPET_ID]),
      ).toEqual([]);
    });
  });

  it('create snippets owned by themselves (owner_id comes from the JWT)', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const id = await tx.createSnippet(userId, { title: 'Mine' });
      const [row] = await tx.rows<{ owner_id: string }>(
        'select owner_id from public.snippets where id = $1',
        [id],
      );
      expect(row?.owner_id).toBe(userId);
    });
  });

  it('cannot choose the owner_id of a new snippet', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as({ userId });
      const err = await tx.error(
        `insert into public.snippets (owner_id, title, code) values ($1, 'spoof', 'x')`,
        [DEMO_ID],
      );
      expect(err.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  it('cannot update or delete someone else’s snippet (rows are invisible to the write)', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as({ userId });
      const updated = await tx.query(`update public.snippets set title = 'pwned' where id = $1`, [
        DEMO_PUBLIC_SNIPPET_ID,
      ]);
      expect(updated.rowCount).toBe(0);
      const deleted = await tx.query(`delete from public.snippets where id = $1`, [
        DEMO_PUBLIC_SNIPPET_ID,
      ]);
      expect(deleted.rowCount).toBe(0);

      await tx.as('postgres');
      const [row] = await tx.rows<{ title: string }>(
        'select title from public.snippets where id = $1',
        [DEMO_PUBLIC_SNIPPET_ID],
      );
      expect(row?.title).toBe('useDebounce hook');
    });
  });

  it('can update and delete their own snippets', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const id = await tx.createSnippet(userId);
      await tx.as({ userId });
      const updated = await tx.query(`update public.snippets set title = 'Renamed' where id = $1`, [
        id,
      ]);
      expect(updated.rowCount).toBe(1);
      const deleted = await tx.query(`delete from public.snippets where id = $1`, [id]);
      expect(deleted.rowCount).toBe(1);
    });
  });

  it('cannot reassign ownership or rewrite server-managed columns', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      for (const assignment of [
        `owner_id = '${ADA_ID}'`,
        `created_at = now() - interval '1 year'`,
        `updated_at = now() - interval '1 year'`,
        `search_vector = ''::tsvector`,
      ]) {
        const err = await tx.error(`update public.snippets set ${assignment} where id = $1`, [
          DEMO_PRIVATE_SNIPPET_ID,
        ]);
        expect(err.code, assignment).toBe(INSUFFICIENT_PRIVILEGE);
      }
    });
  });

  it('hides a snippet from the public as soon as it is made private', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const id = await tx.createSnippet(userId, { visibility: 'public' });

      await tx.as('anon');
      expect(await tx.rows('select id from public.snippets where id = $1', [id])).toHaveLength(1);

      await tx.as({ userId });
      await tx.query(`update public.snippets set visibility = 'private' where id = $1`, [id]);

      await tx.as('anon');
      expect(await tx.rows('select id from public.snippets where id = $1', [id])).toHaveLength(0);
    });
  });
});

describe('profiles', () => {
  it('are created on signup from user metadata, dropping non-https avatars', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser({
        display_name: '  Grace Hopper ',
        avatar_url: 'javascript:alert(1)',
      });
      const [profile] = await tx.rows<{ display_name: string; avatar_url: string | null }>(
        'select display_name, avatar_url from public.profiles where id = $1',
        [userId],
      );
      expect(profile).toEqual({ display_name: 'Grace Hopper', avatar_url: null });
    });
  });

  it('fall back to the GitHub username, then the email local part', async () => {
    await withTx(async (tx) => {
      const github = await tx.createUser({
        user_name: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
      });
      const email = await tx.createUser({}, 'linus@example.com');
      const rows = await tx.rows<{ id: string; display_name: string; avatar_url: string | null }>(
        'select id, display_name, avatar_url from public.profiles where id = any($1)',
        [[github, email]],
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[github]).toMatchObject({
        display_name: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
      });
      expect(byId[email]).toMatchObject({ display_name: 'linus', avatar_url: null });
    });
  });

  it('are public only for users who have published something', async () => {
    await withTx(async (tx) => {
      const quiet = await tx.createUser({ display_name: 'Quiet' });
      await tx.createSnippet(quiet, { visibility: 'private' });

      await tx.as('anon');
      const visible = await tx.rows<{ id: string }>('select id from public.profiles');
      expect(visible.map((r) => r.id)).toContain(ADA_ID);
      expect(visible.map((r) => r.id)).not.toContain(quiet);

      await tx.as({ userId: quiet });
      expect(await tx.rows('select id from public.profiles where id = $1', [quiet])).toHaveLength(
        1,
      );
    });
  });

  it('let users rename themselves but not flip is_demo or edit others', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as({ userId });
      const own = await tx.query(`update public.profiles set display_name = 'New' where id = $1`, [
        userId,
      ]);
      expect(own.rowCount).toBe(1);

      const flag = await tx.error(`update public.profiles set is_demo = true where id = $1`, [
        userId,
      ]);
      expect(flag.code).toBe(INSUFFICIENT_PRIVILEGE);

      const other = await tx.query(`update public.profiles set display_name = 'x' where id = $1`, [
        ADA_ID,
      ]);
      expect(other.rowCount).toBe(0);
    });
  });
});

describe('demo account guard', () => {
  it('blocks password and email changes on the shared demo account', async () => {
    await withTx(async (tx) => {
      await tx.as('postgres');
      const password = await tx.error(
        `update auth.users set encrypted_password = 'hijacked' where id = $1`,
        [DEMO_ID],
      );
      expect(password.code).toBe(INSUFFICIENT_PRIVILEGE);
      const email = await tx.error(`update auth.users set email = 'me@evil.test' where id = $1`, [
        DEMO_ID,
      ]);
      expect(email.code).toBe(INSUFFICIENT_PRIVILEGE);
      const emailChange = await tx.error(
        `update auth.users set email_change = 'me@evil.test' where id = $1`,
        [DEMO_ID],
      );
      expect(emailChange.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  it('still allows normal sign-in bookkeeping and other users’ password changes', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as('postgres');
      const signIn = await tx.query(`update auth.users set last_sign_in_at = now() where id = $1`, [
        DEMO_ID,
      ]);
      expect(signIn.rowCount).toBe(1);
      const other = await tx.query(
        `update auth.users set encrypted_password = 'changed' where id = $1`,
        [userId],
      );
      expect(other.rowCount).toBe(1);
    });
  });
});

describe('languages', () => {
  it('are readable by anonymous visitors but not writable', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      expect((await tx.rows('select id from public.languages')).length).toBeGreaterThan(10);
      const err = await tx.error(
        `insert into public.languages (id, label) values ('cobol', 'COBOL')`,
      );
      expect(err.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });
});
