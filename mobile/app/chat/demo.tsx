import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";

type DemoMessage = {
  id: string;
  content: string;
  isMe: boolean;
  time: string;
};

// Demo conversation data
const DEMO_THREADS: Record<string, { name: string; role: string; messages: DemoMessage[] }> = {
  'demo-1': {
    name: "The Grand Venue",
    role: "venue",
    messages: [
      { id: '1', content: "Hi there! We're looking for 3 door supervisors for this Saturday night.", isMe: false, time: "10:30" },
      { id: '2', content: "The event runs from 9pm to 3am. Are you available?", isMe: false, time: "10:31" },
      { id: '3', content: "Hi! Yes, I'm available on Saturday. What's the rate?", isMe: true, time: "10:45" },
      { id: '4', content: "Great! We're offering £18/hour. The venue is in central Birmingham.", isMe: false, time: "10:47" },
      { id: '5', content: "Sounds good to me. I'll need the full address and any dress code requirements.", isMe: true, time: "10:50" },
      { id: '6', content: "Perfect! I'll send over all the details shortly. Thanks for getting back so quickly! 🙌", isMe: false, time: "10:52" },
    ],
  },
  'demo-2': {
    name: "Elite Security Agency",
    role: "agency",
    messages: [
      { id: '1', content: "Hi! Your application to join our team has been approved.", isMe: false, time: "14:00" },
      { id: '2', content: "We have a shift available for you this Friday.", isMe: false, time: "14:01" },
      { id: '3', content: "That's great news! What are the shift details?", isMe: true, time: "14:15" },
      { id: '4', content: "Friday 8pm-2am at Club Neon. Door supervisor role. £20/hr.", isMe: false, time: "14:18" },
      { id: '5', content: "I'm interested. Do I need to bring anything specific?", isMe: true, time: "14:20" },
      { id: '6', content: "Just your SIA badge and ID. We'll provide the uniform.", isMe: false, time: "14:22" },
      { id: '7', content: "Your shift has been confirmed for Friday 8pm-2am ✅", isMe: false, time: "14:30" },
    ],
  },
  'demo-3': {
    name: "Marcus Webb",
    role: "personnel",
    messages: [
      { id: '1', content: "Hey! Thanks so much for covering my shift last week!", isMe: false, time: "18:00" },
      { id: '2', content: "No problem at all! Hope everything was okay?", isMe: true, time: "18:05" },
      { id: '3', content: "Yeah, family emergency but all sorted now. I owe you one!", isMe: false, time: "18:07" },
      { id: '4', content: "Glad to hear it's sorted. Let me know if you ever need cover again.", isMe: true, time: "18:10" },
      { id: '5', content: "Will do! Maybe we can work together on a big event sometime 💪", isMe: false, time: "18:12" },
      { id: '6', content: "Thanks for covering my shift last week! 🙏", isMe: false, time: "18:15" },
    ],
  },
  'demo-4': {
    name: "Nightwatch Security",
    role: "agency",
    messages: [
      { id: '1', content: "Hi, we noticed your SIA license is expiring next month.", isMe: false, time: "09:00" },
      { id: '2', content: "Could you please send us your updated license once renewed?", isMe: false, time: "09:01" },
      { id: '3', content: "Thanks for the reminder! I'll get it renewed this week.", isMe: true, time: "09:30" },
      { id: '4', content: "Great, just upload it to your profile when ready.", isMe: false, time: "09:32" },
      { id: '5', content: "Please send your updated SIA license", isMe: false, time: "09:35" },
    ],
  },
  'demo-5': {
    name: "Club Neon",
    role: "venue",
    messages: [
      { id: '1', content: "Thanks for working with us last weekend!", isMe: false, time: "11:00" },
      { id: '2', content: "You handled that situation really professionally.", isMe: false, time: "11:01" },
      { id: '3', content: "Thank you! Your team was great to work with too.", isMe: true, time: "11:15" },
      { id: '4', content: "We'd love to have you back. Are you free next Saturday?", isMe: false, time: "11:17" },
      { id: '5', content: "Yes, I'm available! Same time?", isMe: true, time: "11:20" },
      { id: '6', content: "Perfect! I'll send the booking confirmation shortly.", isMe: false, time: "11:22" },
      { id: '7', content: "Great work tonight. See you next weekend! ⭐", isMe: false, time: "03:15" },
    ],
  },
};

export default function DemoChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = typeof id === 'string' ? id : 'demo-1';
  const thread = DEMO_THREADS[threadId] || DEMO_THREADS['demo-1'];
  
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<DemoMessage[]>(thread.messages);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    const newMessage: DemoMessage = {
      id: `new-${Date.now()}`,
      content: inputText.trim(),
      isMe: true,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages([...messages, newMessage]);
    setInputText('');
    
    // Simulate reply after 1.5 seconds
    setTimeout(() => {
      const replies = [
        "Thanks for your message! I'll get back to you shortly.",
        "Got it! 👍",
        "Sure thing, let me check on that.",
        "Great, I'll confirm the details soon.",
        "Perfect, thanks for letting me know!",
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      
      setMessages(prev => [...prev, {
        id: `reply-${Date.now()}`,
        content: randomReply,
        isMe: false,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1500);
  };

  const handleCall = () => {
    router.push(`/call/demo?name=${encodeURIComponent(thread.name)}&role=${thread.role}`);
  };

  const getRoleIcon = () => {
    switch (thread.role) {
      case 'venue': return '🏢';
      case 'agency': return '🏛️';
      case 'personnel': return '🛡️';
      default: return '👤';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getRoleIcon()}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{thread.name}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={handleCall} style={styles.callBtn}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.videoBtn}>
          <Text style={styles.videoBtnText}>📹</Text>
        </TouchableOpacity>
      </View>

      {/* Demo Banner */}
      <View style={styles.demoBanner}>
        <Text style={styles.demoBannerText}>Demo Chat - Messages are simulated</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.isMe && styles.messageRowMe]}>
            <View style={[styles.messageBubble, item.isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={styles.messageText}>{item.content}</Text>
              <Text style={[styles.messageTime, item.isMe && styles.messageTimeMe]}>{item.time}</Text>
            </View>
          </View>
        )}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn}>
            <Text style={styles.attachBtnText}>+</Text>
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
          />
          
          {inputText.trim() ? (
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn}>
              <Text style={styles.micBtnText}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 24,
    color: colors.accent,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerAvatarText: {
    fontSize: 20,
  },
  headerName: {
    ...typography.titleCard,
    color: colors.text,
  },
  headerStatus: {
    ...typography.caption,
    color: colors.success,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtnText: {
    fontSize: 22,
  },
  videoBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBtnText: {
    fontSize: 22,
  },
  demoBanner: {
    backgroundColor: colors.warningSoft,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  demoBannerText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
  },
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageRow: {
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  messageRowMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleMe: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
  },
  messageTime: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: colors.text + 'AA',
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  attachBtnText: {
    fontSize: 24,
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnText: {
    fontSize: 18,
    color: colors.text,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  micBtnText: {
    fontSize: 18,
  },
});
