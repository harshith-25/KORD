import { create } from "zustand";
import api from "@/utils/axiosInstance";
import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import {
  CONVERSATION_ROUTES,
  CREATE_DIRECT_CONVERSATION,
} from "@/utils/ApiRoutes";

export const useConversationStore = create((set, get) => ({
  // State
  contacts: [],
  loadingContacts: false,
  isCreatingConversation: false,
  error: null,

  // Actions
  fetchContacts: async () => {
    const {
      isAuthenticated,
      setSelectedChat,
      getFormattedDisplayName,
      getFormattedAvatar,
      onlineUsers,
    } = useChatStore.getState();

    if (!isAuthenticated()) {
      set({
        contacts: [],
        loadingContacts: false,
        error: "User not authenticated",
      });
      return;
    }

    if (get().loadingContacts) {
      return;
    }

    set({ loadingContacts: true, error: null });

    try {
      const response = await api.get(CONVERSATION_ROUTES);
      const currentUser = useAuthStore.getState().user;

      const conversations = response.data || [];

      const contactsData = conversations
        .map((conversation) => {
          try {
            const otherParticipant = conversation.participants.find(
              (p) => p.user._id !== currentUser._id
            );

            // Handling for groups/multi-party conversations (where otherParticipant may be null)
            if (!otherParticipant && conversation.type === "direct") {
              return null;
            }

            // Use the other participant's user object for direct chats, or the conversation details for groups
            const contactUser = otherParticipant?.user || conversation;

            const displayName = getFormattedDisplayName(contactUser);
            const displayAvatar = getFormattedAvatar(contactUser, displayName);

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
                isOnline: onlineUsers.includes(p.user._id),
              })),
              unreadCount: 0,
              messageCount: conversation.messageCount,
              memberCount: conversation.memberCount,
              isActive: conversation.isActive,
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

      // Set the first chat as selected if none is selected
      const currentSelectedChatId = useChatStore.getState().selectedChatId;
      if (!currentSelectedChatId && contactsData.length > 0) {
        setSelectedChat(contactsData[0].conversationId);
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        "Failed to fetch conversations from backend.";
      set({ error: errorMessage, loadingContacts: false });
      console.error("Error fetching conversations:", err);
    }
  },

  createDirectConversation: async (userId) => {
    const {
      isAuthenticated,
      setSelectedChat,
      getFormattedDisplayName,
      getFormattedAvatar,
      onlineUsers,
      fetchMessages,
    } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    const currentUser = useAuthStore.getState().user;

    // Validate user IDs
    if (!currentUser || !userId) {
      const error = "Invalid user data";
      set({ error });
      throw new Error(error);
    }

    // Check for existing conversation locally
    const expectedConversationId1 = `direct_${currentUser._id}_${userId}`;
    const expectedConversationId2 = `direct_${userId}_${currentUser._id}`;

    const existingContact = get().contacts.find(
      (c) =>
        c.conversationId === expectedConversationId1 ||
        c.conversationId === expectedConversationId2 ||
        c.id === expectedConversationId1 ||
        c.id === expectedConversationId2
    );

    // If conversation exists, select it and return
    if (existingContact) {
      setSelectedChat(existingContact.conversationId);
      set({ error: null });
      return existingContact;
    }

    // Create new conversation
    set({ isCreatingConversation: true, error: null });

    try {
      const response = await api.post(CREATE_DIRECT_CONVERSATION, { userId });

      console.log("API Response:", response.data); // Debug log

      // Handle different response structures
      let conversation, isNewConversation;

      if (response.data.conversation) {
        // Structure: { conversation: {...}, isNewConversation: true }
        conversation = response.data.conversation;
        isNewConversation = response.data.isNewConversation;
      } else if (response.data.conversationId) {
        // Structure: { conversationId: "...", participants: [...], ... }
        conversation = response.data;
        isNewConversation = response.data.isNewConversation !== false;
      } else if (response.data.data) {
        // Structure: { data: { conversation: {...} } }
        conversation = response.data.data.conversation || response.data.data;
        isNewConversation = response.data.data.isNewConversation;
      } else {
        console.error("Unexpected response structure:", response.data);
        throw new Error("Invalid conversation response structure");
      }

      // Validate conversation object
      if (!conversation || !conversation.conversationId) {
        console.error("Invalid conversation object:", conversation);
        throw new Error("Conversation missing conversationId");
      }

      const otherParticipant = conversation.participants?.find(
        (p) => p.user?._id !== currentUser._id || p._id !== currentUser._id
      );

      if (!otherParticipant) {
        console.error(
          "Could not find other participant:",
          conversation.participants
        );
        throw new Error("Could not find other participant in conversation");
      }

      // Extract user data - handle both nested and flat structures
      const contactUser = otherParticipant.user || otherParticipant;
      const displayName = getFormattedDisplayName(contactUser);
      const displayAvatar = getFormattedAvatar(contactUser, displayName);

      const newContact = {
        id: conversation.conversationId,
        conversationId: conversation.conversationId,
        name: displayName,
        avatar: displayAvatar,
        lastMessage:
          conversation.lastMessage?.content ||
          (isNewConversation ? "Chat started" : "No messages yet."),
        time: conversation.lastActivity || new Date().toISOString(),
        lastActivity: conversation.lastActivity || new Date().toISOString(),
        type: conversation.type || "direct",
        participants: (conversation.participants || []).map((p) => {
          const user = p.user || p;
          return {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            image: user.image,
            email: user.email,
            username: user.username,
            role: p.role,
            isActive: p.isActive,
            isMuted: p.isMuted,
            joinedAt: p.joinedAt,
            permissions: p.permissions,
            isOnline: onlineUsers.includes(user._id),
          };
        }),
        unreadCount: 0,
        messageCount: conversation.messageCount || 0,
        memberCount: conversation.memberCount || 2,
        isActive: conversation.isActive !== false,
      };

      // Check again if conversation was added while we were creating it (race condition)
      const existingAfterCreate = get().contacts.find(
        (c) => c.conversationId === newContact.conversationId
      );

      if (existingAfterCreate) {
        // Update existing instead of adding duplicate
        set((state) => ({
          contacts: state.contacts
            .map((c) =>
              c.conversationId === newContact.conversationId ? newContact : c
            )
            .sort(
              (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
            ),
          isCreatingConversation: false,
        }));
      } else {
        // Add new conversation to the list
        set((state) => ({
          contacts: [newContact, ...state.contacts].sort(
            (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
          ),
          isCreatingConversation: false,
        }));
      }

      // Select the newly created conversation
      setSelectedChat(newContact.conversationId);

      // Handle messages for the conversation
      if (!isNewConversation && conversation.messageCount > 0) {
        // Fetch messages for existing conversation
        await fetchMessages(newContact.conversationId);
      }

      return newContact;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isCreatingConversation: false });
      console.error("Error creating direct conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // Alias for backward compatibility
  startNewIndividualChat: async (targetUser) => {
    return get().createDirectConversation(targetUser._id);
  },

  // Helper functions to update contact list
  updateContactLastMessage: (conversationId, message, timestamp) => {
    set((state) => ({
      contacts: state.contacts
        .map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                lastMessage: message,
                time: timestamp,
                lastActivity: timestamp,
                messageCount: (contact.messageCount || 0) + 1,
              }
            : contact
        )
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)),
    }));
  },

  incrementUnreadCount: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, unreadCount: (contact.unreadCount || 0) + 1 }
          : contact
      ),
    }));
  },

  resetUnreadCount: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, unreadCount: 0 }
          : contact
      ),
    }));
  },

  // Optimistic UI Helpers for Message Send
  updateContactForOptimisticSend: (conversationId, tempMessage) => {
    const file = tempMessage.file;
    const content = tempMessage.content;

    set((state) => ({
      contacts: state.contacts
        .map((contact) =>
          contact.conversationId === conversationId
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
    }));
  },

  revertContactOnFailedSend: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? {
              ...contact,
              messageCount: Math.max((contact.messageCount || 1) - 1, 0),
            }
          : contact
      ),
    }));
  },

  // Contact Management
  removeContact: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.filter(
        (c) => c.conversationId !== conversationId
      ),
    }));
  },

  updateContact: (conversationId, updates) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, ...updates }
          : contact
      ),
    }));
  },

  // Participant/Metadata Getters
  getCurrentChatParticipant: () => {
    const state = get();
    const selectedChatId = useChatStore.getState().selectedChatId;

    if (!selectedChatId) return null;

    const contact = state.contacts.find(
      (c) => c.conversationId === selectedChatId
    );
    if (!contact || !contact.participants) return null;

    const currentUser = useAuthStore.getState().user;
    return contact.participants.find((p) => p._id !== currentUser._id);
  },

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

  getContactByConversationId: (conversationId) => {
    return get().contacts.find(
      (c) => c.conversationId === conversationId || c.id === conversationId
    );
  },

  // Utility for Error Messages
  getDetailedErrorMessage: (err) => {
    let errorMessage = "Failed to perform operation.";

    if (err.response?.status === 403) {
      if (err.response.data?.message?.includes("muted")) {
        errorMessage = "You are muted in this conversation.";
      } else if (err.response.data?.message?.includes("admin")) {
        errorMessage = "Only admins can perform this action.";
      } else if (err.response.data?.message?.includes("member")) {
        errorMessage = "You are not a member of this conversation.";
      } else {
        errorMessage = err.response.data?.message || "Permission denied.";
      }
    } else if (err.response?.status === 404) {
      errorMessage = "Resource not found.";
    } else if (err.response?.status === 400) {
      errorMessage = err.response.data?.message || "Invalid request data.";
    } else if (err.response?.status === 409) {
      errorMessage = err.response.data?.message || "Conflict detected.";
    } else if (err.response?.data?.message) {
      errorMessage = err.response.data.message;
    } else if (err.message) {
      errorMessage = err.message;
    }
    return errorMessage;
  },

  clearError: () => set({ error: null }),

  clearConversationState: () =>
    set({
      contacts: [],
      loadingContacts: false,
      isCreatingConversation: false,
      error: null,
    }),
}));