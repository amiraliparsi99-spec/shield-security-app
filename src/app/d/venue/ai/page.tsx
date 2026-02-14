"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  bookmarked?: boolean;
  attachments?: SavedFile[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  category?: string;
}

interface SavedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  category?: string;
}

interface SavedTopic {
  id: string;
  title: string;
  content: string;
  conversationId: string;
  createdAt: Date;
}

const popularQuestions = [
  { icon: "👥", text: "How many security staff do I need for my event?" },
  { icon: "📋", text: "What are my legal requirements for security?" },
  { icon: "💰", text: "How can I reduce security costs without compromising safety?" },
  { icon: "🎯", text: "What SIA license types do I need for my venue?" },
];

const fileCategories = [
  { id: "contracts", label: "Contracts", icon: "📄" },
  { id: "licenses", label: "Licenses & Certs", icon: "🛡️" },
  { id: "incidents", label: "Incident Reports", icon: "⚠️" },
  { id: "policies", label: "Policies", icon: "📋" },
  { id: "other", label: "Other", icon: "📁" },
];

export default function ShieldAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "files" | "saved">("chats");
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved data from localStorage
  useEffect(() => {
    const savedConvos = localStorage.getItem("shield_ai_conversations");
    const savedFilesData = localStorage.getItem("shield_ai_files");
    const savedTopicsData = localStorage.getItem("shield_ai_topics");
    
    if (savedConvos) setConversations(JSON.parse(savedConvos));
    if (savedFilesData) setSavedFiles(JSON.parse(savedFilesData));
    if (savedTopicsData) setSavedTopics(JSON.parse(savedTopicsData));
  }, []);

  // Save data to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("shield_ai_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    if (savedFiles.length > 0) {
      localStorage.setItem("shield_ai_files", JSON.stringify(savedFiles));
    }
  }, [savedFiles]);

  useEffect(() => {
    if (savedTopics.length > 0) {
      localStorage.setItem("shield_ai_topics", JSON.stringify(savedTopics));
    }
  }, [savedTopics]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && !activeConversation) {
      setMessages([{
        id: "greeting",
        role: "assistant",
        content: "Hi! I'm **Shield AI**, your security operations assistant. 🛡️\n\nI have access to comprehensive knowledge about SIA licensing, staffing guidelines, incident management, and UK security regulations.\n\nYou can also upload documents and I'll help you reference them. What would you like to know?",
        timestamp: new Date(),
      }]);
    }
  }, [activeConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

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

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          userRole: "venue",
          conversationHistory: messages.slice(-10),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMessage, assistantMessage];
      setMessages(newMessages);

      // Auto-save conversation
      if (activeConversation) {
        setConversations(prev => prev.map(c => 
          c.id === activeConversation 
            ? { ...c, messages: newMessages, updatedAt: new Date() }
            : c
        ));
      } else {
        // Create new conversation
        const newConvo: Conversation = {
          id: Date.now().toString(),
          title: messageText.slice(0, 40) + (messageText.length > 40 ? "..." : ""),
          messages: newMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setConversations(prev => [newConvo, ...prev]);
        setActiveConversation(newConvo.id);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setActiveConversation(null);
    setMessages([{
      id: "greeting",
      role: "assistant",
      content: "Hi! I'm **Shield AI**, your security operations assistant. 🛡️\n\nI have access to comprehensive knowledge about SIA licensing, staffing guidelines, incident management, and UK security regulations.\n\nWhat would you like to know?",
      timestamp: new Date(),
    }]);
  };

  const loadConversation = (convo: Conversation) => {
    setActiveConversation(convo.id);
    setMessages(convo.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })));
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversation === id) {
      startNewChat();
    }
  };

  const bookmarkMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    if (message.bookmarked) {
      // Remove from saved topics
      setSavedTopics(prev => prev.filter(t => t.id !== messageId));
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, bookmarked: false } : m
      ));
    } else {
      // Add to saved topics
      const newTopic: SavedTopic = {
        id: messageId,
        title: message.content.slice(0, 50) + "...",
        content: message.content,
        conversationId: activeConversation || "",
        createdAt: new Date(),
      };
      setSavedTopics(prev => [newTopic, ...prev]);
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, bookmarked: true } : m
      ));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const newFile: SavedFile = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        category: selectedCategory === "all" ? "other" : selectedCategory,
      };
      setSavedFiles(prev => [newFile, ...prev]);
    });

    setShowUploadModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deleteFile = (id: string) => {
    setSavedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = savedFiles.filter(f =>
    (selectedCategory === "all" || f.category === selectedCategory) &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <li key={i} className="ml-4" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />;
      }
      return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-black">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col border-r border-white/10 bg-zinc-950 overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/10">
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition mb-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
              
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: "chats", label: "Chats", icon: "💬" },
                { id: "files", label: "Files", icon: "📁" },
                { id: "saved", label: "Saved", icon: "⭐" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition ${
                    sidebarTab === tab.id
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {sidebarTab === "chats" && (
                <div className="space-y-1">
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                          activeConversation === conv.id
                            ? "bg-emerald-500/20 text-white"
                            : "hover:bg-white/5 text-zinc-400"
                        }`}
                        onClick={() => loadConversation(conv)}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{conv.title}</p>
                          <p className="text-xs text-zinc-600 truncate">
                            {new Date(conv.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition"
                        >
                          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-zinc-500 text-sm p-4">
                      {searchQuery ? "No matching conversations" : "No conversations yet"}
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "files" && (
                <div className="space-y-3">
                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-1 px-1">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`px-2 py-1 text-xs rounded-full transition ${
                        selectedCategory === "all"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      All
                    </button>
                    {fileCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2 py-1 text-xs rounded-full transition ${
                          selectedCategory === cat.id
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Upload Button */}
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/20 text-zinc-400 hover:text-white hover:border-emerald-500/50 transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload File
                  </button>

                  {/* Files List */}
                  {filteredFiles.length > 0 ? (
                    <div className="space-y-1">
                      {filteredFiles.map((file) => (
                        <div
                          key={file.id}
                          className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-sm">
                            {fileCategories.find(c => c.id === file.category)?.icon || "📄"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{file.name}</p>
                            <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => deleteFile(file.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition"
                          >
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500 text-sm p-4">
                      {searchQuery ? "No matching files" : "No files uploaded yet"}
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "saved" && (
                <div className="space-y-1">
                  {savedTopics.length > 0 ? (
                    savedTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="group px-3 py-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition cursor-pointer"
                        onClick={() => {
                          const convo = conversations.find(c => c.id === topic.conversationId);
                          if (convo) loadConversation(convo);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs text-zinc-500">
                            {new Date(topic.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 line-clamp-2">{topic.title}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-zinc-500 text-sm p-4">
                      <p>No saved topics yet</p>
                      <p className="text-xs mt-1">Click the ⭐ on any response to save it</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Footer Stats */}
            <div className="p-3 border-t border-white/10 bg-zinc-950">
              <div className="flex items-center justify-around text-center">
                <div>
                  <p className="text-lg font-bold text-white">{conversations.length}</p>
                  <p className="text-xs text-zinc-500">Chats</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{savedFiles.length}</p>
                  <p className="text-xs text-zinc-500">Files</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{savedTopics.length}</p>
                  <p className="text-xs text-zinc-500">Saved</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <span className="text-lg">🛡️</span>
              </div>
              <div>
                <h1 className="text-white font-semibold">Shield AI</h1>
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  RAG Enabled • Security Expert
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length <= 1 && !activeConversation && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white text-center mb-2">
                  What can I help you with?
                </h2>
                <p className="text-zinc-400 text-center mb-8">
                  Ask me anything about security operations. Your conversations are automatically saved.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {popularQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q.text)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-white/20 transition text-left group"
                    >
                      <span className="text-xl">{q.icon}</span>
                      <span className="text-sm text-zinc-300 group-hover:text-white transition">
                        {q.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      message.role === "user" 
                        ? "bg-purple-500/20" 
                        : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                    }`}>
                      {message.role === "user" ? (
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <span className="text-sm">🛡️</span>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className={`rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-purple-500/20 text-white"
                          : "bg-zinc-900 text-zinc-100 border border-white/10"
                      }`}>
                        <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                          {renderContent(message.content)}
                        </div>
                      </div>
                      
                      {/* Message Actions */}
                      <div className={`flex items-center gap-2 mt-1 ${message.role === "user" ? "justify-end" : ""}`}>
                        <span className="text-xs text-zinc-600">
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {message.role === "assistant" && message.id !== "greeting" && (
                          <>
                            <button
                              onClick={() => bookmarkMessage(message.id)}
                              className={`p-1 rounded transition ${
                                message.bookmarked 
                                  ? "text-amber-400" 
                                  : "text-zinc-600 hover:text-amber-400"
                              }`}
                              title={message.bookmarked ? "Remove from saved" : "Save this response"}
                            >
                              <svg className="w-4 h-4" fill={message.bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(message.content)}
                              className="p-1 rounded text-zinc-600 hover:text-white transition"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <span className="text-sm">🛡️</span>
                    </div>
                    <div className="rounded-2xl bg-zinc-900 border border-white/10 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                        </div>
                        <span className="text-sm text-zinc-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-zinc-950 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 rounded-2xl border border-white/20 bg-zinc-900 p-2 focus-within:border-emerald-500/50 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Shield AI anything..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-white placeholder-zinc-500 focus:outline-none text-sm max-h-[200px]"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-600">
              Conversations auto-save • Click ⭐ to bookmark important answers
            </p>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Upload File</h3>
                <p className="text-sm text-zinc-400">Add documents for reference</p>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {fileCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition ${
                          selectedCategory === cat.id
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                            : "bg-zinc-800 text-zinc-400 border border-transparent hover:text-white"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="text-sm">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 transition"
                >
                  <svg className="w-12 h-12 text-zinc-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-white font-medium mb-1">Click to upload</p>
                  <p className="text-sm text-zinc-500">PDF, DOC, DOCX, TXT up to 10MB</p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
