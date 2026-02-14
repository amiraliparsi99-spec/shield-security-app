# Create Storage Bucket for Verification Documents

## Step 1: Create the Bucket in Supabase Dashboard

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project
   - Click **"Storage"** in the left sidebar

2. **Create New Bucket:**
   - Click **"New bucket"** button
   - **Name:** `verification-documents`
   - **Public bucket:** ❌ **Unchecked** (keep it private)
   - **File size limit:** `10` MB
   - **Allowed MIME types:** `application/pdf,image/jpeg,image/jpg,image/png`
   - Click **"Create bucket"**

## Step 2: Set Storage Policies

Run this SQL in Supabase SQL Editor:

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

## Step 3: Verify It Works

1. **Refresh the verification page**
2. **Try uploading a document**
3. The "Bucket not found" error should be gone!

## Troubleshooting

**Still getting "Bucket not found"?**
- Verify bucket name is exactly: `verification-documents` (case-sensitive)
- Check bucket exists: Supabase Dashboard → Storage
- Make sure you ran the storage policies SQL

**Can't upload files?**
- Check file size is under 10MB
- Check file type is PDF, JPG, or PNG
- Check browser console (F12) for errors
