#!/usr/bin/env bash
# ============================================================
# Run Demo Organizations Seed Script
# ============================================================
# Executes the seed-demo-organizations.sql script against
# the Azure PostgreSQL database.
#
# Usage:
#   ./scripts/run-seed-organizations.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/seed-demo-organizations.sql"

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

# Get connection details from environment or prompt
PGHOST="${PGHOST:-pillaxia-dev-pg.postgres.database.azure.com}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-pillaxia}"
PGUSER="${PGUSER:-pillaxiaadmin}"

if [ -z "$PGPASSWORD" ]; then
  echo "PGPASSWORD not set. Reading from api/.env..."
  if [ -f "$SCRIPT_DIR/../api/.env" ]; then
    # Extract password from DATABASE_URL in api/.env
    PGPASSWORD=$(grep "DATABASE_URL" "$SCRIPT_DIR/../api/.env" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    export PGPASSWORD
  else
    echo "Error: Could not find password. Set PGPASSWORD environment variable."
    exit 1
  fi
fi

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

echo "Seeding demo organizations to $PGHOST/$PGDATABASE..."
echo ""

# Run the SQL file
if psql -v ON_ERROR_STOP=1 -f "$SQL_FILE"; then
  echo ""
  echo "✅ Demo organizations seeded successfully!"
  echo ""
  echo "📋 Organizations Created:"
  echo "  1. Lagos General Hospital (Premium)"
  echo "     - Owner: manager@demo.pillaxia.com"
  echo "     - Admin: clinician@demo.pillaxia.com"
  echo "     - Theme: Blue"
  echo ""
  echo "  2. Abuja Medical Center (Standard)"
  echo "     - Owner: dr.okafor@pillaxia-dev.com"
  echo "     - Theme: Green"
  echo ""
  echo "  3. HealthPlus Pharmacy Network (Enterprise)"
  echo "     - Owner: pharmacist@demo.pillaxia.com"
  echo "     - Admin: pharm.adeyemi@pillaxia-dev.com"
  echo "     - Theme: Purple"
  echo ""
  echo "  4. Community Health Clinic (Trial)"
  echo "     - Owner: clinician@demo.pillaxia.com"
  echo "     - Theme: Orange"
  echo ""
  echo "🧪 Test Multi-Tenancy:"
  echo "  - Sign in as different users to see different organizations"
  echo "  - Each organization has custom branding (colors, name)"
  echo "  - Platform admin can see/manage all organizations"
else
  echo ""
  echo "❌ Failed to seed demo organizations"
  exit 1
fi
