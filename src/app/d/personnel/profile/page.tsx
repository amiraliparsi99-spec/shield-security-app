"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSupabase, useUser } from "@/hooks/useSupabase";

export default function ProfilePage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    email: "",
    phone: "",
    city: "Birmingham",
    postcode: "",
    bio: "",
    skills: [] as string[],
    experienceYears: 0,
    hourlyRate: 16,
    availability: {
      monday: false,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
  });

  useEffect(() => {
    if (!userLoading) {
      if (user) {
        loadProfile();
      } else {
        // User is definitely not logged in
        setIsLoading(false);
      }
    }
  }, [user, userLoading]);

  const loadProfile = async () => {
    console.log("loadProfile called", { user: !!user, userId: user?.id });
    
    if (!user) {
      console.log("No user, stopping");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Fetching profile data for user:", user.id);
      
      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      console.log("Profile data:", profileData, "Error:", profileError);

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      // Get personnel data
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("Personnel data:", personnelData, "Error:", personnelError);

      if (personnelError) {
        console.error("Personnel error:", personnelError);
      }

      // Set profile data (even if personnel doesn't exist yet)
      setProfile({
        displayName: profileData?.display_name || "",
        email: profileData?.email || "",
        phone: profileData?.phone || "",
        city: personnelData?.city || "Birmingham",
        postcode: personnelData?.postcode || "",
        bio: personnelData?.bio || "",
        skills: personnelData?.skills || [],
        experienceYears: personnelData?.experience_years || 0,
        hourlyRate: personnelData?.hourly_rate ? Number(personnelData.hourly_rate) : 16,
        availability: {
          monday: false,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: false,
        },
      });
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase || !user) return;

    setIsSaving(true);

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: profile.displayName,
          phone: profile.phone,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update personnel table
      const { error: personnelError } = await supabase
        .from("personnel")
        .update({
          display_name: profile.displayName,
          city: profile.city,
          postcode: profile.postcode,
          bio: profile.bio,
          skills: profile.skills,
          experience_years: profile.experienceYears,
          hourly_rate: profile.hourlyRate,
        })
        .eq("user_id", user.id);

      if (personnelError) throw personnelError;

      alert("Profile saved successfully!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert(error.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        <p className="text-sm text-zinc-400">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-white">Please log in to view your profile</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-sm text-zinc-400">Manage your public profile and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Header */}
        <div className="glass rounded-xl p-6 flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold">
            {profile.displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile.displayName}</h2>
            <p className="text-sm text-zinc-400">{profile.city} • {profile.experienceYears} years experience</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">✓ SIA Verified</span>
              <span className="text-xs bg-shield-500/20 text-shield-400 px-2 py-1 rounded">Shield Score: 94</span>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Display Name</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">City</label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">About Me</h3>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition h-32 resize-none"
            placeholder="Tell venues and agencies about yourself..."
          />
        </div>

        {/* Skills */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(skill => (
              <span key={skill} className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-sm">
                {skill}
              </span>
            ))}
            <button className="bg-white/5 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-sm border border-dashed border-white/20 hover:border-white/40 transition">
              + Add Skill
            </button>
          </div>
        </div>

        {/* Rate */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Hourly Rate</h3>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400">£</span>
            <input
              type="number"
              value={profile.hourlyRate}
              onChange={(e) => setProfile(prev => ({ ...prev, hourlyRate: parseInt(e.target.value) || 0 }))}
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-center focus:border-shield-500 focus:outline-none transition"
              min="10"
              max="50"
            />
            <span className="text-zinc-400">per hour</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">This is your preferred rate. Actual rates may vary by venue.</p>
        </div>

        {/* Availability */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Weekly Availability</h3>
          <div className="grid grid-cols-7 gap-2">
            {Object.entries(profile.availability).map(([day, available]) => (
              <button
                key={day}
                onClick={() => setProfile(prev => ({
                  ...prev,
                  availability: { ...prev.availability, [day]: !available }
                }))}
                className={`py-3 rounded-lg text-sm font-medium transition ${
                  available
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-zinc-500 border border-white/10"
                }`}
              >
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-shield-500 hover:bg-shield-600 text-white py-3 rounded-xl font-medium transition disabled:opacity-50"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </motion.button>
      </div>
    </div>
  );
}
