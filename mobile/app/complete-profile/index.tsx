import { router } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";

const ROLES = [
  {
    id: "venue",
    title: "Venue",
    description: "Hire security for your club, bar, or event",
    icon: "🏢",
    href: "/complete-profile/venue",
  },
  {
    id: "personnel",
    title: "Security Professional",
    description: "Get booked for shifts and grow your career",
    icon: "🛡️",
    href: "/complete-profile/personnel",
  },
  {
    id: "agency",
    title: "Security Agency",
    description: "Manage your team and take on contracts",
    icon: "🏛️",
    href: "/complete-profile/agency",
  },
];

export default function CompleteProfileIndex() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 100 }]}
    >
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        Choose your role to finish setting up your account
      </Text>

      <View style={styles.roles}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={styles.roleCard}
            onPress={() => router.push(role.href as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>{role.title}</Text>
              <Text style={styles.roleDescription}>{role.description}</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.skipBtn} 
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text style={styles.skipBtnText}>I'll do this later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  roles: {
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  roleDescription: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    ...typography.title,
    color: colors.accent,
  },
  skipBtn: {
    marginTop: spacing.xxl,
    alignItems: "center",
  },
  skipBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
