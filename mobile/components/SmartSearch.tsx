/**
 * Smart Search Component
 * Full-screen search overlay with recent searches and suggestions
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  Keyboard,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing, radius } from "../theme";

interface SearchResult {
  id: string;
  type: "venue" | "personnel" | "agency" | "shift";
  title: string;
  subtitle: string;
  icon: string;
}

interface SmartSearchProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  onResultPress: (result: SearchResult) => void;
  placeholder?: string;
  recentSearchesKey?: string;
  suggestions?: Array<{ text: string; icon: string }>;
}

const RECENT_SEARCHES_LIMIT = 10;

export function SmartSearch({
  visible,
  onClose,
  onSearch,
  onResultPress,
  placeholder = "Search venues, personnel, shifts...",
  recentSearchesKey = "recent_searches",
  suggestions = [
    { text: "Door Supervisor jobs", icon: "🚪" },
    { text: "Nightclub security", icon: "🎵" },
    { text: "Corporate events", icon: "🏢" },
    { text: "Close protection", icon: "🛡️" },
  ],
}: SmartSearchProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  // Load recent searches
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Animate in when visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 200,
          friction: 20,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(-20);
      setQuery("");
      setResults([]);
    }
  }, [visible]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(recentSearchesKey);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent searches:", e);
    }
  };

  const saveRecentSearch = async (searchQuery: string) => {
    try {
      const updated = [
        searchQuery,
        ...recentSearches.filter((s) => s !== searchQuery),
      ].slice(0, RECENT_SEARCHES_LIMIT);
      setRecentSearches(updated);
      await AsyncStorage.setItem(recentSearchesKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save recent search:", e);
    }
  };

  const clearRecentSearches = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecentSearches([]);
    await AsyncStorage.removeItem(recentSearchesKey);
  };

  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      saveRecentSearch(searchQuery.trim());
      Keyboard.dismiss();
      onSearch(searchQuery.trim());
    },
    [onSearch]
  );

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onClose();
  };

  const handleSuggestionPress = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(text);
    handleSearch(text);
  };

  const handleRecentPress = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(text);
    handleSearch(text);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <BlurView intensity={80} tint="dark" style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              paddingTop: insets.top + spacing.md,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Search Header */}
          <View style={styles.header}>
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => handleSearch(query)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setQuery("");
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <FlatList
            data={[]}
            renderItem={() => null}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* Suggestions */}
                {query.length === 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Suggested Searches</Text>
                    <View style={styles.suggestionsGrid}>
                      {suggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionChip}
                          onPress={() => handleSuggestionPress(suggestion.text)}
                        >
                          <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
                          <Text style={styles.suggestionText} numberOfLines={1}>
                            {suggestion.text}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Recent Searches */}
                {query.length === 0 && recentSearches.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Recent Searches</Text>
                      <TouchableOpacity onPress={clearRecentSearches}>
                        <Text style={styles.clearAllText}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    {recentSearches.map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentItem}
                        onPress={() => handleRecentPress(search)}
                      >
                        <Text style={styles.recentIcon}>🕐</Text>
                        <Text style={styles.recentText}>{search}</Text>
                        <Text style={styles.recentArrow}>→</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Quick Filters */}
                {query.length === 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Browse by Category</Text>
                    <View style={styles.categoriesGrid}>
                      {[
                        { icon: "🏢", label: "Venues", color: "rgba(59, 130, 246, 0.2)" },
                        { icon: "🛡️", label: "Personnel", color: "rgba(16, 185, 129, 0.2)" },
                        { icon: "🏛️", label: "Agencies", color: "rgba(139, 92, 246, 0.2)" },
                        { icon: "📅", label: "Shifts", color: "rgba(245, 158, 11, 0.2)" },
                      ].map((cat, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.categoryCard, { backgroundColor: cat.color }]}
                          onPress={() => handleSuggestionPress(cat.label)}
                        >
                          <Text style={styles.categoryIcon}>{cat.icon}</Text>
                          <Text style={styles.categoryLabel}>{cat.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            }
          />
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(12, 13, 16, 0.95)",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  clearIcon: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  clearAllText: {
    ...typography.caption,
    color: colors.accent,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  suggestionIcon: {
    fontSize: 14,
  },
  suggestionText: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentIcon: {
    fontSize: 14,
    marginRight: spacing.md,
    opacity: 0.6,
  },
  recentText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  recentArrow: {
    ...typography.body,
    color: colors.textMuted,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryCard: {
    width: "48%",
    flexGrow: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  categoryLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});

export default SmartSearch;
