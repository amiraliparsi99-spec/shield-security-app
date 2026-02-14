import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; category: string }[];
  feedback?: "helpful" | "not_helpful" | null;
}

const SUGGESTED_PROMPTS = {
  venue: [
    "How many security staff do I need?",
    "What are SIA requirements for my venue?",
    "How to handle aggressive customers?",
  ],
  agency: [
    "How to improve staff retention?",
    "What training should I provide?",
    "How to handle last-minute cancellations?",
  ],
  personnel: [
    "How to renew my SIA license?",
    "What skills should I develop?",
    "How can I get more shifts?",
  ],
};

// Local knowledge for offline/fallback
const KNOWLEDGE_BASE = {
  staffing: {
    title: "Security Staffing Guidelines",
    content: `**Recommended Ratios:**

• Low risk events: 1 per 100 guests
• Medium risk: 1 per 75 guests
• High risk: 1 per 50 guests
• Nightclubs: Min 2 + 1 per 100 capacity

**Factors increasing needs:**
• Alcohol served
• Standing room/dance floor
• History of incidents
• Multiple entry points`,
  },
  licensing: {
    title: "SIA License Information",
    content: `**License Types:**

• Door Supervisor (DS) - £190
• Security Guard (SG) - £190
• CCTV Operator - £190
• Close Protection - £220

**Process:**
1. Complete training (4-6 days)
2. Pass the exam
3. Apply at sia.homeoffice.gov.uk
4. Wait 4-6 weeks

**Validity:** 3 years
**Renewal:** Apply 8 weeks before expiry`,
  },
  incidents: {
    title: "Incident Handling",
    content: `**De-escalation (LEAPS):**

• Listen actively
• Empathize with frustration
• Ask questions
• Paraphrase to show understanding
• Summarize and offer solutions

**Documentation:**
• Date, time, exact location
• All persons involved
• Sequence of events (factual)
• Actions taken
• CCTV reference`,
  },
};

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm **Shield AI** 🛡️\n\nYour security operations assistant powered by our RAG knowledge base.\n\nI can help with SIA licensing, staffing ratios, incident management, and UK security regulations.\n\nWhat would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>("personnel");
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    initializeRole();
  }, []);

  const initializeRole = async () => {
    const { role: userRole } = await getProfileIdAndRole(supabase);
    if (userRole) setRole(userRole);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const getLocalResponse = (query: string): { content: string; source?: string } => {
    const lower = query.toLowerCase();
    
    if (lower.includes("staff") || lower.includes("how many") || lower.includes("ratio")) {
      return { content: KNOWLEDGE_BASE.staffing.content, source: KNOWLEDGE_BASE.staffing.title };
    }
    if (lower.includes("sia") || lower.includes("license") || lower.includes("licence")) {
      return { content: KNOWLEDGE_BASE.licensing.content, source: KNOWLEDGE_BASE.licensing.title };
    }
    if (lower.includes("incident") || lower.includes("aggressive") || lower.includes("conflict")) {
      return { content: KNOWLEDGE_BASE.incidents.content, source: KNOWLEDGE_BASE.incidents.title };
    }
    
    return {
      content: `**Shield AI** 🛡️

I can help with:

📋 **Operations** - Staffing, scheduling
📜 **Compliance** - SIA licensing, regulations
💼 **Business** - Best practices

Try asking:
• "How many security do I need?"
• "What are SIA requirements?"
• "How to handle incidents?"`,
    };
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    safeHaptic("light");
    scrollToBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          role,
          sessionId,
        }),
      });

      let aiResponse: Message;

      if (response.ok) {
        const data = await response.json();
        if (data.sessionId) setSessionId(data.sessionId);
        
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          sources: data.sources,
        };
      } else {
        // Fallback to local knowledge
        const local = getLocalResponse(userMessage.content);
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: local.content,
          sources: local.source ? [{ title: local.source, category: "local" }] : undefined,
        };
      }

      setMessages((prev) => [...prev, aiResponse]);
      safeHaptic("success");
    } catch (error) {
      // Use local fallback
      const local = getLocalResponse(userMessage.content);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: local.content,
          sources: local.source ? [{ title: local.source, category: "local" }] : undefined,
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback: helpful ? "helpful" : "not_helpful" } : m
      )
    );
    safeHaptic(helpful ? "success" : "light");
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    safeHaptic("selection");
  };

  const renderContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts: { text: string; bold: boolean }[] = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: line.slice(lastIndex, match.index), bold: false });
        }
        parts.push({ text: match[1], bold: true });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < line.length) {
        parts.push({ text: line.slice(lastIndex), bold: false });
      }
      if (parts.length === 0) {
        parts.push({ text: line, bold: false });
      }

      const isListItem = line.startsWith("• ") || line.startsWith("- ");
      const isNumberedItem = /^\d+\.\s/.test(line);

      if (!line.trim()) {
        return <View key={i} style={{ height: 8 }} />;
      }

      return (
        <Text
          key={i}
          style={[
            styles.messageText,
            isListItem && styles.listItem,
            isNumberedItem && styles.listItem,
          ]}
        >
          {parts.map((part, j) => (
            <Text key={j} style={part.bold ? styles.boldText : undefined}>
              {part.text}
            </Text>
          ))}
        </Text>
      );
    });
  };

  const prompts = SUGGESTED_PROMPTS[role as keyof typeof SUGGESTED_PROMPTS] || SUGGESTED_PROMPTS.personnel;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerIcon}>🛡️</Text>
          <View>
            <Text style={styles.title}>Shield AI</Text>
            <Text style={styles.subtitle}>RAG-Powered Assistant</Text>
          </View>
        </View>
        <View style={styles.statusDot} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View key={message.id}>
            <View
              style={[
                styles.messageBubble,
                message.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {message.role === "assistant" ? (
                <View>{renderContent(message.content)}</View>
              ) : (
                <Text style={styles.userMessageText}>{message.content}</Text>
              )}
            </View>

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                {message.sources.map((source, i) => (
                  <View key={i} style={styles.sourceTag}>
                    <Text style={styles.sourceText}>📚 {source.title.slice(0, 25)}...</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Feedback */}
            {message.role === "assistant" && message.id !== "welcome" && (
              <View style={styles.feedbackContainer}>
                {!message.feedback ? (
                  <>
                    <TouchableOpacity
                      style={styles.feedbackBtn}
                      onPress={() => handleFeedback(message.id, true)}
                    >
                      <Text style={styles.feedbackText}>👍 Helpful</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.feedbackBtn}
                      onPress={() => handleFeedback(message.id, false)}
                    >
                      <Text style={styles.feedbackText}>👎 Not helpful</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.feedbackThanks}>
                    <Text style={styles.feedbackThanksText}>✓ Thanks for feedback!</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching knowledge base</Text>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          </View>
        )}

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <View style={styles.suggestedContainer}>
            <Text style={styles.suggestedTitle}>Popular questions:</Text>
            {prompts.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestedBtn}
                onPress={() => handleSuggestedPrompt(prompt)}
              >
                <Text style={styles.suggestedText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about staffing, licensing, incidents..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Shield AI • Training our security-specific model
        </Text>
      </View>
    </KeyboardAvoidingView>
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
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIcon: {
    fontSize: 28,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  subtitle: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 11,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.sm,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  messageText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  boldText: {
    fontWeight: "700",
    color: colors.text,
  },
  listItem: {
    marginLeft: spacing.sm,
  },
  sourcesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  sourceTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
  },
  sourceText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  feedbackContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginLeft: spacing.xs,
    marginBottom: spacing.md,
  },
  feedbackBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
  },
  feedbackText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  feedbackThanks: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: radius.full,
  },
  feedbackThanksText: {
    fontSize: 10,
    color: "#10B981",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  suggestedContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestedTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  suggestedBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  suggestedText: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
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
  },
  sendBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  footer: {
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  footerText: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
