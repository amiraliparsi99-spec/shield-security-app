/**
 * New Conversation Screen
 * Search and start a conversation with venues, agencies, or guards
 */

import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { colors, typography, spacing, radius } from "../theme";
import { safeHaptic } from "../lib/haptics";

interface SearchResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: "venue" | "personnel" | "agency";
  subtitle?: string;
}

export default function NewConversationScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentContacts, setRecentContacts] = useState<SearchResult[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Load user and recent contacts
  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.back();
        return;
      }
      setUserId(user.id);

      // Load recent contacts from existing conversations
      const { data: convos } = await supabase
        .from("direct_conversations")
        .select("participant_1, participant_2")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (convos && convos.length > 0) {
        const otherUserIds = convos.map((c) =>
          c.participant_1 === user.id ? c.participant_2 : c.participant_1
        );

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, role")
          .in("id", otherUserIds);

        if (profiles) {
          setRecentContacts(profiles.map((p) => ({
            id: p.id,
            display_name: p.display_name || "Unknown",
            avatar_url: p.avatar_url,
            role: p.role || "personnel",
            subtitle: "Recent contact",
          })));
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  // Search users
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim() || !supabase || !userId) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      // Search profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, role")
        .neq("id", userId)
        .ilike("display_name", `%${query}%`)
        .limit(20);

      // Also search venues
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, owner_id")
        .ilike("name", `%${query}%`)
        .limit(10);

      // Also search personnel
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id, user_id, display_name")
        .neq("user_id", userId)
        .ilike("display_name", `%${query}%`)
        .limit(10);

      const searchResults: SearchResult[] = [];

      // Add profiles
      profiles?.forEach((p) => {
        if (!searchResults.find((r) => r.id === p.id)) {
          searchResults.push({
            id: p.id,
            display_name: p.display_name || "Unknown",
            avatar_url: p.avatar_url,
            role: p.role || "personnel",
          });
        }
      });

      // Add venue owners
      for (const venue of venues || []) {
        if (venue.owner_id && !searchResults.find((r) => r.id === venue.owner_id)) {
          searchResults.push({
            id: venue.owner_id,
            display_name: venue.name,
            avatar_url: null,
            role: "venue",
            subtitle: "Venue",
          });
        }
      }

      // Add personnel
      for (const p of personnel || []) {
        if (p.user_id && !searchResults.find((r) => r.id === p.user_id)) {
          searchResults.push({
            id: p.user_id,
            display_name: p.display_name || "Unknown Guard",
            avatar_url: null,
            role: "personnel",
            subtitle: "Security Guard",
          });
        }
      }

      setResults(searchResults);
    } catch (e) {
      console.error("Search error:", e);
    }

    setSearching(false);
  }, [userId]);

  // Start conversation
  const startConversation = async (contact: SearchResult) => {
    if (!supabase || !userId || creating) return;

    safeHaptic("medium");
    setCreating(true);

    try {
      // Get or create conversation using the database function
      const { data, error } = await supabase.rpc("get_or_create_conversation", {
        user_1: userId,
        user_2: contact.id,
      });

      if (error) {
        console.error("Error creating conversation:", error);
        Alert.alert("Error", "Failed to start conversation");
        setCreating(false);
        return;
      }

      // Navigate back to messages - the conversation will appear
      router.back();
    } catch (e) {
      console.error("Exception starting conversation:", e);
      Alert.alert("Error", "Something went wrong");
    }

    setCreating(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "venue": return "🏢";
      case "agency": return "🏛️";
      default: return "🛡️";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "venue": return "#A855F7";
      case "agency": return "#F59E0B";
      default: return colors.accent;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "venue": return "Venue Manager";
      case "agency": return "Agency";
      default: return "Security Guard";
    }
  };

  const renderContact = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => startConversation(item)}
      activeOpacity={0.7}
      disabled={creating}
    >
      <View style={[styles.contactAvatar, { borderColor: getRoleColor(item.role) }]}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.contactAvatarImg} />
        ) : (
          <Text style={styles.contactAvatarText}>{getRoleIcon(item.role)}</Text>
        )}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.display_name}</Text>
        <View style={styles.contactRoleRow}>
          <View style={[styles.contactRoleDot, { backgroundColor: getRoleColor(item.role) }]} />
          <Text style={styles.contactRole}>{item.subtitle || getRoleLabel(item.role)}</Text>
        </View>
      </View>
      <View style={styles.contactAction}>
        <Text style={styles.contactActionText}>Message</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search people, venues, agencies..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={colors.accent} />}
          {searchQuery.length > 0 && !searching && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results / Recent Contacts */}
      <FlatList
        data={searchQuery.length > 0 ? results : recentContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          searchQuery.length === 0 && recentContacts.length > 0 ? (
            <Text style={styles.sectionTitle}>Recent Contacts</Text>
          ) : searchQuery.length > 0 && results.length > 0 ? (
            <Text style={styles.sectionTitle}>Search Results</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={["rgba(168, 85, 247, 0.15)", "transparent"]}
              style={styles.emptyGradient}
            />
            {searchQuery.length > 0 ? (
              <>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching with a different name
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Start a conversation</Text>
                <Text style={styles.emptySubtitle}>
                  Search for a venue, agency, or fellow guard to message
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* Creating indicator */}
      {creating && (
        <View style={styles.creatingOverlay}>
          <View style={styles.creatingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.creatingText}>Starting conversation...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 20,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  clearBtn: {
    fontSize: 16,
    color: colors.textMuted,
    padding: 4,
  },

  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },

  // Contact Card
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactAvatarText: {
    fontSize: 24,
  },
  contactInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  contactRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactRoleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contactRole: {
    fontSize: 13,
    color: colors.textMuted,
  },
  contactAction: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
  },
  contactActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyGradient: {
    position: "absolute",
    top: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },

  // Creating overlay
  creatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  creatingBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  creatingText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
});
