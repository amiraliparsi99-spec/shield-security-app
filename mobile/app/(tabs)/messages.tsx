/**
 * Messages Tab - Mission Control Style
 * Shows group chats from bookings (Mission Control) with real-time messaging
 */

import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import { safeHaptic } from "../../lib/haptics";
import { useCall } from "../../contexts/CallContext";

interface GroupChat {
  id: string;
  name: string;
  booking_id: string | null;
  venue_id: string | null;
  chat_type: string;
  is_active: boolean;
  event_date: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ChatMember {
  id: string;
  group_chat_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
}

interface ChatMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export default function MessagesTab() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { initiateCall, callState } = useCall();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Chat list
  const [chats, setChats] = useState<GroupChat[]>([]);

  // Active chat
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Load user and chats
  const loadChats = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from("group_chats")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading chats:", error.message);
      }

      setChats(data || []);
    } catch (e) {
      console.error("Exception loading chats:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Select a chat and load its messages
  const selectChat = async (chat: GroupChat) => {
    if (!supabase) return;
    safeHaptic("selection");
    setActiveChat(chat);
    setMessages([]);

    // Load members and messages in parallel
    const [membersResult, messagesResult] = await Promise.all([
      supabase
        .from("group_chat_members")
        .select("*")
        .eq("group_chat_id", chat.id),
      supabase
        .from("group_chat_messages")
        .select("*")
        .eq("group_chat_id", chat.id)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    setMembers(membersResult.data || []);
    setMessages(messagesResult.data || []);

    // Mark as read
    if (userId) {
      await supabase
        .from("group_chat_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("group_chat_id", chat.id)
        .eq("user_id", userId);
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 200);
  };

  // Subscribe to new messages
  useEffect(() => {
    if (!activeChat || !supabase) return;

    const channel = supabase
      .channel(`group_chat:${activeChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_chat_messages",
          filter: `group_chat_id=eq.${activeChat.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !activeChat || !supabase || !userId || sending) return;

    safeHaptic("medium");
    setSending(true);

    const { error } = await supabase.from("group_chat_messages").insert({
      group_chat_id: activeChat.id,
      sender_id: userId,
      content: newMessage.trim(),
      message_type: "text",
      metadata: {},
    });

    if (error) {
      Alert.alert("Error", "Failed to send message");
      console.error("Send error:", error);
    } else {
      setNewMessage("");
      // Update chat timestamp
      await supabase
        .from("group_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeChat.id);
    }

    setSending(false);
  };

  // Quick check-in actions
  const handleQuickAction = async (status: string) => {
    if (!activeChat || !supabase || !userId) return;

    const statusMessages: Record<string, string> = {
      arriving: "🚗 On my way, ETA 5 mins",
      on_site: "✅ Arrived on site",
      position: "📍 In position",
      break: "☕ Taking a break",
      leaving: "👋 Shift complete, leaving",
    };

    safeHaptic("medium");
    setSending(true);

    await supabase.from("group_chat_messages").insert({
      group_chat_id: activeChat.id,
      sender_id: userId,
      content: statusMessages[status] || status,
      message_type: "checkin",
      metadata: { status, timestamp: new Date().toISOString() },
    });

    await supabase
      .from("group_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeChat.id);

    setShowQuickActions(false);
    setSending(false);
  };

  // Helpers
  const getMemberName = (senderId: string) => {
    return members.find((m) => m.user_id === senderId)?.display_name || "Unknown";
  };

  const getMemberRole = (senderId: string) => {
    return members.find((m) => m.user_id === senderId)?.role || "member";
  };

  // Call a team member
  const handleCallMember = (member: ChatMember) => {
    if (callState !== "idle") {
      Alert.alert("Call in Progress", "You already have an active call");
      return;
    }

    Alert.alert(
      "Call Team Member",
      `Call ${member.display_name || "Unknown"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: () => {
            safeHaptic("medium");
            initiateCall(
              {
                userId: member.user_id,
                name: member.display_name || "Team Member",
                role: member.role === "owner" ? "venue" : "personnel",
              },
              { bookingId: activeChat?.booking_id || undefined }
            );
          },
        },
      ]
    );
  };

  // Show member picker for calling
  const handleCallFromChat = () => {
    const callableMembers = members.filter((m) => m.user_id !== userId);
    
    if (callableMembers.length === 0) {
      Alert.alert("No Members", "No other team members to call");
      return;
    }

    if (callableMembers.length === 1) {
      handleCallMember(callableMembers[0]);
      return;
    }

    // Multiple members - show picker
    Alert.alert(
      "Call Team Member",
      "Who would you like to call?",
      [
        ...callableMembers.map((m) => ({
          text: `${m.role === "owner" ? "🏢" : "🛡️"} ${m.display_name || "Unknown"}`,
          onPress: () => handleCallMember(m),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  // Loading
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Not logged in
  if (!userId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🔐</Text>
        <Text style={styles.emptyTitle}>Login Required</Text>
        <Text style={styles.emptySubtitle}>Sign in to access Mission Control messages</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active chat view
  if (activeChat) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => { setActiveChat(null); safeHaptic("selection"); }}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderTitle} numberOfLines={1}>{activeChat.name}</Text>
            <Text style={styles.chatHeaderSub}>
              {members.length} team member{members.length !== 1 ? "s" : ""}
              {activeChat.event_date ? ` · ${formatDate(activeChat.event_date)}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.callHeaderBtn, callState !== "idle" && styles.callHeaderBtnDisabled]}
            onPress={handleCallFromChat}
            disabled={callState !== "idle"}
          >
            <Text style={styles.callHeaderBtnText}>📞</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderBadge}>
            <Text style={styles.chatHeaderBadgeText}>🛡️</Text>
          </View>
        </View>

        {/* Team Members Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.membersBar}
          contentContainerStyle={styles.membersBarContent}
        >
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberChip, m.role === "owner" && styles.memberChipOwner]}
              onPress={() => m.user_id !== userId && handleCallMember(m)}
              disabled={m.user_id === userId}
              activeOpacity={0.7}
            >
              <Text style={styles.memberChipText}>
                {m.role === "owner" ? "🏢" : "🛡️"} {m.display_name || "Unknown"}
                {m.user_id !== userId ? " 📞" : " (You)"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isOwn = msg.sender_id === userId;
            const isSystem = msg.message_type === "system";
            const isCheckin = msg.message_type === "checkin";

            if (isSystem) {
              return (
                <View style={styles.systemMsg}>
                  <Text style={styles.systemMsgText}>{msg.content}</Text>
                </View>
              );
            }

            return (
              <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
                <View
                  style={[
                    styles.msgBubble,
                    isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther,
                    isCheckin && styles.msgBubbleCheckin,
                  ]}
                >
                  {!isOwn && (
                    <View style={styles.msgSenderRow}>
                      <Text style={styles.msgSenderName}>{getMemberName(msg.sender_id)}</Text>
                      {getMemberRole(msg.sender_id) === "owner" && (
                        <View style={styles.venueBadge}>
                          <Text style={styles.venueBadgeText}>Venue</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Text style={styles.msgContent}>{msg.content}</Text>
                  <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
                    {formatTime(msg.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={{ fontSize: 48 }}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Send the first message to your team</Text>
            </View>
          }
        />

        {/* Quick Actions */}
        {showQuickActions && (
          <View style={styles.quickActions}>
            {[
              { id: "arriving", icon: "🚗", label: "On my way" },
              { id: "on_site", icon: "✅", label: "Arrived" },
              { id: "position", icon: "📍", label: "In position" },
              { id: "break", icon: "☕", label: "On break" },
              { id: "leaving", icon: "👋", label: "Leaving" },
            ].map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionBtn}
                onPress={() => handleQuickAction(action.id)}
              >
                <Text style={styles.quickActionIcon}>{action.icon}</Text>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
          <TouchableOpacity
            style={[styles.quickActionToggle, showQuickActions && styles.quickActionToggleActive]}
            onPress={() => {
              setShowQuickActions(!showQuickActions);
              safeHaptic("selection");
            }}
          >
            <Text style={styles.quickActionToggleText}>+</Text>
          </TouchableOpacity>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.sendBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Chat list view
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Mission Control</Text>
        </View>
        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 24 }}>🎯</Text>
        </View>
      </View>

      <ScrollView
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadChats(); }}
            tintColor={colors.accent}
          />
        }
      >
        {chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🎯</Text>
            <Text style={styles.emptyTitle}>No Active Missions</Text>
            <Text style={styles.emptySubtitle}>
              When you claim a shift, Mission Control will connect you with the venue team here.
            </Text>
            <TouchableOpacity
              style={styles.findJobsBtn}
              onPress={() => router.push("/jobs")}
            >
              <Text style={styles.findJobsBtnText}>Find Jobs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatCard}
              onPress={() => selectChat(chat)}
              activeOpacity={0.7}
            >
              <View style={styles.chatCardIcon}>
                <Text style={{ fontSize: 22 }}>🛡️</Text>
              </View>
              <View style={styles.chatCardInfo}>
                <Text style={styles.chatCardName} numberOfLines={1}>{chat.name}</Text>
                <Text style={styles.chatCardMeta}>
                  {chat.event_date ? formatDate(chat.event_date) : "Active mission"}
                  {chat.metadata?.venue_name ? ` · ${chat.metadata.venue_name}` : ""}
                </Text>
              </View>
              <View style={styles.chatCardArrow}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>→</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.display,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Chat list
  chatList: { flex: 1 },
  chatListContent: { padding: spacing.md, paddingBottom: 100 },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chatCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  chatCardName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  chatCardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chatCardArrow: {
    paddingLeft: spacing.sm,
  },

  // Empty states
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  emptyMessages: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  findJobsBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  findJobsBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
  loginBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  loginBtnText: {
    color: "#000",
    fontWeight: "bold",
  },

  // Chat view header
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingRight: spacing.md,
  },
  backBtnText: {
    ...typography.body,
    color: colors.accent,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "bold",
    fontSize: 16,
  },
  chatHeaderSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  callHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  callHeaderBtnDisabled: {
    opacity: 0.4,
  },
  callHeaderBtnText: {
    fontSize: 18,
  },
  chatHeaderBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderBadgeText: {
    fontSize: 20,
  },

  // Members bar
  membersBar: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  membersBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: "row",
  },
  memberChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberChipOwner: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  memberChipText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 12,
  },

  // Messages
  messagesList: {
    padding: spacing.md,
    paddingBottom: 20,
  },
  systemMsg: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginVertical: spacing.sm,
    maxWidth: "85%",
  },
  systemMsgText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 12,
  },
  msgRow: {
    marginBottom: spacing.sm,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  msgRowOwn: {
    alignSelf: "flex-end",
  },
  msgBubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  msgBubbleOwn: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  msgBubbleCheckin: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  msgSenderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  msgSenderName: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
    fontSize: 12,
  },
  venueBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  venueBadgeText: {
    fontSize: 9,
    color: "#A855F7",
    fontWeight: "600",
  },
  msgContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 21,
  },
  msgTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  msgTimeOwn: {
    color: "rgba(45, 212, 191, 0.6)",
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.text,
    fontSize: 13,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  quickActionToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionToggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  quickActionToggleText: {
    fontSize: 22,
    color: colors.text,
    fontWeight: "300",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
});
