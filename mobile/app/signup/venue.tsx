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
import { BackButton } from "../../components/ui/BackButton";

const TOTAL_STEPS = 4;

const venueTypes = [
  { value: "club", label: "Nightclub" },
  { value: "bar", label: "Bar / Pub" },
  { value: "stadium", label: "Stadium / Arena" },
  { value: "event_space", label: "Event Space" },
  { value: "restaurant", label: "Restaurant" },
  { value: "corporate", label: "Corporate Building" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export default function VenueSignUp() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: "",
    companiesHouseNumber: "",
    venueType: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    capacity: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
    confirmPassword: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.businessName.trim()) {
          Alert.alert("Required", "Please enter your business name.");
          return false;
        }
        return true;
      case 2:
        if (!formData.addressLine1.trim() || !formData.city.trim() || !formData.postcode.trim()) {
          Alert.alert("Required", "Please fill in the required address fields.");
          return false;
        }
        return true;
      case 3:
        if (!formData.contactName.trim() || !formData.contactEmail.trim()) {
          Alert.alert("Required", "Please enter your name and email.");
          return false;
        }
        if (!formData.contactEmail.includes("@")) {
          Alert.alert("Invalid Email", "Please enter a valid email address.");
          return false;
        }
        return true;
      case 4:
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
    if (!validateStep(4)) return;

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.contactEmail,
        password: formData.password,
        options: {
          data: {
            role: "venue",
            display_name: formData.contactName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create account");

      // IMPORTANT: Create profile FIRST (venues may have foreign key to profiles)
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authData.user.id,
        role: "venue",
        display_name: formData.contactName,
        email: formData.contactEmail,
      });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
      }

      // Now create venue record
      const { error: venueError } = await supabase.from("venues").insert({
        owner_id: authData.user.id,
        name: formData.businessName,
        companies_house_number: formData.companiesHouseNumber || null,
        address: `${formData.addressLine1}${formData.addressLine2 ? ", " + formData.addressLine2 : ""}, ${formData.city}, ${formData.postcode}`,
        city: formData.city,
        postcode: formData.postcode,
        venue_type: formData.venueType || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone || null,
      });

      if (venueError) {
        console.error("Venue insert error:", venueError);
      }

      // Email confirmation disabled - go directly to dashboard
      router.replace("/d/venue");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((step) => (
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
            {step < 4 && (
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
      <Text style={styles.stepTitle}>Business Details</Text>
      <Text style={styles.stepDescription}>Tell us about your venue</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.businessName}
          onChangeText={(v) => updateField("businessName", v)}
          placeholder="As registered on Companies House"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Companies House Number</Text>
        <TextInput
          style={styles.input}
          value={formData.companiesHouseNumber}
          onChangeText={(v) => updateField("companiesHouseNumber", v)}
          placeholder="e.g. 12345678 (optional)"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Venue Type</Text>
        <View style={styles.typeGrid}>
          {venueTypes.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[styles.typeChip, formData.venueType === type.value && styles.typeChipActive]}
              onPress={() => updateField("venueType", type.value)}
            >
              <Text style={[styles.typeChipText, formData.venueType === type.value && styles.typeChipTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Venue Address</Text>
      <Text style={styles.stepDescription}>Where is your venue located?</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Address Line 1 *</Text>
        <TextInput
          style={styles.input}
          value={formData.addressLine1}
          onChangeText={(v) => updateField("addressLine1", v)}
          placeholder="Street address"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={formData.addressLine2}
          onChangeText={(v) => updateField("addressLine2", v)}
          placeholder="Building, floor, etc. (optional)"
          placeholderTextColor={colors.textMuted}
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
          <Text style={styles.label}>Postcode *</Text>
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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Venue Capacity</Text>
        <TextInput
          style={styles.input}
          value={formData.capacity}
          onChangeText={(v) => updateField("capacity", v)}
          placeholder="Maximum capacity (optional)"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Contact Details</Text>
      <Text style={styles.stepDescription}>How can we reach you?</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Your Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.contactName}
          onChangeText={(v) => updateField("contactName", v)}
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          value={formData.contactEmail}
          onChangeText={(v) => updateField("contactEmail", v)}
          placeholder="you@business.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={formData.contactPhone}
          onChangeText={(v) => updateField("contactPhone", v)}
          placeholder="e.g. 07123 456789 (optional)"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderStep4 = () => (
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
        <Text style={styles.summaryItem}>📍 {formData.businessName}</Text>
        <Text style={styles.summaryItem}>🏢 {formData.venueType ? venueTypes.find(t => t.value === formData.venueType)?.label : "Venue"}</Text>
        <Text style={styles.summaryItem}>📧 {formData.contactEmail}</Text>
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
            <Text style={styles.headerIconText}>🏢</Text>
          </View>
          <Text style={styles.headerTitle}>Register Venue</Text>
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
    backgroundColor: "rgba(168, 85, 247, 0.2)",
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
    paddingHorizontal: spacing.xl,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  progressNumberActive: {
    color: colors.accent,
  },
  progressCheck: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
  progressLine: {
    width: 40,
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
  row: {
    flexDirection: "row",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  typeChipText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  typeChipTextActive: {
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
