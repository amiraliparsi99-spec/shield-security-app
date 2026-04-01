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
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";

interface DayAvailability {
  day: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface ProfileData {
  // Personnel fields
  display_name: string;
  phone: string;
  bio: string;
  hourly_rate: string;
  sia_license_number: string;
  sia_expiry_date: string;
  skills: string[];
  available_days: string[];
  availability_times: DayAvailability[];
  
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

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_AVAILABILITY: DayAvailability[] = DAY_OPTIONS.map(day => ({
  day,
  enabled: false,
  start_time: "09:00",
  end_time: "17:00",
}));

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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<ProfileData>({
    display_name: "",
    phone: "",
    bio: "",
    hourly_rate: "",
    sia_license_number: "",
    sia_expiry_date: "",
    skills: [],
    available_days: [],
    availability_times: DEFAULT_AVAILABILITY,
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
      setRole(userRole);

      if (!supabase) return;
      if (userRole === "personnel") {
        const { data } = await supabase
          .from("personnel")
          .select("*")
          .eq("user_id", pid)
          .single();

        if (data) {
          setEntityId(data.id);
          // Parse availability times from database or use defaults
          const savedTimes = data.availability_times || [];
          const availTimes = DEFAULT_AVAILABILITY.map(defaultDay => {
            const saved = savedTimes.find((s: DayAvailability) => s.day === defaultDay.day);
            return saved || defaultDay;
          });
          
          setProfile((prev) => ({
            ...prev,
            display_name: data.display_name || "",
            phone: data.phone || "",
            bio: data.bio || "",
            hourly_rate: data.hourly_rate?.toString() || "",
            sia_license_number: data.sia_license_number || "",
            sia_expiry_date: data.sia_expiry_date || "",
            skills: data.skills || [],
            available_days: data.available_days || [],
            availability_times: availTimes,
          }));
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
        // Filter availability times to only include enabled days
        const enabledAvailability = profile.availability_times.filter(a => a.enabled);
        const availableDays = enabledAvailability.map(a => a.day);
        
        const { error } = await supabase
          .from("personnel")
          .update({
            display_name: profile.display_name,
            phone: profile.phone,
            bio: profile.bio,
            hourly_rate: profile.hourly_rate ? parseInt(profile.hourly_rate) : null,
            sia_license_number: profile.sia_license_number,
            sia_expiry_date: profile.sia_expiry_date || null,
            skills: profile.skills,
            available_days: availableDays,
            availability_times: profile.availability_times,
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

  const toggleDay = (day: string) => {
    safeHaptic("selection");
    setProfile((prev) => ({
      ...prev,
      availability_times: prev.availability_times.map(a => 
        a.day === day ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  };

  const updateDayTime = (day: string, field: 'start_time' | 'end_time', value: string) => {
    setProfile((prev) => ({
      ...prev,
      availability_times: prev.availability_times.map(a => 
        a.day === day ? { ...a, [field]: value } : a
      ),
    }));
  };

  const TIME_OPTIONS = [
    "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
  ];

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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              
              <View style={styles.field}>
                <Text style={styles.label}>Display Name</Text>
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

              <View style={styles.field}>
                <Text style={styles.label}>Hourly Rate (£)</Text>
                <TextInput
                  style={styles.input}
                  value={profile.hourly_rate}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, hourly_rate: text }))}
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SIA License</Text>
              
              <View style={styles.field}>
                <Text style={styles.label}>License Number</Text>
                <TextInput
                  style={styles.input}
                  value={profile.sia_license_number}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, sia_license_number: text }))}
                  placeholder="1234-5678-9012-3456"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  value={profile.sia_expiry_date}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, sia_expiry_date: text }))}
                  placeholder="2025-12-31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills</Text>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <Text style={styles.sectionSubtitle}>Select the days and times you're available to work</Text>
              
              {profile.availability_times.map((dayAvail) => (
                <View key={dayAvail.day} style={styles.availabilityRow}>
                  <TouchableOpacity
                    style={[
                      styles.dayToggle,
                      dayAvail.enabled && styles.dayToggleEnabled,
                    ]}
                    onPress={() => toggleDay(dayAvail.day)}
                  >
                    <Text
                      style={[
                        styles.dayToggleText,
                        dayAvail.enabled && styles.dayToggleTextEnabled,
                      ]}
                    >
                      {dayAvail.day}
                    </Text>
                  </TouchableOpacity>
                  
                  {dayAvail.enabled && (
                    <View style={styles.timePickerRow}>
                      <View style={styles.timePicker}>
                        <Text style={styles.timeLabel}>From</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.timeScroll}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <TouchableOpacity
                              key={time}
                              style={[
                                styles.timeChip,
                                dayAvail.start_time === time && styles.timeChipSelected,
                              ]}
                              onPress={() => updateDayTime(dayAvail.day, 'start_time', time)}
                            >
                              <Text
                                style={[
                                  styles.timeChipText,
                                  dayAvail.start_time === time && styles.timeChipTextSelected,
                                ]}
                              >
                                {time}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.timePicker}>
                        <Text style={styles.timeLabel}>To</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.timeScroll}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <TouchableOpacity
                              key={time}
                              style={[
                                styles.timeChip,
                                dayAvail.end_time === time && styles.timeChipSelected,
                              ]}
                              onPress={() => updateDayTime(dayAvail.day, 'end_time', time)}
                            >
                              <Text
                                style={[
                                  styles.timeChipText,
                                  dayAvail.end_time === time && styles.timeChipTextSelected,
                                ]}
                              >
                                {time}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              ))}
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
  daysContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  dayTextSelected: {
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  availabilityRow: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  dayToggleEnabled: {
    backgroundColor: colors.accent,
  },
  dayToggleText: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: "600",
  },
  dayToggleTextEnabled: {
    color: colors.text,
  },
  timePickerRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  timePicker: {
    marginBottom: spacing.xs,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  timeScroll: {
    flexGrow: 0,
  },
  timeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeChipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  timeChipTextSelected: {
    color: colors.text,
    fontWeight: "600",
  },
});
