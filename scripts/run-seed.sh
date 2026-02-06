#!/usr/bin/env bash
# Run the demo/dev seed script. Requires DATABASE_URL so psql uses your DB,
# not the default local socket (which would prompt for your macOS user password).
set -e

# Trim whitespace and newlines; remove spaces after postgresql:// and after @ (so user/host have no leading space)
DATABASE_URL="$(echo -n "${DATABASE_URL}" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's|postgresql://[[:space:]]*|postgresql://|' | sed 's/@[[:space:]]*/@/g')"
# Strip any leading characters until we see postgresql:// (fixes copy-paste with smart/curly quotes)
while [ -n "$DATABASE_URL" ] && [ "${DATABASE_URL#postgresql://}" = "$DATABASE_URL" ]; do
  DATABASE_URL="${DATABASE_URL:1}"
done
# Strip trailing straight quotes and spaces
while [ -n "$DATABASE_URL" ] && ( [ "${DATABASE_URL: -1}" = "'" ] || [ "${DATABASE_URL: -1}" = '"' ] || [ "${DATABASE_URL: -1}" = " " ] ); do
  DATABASE_URL="${DATABASE_URL%?}"
done

if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "" >&2
  echo "In this terminal, run:" >&2
  echo "  export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'" >&2
  echo "" >&2
  echo "Then run this script again:  ./scripts/run-seed.sh" >&2
  exit 1
fi

if [ "${DATABASE_URL#postgresql://}" = "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL must start with postgresql://" >&2
  echo "  You have: ${DATABASE_URL:0:50}..." >&2
  echo "  Set it to a full URL, e.g. postgresql://user:pass@host:5432/dbname?sslmode=require" >&2
  exit 1
fi

# Show which host we're using (no password)
SHORT_URL="$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:****@/')"
echo "Using: ${SHORT_URL%%\?*}"
# If you see @@ or a space before the host, your password contains @ — encode it as %40 in the URL
echo "Running seed..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec psql "$DATABASE_URL" -f "${SCRIPT_DIR}/seed-azure-dev-data.sql"
