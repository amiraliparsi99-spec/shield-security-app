-- 0065_support_tickets.sql
-- In-app support tickets: any logged-in user (venue, personnel, agency) can
-- raise a ticket and track its status. Admins manage tickets via the service
-- role (admin dashboard), so no admin RLS policies are needed here.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('venue', 'personnel', 'agency', 'admin')),
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'bookings', 'payments', 'account', 'technical', 'verification', 'other')),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
ON public.support_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
ON public.support_tickets(status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own tickets" ON public.support_tickets
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can create own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.support_tickets IS 'In-app support tickets raised by venues, personnel and agencies';
