/**
 * The contract every data backend implements. The UI only talks to this
 * interface, so the Supabase backend and the in-browser mock are
 * interchangeable (selected by VITE_BACKEND, see src/env.ts).
 */

export type Visibility = 'private' | 'public';
export type Scope = 'mine' | 'public';

/** What a user can write. */
export interface SnippetInput {
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  visibility: Visibility;
}

export interface Author {
  name: string | null;
  avatarUrl: string | null;
}

export interface Snippet extends SnippetInput {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  author: Author;
}

/** A search hit: the snippet without its full code. */
export interface SnippetSummary extends Omit<Snippet, 'code'> {
  codePreview: string;
  rank: number;
}

export interface SearchParams {
  scope: Scope;
  search?: string;
  tags?: string[];
  language?: string | null;
  pageSize?: number;
  offset?: number;
}

export interface SearchPage {
  items: SnippetSummary[];
  total: number;
  /** Offset of the next page, or null when this was the last one. */
  nextOffset: number | null;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface Facets {
  tags: FacetCount[];
  languages: FacetCount[];
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isDemo: boolean;
}

export interface AuthCapabilities {
  /** GitHub OAuth is configured on the auth server. */
  github: boolean;
  /** New email sign-ups must confirm their address before signing in. */
  emailConfirmation: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthApi {
  getUser(): Promise<AuthUser | null>;
  /** Subscribe to sign-in / sign-out. Returns an unsubscribe function. */
  onChange(listener: (user: AuthUser | null) => void): () => void;
  capabilities(): Promise<AuthCapabilities>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  /** Redirects the browser to GitHub. */
  signInWithGitHub(redirectTo: string): Promise<void>;
  signInAsDemo(): Promise<void>;
  signOut(): Promise<void>;
  getProfile(): Promise<Profile | null>;
}

export interface SnippetsApi {
  search(params: SearchParams): Promise<SearchPage>;
  facets(scope: Scope): Promise<Facets>;
  /** Null when the snippet does not exist or the caller may not see it. */
  get(id: string): Promise<Snippet | null>;
  create(input: SnippetInput): Promise<Snippet>;
  update(id: string, patch: Partial<SnippetInput>): Promise<Snippet>;
  remove(id: string): Promise<void>;
  /** Inserts all snippets atomically; returns how many were created. */
  importMany(inputs: SnippetInput[]): Promise<number>;
  /** Every snippet the current user owns, with full code. */
  exportAll(): Promise<Snippet[]>;
}

export interface Backend {
  readonly kind: 'supabase' | 'mock';
  readonly auth: AuthApi;
  readonly snippets: SnippetsApi;
}
