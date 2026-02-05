#!/usr/bin/env bash
# ============================================================
# Validate Azure PostgreSQL migrations
# Uses same env vars as run_migrations_azure.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/infrastructure/migrations"
VALIDATE_SQL="${MIGRATIONS_DIR}/validate_azure.sql"

PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-pillaxia}"
PGUSER="${PGUSER:-}"
PGPASSWORD="${PGPASSWORD:-}"

if [ -z "$PGHOST" ] || [ -z "$PGUSER" ]; then
  echo "Usage: PGHOST=... PGUSER=... PGPASSWORD=... $0"
  exit 1
fi

export PGPORT PGDATABASE PGPASSWORD

echo "Validating migrations on $PGHOST/$PGDATABASE..."
echo ""

if [ ! -f "$VALIDATE_SQL" ]; then
  echo "Error: $VALIDATE_SQL not found"
  exit 1
fi

output=$(psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=require" -t -A -F'|' -f "$VALIDATE_SQL" 2>&1) || {
  echo "Connection or validation query failed:"
  echo "$output"
  exit 1
}

failed=0
while IFS='|' read -r category check_name ok; do
  [ -z "$category" ] && continue
  ok=$(echo "$ok" | tr -d ' \r\n')
  if [ "$ok" = "t" ] || [ "$ok" = "1" ]; then
    echo "  OK   $category: $check_name"
  else
    echo "  FAIL $category: $check_name"
    failed=1
  fi
done <<< "$output"

echo ""
if [ $failed -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "Some checks failed. Re-run migrations if needed."
  exit 1
fi
