-- Ensure your user has a profile with role = 'admin' so the Admin portal appears.
-- Replace YOUR_EMAIL_HERE with the email you use to log in.

-- 1) See your auth user and current profile (run this first to confirm your email)
SELECT 
  u.id AS auth_user_id,
  u.email,
  p.id AS profile_id,
  p.user_id AS profile_user_id,
  p.role AS current_role
FROM auth.users u
LEFT JOIN public.profiles p ON (p.user_id = u.id OR p.id = u.id)
WHERE u.email = 'YOUR_EMAIL_HERE';

-- 2a) If your profiles table has a "user_id" column (common): ensure profile exists and set admin
-- Run this in Supabase SQL Editor (replace YOUR_EMAIL_HERE):
/*
INSERT INTO public.profiles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
*/

-- 2b) If 2a fails with "ON CONFLICT cannot be used" or "column user_id does not exist",
--     run ONE of these instead:

-- Option A: Update by user_id (when profile already exists and has user_id column)
-- UPDATE public.profiles SET role = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');

-- Option B: Update by id (when profiles.id = auth.users.id)
-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');

-- Option C: Insert new profile when table has user_id (no conflict clause)
-- INSERT INTO public.profiles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
