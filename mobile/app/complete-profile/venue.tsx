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

const STEPS = ["Business Details", "Address", "Contact"];

const VENUE_TYPES = [
  { value: "club", label: "Nightclub" },
  { value: "bar", label: "Bar / Pub" },
  { value: "stadium", label: "Stadium / Arena" },
  { value: "event_space", label: "Event Space" },
  { value: "restaurant", label: "Restaurant" },
  { value: "corporate", label: "Corporate" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) + "-" + Math.random().toString(36).substring(2, 6);
}

export default function CompleteVenueProfile() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    businessName: "",
    venueType: "",
    description: "",
    capacity: "",
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
        setFormData(prev => ({ 
          ...prev, 
          contactEmail: session.user.email || "" 
        }));
      }
    });
  }, []);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.businessName.trim().length > 0 && formData.venueType.length > 0;
      case 1:
        return formData.city.trim().length > 0;
      case 2:
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
        role: "venue",
        display_name: formData.businessName,
      });

      if (profileError) throw new Error("Failed to update profile");

      // Create venue record
      const { error: venueError } = await supabase.from("venues").insert({
        user_id: userId,
        name: formData.businessName,
        type: formData.venueType,
        description: formData.description || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        address_line1: formData.address || null,
        city: formData.city,
        postcode: formData.postcode || null,
      });

      if (venueError) {
        console.error("Venue error:", venueError);
        throw new Error("Failed to create venue profile");
      }

      Alert.alert("Success", "Your venue profile has been completed!", [
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
          <Text style={styles.icon}>🏢</Text>
          <Text style={styles.title}>Venue Profile</Text>
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
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.businessName}
                onChangeText={(v) => updateField("businessName", v)}
                placeholder="Your venue name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Venue Type *</Text>
              <View style={styles.typeGrid}>
                {VENUE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeOption,
                      formData.venueType === type.value && styles.typeOptionSelected,
                    ]}
                    onPress={() => updateField("venueType", type.value)}
                  >
                    <Text style={[
                      styles.typeOptionText,
                      formData.venueType === type.value && styles.typeOptionTextSelected,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Capacity</Text>
              <TextInput
                style={styles.input}
                value={formData.capacity}
                onChangeText={(v) => updateField("capacity", v)}
                placeholder="e.g. 500"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(v) => updateField("description", v)}
                placeholder="Tell security providers about your venue..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* Step 2: Address */}
        {step === 1 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Street Address</Text>
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
                  placeholder="e.g. London"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Postcode</Text>
                <TextInput
                  style={styles.input}
                  value={formData.postcode}
                  onChangeText={(v) => updateField("postcode", v)}
                  placeholder="SW1 1AA"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        )}

        {/* Step 3: Contact */}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              Contact details for security providers to reach you
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
                placeholder="contact@venue.com"
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
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeOptionText: { ...typography.bodySmall, color: colors.textMuted },
  typeOptionTextSelected: { color: colors.accent, fontWeight: "600" },
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
