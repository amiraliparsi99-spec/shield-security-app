-- Ensure the verification-documents bucket is public
-- The original migration used ON CONFLICT DO NOTHING, so if the bucket
-- was previously created as private it would have stayed private.
UPDATE storage.buckets
SET public = true
WHERE id = 'verification-documents';
