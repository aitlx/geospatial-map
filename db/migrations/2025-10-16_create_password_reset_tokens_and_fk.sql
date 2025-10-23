-- Migration: create password_reset_tokens table (if missing) and backfill / add FK for password_resets
-- Note: Run in a safe maintenance window. Backup your DB before applying.

BEGIN;

-- Create table used by new link-based reset flow
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON password_reset_tokens (token);

-- If there is an existing legacy password_reset_codes table, keep it but try to backfill password_reset_tokens.user_id FK if possible.
-- Also prepare a safe migration to enforce FK on password_reset_codes -> users(userid) if that table exists and its user_id may be nullable.

-- Ensure users table exists and has userid primary key
-- If your users primary key is not "userid", update the following statements accordingly.

-- Backfill: if password_reset_codes exists and has rows referencing emails, try to link them by email
DO $$
BEGIN
  IF to_regclass('public.password_reset_codes') IS NOT NULL THEN
    -- if password_reset_codes has user_id null but an email column or can be resolved, skip complex backfill here and warn
    RAISE NOTICE 'password_reset_codes exists; ensure its user_id column references users.userid before enforcing NOT NULL/foreign key.';
  END IF;
END$$;

-- Add FK to password_reset_tokens.user_id referencing users(userid)
-- Only add if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'f' AND t.relname = 'password_reset_tokens'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE;
  END IF;
END$$;

COMMIT;
