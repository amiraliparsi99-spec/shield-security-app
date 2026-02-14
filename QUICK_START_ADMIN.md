# Quick Start: Admin Portal

## 🚀 Get Started in 5 Minutes

### 1. Run Migrations

In Supabase SQL Editor, run these migrations in order:
1. `0006_kyc_verification.sql` (if not already run)
2. `0007_admin_role.sql`

### 2. Create Admin User

**Option 1: Using your existing account**

```sql
-- Replace 'your-email@example.com' with your email
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

**Option 2: Create new admin account**

1. Sign up normally at `/signup`
2. Then run:

```sql
-- Replace 'new-admin@example.com' with the new admin's email
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'new-admin@example.com'
);
```

### 3. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `verification-documents`
4. **Public**: ❌ No (private)
5. **File size limit**: 10MB
6. **Allowed MIME types**: `application/pdf,image/jpeg,image/jpg,image/png`

### 4. Set Storage Policies

Run in SQL Editor:

```sql
-- Allow users to upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents'
);

-- Allow users to view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents'
);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  is_admin(auth.uid())
);
```

### 5. Log In and Access Admin Portal

1. **Log in** with your admin account
2. Click **"Admin"** in the navigation bar
3. You'll see the admin dashboard
4. Click **"Verifications"** to review pending verifications

## 📋 Admin Workflow

### Reviewing a Verification:

1. **Go to** `/admin/verifications`
2. **Click** on a pending verification (left panel)
3. **Review** each document:
   - Click "View Document" to see the uploaded file
   - Check expiry dates, validity, etc.
4. **Approve or Reject:**
   - **Approve Document**: Click "Approve" on individual documents
   - **Approve All**: Click "Approve All" to verify entire submission
   - **Reject**: Click "Reject" and provide reason

### What Happens When You Approve:

- Document status → `verified`
- Verification status → `verified` (when all required docs are verified)
- User can now accept bookings ✅

## 🔒 Security Notes

- Only users with `role = 'admin'` can access `/admin/*`
- Admin access is enforced at both route level and database level (RLS)
- All admin actions are logged in the database

## 🆘 Troubleshooting

**Can't access `/admin`?**
- Check your profile has `role = 'admin'`: 
  ```sql
  SELECT role FROM profiles WHERE user_id = auth.uid();
  ```

**No verifications showing?**
- Check if any exist: 
  ```sql
  SELECT COUNT(*) FROM verifications WHERE status IN ('pending', 'in_review');
  ```

**Documents not uploading?**
- Verify storage bucket exists
- Check storage policies are set correctly

## 📚 Full Documentation

See `ADMIN_SETUP.md` for detailed setup instructions and `VERIFICATION_SETUP.md` for verification system details.
