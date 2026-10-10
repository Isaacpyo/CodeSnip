-- Demo data. Idempotent: safe to re-run at any time to reset the demo
-- (users are created once; their snippets are deleted and re-inserted).
--
--   demo@codesnip.dev / codesnip-demo   shared demo account ("Try the demo")
--   ada@codesnip.dev                    community author with public snippets;
--                                       random password, nobody can sign in.
--
-- Fixed ids keep share links stable across resets.

-- ---------------------------------------------------------------------------
-- Users (auth.users + auth.identities); the profile row comes from the
-- on_auth_user_created trigger.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'd3e0d3e0-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'demo@codesnip.dev',
    extensions.crypt('codesnip-demo', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Demo User"}',
    now() - interval '30 days', now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'ada0ada0-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'ada@codesnip.dev',
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Ada Lovelace"}',
    now() - interval '60 days', now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('d3e0d3e0-0000-4000-8000-000000000001', 'ada0ada0-0000-4000-8000-000000000002')
on conflict (provider_id, provider) do nothing;

update public.profiles set display_name = 'Demo User', is_demo = true
where id = 'd3e0d3e0-0000-4000-8000-000000000001';

update public.profiles set display_name = 'Ada Lovelace'
where id = 'ada0ada0-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Snippets
-- ---------------------------------------------------------------------------
delete from public.snippets
where owner_id in ('d3e0d3e0-0000-4000-8000-000000000001', 'ada0ada0-0000-4000-8000-000000000002');

insert into public.snippets (id, owner_id, title, description, language, tags, visibility, created_at, updated_at, code)
values
-- Demo user -----------------------------------------------------------------
(
  '5a1e0001-0000-4000-8000-000000000001', 'd3e0d3e0-0000-4000-8000-000000000001',
  'useDebounce hook',
  'Debounce any fast-changing value (search boxes, resize events) so effects only run once the user pauses.',
  'typescript', '{react,hooks,performance}', 'public',
  now() - interval '20 days', now() - interval '2 hours',
$code$import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it has stopped changing for `delayMs`.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

// Usage
// const query = useDebounce(searchInput, 250);
// useEffect(() => { search(query); }, [query]);
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000002', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Retry with exponential backoff',
  'Decorator that retries flaky calls with exponential backoff and full jitter.',
  'python', '{resilience,http,decorators}', 'private',
  now() - interval '19 days', now() - interval '1 day',
$code$import functools
import random
import time


def retry(attempts: int = 5, base: float = 0.2, cap: float = 5.0, exceptions=(Exception,)):
    """Retry the wrapped function with exponential backoff + full jitter."""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions:
                    if attempt == attempts:
                        raise
                    time.sleep(random.uniform(0, min(cap, base * 2 ** attempt)))

        return wrapper

    return decorator


@retry(attempts=4, exceptions=(TimeoutError, ConnectionError))
def fetch_report(client, report_id):
    return client.get(f"/reports/{report_id}")
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000003', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Running total with a window function',
  'Cumulative revenue per customer, ordered by day, without a self-join.',
  'sql', '{postgres,analytics,window-functions}', 'public',
  now() - interval '18 days', now() - interval '3 days',
$code$select
  customer_id,
  ordered_on::date as day,
  amount,
  sum(amount) over (
    partition by customer_id
    order by ordered_on
    rows between unbounded preceding and current row
  ) as running_total
from orders
where ordered_on >= now() - interval '90 days'
order by customer_id, ordered_on;
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000004', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Delete merged git branches',
  'Prune local branches that are already merged into main.',
  'shell', '{git,cleanup}', 'private',
  now() - interval '17 days', now() - interval '4 days',
$code$#!/usr/bin/env bash
set -euo pipefail

git fetch --prune
git branch --merged main \
  | grep -vE '^\*|\s(main|master|develop)$' \
  | xargs -r git branch -d
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000005', 'd3e0d3e0-0000-4000-8000-000000000001',
  'HTTP logging middleware',
  'net/http middleware that logs method, path, status and latency with slog.',
  'go', '{http,middleware,observability}', 'private',
  now() - interval '16 days', now() - interval '5 days',
$code$package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration", time.Since(start),
		)
	})
}
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000006', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Multi-stage Dockerfile for a Node app',
  'Small production image: deps cached in their own layer, non-root runtime.',
  'dockerfile', '{docker,node,deployment}', 'public',
  now() - interval '15 days', now() - interval '6 days',
$code$FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000007', 'd3e0d3e0-0000-4000-8000-000000000001',
  'GitHub Actions: Node CI with caching',
  'Lint, typecheck and test on every push and pull request.',
  'yaml', '{ci,github-actions,node}', 'private',
  now() - interval '14 days', now() - interval '7 days',
