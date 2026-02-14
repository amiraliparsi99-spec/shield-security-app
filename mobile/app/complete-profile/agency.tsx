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

const STEPS = ["Business Details", "Services", "Address", "Contact"];

const SERVICE_OPTIONS = [
  { value: "door_supervision", label: "Door Supervision" },
  { value: "event_security", label: "Event Security" },
  { value: "corporate_security", label: "Corporate Security" },
  { value: "retail_security", label: "Retail Security" },
  { value: "close_protection", label: "Close Protection" },
  { value: "cctv_monitoring", label: "CCTV Monitoring" },
  { value: "mobile_patrol", label: "Mobile Patrol" },
  { value: "key_holding", label: "Key Holding" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) + "-" + Math.random().toString(36).substring(2, 6);
}

export default function CompleteAgencyProfile() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    companyNumber: "",
    description: "",
    services: [] as string[],
    address: "",
    city: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setFormData(prev => ({ ...prev, contactEmail: session.user.email || "" }));
      }
    });
  }, []);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.companyName.trim().length > 0;
      case 1:
        return formData.services.length > 0;
      case 2:
        return formData.city.trim().length > 0;
      case 3:
        return true;
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
      // Update profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: userEmail,
        role: "agency",
        display_name: formData.companyName,
      });

      if (profileError) throw new Error("Failed to update profile");

      // Create agency record
      const { error: agencyError } = await supabase.from("agencies").insert({
        user_id: userId,
        name: formData.companyName,
        registration_number: formData.companyNumber || null,
        description: formData.description || null,
        city: formData.city,
        postcode: formData.postcode || null,
      });

      if (agencyError) {
        console.error("Agency error:", agencyError);
        throw new Error("Failed to create agency profile");
      }

      Alert.alert("Success", "Your agency profile has been completed!", [
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
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.icon}>🏛️</Text>
          <Text style={styles.title}>Agency Profile</Text>
          <Text style={styles.subtitle}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
        </View>

        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>

        {/* Step 1: Business Details */}
        {step === 0 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Company Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.companyName}
                onChangeText={(v) => updateField("companyName", v)}
                placeholder="Your agency name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Companies House Number</Text>
              <TextInput
                style={styles.input}
                value={formData.companyNumber}
                onChangeText={(v) => updateField("companyNumber", v)}
                placeholder="e.g. 12345678"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>About Your Agency</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(v) => updateField("description", v)}
                placeholder="Tell venues about your agency..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* Step 2: Services */}
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              Select all services your agency provides *
            </Text>

            <View style={styles.serviceGrid}>
              {SERVICE_OPTIONS.map((service) => (
                <TouchableOpacity
                  key={service.value}
                  style={[
                    styles.serviceOption,
                    formData.services.includes(service.value) && styles.serviceOptionSelected,
                  ]}
                  onPress={() => toggleService(service.value)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.checkbox,
                    formData.services.includes(service.value) && styles.checkboxSelected,
                  ]}>
                    {formData.services.includes(service.value) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Address */}
        {step === 2 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Office Address</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(v) => updateField("address", v)}
                placeholder="123 Example Street"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(v) => updateField("city", v)}
                  placeholder="e.g. Manchester"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Postcode</Text>
                <TextInput
                  style={styles.input}
                  value={formData.postcode}
                  onChangeText={(v) => updateField("postcode", v)}
                  placeholder="M1 1AA"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        )}

        {/* Step 4: Contact */}
        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              Contact details for venues to reach your team
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={formData.contactName}
                onChangeText={(v) => updateField("contactName", v)}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={formData.contactPhone}
                onChangeText={(v) => updateField("contactPhone", v)}
                placeholder="07123 456789"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.contactEmail}
                onChangeText={(v) => updateField("contactEmail", v)}
                placeholder="contact@agency.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        )}

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  backBtn: { marginBottom: spacing.md },
  backBtnText: { ...typography.body, color: colors.accent },
  header: { alignItems: "center", marginBottom: spacing.lg },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { ...typography.display, fontSize: 24, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  progress: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.xl },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.accent },
  form: { gap: spacing.md },
  field: { marginBottom: spacing.sm },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.xs },
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
  textArea: { minHeight: 80, paddingTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  sectionHint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
  serviceGrid: { gap: spacing.sm },
  serviceOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
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
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.text, fontWeight: "700", fontSize: 14 },
  serviceLabel: { ...typography.body, color: colors.text, flex: 1 },
  navigation: { marginTop: spacing.xl },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { ...typography.body, fontWeight: "600", color: colors.text },
});
