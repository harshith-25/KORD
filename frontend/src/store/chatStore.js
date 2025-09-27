import { create } from "zustand";
import api from "@/utils/axiosInstance";
import { io } from "socket.io-client";
import { useAuthStore } from "./authStore";
import { HOST, GET_ALL_MESSAGES_ROUTE, SEND_MESSAGE_ROUTE, CREATE_DIRECT_CONVERSATION, CONVERSATION_ROUTES } from "@/utils/ApiRoutes";

let socket;

export const useChatStore = create((set, get) => ({
  contacts: [],
  selectedChatId: null,
  messages: {},
  loadingContacts: false,
  loadingMessages: false,
  error: null,
  socketConnected: false,
  // New state for real-time features
  typingUsers: {}, // { conversationId: [userId1, userId2] }
  onlineUsers: [], // Array of online user IDs

  isAuthenticated: () => {
    return useAuthStore.getState().isAuthenticated;
  },

  initializeSocket: () => {
    if (!get().isAuthenticated()) {
      console.log("User not authenticated, skipping socket initialization");
      return null;
    }

    if (socket?.connected) {
      console.log("Socket already connected:", socket.id);
      return socket;
    }

    if (socket) {
      socket.disconnect();
    }

    socket = io(HOST, {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      forceNew: true,
      transports: ["websocket", "polling"],
    });

    // Connection events
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      set({ socketConnected: true });
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      set({ socketConnected: false });
    });

    // Message events - Updated to match backend
    socket.on("message_received", (message) => {
      console.log("📨 Received message:", message);
      const conversationId = message.conversationId;
      const currentUser = useAuthStore.getState().user;

      // Skip messages from current user to prevent duplicates with optimistic messages
      if (currentUser?._id === (message.sender?._id || message.sender)) {
        console.log("Skipping own message to prevent duplicate");
        return;
      }
      if (conversationId) {
        const currentUser = useAuthStore.getState().user;

        // Transform message to match frontend format
        const transformedMessage = {
          id: message._id?.toString() || message.id,
          _id: message._id,
          conversation: conversationId,
          conversationId: conversationId,
          sender: message.sender,
          senderId: message.sender?._id || message.sender,
          content: message.content || "",
          text: message.content || "",
          type:
            currentUser?._id === (message.sender?._id || message.sender)
              ? "sent"
              : "received",
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

        get().addMessage(conversationId, transformedMessage);

        // Update contact last message and increment unread if not current chat
        const displayMessage = message.media
          ? `📎 ${message.type === "image"
            ? "Image"
            : message.type === "video"
              ? "Video"
              : "File"
          }`
          : message.content;

        get().updateContactLastMessage(
          conversationId,
          displayMessage,
          transformedMessage.time
        );

        // Only increment unread count if this isn't the currently selected chat
        if (get().selectedChatId !== conversationId) {
          get().incrementUnreadCount(conversationId);
        }
      }
    });

    // Read receipt events
    socket.on("message_read", ({ messageId, readerId }) => {
      console.log("📖 Message read:", { messageId, readerId });

      // Update message read status in all conversations
      set((state) => {
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
    socket.on("typing_start", ({ userId, conversationId }) => {
      console.log("⌨️ User started typing:", { userId, conversationId });
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [
            ...(state.typingUsers[conversationId] || []).filter(
              (id) => id !== userId
            ),
            userId,
          ],
        },
      }));
    });

    socket.on("typing_stop", ({ userId, conversationId }) => {
      console.log("🛑 User stopped typing:", { userId, conversationId });
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: (state.typingUsers[conversationId] || []).filter(
            (id) => id !== userId
          ),
        },
      }));
    });

    // User status events
    socket.on("user-status-update", ({ userId, status }) => {
      console.log("👤 User status update:", { userId, status });
      set((state) => {
        let updatedOnlineUsers = [...state.onlineUsers];
        if (status === "online") {
          if (!updatedOnlineUsers.includes(userId)) {
            updatedOnlineUsers.push(userId);
          }
        } else {
          updatedOnlineUsers = updatedOnlineUsers.filter((id) => id !== userId);
        }

        return {
          onlineUsers: updatedOnlineUsers,
          contacts: state.contacts.map((contact) => {
            // Update online status for participants
            const updatedParticipants = contact.participants?.map((p) => ({
              ...p,
              isOnline: p._id === userId ? status === "online" : p.isOnline,
            }));

            return updatedParticipants
              ? { ...contact, participants: updatedParticipants }
              : contact;
          }),
        };
      });
    });

    // Conversation events
    socket.on("conversation_updated", ({ conversationId, updatedInfo }) => {
      console.log("💬 Conversation updated:", { conversationId, updatedInfo });
      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? { ...contact, ...updatedInfo }
            : contact
        ),
      }));
    });

    socket.on("participant_joined", ({ conversationId, newParticipant }) => {
      console.log("👋 Participant joined:", { conversationId, newParticipant });
      set((state) => ({
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

    socket.on("participant_left", ({ conversationId, participantId }) => {
      console.log("👋 Participant left:", { conversationId, participantId });
      set((state) => ({
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

    return socket;
  },

  // Join conversation room
  joinConversation: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("join_conversation", conversationId);
      console.log("Joined conversation room:", conversationId);
    }
  },

  // Leave conversation room
  leaveConversation: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("leave_conversation", conversationId);
      console.log("Left conversation room:", conversationId);
    }
  },

  // Send typing indicators
  startTyping: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("typing_start", { conversationId });
    }
  },

  stopTyping: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("typing_stop", { conversationId });
    }
  },

  // Mark message as read
  markMessageAsRead: (messageId, conversationId) => {
    if (socket?.connected && messageId && conversationId) {
      socket.emit("mark_message_as_read", { messageId, conversationId });
    }
  },

  // Mark all messages in conversation as read
  markConversationAsRead: (conversationId) => {
    const messages = get().getMessagesForConversation(conversationId);
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) return;

    messages.forEach((message) => {
      // Only mark messages from others as read
      if (message.sender?._id !== currentUser._id && message._id) {
        get().markMessageAsRead(message._id, conversationId);
      }
    });

    // Reset unread count locally
    get().resetUnreadCount(conversationId);
  },

  // Get typing users for a conversation
  getTypingUsers: (conversationId) => {
    const state = get();
    const typingUserIds = state.typingUsers[conversationId] || [];
    const currentUser = useAuthStore.getState().user;

    // Filter out current user and get user details
    return typingUserIds
      .filter((userId) => userId !== currentUser?._id)
      .map((userId) => {
        const contact = state.contacts.find((c) =>
          c.participants?.some((p) => p._id === userId)
        );
        const participant = contact?.participants?.find(
          (p) => p._id === userId
        );
        return participant
          ? get().getFormattedDisplayName(participant)
          : "Someone";
      });
  },

  fetchContacts: async () => {
    if (!get().isAuthenticated()) {
      console.log("User not authenticated, skipping fetchContacts");
      set({
        contacts: [],
        loadingContacts: false,
        error: "User not authenticated",
      });
      return;
    }

    if (get().loadingContacts) {
      console.log("fetchContacts already in progress, skipping");
      return;
    }

    set({ loadingContacts: true, error: null });

    try {
      const response = await api.get(CONVERSATION_ROUTES);
      const currentUser = useAuthStore.getState().user;

      const conversations = response.data || [];
      console.log("Fetched conversations:", conversations);

      const contactsData = conversations
        .map((conversation) => {
          try {
            const otherParticipant = conversation.participants.find(
              (p) => p.user._id !== currentUser._id
            );

            if (!otherParticipant) {
              console.warn(
                "No other participant found for conversation:",
                conversation.conversationId
              );
              return null;
            }

            const contact = otherParticipant.user;
            const displayName = get().getFormattedDisplayName(contact);
            const displayAvatar = get().getFormattedAvatar(
              contact,
              displayName
            );

            return {
              id: conversation.conversationId,
              conversationId: conversation.conversationId,
              name: displayName,
              avatar: displayAvatar,
              lastMessage:
                conversation.lastMessage?.content ||
                (conversation.messageCount > 0
                  ? "Previous messages available"
                  : "No messages yet."),
              time: conversation.lastActivity,
              lastActivity: conversation.lastActivity,
              type: conversation.type || "direct",
              participants: conversation.participants.map((p) => ({
                _id: p.user._id,
                firstName: p.user.firstName,
                lastName: p.user.lastName,
                image: p.user.image,
                email: p.user.email,
                username: p.user.username,
                role: p.role,
                isActive: p.isActive,
                isMuted: p.isMuted,
                joinedAt: p.joinedAt,
                permissions: p.permissions,
                isOnline: get().onlineUsers.includes(p.user._id),
              })),
              unreadCount: 0,
              messageCount: conversation.messageCount,
              memberCount: conversation.memberCount,
              isActive: conversation.isActive,
              isArchived: conversation.isArchived,
              archivedBy: conversation.archivedBy,
              isPublic: conversation.isPublic,
              category: conversation.category,
              tags: conversation.tags,
              directParticipants: conversation.directParticipants,
              pinnedMessages: conversation.pinnedMessages,
              joinRequests: conversation.joinRequests,
              createdBy: conversation.createdBy,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
              rawConversation: conversation,
            };
          } catch (convError) {
            console.error(
              "Error processing conversation:",
              conversation,
              convError
            );
            return null;
          }
        })
        .filter(Boolean);

      contactsData.sort(
        (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
      );

      set({ contacts: contactsData, loadingContacts: false });

      if (!get().selectedChatId && contactsData.length > 0) {
        get().setSelectedChat(contactsData[0].conversationId);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in fetchContacts, user will be logged out by interceptor"
        );
        set({ loadingContacts: false });
        return;
      }
      const errorMessage =
        err.response?.data?.message ||
        "Failed to fetch conversations from backend.";
      set({ error: errorMessage, loadingContacts: false });
      console.error("Error fetching conversations:", err);
    }
  },

  fetchMessages: async (conversationId) => {
    if (!get().isAuthenticated()) {
      console.log("User not authenticated, skipping fetchMessages");
      set({ loadingMessages: false, error: "User not authenticated" });
      return;
    }

    if (!conversationId) {
      console.error("No conversation ID provided to fetchMessages");
      set({ loadingMessages: false, error: "No conversation ID provided" });
      return;
    }

    set({ loadingMessages: true, error: null });

    try {
      const response = await api.get(
        `${GET_ALL_MESSAGES_ROUTE}/${conversationId}`
      );
      let messagesArray = [];

      if (!response || !response.data) {
        console.error("No data in response:", response);
        messagesArray = [];
      } else if (Array.isArray(response.data)) {
        messagesArray = response.data;
      } else if (response.data.docs && Array.isArray(response.data.docs)) {
        messagesArray = response.data.docs;
      } else if (
        response.data.messages &&
        Array.isArray(response.data.messages)
      ) {
        messagesArray = response.data.messages;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        messagesArray = response.data.data;
      } else if (typeof response.data === "object" && response.data !== null) {
        messagesArray = [response.data];
      } else {
        console.error("Unexpected response structure:", response.data);
        messagesArray = [];
      }

      const currentUser = useAuthStore.getState().user;

      if (!currentUser) {
        console.error("Current user not found in fetchMessages");
        set({ loadingMessages: false, error: "User not authenticated" });
        return;
      }

      const validatedMessages = messagesArray
        .filter((msg) => msg && typeof msg === "object")
        .map((msg, index) => {
          try {
            const msgSender = msg.sender;
            const msgSenderId =
              typeof msgSender === "object" ? msgSender._id : msgSender;
            const isSentByCurrentUser =
              msgSenderId &&
              msgSenderId.toString() === currentUser._id.toString();

            let messageStatus = "sent";
            if (isSentByCurrentUser) {
              if (
                msg.readBy &&
                Array.isArray(msg.readBy) &&
                msg.readBy.length > 0
              ) {
                const readByOthers = msg.readBy.some((readerId) => {
                  const readerIdStr =
                    typeof readerId === "object"
                      ? readerId._id || readerId.toString()
                      : readerId.toString();
                  return readerIdStr !== currentUser._id.toString();
                });
                messageStatus = readByOthers ? "read" : "delivered";
              } else {
                messageStatus = "delivered";
              }
            } else {
              messageStatus = "received";
            }

            return {
              ...msg,
              id: msg._id ? msg._id.toString() : `temp-${Date.now()}-${index}`,
              text: msg.content || msg.text || msg.message || "",
              content: msg.content || msg.text || msg.message || "",
              time:
                msg.createdAt ||
                msg.time ||
                msg.timestamp ||
                new Date().toISOString(),
              type: isSentByCurrentUser ? "sent" : "received",
              status: messageStatus,
              sender: msgSender,
              senderId: msgSenderId,
              recipient: msg.recipient,
              readBy: msg.readBy || [],
              media: msg.media,
              metadata: msg.metadata || {},
              deliveryStatus: msg.deliveryStatus,
            };
          } catch (msgError) {
            console.error("Error processing message:", msg, msgError);
            return null;
          }
        })
        .filter((msg) => msg !== null);

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: validatedMessages,
        },
        loadingMessages: false,
      }));

      // Join conversation room
      get().joinConversation(conversationId);

      // Mark all messages as read
      get().markConversationAsRead(conversationId);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in fetchMessages, user will be logged out by interceptor"
        );
        set({ loadingMessages: false });
        return;
      }

      let errorMessage = "Failed to fetch messages from backend.";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error("Error fetching messages:", {
        error: err,
        response: err.response,
        conversationId,
        errorMessage,
      });

      set({
        error: errorMessage,
        loadingMessages: false,
        messages: {
          ...get().messages,
          [conversationId]: [],
        },
      });
    }
  },

  setSelectedChat: (chatId) => {
    try {
      const currentSelectedChatId = get().selectedChatId;

      // Initialize socket if not connected
      const currentSocket = get().initializeSocket();

      // Leave the current conversation if switching to a different one
      if (currentSelectedChatId && currentSelectedChatId !== chatId) {
        get().leaveConversation(currentSelectedChatId);
        get().stopTyping(currentSelectedChatId);
      }

      set({ selectedChatId: chatId });

      if (chatId) {
        // Join the new conversation
        get().joinConversation(chatId);

        // Reset unread count
        get().resetUnreadCount(chatId);

        // Fetch messages if not already loaded
        const currentMessages = get().messages[chatId];
        if (!currentMessages || currentMessages.length === 0) {
          get().fetchMessages(chatId);
        } else {
          // Mark existing messages as read
          get().markConversationAsRead(chatId);
        }
      }
    } catch (err) {
      console.error("Error in setSelectedChat:", err);
      set({ selectedChatId: chatId });
    }
  },

  getMessagesForConversation: (conversationId) => {
    const state = get();

    if (!conversationId) {
      console.warn("No conversationId provided to getMessagesForConversation");
      return [];
    }

    const messages = state.messages[conversationId];

    if (!messages) {
      return [];
    }

    if (!Array.isArray(messages)) {
      console.warn(
        "Messages for conversation not an array:",
        conversationId,
        messages
      );
      return [];
    }

    return messages;
  },

  getCurrentChatParticipant: () => {
    const state = get();
    const selectedChatId = state.selectedChatId;

    if (!selectedChatId) return null;

    const contact = state.contacts.find(
      (c) => c.conversationId === selectedChatId || c.id === selectedChatId
    );
    if (!contact || !contact.participants) return null;

    const currentUser = useAuthStore.getState().user;
    return contact.participants.find((p) => p._id !== currentUser._id);
  },

  startNewIndividualChat: async (targetUser) => {
    if (!get().isAuthenticated()) {
      set({ error: "User not authenticated" });
      throw new Error("User not authenticated.");
    }

    const currentUser = useAuthStore.getState().user;
    if (!currentUser || !targetUser || currentUser._id === targetUser._id) {
      set({ error: "Cannot start chat with self or invalid user." });
      throw new Error("Invalid target user for chat initiation.");
    }

    const expectedConversationId1 = `direct_${currentUser._id}_${targetUser._id}`;
    const expectedConversationId2 = `direct_${targetUser._id}_${currentUser._id}`;

    const existingContact = get().contacts.find(
      (c) =>
        c.conversationId === expectedConversationId1 ||
        c.conversationId === expectedConversationId2 ||
        c.id === expectedConversationId1 ||
        c.id === expectedConversationId2
    );

    if (existingContact) {
      get().setSelectedChat(existingContact.conversationId);
      return existingContact.conversationId;
    }

    try {
      const response = await api.post(CREATE_DIRECT_CONVERSATION, {
        userId: targetUser._id,
      });

      const { conversation, isNewConversation } = response.data;

      const otherParticipant = conversation.participants.find(
        (p) => p.user._id !== currentUser._id
      );

      if (!otherParticipant) {
        throw new Error("Could not find other participant in conversation");
      }

      const contact = otherParticipant.user;
      const displayName = get().getFormattedDisplayName(contact);
      const displayAvatar = get().getFormattedAvatar(contact, displayName);

      const newContact = {
        id: conversation.conversationId,
        conversationId: conversation.conversationId,
        name: displayName,
        avatar: displayAvatar,
        lastMessage: isNewConversation
          ? "Chat started"
          : conversation.messageCount > 0
            ? "Previous messages available"
            : "No messages yet.",
        time: conversation.lastActivity || new Date().toISOString(),
        lastActivity: conversation.lastActivity || new Date().toISOString(),
        type: conversation.type || "direct",
        participants: conversation.participants.map((p) => ({
          _id: p.user._id,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          image: p.user.image,
          email: p.user.email,
          username: p.user.username,
          role: p.role,
          isActive: p.isActive,
          isMuted: p.isMuted,
          joinedAt: p.joinedAt,
          permissions: p.permissions,
          isOnline: get().onlineUsers.includes(p.user._id),
        })),
        unreadCount: 0,
        messageCount: conversation.messageCount,
        memberCount: conversation.memberCount,
        isActive: conversation.isActive,
        isArchived: conversation.isArchived,
        archivedBy: conversation.archivedBy,
        isPublic: conversation.isPublic,
        category: conversation.category,
        tags: conversation.tags,
        directParticipants: conversation.directParticipants,
        pinnedMessages: conversation.pinnedMessages,
        joinRequests: conversation.joinRequests,
        createdBy: conversation.createdBy,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        rawConversation: conversation,
      };

      set((state) => ({
        contacts: [newContact, ...state.contacts].sort(
          (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
        ),
        selectedChatId: newContact.conversationId,
      }));

      if (isNewConversation || conversation.messageCount === 0) {
        set((state) => ({
          messages: {
            ...state.messages,
            [newContact.conversationId]: [],
          },
        }));
      } else {
        get().fetchMessages(newContact.conversationId);
      }

      return newContact.conversationId;
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in startNewIndividualChat, user will be logged out by interceptor"
        );
        throw new Error("Authentication failed. Please log in again.");
      }
      const errorMessage =
        err.response?.data?.message || "Failed to initiate new conversation.";
      set({ error: errorMessage });
      console.error("Error initiating new conversation:", err);
      throw new Error(errorMessage);
    }
  },

  sendMessage: async (
    conversationId,
    content,
    type = "text",
    file = null,
    isForwarded = false,
    media = null,
    metadata = {}
  ) => {
    if (!get().isAuthenticated()) {
      set({ error: "User not authenticated" });
      return;
    }

    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ error: "User not logged in. Cannot send message." });
      return;
    }

    if (!content && !file && !media) {
      set({ error: "Message content, file, or media is required." });
      return;
    }

    // Stop typing indicator when sending message
    get().stopTyping(conversationId);

    const tempMessageId = Date.now();

    let messageType = type;
    if (file) {
      if (file.type.startsWith("image/")) {
        messageType = "image";
      } else if (file.type.startsWith("video/")) {
        messageType = "video";
      } else if (file.type.startsWith("audio/")) {
        messageType = "audio";
      } else {
        messageType = "file";
      }
    }

    // Create optimistic message
    const tempMessage = {
      id: `temp-${tempMessageId}`,
      _id: `temp-${tempMessageId}`,
      conversation: conversationId,
      conversationId: conversationId,
      sender: {
        _id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        image: currentUser.image,
        username: currentUser.username,
        name: get().getFormattedDisplayName(currentUser),
        avatar: get().getFormattedAvatar(currentUser),
      },
      senderId: currentUser._id,
      content: content || "",
      text: content || "",
      type: "sent",
      messageType: messageType,
      createdAt: new Date().toISOString(),
      time: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      status: "sending",
      deliveryStatus: "sending",
      readBy: [currentUser._id],
      media: media,
      metadata: metadata,
    };

    // Add optimistic message
    set((state) => {
      console.log("📤 Adding optimistic message");

      const existingMessages = [...(state.messages[conversationId] || [])];
      const updatedMessages = [...existingMessages, tempMessage];

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        contacts: state.contacts
          .map((contact) =>
            contact.conversationId === conversationId ||
              contact.id === conversationId
              ? {
                ...contact,
                lastMessage: file ? `📎 ${file.name}` : content,
                time: tempMessage.createdAt,
                lastActivity: tempMessage.createdAt,
                messageCount: (contact.messageCount || 0) + 1,
              }
              : contact
          )
          .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)),
      };
    });

    try {
      // Try sending via socket first (real-time)
      if (socket?.connected) {
        console.log("📡 Sending message via socket");

        const socketMessage = {
          conversationId,
          content,
          type: messageType,
          media,
          metadata: {
            ...metadata,
            tempId: tempMessageId,
            isForwarded,
          },
        };

        socket.emit("send_message", socketMessage);

        // Update optimistic message status to sent after socket emission
        setTimeout(() => {
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) =>
                msg.id === `temp-${tempMessageId}`
                  ? { ...msg, status: "sent", deliveryStatus: "sent" }
                  : msg
              ),
            },
          }));
        }, 1000);

        return tempMessage;
      }

      let requestData;
      let requestConfig = {};

      if (file) {
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        if (content) formData.append("content", content);
        formData.append("type", type || "text");
        formData.append("isForwarded", isForwarded.toString());
        formData.append("tempId", tempMessageId.toString());
        formData.append("file", file);
        if (media) formData.append("media", JSON.stringify(media));
        if (Object.keys(metadata).length > 0) {
          formData.append("metadata", JSON.stringify(metadata));
        }

        requestData = formData;
        requestConfig.headers = {
          "Content-Type": "multipart/form-data",
        };
      } else {
        requestData = {
          conversationId,
          content,
          type: type || "text",
          isForwarded,
          tempId: tempMessageId,
          media,
          metadata,
        };
        requestConfig.headers = {
          "Content-Type": "application/json",
        };
      }

      const response = await api.post(
        SEND_MESSAGE_ROUTE,
        requestData,
        requestConfig
      );

      // Update message with server response
      const serverMessage = response.data;
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map((msg) =>
            msg.id === `temp-${tempMessageId}`
              ? {
                ...serverMessage,
                id: serverMessage._id?.toString() || msg.id,
                status: "sent",
                deliveryStatus: "sent",
                text: serverMessage.content || msg.text,
                content: serverMessage.content || msg.content,
                time:
                  serverMessage.createdAt ||
                  serverMessage.timestamp ||
                  msg.time,
                timestamp:
                  serverMessage.createdAt ||
                  serverMessage.timestamp ||
                  msg.timestamp,
                type: "sent", // Keep as sent for current user
                file: serverMessage.file
                  ? {
                    ...serverMessage.file,
                    filePath: serverMessage.file.filePath.startsWith("http")
                      ? serverMessage.file.filePath
                      : `${HOST}${serverMessage.file.filePath}`,
                  }
                  : msg.file,
                media: serverMessage.media || msg.media,
                metadata: serverMessage.metadata || msg.metadata,
              }
              : msg
          ),
        },
      }));

      // Clean up temporary blob URL
      if (file && tempMessage.file?.filePath?.startsWith("blob:")) {
        URL.revokeObjectURL(tempMessage.file.filePath);
      }

      return serverMessage;
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in sendMessage, user will be logged out by interceptor"
        );
        return;
      }

      let errorMessage = "Failed to send message.";

      if (err.response?.status === 403) {
        if (err.response.data?.message?.includes("muted")) {
          errorMessage = "You are muted in this conversation.";
        } else if (err.response.data?.message?.includes("admin")) {
          errorMessage = "Only admins can send messages in this conversation.";
        } else if (err.response.data?.message?.includes("member")) {
          errorMessage = "You are not a member of this conversation.";
        } else {
          errorMessage = err.response.data?.message || "Permission denied.";
        }
      } else if (err.response?.status === 404) {
        errorMessage = "Conversation not found.";
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.message || "Invalid message data.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      set({ error: errorMessage });
      console.error("Error sending message:", err);

      // Clean up temporary blob URL
      if (file && tempMessage.file?.filePath?.startsWith("blob:")) {
        URL.revokeObjectURL(tempMessage.file.filePath);
      }

      // Mark message as failed and revert contact changes
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map((msg) =>
            msg.id === `temp-${tempMessageId}`
              ? {
                ...msg,
                status: "failed",
                deliveryStatus: "failed",
                error: errorMessage,
              }
              : msg
          ),
        },
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId ||
            contact.id === conversationId
            ? {
              ...contact,
              messageCount: Math.max((contact.messageCount || 1) - 1, 0),
            }
            : contact
        ),
      }));
    }
  },

  // Helper function to get contact by ID
  getContactById: (contactId) => {
    const state = get();
    return state.contacts.find(
      (c) => c.id === contactId || c.conversationId === contactId
    );
  },

  // Helper function to update contact last message
  updateContactLastMessage: (conversationId, message, timestamp) => {
    set((state) => ({
      contacts: state.contacts
        .map((contact) =>
          contact.conversationId === conversationId ||
            contact.id === conversationId
            ? {
              ...contact,
              lastMessage: message,
              time: timestamp,
              lastActivity: timestamp,
            }
            : contact
        )
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)),
    }));
  },

  // Helper function to increment unread count
  incrementUnreadCount: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId ||
          contact.id === conversationId
          ? {
            ...contact,
            unreadCount: (contact.unreadCount || 0) + 1,
          }
          : contact
      ),
    }));
  },

  // Helper function to reset unread count
  resetUnreadCount: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId ||
          contact.id === conversationId
          ? { ...contact, unreadCount: 0 }
          : contact
      ),
    }));
  },

  // Helper function to get formatted avatar URL
  getFormattedAvatar: (user, fallbackName) => {
    if (user?.image) {
      return user.image;
    }

    // Create display name prioritizing first + last name, then email
    let displayName;

    if (user?.firstName && user?.lastName) {
      displayName = `${user.firstName} ${user.lastName}`;
    } else if (user?.firstName || user?.lastName) {
      // If only one name is available, use it
      displayName = user.firstName || user.lastName;
    } else if (user?.email) {
      displayName = user.email;
    } else if (user?.username) {
      displayName = user.username;
    } else {
      displayName = fallbackName || "User";
    }

    // Generate avatar URL with proper encoding
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(
      displayName
    )}&backgroundColor=random&radius=50`;
  },

  // Helper function to get formatted display name
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

  // Function to manually refresh a specific conversation
  refreshConversation: async (conversationId) => {
    if (!get().isAuthenticated()) {
      return;
    }

    try {
      await get().fetchMessages(conversationId);
      await get().fetchContacts();
    } catch (err) {
      console.error("Error refreshing conversation:", err);
      set({ error: "Failed to refresh conversation" });
    }
  },

  // Function to handle connection state changes
  handleConnectionChange: (isConnected) => {
    set({ socketConnected: isConnected });

    if (isConnected) {
      const selectedChatId = get().selectedChatId;
      if (selectedChatId) {
        get().joinConversation(selectedChatId);
      }
    }
  },

  // Function to clear error state
  clearError: () => {
    set({ error: null });
  },

  // Function to get conversation metadata
  getConversationMetadata: (conversationId) => {
    const state = get();
    const contact = state.contacts.find(
      (c) => c.conversationId === conversationId || c.id === conversationId
    );

    if (!contact) return null;

    return {
      id: contact.conversationId,
      name: contact.name,
      avatar: contact.avatar,
      type: contact.type,
      memberCount: contact.memberCount,
      messageCount: contact.messageCount,
      isActive: contact.isActive,
      isArchived: contact.isArchived,
      participants: contact.participants,
      lastActivity: contact.lastActivity,
      unreadCount: contact.unreadCount,
    };
  },

  // Function to add message to state (used by socket events)
  addMessage: (conversationId, message) => {
    set((state) => {
      const existingMessages = [...(state.messages[conversationId] || [])];

      // Check if message already exists (prevent duplicates)
      const existsIndex = existingMessages.findIndex(
        (msg) =>
          (msg._id === message._id && message._id) ||
          (msg.id === message.id && message.id) ||
          // Handle temp messages being replaced by real ones
          (msg.id?.startsWith("temp-") &&
            message.metadata?.tempId &&
            msg.id === `temp-${message.metadata.tempId}`)
      );

      if (existsIndex >= 0) {
        // Update existing message (useful for status updates)
        existingMessages[existsIndex] = {
          ...existingMessages[existsIndex],
          ...message,
          id:
            message._id?.toString() ||
            message.id ||
            existingMessages[existsIndex].id,
        };
      } else {
        // Add new message
        const newMessage = {
          ...message,
          id: message._id?.toString() || message.id || `temp-${Date.now()}`,
        };
        existingMessages.push(newMessage);
      }

      // Sort messages by timestamp
      existingMessages.sort(
        (a, b) =>
          new Date(a.createdAt || a.timestamp || a.time) -
          new Date(b.createdAt || b.timestamp || b.time)
      );

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: existingMessages,
        },
      };
    });
  },

  // Function to clear all chat state (used on logout)
  clearChatState: () => {
    const selectedChatId = get().selectedChatId;

    // Clean up socket connections
    if (socket) {
      if (selectedChatId && socket.connected) {
        socket.emit("leave_conversation", selectedChatId);
      }
      socket.disconnect();
      socket = null;
    }

    // Reset all state
    set({
      contacts: [],
      selectedChatId: null,
      messages: {},
      loadingContacts: false,
      loadingMessages: false,
      error: null,
      socketConnected: false,
      typingUsers: {},
      onlineUsers: [],
    });
  },

  // Function to retry failed message
  retryFailedMessage: async (messageId, conversationId) => {
    const state = get();
    const messages = state.messages[conversationId] || [];
    const failedMessage = messages.find(
      (msg) => msg.id === messageId && msg.status === "failed"
    );

    if (!failedMessage) {
      console.error("Failed message not found:", messageId);
      return;
    }

    // Remove the failed message and resend
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId].filter(
          (msg) => msg.id !== messageId
        ),
      },
    }));

    // Resend the message
    await get().sendMessage(
      conversationId,
      failedMessage.content,
      failedMessage.messageType || "text",
      null, // file handling would need to be implemented separately
      false,
      failedMessage.media,
      failedMessage.metadata || {}
    );
  },

  // Function to get online status of a user
  isUserOnline: (userId) => {
    return get().onlineUsers.includes(userId);
  },

  // Function to get typing indicator text
  getTypingIndicatorText: (conversationId) => {
    const typingUsers = get().getTypingUsers(conversationId);

    if (typingUsers.length === 0) return "";
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2)
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2
      } others are typing...`;
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
