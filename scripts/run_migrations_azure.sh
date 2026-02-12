#!/usr/bin/env bash
# Run pending PostgreSQL migrations for Azure.
# Requires: PGHOST, PGUSER, PGPASSWORD, PGDATABASE (PGPORT optional, default 5432).
# Optional: MIGRATIONS_DIR (default: supabase/migrations).

set -e
cd "$(dirname "$0")/.."

if [ -z "${PGHOST}" ] || [ -z "${PGUSER}" ] || [ -z "${PGPASSWORD}" ] || [ -z "${PGDATABASE}" ]; then
  echo "Missing required env: PGHOST, PGUSER, PGPASSWORD, PGDATABASE" >&2
  exit 1
fi

export PGPORT="${PGPORT:-5432}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

# Ensure schema_migrations table exists (track applied migrations)
psql -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

# Run each .sql file in sorted order if not already applied
for f in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort); do
  name="$(basename "$f")"
  safe_name="${name//\'/\'\'}"
  if psql -v ON_ERROR_STOP=1 -q -t -c "SELECT 1 FROM schema_migrations WHERE name = '$safe_name';" | grep -q 1; then
    echo "Skip (already applied): $name"
    continue
  fi
  echo "Applying: $name"
  psql -v ON_ERROR_STOP=1 -q -f "$f" && psql -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (name) VALUES ('$safe_name');"
done

echo "Migrations finished."
