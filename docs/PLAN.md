# CodeSnip — build plan

CodeSnip is a code snippet manager: save snippets with a language, tags and a
description, edit them in Monaco, find them with full-text search and tag
filters, and share the public ones with a link.

## Stack (as specified, no swaps)

| Concern        | Choice                                                      |
| -------------- | ----------------------------------------------------------- |
| Frontend       | React 19 + Vite + TypeScript (strict), Chakra UI v3         |
| Editor         | Monaco (`@monaco-editor/react`, bundled locally, no CDN)    |
| Auth           | Supabase Auth (email/password + GitHub OAuth)               |
| Database / API | Supabase Postgres, exposed through PostgREST                |
| Authorization  | Postgres Row Level Security policies + column grants        |
| Search         | Postgres full-text search (weighted `tsvector` + GIN index) |
| Hosting        | Netlify (web), Supabase free tier (auth + db + API)         |

### No `apps/api`, no `render.yaml`

Supabase _is_ the backend: GoTrue handles auth, PostgREST turns the schema into
a REST API, and RLS enforces who can read and write each row. Adding a Node
service on Render would duplicate PostgREST and add a cold-starting hop
between the browser and the database, so there is no `apps/api` and therefore
no Render blueprint. The "waking server" UX still exists: Supabase free
projects can be slow on the first request (or paused after inactivity), so a
fetch wrapper tracks in-flight requests and shows a banner when one is slow.

## Repo layout

```
apps/web/                 Vite SPA
  src/backend/            Backend interface + Supabase and in-browser mock implementations
  src/lib/                Pure logic (validation, tags, import/export, wake tracker…) + unit tests
  src/components, pages/  UI
  e2e/                    Playwright smoke test
supabase/
  config.toml             Supabase CLI config (supabase start / db push)
  migrations/*.sql        Schema, RLS, functions, triggers
  seed.sql                Demo + community users and snippets (idempotent)
  tests/*.test.ts         RLS + SQL behaviour tests (vitest + pg) against a real Supabase Postgres
docker/                   Gateway config, migration runner, web Dockerfile
docker-compose.yml        Local Supabase (postgres, gotrue, postgrest, gateway) + web
```

## Data model

- `profiles(id → auth.users, display_name, avatar_url, is_demo)` — created by a
  trigger on `auth.users` insert; readable by everyone (author names on public
  snippets); users may update only `display_name`/`avatar_url`.
- `languages(id, label)` — lookup table, FK target for `snippets.language`.
- `snippets(id, owner_id → profiles, title, description, code, language, tags[],
visibility 'private'|'public', created_at, updated_at, search_vector)`.
  - `owner_id` defaults to `auth.uid()` and is not insertable/updatable through
    the API (column grants) — RLS `with check` is the second layer.
  - A `before insert/update` trigger normalises tags (trim, lowercase, dedupe),
    bumps `updated_at` and rebuilds `search_vector`
    (title A, description/tags B, language C, code D).
  - Check constraints mirror the client-side zod schema (lengths, tag format,
    max 10 tags, max 100k chars of code).
  - A statement-level trigger caps each user at 2,000 snippets (abuse guard;
    bulk imports are checked once per statement).

## RLS policies

| Table     | anon          | authenticated                                      |
| --------- | ------------- | -------------------------------------------------- |
| snippets  | select public | select public **or own**; insert/update/delete own |
| profiles  | select        | select; update own (limited columns)               |
| languages | select        | select                                             |

All policies use `(select auth.uid())` so the uid is evaluated once per
statement. RPCs are `security invoker`, so they can never see more than a
direct table read would.

## RPCs

- `search_snippets(q, tag_filter, lang, scope, lim, off)` — prefix-aware
  full-text search with `ts_rank`, tag (`@>`) and language filters, scope
  `mine` or `public`, returns a code preview + author + total count.
- `snippet_facets(scope)` — tag and language counts for the sidebar filters.

## Demo account

`seed.sql` creates `demo@codesnip.dev` (password is public on purpose) with a
dozen snippets, plus a "community" user whose public snippets populate
Explore and whose private snippet proves RLS in tests. A trigger blocks
password/email changes on profiles flagged `is_demo`, so nobody can lock the
demo. The seed is idempotent; a scheduled GitHub Action can re-run it nightly
to reset demo data.

## Mock backend

`VITE_BACKEND=mock` (or no Supabase URL) swaps in an in-browser backend that
implements the same interface on `localStorage`, mirrors the RLS rules in
code, and is seeded with the same demo data. It makes `npm run dev`, unit
tests and the e2e smoke test work without any keys, and lets the Netlify site
work before Supabase is configured.

## Testing

- Unit (vitest): validation, tag parsing, import/export, wake tracker,
  clipboard, mock backend (including its RLS mirror), key components.
- Database (vitest + pg): RLS for anon / owner / other user, column grants,
  triggers, constraints, search ranking, facets, demo-account guard — run
  against the real `supabase/postgres` image with GoTrue's auth schema.
- E2E (Playwright): demo login → library → search → create → make public →
  sign out → open share link; private link is not visible. Runs against the
  mock backend and against the full docker-compose Supabase stack.

## CI (GitHub Actions)

1. `web`: install, lint, typecheck, unit tests, build.
2. `supabase`: boot the compose stack, run DB/RLS tests, run the e2e smoke
   test against real Supabase.
3. `e2e-mock`: e2e smoke test against the mock backend.

## Steps

1. Plan + scaffold (this doc).
2. Migrations, seed, docker-compose stack; prove it boots.
3. RLS/DB tests.
4. Web app: backend layer, auth, library, editor, search/filters, share,
   copy, import/export, waking banner, empty/error/loading states.
5. Unit tests, e2e, CI, netlify.toml, README, `.env.example`.
6. Full verification (`docker compose build`, all suites), PR.
