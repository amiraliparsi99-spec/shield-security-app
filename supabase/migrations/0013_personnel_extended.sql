-- Add missing columns to personnel table for signup
-- These fields are commonly needed for security personnel profiles

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS sia_license_number TEXT,
  ADD COLUMN IF NOT EXISTS sia_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hourly_rate INTEGER;

-- Add RLS policy for personnel to insert their own record
CREATE POLICY "Users can insert own personnel record" ON public.personnel
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- Personnel can view all (for browsing)
CREATE POLICY "Personnel are viewable by all" ON public.personnel
  FOR SELECT USING (true);

-- Personnel can update their own record  
CREATE POLICY "Users can update own personnel record" ON public.personnel
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Add similar policies for profiles table (for upsert)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated 
  WITH CHECK (id = auth.uid());

-- Update display_name column to profiles if not exists
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
