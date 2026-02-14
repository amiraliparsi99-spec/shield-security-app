-- Growth Features: Push Notifications & Referral System
-- =====================================================================

-- =====================================================================
-- 1. PUSH NOTIFICATIONS
-- =====================================================================

-- Push tokens for each device
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios', 'android', 'web'
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id, is_active);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Push notification types
  push_new_booking BOOLEAN DEFAULT true,
  push_booking_confirmed BOOLEAN DEFAULT true,
  push_booking_cancelled BOOLEAN DEFAULT true,
  push_shift_reminder BOOLEAN DEFAULT true,
  push_payment_received BOOLEAN DEFAULT true,
  push_new_message BOOLEAN DEFAULT true,
  push_new_review BOOLEAN DEFAULT true,
  push_license_expiry BOOLEAN DEFAULT true,
  push_marketing BOOLEAN DEFAULT false,
  
  -- Email notification types
  email_booking_summary BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT true,
  email_payment_receipt BOOLEAN DEFAULT true,
  email_marketing BOOLEAN DEFAULT false,
  
  -- Reminder timing
  shift_reminder_hours INTEGER DEFAULT 2, -- hours before shift
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notification log (for analytics and debugging)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'sent', -- sent, delivered, failed, clicked
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type, sent_at DESC);

-- =====================================================================
-- 2. REFERRAL SYSTEM
-- =====================================================================

-- User referral codes and stats
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  
  -- Stats
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0, -- completed first booking
  total_earned INTEGER DEFAULT 0, -- in pence
  
  -- Tier (calculated)
  tier TEXT DEFAULT 'bronze', -- bronze, silver, gold, platinum
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_tier ON referrals(tier, successful_referrals DESC);

-- Individual referral tracking
CREATE TABLE IF NOT EXISTS referral_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL, -- who referred
  referee_id UUID NOT NULL UNIQUE, -- who signed up
  referral_code TEXT NOT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, qualified, rewarded, expired
  
  -- Reward tracking
  referrer_reward INTEGER DEFAULT 1000, -- 1000 pence = £10
  referee_reward INTEGER DEFAULT 1000,
  referrer_paid BOOLEAN DEFAULT false,
  referee_paid BOOLEAN DEFAULT false,
  
  -- Qualification (e.g., first booking completed)
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON referral_signups(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referee ON referral_signups(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_status ON referral_signups(status);

-- Referral rewards/credits
CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL, -- in pence
  type TEXT NOT NULL, -- 'referral_bonus', 'signup_bonus', 'tier_bonus'
  description TEXT,
  referral_signup_id UUID,
  
  -- Usage
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  used_for TEXT, -- booking_id or description
  
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_user ON referral_credits(user_id, is_used);

-- =====================================================================
-- 3. RLS POLICIES
-- =====================================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;

-- Push tokens
DROP POLICY IF EXISTS "Users manage own push tokens" ON push_tokens;
CREATE POLICY "Users manage own push tokens" ON push_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notification preferences
DROP POLICY IF EXISTS "Users manage own preferences" ON notification_preferences;
CREATE POLICY "Users manage own preferences" ON notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notification log
DROP POLICY IF EXISTS "Users view own notifications" ON notification_log;
CREATE POLICY "Users view own notifications" ON notification_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Referrals
DROP POLICY IF EXISTS "Users view own referral data" ON referrals;
CREATE POLICY "Users view own referral data" ON referrals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own referral" ON referrals;
CREATE POLICY "Users can create own referral" ON referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can read referral codes" ON referrals;
CREATE POLICY "Public can read referral codes" ON referrals
  FOR SELECT TO authenticated USING (true);

-- Referral signups
DROP POLICY IF EXISTS "Referrers view their referrals" ON referral_signups;
CREATE POLICY "Referrers view their referrals" ON referral_signups
  FOR SELECT TO authenticated 
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- Referral credits
DROP POLICY IF EXISTS "Users view own credits" ON referral_credits;
CREATE POLICY "Users view own credits" ON referral_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 4. FUNCTIONS
-- =====================================================================

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(user_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base from name (first 4 chars uppercase)
  base_code := UPPER(SUBSTRING(REGEXP_REPLACE(user_name, '[^a-zA-Z]', '', 'g'), 1, 4));
  
  -- Add random numbers
  final_code := base_code || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  
  -- Check uniqueness and regenerate if needed
  WHILE EXISTS (SELECT 1 FROM referrals WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
    IF counter > 10 THEN
      final_code := base_code || EXTRACT(EPOCH FROM NOW())::INTEGER::TEXT;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_code;
END;
$$;

-- Calculate referral tier
CREATE OR REPLACE FUNCTION calculate_referral_tier(successful_count INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF successful_count >= 50 THEN
    RETURN 'platinum';
  ELSIF successful_count >= 30 THEN
    RETURN 'gold';
  ELSIF successful_count >= 15 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$;

-- Process referral qualification (called when first booking completes)
CREATE OR REPLACE FUNCTION process_referral_qualification(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  signup_record RECORD;
BEGIN
  -- Find pending referral signup
  SELECT * INTO signup_record
  FROM referral_signups
  WHERE referee_id = p_user_id AND status = 'pending';
  
  IF signup_record IS NOT NULL THEN
    -- Update signup to qualified
    UPDATE referral_signups
    SET status = 'qualified', qualified_at = NOW()
    WHERE id = signup_record.id;
    
    -- Add credits to both parties
    INSERT INTO referral_credits (user_id, amount, type, description, referral_signup_id, expires_at)
    VALUES 
      (signup_record.referrer_id, signup_record.referrer_reward, 'referral_bonus', 
       'Referral bonus for successful signup', signup_record.id, NOW() + INTERVAL '90 days'),
      (signup_record.referee_id, signup_record.referee_reward, 'signup_bonus',
       'Welcome bonus for using referral code', signup_record.id, NOW() + INTERVAL '90 days');
    
    -- Update referral stats
    UPDATE referrals
    SET 
      successful_referrals = successful_referrals + 1,
      total_earned = total_earned + signup_record.referrer_reward,
      tier = calculate_referral_tier(successful_referrals + 1),
      updated_at = NOW()
    WHERE user_id = signup_record.referrer_id;
    
    -- Mark as rewarded
    UPDATE referral_signups
    SET status = 'rewarded', rewarded_at = NOW(), referrer_paid = true, referee_paid = true
    WHERE id = signup_record.id;
  END IF;
END;
$$;

-- Get referral leaderboard
CREATE OR REPLACE FUNCTION get_referral_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  referral_code TEXT,
  successful_referrals INTEGER,
  tier TEXT,
  total_earned INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY r.successful_referrals DESC) as rank,
    r.user_id,
    r.referral_code,
    r.successful_referrals,
    r.tier,
    r.total_earned
  FROM referrals r
  WHERE r.successful_referrals > 0
  ORDER BY r.successful_referrals DESC
  LIMIT limit_count;
END;
$$;

-- Get user's available credits
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM referral_credits
  WHERE user_id = p_user_id 
    AND is_used = false 
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN total;
END;
$$;

-- Trigger to update notification preferences updated_at
CREATE OR REPLACE FUNCTION update_notification_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_preferences_timestamp ON notification_preferences;
CREATE TRIGGER update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_notification_prefs_timestamp();

-- Trigger to update referrals updated_at
DROP TRIGGER IF EXISTS update_referrals_timestamp ON referrals;
CREATE TRIGGER update_referrals_timestamp
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_notification_prefs_timestamp();
