#!/usr/bin/env bash
# Add redirect URI "capacitor://localhost" to an Entra (Azure AD) app registration
# so the Capacitor mobile app can sign in. Uses Azure CLI and Microsoft Graph.
#
# Prerequisites: az login (with permissions to update app registrations)
# Usage:
#   APP_ID=... ./scripts/add-capacitor-redirect-uri.sh
#   # If the app is in Entra External ID / B2C (no subscription), pass TENANT_ID
#   # so the script uses a token for that tenant instead of the default account:
#   TENANT_ID=deef4c8d-547a-466b-b07a-be3252e61648 APP_ID=224b901b-... ./scripts/add-capacitor-redirect-uri.sh
set -e

APP_ID="${APP_ID:-224b901b-a473-4b13-96dc-ed59fc14e0c3}"
REDIRECT_URI="${REDIRECT_URI:-capacitor://localhost}"
# Pillaxia (Entra External ID) tenant - set this when the app registration is in External ID and default az account is another tenant
TENANT_ID="${TENANT_ID:-}"

if ! command -v az &>/dev/null; then
  echo "ERROR: Azure CLI (az) is not installed. Install it from https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq" >&2
  exit 1
fi

# Ensure logged in (at least one account)
if ! az account show &>/dev/null 2>&1; then
  if [ -n "$TENANT_ID" ]; then
    echo "Run: az login --tenant $TENANT_ID" >&2
  else
    echo "Run: az login" >&2
  fi
  exit 1
fi

# When TENANT_ID is set, get a Graph token for that tenant (works for External ID tenants with no subscription)
# Otherwise use current account (az rest will use current tenant)
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
echo "Tenant ID:    ${TENANT_ID:-$CURRENT_TENANT}"
echo "App ID:       $APP_ID"
echo "Redirect URI: $REDIRECT_URI"
echo ""

# Helper: call Microsoft Graph (GET or PATCH). When ACCESS_TOKEN is set, use curl; else use az rest.
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

# Get application object (object id and current publicClient redirectUris)
RESPONSE=$(graph_get "https://graph.microsoft.com/v1.0/applications?\$filter=appId%20eq%20'${APP_ID}'" 2>&1) || true
APP_JSON=$(echo "$RESPONSE" | jq -r '.value[0] // empty' 2>/dev/null || true)

if [ -z "$APP_JSON" ] || [ "$APP_JSON" = "null" ]; then
  echo "ERROR: Application with appId $APP_ID not found in this tenant (or no permission)." >&2
  echo "" >&2
  echo "Possible causes:" >&2
  echo "  1. The app is in a different tenant (e.g. Entra External ID or B2C). Log in to that directory:" >&2
  echo "     az login --tenant <YOUR_CIAM_OR_B2C_TENANT_ID>" >&2
  echo "     Then run this script again. You can find the tenant ID in Azure Portal > Microsoft Entra External ID (or Azure AD B2C) > Overview." >&2
  echo "  2. Wrong APP_ID. Get the Application (client) ID from Azure Portal > App registrations > your app." >&2
  echo "  3. Your account needs permission to read app registrations (e.g. Application.ReadWrite.All)." >&2
  if echo "$RESPONSE" | jq -e '.error' &>/dev/null; then
    echo "" >&2
    echo "Graph API error: $(echo "$RESPONSE" | jq -r '.error.message // .error')" >&2
  fi
  exit 1
fi

OBJECT_ID=$(echo "$APP_JSON" | jq -r '.id')

# IMPORTANT: capacitor:// URIs must be under publicClient (Mobile and desktop), NOT SPA.
# If the URI is under SPA, Microsoft rejects the token exchange with AADSTS9002326
# ("Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type")
# because capacitor://localhost is not an HTTPS origin.

# Add REDIRECT_URI to publicClient if not already present
PUBLIC_URIS=$(echo "$APP_JSON" | jq -r --arg uri "$REDIRECT_URI" '
  (.publicClient.redirectUris // []) as $current |
  if ($current | index($uri)) then $current else ($current + [$uri]) end | @json
')

# Remove REDIRECT_URI from SPA if it exists there (wrong platform for custom schemes)
SPA_URIS=$(echo "$APP_JSON" | jq -r --arg uri "$REDIRECT_URI" '
  (.spa.redirectUris // []) as $current |
  [$current[] | select(. != $uri)] | @json
')

echo "Current publicClient redirect URIs: $(echo "$APP_JSON" | jq -r '.publicClient.redirectUris // []')"
echo "Current spa redirect URIs:          $(echo "$APP_JSON" | jq -r '.spa.redirectUris // []')"
echo ""
echo "Action: add '$REDIRECT_URI' to publicClient (Mobile and desktop)"
echo "Action: remove '$REDIRECT_URI' from SPA (if present)"
echo ""

# Also enable public client flows (required for PKCE without a client secret)
BODY=$(jq -n --argjson pub "$PUBLIC_URIS" --argjson spa "$SPA_URIS" '{
  publicClient: {redirectUris: $pub},
  spa: {redirectUris: $spa},
  isFallbackPublicClient: true
}')
graph_patch "https://graph.microsoft.com/v1.0/applications/${OBJECT_ID}" "$BODY"

echo ""
echo "Done. '$REDIRECT_URI' is now under Mobile and desktop (publicClient) only."
echo "Public client flows are enabled (isFallbackPublicClient = true)."
echo "Try sign-in again in the Capacitor app."
