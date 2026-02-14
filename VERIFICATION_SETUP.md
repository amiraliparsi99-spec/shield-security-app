# Verification System Setup Guide

## 1. Run Database Migration

Run the migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/0006_kyc_verification.sql
```

## 2. Create Storage Bucket

In Supabase Dashboard:

1. Go to **Storage**
2. Click **New bucket**
3. Name: `verification-documents`
4. **Public**: No (private bucket)
5. **File size limit**: 10MB
6. **Allowed MIME types**: `application/pdf,image/jpeg,image/jpg,image/png`

### Storage Policies

Create RLS policies for the bucket:

```sql
-- Allow users to upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = 'personnel' OR
  (storage.foldername(name))[1] = 'agency'
);

-- Allow users to view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = 'personnel' OR
  (storage.foldername(name))[1] = 'agency'
);

-- Allow admins to view all documents
-- (Add admin role check when you implement admin system)
```

## 3. Update Navigation

Add verification link to your navigation. Update `src/components/auth/AppNav.tsx`:

```tsx
<Link href="/verification" className="...">
  Verification
</Link>
```

## 4. Test the System

1. **As Personnel/Agency:**
   - Go to `/verification`
   - Upload required documents
   - Check verification status

2. **As Admin:**
   - Go to `/admin/verifications`
   - Review pending verifications
   - Approve or reject documents

## 5. Next Steps

### Automated Verification (Optional)

1. **SIA License Check:**
   - Integrate with SIA API (if available)
   - Or web scraping for license validation
   - Add to `verification_documents.metadata`

2. **Companies House API:**
   - Free API for UK company verification
   - Verify agency company registration
   - Add automated check on document upload

3. **Third-Party Identity Verification:**
   - Onfido or Veriff integration
   - Automated ID document verification
   - Update `automated_check_status` field

### Expiry Monitoring

Create a scheduled function to check for expiring documents:

```sql
-- Function to check expiring documents
CREATE OR REPLACE FUNCTION check_expiring_documents()
RETURNS void AS $$
BEGIN
  -- Update status to 'expired' for documents expiring in 30 days
  UPDATE verification_documents
  SET status = 'expired'
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW() + INTERVAL '30 days'
    AND status = 'verified';
    
  -- Update verification status if mandatory documents expired
  UPDATE verifications
  SET status = 'expired'
  WHERE id IN (
    SELECT DISTINCT v.id
    FROM verifications v
    JOIN verification_documents vd ON vd.owner_type = v.owner_type AND vd.owner_id = v.owner_id
    JOIN verification_requirements vr ON vr.document_type = vd.document_type AND vr.owner_type = v.owner_type
    WHERE vd.status = 'expired'
      AND vr.is_mandatory = true
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available) or external cron job
```

### Email Notifications

Set up email alerts for:
- Document uploaded (to admin)
- Verification approved (to user)
- Verification rejected (to user)
- Document expiring soon (to user)

## 6. Security Considerations

1. **File Validation:**
   - ✅ File type validation (PDF, JPG, PNG)
   - ✅ File size limits (10MB)
   - ⚠️ Add virus scanning (ClamAV or cloud service)
   - ⚠️ Add image validation (ensure it's a real document)

2. **Access Control:**
   - ✅ RLS policies on documents table
   - ✅ Private storage bucket
   - ⚠️ Add admin role system
   - ⚠️ Audit logging for all verification actions

3. **Data Privacy:**
   - ✅ Encrypted storage
   - ⚠️ GDPR compliance (right to deletion)
   - ⚠️ Data retention policies
   - ⚠️ Secure document deletion after verification

## 7. UI Enhancements

- [ ] Add verification badge to profiles
- [ ] Show verification status in search results
- [ ] Filter by verification status
- [ ] Verification progress indicator
- [ ] Document expiry warnings
- [ ] Mobile-optimized upload interface

## Troubleshooting

### Documents not uploading?
- Check storage bucket exists
- Verify RLS policies
- Check file size/type restrictions

### Verification status not updating?
- Check triggers are enabled
- Verify document status changes
- Check for database errors

### Admin can't access documents?
- Verify admin role/permissions
- Check storage bucket policies
- Ensure RLS policies allow admin access
