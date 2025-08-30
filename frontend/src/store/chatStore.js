import { create } from "zustand";
import api from "@/utils/axiosInstance";
import { io } from "socket.io-client";
import { useAuthStore } from "./authStore";
import {
  HOST,
  GET_DM_CONTACTS_ROUTE,
  GET_ALL_MESSAGES_ROUTE,
  SEND_MESSAGE_ROUTE,
  INITIATE_DM_ROUTE,
} from "@/utils/ApiRoutes";

const SOCKET_SERVER_URL = HOST;
let socket;

export const useChatStore = create((set, get) => ({
  contacts: [],
  selectedChatId: null,
  messages: {},
  loadingContacts: false,
  loadingMessages: false,
  error: null,
  socketConnected: false,

  isAuthenticated: () => {
    return useAuthStore.getState().isAuthenticated;
  },

  initializeSocket: () => {
    if (!get().isAuthenticated()) {
      console.log("User not authenticated, skipping socket initialization");
      return null;
    }

    if (socket && socket.connected) {
      console.log("Socket already connected.");
      return socket;
    }

    if (socket && !socket.connected && get().socketConnected) {
      console.log("Socket disconnected, attempting reconnect...");
      socket.connect();
      return socket;
    }

    socket = io(SOCKET_SERVER_URL, {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
    });

    socket.on("connect", () => {
      console.log("Socket.IO connected:", socket.id);
      set({ socketConnected: true });
      const selectedChatId = get().selectedChatId;
      if (selectedChatId) {
        socket.emit("join_conversation", selectedChatId);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      set({ socketConnected: false });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      if (
        error.message === "Authentication error" ||
        error.message.includes("Unauthorized")
      ) {
        console.log("Socket authentication failed. Logging out user.");
        useAuthStore.getState().logout();
      } else {
        set({ error: `Socket connection failed: ${error.message}` });
      }
    });

    // Handle incoming messages
    socket.on("receive_message", (message) => {
      console.log("Received message:", message);
      set((state) => {
        const currentUser = useAuthStore.getState().user;
        let actualConversationId;

        if (message.channel) {
          actualConversationId = message.channel._id.toString();
        } else {
          actualConversationId =
            message.sender._id.toString() === currentUser._id
              ? message.recipient._id.toString()
              : message.sender._id.toString();
        }

        let newMessagesForChat = state.messages[actualConversationId];

        if (state.selectedChatId === actualConversationId) {
          const existingTempMessageIndex = newMessagesForChat?.findIndex(
            (msg) => msg.id === `temp-${message.tempId}`
          );

          if (
            existingTempMessageIndex !== undefined &&
            existingTempMessageIndex > -1
          ) {
            // Replace optimistic message with real one
            newMessagesForChat[existingTempMessageIndex] = {
              ...message,
              id: message._id.toString(),
              status:
                message.sender._id.toString() === currentUser._id
                  ? "delivered"
                  : "received",
            };
            newMessagesForChat = [...newMessagesForChat];
          } else {
            // Add new message
            newMessagesForChat = [
              ...(newMessagesForChat || []),
              {
                ...message,
                id: message._id.toString(),
                status:
                  message.sender._id.toString() === currentUser._id
                    ? "delivered"
                    : "received",
              },
            ];
          }
        }

        // Update contacts list
        let updatedContacts = state.contacts.map((contact) => {
          if (contact.id === actualConversationId) {
            return {
              ...contact,
              lastMessage: message.content,
              time: message.createdAt || new Date().toISOString(),
              unreadCount:
                message.sender._id.toString() !== currentUser._id &&
                state.selectedChatId !== actualConversationId
                  ? (contact.unreadCount || 0) + 1
                  : contact.unreadCount || 0,
            };
          }
          return contact;
        });

        // Handle new DM contact creation
        const contactExists = updatedContacts.some(
          (c) => c.id === actualConversationId
        );
        if (
          !contactExists &&
          !message.channel &&
          message.sender &&
          message.recipient
        ) {
          const otherParticipant =
            message.sender._id.toString() === currentUser._id
              ? message.recipient
              : message.sender;

          const newContact = {
            id: otherParticipant._id.toString(),
            name: `${otherParticipant.firstName} ${otherParticipant.lastName}`,
            avatar:
              otherParticipant.image ||
              `https://api.dicebear.com/8.x/initials/svg?seed=${
                otherParticipant.firstName || otherParticipant.email
              }&backgroundColor=random&radius=50`,
            lastMessage: message.content,
            time: message.createdAt || new Date().toISOString(),
            type: "individual",
            participants: [
              {
                _id: currentUser._id,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                image: currentUser.image,
              },
              {
                _id: otherParticipant._id.toString(),
                firstName: otherParticipant.firstName,
                lastName: otherParticipant.lastName,
                image: otherParticipant.image,
              },
            ],
            unreadCount:
              message.sender._id.toString() !== currentUser._id ? 1 : 0,
          };
          updatedContacts = [newContact, ...updatedContacts];
        }

        // Sort contacts by time
        updatedContacts.sort((a, b) => new Date(b.time) - new Date(a.time));

        return {
          messages: {
            ...state.messages,
            [actualConversationId]: newMessagesForChat,
          },
          contacts: updatedContacts,
        };
      });
    });

    // Handle message delivery status
    socket.on("message_delivered", ({ messageId, conversationId }) => {
      console.log(`Message ${messageId} delivered in ${conversationId}`);
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map((msg) =>
            msg.id === messageId || msg._id === messageId
              ? { ...msg, status: "delivered" }
              : msg
          ),
        },
      }));
    });

    // Handle message read status
    socket.on("messages_read", ({ conversationId, userId }) => {
      console.log(`Messages in ${conversationId} read by ${userId}`);
      const currentUser = useAuthStore.getState().user;

      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.id === conversationId) {
            return { ...contact, unreadCount: 0 };
          }
          return contact;
        }),
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map((msg) => {
            const isMessageSentByCurrentUser =
              msg.sender?._id?.toString() === currentUser?._id?.toString() ||
              msg.sender?.toString() === currentUser?._id?.toString();
            const isReadByOtherUser =
              userId.toString() !== currentUser?._id?.toString();

            if (isMessageSentByCurrentUser && isReadByOtherUser) {
              const newReadBy = new Set([
                ...(msg.readBy || []).map((r) =>
                  typeof r === "object"
                    ? r._id?.toString() || r.toString()
                    : r.toString()
                ),
                userId.toString(),
              ]);

              return {
                ...msg,
                readBy: Array.from(newReadBy),
                status: "read",
              };
            }

            if (!isMessageSentByCurrentUser && !isReadByOtherUser) {
              const newReadBy = new Set([
                ...(msg.readBy || []).map((r) =>
                  typeof r === "object"
                    ? r._id?.toString() || r.toString()
                    : r.toString()
                ),
                userId.toString(),
              ]);

              return {
                ...msg,
                readBy: Array.from(newReadBy),
              };
            }

            return msg;
          }),
        },
      }));
    });

    socket.on("message_error", (data) => {
      console.error("Message error from server:", data);
      set({ error: data.error || "Failed to send message." });
      set((state) => ({
        messages: {
          ...state.messages,
          [data.conversationId]: state.messages[data.conversationId]?.map(
            (msg) =>
              msg.id === `temp-${data.tempId}`
                ? { ...msg, status: "failed", error: data.error }
                : msg
          ),
        },
      }));
    });

    return socket;
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
      const response = await api.get(GET_DM_CONTACTS_ROUTE);
      const currentUser = useAuthStore.getState().user;

      const contactsData = response.data.contacts.map((contact) => {
        const displayName =
          contact.firstName && contact.lastName
            ? `${contact.firstName} ${contact.lastName}`
            : contact.email;

        const displayAvatar =
          contact.image ||
          `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}&backgroundColor=random&radius=50`;

        return {
          id: contact._id.toString(),
          name: displayName,
          avatar: displayAvatar,
          lastMessage: contact.lastMessageContent || "No messages yet.",
          time: contact.lastMessageTime || new Date().toISOString(),
          type: "individual",
          participants: [
            {
              _id: currentUser._id,
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              image: currentUser.image,
            },
            {
              _id: contact._id.toString(),
              firstName: contact.firstName,
              lastName: contact.lastName,
              image: contact.image,
            },
          ],
          unreadCount: contact.unreadCount || 0,
        };
      });

      set({ contacts: contactsData, loadingContacts: false });

      if (!get().selectedChatId && contactsData.length > 0) {
        get().setSelectedChat(contactsData[0].id);
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

    set({ loadingMessages: true, error: null });

    try {
      const response = await api.get(
        `${GET_ALL_MESSAGES_ROUTE}/${conversationId}`
      );

      let messagesArray = [];

      if (Array.isArray(response.data)) {
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
        throw new Error("Messages data is not in expected format");
      }

      const currentUser = useAuthStore.getState().user;
      const validatedMessages = messagesArray
        .filter((msg) => msg && typeof msg === "object")
        .map((msg, index) => {
          try {
            const isSentByCurrentUser =
              currentUser &&
              msg.sender &&
              (msg.sender._id === currentUser._id ||
                msg.sender === currentUser._id);

            // Determine message status based on readBy array and sender
            let messageStatus = "sent";
            if (isSentByCurrentUser) {
              if (msg.readBy && msg.readBy.length > 0) {
                // Check if anyone other than the sender has read it
                const readByOthers = msg.readBy.some(
                  (readerId) =>
                    readerId.toString() !== currentUser._id.toString()
                );
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
              sender: msg.sender,
              recipient: msg.recipient,
              readBy: msg.readBy || [],
            };
          } catch (msgError) {
            console.error("Error processing message:", msg, msgError);
            return null;
          }
        })
        .filter((msg) => msg !== null);

      console.log("Processed messages:", validatedMessages);

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: validatedMessages,
        },
        loadingMessages: false,
      }));

      const currentSocket = get().initializeSocket();
      if (currentSocket && get().socketConnected) {
        socket.emit("join_conversation", conversationId);
        const user = useAuthStore.getState().user;
        if (user && user._id) {
          socket.emit("messages_read", {
            conversationId,
            userId: user._id,
          });
        }
      }
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
      const currentSocket = get().initializeSocket();

      if (
        currentSelectedChatId &&
        currentSocket &&
        get().socketConnected &&
        currentSelectedChatId !== chatId
      ) {
        socket.emit("leave_conversation", currentSelectedChatId);
      }

      set({ selectedChatId: chatId });

      if (chatId && currentSocket && get().socketConnected) {
        const user = useAuthStore.getState().user;
        if (user && user._id) {
          socket.emit("messages_read", {
            conversationId: chatId,
            userId: user._id,
          });
        }

        set((state) => ({
          contacts: state.contacts.map((contact) =>
            contact.id === chatId ? { ...contact, unreadCount: 0 } : contact
          ),
        }));
      }
    } catch (err) {
      console.error("Error in setSelectedChat:", err);
      set({ selectedChatId: chatId });
    }
  },

  getMessagesForConversation: (conversationId) => {
    const state = get();
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

    const contact = state.contacts.find((c) => c.id === selectedChatId);
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

    const existingContact = get().contacts.find(
      (c) => c.type === "individual" && c.id === targetUser._id
    );

    if (existingContact) {
      get().setSelectedChat(existingContact.id);
      return existingContact.id;
    }

    try {
      const response = await api.post(INITIATE_DM_ROUTE, {
        targetUserId: targetUser._id,
      });

      const { dmPartner, isNewConversation } = response.data;

      const newContact = {
        id: dmPartner._id,
        name: `${dmPartner.firstName} ${dmPartner.lastName}`,
        avatar:
          dmPartner.image ||
          `https://api.dicebear.com/8.x/initials/svg?seed=${
            dmPartner.firstName || dmPartner.email
          }&backgroundColor=random&radius=50`,
        lastMessage: isNewConversation
          ? "New chat started."
          : "No messages yet.",
        time: new Date().toISOString(),
        type: "individual",
        participants: [
          {
            _id: currentUser._id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            image: currentUser.image,
          },
          {
            _id: dmPartner._id,
            firstName: dmPartner.firstName,
            lastName: dmPartner.lastName,
            image: dmPartner.image,
          },
        ],
        unreadCount: 0,
      };

      set((state) => ({
        contacts: [newContact, ...state.contacts].sort(
          (a, b) => new Date(b.time) - new Date(a.time)
        ),
        selectedChatId: newContact.id,
      }));

      if (isNewConversation) {
        set((state) => ({
          messages: {
            ...state.messages,
            [newContact.id]: [],
          },
        }));
      } else {
        get().fetchMessages(newContact.id);
      }

      return newContact.id;
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in startNewIndividualChat, user will be logged out by interceptor"
        );
        throw new Error("Authentication failed. Please log in again.");
      }
      const errorMessage =
        err.response?.data?.message || "Failed to initiate new DM.";
      set({ error: errorMessage });
      console.error("Error initiating new DM:", err);
      throw new Error(errorMessage);
    }
  },

  sendMessage: async (conversationId, content, type = "text") => {
    if (!get().isAuthenticated()) {
      set({ error: "User not authenticated" });
      return;
    }

    const currentUser = useAuthStore.getState().user;
    if (!socket || !get().socketConnected || !currentUser) {
      set({
        error:
          "Socket not connected or user not logged in. Cannot send message.",
      });
      return;
    }

    const tempMessageId = Date.now();
    const tempMessage = {
      id: `temp-${tempMessageId}`,
      conversation: conversationId,
      sender: {
        _id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        image: currentUser.image,
      },
      content,
      type,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          tempMessage,
        ],
      },
      contacts: state.contacts
        .map((contact) =>
          contact.id === conversationId
            ? { ...contact, lastMessage: content, time: tempMessage.createdAt }
            : contact
        )
        .sort((a, b) => new Date(b.time) - new Date(a.time)),
    }));

    try {
      await api.post(SEND_MESSAGE_ROUTE, {
        recipientId: conversationId,
        content,
        type,
        tempId: tempMessageId,
      });
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(
          "401 error in sendMessage, user will be logged out by interceptor"
        );
        return;
      }
      const errorMessage =
        err.response?.data?.message || "Failed to send message via API.";
      set({ error: errorMessage });
      console.error("Error sending message via REST:", err);
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map((msg) =>
            msg.id === `temp-${tempMessageId}`
              ? { ...msg, status: "failed", error: errorMessage }
              : msg
          ),
        },
      }));
    }
  },

  clearChatState: () => {
    if (socket) {
      const selectedChatId = get().selectedChatId;
      if (selectedChatId && socket.connected) {
        socket.emit("leave_conversation", selectedChatId);
      }
      socket.disconnect();
      socket = null;
    }
    set({
      contacts: [],
      selectedChatId: null,
      messages: {},
      loadingContacts: false,
      loadingMessages: false,
      error: null,
      socketConnected: false,
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