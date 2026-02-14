-- Step 1: Check if your account exists and what role it has
-- Replace 'your-email@example.com' with YOUR actual email address
SELECT 
  u.email,
  u.id as user_id,
  p.role,
  p.id as profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'your-email@example.com';

-- Step 2: If the query above shows your email but role is NULL or not 'admin', run this:
-- Replace 'your-email@example.com' with YOUR actual email address
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- Step 3: If Step 2 returns "0 rows affected", it means you don't have a profile yet.
-- Run this instead to create your profile as admin:
-- Replace 'your-email@example.com' with YOUR actual email address
INSERT INTO public.profiles (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Step 4: Verify it worked - should show role = 'admin'
-- Replace 'your-email@example.com' with YOUR actual email address
SELECT 
  u.email,
  p.role
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'your-email@example.com';
