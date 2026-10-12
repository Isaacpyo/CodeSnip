import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTags, parseTagInput, tagError } from './tags';

describe('tags', () => {
  it('normalises like the database trigger: trim, lowercase, dedupe, keep order', () => {
    expect(normalizeTags([' React ', 'hooks', 'react', '', 'HOOKS', 'c++'])).toEqual([
      'react',
      'hooks',
      'c++',
    ]);
  });

  it('parses comma and whitespace separated input', () => {
    expect(parseTagInput('react, Hooks  perf,,')).toEqual(['react', 'hooks', 'perf']);
  });

  it.each([
    ['react', true],
    ['c#', true],
    ['node.js', true],
    ['web-components', true],
    ['-leading-dash', false],
    ['has space', false],
    ['UPPER', false],
    ['x'.repeat(33), false],
  ])('isValidTag(%s) is %s', (tag, valid) => {
    expect(isValidTag(tag)).toBe(valid);
  });

  it('explains why a tag is invalid', () => {
    expect(tagError('ok')).toBeNull();
    expect(tagError('x'.repeat(40))).toMatch(/at most 32/);
    expect(tagError('!bad')).toMatch(/start with a letter or number/);
  });
});
