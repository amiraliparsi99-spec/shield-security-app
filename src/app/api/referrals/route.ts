import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET - Get user's referral data
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const key = supabaseServiceKey && supabaseServiceKey !== "YOUR_SERVICE_ROLE_KEY_HERE"
      ? supabaseServiceKey
      : supabaseAnonKey;
    
    const supabase = createClient(supabaseUrl, key);
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get or create referral record
    let { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!referral) {
      // Get user name for code generation
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const userName = profile?.full_name || user.email?.split("@")[0] || "USER";
      
      // Generate referral code
      const { data: codeResult } = await supabase
        .rpc("generate_referral_code", { user_name: userName });

      // Create referral record
      const { data: newReferral, error } = await supabase
        .from("referrals")
        .insert({
          user_id: user.id,
          referral_code: codeResult || `${userName.toUpperCase().slice(0, 4)}${Math.floor(Math.random() * 9000 + 1000)}`,
        })
        .select()
        .single();

      if (error) {
        console.error("Create referral error:", error);
        return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
      }

      referral = newReferral;
    }

    // Get referral signups
    const { data: signups } = await supabase
      .from("referral_signups")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    // Get available credits
    const { data: creditsResult } = await supabase
      .rpc("get_user_credits", { p_user_id: user.id });

    // Get leaderboard position
    const { data: leaderboard } = await supabase
      .rpc("get_referral_leaderboard", { limit_count: 100 });

    const position = leaderboard?.findIndex((l: any) => l.user_id === user.id) ?? -1;

    return NextResponse.json({
      referral,
      signups: signups || [],
      availableCredits: creditsResult || 0,
      leaderboardPosition: position >= 0 ? position + 1 : null,
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return NextResponse.json({ error: "Failed to get referrals" }, { status: 500 });
  }
}

// POST - Apply referral code during signup
export async function POST(request: NextRequest) {
  try {
    const { referralCode, refereeId } = await request.json();

    if (!referralCode || !refereeId) {
      return NextResponse.json({ error: "referralCode and refereeId required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    // Find referrer by code
    const { data: referrer } = await supabase
      .from("referrals")
      .select("user_id")
      .eq("referral_code", referralCode.toUpperCase())
      .single();

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // Check if referee already has a referral
    const { data: existing } = await supabase
      .from("referral_signups")
      .select("id")
      .eq("referee_id", refereeId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "User already has a referral" }, { status: 400 });
    }

    // Create referral signup
    const { error } = await supabase.from("referral_signups").insert({
      referrer_id: referrer.user_id,
      referee_id: refereeId,
      referral_code: referralCode.toUpperCase(),
    });

    if (error) {
      console.error("Create referral signup error:", error);
      return NextResponse.json({ error: "Failed to apply referral" }, { status: 500 });
    }

    // Update referrer stats
    await supabase
      .from("referrals")
      .update({ total_referrals: supabase.rpc("increment_total_referrals") })
      .eq("user_id", referrer.user_id);

    return NextResponse.json({ success: true, message: "Referral code applied!" });
  } catch (error) {
    console.error("Apply referral error:", error);
    return NextResponse.json({ error: "Failed to apply referral" }, { status: 500 });
  }
}
