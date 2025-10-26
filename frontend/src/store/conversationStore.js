import { create } from "zustand";
import api from "@/utils/axiosInstance";
import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useSocketStore } from "./socketStore";
import {
  CONVERSATION_ROUTES,
  CREATE_DIRECT_CONVERSATION,
} from "@/utils/ApiRoutes";

export const useConversationStore = create((set, get) => ({
  // State
  contacts: [],
  publicConversations: [],
  loadingContacts: false,
  isLoading: false,
  currentAction: null, // 'creating', 'joining', 'leaving', 'adding', 'removing', 'updating'
  error: null,

  // =========================================================================
  // FETCH CONVERSATIONS
  // =========================================================================
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
              (p) => p.user && p.user._id !== currentUser._id
            );

            // Handling for groups/multi-party conversations (where otherParticipant may be null)
            if (!otherParticipant && conversation.type === "direct") {
              return null;
            }

            // Use the other participant's user object for direct chats, or the conversation details for groups
            const contactUser = otherParticipant?.user || conversation;

            const displayName = conversation.type === "direct" ? getFormattedDisplayName(contactUser) : (conversation.name);
            const displayAvatar = getFormattedAvatar(contactUser, displayName);

            // Find current user's participant info
            const currentUserParticipant = conversation.participants.find(
              (p) => p.user && p.user._id === currentUser._id
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
              description: conversation.description,
              isPublic: conversation.isPublic,
              category: conversation.category,
              tags: conversation.tags,
              slug: conversation.slug,
              settings: conversation.settings,
              createdBy: conversation.createdBy,
              participants: conversation.participants
                .map((p) => {
                  // Handle cases where p.user might be null
                  if (!p.user) {
                    console.warn("Participant missing user data:", p);
                    return null;
                  }

                  return {
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
                    leftAt: p.leftAt,
                    nickname: p.nickname,
                    permissions: p.permissions,
                    isOnline: onlineUsers.includes(p.user._id),
                  };
                })
                .filter(Boolean),
              // Current user's role and permissions
              currentUserRole: currentUserParticipant?.role,
              currentUserPermissions: currentUserParticipant?.permissions,
              isMuted: currentUserParticipant?.isMuted,
              mutedUntil: currentUserParticipant?.mutedUntil,
              unreadCount: 0,
              messageCount: conversation.messageCount,
              memberCount: conversation.memberCount,
              isActive: conversation.isActive,
              isArchived: conversation.isArchived,
              pinnedMessages: conversation.pinnedMessages,
              joinRequests: conversation.joinRequests,
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

  // =========================================================================
  // CREATE DIRECT CONVERSATION
  // =========================================================================
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
    set({ isLoading: true, currentAction: "creating", error: null });

    try {
      const response = await api.post(CREATE_DIRECT_CONVERSATION, { userId });

      // Handle different response structures
      let conversation, isNewConversation;

      if (response.data.conversation) {
        conversation = response.data.conversation;
        isNewConversation = response.data.isNewConversation;
      } else if (response.data.conversationId) {
        conversation = response.data;
        isNewConversation = response.data.isNewConversation !== false;
      } else if (response.data.data) {
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
        (p) =>
          (p.user && p.user._id !== currentUser._id) ||
          (p._id && p._id !== currentUser._id)
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

      // Find current user's participant info
      const currentUserParticipant = conversation.participants?.find(
        (p) =>
          (p.user && p.user._id === currentUser._id) ||
          (p._id && p._id === currentUser._id)
      );

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
        description: conversation.description,
        isPublic: conversation.isPublic || false,
        settings: conversation.settings || {},
        createdBy: conversation.createdBy,
        participants: (conversation.participants || [])
          .map((p) => {
            const user = p.user || p;

            if (!user || !user._id) {
              console.warn("Participant missing user data:", p);
              return null;
            }

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
              leftAt: p.leftAt,
              nickname: p.nickname,
              permissions: p.permissions,
              isOnline: onlineUsers.includes(user._id),
            };
          })
          .filter(Boolean),
        currentUserRole: currentUserParticipant?.role || "member",
        currentUserPermissions: currentUserParticipant?.permissions || {},
        isMuted: currentUserParticipant?.isMuted || false,
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
          isLoading: false,
          currentAction: null,
        }));
      } else {
        // Add new conversation to the list
        set((state) => ({
          contacts: [newContact, ...state.contacts].sort(
            (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
          ),
          isLoading: false,
          currentAction: null,
        }));
      }

      // Select the newly created conversation
      setSelectedChat(newContact.conversationId);

      // Handle messages for the conversation
      if (!isNewConversation && conversation.messageCount > 0) {
        await fetchMessages(newContact.conversationId);
      }

      return newContact;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error creating direct conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // CREATE GROUP OR CHANNEL
  // =========================================================================
  createGroupOrChannel: async ({
    type,
    name,
    description,
    participants,
    settings,
    isPublic,
    category,
    tags,
    avatar,
  }) => {
    const { isAuthenticated, setSelectedChat } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    if (!type || (type !== "group" && type !== "channel")) {
      const error = "Invalid conversation type. Must be 'group' or 'channel'.";
      set({ error });
      throw new Error(error);
    }

    if (!name || name.trim().length === 0) {
      const error = "Conversation name is required";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "creating", error: null });

    try {
      const response = await api.post(CONVERSATION_ROUTES, {
        type,
        name: name.trim(),
        description: description?.trim(),
        participants: participants || [],
        settings: settings || {},
        isPublic: isPublic || false,
        category: category || "general",
        tags: tags || [],
        avatar,
      });

      const conversation = response.data;

      if (!conversation || !conversation.conversationId) {
        throw new Error("Invalid conversation response");
      }

      // Process the new conversation
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();

      const displayName =
        conversation.name || getFormattedDisplayName(conversation);
      const displayAvatar =
        conversation.avatar?.filePath ||
        getFormattedAvatar(conversation, displayName);

      const currentUserParticipant = conversation.participants?.find(
        (p) => p.user && p.user._id === currentUser._id
      );

      const newContact = {
        id: conversation.conversationId,
        conversationId: conversation.conversationId,
        name: displayName,
        avatar: displayAvatar,
        lastMessage: "No messages yet.",
        time: conversation.lastActivity || new Date().toISOString(),
        lastActivity: conversation.lastActivity || new Date().toISOString(),
        type: conversation.type,
        description: conversation.description,
        isPublic: conversation.isPublic,
        category: conversation.category,
        tags: conversation.tags,
        slug: conversation.slug,
        settings: conversation.settings,
        createdBy: conversation.createdBy,
        participants: (conversation.participants || [])
          .map((p) => {
            if (!p.user) {
              console.warn("Participant missing user data:", p);
              return null;
            }

            return {
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
              nickname: p.nickname,
              permissions: p.permissions,
              isOnline: onlineUsers.includes(p.user._id),
            };
          })
          .filter(Boolean),
        currentUserRole: currentUserParticipant?.role || "admin",
        currentUserPermissions: currentUserParticipant?.permissions || {},
        isMuted: currentUserParticipant?.isMuted || false,
        unreadCount: 0,
        messageCount: 0,
        memberCount:
          conversation.memberCount || conversation.participants?.length || 1,
        isActive: true,
        isArchived: false,
        pinnedMessages: [],
        joinRequests: [],
      };

      // Add to contacts list
      set((state) => ({
        contacts: [newContact, ...state.contacts].sort(
          (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
        ),
        isLoading: false,
        currentAction: null,
      }));

      // Select the newly created conversation
      setSelectedChat(newContact.conversationId);

      return newContact;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error creating group/channel:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // GET CONVERSATION BY ID
  // =========================================================================
  getConversationById: async (conversationId) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "fetching", error: null });

    try {
      const response = await api.get(
        `${CONVERSATION_ROUTES}/${conversationId}`
      );
      const conversation = response.data;

      set({ isLoading: false, currentAction: null });
      return conversation;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error fetching conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // UPDATE CONVERSATION INFO
  // =========================================================================
  updateConversationInfo: async (conversationId, updates) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "updating", error: null });

    try {
      const response = await api.put(
        `${CONVERSATION_ROUTES}/${conversationId}`,
        updates
      );
      const updatedConversation = response.data;

      // Update the conversation in the local state
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();

      const displayName =
        updatedConversation.name ||
        getFormattedDisplayName(updatedConversation);
      const displayAvatar =
        updatedConversation.avatar?.filePath ||
        getFormattedAvatar(updatedConversation, displayName);

      const currentUserParticipant = updatedConversation.participants?.find(
        (p) => p.user && p.user._id === currentUser._id
      );

      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                name: displayName,
                avatar: displayAvatar,
                description: updatedConversation.description,
                isPublic: updatedConversation.isPublic,
                settings: updatedConversation.settings,
                category: updatedConversation.category,
                tags: updatedConversation.tags,
                slug: updatedConversation.slug,
                participants: (updatedConversation.participants || [])
                  .map((p) => {
                    if (!p.user) return null;

                    return {
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
                      nickname: p.nickname,
                      permissions: p.permissions,
                      isOnline: onlineUsers.includes(p.user._id),
                    };
                  })
                  .filter(Boolean),
                currentUserRole: currentUserParticipant?.role,
                currentUserPermissions: currentUserParticipant?.permissions,
              }
            : contact
        ),
        isLoading: false,
        currentAction: null,
      }));

      return updatedConversation;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error updating conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // JOIN CONVERSATION
  // =========================================================================
  joinConversation: async (conversationId, message = "") => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "joining", error: null });

    try {
      const response = await api.post(
        `${CONVERSATION_ROUTES}/${conversationId}/join`,
        { message }
      );

      set({ isLoading: false, currentAction: null });

      // If join was successful (not pending approval), refresh contacts
      if (response.status === 200) {
        await get().fetchContacts();

        // Join socket room
        const { joinConversation } = useSocketStore.getState();
        joinConversation(conversationId);
      }

      return response.data;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error joining conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // LEAVE CONVERSATION
  // =========================================================================
  leaveConversation: async (conversationId) => {
    const { isAuthenticated, setSelectedChat, selectedChatId } =
      useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "leaving", error: null });

    try {
      await api.post(`${CONVERSATION_ROUTES}/${conversationId}/leave`);

      // Remove from contacts or mark as inactive
      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
        isLoading: false,
        currentAction: null,
      }));

      // Leave socket room
      const { leaveConversation } = useSocketStore.getState();
      leaveConversation(conversationId);

      // If this was the selected chat, clear selection
      if (selectedChatId === conversationId) {
        setSelectedChat(null);
      }

      return { success: true, message: "Successfully left the conversation." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error leaving conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // ADD MEMBER
  // =========================================================================
  addMember: async (conversationId, userId) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    if (!userId) {
      const error = "User ID is required";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "adding", error: null });

    try {
      await api.post(`${CONVERSATION_ROUTES}/${conversationId}/add`, {
        userId,
      });

      // Refresh the conversation details to get updated participants
      const updatedConversation = await get().getConversationById(
        conversationId
      );

      // Update local state
      const currentUser = useAuthStore.getState().user;
      const { onlineUsers } = useChatStore.getState();

      const currentUserParticipant = updatedConversation.participants?.find(
        (p) => p.user && p.user._id === currentUser._id
      );

      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                participants: (updatedConversation.participants || [])
                  .map((p) => {
                    if (!p.user) return null;

                    return {
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
                      nickname: p.nickname,
                      permissions: p.permissions,
                      isOnline: onlineUsers.includes(p.user._id),
                    };
                  })
                  .filter(Boolean),
                memberCount: updatedConversation.memberCount,
                currentUserRole: currentUserParticipant?.role,
                currentUserPermissions: currentUserParticipant?.permissions,
              }
            : contact
        ),
        isLoading: false,
        currentAction: null,
      }));

      return { success: true, message: "Member added successfully." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error adding member:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // REMOVE MEMBER
  // =========================================================================
  removeMember: async (conversationId, userId) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    if (!userId) {
      const error = "User ID is required";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "removing", error: null });

    try {
      await api.delete(
        `${CONVERSATION_ROUTES}/${conversationId}/members/${userId}`
      );

      // Update local state - remove the member from participants
      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                participants: contact.participants.filter(
                  (p) => p._id !== userId
                ),
                memberCount: Math.max((contact.memberCount || 1) - 1, 0),
              }
            : contact
        ),
        isLoading: false,
        currentAction: null,
      }));

      return { success: true, message: "Member removed successfully." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error removing member:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // GET PUBLIC CONVERSATIONS
  // =========================================================================
  fetchPublicConversations: async (
    page = 1,
    limit = 20,
    type = ["group", "channel"]
  ) => {
    set({ isLoading: true, currentAction: "fetching_public", error: null });

    try {
      const response = await api.get(`${CONVERSATION_ROUTES}/public`, {
        params: { page, limit, type },
      });

      const conversations = response.data || [];
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();

      const publicConversationsData = conversations.map((conversation) => {
        const displayName =
          conversation.name || getFormattedDisplayName(conversation);
        const displayAvatar =
          conversation.avatar?.filePath ||
          getFormattedAvatar(conversation, displayName);

        return {
          id: conversation.conversationId,
          conversationId: conversation.conversationId,
          name: displayName,
          avatar: displayAvatar,
          description: conversation.description,
          type: conversation.type,
          memberCount: conversation.memberCount,
          lastActivity: conversation.lastActivity,
          isPublic: true,
          category: conversation.category,
          tags: conversation.tags,
          participants: (conversation.participants || [])
            .map((p) => {
              if (!p.user) return null;

              return {
                _id: p.user._id,
                firstName: p.user.firstName,
                lastName: p.user.lastName,
                image: p.user.image,
                email: p.user.email,
                username: p.user.username,
                isOnline: onlineUsers.includes(p.user._id),
              };
            })
            .filter(Boolean),
        };
      });

      set({
        publicConversations: publicConversationsData,
        isLoading: false,
        currentAction: null,
      });

      return publicConversationsData;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error fetching public conversations:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // SOCKET EVENT HANDLERS (to be called from components)
  // =========================================================================
  handleConversationUpdated: (data) => {
    const { conversationId, updates } = data;

    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, ...updates }
          : contact
      ),
    }));
  },

  handleParticipantJoined: (data) => {
    const { conversationId, participant } = data;
    const { onlineUsers } = useChatStore.getState();

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          // Check if participant already exists
          const existingParticipant = contact.participants.find(
            (p) => p._id === participant._id
          );

          if (existingParticipant) {
            // Update existing participant
            return {
              ...contact,
              participants: contact.participants.map((p) =>
                p._id === participant._id
                  ? {
                      ...p,
                      ...participant,
                      isOnline: onlineUsers.includes(participant._id),
                    }
                  : p
              ),
              memberCount: contact.memberCount,
            };
          } else {
            // Add new participant
            return {
              ...contact,
              participants: [
                ...contact.participants,
                {
                  ...participant,
                  isOnline: onlineUsers.includes(participant._id),
                },
              ],
              memberCount: (contact.memberCount || 0) + 1,
            };
          }
        }
        return contact;
      }),
    }));
  },

  handleParticipantLeft: (data) => {
    const { conversationId, userId } = data;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          return {
            ...contact,
            participants: contact.participants.map((p) =>
              p._id === userId
                ? { ...p, isActive: false, leftAt: new Date() }
                : p
            ),
            memberCount: Math.max((contact.memberCount || 1) - 1, 0),
          };
        }
        return contact;
      }),
    }));
  },

  handleParticipantRemoved: (data) => {
    const { conversationId, userId } = data;
    const currentUser = useAuthStore.getState().user;

    // If current user was removed, remove the conversation from contacts
    if (userId === currentUser._id) {
      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
      }));

      // Leave socket room
      const { leaveConversation } = useSocketStore.getState();
      leaveConversation(conversationId);

      // Clear selection if this was the selected chat
      const { selectedChatId, setSelectedChat } = useChatStore.getState();
      if (selectedChatId === conversationId) {
        setSelectedChat(null);
      }
    } else {
      // Remove the participant from the list
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              participants: contact.participants.filter(
                (p) => p._id !== userId
              ),
              memberCount: Math.max((contact.memberCount || 1) - 1, 0),
            };
          }
          return contact;
        }),
      }));
    }
  },

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  // Update contact last message
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

  // Increment unread count
  incrementUnreadCount: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, unreadCount: (contact.unreadCount || 0) + 1 }
          : contact
      ),
    }));
  },

  // Reset unread count
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

  // =========================================================================
  // PARTICIPANT & METADATA GETTERS
  // =========================================================================

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
      description: contact.description,
      isPublic: contact.isPublic,
      category: contact.category,
      tags: contact.tags,
      slug: contact.slug,
      memberCount: contact.memberCount,
      messageCount: contact.messageCount,
      isActive: contact.isActive,
      isArchived: contact.isArchived,
      participants: contact.participants,
      lastActivity: contact.lastActivity,
      unreadCount: contact.unreadCount,
      currentUserRole: contact.currentUserRole,
      currentUserPermissions: contact.currentUserPermissions,
      isMuted: contact.isMuted,
      mutedUntil: contact.mutedUntil,
      settings: contact.settings,
      pinnedMessages: contact.pinnedMessages,
      createdBy: contact.createdBy,
    };
  },

  getContactByConversationId: (conversationId) => {
    return get().contacts.find(
      (c) => c.conversationId === conversationId || c.id === conversationId
    );
  },

  // Check if current user is admin in a conversation
  isCurrentUserAdmin: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    return contact?.currentUserRole === "admin";
  },

  // Check if current user is moderator or admin
  isCurrentUserModerator: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    return (
      contact?.currentUserRole === "admin" ||
      contact?.currentUserRole === "moderator"
    );
  },

  // Check if current user has specific permission
  hasPermission: (conversationId, permission) => {
    const contact = get().getContactByConversationId(conversationId);

    // Admins have all permissions
    if (contact?.currentUserRole === "admin") {
      return true;
    }

    return contact?.currentUserPermissions?.[permission] || false;
  },

  // Get current user's participant info
  getCurrentUserParticipant: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    const currentUser = useAuthStore.getState().user;

    if (!contact || !currentUser) return null;

    return contact.participants.find((p) => p._id === currentUser._id);
  },

  // Get active members count
  getActiveMembersCount: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return 0;

    return contact.participants.filter((p) => p.isActive).length;
  },

  // Get online members count
  getOnlineMembersCount: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return 0;

    return contact.participants.filter((p) => p.isOnline && p.isActive).length;
  },

  // Get admins list
  getAdmins: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return [];

    return contact.participants.filter((p) => p.role === "admin" && p.isActive);
  },

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  // Alias for backward compatibility
  startNewIndividualChat: async (targetUser) => {
    return get().createDirectConversation(targetUser._id);
  },

  // Get detailed error message
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
      errorMessage = err.response.data?.message || "Resource not found.";
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

  // Clear error
  clearError: () => set({ error: null }),

  // Clear all conversation state
  clearConversationState: () =>
    set({
      contacts: [],
      publicConversations: [],
      loadingContacts: false,
      isLoading: false,
      currentAction: null,
      error: null,
    }),

  // Update online status for participants
  updateParticipantOnlineStatus: (userId, isOnline) => {
    set((state) => ({
      contacts: state.contacts.map((contact) => ({
        ...contact,
        participants: contact.participants.map((p) =>
          p._id === userId ? { ...p, isOnline } : p
        ),
      })),
    }));
  },

  // Archive conversation
  archiveConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, isArchived: true }
          : contact
      ),
    }));
  },

  // Unarchive conversation
  unarchiveConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, isArchived: false }
          : contact
      ),
    }));
  },

  // Mute conversation
  muteConversation: (conversationId, duration = null) => {
    const mutedUntil = duration
      ? new Date(Date.now() + duration * 60 * 60 * 1000)
      : null;

    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, isMuted: true, mutedUntil }
          : contact
      ),
    }));
  },

  // Unmute conversation
  unmuteConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? { ...contact, isMuted: false, mutedUntil: null }
          : contact
      ),
    }));
  },

  // Search conversations
  searchConversations: (query) => {
    const state = get();
    const lowerQuery = query.toLowerCase();

    return state.contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.description?.toLowerCase().includes(lowerQuery) ||
        contact.participants.some(
          (p) =>
            p.firstName?.toLowerCase().includes(lowerQuery) ||
            p.lastName?.toLowerCase().includes(lowerQuery) ||
            p.email?.toLowerCase().includes(lowerQuery) ||
            p.username?.toLowerCase().includes(lowerQuery)
        )
    );
  },

  // Filter conversations by type
  filterConversationsByType: (type) => {
    const state = get();
    return state.contacts.filter((contact) => contact.type === type);
  },

  // Get unread conversations count
  getUnreadConversationsCount: () => {
    const state = get();
    return state.contacts.filter((contact) => (contact.unreadCount || 0) > 0)
      .length;
  },

  // Get total unread messages count
  getTotalUnreadCount: () => {
    const state = get();
    return state.contacts.reduce(
      (total, contact) => total + (contact.unreadCount || 0),
      0
    );
  },

  // =========================================================================
  // JOIN REQUEST MANAGEMENT
  // =========================================================================
  approveJoinRequest: async (conversationId, userId) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "approving_request", error: null });

    try {
      await api.post(
        `${CONVERSATION_ROUTES}/${conversationId}/join-requests/${userId}/approve`
      );

      // Remove the join request from local state
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              joinRequests: (contact.joinRequests || []).filter(
                (r) => r.user.toString() !== userId
              ),
              memberCount: (contact.memberCount || 0) + 1,
            };
          }
          return contact;
        }),
        isLoading: false,
        currentAction: null,
      }));

      return { success: true, message: "Join request approved successfully." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error approving join request:", err);
      throw new Error(errorMessage);
    }
  },

  rejectJoinRequest: async (conversationId, userId) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "rejecting_request", error: null });

    try {
      await api.delete(
        `${CONVERSATION_ROUTES}/${conversationId}/join-requests/${userId}`
      );

      // Remove the join request from local state
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              joinRequests: (contact.joinRequests || []).filter(
                (r) => r.user.toString() !== userId
              ),
            };
          }
          return contact;
        }),
        isLoading: false,
        currentAction: null,
      }));

      return { success: true, message: "Join request rejected." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error rejecting join request:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // ROLE & PERMISSION MANAGEMENT
  // =========================================================================
  updateMemberRole: async (conversationId, userId, role) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    if (!["admin", "moderator", "member"].includes(role)) {
      const error = "Invalid role. Must be 'admin', 'moderator', or 'member'.";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "updating_role", error: null });

    try {
      const response = await api.patch(
        `${CONVERSATION_ROUTES}/${conversationId}/members/${userId}/role`,
        { role }
      );

      // Update local state
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              participants: contact.participants.map((p) =>
                p._id === userId
                  ? {
                      ...p,
                      role,
                      permissions: response.data.permissions,
                    }
                  : p
              ),
            };
          }
          return contact;
        }),
        isLoading: false,
        currentAction: null,
      }));

      return response.data;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error updating member role:", err);
      throw new Error(errorMessage);
    }
  },

  updateMemberPermissions: async (conversationId, userId, permissions) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({
      isLoading: true,
      currentAction: "updating_permissions",
      error: null,
    });

    try {
      const response = await api.patch(
        `${CONVERSATION_ROUTES}/${conversationId}/members/${userId}/permissions`,
        { permissions }
      );

      // Update local state
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              participants: contact.participants.map((p) =>
                p._id === userId
                  ? {
                      ...p,
                      permissions: response.data.permissions,
                    }
                  : p
              ),
            };
          }
          return contact;
        }),
        isLoading: false,
        currentAction: null,
      }));

      return response.data;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error updating member permissions:", err);
      throw new Error(errorMessage);
    }
  },

  toggleMuteMember: async (
    conversationId,
    userId,
    isMuted,
    duration = null
  ) => {
    const { isAuthenticated } = useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "toggling_mute", error: null });

    try {
      const response = await api.patch(
        `${CONVERSATION_ROUTES}/${conversationId}/members/${userId}/mute`,
        { isMuted, duration }
      );

      // Update local state
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId === conversationId) {
            return {
              ...contact,
              participants: contact.participants.map((p) =>
                p._id === userId
                  ? {
                      ...p,
                      isMuted,
                      mutedUntil: response.data.mutedUntil,
                    }
                  : p
              ),
            };
          }
          return contact;
        }),
        isLoading: false,
        currentAction: null,
      }));

      return response.data;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error toggling mute member:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // CONVERSATION DELETION
  // =========================================================================
  deleteConversation: async (conversationId) => {
    const { isAuthenticated, setSelectedChat, selectedChatId } =
      useChatStore.getState();

    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "deleting", error: null });

    try {
      await api.delete(`${CONVERSATION_ROUTES}/${conversationId}`);

      // Remove from contacts
      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
        isLoading: false,
        currentAction: null,
      }));

      // Leave socket room
      const { leaveConversation } = useSocketStore.getState();
      leaveConversation(conversationId);

      // If this was the selected chat, clear selection
      if (selectedChatId === conversationId) {
        setSelectedChat(null);
      }

      return { success: true, message: "Conversation deleted successfully." };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error deleting conversation:", err);
      throw new Error(errorMessage);
    }
  },

  // =========================================================================
  // ADDITIONAL SOCKET EVENT HANDLERS
  // =========================================================================
  handleJoinRequestReceived: (data) => {
    const { conversationId, requester, message } = data;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          return {
            ...contact,
            joinRequests: [
              ...(contact.joinRequests || []),
              {
                user: requester._id,
                requestedAt: new Date(),
                message,
                userInfo: requester,
              },
            ],
          };
        }
        return contact;
      }),
    }));
  },

  handleMemberRoleUpdated: (data) => {
    const { conversationId, userId, newRole, permissions } = data;
    const currentUser = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          const updatedParticipants = contact.participants.map((p) =>
            p._id === userId
              ? {
                  ...p,
                  role: newRole,
                  permissions,
                }
              : p
          );

          // Update current user role if it's them
          const updates = {
            ...contact,
            participants: updatedParticipants,
          };

          if (userId === currentUser._id) {
            updates.currentUserRole = newRole;
            updates.currentUserPermissions = permissions;
          }

          return updates;
        }
        return contact;
      }),
    }));
  },

  handlePermissionsUpdated: (data) => {
    const { conversationId, permissions } = data;
    const currentUser = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          return {
            ...contact,
            currentUserPermissions: permissions,
            participants: contact.participants.map((p) =>
              p._id === currentUser._id
                ? {
                    ...p,
                    permissions,
                  }
                : p
            ),
          };
        }
        return contact;
      }),
    }));
  },

  handleMuteStatusChanged: (data) => {
    const { conversationId, isMuted, mutedUntil } = data;
    const currentUser = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId === conversationId) {
          return {
            ...contact,
            isMuted,
            mutedUntil,
            participants: contact.participants.map((p) =>
              p._id === currentUser._id
                ? {
                    ...p,
                    isMuted,
                    mutedUntil,
                  }
                : p
            ),
          };
        }
        return contact;
      }),
    }));
  },

  handleConversationDeleted: (data) => {
    const { conversationId } = data;
    const { setSelectedChat, selectedChatId } = useChatStore.getState();

    // Remove from contacts
    set((state) => ({
      contacts: state.contacts.filter(
        (c) => c.conversationId !== conversationId
      ),
    }));

    // Leave socket room
    const { leaveConversation } = useSocketStore.getState();
    leaveConversation(conversationId);

    // If this was the selected chat, clear selection
    if (selectedChatId === conversationId) {
      setSelectedChat(null);
    }
  },

  handleAddedToConversation: async (data) => {
    const { conversation } = data;

    if (!conversation) return;

    // Process and add the new conversation
    const currentUser = useAuthStore.getState().user;
    const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
      useChatStore.getState();

    const displayName =
      conversation.name || getFormattedDisplayName(conversation);
    const displayAvatar =
      conversation.avatar?.filePath ||
      getFormattedAvatar(conversation, displayName);

    const currentUserParticipant = conversation.participants?.find(
      (p) => p.user && p.user._id === currentUser._id
    );

    const newContact = {
      id: conversation.conversationId,
      conversationId: conversation.conversationId,
      name: displayName,
      avatar: displayAvatar,
      lastMessage: "You were added to this conversation",
      time: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      type: conversation.type,
      description: conversation.description,
      isPublic: conversation.isPublic,
      category: conversation.category,
      tags: conversation.tags,
      slug: conversation.slug,
      settings: conversation.settings,
      createdBy: conversation.createdBy,
      participants: (conversation.participants || [])
        .map((p) => {
          if (!p.user) return null;

          return {
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
            nickname: p.nickname,
            permissions: p.permissions,
            isOnline: onlineUsers.includes(p.user._id),
          };
        })
        .filter(Boolean),
      currentUserRole: currentUserParticipant?.role || "member",
      currentUserPermissions: currentUserParticipant?.permissions || {},
      isMuted: currentUserParticipant?.isMuted || false,
      unreadCount: 0,
      messageCount: 0,
      memberCount: conversation.memberCount,
      isActive: true,
      isArchived: false,
    };

    set((state) => ({
      contacts: [newContact, ...state.contacts].sort(
        (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
      ),
    }));

    // Join socket room
    const { joinConversation } = useSocketStore.getState();
    joinConversation(conversation.conversationId);
  },
}));