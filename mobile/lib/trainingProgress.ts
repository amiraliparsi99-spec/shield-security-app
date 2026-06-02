import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "../data/training-courses";

type CompletionRow = {
  course_id: string;
  badge_name: string;
  points_earned: number;
  quiz_score: number;
  completed_at: string;
};

export async function getMyPersonnelId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("personnel")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return data?.id || null;
}

export async function getTrainingCompletions(
  supabase: SupabaseClient,
  personnelId: string
): Promise<CompletionRow[]> {
  const { data } = await supabase
    .from("training_completions")
    .select("course_id,badge_name,points_earned,quiz_score,completed_at")
    .eq("personnel_id", personnelId)
    .order("completed_at", { ascending: false });
  return (data || []) as CompletionRow[];
}

export async function markTrainingComplete(
  supabase: SupabaseClient,
  personnelId: string,
  course: Course,
  quizScore: number
): Promise<{ alreadyCompleted: boolean; shieldScore: number | null }>{
  const { data, error } = await supabase.rpc("apply_training_completion", {
    p_personnel_id: personnelId,
    p_course_id: course.id,
    p_badge_name: course.badgeName,
    p_points_earned: course.points,
    p_quiz_score: quizScore,
  });
  if (error) {
    throw error;
  }
  return {
    alreadyCompleted: Boolean(data?.already_completed),
    shieldScore: typeof data?.shield_score === "number" ? data.shield_score : null,
  };
}
