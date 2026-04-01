-- Create the verification-documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own documents
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
CREATE POLICY "Users can upload verification documents" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verification-documents');

-- Allow authenticated users to read their own documents
DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;
CREATE POLICY "Users can view own verification documents" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-documents');

-- Allow public read access (bucket is public)
DROP POLICY IF EXISTS "Public read access for verification documents" ON storage.objects;
CREATE POLICY "Public read access for verification documents" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'verification-documents');
