/**
 * Messages Tab — Mission Control only (group chats per booking / shift).
 */

import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Vibration,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";
import { safeHaptic } from "../../lib/haptics";
import { useCall } from "../../contexts/CallContext";
import { useTabBar } from "../../contexts/TabBarContext";
import { useUnreadMessages } from "../../contexts/UnreadMessagesContext";
import { IncidentRequestCard } from "../../components/messages/IncidentRequestCard";
import { LocationMessageCard, hasLocationCoords } from "../../components/messages/LocationMessageCard";
import { getCurrentLocation } from "../../services/location";
import { GuestGate } from "../../components/auth/GuestGate";

// ——— Types ———

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
  // Computed
  unread_count?: number;
  last_message?: string;
  last_message_sender?: string;
  last_message_sender_role?: string;
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
  group_chat_id?: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, any>;
  created_at: string;
  delivered_at?: string;
  read_by?: string[];
}

type GroupCallInviteMeta = {
  type: "group_call_invite";
  channel_name: string;
  started_by?: string;
  started_by_name?: string;
  started_at?: string;
};

type MissionTimeFilter = "upcoming" | "past";

/** How to order the mission list after Upcoming/Past filtering. */
type MissionListSort =
  | "event_asc"
  | "event_desc"
  | "activity_desc"
  | "activity_asc"
  | "name_asc"
  | "name_desc";

const MISSION_SORT_OPTIONS: { id: MissionListSort; label: string }[] = [
  { id: "event_asc", label: "Soonest" },
  { id: "event_desc", label: "Latest event" },
  { id: "activity_desc", label: "Recent activity" },
  { id: "activity_asc", label: "Oldest activity" },
  { id: "name_asc", label: "A–Z" },
  { id: "name_desc", label: "Z–A" },
];

