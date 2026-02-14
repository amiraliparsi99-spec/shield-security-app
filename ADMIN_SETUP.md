# Admin Portal Setup Guide

## Overview

The admin portal allows designated administrators to review and verify documents submitted by personnel and agencies. This guide explains how to set up and use the admin system.

## Step 1: Run Database Migration

Run the admin role migration in Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/0007_admin_role.sql
```

This will:
- Add 'admin' as a valid role in the profiles table
- Create admin access functions
- Update RLS policies to allow admins to view all verifications

## Step 2: Create Your First Admin User

### Option A: Via Supabase Dashboard (Recommended)

1. **Create the user account:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add user" or have the user sign up normally
   - Note the user's email and ID

2. **Set admin role in database:**
   - Go to Supabase Dashboard → SQL Editor
   - Run this SQL (replace `USER_EMAIL_HERE` with the admin's email):

```sql
-- Find the user ID
SELECT id, email FROM auth.users WHERE email = 'USER_EMAIL_HERE';

-- Update their profile to admin role
-- Replace USER_ID_HERE with the actual user ID from above
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = 'USER_ID_HERE';

-- If profile doesn't exist, create it
INSERT INTO public.profiles (user_id, email, role, full_name)
SELECT id, email, 'admin', raw_user_meta_data->>'full_name'
FROM auth.users
WHERE email = 'USER_EMAIL_HERE'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

### Option B: Via SQL Directly

```sql
-- First, get the user ID from auth.users
-- Then update or insert the profile
INSERT INTO public.profiles (user_id, email, role)
VALUES (
  'USER_ID_FROM_AUTH_USERS',
  'admin@yourcompany.com',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

## Step 3: Access the Admin Portal

1. **Log in** with the admin account
2. **Navigate to** `/admin` or click "Admin" in the navigation
3. You'll see the admin dashboard with:
   - Verifications panel
   - (Future: Users, Analytics, etc.)

## Step 4: Verify Users

1. **Go to Verifications:**
   - Click "Verifications" card or navigate to `/admin/verifications`

2. **Review Pending Verifications:**
   - See list of all pending verifications on the left
   - Click on a verification to review

3. **Review Documents:**
   - View each uploaded document
   - Check document validity, expiry dates, etc.

4. **Approve or Reject:**
   - **Approve Document:** Click "Approve" on individual documents
   - **Approve All:** Click "Approve All" to verify the entire submission
   - **Reject:** Click "Reject" and provide a reason (visible to user)

5. **Add Admin Notes:**
   - Use the "Admin Notes" field for internal notes (not visible to user)
   - Useful for tracking verification history

## Admin Portal Features

### Current Features:
- ✅ View all pending verifications
- ✅ Review uploaded documents
- ✅ Approve/reject individual documents
- ✅ Approve/reject entire verifications
- ✅ Add rejection reasons (visible to users)
- ✅ Add admin notes (internal only)

### Future Features:
- User management
- Analytics dashboard
- Bulk actions
- Email notifications
- Verification history/audit log

## Security Considerations

### Access Control:
- ✅ Only users with `role = 'admin'` can access `/admin/*` routes
- ✅ RLS policies restrict admin access to verification data
- ✅ Admin functions use `security definer` for proper access

### Best Practices:
1. **Limit Admin Accounts:** Only create admin accounts for trusted staff
2. **Regular Audits:** Review admin actions periodically
3. **Two-Factor Auth:** Enable 2FA for admin accounts (via Supabase Auth)
4. **Separate Admin Accounts:** Don't use personal accounts as admin accounts

## Creating Additional Admins

To add more admins, repeat Step 2 with different user emails.

## Troubleshooting

### "Access Denied" when accessing `/admin`
- Check that the user's profile has `role = 'admin'`
- Verify the migration ran successfully
- Check browser console for errors

### Can't see pending verifications
- Ensure RLS policies are correct
- Check that verifications exist with status 'pending' or 'in_review'
- Verify admin function `is_admin()` works: `SELECT is_admin('USER_ID');`

### Documents not loading
- Check storage bucket policies
- Verify RLS policies on `verification_documents` table
- Ensure admin has access to storage bucket

## Admin Workflow Example

1. **User submits documents** → Status: `pending`
2. **Admin reviews** → Status: `in_review`
3. **Admin approves documents** → Individual documents: `verified`
4. **All required documents verified** → Overall status: `verified`
5. **User can now accept bookings** ✅

## Support

For issues or questions:
1. Check Supabase logs for errors
2. Verify database migrations ran successfully
3. Check RLS policies are correct
4. Review browser console for client-side errors
