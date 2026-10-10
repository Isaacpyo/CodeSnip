#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in filename order, each exactly once and in
# its own transaction, recording them in the same table the Supabase CLI uses.
# Then runs supabase/seed.sql (idempotent) unless SEED=false.
#
# Usage: DATABASE_URL=postgres://postgres:...@host:5432/postgres ./docker/migrate.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
SUPABASE_DIR="${SUPABASE_DIR:-$(cd "$(dirname "$0")/../supabase" && pwd)}"
SEED="${SEED:-true}"

run_psql() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --no-psqlrc --quiet "$@"
}

run_psql <<'SQL'
set client_min_messages = warning;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

for file in "$SUPABASE_DIR"/migrations/*.sql; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  if [ -n "$(run_psql -tA -c "select 1 from supabase_migrations.schema_migrations where version = '${version}'")" ]; then
    echo "migrate: up to date  ${base}"
    continue
  fi
  echo "migrate: applying    ${base}"
  run_psql --single-transaction -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}')"
done

if [ "$SEED" = "true" ] && [ -f "$SUPABASE_DIR/seed.sql" ]; then
  echo "migrate: seeding     seed.sql"
  run_psql --single-transaction -f "$SUPABASE_DIR/seed.sql"
fi

# Tell PostgREST to pick up the new schema straight away.
run_psql -c "notify pgrst, 'reload schema'"
echo "migrate: done"
