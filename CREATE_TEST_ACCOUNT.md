# Create Test Account for Verification Testing

## Step 1: Create User in Supabase Auth

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"**
3. Enter:
   - **Email:** `test-personnel@example.com` (or any test email)
   - **Password:** Choose a password (remember it!)
4. Click **"Create user"**

## Step 2: Create Profile and Personnel Record

Run this SQL in Supabase SQL Editor (replace the email):

```sql
-- Replace 'test-personnel@example.com' with the email you used
WITH user_data AS (
  SELECT id, email FROM auth.users WHERE email = 'test-personnel@example.com'
)
-- Create profile
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'personnel'
FROM user_data
ON CONFLICT (id) DO UPDATE SET role = 'personnel';

-- Create personnel record
INSERT INTO public.personnel (user_id, display_name, bio, city, region, country)
SELECT 
  id,
  'Test Security Guard',
  'Test account for verification',
  'Birmingham',
  'West Midlands',
  'GB'
FROM user_data
ON CONFLICT (user_id) DO NOTHING;
```

## Step 3: Log In and Upload Documents

1. **Log out** of your admin account (if logged in)
2. Go to http://localhost:3000/login
3. Log in with the test account email and password
4. Click **"Verification"** in the navigation
5. Upload documents using the drag-and-drop interface

## Step 4: Check Admin Portal

1. **Log out** of the test account
2. **Log back in** as admin
3. Go to **Admin** → **Verifications**
4. You should see the test account's verification with uploaded documents!

## Quick SQL for Agency Test Account

If you want to test with an agency instead:

```sql
-- Replace 'test-agency@example.com' with the email
WITH user_data AS (
  SELECT id, email FROM auth.users WHERE email = 'test-agency@example.com'
)
-- Create profile
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'agency'
FROM user_data
ON CONFLICT (id) DO UPDATE SET role = 'agency';

-- Create agency record
INSERT INTO public.agencies (owner_id, name, slug, description, city, region, country)
SELECT 
  id,
  'Test Security Agency',
  'test-security-agency',
  'Test agency for verification',
  'Birmingham',
  'West Midlands',
  'GB'
FROM user_data
ON CONFLICT (slug) DO NOTHING;
```
