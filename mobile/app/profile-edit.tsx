import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { GuestGate } from "../components/auth/GuestGate";
import { IntroVideoSection } from "../components/profile/IntroVideoSection";
import { ProfileAvatarPicker } from "../components/profile/ProfileAvatarPicker";

interface ProfileData {
  // Personnel fields
  display_name: string;
  phone: string;
  bio: string;
  hourly_rate: string;
  sia_license_number: string;
  sia_expiry_date: string;
  skills: string[];
  
  // Venue fields
  venue_name: string;
  venue_type: string;
  capacity: string;
  address: string;
  
  // Agency fields
  agency_name: string;
  contact_email: string;
  service_areas: string;
}

const SKILL_OPTIONS = [
  "Door Supervision",
  "CCTV Operation",
  "Close Protection",
  "Event Security",
  "Retail Security",
  "Corporate Security",
  "First Aid",
  "Conflict Resolution",
  "Fire Marshal",
];

const VENUE_TYPES = [
  "Nightclub",
  "Bar/Pub",
  "Restaurant",
  "Hotel",
  "Corporate Office",
  "Retail Store",
  "Event Venue",
  "Other",
];

export default function ProfileEditScreen() {
  return (
    <GuestGate feature="profile" redirectAfter="/profile-edit">
      <ProfileEditScreenContent />
    </GuestGate>
  );
}

