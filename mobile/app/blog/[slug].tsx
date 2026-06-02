import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";
import { BackButton } from "../../components/ui/BackButton";
import { getShieldBlogPost } from "../../data/shield-blog";

export default function BlogPostScreen() {
  const insets = useSafeAreaInsets();
  const raw = useLocalSearchParams<{ slug?: string | string[] }>().slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const post = slug ? getShieldBlogPost(slug) : undefined;

  if (!post) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <BackButton />
        <Text style={styles.title}>Article not found</Text>
      </View>
    );
  }

  const paragraphs = post.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <BackButton />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>
          {new Date(post.publishedAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Text style={styles.title}>{post.title}</Text>
        {post.tags && post.tags.length > 0 ? (
          <Text style={styles.tags}>{post.tags.join(" · ")}</Text>
        ) : null}
        {paragraphs.map((para, i) => (
          <Text key={i} style={styles.body}>
            {para}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: { marginBottom: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  tags: { ...typography.caption, color: colors.accent, marginBottom: spacing.lg },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
});
