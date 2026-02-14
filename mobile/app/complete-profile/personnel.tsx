import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

const STEPS = ["Personal", "SIA License", "Skills", "Experience"];

const CERTIFICATIONS = [
  { value: "door_supervisor", label: "SIA Door Supervisor" },
  { value: "security_guard", label: "SIA Security Guard" },
  { value: "close_protection", label: "SIA Close Protection" },
  { value: "cctv", label: "SIA CCTV" },
  { value: "first_aid", label: "First Aid at Work" },
  { value: "conflict_management", label: "Conflict Management" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "crowd_management", label: "Crowd Management" },
];

export default function CompletePersonnelProfile() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    city: "",
    postcode: "",
    siaLicenseNumber: "",
    siaExpiryDate: "",
    certifications: [] as string[],
    experienceYears: "",
    hourlyRate: "",
    bio: "",
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        // Pre-fill name from auth metadata if available
        const name = session.user.user_metadata?.display_name || "";
        if (name) {
          setFormData(prev => ({ ...prev, displayName: name }));
        }
      }
    });
  }, []);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCert = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.displayName.trim().length > 0 && formData.city.trim().length > 0;
      case 1:
        return true; // SIA is optional
      case 2:
        return true; // Certs are optional
      case 3:
        return true; // Experience is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!supabase || !userId) {
      Alert.alert("Error", "Not authenticated");
      return;
    }

    setIsLoading(true);

    try {
      // Update or create profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: userEmail,
        role: "personnel",
        display_name: formData.displayName,
      });

      if (profileError) {
        console.error("Profile error:", profileError);
        throw new Error("Failed to update profile");
      }

      // Create personnel record
      const { error: personnelError } = await supabase.from("personnel").upsert({
        user_id: userId,
        display_name: formData.displayName,
        city: formData.city,
        postcode: formData.postcode || null,
        sia_license_number: formData.siaLicenseNumber || null,
        sia_expiry_date: formData.siaExpiryDate ? formData.siaExpiryDate : null,
        skills: formData.certifications,
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : 0,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 16.00,
        bio: formData.bio || null,
      }, {
        onConflict: 'user_id'
      });

      if (personnelError) {
        console.error("Personnel error:", personnelError);
        throw new Error("Failed to create personnel profile");
      }

      Alert.alert("Success", "Your profile has been completed!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/account") }
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.icon}>🛡️</Text>
          <Text style={styles.title}>Security Professional</Text>
          <Text style={styles.subtitle}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View 
              key={i} 
              style={[styles.progressDot, i <= step && styles.progressDotActive]} 
            />
          ))}
        </View>

        {/* Step 1: Personal Details */}
        {step === 0 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.displayName}
                onChangeText={(v) => updateField("displayName", v)}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(v) => updateField("phone", v)}
                placeholder="07123 456789"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(v) => updateField("city", v)}
                  placeholder="e.g. Birmingham"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Postcode</Text>
                <TextInput
                  style={styles.input}
                  value={formData.postcode}
                  onChangeText={(v) => updateField("postcode", v)}
                  placeholder="B1 1AA"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        )}

        {/* Step 2: SIA License */}
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              You can add this later, but venues will verify your SIA license before booking.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>SIA License Number</Text>
              <TextInput
                style={styles.input}
                value={formData.siaLicenseNumber}
                onChangeText={(v) => updateField("siaLicenseNumber", v)}
                placeholder="1234-5678-9012-3456"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>License Expiry Date</Text>
              <TextInput
                style={styles.input}
                value={formData.siaExpiryDate}
                onChangeText={(v) => updateField("siaExpiryDate", v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}

        {/* Step 3: Certifications */}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              Select all certifications you hold
            </Text>

            <View style={styles.certGrid}>
              {CERTIFICATIONS.map((cert) => (
                <TouchableOpacity
                  key={cert.value}
                  style={[
                    styles.certOption,
                    formData.certifications.includes(cert.value) && styles.certOptionSelected,
                  ]}
                  onPress={() => toggleCert(cert.value)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.checkbox,
                    formData.certifications.includes(cert.value) && styles.checkboxSelected,
                  ]}>
                    {formData.certifications.includes(cert.value) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.certLabel}>{cert.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 4: Experience */}
        {step === 3 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Years of Experience</Text>
              <View style={styles.experienceOptions}>
                {["0", "1", "3", "6", "10"].map((years) => (
                  <TouchableOpacity
                    key={years}
                    style={[
                      styles.expOption,
                      formData.experienceYears === years && styles.expOptionSelected,
                    ]}
                    onPress={() => updateField("experienceYears", years)}
                  >
                    <Text style={[
                      styles.expOptionText,
                      formData.experienceYears === years && styles.expOptionTextSelected,
                    ]}>
                      {years === "0" ? "<1" : years === "10" ? "10+" : `${years}-${parseInt(years) + 2}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Hourly Rate (£)</Text>
              <TextInput
                style={styles.input}
                value={formData.hourlyRate}
                onChangeText={(v) => updateField("hourlyRate", v)}
                placeholder="e.g. 15"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>About You</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(v) => updateField("bio", v)}
                placeholder="Tell venues about your experience..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed() || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.nextBtnText}>
                {step === STEPS.length - 1 ? "Complete Profile" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>

          {step < STEPS.length - 1 && (
            <TouchableOpacity style={styles.skipStepBtn} onPress={handleNext}>
              <Text style={styles.skipStepBtnText}>Skip this step</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backBtnText: {
    ...typography.body,
    color: colors.accent,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  certGrid: {
    gap: spacing.sm,
  },
  certOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  certOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  certLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  experienceOptions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  expOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  expOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  expOptionText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
  expOptionTextSelected: {
    color: colors.accent,
  },
  navigation: {
    marginTop: spacing.xl,
  },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  skipStepBtn: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  skipStepBtnText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
