import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../apps/web/src/lib/languages';
import { ADA_ID, ADA_PRIVATE_SNIPPET_ID, DEMO_ID, withTx } from './db';

const CHECK_VIOLATION = '23514';
const FK_VIOLATION = '23503';

describe('snippet writes', () => {
  it('normalise tags: trim, lowercase, drop blanks, de-duplicate in first-seen order', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const id = await tx.createSnippet(userId, {
        tags: [' React ', 'hooks', 'react', '', 'HOOKS', 'c++'],
      });
      const [row] = await tx.rows<{ tags: string[] }>(
        'select tags from public.snippets where id = $1',
        [id],
      );
      expect(row?.tags).toEqual(['react', 'hooks', 'c++']);
    });
  });

  it('trim the title and description', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const id = await tx.createSnippet(userId, { title: '  Spaced  ', description: '  desc ' });
      const [row] = await tx.rows('select title, description from public.snippets where id = $1', [
        id,
      ]);
      expect(row).toEqual({ title: 'Spaced', description: 'desc' });
    });
  });

  it.each([
    ['a blank title', { title: '   ' }, CHECK_VIOLATION],
    ['a 201-char title', { title: 'x'.repeat(201) }, CHECK_VIOLATION],
    ['empty code', { code: '' }, CHECK_VIOLATION],
    ['a tag with spaces', { tags: ['two words'] }, CHECK_VIOLATION],
    ['eleven tags', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, CHECK_VIOLATION],
    ['an unknown language', { language: 'brainfuck' }, FK_VIOLATION],
    ['an unknown visibility', { visibility: 'unlisted' as 'public' }, CHECK_VIOLATION],
  ])('reject %s', async (_label, fields, code) => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as({ userId });
      const err = await tx.error(
        `insert into public.snippets (title, code, language, tags, visibility)
         values ($1, $2, $3, $4, $5)`,
        [
          fields.title ?? 'ok',
          fields.code ?? 'ok',
          fields.language ?? 'plaintext',
          fields.tags ?? [],
          fields.visibility ?? 'private',
        ],
      );
      expect(err.code).toBe(code);
    });
  });

  it('bump updated_at on update but leave created_at alone', async () => {
    await withTx(async (tx) => {
      await tx.as('postgres');
      const [before] = await tx.rows<{ created_at: Date; updated_at: Date }>(
        `select created_at, updated_at from public.snippets where owner_id = $1 order by updated_at limit 1`,
        [DEMO_ID],
      );
      await tx.as({ userId: DEMO_ID });
      const [after] = await tx.rows<{ created_at: Date; updated_at: Date }>(
        `update public.snippets set description = description || '!'
         where id = (select id from public.snippets where owner_id = $1 order by updated_at limit 1)
         returning created_at, updated_at`,
        [DEMO_ID],
      );
      expect(after?.created_at).toEqual(before?.created_at);
      expect(after!.updated_at.getTime()).toBeGreaterThan(before!.updated_at.getTime());
    });
  });

  it('cap each account at 2000 snippets, checked once per statement', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.as({ userId });
      await tx.query(
        `insert into public.snippets (title, code) select 'bulk ' || g, 'x' from generate_series(1, 2000) g`,
      );
      const err = await tx.error(
        `insert into public.snippets (title, code) values ('one more', 'x')`,
      );
      expect(err.code).toBe('54000');
      expect(err.message).toMatch(/2000/);
    });
  });
});

type SearchRow = {
  id: string;
  title: string;
  owner_id: string;
  visibility: string;
  code_preview: string;
  author_name: string | null;
  rank: number;
  total_count: string;
};

