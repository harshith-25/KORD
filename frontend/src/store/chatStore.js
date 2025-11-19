import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { useSocketStore } from "./socketStore";
import { useConversationStore } from "./conversationStore";
import { useMessageStore } from "./messageStore";

export const useChatStore = create((set, get) => ({
  selectedChatId: null,
  error: null,
  typingUsers: new Map(), // { conversationId: Set([userId1, userId2]) }
  onlineUsers: [],

  // Core Getters
  isAuthenticated: () => {
    return useAuthStore.getState().isAuthenticated;
  },

  set: (newState) => set(newState),

  initializeSocket: () => {
    const socketStore = useSocketStore.getState();
    const socket = socketStore.initializeSocket();

    if (socket) {
      get().setupChatSocketListeners();
    }

    return socket;
  },

  setupChatSocketListeners: () => {
    const socketStore = useSocketStore.getState();
    const messageStore = useMessageStore.getState();
    const conversationStore = useConversationStore.getState();
    const currentUser = useAuthStore.getState().user;

    // Message events
    socketStore.onReceiveMessage((message) => {
      console.log("📨 Received message:", message);
      const conversationId = message.conversationId;

      // Skip messages from current user to prevent duplicates
      if (currentUser?._id === (message.sender?._id || message.sender)) {
        console.log("Skipping own message to prevent duplicate");
        return;
      }

      if (conversationId) {
        // Transform message to match frontend format
        const transformedMessage = {
          id: message._id?.toString() || message.id,
          _id: message._id,
          conversationId: conversationId,
          sender: message.sender,
          senderId: message.sender?._id || message.sender,
          content: message.content || "",
          text: message.content || "",
          type: "received",
          createdAt:
            message.timestamp || message.createdAt || new Date().toISOString(),
          time:
            message.timestamp || message.createdAt || new Date().toISOString(),
          status: "received",
          readBy: message.readBy || [],
          media: message.media,
          metadata: message.metadata,
          deliveryStatus: message.deliveryStatus,
        };

        messageStore.addMessage(conversationId, transformedMessage);

        // Update contact last message and increment unread
        const displayMessage = message.media
          ? `📎 ${
              message.type === "image"
                ? "Image"
                : message.type === "video"
                ? "Video"
                : "File"
            }`
          : message.content;

        conversationStore.updateContactLastMessage(
          conversationId,
          displayMessage,
          transformedMessage.time
        );

        // Only increment unread count if this isn't the currently selected chat
        if (get().selectedChatId !== conversationId) {
          conversationStore.incrementUnreadCount(conversationId);
        }
      }
    });

    // Read receipt events
    socketStore.onMessageRead(({ messageId, readerId }) => {
      console.log("📖 Message read:", { messageId, readerId });

      useMessageStore.setState((state) => {
        const updatedMessages = { ...state.messages };

        Object.keys(updatedMessages).forEach((conversationId) => {
          updatedMessages[conversationId] = updatedMessages[conversationId].map(
            (msg) => {
              if (msg._id === messageId || msg.id === messageId) {
                const readBy = msg.readBy || [];
                if (!readBy.find((r) => (r.user || r) === readerId)) {
                  return {
                    ...msg,
                    readBy: [
                      ...readBy,
                      { user: readerId, readAt: new Date().toISOString() },
                    ],
                    status: msg.type === "sent" ? "read" : msg.status,
                  };
                }
              }
              return msg;
            }
          );
        });

        return { ...state, messages: updatedMessages };
      });
    });

    // Typing events
    socketStore.onTyping(({ userId, conversationId }) => {
      get().handleTypingStart(userId, conversationId);
    });

    socketStore.onStopTyping(({ userId, conversationId }) => {
      get().handleTypingStop(userId, conversationId);
    });

    // User status events
    socketStore.onUserStatusUpdate(({ userId, status }) => {
      set((state) => {
        let updatedOnlineUsers = [...state.onlineUsers];
        if (status === "online") {
          if (!updatedOnlineUsers.includes(userId)) {
            updatedOnlineUsers.push(userId);
          }
        } else {
          updatedOnlineUsers = updatedOnlineUsers.filter((id) => id !== userId);
        }

        // Update contact participants in conversation store
        useConversationStore.setState((convState) => ({
          contacts: convState.contacts.map((contact) => {
            const updatedParticipants = contact.participants?.map((p) => ({
              ...p,
              isOnline: p._id === userId ? status === "online" : p.isOnline,
            }));
            return updatedParticipants
              ? { ...contact, participants: updatedParticipants }
              : contact;
          }),
        }));

        return { onlineUsers: updatedOnlineUsers };
      });
    });

    // Conversation events
    socketStore.onConversationUpdated(({ conversationId, updatedInfo }) => {
      useConversationStore.setState((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? { ...contact, ...updatedInfo }
            : contact
        ),
      }));
    });

    socketStore.onParticipantJoined(({ conversationId, newParticipant }) => {
      useConversationStore.setState((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                participants: [...(contact.participants || []), newParticipant],
                memberCount: (contact.memberCount || 0) + 1,
              }
            : contact
        ),
      }));
    });

    socketStore.onParticipantLeft(({ conversationId, participantId }) => {
      useConversationStore.setState((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                participants: (contact.participants || []).filter(
                  (p) => p._id !== participantId
                ),
                memberCount: Math.max((contact.memberCount || 1) - 1, 0),
              }
            : contact
        ),
      }));
    });
  },

  // Socket Utility Emitters
  joinConversation: (conversationId) => {
    const socketStore = useSocketStore.getState();
    socketStore.joinConversation(conversationId);
  },

  leaveConversation: (conversationId) => {
    const socketStore = useSocketStore.getState();
    socketStore.leaveConversation(conversationId);
  },

  startTyping: (conversationId) => {
    const socketStore = useSocketStore.getState();
    const currentUser = useAuthStore.getState().user;
    if (currentUser?._id) {
      socketStore.emitTyping(conversationId, currentUser._id);
    }
  },

  stopTyping: (conversationId) => {
    const socketStore = useSocketStore.getState();
    const currentUser = useAuthStore.getState().user;
    if (currentUser?._id) {
      socketStore.emitStopTyping(conversationId, currentUser._id);
    }
  },

  markMessageAsRead: (messageId, conversationId) => {
    const socketStore = useSocketStore.getState();
    socketStore.markMessageAsRead(messageId, conversationId);
  },

  markConversationAsRead: (conversationId) => {
    const messages = useMessageStore
      .getState()
      .getMessagesForConversation(conversationId);
    const currentUser = useAuthStore.getState().user;

    if (!currentUser || !conversationId) return;

    // Use the REST API to mark messages as read for better persistence
    const unreadMessages = messages.filter((message) => {
      // Only messages from others that haven't been read
      if (message.sender?._id === currentUser._id || !message._id) return false;

      // Check if already read by current user
      const alreadyRead = message.readBy?.some(
        (receipt) =>
          (receipt.user?._id || receipt.user)?.toString() ===
          currentUser._id.toString()
      );

      return !alreadyRead;
    });

    if (unreadMessages.length > 0) {
      // Use REST API to fetch messages which will mark them as read
      fetch(`/api/messages/${conversationId}?page=1&limit=50`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      }).catch((err) => {
        console.log("Auto-mark read failed, using socket fallback:", err);
        // Fallback to socket if REST API fails
        const socketStore = useSocketStore.getState();
        socketStore.markMessagesAsRead(conversationId, currentUser._id);
      });
    }

    // Reset unread count locally
    useConversationStore.getState().resetUnreadCount(conversationId);
  },

  // Chat Selection and Orchestration
  setSelectedChat: (chatId) => {
    try {
      console.log(`🎯 Setting selected chat to: ${chatId}`);
      const currentSelectedChatId = get().selectedChatId;

      // Initialize socket if not connected
      const socketStore = useSocketStore.getState();
      if (!socketStore.isConnected()) {
        console.log("🔌 Socket not connected, initializing...");
        get().initializeSocket();
      }

      // Leave the current conversation if switching
      if (currentSelectedChatId && currentSelectedChatId !== chatId) {
        console.log(`👋 Leaving conversation: ${currentSelectedChatId}`);
        get().leaveConversation(currentSelectedChatId);
        get().stopTyping(currentSelectedChatId);
      }

      set({ selectedChatId: chatId });

      if (chatId) {
        console.log(`🔗 Joining conversation: ${chatId}`);
        get().joinConversation(chatId);
        useConversationStore.getState().resetUnreadCount(chatId);

        // Always fetch fresh messages to ensure we have the latest data
        const currentMessages = useMessageStore.getState().messages[chatId];
        console.log(
          `📨 Current messages for ${chatId}:`,
          currentMessages?.length || 0
        );

        // Debug message store state
        useMessageStore.getState().debugMessageState();

        // Always fetch messages to ensure we have the latest data from server
        console.log(`🔄 Fetching fresh messages for conversation: ${chatId}`);
        useMessageStore.getState().fetchMessages(chatId);
      }
    } catch (err) {
      console.error("❌ Error in setSelectedChat:", err);
      set({ selectedChatId: chatId });
    }
  },

  // =========================================================================
  // UTILITY/HELPER FUNCTIONS
  // =========================================================================

  // Get typing users for a conversation
  getTypingUsers: (conversationId) => {
    const state = get();
    const currentUser = useAuthStore.getState().user;

    // Ensure typingUsers is a Map
    if (!(state.typingUsers instanceof Map)) {
      console.warn("typingUsers is not a Map, reinitializing...");
      set({ typingUsers: new Map() });
      return [];
    }

    // Get the Set of typing user IDs for this conversation
    const typingUserIds = state.typingUsers.get(conversationId);

    // If no one is typing in this conversation, return empty array
    if (!typingUserIds || typingUserIds.size === 0) {
      return [];
    }

    // Convert Set to Array and filter out current user
    const otherTypingUsers = Array.from(typingUserIds).filter(
      (userId) => userId !== currentUser?._id
    );

    if (otherTypingUsers.length === 0) {
      return [];
    }

    // Get user details from contacts
    const contacts = useConversationStore.getState().contacts;

    return otherTypingUsers.map((userId) => {
      // Find the contact/conversation that contains this participant
      const contact = contacts.find((c) =>
        c.participants?.some((p) => p._id === userId)
      );

      // Find the specific participant
      const participant = contact?.participants?.find((p) => p._id === userId);

      return participant
        ? get().getFormattedDisplayName(participant)
        : "Someone";
    });
  },

  getTypingIndicatorText: (conversationId) => {
    const typingUsers = get().getTypingUsers(conversationId);

    if (typingUsers.length === 0) return "";
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2)
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]}, ${typingUsers[1]} and ${
      typingUsers.length - 2
    } others are typing...`;
  },

  // When someone starts typing
  handleTypingStart: (userId, conversationId) => {
    set((state) => {
      // Ensure typingUsers is a Map
      const typingUsers =
        state.typingUsers instanceof Map ? state.typingUsers : new Map();

      const newTypingUsers = new Map(typingUsers);

      if (!newTypingUsers.has(conversationId)) {
        newTypingUsers.set(conversationId, new Set());
      }

      newTypingUsers.get(conversationId).add(userId);

      return { typingUsers: newTypingUsers };
    });
  },

  // When someone stops typing
  handleTypingStop: (userId, conversationId) => {
    set((state) => {
      // Ensure typingUsers is a Map
      const typingUsers =
        state.typingUsers instanceof Map ? state.typingUsers : new Map();

      const newTypingUsers = new Map(typingUsers);

      if (newTypingUsers.has(conversationId)) {
        newTypingUsers.get(conversationId).delete(userId);

        // Clean up empty Sets
        if (newTypingUsers.get(conversationId).size === 0) {
          newTypingUsers.delete(conversationId);
        }
      }

      return { typingUsers: newTypingUsers };
    });
  },

  // Formatting Helpers
  getFormattedAvatar: (user, fallbackName) => {
    if (user?.image) {
      return user.image;
    }

    let displayName;
    if (user?.firstName && user?.lastName) {
      displayName = `${user.firstName} ${user.lastName}`;
    } else if (user?.firstName || user?.lastName) {
      displayName = user.firstName || user.lastName;
    } else if (user?.email) {
      displayName = user.email;
    } else if (user?.username) {
      displayName = user.username;
    } else {
      displayName = fallbackName || "User";
    }

    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(
      displayName
    )}&backgroundColor=random&radius=50`;
  },

  getFormattedDisplayName: (user) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName || user?.lastName) {
      return user.firstName || user.lastName;
    }
    if (user?.username) {
      return user.username;
    }
    if (user?.email) {
      return user.email;
    }
    return "Unknown User";
  },

  // Connection/Error Handlers
  handleConnectionChange: (isConnected) => {
    const socketStore = useSocketStore.getState();
    socketStore.handleConnectionChange(isConnected);

    if (isConnected) {
      const selectedChatId = get().selectedChatId;
      if (selectedChatId) {
        get().joinConversation(selectedChatId);
      }
    }
  },

  clearError: () => {
    set({ error: null });
    useSocketStore.getState().clearError();
  },

  // Cleanup
  clearChatState: () => {
    const selectedChatId = get().selectedChatId;
    const socketStore = useSocketStore.getState();

    if (selectedChatId && socketStore.isConnected()) {
      socketStore.leaveConversation(selectedChatId);
    }
    socketStore.cleanup();

    // Clear all three stores
    get().clearError();
    useConversationStore.getState().clearConversationState();
    useMessageStore.getState().clearMessageState();

    // Reset local state - CRITICAL: Keep typingUsers as a Map, not an object
    set({
      selectedChatId: null,
      typingUsers: new Map(), // ✅ FIXED: Use new Map() instead of {}
      onlineUsers: [],
    });
  },
}));

// Override the logout function to clear chat state
const originalAuthStore = useAuthStore.getState();
if (originalAuthStore.logout) {
  const originalLogout = originalAuthStore.logout;
  useAuthStore.setState({
    logout: () => {
      originalLogout();
      useChatStore.getState().clearChatState();
    },
  });
}
