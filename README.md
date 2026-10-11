# CodeSnip

[![CI](https://github.com/isaacpyo/codesnip/actions/workflows/ci.yml/badge.svg)](https://github.com/isaacpyo/codesnip/actions/workflows/ci.yml)

**Live demo: https://codesnip.temitopeagbola.com** (click **Try the demo**, no sign-up needed)

CodeSnip is a code snippet manager for the bits of code you keep rewriting. You
save a snippet with its language, tags and a description, edit it in Monaco (the
editor behind VS Code), find it again with ranked full-text search and tag
filters, copy it in one click, and share the good ones with a public link.
Privacy isn't just a UI flag: **Postgres row level security** decides who can
read every row, and a test suite proves it against a real Supabase database.

## Features

- **Auth**: email and password, GitHub OAuth, and a one-click shared demo account.
- **Snippets**: create, edit and delete snippets with title, description, language (31), tags and visibility.
- **Monaco editor**: syntax highlighting, bundled locally (no CDN), lazy-loaded, follows light and dark mode, <kbd>Ctrl/⌘</kbd>+<kbd>S</kbd> to save.
- **Search**: Postgres full-text search with prefix matching ("debou" finds `useDebounce`), camelCase splitting and weighted ranking (title > description/tags > language > code). Tag and language filters with counts. Everything lives in the URL, so searches can be shared and survive a reload.
- **Visibility**: snippets are private by default. Public ones get a share link (`/s/:id`) that works without an account and appear on **Explore**. RLS enforces all of this.
- **Copy to clipboard** from cards, the editor and share pages, with a Safari-safe fallback.
- **Import / export JSON**: export your whole library; import a CodeSnip export or any JSON array of `{ title, code, ... }`. Bad entries are skipped and reported, fixable ones are repaired with a warning, and imports are private unless you choose otherwise.
- **Save a copy**: fork someone's public snippet into your library.
- **UX**: loading skeletons, empty and error states with retry, a "waking up the server…" banner when the backend is slow, unsaved-changes guard, toasts, dark mode, responsive down to 375px, skip link, labelled controls and visible focus rings.

## Architecture

```mermaid
flowchart LR
  subgraph Browser["Browser (Netlify CDN)"]
    UI["React SPA<br/>Chakra UI · Monaco"] --> API["Backend interface<br/>(src/backend/types.ts)"]
    API -- "VITE_BACKEND=mock" --> Mock[("In-browser mock<br/>localStorage, mirrors RLS")]
    API -- "VITE_BACKEND=supabase" --> SDK["supabase-js<br/>+ wake tracker"]
  end
  SDK -- "/auth/v1" --> Auth["Supabase Auth (GoTrue)<br/>email · GitHub OAuth"]
  SDK -- "/rest/v1" --> REST["PostgREST<br/>tables + RPCs"]
  subgraph Supabase
    Auth --> PG[("Postgres<br/>RLS · column grants<br/>FTS · triggers")]
    REST --> PG
  end
  GH["GitHub OAuth app"] <-.-> Auth
```

- **No custom API server.** PostgREST exposes the schema; RLS policies, column
  grants, check constraints and triggers are the API's authorization and
  validation layer. Search and facets are `security invoker` SQL functions, so
  they can never see more than a direct table read.
- **Defense in depth.** `owner_id` defaults to `auth.uid()` and isn't writable
  through the API (column grants), _and_ RLS `with check` requires it to be the
  caller. Server-managed columns (`created_at`, `updated_at`, `search_vector`)
  can't be written either. Profiles are only readable once their owner has
  published something, so email-derived display names don't leak.
- **One interface, two backends.** The UI only knows `Backend`. The Supabase
  implementation is what production uses; the mock implements the same rules in
  TypeScript on `localStorage` so the app, the unit tests and the e2e test run
  with no keys, and the live site still works before Supabase is configured.
- **Waking server.** A fetch wrapper tracks in-flight requests; if one takes
  more than 2.5 s a banner explains the free-tier backend is waking up, and
  after 15 s it says the project may be paused.

### Data model

| Table       | Purpose                                                                                 | Who can read                                        | Who can write                             |
| ----------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| `snippets`  | title, description, code, language, tags[], visibility, timestamps, weighted `tsvector` | public rows: anyone; private rows: owner            | owner only (insert/update/delete)         |
| `profiles`  | display name, avatar, `is_demo`; created by a trigger on sign-up                        | owner, or anyone once the user has a public snippet | owner (`display_name`, `avatar_url` only) |
| `languages` | lookup table (Monaco language ids), FK target                                           | anyone                                              | nobody (migrations only)                  |

Migrations live in [`supabase/migrations`](supabase/migrations), the demo seed
in [`supabase/seed.sql`](supabase/seed.sql), and the plan in
[`docs/PLAN.md`](docs/PLAN.md).

## Tech stack

| Layer    | Choice                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, Vite 8, TypeScript (strict), Chakra UI 3, Monaco (`@monaco-editor/react`), TanStack Query, React Router, zod |
| Backend  | Supabase: Auth (GoTrue), Postgres 17 with RLS and full-text search, PostgREST                                          |
| Tests    | Vitest + Testing Library (unit/integration), Vitest + `pg` (database/RLS), Playwright (e2e)                            |
| Tooling  | npm workspaces, ESLint, Prettier, Docker Compose, GitHub Actions                                                       |
| Hosting  | Netlify (web), Supabase free tier (auth + database + API)                                                              |

### Stack substitutions

**None.** The project uses exactly the specified stack: React (Vite), Supabase
(Auth, Postgres, RLS, full-text search), Monaco Editor and Chakra UI.

Two deliberate omissions from the general template, explained:

- **No `apps/api` and no `render.yaml`.** Supabase _is_ the backend (GoTrue
  for auth, PostgREST for the API, RLS for authorization). A Node service on
  Render would only proxy PostgREST, and it would add a cold-starting hop on
  Render's free tier between the browser and the data. The "waking server" UX
  is still there because free Supabase projects can be slow to answer after a
  quiet spell and are paused after a week of inactivity.
- **No Neon / Upstash / Atlas.** The app needs one Postgres, and Supabase
  provides it. There is no cache or document store to justify Redis or Mongo.

## Run it locally

Requirements: Node 22+, Docker (for the local Supabase stack).

### Option 1: everything in Docker (one command)

```bash
docker compose up --build
```

| Service                | URL                                                     |
| ---------------------- | ------------------------------------------------------- |
| Web app                | http://localhost:3000                                   |
| Supabase API (gateway) | http://localhost:54321                                  |
| Postgres               | `postgres://postgres:postgres@localhost:54322/postgres` |

Compose runs a minimal self-hosted Supabase (Postgres, GoTrue and PostgREST behind
an nginx gateway), applies `supabase/migrations`, runs `supabase/seed.sql`, then
serves the built app. Everything has local defaults; to change anything,
`cp .env.example .env` and edit.

### Option 2: Vite dev server + local Supabase

```bash
npm ci
cp .env.example .env    # local defaults point at the compose stack
npm run db:up           # Postgres + Auth + REST + gateway, migrated and seeded
npm run dev             # http://localhost:5173
```

The Supabase CLI works too: `npx supabase start` uses the same ports and keys
([`supabase/config.toml`](supabase/config.toml)) and applies the same
migrations and seed.

### Option 3: no backend at all

```bash
npm ci
npm run dev:mock        # in-browser mock backend, data in localStorage
```

Demo account everywhere: `demo@codesnip.dev` / `codesnip-demo` (or just click **Try the demo**).

### Useful scripts

| Command                                                       | What it does                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | static checks                                                        |
| `npm test`                                                    | unit and integration tests (Vitest, jsdom)                           |
| `npm run test:db`                                             | RLS and SQL tests against the local database (needs `npm run db:up`) |
| `npm run test:e2e`                                            | Playwright against a mock-backend build                              |
| `npm run test:e2e:supabase -w @codesnip/web`                  | Playwright against the local Supabase stack                          |
| `npm run db:seed`                                             | re-run migrations (if new) and reset demo data                       |
| `npm run db:reset`                                            | wipe the local database volume and start fresh                       |
| `npm run db:types`                                            | regenerate `database.types.ts` from the local schema                 |

## Testing

- **Database / RLS (47 tests, [`supabase/tests`](supabase/tests))**: every test
  runs in a rolled-back transaction and switches roles exactly like PostgREST
  (`SET ROLE` plus `request.jwt.claims`). They cover anonymous, owner and
  other-user visibility; write isolation; column grants (no spoofing
  `owner_id`); profile exposure; the demo-account guard; tag normalisation;
  constraints; the per-account quota; search ranking, prefix matching and
  injection-safe input; facets; that RLS is enabled on every table; and that
  the mock's demo data and language list match the database.
- **Unit and integration (100 tests, `apps/web/src/**/*.test.ts(x)`)**:
  validation, tags, import/export planning, wake tracker, clipboard fallbacks,
  error mapping, row mapping, the mock backend's RLS mirror, and the real app
  rendered with all providers and routes (demo login, auth guard, search, tag
  filters, create flow, share page, empty and error states).
- **E2E (Playwright, [`apps/web/e2e`](apps/web/e2e))**: the main flow (demo
  login, search, tag filter, create in Monaco, <kbd>Ctrl</kbd>+<kbd>S</kbd>, copy, make
  public, copy link, sign out, open the share link anonymously, private link is
  hidden, delete), a JSON export and import round trip, and a 375px layout
  check. CI runs it against both the mock and the real Supabase stack.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs format, lint,
typecheck, unit tests and build; e2e on the mock backend; the Supabase stack
with the RLS tests and e2e; and `docker compose build`.

## Deploy

The web app is a static SPA on Netlify; the backend is a Supabase project. Both
are free tier.

### 1. Supabase (auth, database, API)

1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. Push the schema and seed:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --include-seed
   ```
   (Or paste the migration files, then `seed.sql`, into the SQL editor in order.)
3. **Authentication > URL Configuration**: Site URL
   `https://codesnip.temitopeagbola.com`; add redirect URLs
   `https://codesnip.temitopeagbola.com/**` and, for deploy previews,
   `https://deploy-preview-*--<netlify-site-name>.netlify.app/**`.
4. **GitHub sign-in** (optional): create an OAuth app at
   https://github.com/settings/developers with Homepage
   `https://codesnip.temitopeagbola.com` and callback
   `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client ID
   and secret into **Authentication > Providers > GitHub**. The GitHub button
   only appears once the provider is enabled.
5. **Email**: confirmations are on by default and Supabase's built-in mailer is
   heavily rate limited. Either add SMTP (**Authentication > Emails**) or turn
   off "Confirm email" for a portfolio demo.
6. Copy the **Project URL** and **anon / publishable key** from
   **Project Settings > API**.

### 2. Netlify (web)

The site builds from [`netlify.toml`](netlify.toml): base `apps/web`, command
`npm run build`, publish `dist`, SPA fallback, security headers (including a
CSP) and immutable caching for hashed assets. Set these environment variables
under **Site configuration > Environment variables**, then trigger a deploy:

| Variable                 | Value                                                      |
| ------------------------ | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://<project-ref>.supabase.co`                        |
| `VITE_SUPABASE_ANON_KEY` | the anon or publishable key                                |
| `VITE_BACKEND`           | `supabase` (optional; inferred when the two above are set) |

Without them the site still works, in clearly labelled offline demo mode.

### 3. Nightly demo reset (optional)

Add the repository secret `SUPABASE_DB_URL` (Supabase **Connect > Session
pooler** connection string). [`reset-demo.yml`](.github/workflows/reset-demo.yml)
then re-runs the idempotent `seed.sql` every night, so the shared demo account
starts clean. Without the secret the workflow skips itself.

### Render

Not used: there is no API service to host (see [Stack substitutions](#stack-substitutions)).

## Environment variables

All variables are listed with comments in [`.env.example`](.env.example). One
`.env` at the repo root serves Vite, Docker Compose and the tests.

| Variable                                                           | Used by       | Purpose                                                                |
| ------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------- |
| `VITE_BACKEND`                                                     | web           | `supabase` or `mock`; empty = supabase when configured, otherwise mock |
| `VITE_SUPABASE_URL`                                                | web           | Supabase project URL                                                   |
| `VITE_SUPABASE_ANON_KEY`                                           | web           | anon or publishable key (public by design; RLS protects data)          |
| `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD`                            | web           | shared demo account for **Try the demo**                               |
| `VITE_MOCK_LATENCY_MS`                                             | web (mock)    | artificial latency; set 4000 to see the waking banner                  |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`                      | compose       | local stack credentials (development values)                           |
| `API_EXTERNAL_URL`, `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`         | compose       | local auth URLs                                                        |
| `API_PORT`, `DB_PORT`, `WEB_PORT`, `SEED`                          | compose       | ports and seeding                                                      |
| `GITHUB_OAUTH_ENABLED`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | compose       | GitHub OAuth for the local stack                                       |
| `DATABASE_URL`                                                     | `test:db`     | Postgres for the RLS tests                                             |
| `E2E_BACKEND`, `E2E_BASE_URL`, `PLAYWRIGHT_CHROMIUM_PATH`          | e2e           | Playwright target and browser                                          |
| `SUPABASE_DB_URL`                                                  | GitHub secret | nightly demo reset                                                     |

## Project structure

```
apps/web/                 React SPA
  src/backend/            Backend interface, Supabase + mock implementations, generated DB types
  src/lib/                Pure logic (validation, tags, import/export, wake tracker, search…)
  src/components, pages/  UI
  e2e/                    Playwright tests
supabase/
  migrations/             Schema, RLS, triggers, search RPCs
  seed.sql                Demo data (idempotent)
  tests/                  RLS and SQL tests (vitest + pg)
  config.toml             Supabase CLI config
docker/                   Local gateway config and migration runner
scripts/generate-keys.mjs Local anon/service keys for a JWT secret
docker-compose.yml        Whole system locally
netlify.toml              Web deploy config
```

## Trade-offs and known limitations

- **The demo account is shared and its password is public.** A trigger stops
  anyone changing its password or email; its snippets are reset by the nightly
  workflow. Anything published from it is visible on Explore until the reset.
- **Explore has no moderation.** Any signed-up user can publish. That's fine
  for a portfolio demo; a real product would need reporting and rate limits.
- **Abuse limits are basic**: per-field size limits, 10 tags, a 2,000-snippet
  quota per account and Supabase Auth's built-in rate limits. PostgREST itself
  isn't rate limited on the free tier.
- **Search** is Postgres FTS with prefix matching and a title substring
  fallback, not fuzzy search. `pg_trgm` would be the next step.
- **The mock backend** stores data in the browser only, and its "passwords"
  are hashed but sit in `localStorage`. It exists for development, tests and
  the unconfigured live site, never for real accounts.
