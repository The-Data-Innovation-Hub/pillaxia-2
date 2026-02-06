-- Re-add email column to profiles table.
-- This undoes the 3NF drop from 20260204152820_fix_profiles_table.sql.
-- Having email on profiles is a minor denormalization but avoids requiring
-- 14+ frontend files to use the profiles_with_email view or join users.
-- The column is kept in sync via the application layer.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from users table for any existing rows
UPDATE public.profiles p
SET email = u.email
FROM public.users u
WHERE p.user_id = u.id
  AND p.email IS NULL
  AND u.email IS NOT NULL;
