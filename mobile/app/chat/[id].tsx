/**
 * Premium Chat Thread
 * WhatsApp-style chat with reactions, animations, and media support
 */

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Animated,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { resolveUserDisplay, sendMessage } from "../../lib/chat";
import { colors, typography, spacing, radius } from "../../theme";
import { useCall } from "../../contexts/CallContext";

type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  reactions?: string[];
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Animated message bubble component
function MessageBubble({
  message,
  isMe,
  onLongPress,
  onReact,
  showReactions,
  index,
}: {
  message: Msg;
  isMe: boolean;
  onLongPress: () => void;
  onReact: (emoji: string) => void;
  showReactions: boolean;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 15,
        useNativeDriver: true,
        delay: index * 30,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        delay: index * 30,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 200,
        friction: 15,
        useNativeDriver: true,
        delay: index * 30,
      }),
    ]).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const time = new Date(message.created_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View
      style={[
        styles.bubbleContainer,
        isMe ? styles.bubbleContainerMe : styles.bubbleContainerThem,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }, { translateY }],
        },
      ]}
    >
      {/* Reactions picker */}
      {showReactions && (
        <Animated.View style={[styles.reactionsBar, isMe && styles.reactionsBarMe]}>
          <BlurView intensity={80} tint="dark" style={styles.reactionsBlur}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReact(emoji);
                }}
                style={styles.reactionButton}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      )}

      <TouchableOpacity
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={300}
      >
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{message.content}</Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{time}</Text>
            {isMe && (
              <Text style={styles.readReceipt}>✓✓</Text>
            )}
          </View>

          {/* Reactions display */}
          {message.reactions && message.reactions.length > 0 && (
            <View style={styles.reactionsDisplay}>
              {message.reactions.slice(0, 3).map((r, i) => (
                <Text key={i} style={styles.reactionDisplayEmoji}>{r}</Text>
              ))}
              {message.reactions.length > 3 && (
                <Text style={styles.reactionCount}>+{message.reactions.length - 3}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Bubble tail */}
      <View
        style={[
          styles.bubbleTail,
          isMe ? styles.bubbleTailMe : styles.bubbleTailThem,
        ]}
      />
    </Animated.View>
  );
}

// Quick reply suggestions
function QuickReplies({ onSelect }: { onSelect: (text: string) => void }) {
  const replies = ["On my way 🚗", "Confirmed ✓", "Thanks!", "I'll check and get back to you"];

  return (
    <View style={styles.quickReplies}>
      {replies.map((reply, index) => (
        <TouchableOpacity
          key={index}
          style={styles.quickReplyChip}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(reply);
          }}
        >
          <Text style={styles.quickReplyText}>{reply}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Typing indicator
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
        <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
        <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

export default function ChatThread() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const idStr = typeof conversationId === "string" ? conversationId : Array.isArray(conversationId) ? conversationId[0] : "";
  const insets = useSafeAreaInsets();
  const { initiateCall, callState } = useCall();
  const flatListRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherDisplay, setOtherDisplay] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !idStr) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: conv } = await supabase
      .from("conversations")
      .select("user_id_1, user_id_2")
      .eq("id", idStr)
      .maybeSingle();
    if (!conv || (user.id !== conv.user_id_1 && user.id !== conv.user_id_2)) {
      setLoading(false);
      return;
    }
    setCurrentUserId(user.id);
    const otherId = conv.user_id_1 === user.id ? conv.user_id_2 : conv.user_id_1;
    setOtherUserId(otherId);
    const display = await resolveUserDisplay(supabase, otherId);
    setOtherDisplay(display?.displayName ?? "User");

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", idStr)
      .order("created_at", { ascending: true });
    setMessages((msgs ?? []) as Msg[]);
    setLoading(false);
  }, [idStr]);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const text = content.trim();
    if (!text || !supabase || !idStr || sending) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setErr(null);
    setShowQuickReplies(false);
    
    const result = await sendMessage(supabase, idStr, text);
    setSending(false);
    
    if (result.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErr(result.error);
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setContent("");
    load();
  }

  const handleQuickReply = (text: string) => {
    setContent(text);
    setShowQuickReplies(false);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    // Update local state (in a real app, this would sync to backend)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: [...(m.reactions || []), emoji] }
          : m
      )
    );
    setSelectedMessageId(null);
  };

  const handleCall = () => {
    if (!otherUserId) {
      Alert.alert("Error", "Cannot start call - user not found");
      return;
    }
    if (callState !== 'idle') {
      Alert.alert("Call in Progress", "You already have an active call");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Start Call",
      `Call ${otherDisplay}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Call", 
          onPress: () => initiateCall({
            userId: otherUserId,
            name: otherDisplay,
            role: 'personnel',
          })
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  if (!currentUserId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorIcon}>🔒</Text>
        <Text style={styles.error}>You don't have access to this conversation.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Premium Header */}
      <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.headerBack}
        >
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{otherDisplay.charAt(0).toUpperCase()}</Text>
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{otherDisplay}</Text>
            <Text style={styles.headerStatus}>
              {isTyping ? "typing..." : "online"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleCall}
            style={[styles.headerBtn, callState !== 'idle' && styles.headerBtnDisabled]}
            disabled={callState !== 'idle'}
          >
            <Text style={styles.headerBtnText}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: m, index }) => {
          const isMe = m.sender_id === currentUserId;
          return (
            <MessageBubble
              message={m}
              isMe={isMe}
              index={index}
              onLongPress={() => setSelectedMessageId(m.id)}
              onReact={(emoji) => handleReaction(m.id, emoji)}
              showReactions={selectedMessageId === m.id}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Say hello to {otherDisplay}</Text>
          </View>
        }
        onScrollBeginDrag={() => setSelectedMessageId(null)}
      />

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Quick Replies */}
      {showQuickReplies && messages.length > 0 && (
        <QuickReplies onSelect={handleQuickReply} />
      )}

      {/* Input Footer */}
      <BlurView intensity={80} tint="dark" style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {err && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {err}</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn}>
            <Text style={styles.attachIcon}>+</Text>
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <TextInput
              value={content}
              onChangeText={(text) => {
                setContent(text);
                setShowQuickReplies(false);
              }}
              placeholder={`Message ${otherDisplay}…`}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              editable={!sending}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity style={styles.emojiBtn}>
              <Text style={styles.emojiIcon}>😊</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!content.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!content.trim() || sending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={content.trim() && !sending ? [colors.accent, "#1fa89e"] : ["#555", "#444"]}
              style={styles.sendBtnGradient}
            >
              <Text style={styles.sendIcon}>{sending ? "⏳" : "➤"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Dismiss reactions overlay */}
      {selectedMessageId && (
        <TouchableOpacity
          style={styles.reactionsOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMessageId(null)}
        />
      )}
    </KeyboardAvoidingView>
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
    padding: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
  },
  backBtn: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  backBtnText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(12, 13, 16, 0.9)",
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackIcon: {
    fontSize: 24,
    color: colors.accent,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(45, 212, 191, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    ...typography.title,
    color: colors.accent,
    fontSize: 16,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  headerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  headerStatus: {
    ...typography.caption,
    color: colors.success,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerBtnText: {
    fontSize: 18,
  },

  // Messages
  list: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  bubbleContainer: {
    maxWidth: "80%",
    marginBottom: spacing.md,
    position: "relative",
  },
  bubbleContainerMe: {
    alignSelf: "flex-end",
  },
  bubbleContainerThem: {
    alignSelf: "flex-start",
  },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
    minWidth: 60,
  },
  bubbleMe: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
    gap: 4,
  },
  bubbleTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  bubbleTimeMe: {
    color: "rgba(45, 212, 191, 0.7)",
  },
  readReceipt: {
    fontSize: 10,
    color: colors.accent,
  },
  bubbleTail: {
    position: "absolute",
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: "transparent",
    borderBottomWidth: 8,
    borderBottomColor: "transparent",
  },
  bubbleTailMe: {
    right: -6,
    borderLeftWidth: 8,
    borderLeftColor: "rgba(45, 212, 191, 0.15)",
  },
  bubbleTailThem: {
    left: -6,
    borderRightWidth: 8,
    borderRightColor: colors.surface,
  },

  // Reactions
  reactionsBar: {
    position: "absolute",
    top: -50,
    left: 0,
    zIndex: 10,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  reactionsBarMe: {
    right: 0,
    left: "auto",
  },
  reactionsBlur: {
    flexDirection: "row",
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: "rgba(30, 30, 40, 0.9)",
  },
  reactionButton: {
    padding: spacing.sm,
  },
  reactionEmoji: {
    fontSize: 22,
  },
  reactionsDisplay: {
    position: "absolute",
    bottom: -10,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionDisplayEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 2,
  },
  reactionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 5,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },

  // Typing indicator
  typingContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },

  // Quick replies
  quickReplies: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: "rgba(12, 13, 16, 0.5)",
  },
  quickReplyChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickReplyText: {
    ...typography.caption,
    color: colors.text,
  },

  // Footer
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "rgba(12, 13, 16, 0.9)",
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.error,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachIcon: {
    fontSize: 22,
    color: colors.textMuted,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  emojiBtn: {
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  emojiIcon: {
    fontSize: 20,
  },
  sendBtn: {
    borderRadius: 22,
    overflow: "hidden",
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    fontSize: 18,
    color: colors.text,
  },
});
