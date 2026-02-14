# How to Run the Admin Portal System

## Step-by-Step Setup

### Step 1: Run Database Migrations

1. **Open Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click **"SQL Editor"** in the left sidebar

2. **Run Verification Migration (if not already done):**
   - Open file: `supabase/migrations/0006_kyc_verification.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Run Admin Role Migration:**
   - Open file: `supabase/migrations/0007_admin_role.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **"Run"**

✅ You should see "Success. No rows returned" or similar success message.

### Step 2: Create Your Admin User

**Option A: Make your existing account an admin**

1. In Supabase SQL Editor, run:

```sql
-- Replace 'your-email@example.com' with YOUR email address
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

2. If you get "0 rows affected", create the profile first:

```sql
-- Replace with your email
INSERT INTO public.profiles (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

**Option B: Create a new admin account**

1. Sign up at `/signup` with a new email
2. Then run the SQL above with that email

### Step 3: Create Storage Bucket

1. **In Supabase Dashboard:**
   - Click **"Storage"** in the left sidebar
   - Click **"New bucket"** button

2. **Configure the bucket:**
   - **Name:** `verification-documents`
   - **Public bucket:** ❌ **Unchecked** (keep it private)
   - **File size limit:** `10` MB
   - **Allowed MIME types:** `application/pdf,image/jpeg,image/jpg,image/png`
   - Click **"Create bucket"**

3. **Set Storage Policies:**
   - Go back to **SQL Editor**
   - Run this SQL:

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

### Step 4: Start Your App

1. **Make sure your dev server is running:**
   ```bash
   cd "/Users/aliparsi99/security app"
   npm run dev
   ```

2. **If not running, start it:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Go to http://localhost:3000

### Step 5: Access Admin Portal

1. **Log in** with your admin account
   - Go to http://localhost:3000/login
   - Enter your admin email and password

2. **You should see "Admin" in the navigation bar**
   - Click **"Admin"** to go to the admin dashboard

3. **Go to Verifications:**
   - Click the **"Verifications"** card
   - Or go directly to: http://localhost:3000/admin/verifications

## Testing the System

### Test as Regular User (Personnel/Agency):

1. **Create a test account:**
   - Sign up at `/signup` as "personnel" or "agency"
   - Complete profile setup

2. **Submit verification:**
   - Go to `/verification`
   - Upload required documents
   - Documents will show as "pending"

### Test as Admin:

1. **Log in as admin**
2. **Go to** `/admin/verifications`
3. **You should see:**
   - List of pending verifications on the left
   - Click one to review documents
   - Approve or reject documents

## Quick Verification Checklist

- [ ] Migrations run successfully (no errors)
- [ ] Admin user created (check: `SELECT role FROM profiles WHERE email = 'your-email';`)
- [ ] Storage bucket `verification-documents` exists
- [ ] Storage policies created
- [ ] Can log in as admin
- [ ] "Admin" link appears in navigation
- [ ] Can access `/admin` page
- [ ] Can access `/admin/verifications` page

## Troubleshooting

### "Access Denied" when going to `/admin`

**Check if you're an admin:**
```sql
SELECT p.role, u.email 
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'your-email@example.com';
```

Should return `role = 'admin'`. If not, run Step 2 again.

### Storage bucket not found

- Go to Storage in Supabase Dashboard
- Verify bucket `verification-documents` exists
- If not, create it (Step 3)

### Documents not uploading

**Check storage policies:**
```sql
SELECT * FROM storage.policies 
WHERE bucket_id = 'verification-documents';
```

Should show 3 policies. If not, run Step 3 storage policies again.

### No verifications showing

This is normal if no one has submitted documents yet. To test:
1. Create a test personnel/agency account
2. Go to `/verification` and upload documents
3. Then check `/admin/verifications` again

## Next Steps

Once everything is working:

1. **Create more admin accounts** (if needed)
2. **Test the full workflow:**
   - User uploads documents
   - Admin reviews and approves
   - User can accept bookings

3. **Customize verification requirements** (optional):
   - Edit `verification_requirements` table
   - Add/remove required documents

## Need Help?

- Check Supabase logs: Dashboard → Logs
- Check browser console for errors
- Verify all migrations ran successfully
- Ensure storage bucket and policies are set up
