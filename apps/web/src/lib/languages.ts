/**
 * Languages a snippet can be tagged with. Ids are Monaco language ids and must
 * match the `public.languages` table (enforced by supabase/tests).
 */
export interface Language {
  id: string;
  label: string;
}

export const LANGUAGES = [
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'css', label: 'CSS' },
  { id: 'dart', label: 'Dart' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'elixir', label: 'Elixir' },
  { id: 'go', label: 'Go' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'html', label: 'HTML' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'json', label: 'JSON' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'lua', label: 'Lua' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'php', label: 'PHP' },
  { id: 'plaintext', label: 'Plain text' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'python', label: 'Python' },
  { id: 'r', label: 'R' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'rust', label: 'Rust' },
  { id: 'scala', label: 'Scala' },
  { id: 'scss', label: 'SCSS' },
  { id: 'shell', label: 'Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'swift', label: 'Swift' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
] as const satisfies readonly Language[];

export type LanguageId = (typeof LANGUAGES)[number]['id'];

const LABELS: ReadonlyMap<string, string> = new Map(LANGUAGES.map((l) => [l.id, l.label]));

export function isLanguageId(value: string): value is LanguageId {
  return LABELS.has(value);
}

export function languageLabel(id: string): string {
  return LABELS.get(id) ?? id;
}

/** Best-effort guess from a file name, used when importing. */
const EXTENSIONS: Record<string, LanguageId> = {
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  go: 'go',
  graphql: 'graphql',
  gql: 'graphql',
  html: 'html',
  java: 'java',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  kt: 'kotlin',
  kts: 'kotlin',
  lua: 'lua',
  md: 'markdown',
  php: 'php',
  txt: 'plaintext',
  ps1: 'powershell',
  py: 'python',
  r: 'r',
  rb: 'ruby',
  rs: 'rust',
  scala: 'scala',
  scss: 'scss',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  swift: 'swift',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
};

export function languageFromFilename(name: string): LanguageId | undefined {
  if (/^dockerfile$/i.test(name.split('/').pop() ?? '')) return 'dockerfile';
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? EXTENSIONS[ext] : undefined;
}