describe('search_snippets', () => {
  const search = (args: Record<string, unknown>) => {
    const names = Object.keys(args);
    const sql = `select * from public.search_snippets(${names
      .map((n, i) => `${n} => $${i + 1}`)
      .join(', ')})`;
    return { sql, params: Object.values(args) };
  };

  it('matches word prefixes as you type', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const { sql, params } = search({ search: 'debou' });
      const rows = await tx.rows<SearchRow>(sql, params);
      expect(rows.map((r) => r.title)).toEqual(['useDebounce hook']);
    });
  });

  it('indexes camelCase identifiers inside code', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const { sql, params } = search({ search: 'recorder' });
      const rows = await tx.rows<SearchRow>(sql, params);
      expect(rows.map((r) => r.title)).toEqual(['HTTP logging middleware']);
    });
  });

  it('ranks title matches above code matches', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      const inCode = await tx.createSnippet(userId, {
        title: 'Something',
        code: 'const zebra = 1;',
      });
      const inTitle = await tx.createSnippet(userId, { title: 'Zebra stripes', code: 'x' });
      await tx.as({ userId });
      const { sql, params } = search({ search: 'zebra' });
      const rows = await tx.rows<SearchRow>(sql, params);
      expect(rows.map((r) => r.id)).toEqual([inTitle, inCode]);
      expect(rows[0]!.rank).toBeGreaterThan(rows[1]!.rank);
    });
  });

  it('treats search input as plain text, never tsquery syntax', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      for (const input of [
        'foo:* | bar & !baz',
        "'; drop table snippets; --",
        '(((',
        'the',
        '100%_',
      ]) {
        const { sql, params } = search({ search: input });
        await expect(tx.rows(sql, params), input).resolves.toBeInstanceOf(Array);
      }
    });
  });

  it('filters by tags (all must match) and language', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      let q = search({ tag_filter: ['git'] });
      expect((await tx.rows<SearchRow>(q.sql, q.params)).map((r) => r.title)).toEqual([
        'Delete merged git branches',
      ]);

      q = search({ tag_filter: ['http', 'fetch'] });
      expect((await tx.rows<SearchRow>(q.sql, q.params)).map((r) => r.title)).toEqual([
        'fetch with a timeout',
      ]);

      q = search({ tag_filter: ['HTTP '] });
      expect(await tx.rows<SearchRow>(q.sql, q.params)).toHaveLength(3);

      q = search({ lang: 'python' });
      const python = await tx.rows<SearchRow>(q.sql, q.params);
      expect(python).toHaveLength(2);
    });
  });

  it('scope=mine never returns other users’ snippets, even public ones', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const { sql, params } = search({ scope: 'mine', page_size: 100 });
      const rows = await tx.rows<SearchRow>(sql, params);
      expect(rows).toHaveLength(12);
      expect(rows.every((r) => r.owner_id === DEMO_ID)).toBe(true);
    });
  });

  it('scope=mine returns nothing for anonymous visitors', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const { sql, params } = search({ scope: 'mine' });
      expect(await tx.rows(sql, params)).toEqual([]);
    });
  });

  it('scope=public returns public snippets with author names, never private ones', async () => {
    await withTx(async (tx) => {
      for (const actor of ['anon', { userId: DEMO_ID }, { userId: ADA_ID }] as const) {
        await tx.as(actor);
        const { sql, params } = search({ scope: 'public', page_size: 100 });
        const rows = await tx.rows<SearchRow>(sql, params);
        expect(rows).toHaveLength(7);
        expect(rows.every((r) => r.visibility === 'public')).toBe(true);
        expect(rows.every((r) => r.author_name)).toBe(true);
      }
    });
  });

  it('does not leak private snippets through search', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      for (const scope of ['mine', 'public']) {
        const { sql, params } = search({ search: 'analytical engine', scope });
        const rows = await tx.rows<SearchRow>(sql, params);
        expect(rows.map((r) => r.id)).not.toContain(ADA_PRIVATE_SNIPPET_ID);
      }
    });
  });

  it('paginates and reports the total count', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const first = search({ page_size: 5, page_offset: 0 });
      const second = search({ page_size: 5, page_offset: 5 });
      const a = await tx.rows<SearchRow>(first.sql, first.params);
      const b = await tx.rows<SearchRow>(second.sql, second.params);
      expect(a).toHaveLength(5);
      expect(b).toHaveLength(5);
      expect(Number(a[0]!.total_count)).toBe(12);
      expect(new Set([...a, ...b].map((r) => r.id)).size).toBe(10);
    });
  });

  it('returns a code preview, not the full snippet', async () => {
    await withTx(async (tx) => {
      const userId = await tx.createUser();
      await tx.createSnippet(userId, { code: 'x'.repeat(5000) });
      await tx.as({ userId });
      const { sql, params } = search({});
      const [row] = await tx.rows<SearchRow>(sql, params);
      expect(row?.code_preview).toHaveLength(600);
    });
  });

  it('rejects an unknown scope', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const { sql, params } = search({ scope: 'everything' });
      const err = await tx.error(sql, params);
      expect(err.code).toBe('22023');
    });
  });
});

describe('snippet_facets', () => {
  type Facet = { kind: 'tag' | 'language'; value: string; count: string };

  it('counts the caller’s tags and languages', async () => {
    await withTx(async (tx) => {
      await tx.as({ userId: DEMO_ID });
      const rows = await tx.rows<Facet>(`select * from public.snippet_facets('mine')`);
      const languages = rows.filter((r) => r.kind === 'language');
      expect(languages.reduce((sum, r) => sum + Number(r.count), 0)).toBe(12);
      expect(rows).toContainEqual({ kind: 'tag', value: 'http', count: '3' });
    });
  });

  it('only counts public snippets in public scope', async () => {
    await withTx(async (tx) => {
      await tx.as('anon');
      const rows = await tx.rows<Facet>(`select * from public.snippet_facets('public')`);
      expect(rows.map((r) => r.value)).not.toContain('private-draft');
      expect(
        rows.filter((r) => r.kind === 'language').reduce((s, r) => s + Number(r.count), 0),
      ).toBe(7);
    });
  });
});

describe('languages', () => {
  it('match the list the web app offers', async () => {
    await withTx(async (tx) => {
      const rows = await tx.rows<{ id: string; label: string }>(
        'select id, label from public.languages order by id',
      );
      const app = [...LANGUAGES]
        .map(({ id, label }) => ({ id, label }))
        .sort((a, b) => a.id.localeCompare(b.id));
      expect(rows).toEqual(app);
    });
  });
});
