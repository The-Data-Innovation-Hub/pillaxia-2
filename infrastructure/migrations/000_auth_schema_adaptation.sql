-- ============================================================
-- Azure Migration: Auth Schema Adaptation
-- Runs FIRST before all other migrations
-- Replaces Supabase auth.users with public.users for Azure AD B2C
-- ============================================================
-- Note: Azure Flexible Server requires extensions to be allow-listed.
-- Enable uuid-ossp, pgcrypto, pg_trgm in Portal: Server parameters
-- (azure.extensions) or run as server admin. This script does not
-- create them so it can run with standard DB user.
-- ============================================================

-- ============================================================
-- 1. Create public.users table (replaces auth.users)
-- Maps to Azure AD B2C object ID (oid) from JWT claims
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ============================================================
-- 2. Create current_user_id() function (replaces auth.uid())
-- Reads user ID from JWT claims (request.jwt.claims)
-- PostgREST/API must set request.jwt.claims before queries
-- ============================================================

-- Supports both 'oid' (Azure AD B2C) and 'sub' claims
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oid TEXT;
  v_sub TEXT;
BEGIN
  BEGIN
    v_oid := current_setting('request.jwt.claims', true)::json->>'oid';
    v_sub := current_setting('request.jwt.claims', true)::json->>'sub';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  -- Try oid first (Azure AD B2C object ID)
  IF v_oid IS NOT NULL AND v_oid != '' THEN
    BEGIN
      RETURN v_oid::UUID;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Fallback to sub claim
  IF v_sub IS NOT NULL AND v_sub != '' THEN
    BEGIN
      RETURN v_sub::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_user_id() IS 
  'Returns current user UUID from JWT claims (oid or sub). Replaces auth.uid() for Azure AD B2C. API must set request.jwt.claims.';

-- ============================================================
-- 3. Create function to sync user from JWT to public.users
-- API middleware calls this on first authenticated request
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_user_from_jwt(
  p_id UUID,
  p_email TEXT DEFAULT NULL,
  p_raw_user_meta_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, raw_user_meta_data, updated_at)
  VALUES (p_id, p_email, p_raw_user_meta_data, now())
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    raw_user_meta_data = COALESCE(EXCLUDED.raw_user_meta_data, public.users.raw_user_meta_data),
    updated_at = now();
  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_user_from_jwt IS 
  'Upserts user from Azure AD B2C JWT claims. Called by API middleware on first request.';

-- ============================================================
-- 4. Create schema alias for auth.users (optional compatibility)
-- Some migrations may reference auth.users - we create a view
-- ============================================================

-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Note: auth.users is a VIEW - FK references must use public.users
-- Run adapt_migrations_for_azure.sh to replace REFERENCES auth.users(id) with REFERENCES public.users(id)

-- ============================================================
-- 5. Create auth.uid() as wrapper for current_user_id()
-- Allows RLS policies to work with minimal changes
-- ============================================================

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_user_id();
$$;

COMMENT ON FUNCTION auth.uid() IS 
  'Alias for public.current_user_id(). Compatibility with Supabase RLS policies.';
