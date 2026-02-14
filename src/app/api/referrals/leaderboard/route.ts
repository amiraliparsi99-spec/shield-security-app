import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const { data: leaderboard, error } = await supabase
      .rpc("get_referral_leaderboard", { limit_count: limit });

    if (error) {
      console.error("Leaderboard error:", error);
      return NextResponse.json({ error: "Failed to get leaderboard" }, { status: 500 });
    }

    // Get user names for display
    const userIds = leaderboard?.map((l: any) => l.user_id) || [];
    
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      profiles = data || [];
    }

    // Merge names
    const enrichedLeaderboard = leaderboard?.map((entry: any) => {
      const profile = profiles.find((p) => p.user_id === entry.user_id);
      return {
        ...entry,
        display_name: profile?.full_name || `User ${entry.referral_code}`,
      };
    });

    return NextResponse.json({ leaderboard: enrichedLeaderboard || [] });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Failed to get leaderboard" }, { status: 500 });
  }
}
