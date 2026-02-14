-- Create Test Personnel Account
-- Replace 'test-personnel@example.com' with your test email

-- Step 1: Create profile (using id = user.id structure from 0001)
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'personnel'
FROM auth.users
WHERE email = 'test-personnel@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'personnel';

-- Step 2: Create personnel record (user_id references profiles.id)
INSERT INTO public.personnel (user_id, display_name, bio, city, region, country)
SELECT 
  id,
  'Test Security Guard',
  'Test account for verification',
  'Birmingham',
  'West Midlands',
  'GB'
FROM auth.users
WHERE email = 'test-personnel@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Verify it worked
SELECT 
  u.email,
  p.role,
  per.display_name,
  per.id as personnel_id
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.personnel per ON per.user_id = p.id
WHERE u.email = 'test-personnel@example.com';
