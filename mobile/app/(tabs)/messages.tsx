/**
 * Messages Tab - Redesigned with Mission Control + Direct Messages
 * 
 * Two sections:
 * 1. Mission Control - Group chats for active shifts/bookings
 * 2. Direct Messages - 1:1 conversations with venues, agencies, guards
 */

import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

interface DirectConversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  other_user?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    role: "venue" | "personnel" | "agency";
  };
  unread_count?: number;
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
  conversation_id?: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, any>;
  created_at: string;
  delivered_at?: string;
  read_by?: string[];
}

interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at?: string;
  delivered_at?: string;
  created_at: string;
}

type TabType = "mission" | "direct";

export default function MessagesTab() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { initiateCall, callState } = useCall();
  const { hideTabBar, showTabBar } = useTabBar();
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("mission");
  const { refreshUnreadCount } = useUnreadMessages();

  // Mission Control (Group Chats)
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Track completed report shift IDs
  const [completedReportShiftIds, setCompletedReportShiftIds] = useState<Set<string>>(new Set());

  // Direct Messages
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);

  // Shared
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Animate tab indicator
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === "mission" ? 0 : 1,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [activeTab]);

  // Hide/show tab bar based on active chat
  useEffect(() => {
    if (activeChat || activeConversation) {
      hideTabBar();
    } else {
      showTabBar();
    }
  }, [activeChat, activeConversation, hideTabBar, showTabBar]);

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

      // Load direct conversations
      const { data: convos } = await supabase
        .from("direct_conversations")
        .select("*")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      if (convos && convos.length > 0) {
        // Get other user details for each conversation
        const otherUserIds = convos.map((c: DirectConversation) =>
          c.participant_1 === user.id ? c.participant_2 : c.participant_1
        );

        // Try to get profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, role")
          .in("id", otherUserIds);

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

        const enrichedConvos = convos.map((c: DirectConversation) => {
          const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
          const profile = profileMap.get(otherId);
          return {
            ...c,
            other_user: profile ? {
              id: profile.id,
              display_name: profile.display_name || "Unknown",
              avatar_url: profile.avatar_url,
              role: profile.role || "personnel",
            } : {
              id: otherId,
              display_name: "Unknown User",
              avatar_url: null,
              role: "personnel" as const,
            },
          };
        });

        setConversations(enrichedConvos);
      } else {
        setConversations([]);
      }
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

  // ——— Direct Message Functions ———

  const selectConversation = async (convo: DirectConversation) => {
    if (!supabase) return;
    safeHaptic("selection");
    setActiveConversation(convo);
    setDirectMessages([]);

    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true })
      .limit(100);

    setDirectMessages(msgs || []);

    // Mark as read with read_at timestamp
    if (userId) {
      await supabase
        .from("direct_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("conversation_id", convo.id)
        .neq("sender_id", userId)
        .eq("is_read", false);
      
      // Refresh the tab bar badge
      refreshUnreadCount();
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 200);
  };

  // Subscribe to new direct messages and updates (for read receipts)
  useEffect(() => {
    if (!activeConversation || !supabase) return;

    const channel = supabase
      .channel(`direct_convo:${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as DirectMessage;
          setDirectMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          
          // Mark incoming messages as read immediately since we're viewing the chat
          if (userId && newMsg.sender_id !== userId) {
            supabase
              .from("direct_messages")
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq("id", newMsg.id)
              .then(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          // Update read status for messages (for read receipts)
          const updatedMsg = payload.new as DirectMessage;
          setDirectMessages((prev) =>
            prev.map((m) => m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read, read_at: updatedMsg.read_at } : m)
          );
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [activeConversation, userId]);

  // Send direct message
  const handleSendDirectMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !supabase || !userId || sending) return;

    safeHaptic("medium");
    setSending(true);

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: activeConversation.id,
      sender_id: userId,
      content: newMessage.trim(),
      is_read: false,
    });

    if (error) {
      Alert.alert("Error", "Failed to send message");
    } else {
      setNewMessage("");
      await supabase
        .from("direct_conversations")
        .update({
          last_message: newMessage.trim(),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeConversation.id);
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

  const handleCallFromDM = () => {
    if (!activeConversation?.other_user || callState !== "idle") return;

    Alert.alert(
      "Call",
      `Call ${activeConversation.other_user.display_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: () => {
            safeHaptic("medium");
            initiateCall({
              userId: activeConversation.other_user!.id,
              name: activeConversation.other_user!.display_name,
              role: activeConversation.other_user!.role,
            });
          },
        },
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
            <View style={styles.chatHeaderTitleRow}>
              <View style={styles.missionBadge}>
                <Text style={styles.missionBadgeText}>MISSION</Text>
              </View>
            </View>
            <Text style={styles.chatHeaderTitle} numberOfLines={1}>{activeChat.name}</Text>
            <Text style={styles.chatHeaderSub}>
              {members.length} team member{members.length !== 1 ? "s" : ""}
              {activeChat.event_date ? ` · ${formatDate(activeChat.event_date)}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.headerActionBtn, callState !== "idle" && styles.headerActionBtnDisabled]}
            onPress={handleCallFromChat}
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

            return (
              <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
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
                    styles.msgBubble,
                    isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther,
                    isCheckin && styles.msgBubbleCheckin,
                    !isOwn && isFromVenueOrAgency && styles.msgBubbleVenue,
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
                  <Text style={[styles.msgContent, isOwn && styles.msgContentOwn]}>{msg.content}</Text>
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

  // ——— Active Direct Conversation View ———

  if (activeConversation) {
    const otherUser = activeConversation.other_user;
    
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* DM Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => { setActiveConversation(null); safeHaptic("selection"); }}
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={[
            styles.dmHeaderAvatar,
            { borderColor: getRoleColor(otherUser?.role || "personnel"), backgroundColor: `${getRoleColor(otherUser?.role || "personnel")}20` }
          ]}>
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.dmHeaderAvatarImg} />
            ) : (
              <Text style={[styles.dmHeaderAvatarInitials, { color: getRoleColor(otherUser?.role || "personnel") }]}>
                {getInitials(otherUser?.display_name)}
              </Text>
            )}
          </View>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderTitle} numberOfLines={1}>
              {otherUser?.display_name || "Unknown"}
            </Text>
            <View style={styles.dmRoleBadge}>
              <View style={[styles.dmRoleDot, { backgroundColor: getRoleColor(otherUser?.role || "personnel") }]} />
              <Text style={styles.dmRoleText}>
                {otherUser?.role === "venue" ? "Venue Manager" : otherUser?.role === "agency" ? "Agency" : "Security Guard"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.headerActionBtn, callState !== "idle" && styles.headerActionBtnDisabled]}
            onPress={handleCallFromDM}
            disabled={callState !== "idle"}
          >
            <Text style={styles.headerActionIcon}>📞</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={directMessages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isOwn = msg.sender_id === userId;
            const isFromVenueOrAgency = !isOwn && isVenueOrAgency(otherUser?.role || "personnel");
            const roleColor = getRoleColor(otherUser?.role || "personnel");

            // For DMs: delivered = has delivered_at, read = is_read
            const isDelivered = !!msg.delivered_at;
            const isRead = msg.is_read;

            return (
              <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
                {!isOwn && (
                  <View style={[
                    styles.msgAvatar,
                    { borderColor: roleColor, backgroundColor: `${roleColor}20` }
                  ]}>
                    <Text style={[styles.msgAvatarInitials, { color: roleColor }]}>
                      {getInitials(otherUser?.display_name)}
                    </Text>
                  </View>
                )}
                <View style={[
                  styles.msgBubble,
                  isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther,
                  isFromVenueOrAgency && styles.msgBubbleVenue
                ]}>
                  <Text style={[styles.msgContent, isOwn && styles.msgContentOwn]}>{msg.content}</Text>
                  <View style={styles.msgMeta}>
                    <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isOwn && (
                      <Text style={[
                        styles.msgReadStatus,
                        isRead && styles.msgReadStatusRead,
                        isDelivered && !isRead && styles.msgReadStatusPartial,
                      ]}>
                        {isRead ? "✓✓" : isDelivered ? "✓✓" : "✓"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={{ fontSize: 48 }}>👋</Text>
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySubtitle}>Send your first message</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.inputWrapper, { flex: 1 }]}>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendDirectMessage}
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

  const tabIndicatorTranslate = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (SCREEN_WIDTH - 32) / 2],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Mission Control List */}
        {chats.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["rgba(45, 212, 191, 0.15)", "transparent"]}
                style={styles.emptyGradientSmall}
              />
              <View style={styles.emptyIconContainer}>
                <Text style={{ fontSize: 56 }}>🎯</Text>
              </View>
              <Text style={styles.emptyTitle}>No Active Missions</Text>
              <Text style={styles.emptySubtitle}>
                When you claim a shift, Mission Control will connect you with the venue team here.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push("/jobs")}
              >
                <Text style={styles.primaryBtnText}>Find Jobs</Text>
              </TouchableOpacity>
            </View>
          ) : (
            chats.map((chat, index) => {
              const venueName = chat.metadata?.venue_name || chat.name;
              const hasUnread = (chat.unread_count || 0) > 0;
              const isFromVenue = chat.last_message_sender_role === "owner" || chat.last_message_sender_role === "venue";
              
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
                      colors={hasUnread 
                        ? ["rgba(168, 85, 247, 0.4)", "rgba(168, 85, 247, 0.2)"]
                        : ["rgba(168, 85, 247, 0.25)", "rgba(168, 85, 247, 0.1)"]}
                      style={styles.chatCardIconBg}
                    />
                    <Text style={styles.chatCardInitials}>{getInitials(venueName)}</Text>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                  <View style={styles.chatCardInfo}>
                    <View style={styles.chatCardHeader}>
                      <Text style={[styles.chatCardName, hasUnread && styles.chatCardNameUnread]} numberOfLines={1}>
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
                        <Text style={[
                          styles.chatCardMeta,
                          hasUnread && styles.chatCardMetaUnread,
                          isFromVenue && styles.chatCardMetaVenue,
                        ]} numberOfLines={1}>
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
          )
        }
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

  // Tab Switcher
  tabContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
    position: "relative",
  },
  tabIndicator: {
    position: "absolute",
    top: 4,
    left: 4,
    width: "50%",
    height: "100%",
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    zIndex: 1,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
  },
  tabBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
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
  chatHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  missionBadge: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 1,
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

  // DM Header
  dmHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dmHeaderAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  dmHeaderAvatarText: {
    fontSize: 22,
  },
  dmHeaderAvatarInitials: {
    fontSize: 16,
    fontWeight: "700",
  },
  dmRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  dmRoleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dmRoleText: {
    fontSize: 12,
    color: colors.textMuted,
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
