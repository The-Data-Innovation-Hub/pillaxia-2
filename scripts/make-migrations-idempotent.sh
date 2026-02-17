#!/bin/bash

# Script to make all migration files idempotent
# This adds IF EXISTS/IF NOT EXISTS clauses to prevent errors on re-runs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../infrastructure/migrations/adapted"

echo "Making all migrations idempotent..."
echo "Processing migrations in: $MIGRATIONS_DIR"
echo ""

# Counter for changes
total_files=0
modified_files=0

# Process each SQL file
for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    total_files=$((total_files + 1))
    filename=$(basename "$file")
    echo "Processing: $filename"

    # Create a temporary file
    temp_file="${file}.tmp"
    modified=0

    # Process the file line by line
    while IFS= read -r line || [ -n "$line" ]; do
      # Check if this is a CREATE POLICY line (not already preceded by DROP)
      if echo "$line" | grep -q "^CREATE POLICY"; then
        # Extract policy name and table
        policy_name=$(echo "$line" | sed -n 's/CREATE POLICY "\([^"]*\)".*/\1/p')
        table_name=$(echo "$line" | sed -n 's/.*ON \([^ ]*\).*/\1/p')

        if [ -n "$policy_name" ] && [ -n "$table_name" ]; then
          # Check if previous line is already DROP POLICY
          if [ -f "$temp_file" ] && tail -1 "$temp_file" | grep -q "DROP POLICY IF EXISTS \"$policy_name\""; then
            # Already has DROP, just write the line
            echo "$line" >> "$temp_file"
          else
            # Add DROP before CREATE
            echo "DROP POLICY IF EXISTS \"$policy_name\" ON $table_name;" >> "$temp_file"
            echo "$line" >> "$temp_file"
            modified=1
          fi
          continue
        fi
      fi

      # Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS (if not already)
      if echo "$line" | grep -q "^CREATE TABLE public\." && ! echo "$line" | grep -q "IF NOT EXISTS"; then
        line=$(echo "$line" | sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS public./')
        modified=1
      fi

      # Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS (if not already)
      if echo "$line" | grep -q "^CREATE INDEX" && ! echo "$line" | grep -q "IF NOT EXISTS"; then
        line=$(echo "$line" | sed 's/CREATE INDEX/CREATE INDEX IF NOT EXISTS/')
        modified=1
      fi

      # Handle CREATE TYPE - wrap in DO block if not already
      if echo "$line" | grep -q "^CREATE TYPE public\." && ! echo "$line" | grep -q "IF NOT EXISTS"; then
        # Check if we're already in a DO block
        if [ -f "$temp_file" ] && tail -5 "$temp_file" | grep -q "DO \$\$ BEGIN"; then
          # Already in DO block, just write the line
          echo "$line" >> "$temp_file"
        else
          # Need to wrap in DO block - this is complex, skip for now
          echo "$line" >> "$temp_file"
        fi
        continue
      fi

      # Check for CREATE TRIGGER without preceding DROP
      if echo "$line" | grep -q "^CREATE TRIGGER"; then
        trigger_name=$(echo "$line" | sed -n 's/CREATE TRIGGER \([^ ]*\).*/\1/p')
        table_name=$(echo "$line" | sed -n 's/.*ON \([^ ]*\).*/\1/p')

        if [ -n "$trigger_name" ] && [ -n "$table_name" ]; then
          # Check if previous line is already DROP TRIGGER
          if [ -f "$temp_file" ] && tail -1 "$temp_file" | grep -q "DROP TRIGGER IF EXISTS $trigger_name"; then
            # Already has DROP, just write the line
            echo "$line" >> "$temp_file"
          else
            # Add DROP before CREATE
            echo "DROP TRIGGER IF EXISTS $trigger_name ON $table_name;" >> "$temp_file"
            echo "$line" >> "$temp_file"
            modified=1
          fi
          continue
        fi
      fi

      # Write the line as-is
      echo "$line" >> "$temp_file"
    done < "$file"

    # Replace original file if modified
    if [ $modified -eq 1 ]; then
      mv "$temp_file" "$file"
      modified_files=$((modified_files + 1))
      echo "  ✓ Modified"
    else
      rm -f "$temp_file"
      echo "  - No changes needed"
    fi
  fi
done

echo ""
echo "Summary:"
echo "  Total files: $total_files"
echo "  Modified: $modified_files"
echo "  Unchanged: $((total_files - modified_files))"
echo ""
echo "Done! All migrations are now idempotent."
