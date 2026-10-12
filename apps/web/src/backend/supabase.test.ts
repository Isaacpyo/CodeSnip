import { describe, expect, it } from 'vitest';
import { facetRowsToFacets, rowToSnippet, searchRowToSummary } from './supabase';

describe('supabase row mapping', () => {
  it('maps a snippet row with its embedded author', () => {
    expect(
      rowToSnippet({
        id: 'id',
        owner_id: 'owner',
        title: 't',
        description: 'd',
        code: 'c',
        language: 'go',
        tags: ['a'],
        visibility: 'public',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
        author: { display_name: 'Ada', avatar_url: null },
      }),
    ).toEqual({
      id: 'id',
      ownerId: 'owner',
      title: 't',
      description: 'd',
      code: 'c',
      language: 'go',
      tags: ['a'],
      visibility: 'public',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      author: { name: 'Ada', avatarUrl: null },
    });
  });

  it('copes with a hidden author (RLS returns no profile)', () => {
    const s = rowToSnippet({
      id: 'id',
      owner_id: 'o',
      title: 't',
      description: '',
      code: 'c',
      language: 'go',
      tags: [],
      visibility: 'private',
      created_at: '',
      updated_at: '',
      author: null,
    });
    expect(s.author).toEqual({ name: null, avatarUrl: null });
  });

  it('maps search rows and facet rows', () => {
    const summary = searchRowToSummary({
      id: 'id',
      owner_id: 'o',
      title: 't',
      description: '',
      code_preview: 'preview',
      language: 'sql',
      tags: [],
      visibility: 'public',
      created_at: '',
      updated_at: '',
      author_name: 'Ada',
      author_avatar_url: 'https://x',
      rank: 0.5,
      total_count: 3,
    });
    expect(summary).toMatchObject({
      codePreview: 'preview',
      rank: 0.5,
      author: { name: 'Ada', avatarUrl: 'https://x' },
    });

    expect(
      facetRowsToFacets([
        { kind: 'tag', value: 'react', count: 2 },
        { kind: 'language', value: 'go', count: '1' as unknown as number },
      ]),
    ).toEqual({ tags: [{ value: 'react', count: 2 }], languages: [{ value: 'go', count: 1 }] });
  });
});
