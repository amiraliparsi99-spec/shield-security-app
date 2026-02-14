import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";
import { BackButton } from "../../components/ui/BackButton";

const roles = [
  { 
    id: "venue", 
    label: "Venue", 
    description: "Find security for your events",
    icon: "🏢",
    color: "rgba(168, 85, 247, 0.2)",
    href: "/signup/venue",
  },
  { 
    id: "personnel", 
    label: "Security Professional", 
    description: "Get booked for shifts",
    icon: "🛡️",
    color: "rgba(16, 185, 129, 0.2)",
    href: "/signup/personnel",
  },
  { 
    id: "agency", 
    label: "Security Agency", 
    description: "Manage your team and bookings",
    icon: "🏛️",
    color: "rgba(59, 130, 246, 0.2)",
    href: "/signup/agency",
  },
];

export default function SignUpIndex() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
        <BackButton onPress={() => router.replace("/(tabs)/explore")} />
        
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>
          <Text style={styles.logoText}>Shield</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create an account</Text>
          <Text style={styles.subtitle}>
            Choose your role to get started with Shield.
          </Text>

          <View style={styles.rolesContainer}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={styles.roleCard}
                onPress={() => router.push(role.href as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIcon, { backgroundColor: role.color }]}>
                  <Text style={styles.roleIconText}>{role.icon}</Text>
                </View>
                <View style={styles.roleContent}>
                  <Text style={styles.roleLabel}>{role.label}</Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.link} onPress={() => router.push("/login")}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    ...typography.title,
    color: colors.text,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  rolesContainer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  roleIconText: {
    fontSize: 24,
  },
  roleContent: {
    flex: 1,
  },
  roleLabel: {
    ...typography.titleCard,
    color: colors.text,
  },
  roleDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  link: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  linkHighlight: {
    color: colors.accent,
    fontWeight: "500",
  },
});
