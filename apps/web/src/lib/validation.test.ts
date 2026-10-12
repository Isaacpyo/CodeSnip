import { describe, expect, it } from 'vitest';
import type { SnippetInput } from '../backend/types';
import { isUuid, validateSnippet } from './validation';

const valid: SnippetInput = {
  title: '  useDebounce  ',
  description: ' Debounce a value ',
  code: 'const x = 1;',
  language: 'typescript',
  tags: ['React', 'react', 'hooks'],
  visibility: 'private',
};

describe('validateSnippet', () => {
  it('accepts valid input and normalises it', () => {
    const result = validateSnippet(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        ...valid,
        title: 'useDebounce',
        description: 'Debounce a value',
        tags: ['react', 'hooks'],
      },
    });
  });

  it.each([
    ['title', { title: '   ' }, /title/i],
    ['title', { title: 'x'.repeat(201) }, /200/],
    ['code', { code: '   \n ' }, /add some code/i],
    ['code', { code: 'x'.repeat(100_001) }, /100,000/],
    ['description', { description: 'x'.repeat(2001) }, /2000/],
    ['language', { language: 'brainfuck' }, /language/i],
    ['tags', { tags: ['has space'] }, /tags start/i],
    ['tags', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, /at most 10/],
  ] as [keyof SnippetInput, Partial<SnippetInput>, RegExp][])(
    'reports an error on %s',
    (field, patch, message) => {
      const result = validateSnippet({ ...valid, ...patch });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[field]).toMatch(message);
    },
  );

  it('rejects an unknown visibility', () => {
    const result = validateSnippet({ ...valid, visibility: 'unlisted' as 'public' });
    expect(result.ok).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts UUIDs and rejects everything else', () => {
    expect(isUuid('5a1e0001-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid("5a1e0001-0000-4000-8000-000000000001' or 1=1")).toBe(false);
  });
});
