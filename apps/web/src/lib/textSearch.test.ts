import { describe, expect, it } from 'vitest';
import { queryWords, rankMatch, splitIdentifiers } from './textSearch';

const base = {
  title: 'useDebounce hook',
  description: 'Debounce a value',
  tags: ['react'],
  language: 'typescript',
  code: 'const statusRecorder = 1',
};

describe('textSearch', () => {
  it('splits camelCase identifiers', () => {
    expect(splitIdentifiers('useDebounce')).toBe('useDebounce use Debounce');
  });

  it('turns free text into at most 10 lowercase words, ignoring syntax', () => {
    expect(queryWords("Foo:* | bar & !baz '; drop")).toEqual(['foo', 'bar', 'baz', 'drop']);
    expect(queryWords(Array.from({ length: 15 }, (_, i) => `w${i}`).join(' '))).toHaveLength(10);
  });

  it('matches word prefixes across fields', () => {
    expect(rankMatch(base, 'debou')).toBeGreaterThan(0);
    expect(rankMatch(base, 'recorder')).toBeGreaterThan(0);
    expect(rankMatch(base, 'reac hoo')).toBeGreaterThan(0);
    expect(rankMatch(base, 'python')).toBeNull();
  });

  it('requires every word to match', () => {
    expect(rankMatch(base, 'debounce python')).toBeNull();
  });

  it('ranks title matches above code matches', () => {
    const inTitle = rankMatch({ ...base, title: 'Zebra', code: 'x' }, 'zebra')!;
    const inCode = rankMatch({ ...base, title: 'Other', code: 'zebra' }, 'zebra')!;
    expect(inTitle).toBeGreaterThan(inCode);
  });

  it('returns 0 for an empty query and falls back to title substrings', () => {
    expect(rankMatch(base, '   ')).toBe(0);
    expect(rankMatch(base, 'bounce h')).toBeGreaterThan(0);
  });
});
