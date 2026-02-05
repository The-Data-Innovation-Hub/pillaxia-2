#!/usr/bin/env bash
# ============================================================
# Adapt Supabase migrations for Azure PostgreSQL
# Replaces auth.users with public.users, auth.uid() preserved via auth.uid() wrapper
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SUPABASE_MIGRATIONS="$PROJECT_ROOT/supabase/migrations"
OUTPUT_DIR="${1:-$PROJECT_ROOT/infrastructure/migrations/adapted}"
mkdir -p "$OUTPUT_DIR"

echo "Adapting migrations for Azure..."
echo "  Source: $SUPABASE_MIGRATIONS"
echo "  Output: $OUTPUT_DIR"

# Process each migration file in order
for file in "$SUPABASE_MIGRATIONS"/*.sql; do
  [ -f "$file" ] || continue
  basename=$(basename "$file")
  output="$OUTPUT_DIR/$basename"

  echo "  Processing $basename"

  # Replace all auth.users references with public.users
  sed -e 's/REFERENCES auth\.users(id)/REFERENCES public.users(id)/g' \
      -e 's/REFERENCES auth\.users (id)/REFERENCES public.users(id)/g' \
      -e 's/auth\.users/public.users/g' \
      "$file" > "$output"

  # auth.uid() is preserved - 000_auth_schema_adaptation creates auth.uid() wrapper
  # No replacement needed for auth.uid()
done

echo "Done. Adapted migrations written to $OUTPUT_DIR"
echo ""
echo "Run migrations with: scripts/run_migrations_azure.sh"
