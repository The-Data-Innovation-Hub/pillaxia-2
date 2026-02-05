# Pillaxia API

Express API proxy with Azure AD B2C JWT validation and PostgREST integration.

## Flow

1. Client sends B2C JWT in `Authorization: Bearer <b2c-token>`
2. API validates B2C JWT with passport-azure-ad
3. API syncs user to `public.users` via `upsert_user_from_jwt`
4. API signs a new JWT with claims (oid, role) for PostgREST
5. API proxies request to PostgREST with signed JWT
6. PostgREST verifies JWT, sets `request.jwt.claims`, RLS uses `current_user_id()`

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | API port (default: 3000) |
| DATABASE_URL | PostgreSQL connection string |
| POSTGREST_URL | PostgREST base URL |
| JWT_SECRET | Shared secret for PostgREST JWT (must match PostgREST config) |
| AZURE_B2C_TENANT | B2C tenant name |
| AZURE_B2C_CLIENT_ID | B2C app registration client ID |
| AZURE_B2C_POLICY | B2C user flow (e.g., B2C_1_signin) |
| AZURE_B2C_TENANT_ID | B2C tenant GUID (optional) |
| AZURE_B2C_METADATA | OpenID metadata URL (optional) |
| CORS_ORIGIN | Allowed CORS origin |

## Setup

1. Create PostgREST config with same JWT_SECRET
2. Create `authenticated` role in PostgreSQL if not exists
3. Run migrations (000_auth_schema_adaptation first)
4. Start PostgREST on port 3001
5. Start API: `npm start`

## Frontend Integration

Replace Supabase URL with API URL. Use B2C JWT in Authorization header.
API exposes `/rest/*` as PostgREST-compatible endpoints.
