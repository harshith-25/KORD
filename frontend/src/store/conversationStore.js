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
              // ... other conversation fields
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
      useChatStore.getState().set({ error: errorMessage });
      set({ loadingContacts: false });
      console.error("Error fetching conversations:", err);
    }
  },

  startNewIndividualChat: async (targetUser) => {
    const {
      isAuthenticated,
      setSelectedChat,
      getFormattedDisplayName,
      getFormattedAvatar,
      onlineUsers,
      fetchMessages,
    } = useChatStore.getState();

    if (!isAuthenticated()) {
      useChatStore.getState().set({ error: "User not authenticated" });
      throw new Error("User not authenticated.");
    }

    const currentUser = useAuthStore.getState().user;
    if (!currentUser || !targetUser || currentUser._id === targetUser._id) {
      useChatStore
        .getState()
        .set({ error: "Cannot start chat with self or invalid user." });
      throw new Error("Invalid target user for chat initiation.");
    }

    // Check for existing chat locally
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
      setSelectedChat(existingContact.conversationId);
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
      const displayName = getFormattedDisplayName(contact);
      const displayAvatar = getFormattedAvatar(contact, displayName);

      const newContact = {
        id: conversation.conversationId,
        conversationId: conversation.conversationId,
        name: displayName,
        avatar: displayAvatar,
        lastMessage: isNewConversation ? "Chat started" : "No messages yet.",
        time: conversation.lastActivity || new Date().toISOString(),
        lastActivity: conversation.lastActivity || new Date().toISOString(),
        type: conversation.type || "direct",
        participants: conversation.participants.map((p) => ({
          _id: p.user._id,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          // ... other participant fields
          isOnline: onlineUsers.includes(p.user._id),
        })),
        unreadCount: 0,
        messageCount: conversation.messageCount,
        memberCount: conversation.memberCount,
        // ... other conversation fields
      };

      set((state) => ({
        contacts: [newContact, ...state.contacts].sort(
          (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
        ),
      }));

      setSelectedChat(newContact.conversationId);

      if (!isNewConversation && conversation.messageCount > 0) {
        // Fetch messages for existing conversation
        fetchMessages(newContact.conversationId);
      } else {
        // Ensure messages state is initialized as an empty array
        useMessageStore.getState().addMessage(newContact.conversationId, []);
      }

      return newContact.conversationId;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      useChatStore.getState().set({ error: errorMessage });
      console.error("Error initiating new conversation:", err);
      throw new Error(errorMessage);
    }
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

  // Utility for Error Messages
  getDetailedErrorMessage: (err) => {
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
    return errorMessage;
  },

  clearConversationState: () => set({ contacts: [], loadingContacts: false }),
}));
