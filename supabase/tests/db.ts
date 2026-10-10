import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres';

/** Seeded accounts (see supabase/seed.sql). */
export const DEMO_ID = 'd3e0d3e0-0000-4000-8000-000000000001';
export const ADA_ID = 'ada0ada0-0000-4000-8000-000000000002';
export const ADA_PRIVATE_SNIPPET_ID = '5a1e0002-0000-4000-8000-000000000005';
export const DEMO_PUBLIC_SNIPPET_ID = '5a1e0001-0000-4000-8000-000000000001';
export const DEMO_PRIVATE_SNIPPET_ID = '5a1e0001-0000-4000-8000-000000000002';

export type Actor = 'postgres' | 'anon' | { userId: string };

type Row = Record<string, unknown>;

/**
 * One transaction on a dedicated connection. `as()` switches between the
 * migration owner and the API roles exactly the way PostgREST does
 * (SET ROLE + request.jwt.claims), so RLS and column grants apply for real.
 * Everything is rolled back in `end()`.
 */
export class Tx {
  private constructor(private readonly client: pg.Client) {}

  static async begin(): Promise<Tx> {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query('begin');
    return new Tx(client);
  }

  async end(): Promise<void> {
    try {
      await this.client.query('rollback');
    } finally {
      await this.client.end();
    }
  }

  async as(actor: Actor): Promise<this> {
    await this.client.query('reset role');
    if (actor === 'postgres') {
      await this.client.query(`select set_config('request.jwt.claims', '', true)`);
      return this;
    }
    const claims =
      actor === 'anon'
        ? { role: 'anon' }
        : { sub: actor.userId, role: 'authenticated', aud: 'authenticated' };
    await this.client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(claims),
    ]);
    await this.client.query(`set local role ${actor === 'anon' ? 'anon' : 'authenticated'}`);
    return this;
  }

  async query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<pg.QueryResult<T>> {
    return this.client.query<T>(sql, params);
  }

  async rows<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.client.query<T>(sql, params)).rows;
  }

  /** Runs a statement that must fail; returns the Postgres error and keeps the transaction usable. */
  async error(sql: string, params: unknown[] = []): Promise<pg.DatabaseError> {
    await this.client.query('savepoint expect_error');
    try {
      await this.client.query(sql, params);
    } catch (err) {
      await this.client.query('rollback to savepoint expect_error');
      if (err instanceof pg.DatabaseError) return err;
      throw err;
    }
    await this.client.query('release savepoint expect_error');
    throw new Error(`Expected statement to fail but it succeeded:\n${sql}`);
  }

  /** Creates a confirmed user (the signup trigger creates the profile). Runs as postgres. */
  async createUser(
    meta: Record<string, unknown> = {},
    email = `user-${randomUUID()}@test.local`,
  ): Promise<string> {
    const id = randomUUID();
    await this.as('postgres');
    await this.client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
         'x', now(), '{"provider":"email"}', $3, now(), now())`,
      [id, email, JSON.stringify(meta)],
    );
    return id;
  }

  /** Inserts a snippet through the API role of `userId` and returns its id. */
  async createSnippet(
    userId: string,
    fields: Partial<{
      title: string;
      description: string;
      code: string;
      language: string;
      tags: string[];
      visibility: 'public' | 'private';
    }> = {},
  ): Promise<string> {
    await this.as({ userId });
    const { rows } = await this.client.query<{ id: string }>(
      `insert into public.snippets (title, description, code, language, tags, visibility)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        fields.title ?? 'Test snippet',
        fields.description ?? '',
        fields.code ?? 'console.log(1);',
        fields.language ?? 'javascript',
        fields.tags ?? [],
        fields.visibility ?? 'private',
      ],
    );
    return rows[0]!.id;
  }
}

/** Opens a transaction for the duration of `fn` and always rolls it back. */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await Tx.begin();
  try {
    return await fn(tx);
  } finally {
    await tx.end();
  }
}
