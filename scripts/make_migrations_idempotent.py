#!/usr/bin/env python3
"""
Script to make all migration files idempotent by adding:
- DROP POLICY IF EXISTS before CREATE POLICY
- DROP TRIGGER IF EXISTS before CREATE TRIGGER
- CREATE TABLE IF NOT EXISTS instead of CREATE TABLE
- CREATE INDEX IF NOT EXISTS instead of CREATE INDEX
"""

import os
import re
from pathlib import Path

def process_migration_file(filepath):
    """Process a single migration file to make it idempotent."""

    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    modified = False

    # 1. Add DROP POLICY IF EXISTS before CREATE POLICY
    # Match: CREATE POLICY "policy_name" ON table_name
    policy_pattern = r'CREATE POLICY "([^"]+)"\s+ON\s+(\S+)'

    def add_drop_policy(match):
        policy_name = match.group(1)
        table_name = match.group(2)
        full_match = match.group(0)

        # Check if DROP already exists before this CREATE
        before_text = content[:match.start()]
        drop_check = f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};'

        if drop_check in before_text[-200:]:  # Check last 200 chars before match
            return full_match
        else:
            return f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};\n{full_match}'

    new_content = re.sub(policy_pattern, add_drop_policy, content)
    if new_content != content:
        modified = True
        content = new_content

    # 2. Add DROP TRIGGER IF EXISTS before CREATE TRIGGER
    # Match: CREATE TRIGGER trigger_name ... ON table_name
    trigger_pattern = r'CREATE TRIGGER (\S+)\s+(?:BEFORE|AFTER|INSTEAD OF)\s+.*?\s+ON\s+(\S+)'

    def add_drop_trigger(match):
        trigger_name = match.group(1)
        table_name = match.group(2)
        full_match = match.group(0)

        # Check if DROP already exists
        before_text = content[:match.start()]
        drop_check = f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};'

        if drop_check in before_text[-200:]:
            return full_match
        else:
            return f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};\n{full_match}'

    new_content = re.sub(trigger_pattern, add_drop_trigger, content)
    if new_content != content:
        modified = True
        content = new_content

    # 3. Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
    table_pattern = r'\bCREATE TABLE (public\.\S+)'

    def add_if_not_exists_table(match):
        full_match = match.group(0)
        if 'IF NOT EXISTS' in full_match:
            return full_match
        return full_match.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')

    new_content = re.sub(table_pattern, add_if_not_exists_table, content)
    if new_content != content:
        modified = True
        content = new_content

    # 4. Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS
    index_pattern = r'\bCREATE (?:UNIQUE )?INDEX (\S+)'

    def add_if_not_exists_index(match):
        full_match = match.group(0)
        if 'IF NOT EXISTS' in full_match:
            return full_match
        if 'UNIQUE INDEX' in full_match:
            return full_match.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS')
        return full_match.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS')

    new_content = re.sub(index_pattern, add_if_not_exists_index, content)
    if new_content != content:
        modified = True
        content = new_content

    # 5. Wrap CREATE TYPE in DO block (only if not already wrapped)
    # This is more complex - look for CREATE TYPE not already in DO block
    type_pattern = r'^CREATE TYPE (public\.\S+) AS ENUM'

    def wrap_create_type(match):
        full_match = match.group(0)
        type_name = match.group(1)

        # Check if already in DO block
        before_text = content[:match.start()]
        if 'DO $$ BEGIN' in before_text[-100:]:
            return full_match

        # Find the semicolon ending this statement
        after_match = content[match.end():]
        semicolon_pos = after_match.find(';')
        if semicolon_pos != -1:
            type_definition = full_match + after_match[:semicolon_pos + 1]
            return f'''DO $$ BEGIN
  {type_definition}
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;'''
        return full_match

    # Only apply this if not already wrapped
    if 'CREATE TYPE' in content and 'DO $$ BEGIN' not in content:
        lines = content.split('\n')
        new_lines = []
        i = 0
        while i < len(lines):
            line = lines[i]
            if re.match(type_pattern, line.strip()):
                # Found CREATE TYPE, wrap it
                type_def_lines = [line]
                i += 1
                # Collect lines until semicolon
                while i < len(lines) and ';' not in lines[i-1]:
                    type_def_lines.append(lines[i])
                    i += 1

                type_definition = '\n'.join(type_def_lines)
                type_name = re.search(r'CREATE TYPE (\S+)', type_definition).group(1)

                new_lines.append(f'DO $$ BEGIN')
                new_lines.append(f'  {type_definition}')
                new_lines.append(f'EXCEPTION')
                new_lines.append(f'  WHEN duplicate_object THEN null;')
                new_lines.append(f'END $$;')
                modified = True
            else:
                new_lines.append(line)
                i += 1

        content = '\n'.join(new_lines)

    # Write back if modified
    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
        return True

    return False


def main():
    script_dir = Path(__file__).parent
    migrations_dir = script_dir.parent / 'infrastructure' / 'migrations' / 'adapted'

    print(f"Making all migrations idempotent...")
    print(f"Processing migrations in: {migrations_dir}")
    print()

    if not migrations_dir.exists():
        print(f"ERROR: Migrations directory not found: {migrations_dir}")
        return 1

    migration_files = sorted(migrations_dir.glob('*.sql'))
    total_files = len(migration_files)
    modified_files = 0

    for filepath in migration_files:
        print(f"Processing: {filepath.name}", end='')

        try:
            if process_migration_file(filepath):
                print(" ✓ Modified")
                modified_files += 1
            else:
                print(" - No changes needed")
        except Exception as e:
            print(f" ✗ Error: {e}")

    print()
    print("Summary:")
    print(f"  Total files: {total_files}")
    print(f"  Modified: {modified_files}")
    print(f"  Unchanged: {total_files - modified_files}")
    print()
    print("Done! All migrations should now be idempotent.")

    return 0


if __name__ == '__main__':
    exit(main())