function missionEventSortKey(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const raw = eventDate.includes("T") ? eventDate : `${eventDate}T12:00:00`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Past = booking event date before today (local); undated chats stay in Upcoming. */
function isMissionChatPast(chat: GroupChat): boolean {
  const t = missionEventSortKey(chat.event_date);
  if (t === null) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const ev = new Date(t);
  ev.setHours(0, 0, 0, 0);
  return ev.getTime() < start.getTime();
}

function compareMissionChats(a: GroupChat, b: GroupChat, sort: MissionListSort): number {
  const ta = missionEventSortKey(a.event_date);
  const tb = missionEventSortKey(b.event_date);
  const ua = new Date(a.updated_at).getTime();
  const ub = new Date(b.updated_at).getTime();
  const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  switch (sort) {
    case "event_asc": {
      if (ta === null && tb === null) return ub - ua;
      if (ta === null) return 1;
      if (tb === null) return -1;
      if (ta !== tb) return ta - tb;
      return ub - ua;
    }
    case "event_desc": {
      if (ta === null && tb === null) return ub - ua;
      if (ta === null) return 1;
      if (tb === null) return -1;
      if (ta !== tb) return tb - ta;
      return ub - ua;
    }
    case "activity_desc":
      return ub - ua;
    case "activity_asc":
      return ua - ub;
    case "name_asc":
      return nameCmp !== 0 ? nameCmp : ub - ua;
    case "name_desc":
      return nameCmp !== 0 ? -nameCmp : ub - ua;
    default:
      return 0;
  }
}

function makeMissionGroupChannelName(chatId: string): string {
  return `shield_group_${chatId}`;
}

export default function MessagesTab() {
  return (
    <GuestGate feature="messages" redirectAfter="/(tabs)/messages">
      <MessagesTabContent />
    </GuestGate>
  );
}

function MessagesTabContent() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { initiateCall, joinGroupVoiceChannel, callState } = useCall();
  const { hideTabBar, showTabBar } = useTabBar();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [missionTimeFilter, setMissionTimeFilter] = useState<MissionTimeFilter>("upcoming");
  const [missionSort, setMissionSort] = useState<MissionListSort>("event_asc");
  const { refreshUnreadCount } = useUnreadMessages();

  // Mission Control (Group Chats)
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Track completed report shift IDs
  const [completedReportShiftIds, setCompletedReportShiftIds] = useState<Set<string>>(new Set());

  // Shared
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Hide/show tab bar based on active chat
  useEffect(() => {
    if (activeChat) {
      hideTabBar();
    } else {
      showTabBar();
    }
  }, [activeChat, hideTabBar, showTabBar]);

  // Ensure tab bar is shown when component unmounts
  useEffect(() => {
    return () => {
      showTabBar();
    };
  }, [showTabBar]);

  // Load user and data
  const loadData = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // Load group chats (Mission Control)
      const { data: groupChats } = await supabase
        .from("group_chats")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      // Get user's membership info for unread counts
      const { data: memberships } = await supabase
        .from("group_chat_members")
        .select("group_chat_id, last_read_at")
        .eq("user_id", user.id);

      const membershipMap = new Map(
        memberships?.map((m: any) => [m.group_chat_id, m.last_read_at]) || []
      );

      // Enrich chats with unread counts and last message
      const enrichedChats = await Promise.all(
        (groupChats || []).map(async (chat: GroupChat) => {
          const lastReadAt = membershipMap.get(chat.id) || "1970-01-01";

          // Get unread count
          const { count: unreadCount } = await supabase
            .from("group_chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("group_chat_id", chat.id)
            .neq("sender_id", user.id)
            .gt("created_at", lastReadAt);

          // Get last message
          const { data: lastMessages } = await supabase
            .from("group_chat_messages")
            .select("content, sender_id")
            .eq("group_chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastMsg = lastMessages?.[0];

          // Get sender role if there's a last message
          let lastMsgSenderRole = "member";
          if (lastMsg) {
            const { data: memberData } = await supabase
              .from("group_chat_members")
              .select("role, display_name")
              .eq("group_chat_id", chat.id)
              .eq("user_id", lastMsg.sender_id)
              .single();

            if (memberData) {
              lastMsgSenderRole = memberData.role;
            }
          }

          return {
            ...chat,
            unread_count: unreadCount || 0,
            last_message: lastMsg?.content,
            last_message_sender: lastMsg?.sender_id,
            last_message_sender_role: lastMsgSenderRole,
          };
        })
      );

      setChats(enrichedChats);
    } catch (e) {
      console.error("Exception loading messages:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ——— Mission Control Functions ———

  const selectChat = async (chat: GroupChat) => {
    if (!supabase) return;
    safeHaptic("selection");
    setActiveChat(chat);
    setMessages([]);

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

    // Check which incident report requests have been completed
    const msgs = messagesResult.data || [];
    const incidentShiftIds = msgs
      .filter((m: any) => m.metadata?.type === "incident_report_request" && m.metadata?.shift_id)
      .map((m: any) => m.metadata.shift_id as string);
    
    if (incidentShiftIds.length > 0) {
      const { data: existingSummaries } = await supabase
        .from("post_shift_summaries")
        .select("shift_id, total_incidents")
        .in("shift_id", incidentShiftIds);
      
      if (existingSummaries && existingSummaries.length > 0) {
        const completedIds = new Set(existingSummaries.map((s: any) => s.shift_id));
        setCompletedReportShiftIds(completedIds);
      }
    }

    if (userId) {
      await supabase
        .from("group_chat_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("group_chat_id", chat.id)
        .eq("user_id", userId);
      
      // Mark all messages as read by this user
      await supabase.rpc("mark_chat_messages_read", {
        p_chat_id: chat.id,
        p_user_id: userId,
      });
      
      // Clear unread count for this chat in local state
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c.id === chat.id);
        if (chatIndex === -1) return prevChats;
        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = { ...updatedChats[chatIndex], unread_count: 0 };
        return updatedChats;
      });
      
      // Refresh the tab bar badge
      refreshUnreadCount();
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 200);
  };

  // Subscribe to new group messages (when inside a chat)
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
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          
          // Mark message as read since we're viewing the chat
          if (userId && supabase && newMsg.sender_id !== userId) {
            supabase
              .from("group_chat_members")
              .update({ last_read_at: new Date().toISOString() })
              .eq("group_chat_id", activeChat.id)
              .eq("user_id", userId)
              .then(() => {});
            
            // Mark this specific message as read
            supabase.rpc("mark_message_read", {
              p_message_id: newMsg.id,
              p_user_id: userId,
            }).then(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_chat_messages",
          filter: `group_chat_id=eq.${activeChat.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as ChatMessage;
          setMessages((prev) => 
            prev.map((m) => m.id === updatedMsg.id ? { ...m, read_by: updatedMsg.read_by, metadata: updatedMsg.metadata } : m)
          );
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [activeChat, userId]);

  // Subscribe to ALL new group messages (for chat list updates)
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel("all-group-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_chat_messages",
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Don't process our own messages
          if (newMsg.sender_id === userId) return;
          
          // Update the chat in our list with the new message
          setChats((prevChats) => {
            const chatIndex = prevChats.findIndex((c) => c.id === newMsg.group_chat_id);
            if (chatIndex === -1) return prevChats;

            const updatedChats = [...prevChats];
            const chat = { ...updatedChats[chatIndex] };
            
            // Update last message and unread count
            chat.last_message = newMsg.content;
            chat.last_message_sender = newMsg.sender_id;
            chat.updated_at = newMsg.created_at;
            
            // Increment unread count if not currently viewing this chat
            if (!activeChat || activeChat.id !== chat.id) {
              chat.unread_count = (chat.unread_count || 0) + 1;
            }

            updatedChats[chatIndex] = chat;
            
            // Sort by updated_at (most recent first)
            updatedChats.sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            
            return updatedChats;
          });

          // Get sender role for the message
          if (supabase) {
            const { data: memberData } = await supabase
              .from("group_chat_members")
              .select("role")
              .eq("group_chat_id", newMsg.group_chat_id)
              .eq("user_id", newMsg.sender_id)
              .single();

            if (memberData) {
              setChats((prevChats) => {
                const chatIndex = prevChats.findIndex((c) => c.id === newMsg.group_chat_id);
                if (chatIndex === -1) return prevChats;

                const updatedChats = [...prevChats];
                updatedChats[chatIndex] = {
                  ...updatedChats[chatIndex],
                  last_message_sender_role: memberData.role,
                };
                return updatedChats;
              });
            }
          }

          // Vibrate to alert the user of new message
          if (Platform.OS !== "web") {
            Vibration.vibrate([0, 100]);
          }
          safeHaptic("medium");
          
          // Refresh the unread count in the tab bar
          refreshUnreadCount();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [userId, activeChat, refreshUnreadCount]);

  // Send group message
  const handleSendGroupMessage = async () => {
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
    } else {
      setNewMessage("");
      await supabase
        .from("group_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeChat.id);
    }

    setSending(false);
  };

  // Quick check-in actions (Mission Control only)
  const handleQuickAction = async (status: string) => {
    if (!activeChat || !supabase || !userId) return;

    const statusMessages: Record<string, string> = {
      arriving: "🚗 On my way, ETA 5 mins",
      on_site: "✅ Arrived on site",
      position: "📍 In position",
      break: "☕ Taking a break",
      leaving: "👋 Shift complete, leaving",
      location: "📍 My Location",
    };

    safeHaptic("medium");
    setSending(true);

    let messageType: "checkin" | "location" = "checkin";
    let metadata: Record<string, unknown> = { status, timestamp: new Date().toISOString() };
    let content = statusMessages[status] || status;

    if (status === "location") {
      const loc = await getCurrentLocation();
      if (!loc) {
        Alert.alert("Location unavailable", "Enable location services to share your position.");
        setSending(false);
        return;
      }
      messageType = "location";
      metadata = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        label: "My Location",
        timestamp: new Date().toISOString(),
      };
    } else if (status === "position" || status === "on_site") {
      const loc = await getCurrentLocation();
      if (loc) {
        metadata.latitude = loc.coords.latitude;
        metadata.longitude = loc.coords.longitude;
        metadata.label = status === "position" ? "Live position" : statusMessages[status];
      }
    }

    await supabase.from("group_chat_messages").insert({
      group_chat_id: activeChat.id,
      sender_id: userId,
      content,
      message_type: messageType,
      metadata,
    });

    await supabase
      .from("group_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeChat.id);

    setShowQuickActions(false);
    setSending(false);
  };

  // ——— Helpers ———

  const getMemberName = (senderId: string) => {
    return members.find((m) => m.user_id === senderId)?.display_name || "Unknown";
  };

  const getMemberRole = (senderId: string) => {
    return members.find((m) => m.user_id === senderId)?.role || "member";
  };

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

  const startMissionGroupCall = async () => {
    if (!activeChat || !supabase || !userId) return;
    if (callState !== "idle") {
      Alert.alert("Call in Progress", "You already have an active call");
      return;
    }

    const channelName = makeMissionGroupChannelName(activeChat.id);
    const startedAtIso = new Date().toISOString();
    const startedByName = members.find((m) => m.user_id === userId)?.display_name || "Team member";
    const metadata: GroupCallInviteMeta = {
      type: "group_call_invite",
      channel_name: channelName,
      started_by: userId,
      started_by_name: startedByName,
      started_at: startedAtIso,
    };

    await supabase.from("group_chat_messages").insert({
      group_chat_id: activeChat.id,
      sender_id: userId,
      content: `📞 ${startedByName} started a group call. Tap to join.`,
      message_type: "system",
      metadata,
    });

    await supabase
      .from("group_chats")
      .update({ updated_at: startedAtIso })
      .eq("id", activeChat.id);

    await joinGroupVoiceChannel(channelName, `${activeChat.name} Group Call`);
  };

  const joinMissionGroupCall = async (msg: ChatMessage) => {
    const meta = msg.metadata as Partial<GroupCallInviteMeta> | undefined;
    const channelName = meta?.channel_name;
    if (!channelName) {
      Alert.alert("Unavailable", "This group call invite is missing channel details.");
      return;
    }
    if (callState !== "idle") {
      Alert.alert("Call in Progress", "End your current call first.");
      return;
    }
    await joinGroupVoiceChannel(channelName, `${activeChat?.name || "Mission"} Group Call`);
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

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return formatDate(dateStr);
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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    const words = name.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const sortedMissionChats = useMemo(() => {
    const filtered = chats.filter((c) =>
      missionTimeFilter === "upcoming" ? !isMissionChatPast(c) : isMissionChatPast(c)
    );
    return [...filtered].sort((a, b) => compareMissionChats(a, b, missionSort));
  }, [chats, missionTimeFilter, missionSort]);

  const isVenueOrAgency = (role: string) => {
    return role === "venue" || role === "agency" || role === "owner";
  };

  // ——— Loading State ———

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // ——— Not Logged In ———

  if (!userId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={["rgba(45, 212, 191, 0.2)", "rgba(45, 212, 191, 0)"]}
          style={styles.emptyGradient}
        />
        <Text style={{ fontSize: 56, marginBottom: spacing.md }}>💬</Text>
        <Text style={styles.emptyTitle}>Login Required</Text>
        <Text style={styles.emptySubtitle}>Sign in to access your messages</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.primaryBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ——— Active Group Chat View ———

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
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderTitle} numberOfLines={1}>{activeChat.name}</Text>
            <Text style={styles.chatHeaderSub}>
              {members.length} team member{members.length !== 1 ? "s" : ""}
              {activeChat.event_date ? ` · ${formatDate(activeChat.event_date)}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.headerActionBtn, callState !== "idle" && styles.headerActionBtnDisabled]}
            onPress={startMissionGroupCall}
            disabled={callState !== "idle"}
          >
            <Text style={styles.headerActionIcon}>📞</Text>
          </TouchableOpacity>
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
              <View style={[styles.memberAvatar, m.role === "owner" && styles.memberAvatarOwner]}>
                <Text style={styles.memberAvatarText}>
                  {m.role === "owner" ? "🏢" : "🛡️"}
                </Text>
              </View>
              <Text style={styles.memberChipName} numberOfLines={1}>
                {m.display_name || "Unknown"}
              </Text>
              {m.user_id === userId && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
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

            // Check if this is an incident report request (can be system message or contain the metadata)
            const isIncidentRequest = msg.metadata?.type === "incident_report_request" || 
              msg.content?.includes("Incident Report Requested");
            const isGroupCallInvite = msg.metadata?.type === "group_call_invite";
            const shiftId = msg.metadata?.shift_id || (msg.metadata?.shift_ids?.[0]);
            // Get venue_id from message metadata, or fall back to the chat's venue_id
            const venueId = msg.metadata?.venue_id || activeChat?.venue_id;
            
            if (isIncidentRequest) {
              return (
                <IncidentRequestCard
                  shiftId={shiftId}
                  venueId={venueId}
                  venueName={activeChat?.name || "Venue"}
                  isCompleted={msg.metadata?.completed === true || (!!shiftId && completedReportShiftIds.has(shiftId))}
                  completedIncidents={msg.metadata?.total_incidents ?? 0}
                />
              );
            }

            if (isGroupCallInvite) {
              const startedBy = (msg.metadata?.started_by_name as string | undefined) || "Team member";
              const startedAt = msg.metadata?.started_at as string | undefined;
              return (
                <View style={styles.groupCallCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupCallTitle}>Group Call</Text>
                    <Text style={styles.groupCallSubtitle}>
                      {startedBy} started a mission call
                      {startedAt ? ` · ${formatTime(startedAt)}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.groupCallJoinBtn, callState !== "idle" && styles.groupCallJoinBtnDisabled]}
                    onPress={() => joinMissionGroupCall(msg)}
                    disabled={callState !== "idle"}
                  >
                    <Text style={styles.groupCallJoinBtnText}>Join</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (isSystem) {
              return (
                <View style={styles.systemMsg}>
                  <Text style={styles.systemMsgText}>{msg.content}</Text>
                </View>
              );
            }

            const senderRole = getMemberRole(msg.sender_id);
            const senderName = getMemberName(msg.sender_id);
            const isFromVenueOrAgency = isVenueOrAgency(senderRole);
            
            // Calculate read status for own messages
            const otherMembers = members.filter(m => m.user_id !== userId);
            const readByOthers = msg.read_by?.filter(id => id !== msg.sender_id) || [];
            const isDelivered = !!msg.delivered_at;
            const isReadByAll = otherMembers.length > 0 && readByOthers.length >= otherMembers.length;
            const isReadBySome = readByOthers.length > 0;
            const showLocationCard =
              (msg.message_type === "location" || msg.message_type === "checkin") &&
              hasLocationCoords(msg.metadata);
            const hideTextContent = showLocationCard;

            return (
              <View style={[styles.msgRow, isOwn && styles.msgRowOwn, showLocationCard && styles.msgRowLocation]}>
                {!isOwn && (
                  <View style={[
                    styles.msgAvatar,
                    isFromVenueOrAgency && styles.msgAvatarVenue
                  ]}>
                    <Text style={[
                      styles.msgAvatarInitials,
                      isFromVenueOrAgency && styles.msgAvatarInitialsVenue
                    ]}>
                      {getInitials(senderName)}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    showLocationCard ? styles.locationMsgWrap : styles.msgBubble,
                    !showLocationCard && isOwn && styles.msgBubbleOwn,
                    !showLocationCard && !isOwn && styles.msgBubbleOther,
                    !showLocationCard && isCheckin && styles.msgBubbleCheckin,
                    !showLocationCard && !isOwn && isFromVenueOrAgency && styles.msgBubbleVenue,
                  ]}
                >
                  {!isOwn && (
                    <View style={styles.msgSenderRow}>
                      <Text style={[
                        styles.msgSenderName,
                        isFromVenueOrAgency && styles.msgSenderNameVenue
                      ]}>
                        {senderName}
                      </Text>
                      {isFromVenueOrAgency && (
                        <View style={styles.venueBadge}>
                          <Text style={styles.venueBadgeText}>
                            {senderRole === "owner" || senderRole === "venue" ? "Venue" : "Agency"}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {showLocationCard && (
                    <LocationMessageCard
                      metadata={msg.metadata}
                      fallbackLabel={msg.message_type === "checkin" ? "Live position" : "Shared location"}
                      isOwn={isOwn}
                    />
                  )}
                  {!hideTextContent && (
                    <Text style={[styles.msgContent, isOwn && styles.msgContentOwn]}>{msg.content}</Text>
                  )}
                  <View style={styles.msgMeta}>
                    <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isOwn && (
                      <Text style={[
                        styles.msgReadStatus,
                        isReadByAll && styles.msgReadStatusRead,
                        isReadBySome && !isReadByAll && styles.msgReadStatusPartial,
                      ]}>
                        {isReadByAll ? "✓✓" : isReadBySome ? "✓✓" : isDelivered ? "✓✓" : "✓"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={{ fontSize: 48 }}>🎯</Text>
              <Text style={styles.emptyTitle}>Mission Briefing</Text>
              <Text style={styles.emptySubtitle}>Send the first message to your team</Text>
            </View>
          }
        />

        {/* Quick Actions */}
        {showQuickActions && (
          <View style={styles.quickActions}>
            <Text style={styles.quickActionsTitle}>Quick Status Update</Text>
            <View style={styles.quickActionsGrid}>
              {[
                { id: "arriving", icon: "🚗", label: "On my way" },
                { id: "on_site", icon: "✅", label: "Arrived" },
                { id: "position", icon: "📍", label: "In position" },
                { id: "break", icon: "☕", label: "On break" },
                { id: "leaving", icon: "👋", label: "Leaving" },
                { id: "location", icon: "🗺️", label: "Share location" },
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
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.quickActionToggle, showQuickActions && styles.quickActionToggleActive]}
            onPress={() => {
              setShowQuickActions(!showQuickActions);
              safeHaptic("selection");
            }}
          >
            <Text style={[styles.quickActionToggleText, showQuickActions && styles.quickActionToggleTextActive]}>
              {showQuickActions ? "×" : "+"}
            </Text>
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Message your team..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendGroupMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.sendBtnIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ——— Main Chat List View ———

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mission Control</Text>
      </View>

      <View style={styles.missionSubFilterRow}>
          <TouchableOpacity
            style={[
              styles.missionSubFilterBtn,
              missionTimeFilter === "upcoming" && styles.missionSubFilterBtnActive,
            ]}
            onPress={() => {
              setMissionTimeFilter("upcoming");
              safeHaptic("selection");
            }}
          >
            <Text
              style={[
                styles.missionSubFilterText,
                missionTimeFilter === "upcoming" && styles.missionSubFilterTextActive,
              ]}
            >
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.missionSubFilterBtn,
              missionTimeFilter === "past" && styles.missionSubFilterBtnActive,
            ]}
            onPress={() => {
              setMissionTimeFilter("past");
              safeHaptic("selection");
            }}
          >
            <Text
              style={[
                styles.missionSubFilterText,
                missionTimeFilter === "past" && styles.missionSubFilterTextActive,
              ]}
            >
              Past
            </Text>
          </TouchableOpacity>
        </View>

      <View style={styles.sortSection}>
        <Text style={styles.sortSectionLabel}>Sort</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.missionSortChipScroll}
        >
          {MISSION_SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.missionSortChip,
                missionSort === opt.id && styles.missionSortChipActive,
              ]}
              onPress={() => {
                setMissionSort(opt.id);
                safeHaptic("selection");
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.missionSortChipText,
                  missionSort === opt.id && styles.missionSortChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.accent}
          />
        }
      >
        {chats.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["rgba(45, 212, 191, 0.15)", "transparent"]}
                style={styles.emptyGradientSmall}
              />
              <View style={styles.emptyIconContainer}>
                <Text style={{ fontSize: 56 }}>🎯</Text>
              </View>
              <Text style={styles.emptyTitle}>No missions yet</Text>
              <Text style={styles.emptySubtitle}>
                When you claim a shift, Mission Control will connect you with the venue team here.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/jobs")}>
                <Text style={styles.primaryBtnText}>Find Jobs</Text>
              </TouchableOpacity>
            </View>
          ) : sortedMissionChats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>📋</Text>
              <Text style={styles.emptyTitle}>
                {missionTimeFilter === "upcoming" ? "No upcoming missions" : "No past missions"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {missionTimeFilter === "upcoming"
                  ? "Completed jobs move to Past."
                  : "Upcoming and in-progress jobs stay under Upcoming."}
              </Text>
            </View>
          ) : (
            sortedMissionChats.map((chat, index) => {
              const venueName = chat.metadata?.venue_name || chat.name;
              const hasUnread = (chat.unread_count || 0) > 0;
              const isFromVenue =
                chat.last_message_sender_role === "owner" ||
                chat.last_message_sender_role === "venue";

              return (
                <TouchableOpacity
                  key={chat.id}
                  style={[
                    styles.chatCard,
                    index === 0 && styles.chatCardFirst,
                    hasUnread && styles.chatCardUnread,
                  ]}
                  onPress={() => selectChat(chat)}
                  activeOpacity={0.7}
                >
                  <View style={styles.chatCardIconContainer}>
                    <LinearGradient
                      colors={
                        hasUnread
                          ? ["rgba(168, 85, 247, 0.4)", "rgba(168, 85, 247, 0.2)"]
                          : ["rgba(168, 85, 247, 0.25)", "rgba(168, 85, 247, 0.1)"]
                      }
                      style={styles.chatCardIconBg}
                    />
                    <Text style={styles.chatCardInitials}>{getInitials(venueName)}</Text>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                  <View style={styles.chatCardInfo}>
                    <View style={styles.chatCardHeader}>
                      <Text
                        style={[styles.chatCardName, hasUnread && styles.chatCardNameUnread]}
                        numberOfLines={1}
                      >
                        {chat.name}
                      </Text>
                      <Text style={[styles.chatCardTime, hasUnread && styles.chatCardTimeUnread]}>
                        {formatLastSeen(chat.updated_at)}
                      </Text>
                    </View>
                    {chat.last_message ? (
                      <View style={styles.lastMessageRow}>
                        {isFromVenue && (
                          <View style={styles.venueMessageIndicator}>
                            <Text style={styles.venueMessageIndicatorText}>Venue</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.chatCardMeta,
                            hasUnread && styles.chatCardMetaUnread,
                            isFromVenue && styles.chatCardMetaVenue,
                          ]}
                          numberOfLines={1}
                        >
                          {chat.last_message}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.chatCardMeta} numberOfLines={1}>
                        {chat.event_date ? `📅 ${formatDate(chat.event_date)}` : "Active mission"}
                        {chat.metadata?.venue_name ? ` · ${chat.metadata.venue_name}` : ""}
                      </Text>
                    )}
                  </View>
                  {hasUnread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{chat.unread_count}</Text>
                    </View>
                  ) : (
                    <View style={styles.chatCardArrow}>
                      <Text style={styles.chatCardArrowText}>›</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
      </ScrollView>
    </View>
  );
}

// ——— Styles ———

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
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  sortSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sortSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  missionSortChipScroll: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 2,
  },
  missionSortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  missionSortChipActive: {
    borderColor: "rgba(45, 212, 191, 0.5)",
    backgroundColor: "rgba(45, 212, 191, 0.1)",
  },
  missionSortChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  missionSortChipTextActive: {
    color: colors.text,
  },
  newChatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatIcon: {
    fontSize: 20,
  },

  missionSubFilterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  missionSubFilterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  missionSubFilterBtnActive: {
    borderColor: "rgba(45, 212, 191, 0.45)",
    backgroundColor: "rgba(45, 212, 191, 0.08)",
  },
  missionSubFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  missionSubFilterTextActive: {
    color: colors.text,
  },

  // Chat List
  chatList: { flex: 1 },
  chatListContent: { padding: spacing.md, paddingBottom: 100 },
  
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chatCardFirst: {
    borderColor: "rgba(45, 212, 191, 0.3)",
  },
  chatCardUnread: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderWidth: 1.5,
  },
  chatCardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  chatCardIconBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  chatCardIcon: {
    fontSize: 24,
  },
  chatCardInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#A855F7",
  },
  missionIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#A855F7",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  chatCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  chatCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  chatCardNameUnread: {
    fontWeight: "700",
    color: colors.text,
  },
  chatCardTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chatCardTimeUnread: {
    color: "#A855F7",
    fontWeight: "600",
  },
  chatCardMeta: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  chatCardMetaUnread: {
    color: colors.text,
    fontWeight: "500",
  },
  chatCardMetaVenue: {
    color: "#A855F7",
  },
  lastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  venueMessageIndicator: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  venueMessageIndicatorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A855F7",
  },
  chatCardArrow: {
    paddingLeft: spacing.sm,
  },
  chatCardArrowText: {
    fontSize: 24,
    color: colors.textMuted,
    fontWeight: "300",
  },

  // DM Avatar
  dmAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dmAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dmAvatarText: {
    fontSize: 24,
  },
  dmAvatarInitials: {
    fontSize: 18,
    fontWeight: "700",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  dmPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dmRoleTag: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: "center",
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },

  // Empty States
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    borderRadius: 150,
  },
  emptyGradientSmall: {
    position: "absolute",
    top: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  emptyIconContainer: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
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
    marginBottom: spacing.lg,
  },
  emptyMessages: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
  },

  // Chat View Header
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
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
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  chatHeaderSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionBtnDisabled: {
    opacity: 0.4,
  },
  headerActionIcon: {
    fontSize: 20,
  },

  // Members Bar
  membersBar: {
    maxHeight: 70,
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingRight: spacing.md,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  memberChipOwner: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarOwner: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
  },
  memberAvatarText: {
    fontSize: 14,
  },
  memberChipName: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
    maxWidth: 100,
  },
  youBadge: {
    backgroundColor: "rgba(45, 212, 191, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.accent,
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
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  groupCallCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 212, 191, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.35)",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    gap: spacing.md,
  },
  groupCallTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  groupCallSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  groupCallJoinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  groupCallJoinBtnDisabled: {
    opacity: 0.5,
  },
  groupCallJoinBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#02120e",
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    maxWidth: "80%",
    alignSelf: "flex-start",
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowOwn: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  msgRowLocation: {
    maxWidth: "88%",
  },
  locationMsgWrap: {
    gap: 4,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarVenue: {
    borderColor: "rgba(168, 85, 247, 0.5)",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderWidth: 2,
  },
  msgAvatarOwner: {
    borderColor: "rgba(168, 85, 247, 0.3)",
    backgroundColor: "rgba(168, 85, 247, 0.1)",
  },
  msgAvatarText: {
    fontSize: 14,
  },
  msgAvatarInitials: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  msgAvatarInitialsVenue: {
    color: "#A855F7",
  },
  msgBubble: {
    padding: spacing.md,
    borderRadius: 18,
    maxWidth: "100%",
  },
  msgBubbleOwn: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  msgBubbleCheckin: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  msgBubbleVenue: {
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderColor: "rgba(168, 85, 247, 0.35)",
    borderWidth: 1.5,
  },
  msgSenderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  msgSenderName: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
  },
  msgSenderNameVenue: {
    color: "#A855F7",
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
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  msgContentOwn: {
    color: "#000",
  },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  msgTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  msgTimeOwn: {
    color: "rgba(0,0,0,0.5)",
  },
  msgReadStatus: {
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
    marginLeft: 4,
  },
  msgReadStatusPartial: {
    color: "rgba(0,0,0,0.6)",
  },
  msgReadStatusRead: {
    color: "#3B82F6",
    fontWeight: "600",
  },

  // Quick Actions
  quickActions: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickActionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },

  // Input Bar
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontSize: 24,
    color: colors.text,
    fontWeight: "300",
  },
  quickActionToggleTextActive: {
    color: "#000",
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    minHeight: 42,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnIcon: {
    fontSize: 20,
    color: "#000",
    fontWeight: "700",
  },
});
