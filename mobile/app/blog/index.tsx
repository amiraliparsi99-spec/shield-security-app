import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../../theme";
import { BackButton } from "../../components/ui/BackButton";
import { getShieldBlogPosts } from "../../data/shield-blog";

export default function BlogIndexScreen() {
  const insets = useSafeAreaInsets();
  const posts = getShieldBlogPosts();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <BackButton />
      </View>
      <Text style={styles.title}>Shield Weekly</Text>
      <Text style={styles.subtitle}>
        Security industry notes, policy context, and how teams are working on the ground.
      </Text>
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((post) => (
          <TouchableOpacity
            key={post.slug}
            style={styles.card}
            onPress={() => router.push(`/blog/${post.slug}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardDate}>
              {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
            <Text style={styles.cardTitle}>{post.title}</Text>
            <Text style={styles.cardExcerpt} numberOfLines={3}>
              {post.excerpt}
            </Text>
            <Text style={styles.readMore}>Read article →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  headerRow: { marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  list: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardDate: { ...typography.caption, color: colors.accent, fontWeight: "600", marginBottom: 4 },
  cardTitle: { ...typography.titleCard, color: colors.text, marginBottom: spacing.xs },
  cardExcerpt: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  readMore: { ...typography.caption, color: colors.accent, fontWeight: "700", marginTop: spacing.sm },
});
