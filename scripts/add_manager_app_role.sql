-- ============================================================
-- Add 'manager' to the app_role enum (if not already present)
-- ============================================================
-- Run this if the database was created from migrations that
-- only had patient, clinician, pharmacist, admin.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/add_manager_app_role.sql
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
