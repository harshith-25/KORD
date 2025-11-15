import { create } from "zustand";
import { io } from "socket.io-client";
import { useAuthStore } from "./authStore";
import { useConversationStore } from "./conversationStore";
import { HOST } from "@/utils/ApiRoutes";

let socket = null;

/**
 * Normalize common server payload differences into a consistent shape.
 */
const normalizeConversationId = (payload) =>
  payload?.conversationId ||
  payload?.conversation?.conversationId ||
  payload?.conversation?.id ||
  payload?.id;

const normalizeUserId = (payload) =>
  payload?.userId ||
  payload?.participantId ||
  payload?.memberId ||
  payload?.user?._id ||
  payload?.user;

export const useSocketStore = create((set, get) => ({
  socket: null,
  socketConnected: false,
  error: null,

  /** Track rooms to auto-rejoin on reconnect */
  joinedRooms: new Set(),

  isAuthenticated: () => {
    const auth = useAuthStore.getState().isAuthenticated;
    return typeof auth === "function" ? auth() : !!auth;
  },

  /** Initialize and connect socket */
  initializeSocket: () => {
    if (!get().isAuthenticated()) {
      console.log("User not authenticated, skipping socket initialization");
      return null;
    }

    if (socket?.connected) {
      console.log("Socket already connected:", socket.id);
      set({ socket, socketConnected: true });
      return socket;
    }

    if (socket) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    }

    socket = io(HOST, {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      forceNew: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    set({ socket, socketConnected: false, error: null });

    get().setupSocketListeners();

    return socket;
  },

  /** Attach all listeners and forward to conversationStore */
  setupSocketListeners: () => {
    if (!socket) return;

    // ---------- Core connection lifecycle ----------
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      set({ socketConnected: true, error: null });

      const rooms = Array.from(get().joinedRooms || []);
      if (rooms.length) {
        rooms.forEach((roomId) => {
          socket.emit("join_conversation", roomId);
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      set({ socketConnected: false });
    });

    socket.on("connect_error", (error) => {
      console.error("🔥 Socket connection error:", error?.message || error);
      set({
        error: `Socket connection failed: ${error?.message || "Unknown error"}`,
        socketConnected: false,
      });
    });

    // ---------- Conversation meta ----------
    socket.on("conversation_updated", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      useConversationStore.getState().handleConversationUpdated(payload);
    });

    socket.on("conversation_deleted", (payload) => {
      useConversationStore.getState().handleConversationDeleted(payload);
      const id = normalizeConversationId(payload);
      if (id) get().joinedRooms.delete(id);
    });

    socket.on("added_to_conversation", async (payload) => {
      useConversationStore.getState().handleAddedToConversation(payload);
      const convo =
        payload?.conversation?.conversationId || payload?.conversationId;
      if (convo) get().joinedRooms.add(convo);
    });

    // ---------- Participant lifecycle ----------
    socket.on("participant_joined", async (payload) => {
      const id = normalizeConversationId(payload);
      const participant =
        payload?.participant || payload?.user || payload?.member;
      if (!id || !participant) return;

      await useConversationStore.getState().ensureConversationLoaded(id);

      useConversationStore.getState().handleParticipantJoined({
        conversationId: id,
        participant,
      });
    });

    socket.on("participant_left", async (payload) => {
      const id = normalizeConversationId(payload);
      const userId = normalizeUserId(payload);
      if (!id || !userId) return;

      await useConversationStore.getState().ensureConversationLoaded(id);

      useConversationStore.getState().handleParticipantLeft({
        conversationId: id,
        userId,
      });
    });

    socket.on("participant_removed", async (payload) => {
      const id = normalizeConversationId(payload);
      const userId = normalizeUserId(payload);
      if (!id || !userId) return;

      await useConversationStore.getState().ensureConversationLoaded(id);

      useConversationStore.getState().handleParticipantRemoved({
        conversationId: id,
        userId,
      });

      const me = useAuthStore.getState().user?._id;
      if (me && userId === me) {
        get().joinedRooms.delete(id);
      }
    });

    // ---------- Join requests ----------
    socket.on("join_request_received", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      useConversationStore.getState().handleJoinRequestReceived(payload);
    });

    socket.on("join_request_approved", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      // The participant_joined event will also fire, but we refresh here too
      const updated = await useConversationStore.getState().getConversationById(id);
      if (updated) {
        useConversationStore.getState().handleParticipantJoined(payload);
      }
    });

    socket.on("join_request_rejected", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      // Refresh conversation to update join requests list
      try {
        await useConversationStore.getState().getConversationById(id);
        // The store's getConversationById will update the local state with the refreshed data
      } catch (error) {
        console.error("Error refreshing conversation after join request rejection:", error);
      }
    });

    // ---------- Roles, permissions, mute ----------
    socket.on("member_role_updated", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      useConversationStore.getState().handleMemberRoleUpdated(payload);
    });

    socket.on("permissions_updated", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      useConversationStore.getState().handlePermissionsUpdated(payload);
    });

    socket.on("mute_status_changed", async (payload) => {
      const id = normalizeConversationId(payload);
      if (!id) return;
      await useConversationStore.getState().ensureConversationLoaded(id);
      useConversationStore.getState().handleMuteStatusChanged(payload);
    });

    // ---------- Presence ----------
    socket.on("user-status-update", ({ userId, isOnline }) => {
      if (!userId) return;
      useConversationStore
        .getState()
        .updateParticipantOnlineStatus(userId, !!isOnline);
    });

    // (Message events forwarded via public on*/off* below if UI wants them)
  },

  // =========================================================================
  // EMITTERS (rooms & messaging)
  // =========================================================================
  joinConversation: (conversationId) => {
    if (!conversationId) return;
    if (socket?.connected) {
      socket.emit("join_conversation", conversationId);
      get().joinedRooms.add(conversationId);
    } else {
      get().joinedRooms.add(conversationId);
    }
  },

  leaveConversation: (conversationId) => {
    if (!conversationId) return;
    if (socket?.connected) {
      socket.emit("leave_conversation", conversationId);
    }
    get().joinedRooms.delete(conversationId);
  },

  sendMessage: (messageData) => {
    if (socket?.connected) {
      socket.emit("send_message", messageData);
    }
  },

  markMessageAsRead: (messageId, conversationId) => {
    if (socket?.connected && messageId && conversationId) {
      socket.emit("mark_message_as_read", { messageId, conversationId });
    }
  },

  markMessagesAsRead: (conversationId, userId) => {
    if (socket?.connected && conversationId && userId) {
      socket.emit("messages_read", { conversationId, userId });
    }
  },

  confirmMessageDelivery: (messageId, conversationId) => {
    if (socket?.connected && messageId && conversationId) {
      socket.emit("message_delivery_confirmed", { messageId, conversationId });
    }
  },

  emitTyping: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("typing_start", { conversationId });
    }
  },

  emitStopTyping: (conversationId) => {
    if (socket?.connected && conversationId) {
      socket.emit("typing_stop", { conversationId });
    }
  },

  // =========================================================================
  // PUBLIC LISTENER REGISTRATION (UI can subscribe)
  // =========================================================================
  onReceiveMessage: (cb) => socket && socket.on("message_received", cb),
  offReceiveMessage: (cb) =>
    socket &&
    (cb ? socket.off("message_received", cb) : socket.off("message_received")),

  onMessageRead: (cb) => socket && socket.on("message_read", cb),
  offMessageRead: (cb) =>
    socket &&
    (cb ? socket.off("message_read", cb) : socket.off("message_read")),

  onMessagesRead: (cb) => socket && socket.on("messages_read", cb),
  offMessagesRead: (cb) =>
    socket &&
    (cb ? socket.off("messages_read", cb) : socket.off("messages_read")),

  onMessageDelivered: (cb) => socket && socket.on("message_delivered", cb),
  offMessageDelivered: (cb) =>
    socket &&
    (cb ? socket.off("message_delivered", cb) : socket.off("message_delivered")),

  onMessageReaction: (cb) => socket && socket.on("message_reaction", cb),
  offMessageReaction: (cb) =>
    socket &&
    (cb ? socket.off("message_reaction", cb) : socket.off("message_reaction")),

  onMessageEdited: (cb) => socket && socket.on("message_edited", cb),
  offMessageEdited: (cb) =>
    socket &&
    (cb ? socket.off("message_edited", cb) : socket.off("message_edited")),

  onMessageDeleted: (cb) => socket && socket.on("message_deleted", cb),
  offMessageDeleted: (cb) =>
    socket &&
    (cb ? socket.off("message_deleted", cb) : socket.off("message_deleted")),

  onTyping: (cb) => socket && socket.on("typing_start", cb),
  offTyping: (cb) =>
    socket &&
    (cb ? socket.off("typing_start", cb) : socket.off("typing_start")),

  onStopTyping: (cb) => socket && socket.on("typing_stop", cb),
  offStopTyping: (cb) =>
    socket && (cb ? socket.off("typing_stop", cb) : socket.off("typing_stop")),

  onConversationUpdated: (cb) =>
    socket && socket.on("conversation_updated", cb),
  offConversationUpdated: (cb) =>
    socket &&
    (cb
      ? socket.off("conversation_updated", cb)
      : socket.off("conversation_updated")),

  onParticipantJoined: (cb) => socket && socket.on("participant_joined", cb),
  offParticipantJoined: (cb) =>
    socket &&
    (cb
      ? socket.off("participant_joined", cb)
      : socket.off("participant_joined")),

  onParticipantLeft: (cb) => socket && socket.on("participant_left", cb),
  offParticipantLeft: (cb) =>
    socket &&
    (cb ? socket.off("participant_left", cb) : socket.off("participant_left")),

  // >>> Added for compatibility with your chatStore <<<
  onUserStatusUpdate: (cb) => socket && socket.on("user-status-update", cb),
  offUserStatusUpdate: (cb) =>
    socket &&
    (cb
      ? socket.off("user-status-update", cb)
      : socket.off("user-status-update")),
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  // =========================================================================
  // CONNECTION MGMT
  // =========================================================================
  reconnectSocket: () => {
    if (socket) {
      socket.connect();
    } else {
      get().initializeSocket();
    }
  },

  disconnectSocket: () => {
    try {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
    } finally {
      socket = null;
      set({ socket: null, socketConnected: false, error: null });
      get().joinedRooms.clear();
    }
  },

  getSocket: () => socket,

  isConnected: () => get().socketConnected && !!socket?.connected,

  clearError: () => set({ error: null }),

  cleanup: () => {
    try {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
    } finally {
      socket = null;
      set({ socket: null, socketConnected: false, error: null });
      get().joinedRooms.clear();
    }
  },
}));