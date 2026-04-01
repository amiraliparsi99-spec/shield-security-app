-- Allow authenticated users to insert their own verification records
-- This is needed as a safety net when the trigger doesn't fire
DROP POLICY IF EXISTS "Users can insert own verification" ON public.verifications;
CREATE POLICY "Users can insert own verification" ON public.verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_type = 'personnel' AND owner_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
    OR
    (owner_type = 'agency' AND owner_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()))
  );

-- Also ensure users can insert their own verification documents
DROP POLICY IF EXISTS "Users can insert own verification documents" ON public.verification_documents;
CREATE POLICY "Users can insert own verification documents" ON public.verification_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_type = 'personnel' AND owner_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
    OR
    (owner_type = 'agency' AND owner_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()))
  );

-- Ensure users can update their own verification documents (re-upload)
DROP POLICY IF EXISTS "Users can update own verification documents" ON public.verification_documents;
CREATE POLICY "Users can update own verification documents" ON public.verification_documents
  FOR UPDATE
  TO authenticated
  USING (
    (owner_type = 'personnel' AND owner_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
    OR
    (owner_type = 'agency' AND owner_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()))
  );
