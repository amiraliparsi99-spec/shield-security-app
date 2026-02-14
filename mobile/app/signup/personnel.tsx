import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

const TOTAL_STEPS = 5;

const certificationOptions = [
  { value: "door_supervisor", label: "SIA Door Supervisor" },
  { value: "security_guard", label: "SIA Security Guard" },
  { value: "close_protection", label: "SIA Close Protection" },
  { value: "cctv", label: "SIA CCTV" },
  { value: "first_aid", label: "First Aid at Work" },
  { value: "conflict_management", label: "Conflict Management" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "crowd_management", label: "Crowd Management" },
];

const experienceOptions = [
  { value: "0", label: "Less than 1 year" },
  { value: "1", label: "1-2 years" },
  { value: "3", label: "3-5 years" },
  { value: "6", label: "6-10 years" },
  { value: "10", label: "10+ years" },
];

export default function PersonnelSignUp() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    postcode: "",
    siaLicenseNumber: "",
    siaExpiryDate: "",
    certifications: [] as string[],
    experienceYears: "",
    hourlyRate: "",
    bio: "",
    password: "",
    confirmPassword: "",
  });

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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.fullName.trim()) {
          Alert.alert("Required", "Please enter your full name.");
          return false;
        }
        if (!formData.email.trim() || !formData.email.includes("@")) {
          Alert.alert("Required", "Please enter a valid email address.");
          return false;
        }
        if (!formData.city.trim()) {
          Alert.alert("Required", "Please enter your city.");
          return false;
        }
        return true;
      case 2:
        // SIA license is optional, just proceed
        return true;
      case 3:
        // Certifications are optional, just proceed
        return true;
      case 4:
        // Experience is optional, just proceed
        return true;
      case 5:
        if (!formData.password || !formData.confirmPassword) {
          Alert.alert("Required", "Please enter and confirm your password.");
          return false;
        }
        if (formData.password.length < 8) {
          Alert.alert("Password Too Short", "Password must be at least 8 characters.");
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          Alert.alert("Mismatch", "Passwords do not match.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "personnel",
            display_name: formData.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create account");

      // IMPORTANT: Create profile FIRST (personnel has foreign key to profiles)
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authData.user.id,
        email: formData.email,
        role: "personnel",
        display_name: formData.fullName,
      });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
        // Don't continue if profile fails - personnel needs it
        throw new Error("Failed to create profile");
      }

      // Now create personnel record (profile exists, foreign key will work)
      const { error: personnelError } = await supabase.from("personnel").insert({
        user_id: authData.user.id,
        display_name: formData.fullName,
        city: formData.city,
        postcode: formData.postcode || null,
        sia_license_number: formData.siaLicenseNumber || null,
        sia_expiry_date: formData.siaExpiryDate || null,
        skills: formData.certifications,
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : 0,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 16.00,
        bio: formData.bio || null,
      });

      if (personnelError) {
        console.error("Personnel insert error:", personnelError);
        // Continue anyway - profile was created successfully
      }

      // Email confirmation disabled - go directly to dashboard
      router.replace("/d/personnel");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5].map((step) => (
          <View key={step} style={styles.progressStepContainer}>
            <View style={[
              styles.progressDot,
              step <= currentStep && styles.progressDotActive,
              step < currentStep && styles.progressDotCompleted,
            ]}>
              {step < currentStep ? (
                <Text style={styles.progressCheck}>✓</Text>
              ) : (
                <Text style={[styles.progressNumber, step <= currentStep && styles.progressNumberActive]}>
                  {step}
                </Text>
              )}
            </View>
            {step < 5 && (
              <View style={[styles.progressLine, step < currentStep && styles.progressLineActive]} />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.progressText}>Step {currentStep} of {TOTAL_STEPS}</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Details</Text>
      <Text style={styles.stepDescription}>Tell us about yourself</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.fullName}
          onChangeText={(v) => updateField("fullName", v)}
          placeholder="Your full name"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(v) => updateField("email", v)}
          placeholder="you@email.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(v) => updateField("phone", v)}
          placeholder="e.g. 07123 456789 (optional)"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            value={formData.city}
            onChangeText={(v) => updateField("city", v)}
            placeholder="e.g. Birmingham"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={[styles.fieldGroup, { flex: 1, marginLeft: spacing.md }]}>
          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={formData.postcode}
            onChangeText={(v) => updateField("postcode", v)}
            placeholder="e.g. B1 1AA"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>SIA License</Text>
      <Text style={styles.stepDescription}>Your security license details</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>SIA License Number</Text>
        <TextInput
          style={styles.input}
          value={formData.siaLicenseNumber}
          onChangeText={(v) => updateField("siaLicenseNumber", v)}
          placeholder="e.g. 1234-5678-9012-3456"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>License Expiry Date</Text>
        <TextInput
          style={styles.input}
          value={formData.siaExpiryDate}
          onChangeText={(v) => updateField("siaExpiryDate", v)}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          You can add this later, but venues will verify your SIA license before booking.
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Certifications</Text>
      <Text style={styles.stepDescription}>What qualifications do you have?</Text>

      <View style={styles.certsList}>
        {certificationOptions.map(cert => (
          <TouchableOpacity
            key={cert.value}
            style={[styles.certItem, formData.certifications.includes(cert.value) && styles.certItemActive]}
            onPress={() => toggleCert(cert.value)}
          >
            <View style={[styles.checkbox, formData.certifications.includes(cert.value) && styles.checkboxActive]}>
              {formData.certifications.includes(cert.value) && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.certText, formData.certifications.includes(cert.value) && styles.certTextActive]}>
              {cert.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>Select all that apply</Text>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Experience & Rate</Text>
      <Text style={styles.stepDescription}>Tell venues what you offer</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Years of Experience</Text>
        <View style={styles.expGrid}>
          {experienceOptions.map(exp => (
            <TouchableOpacity
              key={exp.value}
              style={[styles.expChip, formData.experienceYears === exp.value && styles.expChipActive]}
              onPress={() => updateField("experienceYears", exp.value)}
            >
              <Text style={[styles.expChipText, formData.experienceYears === exp.value && styles.expChipTextActive]}>
                {exp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Hourly Rate (£)</Text>
        <TextInput
          style={styles.input}
          value={formData.hourlyRate}
          onChangeText={(v) => updateField("hourlyRate", v)}
          placeholder="e.g. 15"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>About You</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.bio}
          onChangeText={(v) => updateField("bio", v)}
          placeholder="Tell venues about your experience..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Password</Text>
      <Text style={styles.stepDescription}>Secure your account</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          value={formData.password}
          onChangeText={(v) => updateField("password", v)}
          placeholder="Min 8 characters"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          value={formData.confirmPassword}
          onChangeText={(v) => updateField("confirmPassword", v)}
          placeholder="Repeat password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Account Summary</Text>
        <Text style={styles.summaryItem}>🛡️ {formData.fullName}</Text>
        <Text style={styles.summaryItem}>📍 {formData.city}</Text>
        <Text style={styles.summaryItem}>📧 {formData.email}</Text>
        {formData.certifications.length > 0 && (
          <Text style={styles.summaryItem}>📋 {formData.certifications.length} certification{formData.certifications.length !== 1 ? "s" : ""}</Text>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🛡️</Text>
          </View>
          <Text style={styles.headerTitle}>Join as Security</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {renderProgressBar()}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        {currentStep < TOTAL_STEPS ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next</Text>
            <Text style={styles.nextButtonArrow}>→</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.submitButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 32,
    color: colors.accent,
    fontWeight: "300",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    fontSize: 18,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  progressDotCompleted: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  progressNumberActive: {
    color: colors.accent,
  },
  progressCheck: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.text,
  },
  progressLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.border,
  },
  progressLineActive: {
    backgroundColor: colors.accent,
  },
  progressText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  stepContent: {
    paddingTop: spacing.md,
  },
  stepTitle: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
  },
  stepDescription: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: "500",
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: "row",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  certsList: {
    gap: spacing.sm,
  },
  certItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  certItemActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  certText: {
    ...typography.body,
    color: colors.textMuted,
  },
  certTextActive: {
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  expGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  expChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  expChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  expChipText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  expChipTextActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  summaryBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryItem: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  nextButtonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  nextButtonArrow: {
    fontSize: 18,
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
});
