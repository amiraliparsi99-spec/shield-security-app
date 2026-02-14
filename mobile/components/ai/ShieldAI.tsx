import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { colors, typography, spacing, radius } from "../../theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
}

const quickActions: QuickAction[] = [
  { label: "Find shifts", prompt: "Help me find available shifts in my area", icon: "🔍" },
  { label: "My earnings", prompt: "Show me my earnings summary", icon: "💰" },
  { label: "Improve profile", prompt: "How can I improve my profile to get more bookings?", icon: "✨" },
  { label: "Help", prompt: "What can you help me with?", icon: "❓" },
];

interface ShieldAIProps {
  visible: boolean;
  onClose: () => void;
  userRole?: "venue" | "personnel" | "agency";
  userName?: string;
}

export function ShieldAI({ visible, onClose, userRole = "personnel", userName }: ShieldAIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      const greeting = getGreeting();
      setMessages([{
        id: "greeting",
        role: "assistant",
        content: greeting,
        timestamp: new Date(),
      }]);
    }
  }, [visible, userRole, userName]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const getGreeting = () => {
    const name = userName ? `, ${userName}` : "";
    const roleGreetings: Record<string, string> = {
      venue: `Hi${name}! 👋 I'm Shield AI.\n\nI can help you find and book security staff, answer questions, and more.\n\nWhat do you need help with?`,
      personnel: `Hi${name}! 👋 I'm Shield AI.\n\nI can help you find shifts, track earnings, optimize your profile, and more.\n\nHow can I help you today?`,
      agency: `Hi${name}! 👋 I'm Shield AI.\n\nI can help you manage staff, find backup personnel, and optimize your agency operations.\n\nWhat would you like to know?`,
    };
    return roleGreetings[userRole] || roleGreetings.personnel;
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // For mobile, we'll use a simple fetch to the API
      // In production, you'd want to configure the correct API URL
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      
      const response = await fetch(`${apiUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          userRole,
          conversationHistory: messages.slice(-10),
        }),
      });

      let assistantContent = "I'm having trouble connecting right now. Please try again.";
      
      if (response.ok) {
        const data = await response.json();
        assistantContent = data.message;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Fallback response for offline/error cases
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getFallbackResponse(messageText),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackResponse = (message: string): string => {
    const lower = message.toLowerCase();
    
    if (lower.includes("earning") || lower.includes("money")) {
      return "💰 To check your earnings, go to the Payments tab in your dashboard. You'll see your balance and can request a payout anytime!";
    }
    if (lower.includes("profile")) {
      return "✨ To improve your profile:\n\n1. Add a professional photo\n2. List all your certifications\n3. Write a detailed bio\n4. Keep your availability updated\n\nComplete profiles get 3x more bookings!";
    }
    if (lower.includes("shift") || lower.includes("find")) {
      return "🔍 To find shifts:\n\n1. Go to the Explore tab\n2. Browse available opportunities\n3. Tap on any shift to see details\n4. Apply with one tap\n\nMake sure your availability is up to date!";
    }
    
    return "I can help you with finding shifts, tracking earnings, optimizing your profile, and more. What would you like to know?";
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt);
  };

  const clearChat = () => {
    setMessages([{
      id: "greeting",
      role: "assistant",
      content: getGreeting(),
      timestamp: new Date(),
    }]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>🤖</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Shield AI</Text>
              <Text style={styles.headerSubtitle}>Your intelligent assistant</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={clearChat} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.role === "user" ? styles.userMessageWrapper : styles.assistantMessageWrapper,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.role === "user" ? styles.userText : styles.assistantText,
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.role === "user" ? styles.userTime : styles.assistantTime,
                ]}>
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))}

          {isLoading && (
            <View style={[styles.messageWrapper, styles.assistantMessageWrapper]}>
              <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <View style={styles.quickActionsContainer}>
            <Text style={styles.quickActionsLabel}>Quick actions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickActionsRow}>
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={styles.quickActionButton}
                    onPress={() => handleQuickAction(action)}
                  >
                    <Text style={styles.quickActionIcon}>{action.icon}</Text>
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Shield AI anything..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Shield AI can make mistakes. Verify important information.
        </Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Floating AI Button for mobile
export function ShieldAIButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.floatingButton} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.floatingButtonText}>🤖</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.accent,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiIconText: {
    fontSize: 20,
  },
  headerTitle: {
    ...typography.titleCard,
    color: "#fff",
  },
  headerSubtitle: {
    ...typography.caption,
    color: "rgba(255,255,255,0.7)",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerButtonText: {
    ...typography.caption,
    color: "#fff",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#fff",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  messageWrapper: {
    marginBottom: spacing.sm,
  },
  userMessageWrapper: {
    alignItems: "flex-end",
  },
  assistantMessageWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.accent,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  messageText: {
    ...typography.body,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: colors.text,
  },
  messageTime: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  userTime: {
    color: "rgba(255,255,255,0.6)",
  },
  assistantTime: {
    color: colors.textMuted,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  quickActionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 14,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.text,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingBottom: spacing.lg,
  },
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    fontSize: 24,
  },
});
