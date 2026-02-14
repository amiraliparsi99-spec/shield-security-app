-- Reviews system improvements
-- Creates aggregated rating views and ensures proper review tracking

-- Add missing columns to reviews table if needed
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewee_type TEXT CHECK (reviewee_type IN ('personnel', 'venue', 'agency')),
ADD COLUMN IF NOT EXISTS safety_rating INTEGER CHECK (safety_rating >= 1 AND safety_rating <= 5),
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS response TEXT,
ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Create index for efficient review lookups
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id, reviewee_type);
CREATE INDEX IF NOT EXISTS idx_reviews_shift ON public.reviews(shift_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON public.reviews(booking_id) WHERE booking_id IS NOT NULL;

-- Create review_votes table for helpful votes
CREATE TABLE IF NOT EXISTS public.review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Create user_ratings view for aggregated stats
CREATE OR REPLACE VIEW public.user_ratings AS
SELECT 
  reviewee_id,
  reviewee_type,
  COUNT(*)::INTEGER as total_reviews,
  ROUND(AVG(overall_rating)::NUMERIC, 2)::FLOAT as avg_rating,
  ROUND(AVG(professionalism_rating)::NUMERIC, 2)::FLOAT as avg_professionalism,
  ROUND(AVG(punctuality_rating)::NUMERIC, 2)::FLOAT as avg_punctuality,
  ROUND(AVG(communication_rating)::NUMERIC, 2)::FLOAT as avg_communication,
  ROUND(AVG(safety_rating)::NUMERIC, 2)::FLOAT as avg_safety,
  MAX(created_at) as last_review_at
FROM public.reviews
WHERE is_public = TRUE
GROUP BY reviewee_id, reviewee_type;

-- Function to update helpful_count on reviews when votes change
CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.reviews
    SET helpful_count = (
      SELECT COUNT(*) FROM public.review_votes 
      WHERE review_id = NEW.review_id AND is_helpful = TRUE
    )
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reviews
    SET helpful_count = (
      SELECT COUNT(*) FROM public.review_votes 
      WHERE review_id = OLD.review_id AND is_helpful = TRUE
    )
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vote changes
DROP TRIGGER IF EXISTS on_review_vote_change ON public.review_votes;
CREATE TRIGGER on_review_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_helpful_count();

-- Function to mark review as verified if from a completed shift
CREATE OR REPLACE FUNCTION public.verify_review_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL THEN
    -- Check if shift is actually completed
    IF EXISTS (
      SELECT 1 FROM public.shifts 
      WHERE id = NEW.shift_id 
      AND status = 'checked_out'
    ) THEN
      NEW.is_verified := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-verify reviews
DROP TRIGGER IF EXISTS verify_review_trigger ON public.reviews;
CREATE TRIGGER verify_review_trigger
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_review_on_insert();

-- Enable RLS on review_votes
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

-- Users can view all votes
CREATE POLICY "Anyone can view review votes" ON public.review_votes
  FOR SELECT USING (true);

-- Users can vote on reviews
CREATE POLICY "Users can vote on reviews" ON public.review_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own votes
CREATE POLICY "Users can update own votes" ON public.review_votes
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes" ON public.review_votes
  FOR DELETE USING (user_id = auth.uid());

-- Grant access to the view
GRANT SELECT ON public.user_ratings TO authenticated;
GRANT SELECT ON public.user_ratings TO anon;

COMMENT ON VIEW public.user_ratings IS 'Aggregated ratings for users (personnel/venues/agencies)';
COMMENT ON TABLE public.review_votes IS 'Tracks helpful votes on reviews';
