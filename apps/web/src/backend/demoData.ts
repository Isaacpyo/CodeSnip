/**
 * Demo data for the in-browser mock backend. Mirrors supabase/seed.sql
 * (supabase/tests/seed-parity.test.ts fails if the two drift apart).
 */
import type { Visibility } from './types';

export const DEMO_USER_ID = 'd3e0d3e0-0000-4000-8000-000000000001';
export const COMMUNITY_USER_ID = 'ada0ada0-0000-4000-8000-000000000002';

export interface DemoUser {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  { id: DEMO_USER_ID, email: 'demo@codesnip.dev', displayName: 'Demo User', isDemo: true },
  { id: COMMUNITY_USER_ID, email: 'ada@codesnip.dev', displayName: 'Ada Lovelace', isDemo: false },
];

export interface DemoSnippet {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  language: string;
  tags: string[];
  visibility: Visibility;
  /** Seconds before the seed time. */
  createdAgo: number;
  updatedAgo: number;
  code: string;
}

export const DEMO_SNIPPETS: DemoSnippet[] = [
  {
    id: '5a1e0001-0000-4000-8000-000000000001',
    ownerId: DEMO_USER_ID,
    title: 'useDebounce hook',
    description:
      'Debounce any fast-changing value (search boxes, resize events) so effects only run once the user pauses.',
    language: 'typescript',
    tags: ['react', 'hooks', 'performance'],
    visibility: 'public',
    createdAgo: 1728000,
    updatedAgo: 7200,
    code: `import { useEffect, useState } from 'react';

/**
 * Returns \`value\` only after it has stopped changing for \`delayMs\`.
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000002',
    ownerId: DEMO_USER_ID,
    title: 'Retry with exponential backoff',
    description: 'Decorator that retries flaky calls with exponential backoff and full jitter.',
    language: 'python',
    tags: ['resilience', 'http', 'decorators'],
    visibility: 'private',
    createdAgo: 1641600,
    updatedAgo: 86400,
    code: `import functools
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000003',
    ownerId: DEMO_USER_ID,
    title: 'Running total with a window function',
    description: 'Cumulative revenue per customer, ordered by day, without a self-join.',
    language: 'sql',
    tags: ['postgres', 'analytics', 'window-functions'],
    visibility: 'public',
    createdAgo: 1555200,
    updatedAgo: 259200,
    code: `select
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000004',
    ownerId: DEMO_USER_ID,
    title: 'Delete merged git branches',
    description: 'Prune local branches that are already merged into main.',
    language: 'shell',
    tags: ['git', 'cleanup'],
    visibility: 'private',
    createdAgo: 1468800,
    updatedAgo: 345600,
    code: `#!/usr/bin/env bash
set -euo pipefail

git fetch --prune
git branch --merged main \\
  | grep -vE '^\\*|\\s(main|master|develop)$' \\
  | xargs -r git branch -d
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000005',
    ownerId: DEMO_USER_ID,
    title: 'HTTP logging middleware',
    description: 'net/http middleware that logs method, path, status and latency with slog.',
    language: 'go',
    tags: ['http', 'middleware', 'observability'],
    visibility: 'private',
    createdAgo: 1382400,
    updatedAgo: 432000,
    code: `package middleware

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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000006',
    ownerId: DEMO_USER_ID,
    title: 'Multi-stage Dockerfile for a Node app',
    description: 'Small production image: deps cached in their own layer, non-root runtime.',
    language: 'dockerfile',
    tags: ['docker', 'node', 'deployment'],
    visibility: 'public',
    createdAgo: 1296000,
    updatedAgo: 518400,
    code: `FROM node:22-alpine AS deps
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000007',
    ownerId: DEMO_USER_ID,
    title: 'GitHub Actions: Node CI with caching',
    description: 'Lint, typecheck and test on every push and pull request.',
    language: 'yaml',
    tags: ['ci', 'github-actions', 'node'],
    visibility: 'private',
    createdAgo: 1209600,
    updatedAgo: 604800,
    code: `name: CI
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000008',
    ownerId: DEMO_USER_ID,
    title: 'Responsive card grid',
    description: 'Cards that wrap automatically: no media queries needed.',
    language: 'css',
    tags: ['layout', 'grid', 'responsive'],
    visibility: 'private',
    createdAgo: 1123200,
    updatedAgo: 691200,
    code: `.card-grid {
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000009',
    ownerId: DEMO_USER_ID,
    title: 'Typed errors with thiserror',
    description: 'A domain error enum that converts from lower-level errors with `?`.',
    language: 'rust',
    tags: ['errors', 'thiserror'],
    visibility: 'private',
    createdAgo: 1036800,
    updatedAgo: 777600,
    code: `use thiserror::Error;

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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000010',
    ownerId: DEMO_USER_ID,
    title: 'fetch with a timeout',
    description: 'Abort a fetch after N milliseconds using AbortSignal.timeout.',
    language: 'typescript',
    tags: ['http', 'fetch', 'async'],
    visibility: 'private',
    createdAgo: 950400,
    updatedAgo: 864000,
    code: `export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(\`\${res.status} \${res.statusText} for \${url}\`);
  }
  return (await res.json()) as T;
}
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000011',
    ownerId: DEMO_USER_ID,
    title: 'Strict tsconfig',
    description: 'The compiler options I start every TypeScript project with.',
    language: 'json',
    tags: ['typescript', 'config'],
    visibility: 'private',
    createdAgo: 864000,
    updatedAgo: 950400,
    code: `{
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
`,
  },
  {
    id: '5a1e0001-0000-4000-8000-000000000012',
    ownerId: DEMO_USER_ID,
    title: 'Dataclass to JSON',
    description: 'Serialise nested dataclasses, datetimes and UUIDs with the standard library.',
    language: 'python',
    tags: ['serialization', 'json'],
    visibility: 'private',
    createdAgo: 777600,
    updatedAgo: 1036800,
    code: `import dataclasses
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
`,
  },
  {
    id: '5a1e0002-0000-4000-8000-000000000001',
    ownerId: COMMUNITY_USER_ID,
    title: 'Iterative binary search',
    description: 'Classic lower-bound binary search; returns the insertion point.',
    language: 'python',
    tags: ['algorithms', 'search'],
    visibility: 'public',
    createdAgo: 3456000,
    updatedAgo: 86400,
    code: `def lower_bound(items: list[int], target: int) -> int:
    lo, hi = 0, len(items)
    while lo < hi:
        mid = (lo + hi) // 2
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
  },
  {
    id: '5a1e0002-0000-4000-8000-000000000002',
    ownerId: COMMUNITY_USER_ID,
    title: 'Throttle in vanilla JavaScript',
    description: 'Run a handler at most once per interval (scroll, resize, pointermove).',
    language: 'javascript',
    tags: ['performance', 'events'],
    visibility: 'public',
    createdAgo: 3024000,
    updatedAgo: 432000,
    code: `export function throttle(fn, intervalMs = 100) {
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
`,
  },
  {
    id: '5a1e0002-0000-4000-8000-000000000003',
    ownerId: COMMUNITY_USER_ID,
    title: 'Delete duplicate rows, keep the newest',
    description: 'Remove duplicates by email, keeping the most recently created row.',
    language: 'sql',
    tags: ['postgres', 'data-cleaning'],
    visibility: 'public',
    createdAgo: 2592000,
    updatedAgo: 777600,
    code: `delete from users u
using (
  select id,
         row_number() over (partition by lower(email) order by created_at desc) as rn
  from users
) ranked
where u.id = ranked.id
  and ranked.rn > 1;
`,
  },
  {
    id: '5a1e0002-0000-4000-8000-000000000004',
    ownerId: COMMUNITY_USER_ID,
    title: 'Find files larger than 100 MB',
    description: 'Largest files under the current directory, human-readable, biggest first.',
    language: 'shell',
    tags: ['filesystem', 'cleanup'],
    visibility: 'public',
    createdAgo: 2160000,
    updatedAgo: 1209600,
    code: `find . -type f -size +100M -print0 \\
  | xargs -0 du -h \\
  | sort -rh \\
  | head -n 20
`,
  },
  {
    id: '5a1e0002-0000-4000-8000-000000000005',
    ownerId: COMMUNITY_USER_ID,
    title: 'Analytical engine notes',
    description: 'Private draft. Only Ada can see this one.',
    language: 'markdown',
    tags: ['notes', 'private-draft'],
    visibility: 'private',
    createdAgo: 1728000,
    updatedAgo: 1728000,
    code: `# Notes

- The engine weaves algebraic patterns as the Jacquard loom weaves flowers.
- TODO: Bernoulli numbers table.
`,
  },
];
