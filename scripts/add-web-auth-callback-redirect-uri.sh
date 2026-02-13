#!/usr/bin/env bash
# Add redirect URI for the web auth callback (e.g. https://your-app.azurestaticapps.net/auth/callback)
# to the Entra (Azure AD) app registration so sign-in redirects to /auth/callback instead of /.
#
# Prerequisites: az login (with permissions to update app registrations), jq
# Usage:
#   ./scripts/add-web-auth-callback-redirect-uri.sh
#   REDIRECT_URI=https://your-site.com/auth/callback ./scripts/add-web-auth-callback-redirect-uri.sh
#   TENANT_ID=deef4c8d-547a-466b-b07a-be3252e61648 ./scripts/add-web-auth-callback-redirect-uri.sh
set -e

APP_ID="${APP_ID:-224b901b-a473-4b13-96dc-ed59fc14e0c3}"
REDIRECT_URI="${REDIRECT_URI:-https://ashy-bush-075a67503.1.azurestaticapps.net/auth/callback}"
TENANT_ID="${TENANT_ID:-}"

if ! command -v az &>/dev/null; then
  echo "ERROR: Azure CLI (az) is not installed. Install it from https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq" >&2
  exit 1
fi

if ! az account show &>/dev/null 2>&1; then
  if [ -n "$TENANT_ID" ]; then
    echo "Run: az login --tenant $TENANT_ID" >&2
  else
    echo "Run: az login" >&2
  fi
  exit 1
fi

if [ -n "$TENANT_ID" ]; then
  echo "Using token for tenant $TENANT_ID (Entra External ID / B2C)."
  if ! ACCESS_TOKEN=$(az account get-access-token --tenant "$TENANT_ID" --resource 00000003-0000-0000-c000-000000000000 --query accessToken -o tsv 2>/dev/null); then
    echo "ERROR: Could not get token for tenant $TENANT_ID. Run: az login --tenant $TENANT_ID" >&2
    exit 1
  fi
  CURRENT_USER="(token for tenant $TENANT_ID)"
else
  ACCESS_TOKEN=""
  CURRENT_USER=$(az account show --query user.name -o tsv 2>/dev/null || true)
  CURRENT_TENANT=$(az account show --query tenantId -o tsv 2>/dev/null || true)
  echo "Using current account (tenant $CURRENT_TENANT)."
fi

echo "Logged in as: $CURRENT_USER"
echo "App ID:       $APP_ID"
echo "Redirect URI: $REDIRECT_URI"
echo ""

graph_get() {
  local url="$1"
  if [ -n "$ACCESS_TOKEN" ]; then
    curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" "$url"
  else
    az rest --method GET --url "$url" -o json
  fi
}
graph_patch() {
  local url="$1"
  local body="$2"
  if [ -n "$ACCESS_TOKEN" ]; then
    curl -sS -f -X PATCH -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$body" "$url"
  else
    az rest --method PATCH --url "$url" --body "$body" --headers "Content-Type=application/json"
  fi
}

RESPONSE=$(graph_get "https://graph.microsoft.com/v1.0/applications?\$filter=appId%20eq%20'${APP_ID}'" 2>&1) || true
APP_JSON=$(echo "$RESPONSE" | jq -r '.value[0] // empty' 2>/dev/null || true)

if [ -z "$APP_JSON" ] || [ "$APP_JSON" = "null" ]; then
  echo "ERROR: Application with appId $APP_ID not found in this tenant (or no permission)." >&2
  if echo "$RESPONSE" | jq -e '.error' &>/dev/null; then
    echo "Graph API error: $(echo "$RESPONSE" | jq -r '.error.message // .error')" >&2
  fi
  exit 1
fi

OBJECT_ID=$(echo "$APP_JSON" | jq -r '.id')

# Add to SPA redirect URIs (typical for React PKCE). If your app uses "Web" platform, we add to web too.
SPA_URIS=$(echo "$APP_JSON" | jq -r --arg uri "$REDIRECT_URI" '
  (.spa.redirectUris // []) as $current |
  if ($current | index($uri)) then $current else ($current + [$uri]) end | @json
')
WEB_URIS=$(echo "$APP_JSON" | jq -r --arg uri "$REDIRECT_URI" '
  (.web.redirectUris // []) as $current |
  if ($current | index($uri)) then $current else ($current + [$uri]) end | @json
')

echo "Current spa redirect URIs: $(echo "$APP_JSON" | jq -r '.spa.redirectUris // []')"
echo "Current web redirect URIs: $(echo "$APP_JSON" | jq -r '.web.redirectUris // []')"
echo "Action: add '$REDIRECT_URI' to both SPA and Web (if not already present)"
echo ""

BODY=$(jq -n --argjson spa "$SPA_URIS" --argjson web "$WEB_URIS" '{
  spa: { redirectUris: $spa },
  web: { redirectUris: $web }
}')
graph_patch "https://graph.microsoft.com/v1.0/applications/${OBJECT_ID}" "$BODY"

echo "Done. '$REDIRECT_URI' is now registered. Sign-in should redirect to /auth/callback and then to the dashboard."