$code$name: CI
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000008', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Responsive card grid',
  'Cards that wrap automatically: no media queries needed.',
  'css', '{layout,grid,responsive}', 'private',
  now() - interval '13 days', now() - interval '8 days',
$code$.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--surface);
}
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000009', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Typed errors with thiserror',
  'A domain error enum that converts from lower-level errors with `?`.',
  'rust', '{errors,thiserror}', 'private',
  now() - interval '12 days', now() - interval '9 days',
$code$use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("snippet {0} not found")]
    NotFound(uuid::Uuid),
    #[error("database error")]
    Database(#[from] sqlx::Error),
    #[error("invalid input: {0}")]
    Invalid(String),
}

pub async fn load(pool: &sqlx::PgPool, id: uuid::Uuid) -> Result<Snippet, StoreError> {
    sqlx::query_as!(Snippet, "select * from snippets where id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or(StoreError::NotFound(id))
}
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000010', 'd3e0d3e0-0000-4000-8000-000000000001',
  'fetch with a timeout',
  'Abort a fetch after N milliseconds using AbortSignal.timeout.',
  'typescript', '{http,fetch,async}', 'private',
  now() - interval '11 days', now() - interval '10 days',
$code$export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000011', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Strict tsconfig',
  'The compiler options I start every TypeScript project with.',
  'json', '{typescript,config}', 'private',
  now() - interval '10 days', now() - interval '11 days',
$code${
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
$code$
),
(
  '5a1e0001-0000-4000-8000-000000000012', 'd3e0d3e0-0000-4000-8000-000000000001',
  'Dataclass to JSON',
  'Serialise nested dataclasses, datetimes and UUIDs with the standard library.',
  'python', '{serialization,json}', 'private',
  now() - interval '9 days', now() - interval '12 days',
$code$import dataclasses
import json
from datetime import datetime
from uuid import UUID


class AppJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, UUID):
            return str(o)
        return super().default(o)


print(json.dumps(snippet, cls=AppJSONEncoder, indent=2))
$code$
),
-- Ada (community, public) ----------------------------------------------------
(
  '5a1e0002-0000-4000-8000-000000000001', 'ada0ada0-0000-4000-8000-000000000002',
  'Iterative binary search',
  'Classic lower-bound binary search; returns the insertion point.',
  'python', '{algorithms,search}', 'public',
  now() - interval '40 days', now() - interval '1 day',
$code$def lower_bound(items: list[int], target: int) -> int:
    lo, hi = 0, len(items)
    while lo < hi:
        mid = (lo + hi) // 2
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
$code$
),
(
  '5a1e0002-0000-4000-8000-000000000002', 'ada0ada0-0000-4000-8000-000000000002',
  'Throttle in vanilla JavaScript',
  'Run a handler at most once per interval (scroll, resize, pointermove).',
  'javascript', '{performance,events}', 'public',
  now() - interval '35 days', now() - interval '5 days',
$code$export function throttle(fn, intervalMs = 100) {
  let last = 0;
  let timer;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = intervalMs - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else {
      timer = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}
$code$
),
(
  '5a1e0002-0000-4000-8000-000000000003', 'ada0ada0-0000-4000-8000-000000000002',
  'Delete duplicate rows, keep the newest',
  'Remove duplicates by email, keeping the most recently created row.',
  'sql', '{postgres,data-cleaning}', 'public',
  now() - interval '30 days', now() - interval '9 days',
$code$delete from users u
using (
  select id,
         row_number() over (partition by lower(email) order by created_at desc) as rn
  from users
) ranked
where u.id = ranked.id
  and ranked.rn > 1;
$code$
),
(
  '5a1e0002-0000-4000-8000-000000000004', 'ada0ada0-0000-4000-8000-000000000002',
  'Find files larger than 100 MB',
  'Largest files under the current directory, human-readable, biggest first.',
  'shell', '{filesystem,cleanup}', 'public',
  now() - interval '25 days', now() - interval '14 days',
$code$find . -type f -size +100M -print0 \
  | xargs -0 du -h \
  | sort -rh \
  | head -n 20
$code$
),
-- Ada (private: must never be visible to anyone else) ------------------------
(
  '5a1e0002-0000-4000-8000-000000000005', 'ada0ada0-0000-4000-8000-000000000002',
  'Analytical engine notes',
  'Private draft. Only Ada can see this one.',
  'markdown', '{notes,private-draft}', 'private',
  now() - interval '20 days', now() - interval '20 days',
$code$# Notes

- The engine weaves algebraic patterns as the Jacquard loom weaves flowers.
- TODO: Bernoulli numbers table.
$code$
);
