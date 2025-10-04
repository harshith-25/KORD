import { create } from "zustand";
import { io } from "socket.io-client";
import { useAuthStore } from "./authStore";
import { HOST } from "@/utils/ApiRoutes";

let socket;

export const useSocketStore = create((set, get) => ({
  socket: null,
  socketConnected: false,
  error: null,

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
      set({ socket, socketConnected: true });
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

    get().setupSocketListeners();

    set({ socket, socketConnected: false });
    return socket;
  },

  setupSocketListeners: () => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      set({ socketConnected: true, error: null });
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      set({ socketConnected: false });
    });

    socket.on("connect_error", (error) => {
      console.error("🔥 Socket connection error:", error);
      set({
        error: `Socket connection failed: ${error.message}`,
        socketConnected: false,
      });
    });
  },

  // =========================================================================
  // SOCKET EVENT EMITTERS
  // =========================================================================

  joinConversation: (conversationId) => {
    if (socket?.connected && conversationId) {
      console.log("Joining conversation:", conversationId);
      socket.emit("join_conversation", conversationId);
    }
  },

  leaveConversation: (conversationId) => {
    if (socket?.connected && conversationId) {
      console.log("Leaving conversation:", conversationId);
      socket.emit("leave_conversation", conversationId);
    }
  },

  sendMessage: (messageData) => {
    if (socket?.connected) {
      socket.emit("send_message", messageData);
    }
  },

  markMessageAsRead: (messageId, conversationId) => {
    if (socket?.connected && messageId && conversationId) {
      socket.emit("mark_message_as_read", {
        messageId,
        conversationId,
      });
    }
  },

  markMessagesAsRead: (conversationId, userId) => {
    if (socket?.connected && conversationId && userId) {
      socket.emit("messages_read", {
        conversationId,
        userId,
      });
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
  // SOCKET EVENT LISTENERS
  // =========================================================================

  onReceiveMessage: (callback) => {
    if (socket) {
      socket.on("message_received", callback);
    }
  },

  offReceiveMessage: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_received", callback);
      } else {
        socket.off("message_received");
      }
    }
  },

  onMessageRead: (callback) => {
    if (socket) {
      socket.on("message_read", callback);
    }
  },

  offMessageRead: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_read", callback);
      } else {
        socket.off("message_read");
      }
    }
  },

  onMessagesRead: (callback) => {
    if (socket) {
      socket.on("messages_read", callback);
    }
  },

  offMessagesRead: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("messages_read", callback);
      } else {
        socket.off("messages_read");
      }
    }
  },

  onMessageReadError: (callback) => {
    if (socket) {
      socket.on("message_read_error", callback);
    }
  },

  offMessageReadError: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_read_error", callback);
      } else {
        socket.off("message_read_error");
      }
    }
  },

  // NEW: Reaction events
  onMessageReaction: (callback) => {
    if (socket) {
      socket.on("message_reaction", callback);
    }
  },

  offMessageReaction: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_reaction", callback);
      } else {
        socket.off("message_reaction");
      }
    }
  },

  // NEW: Edit events
  onMessageEdited: (callback) => {
    if (socket) {
      socket.on("message_edited", callback);
    }
  },

  offMessageEdited: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_edited", callback);
      } else {
        socket.off("message_edited");
      }
    }
  },

  // NEW: Delete events
  onMessageDeleted: (callback) => {
    if (socket) {
      socket.on("message_deleted", callback);
    }
  },

  offMessageDeleted: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("message_deleted", callback);
      } else {
        socket.off("message_deleted");
      }
    }
  },

  onUserStatusUpdate: (callback) => {
    if (socket) {
      socket.on("user-status-update", callback);
    }
  },

  offUserStatusUpdate: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("user-status-update", callback);
      } else {
        socket.off("user-status-update");
      }
    }
  },

  onTyping: (callback) => {
    if (socket) {
      socket.on("typing_start", callback);
    }
  },

  offTyping: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("typing_start", callback);
      } else {
        socket.off("typing_start");
      }
    }
  },

  onStopTyping: (callback) => {
    if (socket) {
      socket.on("typing_stop", callback);
    }
  },

  offStopTyping: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("typing_stop", callback);
      } else {
        socket.off("typing_stop");
      }
    }
  },

  onConversationUpdated: (callback) => {
    if (socket) {
      socket.on("conversation_updated", callback);
    }
  },

  offConversationUpdated: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("conversation_updated", callback);
      } else {
        socket.off("conversation_updated");
      }
    }
  },

  onParticipantJoined: (callback) => {
    if (socket) {
      socket.on("participant_joined", callback);
    }
  },

  offParticipantJoined: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("participant_joined", callback);
      } else {
        socket.off("participant_joined");
      }
    }
  },

  onParticipantLeft: (callback) => {
    if (socket) {
      socket.on("participant_left", callback);
    }
  },

  offParticipantLeft: (callback) => {
    if (socket) {
      if (callback) {
        socket.off("participant_left", callback);
      } else {
        socket.off("participant_left");
      }
    }
  },

  // =========================================================================
  // CONNECTION MANAGEMENT
  // =========================================================================

  reconnectSocket: () => {
    if (socket) {
      socket.connect();
    } else {
      get().initializeSocket();
    }
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    set({ socket: null, socketConnected: false, error: null });
  },

  getSocket: () => socket,

  isConnected: () => get().socketConnected && socket?.connected,

  clearError: () => {
    set({ error: null });
  },

  cleanup: () => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    set({
      socket: null,
      socketConnected: false,
      error: null,
    });
  },
}));