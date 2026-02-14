-- Fix venue ownership column mismatch
-- The RLS functions expect owner_id but some schemas use user_id
-- This migration ensures compatibility with both column names

-- Create a smarter get_my_venue_ids function that checks which column exists
CREATE OR REPLACE FUNCTION public.get_my_venue_ids()
RETURNS SETOF UUID AS $$
DECLARE
  has_owner_id boolean;
  has_user_id boolean;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'venues' 
    AND column_name = 'owner_id'
  ) INTO has_owner_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'venues' 
    AND column_name = 'user_id'
  ) INTO has_user_id;
  
  -- Return based on which column exists
  IF has_owner_id THEN
    RETURN QUERY SELECT id FROM public.venues WHERE owner_id = auth.uid();
  ELSIF has_user_id THEN
    RETURN QUERY SELECT id FROM public.venues WHERE user_id = auth.uid();
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_my_venue_ids() TO authenticated;

-- Also update the bookings RLS policies to use the updated function
DROP POLICY IF EXISTS "Venues can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can update their bookings" ON public.bookings;

-- Recreate policies using the updated function
CREATE POLICY "Venues can view their bookings" ON public.bookings
  FOR SELECT USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

CREATE POLICY "Venues can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

CREATE POLICY "Venues can update their bookings" ON public.bookings
  FOR UPDATE USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Add index on owner_id if it exists and index doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'venues' 
    AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'venues' 
    AND indexname = 'idx_venues_owner'
  ) THEN
    CREATE INDEX idx_venues_owner ON public.venues (owner_id);
  END IF;
END $$;

-- Add index on user_id if it exists and index doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'venues' 
    AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'venues' 
    AND indexname = 'idx_venues_user_id'
  ) THEN
    CREATE INDEX idx_venues_user_id ON public.venues (user_id);
  END IF;
END $$;
