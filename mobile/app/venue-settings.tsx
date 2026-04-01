import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../lib/auth";

const VENUE_TYPES = ["club", "bar", "stadium", "event_space", "other"];

export default function VenueSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [capacity, setCapacity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const profile = await getProfileIdAndRole(supabase, user.id);
        if (!profile) return;
        const vid = await getVenueId(supabase, profile.profileId);
        if (!vid) return;
        setVenueId(vid);
        const { data } = await supabase
          .from("venues")
          .select("name, type, address_line1, city, postcode, capacity, email, phone")
          .eq("id", vid)
          .single();
        if (!data) return;
        setName(data.name || "");
        setType(data.type || "other");
        setAddressLine1(data.address_line1 || "");
        setCity(data.city || "");
        setPostcode(data.postcode || "");
        setCapacity(data.capacity ? String(data.capacity) : "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!supabase || !venueId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({
          name: name.trim(),
          type,
          address_line1: addressLine1.trim() || null,
          city: city.trim() || null,
          postcode: postcode.trim() || null,
          capacity: capacity.trim() ? Number(capacity) : null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", venueId);
      if (error) throw error;
      Alert.alert("Saved", "Venue settings updated.");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save venue settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.xs }}>
          <Text style={{ ...typography.bodySmall, color: colors.accent, fontWeight: "600" }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Venue Settings</Text>
        <Text style={styles.subtitle}>Update your venue details</Text>

        <Text style={styles.label}>Venue Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Venue name" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Venue Type</Text>
        <View style={styles.typeRow}>
          {VENUE_TYPES.map((t) => (
            <TouchableOpacity key={t} style={[styles.typeChip, type === t && styles.typeChipActive]} onPress={() => setType(t)}>
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="Address line 1" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Postcode</Text>
        <TextInput style={styles.input} value={postcode} onChangeText={setPostcode} placeholder="Postcode" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Capacity</Text>
        <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Contact Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="email@example.com" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Contact Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+44..." placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.text} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: 120 },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  typeChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeChipText: { ...typography.caption, color: colors.textMuted },
  typeChipTextActive: { color: colors.accent, fontWeight: "600" },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.body, color: colors.text, fontWeight: "700" },
});
