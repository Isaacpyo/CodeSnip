import { z } from 'zod';
import type { Snippet, SnippetInput } from '../backend/types';
import { isLanguageId, languageFromFilename } from './languages';
import { MAX_TAGS, isValidTag, normalizeTags } from './tags';
import { LIMITS } from './validation';

export const EXPORT_FORMAT = 'codesnip';
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_SNIPPETS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface ExportedSnippet {
  title: string;
  description: string;
  language: string;
  tags: string[];
  visibility: 'private' | 'public';
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  snippets: ExportedSnippet[];
}

export function buildExport(snippets: readonly Snippet[], now = new Date()): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    snippets: snippets.map((s) => ({
      title: s.title,
      description: s.description,
      language: s.language,
      tags: s.tags,
      visibility: s.visibility,
      code: s.code,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  };
}

export function exportFilename(now = new Date()): string {
  return `codesnip-export-${now.toISOString().slice(0, 10)}.json`;
}

/** Lenient shape for one incoming snippet; unknown keys are ignored. */
const incomingSnippet = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullish(),
  language: z.string().nullish(),
  filename: z.string().nullish(),
  tags: z.union([z.array(z.string()), z.string()]).nullish(),
  visibility: z.string().nullish(),
  code: z.string().optional(),
  content: z.string().optional(),
});

export interface ImportIssue {
  /** 1-based position in the file. */
  index: number;
  message: string;
}

export interface ImportPlan {
  snippets: SnippetInput[];
  /** Entries that will be skipped. */
  errors: ImportIssue[];
  /** Entries that were imported with changes (e.g. unknown language). */
  warnings: ImportIssue[];
}

export interface ImportOptions {
  /** Keep public/private from the file. Off by default: imports are private. */
  keepVisibility?: boolean;
}

export class ImportFileError extends Error {}

/**
 * Parses an export file (or a bare array of snippet objects) into validated
 * inputs. Never throws for individual bad entries: those are reported in
 * `errors` and skipped. Throws ImportFileError when the file itself is unusable.
 */
export function planImport(text: string, options: ImportOptions = {}): ImportPlan {
  if (text.length > MAX_IMPORT_BYTES) {
    throw new ImportFileError('That file is larger than 5 MB.');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportFileError('That file isn’t valid JSON.');
  }

  const entries = extractEntries(data);
  if (entries.length === 0) throw new ImportFileError('No snippets found in that file.');
  if (entries.length > MAX_IMPORT_SNIPPETS) {
    throw new ImportFileError(`Import at most ${MAX_IMPORT_SNIPPETS} snippets at a time.`);
  }

  const plan: ImportPlan = { snippets: [], errors: [], warnings: [] };
  entries.forEach((entry, i) => {
    const index = i + 1;
    const parsed = incomingSnippet.safeParse(entry);
    if (!parsed.success) {
      plan.errors.push({ index, message: 'Not a snippet object.' });
      return;
    }
    const raw = parsed.data;
    const title = (raw.title ?? raw.name ?? raw.filename ?? '').trim();
    const code = raw.code ?? raw.content ?? '';
    const description = (raw.description ?? '').trim();

    if (!title) return void plan.errors.push({ index, message: 'Missing title.' });
    if (title.length > LIMITS.title) {
      return void plan.errors.push({
        index,
        message: `Title is longer than ${LIMITS.title} characters.`,
      });
    }
    if (!code.trim()) return void plan.errors.push({ index, message: `“${title}” has no code.` });
    if (code.length > LIMITS.code) {
      return void plan.errors.push({
        index,
        message: `“${title}” is longer than ${LIMITS.code} characters.`,
      });
    }
    if (description.length > LIMITS.description) {
      return void plan.errors.push({
        index,
        message: `“${title}” has a description longer than ${LIMITS.description} characters.`,
      });
    }

    const notes: string[] = [];

    let language = raw.language?.trim().toLowerCase() ?? '';
    if (!isLanguageId(language)) {
      const guess = raw.filename ? languageFromFilename(raw.filename) : undefined;
      if (language) notes.push(`unknown language “${language}”`);
      language = guess ?? 'plaintext';
    }

    const rawTags = typeof raw.tags === 'string' ? raw.tags.split(/[\s,]+/) : (raw.tags ?? []);
    const normalized = normalizeTags(rawTags);
    const valid = normalized.filter(isValidTag);
    if (valid.length < normalized.length) notes.push('dropped invalid tags');
    const tags = valid.slice(0, MAX_TAGS);
    if (valid.length > MAX_TAGS) notes.push(`kept the first ${MAX_TAGS} tags`);

    const visibility = options.keepVisibility && raw.visibility === 'public' ? 'public' : 'private';

    if (notes.length > 0)
      plan.warnings.push({ index, message: `“${title}”: ${notes.join(', ')}.` });
    plan.snippets.push({ title, description, code, language, tags, visibility });
  });
  return plan;
}

function extractEntries(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && 'snippets' in data) {
    const { snippets } = data as { snippets: unknown };
    if (Array.isArray(snippets)) return snippets;
  }
  throw new ImportFileError('Expected a CodeSnip export or an array of snippets.');
}
