# How to Create Your Admin Account

## The Problem
The signup page doesn't create a real Supabase account - it just sets a guest role. You need to create an actual account in Supabase Auth first.

## Solution: Create Account in Supabase Dashboard

### Option 1: Create Account via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project
   - Click **"Authentication"** in the left sidebar
   - Click **"Users"** tab

2. **Create New User:**
   - Click **"Add user"** button (or "Invite user")
   - Enter your email address
   - Enter a password (or let Supabase generate one)
   - Click **"Create user"**

3. **Set User as Admin:**
   - Go to **SQL Editor**
   - Run this (replace with your email):

```sql
-- Make your account admin
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

4. **Log in:**
   - Go to http://localhost:3000/login
   - Use the email and password you just created
   - You should now be able to log in!

### Option 2: Create Account via Sign Up (Then Make Admin)

1. **We need to add a real signup form first** - but for now, use Option 1 above.

## Quick Test

After creating the account and setting it to admin:

1. Go to http://localhost:3000/login
2. Enter your email and password
3. You should be logged in
4. You should see "Admin" in the navigation

## Troubleshooting

**Still can't log in?**
- Check browser console (F12) for errors
- Verify the account exists: Supabase Dashboard → Authentication → Users
- Verify the profile exists: Run `SELECT * FROM profiles WHERE email = 'your-email';`
- Make sure the role is 'admin': `SELECT role FROM profiles WHERE email = 'your-email';`
