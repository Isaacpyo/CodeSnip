import { z } from 'zod';
import { isLanguageId } from './languages';
import { MAX_TAGS, isValidTag, normalizeTags } from './tags';
import type { SnippetInput } from '../backend/types';

/** Limits mirror the CHECK constraints in supabase/migrations. */
export const LIMITS = {
  title: 200,
  description: 2000,
  code: 100_000,
} as const;

export const snippetInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your snippet a title.')
    .max(LIMITS.title, `Titles can be at most ${LIMITS.title} characters.`),
  description: z
    .string()
    .trim()
    .max(LIMITS.description, `Descriptions can be at most ${LIMITS.description} characters.`),
  code: z
    .string()
    .refine((code) => code.trim().length > 0, 'Add some code.')
    .refine(
      (code) => code.length <= LIMITS.code,
      `Code can be at most ${LIMITS.code.toLocaleString('en')} characters.`,
    ),
  language: z.string().refine(isLanguageId, 'Pick a language from the list.'),
  tags: z
    .array(z.string())
    .transform(normalizeTags)
    .pipe(
      z
        .array(
          z
            .string()
            .refine(isValidTag, 'Tags start with a letter or number and may contain - _ . + #'),
        )
        .max(MAX_TAGS, `Use at most ${MAX_TAGS} tags.`),
    ),
  visibility: z.enum(['private', 'public']),
});

export type SnippetFieldErrors = Partial<Record<keyof SnippetInput, string>>;

export type ValidationResult =
  { ok: true; value: SnippetInput } | { ok: false; errors: SnippetFieldErrors };

export function validateSnippet(input: SnippetInput): ValidationResult {
  const result = snippetInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const errors: SnippetFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof SnippetInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

export const emailSchema = z.email('Enter a valid email address.');
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
