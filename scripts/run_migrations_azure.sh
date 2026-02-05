#!/usr/bin/env bash
# ============================================================
# Run migrations against Azure PostgreSQL
# Requires: psql or Azure CLI (az postgres flexible-server execute)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/infrastructure/migrations"
ADAPTED_DIR="${MIGRATIONS_DIR}/adapted"

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

echo "Running migrations against $PGHOST/$PGDATABASE..."
echo ""

# 1. Run auth schema adaptation first
echo "1. Running 000_auth_schema_adaptation.sql"
psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=require" \
  -f "$MIGRATIONS_DIR/000_auth_schema_adaptation.sql" || {
  echo "Failed to run auth adaptation"
  exit 1
}

# 2. Run adapted migrations (if adapted dir exists)
if [ -d "$ADAPTED_DIR" ]; then
  echo ""
  echo "2. Running adapted Supabase migrations..."
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    echo "   $(basename "$file")"
    psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=require" \
      -f "$file" || {
      echo "   Failed on $file"
      exit 1
    }
  done < <(find "$ADAPTED_DIR" -maxdepth 1 -name "*.sql" 2>/dev/null | sort)
else
  echo ""
  echo "2. No adapted migrations found. Run: ./scripts/adapt_migrations_for_azure.sh first"
  echo "   Or run supabase migrations manually with auth.users -> public.users replaced"
fi

echo ""
echo "Migrations complete."
