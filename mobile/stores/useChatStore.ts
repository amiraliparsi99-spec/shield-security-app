import { create } from "zustand";

export interface GroupChatSummary {
  id: string;
  name: string;
  booking_id: string | null;
  venue_id: string | null;
  chat_type: string;
  is_active: boolean;
  event_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: string;
  last_message_sender?: string;
  last_message_sender_role?: string;
}

export interface DirectConversationSummary {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  other_user?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    role: "venue" | "personnel" | "agency";
  };
  unread_count?: number;
}

export interface ChatMessageSummary {
  id: string;
  group_chat_id?: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  delivered_at?: string;
  read_by?: string[];
}

interface ChatState {
  groupChats: GroupChatSummary[];
  directConversations: DirectConversationSummary[];
  activeGroupChatId: string | null;
  activeConversationId: string | null;
  messages: ChatMessageSummary[];
  unreadTotal: number;
  setGroupChats: (chats: GroupChatSummary[]) => void;
  setDirectConversations: (convs: DirectConversationSummary[]) => void;
  setActiveGroupChat: (id: string | null) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: ChatMessageSummary[]) => void;
  setUnreadTotal: (n: number) => void;
  clearActive: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groupChats: [],
  directConversations: [],
  activeGroupChatId: null,
  activeConversationId: null,
  messages: [],
  unreadTotal: 0,

  setGroupChats: (groupChats) => set({ groupChats }),

  setDirectConversations: (directConversations) => set({ directConversations }),

  setActiveGroupChat: (activeGroupChatId) =>
    set({ activeGroupChatId, activeConversationId: null }),

  setActiveConversation: (activeConversationId) =>
    set({ activeConversationId, activeGroupChatId: null }),

  setMessages: (messages) => set({ messages }),

  setUnreadTotal: (unreadTotal) => set({ unreadTotal }),

  clearActive: () =>
    set({
      activeGroupChatId: null,
      activeConversationId: null,
      messages: [],
    }),
}));
