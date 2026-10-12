/** Mirrors the database rules in supabase/migrations (tags_are_valid + write trigger). */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 32;
const TAG_PATTERN = /^[a-z0-9][a-z0-9_.+#-]{0,31}$/;

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}

/** Trim, lowercase, drop blanks and duplicates, keep first-seen order. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** Splits free text like "react, hooks  perf" into tags. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(/[\s,]+/));
}

export function tagError(tag: string): string | null {
  if (!tag) return null;
  if (tag.length > MAX_TAG_LENGTH) return `Tags can be at most ${MAX_TAG_LENGTH} characters.`;
  if (!isValidTag(tag)) {
    return 'Tags start with a letter or number and may contain - _ . + #';
  }
  return null;
}
