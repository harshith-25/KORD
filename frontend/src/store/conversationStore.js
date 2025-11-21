import { create } from "zustand";
import api from "@/utils/axiosInstance";
import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useSocketStore } from "./socketStore";
import {
  CONVERSATION_ROUTES,
  CREATE_DIRECT_CONVERSATION,
} from "@/utils/ApiRoutes";

/** Safe to ISO */
const toISO = (d) => (d ? new Date(d).toISOString() : new Date().toISOString());

/** uniqBy helper */
const uniqBy = (arr, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const k = keyFn(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
};

/** Map server conversation → UI contact item (direct/group/channel) */
const mapConversationToContact = (conversation, helpers) => {
  const {
    getFormattedDisplayName,
    getFormattedAvatar,
    onlineUsers,
    currentUser,
  } = helpers;

  if (!conversation) return null;

  const participantsRaw = Array.isArray(conversation.participants)
    ? conversation.participants
    : [];

  const participants = uniqBy(
    participantsRaw
      .map((p) => {
        const u = p?.user;
        if (!u || !u._id) return null;
        return {
          _id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          image: u.image,
          email: u.email,
          username: u.username,
          role: p.role,
          isActive: p.isActive !== false,
          isMuted: p.isMuted || false,
          joinedAt: p.joinedAt || null,
          leftAt: p.leftAt || null,
          nickname: p.nickname,
          permissions: p.permissions || {},
          isOnline: Array.isArray(onlineUsers)
            ? onlineUsers.includes(u._id)
            : false,
        };
      })
      .filter(Boolean),
    (p) => p._id
  );

  // Name & avatar
  let displayName =
    conversation.name ||
    getFormattedDisplayName(
      conversation.type === "direct"
        ? (() => {
            const other = participants.find((p) => p._id !== currentUser?._id);
            return other
              ? {
                  firstName: other.firstName,
                  lastName: other.lastName,
                  username: other.username,
                  email: other.email,
                }
              : conversation;
          })()
        : conversation
    );

  displayName = displayName || "Unknown";

  const displayAvatar =
    conversation.avatar?.filePath ||
    getFormattedAvatar(
      conversation.type === "direct"
        ? participants.find((p) => p._id !== currentUser?._id) || conversation
        : conversation,
      displayName
    );

  const currentUserParticipant = participants.find(
    (p) => p._id === currentUser?._id
  );

  const lastMsg =
    conversation.lastMessage?.content ||
    (conversation.messageCount > 0
      ? "Previous messages available"
      : "No messages yet.");

  const memberCount =
    conversation.memberCount ||
    (Array.isArray(participants) ? participants.length : 0);

  return {
    id: conversation.conversationId,
    conversationId: conversation.conversationId,
    name: displayName,
    avatar: displayAvatar,
    lastMessage: lastMsg,
    time: toISO(conversation.lastActivity || conversation.time),
    lastActivity: toISO(conversation.lastActivity || conversation.time),
    type: conversation.type || "direct",
    description: conversation.description || null,
    isPublic: !!conversation.isPublic,
    category: conversation.category || "general",
    tags: conversation.tags || [],
    slug: conversation.slug,
    settings: conversation.settings || {},
    createdBy: conversation.createdBy,
    participants,
    currentUserRole:
      currentUserParticipant?.role ||
      (conversation.type === "group" || conversation.type === "channel"
        ? "member"
        : undefined),
    currentUserPermissions: currentUserParticipant?.permissions || {},
    isMuted: currentUserParticipant?.isMuted || false,
    mutedUntil: currentUserParticipant?.mutedUntil || null,
    unreadCount: 0,
    messageCount: conversation.messageCount || 0,
    memberCount,
    isActive: conversation.isActive !== false,
    isArchived: !!conversation.isArchived,
    pinnedMessages: conversation.pinnedMessages || [],
    joinRequests: conversation.joinRequests || [],
  };
};

export const useConversationStore = create((set, get) => ({
  // State
  contacts: [],
  publicConversations: [],
  loadingContacts: false,
  isLoading: false,
  currentAction: null,
  error: null,

  // ✅ Add inside create(...) return object in conversationStore.js
  ensureConversationLoaded: async (conversationId) => {
    const state = get();
    const exists = state.contacts.some(
      (c) => c.conversationId === conversationId
    );
    if (exists) return true;

    try {
      const raw = await get().getConversationById(conversationId);
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const mapped = mapConversationToContact(raw, {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      });
      if (!mapped) return false;

      set((s) => ({
        contacts: [mapped, ...s.contacts].sort(
          (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
        ),
      }));

      // auto-join socket room to keep it live
      const { joinConversation } = useSocketStore.getState();
      joinConversation(conversationId);

      return true;
    } catch {
      return false;
    }
  },

  /* =========================================================================
     FETCH CONVERSATIONS
  ========================================================================= */
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

    if (get().loadingContacts) return;

    set({ loadingContacts: true, error: null });

    try {
      const res = await api.get(CONVERSATION_ROUTES);
      const currentUser = useAuthStore.getState().user;
      const conversations = Array.isArray(res.data) ? res.data : [];

      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };

      const contactsData = conversations
        .map((c) => mapConversationToContact(c, helpers))
        .filter(Boolean)
        .filter((c) =>
          c.type === "direct" ? c.participants.length >= 2 : true
        )
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      set({ contacts: contactsData, loadingContacts: false });

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

  /* =========================================================================
     CREATE DIRECT CONVERSATION
  ========================================================================= */
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

    if (!currentUser || !userId) {
      const error = "Invalid user data";
      set({ error });
      throw new Error(error);
    }

    // Local fast-path if already present
    const sorted = [String(currentUser._id), String(userId)].sort();
    const expectedId = `direct_${sorted[0]}_${sorted[1]}`;
    const existing = get().contacts.find(
      (c) => c.conversationId === expectedId || c.id === expectedId
    );
    if (existing) {
      setSelectedChat(existing.conversationId);
      set({ error: null });
      return existing;
    }

    set({ isLoading: true, currentAction: "creating", error: null });

    try {
      const response = await api.post(CREATE_DIRECT_CONVERSATION, { userId });

      // Controller returns { conversation, isNewConversation } or similar
      const conversation =
        response.data?.conversation ||
        response.data?.data?.conversation ||
        response.data;
      const isNew =
        response.data?.isNewConversation ??
        response.data?.data?.isNewConversation ??
        true;

      if (!conversation || !conversation.conversationId) {
        throw new Error("Invalid conversation response structure");
      }

      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const newContact = mapConversationToContact(conversation, helpers);
      if (!newContact) throw new Error("Failed to map conversation");

      // Prevent duplicates if server also pushed via socket
      set((state) => {
        const exists = state.contacts.some(
          (c) => c.conversationId === newContact.conversationId
        );
        const next = exists
          ? state.contacts.map((c) =>
              c.conversationId === newContact.conversationId ? newContact : c
            )
          : [newContact, ...state.contacts];

        return {
          contacts: next.sort(
            (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
          ),
          isLoading: false,
          currentAction: null,
        };
      });

      // Auto-join the room like WhatsApp
      const { joinConversation } = useSocketStore.getState();
      joinConversation(newContact.conversationId);

      setSelectedChat(newContact.conversationId);

      if (!isNew && (conversation.messageCount || 0) > 0) {
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

  /* =========================================================================
     CREATE GROUP OR CHANNEL
  ========================================================================= */
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
        isPublic: !!isPublic,
        category: category || "general",
        tags: tags || [],
        avatar,
      });

      const conversation = response.data;
      if (!conversation || !conversation.conversationId) {
        throw new Error("Invalid conversation response");
      }

      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();

      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };

      const newContact = mapConversationToContact(conversation, helpers);
      if (!newContact) throw new Error("Failed to map conversation");

      set((state) => ({
        contacts: [newContact, ...state.contacts].sort(
          (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
        ),
        isLoading: false,
        currentAction: null,
      }));

      // Auto-join room
      const { joinConversation } = useSocketStore.getState();
      joinConversation(newContact.conversationId);

      setSelectedChat(newContact.conversationId);
      return newContact;
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error creating group/channel:", err);
      throw new Error(errorMessage);
    }
  },

  /* =========================================================================
     GET CONVERSATION BY ID
  ========================================================================= */
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

  /* =========================================================================
     UPDATE CONVERSATION INFO
  ========================================================================= */
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

      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();

      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };

      const mapped = mapConversationToContact(updatedConversation, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId === conversationId ? { ...c, ...mapped } : c
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

  /* =========================================================================
     JOIN CONVERSATION
  ========================================================================= */
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

      if (response.status === 200) {
        await get().fetchContacts();
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

  /* =========================================================================
     LEAVE CONVERSATION
  ========================================================================= */
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

      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
        isLoading: false,
        currentAction: null,
      }));

      const { leaveConversation } = useSocketStore.getState();
      leaveConversation(conversationId);

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

  /* =========================================================================
     ADD MEMBER
  ========================================================================= */
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
      const response = await api.post(`${CONVERSATION_ROUTES}/${conversationId}/add`, {
        userId,
      });

      // refresh that conversation for exact server truth
      const updated = await get().getConversationById(conversationId);

      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const mapped = mapConversationToContact(updated, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId === conversationId ? { ...c, ...mapped } : c
        ),
        isLoading: false,
        currentAction: null,
      }));

      return { 
        success: true, 
        message: response.data?.message || "Member added successfully.",
        isRequest: response.data?.isRequest || false,
      };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error adding member:", err);
      throw new Error(errorMessage);
    }
  },

  /* =========================================================================
     REMOVE MEMBER
  ========================================================================= */
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

      // Optimistic remove (server already removed)
      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId !== conversationId) return contact;
          const nextParticipants = contact.participants.filter(
            (p) => p._id !== userId
          );
          return {
            ...contact,
            participants: nextParticipants,
            memberCount: nextParticipants.filter((p) => p.isActive !== false)
              .length,
          };
        }),
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

  /* =========================================================================
     GET PUBLIC CONVERSATIONS
  ========================================================================= */
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

      const payload = response.data || {};
      const list = Array.isArray(payload.conversations)
        ? payload.conversations
        : Array.isArray(payload)
        ? payload
        : [];

      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const currentUser = useAuthStore.getState().user;

      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };

      const publicConversationsData = list
        .map((c) => mapConversationToContact(c, helpers))
        .filter(Boolean);

      set({
        publicConversations: publicConversationsData,
        isLoading: false,
        currentAction: null,
      });

      return {
        conversations: publicConversationsData,
        pagination: payload.pagination,
      };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error fetching public conversations:", err);
      throw new Error(errorMessage);
    }
  },

  /* =========================================================================
     SOCKET EVENT HANDLERS (CALLED BY socketStore)
  ========================================================================= */
  handleConversationUpdated: (data) => {
    const { conversationId, updates } = data || {};
    if (!conversationId) return;

    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.conversationId === conversationId
          ? {
              ...contact,
              name: updates?.name ?? contact.name,
              description: updates?.description ?? contact.description,
              avatar: updates?.avatar?.filePath
                ? updates.avatar.filePath
                : contact.avatar,
              settings: updates?.settings ?? contact.settings,
              isPublic:
                typeof updates?.isPublic === "boolean"
                  ? updates.isPublic
                  : contact.isPublic,
              category: updates?.category ?? contact.category,
              tags: Array.isArray(updates?.tags) ? updates.tags : contact.tags,
            }
          : contact
      ),
    }));
  },

  handleParticipantJoined: (data) => {
    const { conversationId } = data || {};
    const raw = data?.participant || data?.user || data?.member || {};
    const pUser = raw.user && raw.user._id ? raw.user : raw;
    const uid = pUser?._id || pUser?.id;
    if (!conversationId || !uid) return;

    const { onlineUsers } = useChatStore.getState();
    const id = String(uid);

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;

        const exists = contact.participants.some((p) => p._id === id);
        const next = exists
          ? contact.participants.map((p) =>
              p._id === id
                ? {
                    ...p,
                    ...pUser,
                    _id: id,
                    isOnline: Array.isArray(onlineUsers)
                      ? onlineUsers.includes(id)
                      : false,
                    isActive: true,
                    role: raw.role || p.role,
                    permissions: raw.permissions || p.permissions,
                  }
                : p
            )
          : [
              ...contact.participants,
              {
                _id: id,
                firstName: pUser.firstName,
                lastName: pUser.lastName,
                image: pUser.image,
                email: pUser.email,
                username: pUser.username,
                isOnline: Array.isArray(onlineUsers)
                  ? onlineUsers.includes(id)
                  : false,
                isActive: true,
                role: raw.role,
                permissions: raw.permissions || {},
              },
            ];

        const activeCount = next.filter((m) => m.isActive !== false).length;

        return {
          ...contact,
          participants: next,
          memberCount: activeCount,
        };
      }),
    }));
  },

  handleParticipantLeft: (data) => {
    const { conversationId } = data || {};
    const userId =
      data?.userId || data?.participantId || data?.memberId || data?.user;
    if (!conversationId || !userId) return;
    const id = String(userId);

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;
        const updated = contact.participants.map((p) =>
          p._id === id ? { ...p, isActive: false, leftAt: new Date() } : p
        );
        const activeCount = updated.filter((p) => p.isActive).length;
        return { ...contact, participants: updated, memberCount: activeCount };
      }),
    }));
  },

  handleParticipantRemoved: (data) => {
    const { conversationId } = data || {};
    const userId =
      data?.userId || data?.participantId || data?.memberId || data?.user;
    if (!conversationId || !userId) return;

    const id = String(userId);
    const me = useAuthStore.getState().user?._id;

    if (id === me) {
      // current user removed → drop chat and leave room
      const { leaveConversation } = useSocketStore.getState();
      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
      }));
      leaveConversation(conversationId);
      const { selectedChatId, setSelectedChat } = useChatStore.getState();
      if (selectedChatId === conversationId) setSelectedChat(null);
      return;
    }

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;
        const next = contact.participants.filter((p) => p._id !== id);
        const activeCount = next.filter((p) => p.isActive !== false).length;
        return {
          ...contact,
          participants: next,
          memberCount: activeCount,
        };
      }),
    }));
  },

  handleConversationDeleted: (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    const { setSelectedChat, selectedChatId } = useChatStore.getState();

    set((state) => ({
      contacts: state.contacts.filter(
        (c) => c.conversationId !== conversationId
      ),
    }));

    const { leaveConversation } = useSocketStore.getState();
    leaveConversation(conversationId);

    if (selectedChatId === conversationId) {
      setSelectedChat(null);
    }
  },

  handleAddedToConversation: (data) => {
    const conversation = data?.conversation;
    if (!conversation) return;

    const currentUser = useAuthStore.getState().user;
    const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
      useChatStore.getState();

    const helpers = {
      getFormattedDisplayName,
      getFormattedAvatar,
      onlineUsers,
      currentUser,
    };

    const newContact = mapConversationToContact(conversation, helpers);
    if (!newContact) return;

    set((state) => ({
      contacts: [newContact, ...state.contacts].sort(
        (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
      ),
    }));

    const { joinConversation } = useSocketStore.getState();
    joinConversation(conversation.conversationId);
  },

  handleMemberRoleUpdated: (data) => {
    const { conversationId, userId, newRole, permissions } = data || {};
    if (!conversationId || !userId) return;
    const me = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;
        const updatedParticipants = contact.participants.map((p) =>
          p._id === String(userId)
            ? { ...p, role: newRole, permissions: permissions || p.permissions }
            : p
        );

        const next = { ...contact, participants: updatedParticipants };
        if (String(userId) === String(me?._id)) {
          next.currentUserRole = newRole;
          next.currentUserPermissions =
            permissions || next.currentUserPermissions;
        }
        return next;
      }),
    }));
  },

  handlePermissionsUpdated: (data) => {
    const { conversationId, permissions } = data || {};
    if (!conversationId) return;
    const me = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;
        return {
          ...contact,
          currentUserPermissions: permissions || contact.currentUserPermissions,
          participants: contact.participants.map((p) =>
            String(p._id) === String(me?._id)
              ? { ...p, permissions: permissions || p.permissions }
              : p
          ),
        };
      }),
    }));
  },

  handleMuteStatusChanged: (data) => {
    const { conversationId, isMuted, mutedUntil } = data || {};
    if (!conversationId) return;
    const me = useAuthStore.getState().user;

    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.conversationId !== conversationId) return contact;
        return {
          ...contact,
          isMuted: !!isMuted,
          mutedUntil: mutedUntil || null,
          participants: contact.participants.map((p) =>
            String(p._id) === String(me?._id)
              ? { ...p, isMuted: !!isMuted, mutedUntil: mutedUntil || null }
              : p
          ),
        };
      }),
    }));
  },

  handleJoinRequestReceived: async (data) => {
    const { conversationId, requestedUser, requester, message, source } = data || {};
    if (!conversationId || !requestedUser) return;

    // Ensure conversation is loaded
    await get().ensureConversationLoaded(conversationId);

    // Refresh conversation to get updated join requests
    try {
      const updated = await get().getConversationById(conversationId);
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const mapped = mapConversationToContact(updated, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId === conversationId ? { ...c, ...mapped } : c
        ),
      }));
    } catch (error) {
      console.error("Error refreshing conversation after join request:", error);
    }
  },

  /* =========================================================================
     HELPERS
  ========================================================================= */
  updateContactLastMessage: (conversationId, message, timestamp) => {
    set((state) => ({
      contacts: state.contacts
        .map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                lastMessage: message,
                time: toISO(timestamp),
                lastActivity: toISO(timestamp),
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
                time: toISO(tempMessage.createdAt),
                lastActivity: toISO(tempMessage.createdAt),
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

  /* =========================================================================
     PARTICIPANT & METADATA GETTERS
  ========================================================================= */
  getCurrentChatParticipant: () => {
    const state = get();
    const selectedChatId = useChatStore.getState().selectedChatId;
    if (!selectedChatId) return null;

    const contact = state.contacts.find(
      (c) => c.conversationId === selectedChatId
    );
    if (!contact || !Array.isArray(contact.participants)) return null;

    const currentUser = useAuthStore.getState().user;
    return (
      contact.participants.find(
        (p) => p._id !== currentUser?._id && p.isActive
      ) ||
      contact.participants.find((p) => p._id !== currentUser?._id) ||
      null
    );
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

  getContactByConversationId: (conversationId) =>
    get().contacts.find(
      (c) => c.conversationId === conversationId || c.id === conversationId
    ),

  isCurrentUserAdmin: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    return contact?.currentUserRole === "admin";
  },

  isCurrentUserModerator: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    return (
      contact?.currentUserRole === "admin" ||
      contact?.currentUserRole === "moderator"
    );
  },

  hasPermission: (conversationId, permission) => {
    const contact = get().getContactByConversationId(conversationId);
    if (contact?.currentUserRole === "admin") return true;
    return contact?.currentUserPermissions?.[permission] || false;
  },

  getCurrentUserParticipant: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    const currentUser = useAuthStore.getState().user;
    if (!contact || !currentUser) return null;
    return contact.participants.find((p) => p._id === currentUser._id) || null;
  },

  getActiveMembersCount: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return 0;
    return contact.participants.filter((p) => p.isActive).length;
  },

  getOnlineMembersCount: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return 0;
    return contact.participants.filter((p) => p.isOnline && p.isActive).length;
  },

  getAdmins: (conversationId) => {
    const contact = get().getContactByConversationId(conversationId);
    if (!contact) return [];
    return contact.participants.filter((p) => p.role === "admin" && p.isActive);
  },

  /* =========================================================================
     UTILITY
  ========================================================================= */
  startNewIndividualChat: async (targetUser) => {
    return get().createDirectConversation(targetUser._id);
  },

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

  clearError: () => set({ error: null }),

  clearConversationState: () =>
    set({
      contacts: [],
      publicConversations: [],
      loadingContacts: false,
      isLoading: false,
      currentAction: null,
      error: null,
    }),

  updateParticipantOnlineStatus: (userId, isOnline) => {
    const id = String(userId);
    set((state) => ({
      contacts: state.contacts.map((contact) => ({
        ...contact,
        participants: contact.participants.map((p) =>
          String(p._id) === id ? { ...p, isOnline: !!isOnline } : p
        ),
      })),
    }));
  },

  archiveConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.conversationId === conversationId ? { ...c, isArchived: true } : c
      ),
    }));
  },

  unarchiveConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.conversationId === conversationId ? { ...c, isArchived: false } : c
      ),
    }));
  },

  muteConversation: (conversationId, duration = null) => {
    const mutedUntil = duration
      ? new Date(Date.now() + duration * 60 * 60 * 1000)
      : null;

    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.conversationId === conversationId
          ? { ...c, isMuted: true, mutedUntil }
          : c
      ),
    }));
  },

  unmuteConversation: (conversationId) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.conversationId === conversationId
          ? { ...c, isMuted: false, mutedUntil: null }
          : c
      ),
    }));
  },

  searchConversations: (query) => {
    const state = get();
    const q = (query || "").toLowerCase();
    return state.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.participants.some(
          (p) =>
            p.firstName?.toLowerCase().includes(q) ||
            p.lastName?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.username?.toLowerCase().includes(q)
        )
    );
  },

  filterConversationsByType: (type) => {
    const state = get();
    return state.contacts.filter((c) => c.type === type);
  },

  getUnreadConversationsCount: () => {
    const state = get();
    return state.contacts.filter((c) => (c.unreadCount || 0) > 0).length;
  },

  getTotalUnreadCount: () => {
    const state = get();
    return state.contacts.reduce((t, c) => t + (c.unreadCount || 0), 0);
  },

  /* =========================================================================
     JOIN REQUEST MANAGEMENT
  ========================================================================= */
  requestToJoin: async (conversationId, userIds, message = "") => {
    const { isAuthenticated } = useChatStore.getState();
    if (!isAuthenticated()) {
      const error = "User not authenticated";
      set({ error });
      throw new Error(error);
    }

    set({ isLoading: true, currentAction: "requesting_join", error: null });

    try {
      // Create join requests for each user
      const results = [];
      for (const userId of userIds) {
        try {
          const response = await api.post(`${CONVERSATION_ROUTES}/${conversationId}/add`, {
            userId,
            message,
          });
          results.push({ userId, success: true, isRequest: response.data?.isRequest || false });
        } catch (err) {
          results.push({ userId, success: false, error: err.response?.data?.message || err.message });
        }
      }

      // Refresh conversation to get updated join requests
      const updated = await get().getConversationById(conversationId);
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const mapped = mapConversationToContact(updated, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId === conversationId ? { ...c, ...mapped } : c
        ),
        isLoading: false,
        currentAction: null,
      }));

      const successCount = results.filter(r => r.success).length;
      const requestCount = results.filter(r => r.isRequest).length;

      return { 
        success: successCount > 0,
        results,
        message: requestCount > 0 
          ? `${requestCount} join request(s) created. Waiting for admin approval.`
          : `${successCount} member(s) added successfully.`
      };
    } catch (err) {
      const errorMessage = get().getDetailedErrorMessage(err);
      set({ error: errorMessage, isLoading: false, currentAction: null });
      console.error("Error creating join requests:", err);
      throw new Error(errorMessage);
    }
  },

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

      // Refresh conversation to get updated state
      const updated = await get().getConversationById(conversationId);
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const mapped = mapConversationToContact(updated, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId === conversationId ? { ...c, ...mapped } : c
        ),
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

      // Refresh conversation to get updated state
      const updated = await get().getConversationById(conversationId);
      const currentUser = useAuthStore.getState().user;
      const { getFormattedDisplayName, getFormattedAvatar, onlineUsers } =
        useChatStore.getState();
      const helpers = {
        getFormattedDisplayName,
        getFormattedAvatar,
        onlineUsers,
        currentUser,
      };
      const mapped = mapConversationToContact(updated, helpers);

      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.conversationId !== conversationId ? c : { ...c, ...mapped }
        ),
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

  /* =========================================================================
     ROLE & PERMISSION MANAGEMENT
  ========================================================================= */
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

      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId !== conversationId) return contact;
          return {
            ...contact,
            participants: contact.participants.map((p) =>
              p._id === String(userId)
                ? {
                    ...p,
                    role,
                    permissions: response.data?.permissions || p.permissions,
                  }
                : p
            ),
          };
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

      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId !== conversationId) return contact;
          return {
            ...contact,
            participants: contact.participants.map((p) =>
              p._id === String(userId)
                ? {
                    ...p,
                    permissions: response.data?.permissions || permissions,
                  }
                : p
            ),
          };
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

      set((state) => ({
        contacts: state.contacts.map((contact) => {
          if (contact.conversationId !== conversationId) return contact;
          return {
            ...contact,
            participants: contact.participants.map((p) =>
              p._id === String(userId)
                ? {
                    ...p,
                    isMuted: !!isMuted,
                    mutedUntil: response.data?.mutedUntil || null,
                  }
                : p
            ),
          };
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

  /* =========================================================================
     CONVERSATION DELETION
  ========================================================================= */
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

      set((state) => ({
        contacts: state.contacts.filter(
          (c) => c.conversationId !== conversationId
        ),
        isLoading: false,
        currentAction: null,
      }));

      const { leaveConversation } = useSocketStore.getState();
      leaveConversation(conversationId);

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
}));