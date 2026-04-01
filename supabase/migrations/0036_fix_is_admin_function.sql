-- Fix is_admin() to check both profiles.id and profiles.user_id
-- The 0003 migration creates profiles with a separate id and user_id = auth.uid()
-- The 0034 rewrite only checks profiles.id = auth.uid(), which fails for those profiles.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (id = auth.uid() OR user_id = auth.uid())
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
