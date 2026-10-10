import { describe, expect, it } from 'vitest';
import type { Snippet } from '../backend/types';
import {
  buildExport,
  exportFilename,
  ImportFileError,
  MAX_IMPORT_SNIPPETS,
  planImport,
} from './importExport';

const snippet: Snippet = {
  id: '5a1e0001-0000-4000-8000-000000000001',
  ownerId: 'owner',
  title: 'useDebounce hook',
  description: 'Debounce a value',
  code: 'export const x = 1;',
  language: 'typescript',
  tags: ['react', 'hooks'],
  visibility: 'public',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  author: { name: 'Demo', avatarUrl: null },
};

describe('export', () => {
  it('builds a versioned file without ids or owner data', () => {
    const file = buildExport([snippet], new Date('2026-10-10T12:00:00Z'));
    expect(file).toEqual({
      format: 'codesnip',
      version: 1,
      exportedAt: '2026-10-10T12:00:00.000Z',
      snippets: [
        {
          title: 'useDebounce hook',
          description: 'Debounce a value',
          language: 'typescript',
          tags: ['react', 'hooks'],
          visibility: 'public',
          code: 'export const x = 1;',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(file)).not.toContain('owner');
  });

  it('names the file by date', () => {
    expect(exportFilename(new Date('2026-10-10T12:00:00Z'))).toBe(
      'codesnip-export-2026-10-10.json',
    );
  });
});

describe('planImport', () => {
  it('round-trips an export, making everything private by default', () => {
    const plan = planImport(JSON.stringify(buildExport([snippet])));
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.snippets).toEqual([
      {
        title: 'useDebounce hook',
        description: 'Debounce a value',
        code: 'export const x = 1;',
        language: 'typescript',
        tags: ['react', 'hooks'],
        visibility: 'private',
      },
    ]);
  });

  it('keeps public visibility only when asked to', () => {
    const plan = planImport(JSON.stringify(buildExport([snippet])), { keepVisibility: true });
    expect(plan.snippets[0]?.visibility).toBe('public');
  });

  it('accepts a bare array with alternative field names', () => {
    const plan = planImport(
      JSON.stringify([
        { name: 'gist', content: 'print(1)', filename: 'hello.py', tags: 'python, Scripts' },
      ]),
    );
    expect(plan.snippets).toEqual([
      {
        title: 'gist',
        description: '',
        code: 'print(1)',
        language: 'python',
        tags: ['python', 'scripts'],
        visibility: 'private',
      },
    ]);
  });

  it('skips bad entries with a reason and keeps the good ones', () => {
    const plan = planImport(
      JSON.stringify([
        { title: 'ok', code: 'x' },
        { code: 'no title' },
        { title: 'no code', code: '  ' },
        'not an object',
        { title: 'x'.repeat(201), code: 'x' },
      ]),
    );
    expect(plan.snippets.map((s) => s.title)).toEqual(['ok']);
    expect(plan.errors).toEqual([
      { index: 2, message: 'Missing title.' },
      { index: 3, message: '“no code” has no code.' },
      { index: 4, message: 'Not a snippet object.' },
      { index: 5, message: 'Title is longer than 200 characters.' },
    ]);
  });

  it('repairs fixable problems and reports them as warnings', () => {
    const plan = planImport(
      JSON.stringify([
        {
          title: 'odd',
          code: 'x',
          language: 'COBOL',
          tags: ['good', 'has space', ...Array.from({ length: 12 }, (_, i) => `t${i}`)],
        },
      ]),
    );
    expect(plan.snippets[0]).toMatchObject({
      language: 'plaintext',
      tags: ['good', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
    });
    expect(plan.warnings[0]?.message).toMatch(
      /unknown language “cobol”, dropped invalid tags, kept the first 10 tags/,
    );
  });

  it.each([
    ['not json', /valid JSON/],
    ['{"hello": "world"}', /Expected a CodeSnip export/],
    ['[]', /No snippets/],
    [
      JSON.stringify(
        Array.from({ length: MAX_IMPORT_SNIPPETS + 1 }, () => ({ title: 't', code: 'c' })),
      ),
      /at most 500/,
    ],
  ])('rejects unusable files: %#', (text, message) => {
    expect(() => planImport(text)).toThrow(ImportFileError);
    expect(() => planImport(text)).toThrow(message);
  });
});
