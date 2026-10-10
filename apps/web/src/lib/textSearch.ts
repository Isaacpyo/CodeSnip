/**
 * In-memory approximation of the Postgres search in search_snippets(), used by
 * the mock backend: prefix matching on words (camelCase split), weighted
 * title > description/tags > language > code, plus a title substring fallback.
 */
export interface SearchableFields {
  title: string;
  description: string;
  tags: readonly string[];
  language: string;
  code: string;
}

const WEIGHTS = { title: 1, description: 0.4, tags: 0.4, language: 0.2, code: 0.1 } as const;
const MAX_QUERY_WORDS = 10;
const MAX_CODE_CHARS = 20_000;

export function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)
    .slice(0, MAX_QUERY_WORDS);
}

export function splitIdentifiers(text: string): string {
  return `${text} ${text.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')}`;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean);
}

/** Returns a rank > 0 when the snippet matches, 0 when the query is empty, null when it doesn't match. */
export function rankMatch(fields: SearchableFields, query: string): number | null {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const fieldWords: [number, Set<string>][] = [
    [WEIGHTS.title, new Set(words(splitIdentifiers(fields.title)))],
    [WEIGHTS.description, new Set(words(fields.description))],
    [WEIGHTS.tags, new Set(fields.tags.flatMap(words))],
    [WEIGHTS.language, new Set(words(fields.language))],
    [WEIGHTS.code, new Set(words(splitIdentifiers(fields.code.slice(0, MAX_CODE_CHARS))))],
  ];

  const terms = queryWords(trimmed);
  let rank = 0;
  let allMatched = terms.length > 0;
  for (const term of terms) {
    let best = 0;
    for (const [weight, set] of fieldWords) {
      if (weight > best && [...set].some((w) => w.startsWith(term))) best = weight;
    }
    if (best === 0) allMatched = false;
    rank += best;
  }
  if (allMatched) return rank;
  if (fields.title.toLowerCase().includes(trimmed.toLowerCase())) return 0.01;
  return null;
}
