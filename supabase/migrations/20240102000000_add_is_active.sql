-- Add is_active flag to profiles (default false — all users blocked until manually activated)
alter table profiles
  add column if not exists is_active boolean not null default false;

-- Allow the service role (used by proxy) to read is_active without RLS interference
-- Users can still read their own profile (existing policy covers it)
