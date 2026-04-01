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
    comingSoon: false,
  },
  { 
    id: "personnel", 
    label: "Security Professional", 
    description: "Get booked for shifts",
    icon: "🛡️",
    color: "rgba(16, 185, 129, 0.2)",
    href: "/signup/personnel",
    comingSoon: false,
  },
  { 
    id: "agency", 
    label: "Security Agency", 
    description: "Coming Soon",
    icon: "🏛️",
    color: "rgba(59, 130, 246, 0.1)",
    href: "/signup/agency",
    comingSoon: true,
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
          <Text style={styles.logoText}>Shield HQ</Text>
        </View>

        <Text style={styles.welcomeTitle}>Join Shield HQ</Text>
        <Text style={styles.welcomeSubtitle}>Choose your role to get started.</Text>

        <View style={styles.card}>
          <View style={styles.rolesContainer}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleCard, role.comingSoon && styles.roleCardDisabled]}
                onPress={() => !role.comingSoon && router.push(role.href as any)}
                activeOpacity={role.comingSoon ? 1 : 0.85}
                disabled={role.comingSoon}
              >
                <View style={[styles.roleIcon, { backgroundColor: role.color }, role.comingSoon && { opacity: 0.4 }]}>
                  <Text style={styles.roleIconText}>{role.icon}</Text>
                </View>
                <View style={styles.roleContent}>
                  <Text style={[styles.roleLabel, role.comingSoon && { opacity: 0.5 }]}>{role.label}</Text>
                  <Text style={[styles.roleDescription, role.comingSoon && { color: colors.accent }]}>
                    {role.description}
                  </Text>
                </View>
                {role.comingSoon ? (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Soon</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
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
  welcomeTitle: {
    ...typography.display,
    fontSize: 28,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rolesContainer: {
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
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
  roleCardDisabled: {
    opacity: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  comingSoonText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 11,
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
