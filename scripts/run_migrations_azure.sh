#!/usr/bin/env bash
# ============================================================
# Run migrations against Azure PostgreSQL
# Tracks applied migrations in a schema_migrations table to
# ensure each migration only runs once.
# Requires: psql
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/infrastructure/migrations"
ADAPTED_DIR="${MIGRATIONS_DIR}/adapted"
SUPABASE_MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

# Connection - use env vars or prompt
PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-pillaxia}"
PGUSER="${PGUSER:-}"
PGPASSWORD="${PGPASSWORD:-}"

if [ -z "$PGHOST" ] || [ -z "$PGUSER" ]; then
  echo "Usage: PGHOST=your-server.postgres.database.azure.com PGUSER=admin PGPASSWORD=xxx $0"
  echo "  Or set: PGHOST, PGUSER, PGPASSWORD, PGDATABASE (default: pillaxia)"
  exit 1
fi

export PGPORT PGDATABASE PGPASSWORD

CONN="host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=require"

echo "Running migrations against $PGHOST/$PGDATABASE..."
echo ""

# ── Ensure schema_migrations tracking table exists ──
psql "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# ── Helper: run a migration file if not already applied ──
run_if_new() {
  local filepath="$1"
  local filename
  filename="$(basename "$filepath")"

  # Check if already applied
  local applied
  applied=$(psql "$CONN" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$filename' LIMIT 1")

  if [ "$applied" = "1" ]; then
    echo "   SKIP (already applied): $filename"
    return 0
  fi

  echo "   APPLY: $filename"
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$filepath" || {
    echo "   FAILED: $filename"
    exit 1
  }

  # Record as applied
  psql "$CONN" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('$filename')"
}

# ── 1. Run auth schema adaptation ──
echo "1. Auth schema adaptation"
if [ -f "$MIGRATIONS_DIR/000_auth_schema_adaptation.sql" ]; then
  run_if_new "$MIGRATIONS_DIR/000_auth_schema_adaptation.sql"
fi

# ── 2. Run adapted migrations (Azure-specific) ──
if [ -d "$ADAPTED_DIR" ]; then
  echo ""
  echo "2. Running adapted migrations..."
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    run_if_new "$file"
  done < <(find "$ADAPTED_DIR" -maxdepth 1 -name "*.sql" 2>/dev/null | sort)
else
  echo ""
  echo "2. No adapted migrations directory found."
fi

# ── 3. Run supabase-style migrations (from supabase/migrations/) ──
if [ -d "$SUPABASE_MIGRATIONS_DIR" ]; then
  echo ""
  echo "3. Running supabase migrations..."
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    run_if_new "$file"
  done < <(find "$SUPABASE_MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" 2>/dev/null | sort)
else
  echo ""
  echo "3. No supabase migrations directory found."
fi

echo ""
echo "Migrations complete."

# Show summary
TOTAL=$(psql "$CONN" -tAc "SELECT COUNT(*) FROM schema_migrations")
echo "Total applied migrations: $TOTAL"