function ProfileEditScreenContent() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<"personal" | "work" | "availability" | null>(
    "personal"
  );
  const [availabilitySummary, setAvailabilitySummary] = useState<string>("");

  const [profile, setProfile] = useState<ProfileData>({
    display_name: "",
    phone: "",
    bio: "",
    hourly_rate: "",
    sia_license_number: "",
    sia_expiry_date: "",
    skills: [],
    venue_name: "",
    venue_type: "",
    capacity: "",
    address: "",
    agency_name: "",
    contact_email: "",
    service_areas: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "Please log in to edit your profile");
        router.back();
        return;
      }
      const result = await getProfileIdAndRole(supabase, user.id);
      const pid = result?.profileId;
      const userRole = result?.role;
      if (!pid || !userRole) {
        Alert.alert("Error", "Please log in to edit your profile");
        router.back();
        return;
      }

      setProfileId(pid);
      setAuthUserId(user.id);
      setRole(userRole);

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("avatar_url")
        .or(`id.eq.${pid},user_id.eq.${user.id}`)
        .maybeSingle();
      setAvatarUrl(profileRow?.avatar_url ?? null);

      if (!supabase) return;
      if (userRole === "personnel") {
        const { data } = await supabase
          .from("personnel")
          .select("*")
          .eq("user_id", pid)
          .single();

        if (data) {
          setEntityId(data.id);
          setProfile((prev) => ({
            ...prev,
            display_name: data.display_name || "",
            phone: data.phone || "",
            bio: data.bio || "",
            hourly_rate: data.hourly_rate?.toString() || "",
            sia_license_number: data.sia_license_number || "",
            sia_expiry_date: data.sia_expiry_date || "",
            skills: data.skills || [],
          }));

          const { data: availRows } = await supabase
            .from("availability")
            .select("day_of_week, is_available, start_time, end_time")
            .eq("personnel_id", data.id);

          const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const enabled = (availRows || [])
            .filter((r) => r.is_available)
            .sort((a, b) => a.day_of_week - b.day_of_week);
          if (enabled.length === 0) {
            setAvailabilitySummary("No weekly hours set yet.");
          } else {
            const parts = enabled.map((r) => {
              const d = dayShort[r.day_of_week] ?? "?";
              const st = r.start_time?.slice(0, 5) || "";
              const en = r.end_time?.slice(0, 5) || "";
              if (st && en) return `${d} ${st}–${en}`;
              return d;
            });
            setAvailabilitySummary(parts.join(" · "));
          }
        }
      } else if (userRole === "venue" && supabase) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", pid)
          .single();

        if (profileData && supabase) {
          const { data } = await supabase
            .from("venues")
            .select("*")
            .eq("owner_id", profileData.id)
            .single();

          if (data) {
            setEntityId(data.id);
            setProfile((prev) => ({
              ...prev,
              venue_name: data.name || "",
              venue_type: data.venue_type || "",
              capacity: data.capacity?.toString() || "",
              address: data.address || "",
              phone: data.contact_phone || "",
              contact_email: data.contact_email || "",
            }));
          }
        }
      } else if (userRole === "agency" && supabase) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", pid)
          .single();

        if (profileData && supabase) {
          const { data } = await supabase
            .from("agencies")
            .select("*")
            .eq("owner_id", profileData.id)
            .single();

          if (data) {
            setEntityId(data.id);
            setProfile((prev) => ({
              ...prev,
              agency_name: data.name || "",
              contact_email: data.contact_email || "",
              phone: data.contact_phone || "",
              service_areas: data.service_areas?.join(", ") || "",
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      if (role === "personnel" && entityId) {
        const { error } = await supabase
          .from("personnel")
          .update({
            display_name: profile.display_name,
            phone: profile.phone,
            bio: profile.bio,
            hourly_rate: profile.hourly_rate ? parseInt(profile.hourly_rate, 10) : null,
            sia_license_number: profile.sia_license_number,
            sia_expiry_date: profile.sia_expiry_date || null,
            skills: profile.skills,
          })
          .eq("id", entityId);

        if (error) throw error;
      } else if (role === "venue" && entityId && supabase) {
        const { error } = await supabase
          .from("venues")
          .update({
            name: profile.venue_name,
            venue_type: profile.venue_type,
            capacity: profile.capacity ? parseInt(profile.capacity) : null,
            address: profile.address,
            contact_phone: profile.phone,
            contact_email: profile.contact_email,
          })
          .eq("id", entityId);

        if (error) throw error;
      } else if (role === "agency" && entityId && supabase) {
        const { error } = await supabase
          .from("agencies")
          .update({
            name: profile.agency_name,
            contact_email: profile.contact_email,
            contact_phone: profile.phone,
            service_areas: profile.service_areas.split(",").map((s) => s.trim()).filter(Boolean),
          })
          .eq("id", entityId);

        if (error) throw error;
      }

      safeHaptic("success");
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      console.error("Error saving profile:", error);
      safeHaptic("error");
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skill: string) => {
    safeHaptic("selection");
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const toggleSection = (id: "personal" | "work" | "availability") => {
    safeHaptic("selection");
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  // Profile strength: which parts of the profile are filled in, plus the
  // next best action to suggest. Keeps guards motivated to complete it.
  const strengthChecks: { label: string; done: boolean }[] =
    role === "personnel"
      ? [
          { label: "Add a profile photo", done: !!avatarUrl },
          { label: "Add your name", done: profile.display_name.trim().length > 0 },
          { label: "Add a phone number", done: profile.phone.trim().length > 0 },
          { label: "Write a short bio", done: profile.bio.trim().length >= 20 },
          { label: "Set your hourly rate", done: profile.hourly_rate.trim().length > 0 },
          { label: "Add your SIA licence number", done: profile.sia_license_number.trim().length > 0 },
          { label: "Pick at least 2 skills", done: profile.skills.length >= 2 },
          {
            label: "Set your weekly availability",
            done: availabilitySummary.length > 0 && !availabilitySummary.startsWith("No weekly"),
          },
        ]
      : [];
  const strengthDone = strengthChecks.filter((c) => c.done).length;
  const strengthPct =
    strengthChecks.length > 0 ? Math.round((strengthDone / strengthChecks.length) * 100) : 0;
  const nextAction = strengthChecks.find((c) => !c.done);
  const initials = (profile.display_name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personnel Fields */}
        {role === "personnel" && (
          <>
            {/* Profile header */}
            <View style={styles.profileHero}>
              {authUserId && profileId ? (
                <ProfileAvatarPicker
                  userId={authUserId}
                  profileId={profileId}
                  displayName={profile.display_name}
                  avatarUrl={avatarUrl}
                  onChange={setAvatarUrl}
                />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <Text style={styles.heroName}>
                {profile.display_name.trim() || "Your name"}
              </Text>
              <View style={styles.heroChips}>
                {profile.hourly_rate ? (
                  <View style={styles.heroChip}>
                    <Text style={styles.heroChipText}>£{profile.hourly_rate}/hr</Text>
                  </View>
                ) : null}
                {profile.skills.slice(0, 2).map((s) => (
                  <View key={s} style={styles.heroChip}>
                    <Text style={styles.heroChipText}>{s}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.strengthWrap}>
                <View style={styles.strengthHeader}>
                  <Text style={styles.strengthLabel}>Profile strength</Text>
                  <Text
                    style={[
                      styles.strengthPct,
                      { color: strengthPct >= 80 ? "#34d399" : colors.accent },
                    ]}
                  >
                    {strengthPct}%
                  </Text>
                </View>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${strengthPct}%`,
                        backgroundColor: strengthPct >= 80 ? "#34d399" : colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.strengthHint}>
                  {nextAction
                    ? `Next: ${nextAction.label.toLowerCase()}`
                    : "Your profile looks great — venues love a complete profile."}
                </Text>
              </View>
            </View>

            <IntroVideoSection />
            <View style={styles.accordionCard}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleSection("personal")}
                activeOpacity={0.75}
              >
                <View style={styles.accordionTitleWrap}>
                  <Text style={styles.accordionIcon}>👤</Text>
                  <View>
                    <Text style={styles.accordionTitle}>Personal info</Text>
                    <Text style={styles.accordionSub}>Name, phone and bio</Text>
                  </View>
                </View>
                <Text style={styles.accordionChevron}>
                  {expandedSection === "personal" ? "▴" : "▾"}
                </Text>
              </TouchableOpacity>
              {expandedSection === "personal" && (
                <View style={styles.accordionBody}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Display name</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.display_name}
                      onChangeText={(text) => setProfile((prev) => ({ ...prev, display_name: text }))}
                      placeholder="Your name"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.phone}
                      onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
                      placeholder="07xxx xxxxxx"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={profile.bio}
                      onChangeText={(text) => setProfile((prev) => ({ ...prev, bio: text }))}
                      placeholder="Tell venues about yourself..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.accordionCard}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleSection("work")}
                activeOpacity={0.75}
              >
                <View style={styles.accordionTitleWrap}>
                  <Text style={styles.accordionIcon}>💼</Text>
                  <View>
                    <Text style={styles.accordionTitle}>Work details</Text>
                    <Text style={styles.accordionSub}>Rate, SIA licence and skills</Text>
                  </View>
                </View>
                <Text style={styles.accordionChevron}>
                  {expandedSection === "work" ? "▴" : "▾"}
                </Text>
              </TouchableOpacity>
              {expandedSection === "work" && (
                <View style={styles.accordionBody}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Hourly rate (£)</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.hourly_rate}
                      onChangeText={(text) => setProfile((prev) => ({ ...prev, hourly_rate: text }))}
                      placeholder="15"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>SIA license number</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.sia_license_number}
                      onChangeText={(text) =>
                        setProfile((prev) => ({ ...prev, sia_license_number: text }))
                      }
                      placeholder="1234-5678-9012-3456"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>SIA expiry date</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.sia_expiry_date}
                      onChangeText={(text) =>
                        setProfile((prev) => ({ ...prev, sia_expiry_date: text }))
                      }
                      placeholder="2025-12-31"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.label, { marginTop: spacing.sm }]}>Skills</Text>
                  <View style={styles.chipContainer}>
                    {SKILL_OPTIONS.map((skill) => (
                      <TouchableOpacity
                        key={skill}
                        style={[
                          styles.chip,
                          profile.skills.includes(skill) && styles.chipSelected,
                        ]}
                        onPress={() => toggleSkill(skill)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            profile.skills.includes(skill) && styles.chipTextSelected,
                          ]}
                        >
                          {skill}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.accordionCard}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleSection("availability")}
                activeOpacity={0.75}
              >
                <View style={styles.accordionTitleWrap}>
                  <Text style={styles.accordionIcon}>📅</Text>
                  <View>
                    <Text style={styles.accordionTitle}>Availability</Text>
                    <Text style={styles.accordionSub} numberOfLines={1}>
                      {availabilitySummary || "When you can work"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.accordionChevron}>
                  {expandedSection === "availability" ? "▴" : "▾"}
                </Text>
              </TouchableOpacity>
              {expandedSection === "availability" && (
                <View style={styles.accordionBody}>
                  <Text style={styles.sectionSubtitle}>
                    Weekly hours are saved on the dedicated availability screen (including blocked
                    dates and one-off overrides).
                  </Text>
                  <View style={styles.availabilitySummaryCard}>
                    <Text style={styles.availabilitySummaryLabel}>Current schedule</Text>
                    <Text style={styles.availabilitySummaryText}>{availabilitySummary}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.manageAvailabilityBtn}
                    onPress={() => router.push("/availability")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.manageAvailabilityBtnText}>Manage availability</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* Venue Fields */}
        {role === "venue" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Venue Details</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>Venue Name</Text>
              <TextInput
                style={styles.input}
                value={profile.venue_name}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, venue_name: text }))}
                placeholder="My Venue"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Venue Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  {VENUE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        profile.venue_type === type && styles.chipSelected,
                      ]}
                      onPress={() => {
                        safeHaptic("selection");
                        setProfile((prev) => ({ ...prev, venue_type: type }));
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          profile.venue_type === type && styles.chipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Capacity</Text>
              <TextInput
                style={styles.input}
                value={profile.capacity}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, capacity: text }))}
                placeholder="500"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profile.address}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, address: text }))}
                placeholder="123 High Street, London"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
                placeholder="020 1234 5678"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contact Email</Text>
              <TextInput
                style={styles.input}
                value={profile.contact_email}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, contact_email: text }))}
                placeholder="info@venue.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        )}

        {/* Agency Fields */}
        {role === "agency" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Agency Details</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>Agency Name</Text>
              <TextInput
                style={styles.input}
                value={profile.agency_name}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, agency_name: text }))}
                placeholder="My Security Agency"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contact Email</Text>
              <TextInput
                style={styles.input}
                value={profile.contact_email}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, contact_email: text }))}
                placeholder="contact@agency.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
                placeholder="020 1234 5678"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Service Areas (comma separated)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profile.service_areas}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, service_areas: text }))}
                placeholder="London, Manchester, Birmingham"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.textMuted,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 60,
    alignItems: "center",
  },
  saveText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  profileHero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  heroName: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
    marginBottom: spacing.sm,
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  heroChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  strengthWrap: {
    alignSelf: "stretch",
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  strengthLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  strengthPct: {
    ...typography.caption,
    fontWeight: "700",
  },
  strengthTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  strengthFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  strengthHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  accordionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  accordionIcon: {
    fontSize: 20,
  },
  accordionSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
    maxWidth: 240,
  },
  accordionCard: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  accordionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  accordionChevron: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  accordionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  availabilitySummaryCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  availabilitySummaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  availabilitySummaryText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  manageAvailabilityBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  manageAvailabilityBtnText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
