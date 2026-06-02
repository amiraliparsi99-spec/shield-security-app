-- Persist training completions and apply Shield Score increments.

CREATE TABLE IF NOT EXISTS public.training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  points_earned INTEGER NOT NULL CHECK (points_earned >= 0),
  quiz_score INTEGER NOT NULL CHECK (quiz_score >= 0 AND quiz_score <= 100),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(personnel_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_training_completions_personnel
  ON public.training_completions(personnel_id, completed_at DESC);

ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Personnel can view own training completions" ON public.training_completions;
CREATE POLICY "Personnel can view own training completions"
  ON public.training_completions
  FOR SELECT
  TO authenticated
  USING (
    personnel_id IN (
      SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Personnel can insert own training completions" ON public.training_completions;
CREATE POLICY "Personnel can insert own training completions"
  ON public.training_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    personnel_id IN (
      SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.apply_training_completion(
  p_personnel_id UUID,
  p_course_id TEXT,
  p_badge_name TEXT,
  p_points_earned INTEGER,
  p_quiz_score INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner UUID;
  v_existing UUID;
  v_increment INTEGER;
  v_total_points INTEGER;
  v_total_completed INTEGER;
  v_new_score INTEGER;
  v_has_history_table BOOLEAN;
BEGIN
  SELECT user_id INTO v_owner
  FROM public.personnel
  WHERE id = p_personnel_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Personnel not found';
  END IF;

  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT id INTO v_existing
  FROM public.training_completions
  WHERE personnel_id = p_personnel_id
    AND course_id = p_course_id;

  IF v_existing IS NULL THEN
    INSERT INTO public.training_completions (
      personnel_id,
      course_id,
      badge_name,
      points_earned,
      quiz_score
    ) VALUES (
      p_personnel_id,
      p_course_id,
      p_badge_name,
      p_points_earned,
      p_quiz_score
    );

    -- Keep increments modest: +1 to +4 per course.
    v_increment := GREATEST(1, LEAST(4, FLOOR(p_points_earned / 25.0)::INTEGER));
    UPDATE public.personnel
    SET shield_score = LEAST(100, COALESCE(shield_score, 50) + v_increment)
    WHERE id = p_personnel_id
    RETURNING shield_score INTO v_new_score;

    SELECT to_regclass('public.shield_score_history') IS NOT NULL
    INTO v_has_history_table;

    IF v_has_history_table THEN
      INSERT INTO public.shield_score_history (personnel_id, points_change, reason)
      VALUES (
        p_personnel_id,
        v_increment,
        'Training completion: ' || p_course_id
      );
    END IF;
  ELSE
    SELECT shield_score INTO v_new_score
    FROM public.personnel
    WHERE id = p_personnel_id;
  END IF;

  SELECT COALESCE(SUM(points_earned), 0), COUNT(*)
  INTO v_total_points, v_total_completed
  FROM public.training_completions
  WHERE personnel_id = p_personnel_id;

  RETURN jsonb_build_object(
    'already_completed', v_existing IS NOT NULL,
    'total_points', v_total_points,
    'completed_courses', v_total_completed,
    'shield_score', COALESCE(v_new_score, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_training_completion(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
