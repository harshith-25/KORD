import { create } from "zustand";
import { io } from "socket.io-client";
import { useAuthStore } from "./authStore";
import { HOST } from "@/utils/ApiRoutes";

const SOCKET_SERVER_URL = HOST;
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

    // If socket exists and is connected, return it
    if (socket?.connected) {
      console.log("Socket already connected:", socket.id);
      set({ socket, socketConnected: true });
      return socket;
    }

    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
    }

    socket = io(SOCKET_SERVER_URL, {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      forceNew: true,
      transports: ["websocket", "polling"],
    });

    // Set up event listeners
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

  // Socket event emitters
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

  markMessagesAsRead: (conversationId, userId) => {
    if (socket?.connected && conversationId && userId) {
      socket.emit("messages_read", {
        conversationId,
        userId,
      });
    }
  },

  // Socket event listeners management
  onReceiveMessage: (callback) => {
    if (socket) {
      socket.on("receive_message", callback);
    }
  },

  offReceiveMessage: (callback) => {
    if (socket) {
      socket.off("receive_message", callback);
    }
  },

  onUserStatusChange: (callback) => {
    if (socket) {
      socket.on("user_status_change", callback);
    }
  },

  offUserStatusChange: (callback) => {
    if (socket) {
      socket.off("user_status_change", callback);
    }
  },

  onTyping: (callback) => {
    if (socket) {
      socket.on("typing", callback);
    }
  },

  offTyping: (callback) => {
    if (socket) {
      socket.off("typing", callback);
    }
  },

  onStopTyping: (callback) => {
    if (socket) {
      socket.on("stop_typing", callback);
    }
  },

  offStopTyping: (callback) => {
    if (socket) {
      socket.off("stop_typing", callback);
    }
  },

  // Typing indicators
  emitTyping: (conversationId, userId) => {
    if (socket?.connected) {
      socket.emit("typing", { conversationId, userId });
    }
  },

  emitStopTyping: (conversationId, userId) => {
    if (socket?.connected) {
      socket.emit("stop_typing", { conversationId, userId });
    }
  },

  // Connection management
  handleConnectionChange: (isConnected) => {
    set({ socketConnected: isConnected });
  },

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

  // Utility methods
  getSocket: () => socket,

  isConnected: () => get().socketConnected && socket?.connected,

  clearError: () => {
    set({ error: null });
  },

  // Clean up resources
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



// import { create } from "zustand";
// import { io } from "socket.io-client";
// import { useAuthStore } from "./authStore";
// import { HOST } from "@/utils/ApiRoutes";

// const SOCKET_SERVER_URL = HOST;
// let socket;

// export const useSocketStore = create((set, get) => ({
//   socket: null,
//   socketConnected: false,
//   error: null,
//   onlineUsers: new Map(),

//   isAuthenticated: () => {
//     return useAuthStore.getState().isAuthenticated;
//   },

//   initializeSocket: () => {
//     if (!get().isAuthenticated()) {
//       console.log("User not authenticated, skipping socket initialization");
//       return null;
//     }

//     // If socket exists and is connected, return it
//     if (socket?.connected) {
//       console.log("Socket already connected:", socket.id);
//       set({ socket, socketConnected: true });
//       return socket;
//     }

//     // Disconnect existing socket if any
//     if (socket) {
//       socket.disconnect();
//     }

//     // Get token and ensure it exists
//     const token = localStorage.getItem("token");
//     if (!token) {
//       console.error("No token found in localStorage");
//       set({ error: "Authentication token not found" });
//       return null;
//     }

//     console.log("Initializing socket connection to:", SOCKET_SERVER_URL);

//     socket = io(SOCKET_SERVER_URL, {
//       withCredentials: true,
//       auth: { token }, // This matches your backend authentication
//       forceNew: true,
//       transports: ["websocket", "polling"], // Allow fallback to polling
//       timeout: 20000, // 20 second timeout
//       reconnection: true,
//       reconnectionDelay: 1000,
//       reconnectionAttempts: 5,
//     });

//     // Set up event listeners
//     get().setupSocketListeners();

//     set({ socket, socketConnected: false });
//     return socket;
//   },

//   setupSocketListeners: () => {
//     if (!socket) return;

//     socket.on("connect", () => {
//       console.log("✅ Socket connected:", socket.id);
//       set({ socketConnected: true, error: null });
//     });

//     socket.on("disconnect", (reason) => {
//       console.log("❌ Socket disconnected:", reason);
//       set({ socketConnected: false });
//     });

//     socket.on("connect_error", (error) => {
//       console.error("🔥 Socket connection error:", error);
//       set({
//         error: `Socket connection failed: ${error.message}`,
//         socketConnected: false,
//       });
//     });

//     // Listen for authentication errors
//     socket.on("error", (error) => {
//       console.error("Socket error:", error);
//       set({ error: error.message || "Socket error occurred" });
//     });

//     // *** MESSAGE HANDLERS - MATCH BACKEND EVENTS ***
    
//     // Listen for new direct messages
//     socket.on("newDirectMessage", (messageData) => {
//       console.log("📨 New direct message received:", messageData);
//       // Trigger callback if any component is listening
//       const callbacks = get().messageCallbacks || [];
//       callbacks.forEach(callback => callback(messageData, 'direct'));
//     });

//     // Listen for new channel messages
//     socket.on("newChannelMessage", (messageData) => {
//       console.log("📨 New channel message received:", messageData);
//       // Trigger callback if any component is listening
//       const callbacks = get().messageCallbacks || [];
//       callbacks.forEach(callback => callback(messageData, 'channel'));
//     });

//     // Message confirmation (when your message is sent successfully)
//     socket.on("messageConfirmation", (messageData) => {
//       console.log("✅ Message sent successfully:", messageData);
//       const callbacks = get().confirmationCallbacks || [];
//       callbacks.forEach(callback => callback(messageData));
//     });

//     // Message errors
//     socket.on("messageError", (error) => {
//       console.error("❌ Message error:", error);
//       const callbacks = get().errorCallbacks || [];
//       callbacks.forEach(callback => callback(error));
//     });

//     // *** USER STATUS HANDLERS ***
    
//     socket.on("user-status-update", (data) => {
//       console.log("👤 User status update:", data);
//       const callbacks = get().statusCallbacks || [];
//       callbacks.forEach(callback => callback(data));
//     });

//     // *** TYPING INDICATORS ***
    
//     socket.on("user-typing", (data) => {
//       console.log("⌨️ User typing:", data);
//       const callbacks = get().typingCallbacks || [];
//       callbacks.forEach(callback => callback(data));
//     });

//     socket.on("user-stopped-typing", (data) => {
//       console.log("⌨️ User stopped typing:", data);
//       const callbacks = get().stopTypingCallbacks || [];
//       callbacks.forEach(callback => callback(data));
//     });

//     // *** READ RECEIPTS ***
    
//     socket.on("message-read", (data) => {
//       console.log("📖 Message read:", data);
//       const callbacks = get().readReceiptCallbacks || [];
//       callbacks.forEach(callback => callback(data));
//     });

//     // *** CHANNEL MANAGEMENT ***
    
//     socket.on("channelJoined", (data) => {
//       console.log("🏠 Channel joined:", data);
//     });

//     socket.on("channelLeft", (data) => {
//       console.log("🚪 Channel left:", data);
//     });

//     socket.on("channelJoinError", (error) => {
//       console.error("❌ Channel join error:", error);
//     });
//   },

//   // *** MESSAGE SENDING FUNCTIONS ***
  
//   sendDirectMessage: (recipientId, content, messageType = "text") => {
//     if (socket?.connected) {
//       console.log("📤 Sending direct message:", { recipientId, content, messageType });
//       socket.emit("sendDirectMessage", {
//         recipientId,
//         content,
//         messageType
//       });
//     } else {
//       console.error("Socket not connected - cannot send direct message");
//     }
//   },

//   sendChannelMessage: (channelId, content, messageType = "text") => {
//     if (socket?.connected) {
//       console.log("📤 Sending channel message:", { channelId, content, messageType });
//       socket.emit("sendChannelMessage", {
//         channelId,
//         content,
//         messageType
//       });
//     } else {
//       console.error("Socket not connected - cannot send channel message");
//     }
//   },

//   // *** CHANNEL MANAGEMENT ***
  
//   joinChannel: (channelId) => {
//     if (socket?.connected && channelId) {
//       console.log("🏠 Joining channel:", channelId);
//       socket.emit("joinChannel", { channelId });
//     }
//   },

//   leaveChannel: (channelId) => {
//     if (socket?.connected && channelId) {
//       console.log("🚪 Leaving channel:", channelId);
//       socket.emit("leaveChannel", { channelId });
//     }
//   },

//   // *** TYPING INDICATORS ***
  
//   startTyping: (chatId, chatType) => {
//     if (socket?.connected) {
//       socket.emit("typing", { chatId, chatType });
//     }
//   },

//   stopTyping: (chatId, chatType) => {
//     if (socket?.connected) {
//       socket.emit("stopTyping", { chatId, chatType });
//     }
//   },

//   // *** READ RECEIPTS ***
  
//   markMessageAsRead: (messageId, chatId, chatType) => {
//     if (socket?.connected) {
//       socket.emit("messageRead", { messageId, chatId, chatType });
//     }
//   },

//   // *** CALLBACK MANAGEMENT ***
  
//   // Store callback arrays in the state
//   messageCallbacks: [],
//   confirmationCallbacks: [],
//   errorCallbacks: [],
//   statusCallbacks: [],
//   typingCallbacks: [],
//   stopTypingCallbacks: [],
//   readReceiptCallbacks: [],

//   // Functions to add/remove message listeners
//   onNewMessage: (callback) => {
//     set(state => ({
//       messageCallbacks: [...(state.messageCallbacks || []), callback]
//     }));
//   },

//   offNewMessage: (callback) => {
//     set(state => ({
//       messageCallbacks: (state.messageCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onMessageConfirmation: (callback) => {
//     set(state => ({
//       confirmationCallbacks: [...(state.confirmationCallbacks || []), callback]
//     }));
//   },

//   offMessageConfirmation: (callback) => {
//     set(state => ({
//       confirmationCallbacks: (state.confirmationCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onMessageError: (callback) => {
//     set(state => ({
//       errorCallbacks: [...(state.errorCallbacks || []), callback]
//     }));
//   },

//   offMessageError: (callback) => {
//     set(state => ({
//       errorCallbacks: (state.errorCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onUserStatusUpdate: (callback) => {
//     set(state => ({
//       statusCallbacks: [...(state.statusCallbacks || []), callback]
//     }));
//   },

//   offUserStatusUpdate: (callback) => {
//     set(state => ({
//       statusCallbacks: (state.statusCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onTyping: (callback) => {
//     set(state => ({
//       typingCallbacks: [...(state.typingCallbacks || []), callback]
//     }));
//   },

//   offTyping: (callback) => {
//     set(state => ({
//       typingCallbacks: (state.typingCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onStopTyping: (callback) => {
//     set(state => ({
//       stopTypingCallbacks: [...(state.stopTypingCallbacks || []), callback]
//     }));
//   },

//   offStopTyping: (callback) => {
//     set(state => ({
//       stopTypingCallbacks: (state.stopTypingCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   onReadReceipt: (callback) => {
//     set(state => ({
//       readReceiptCallbacks: [...(state.readReceiptCallbacks || []), callback]
//     }));
//   },

//   offReadReceipt: (callback) => {
//     set(state => ({
//       readReceiptCallbacks: (state.readReceiptCallbacks || []).filter(cb => cb !== callback)
//     }));
//   },

//   // *** CONNECTION MANAGEMENT ***
  
//   reconnectSocket: () => {
//     if (socket) {
//       socket.connect();
//     } else {
//       get().initializeSocket();
//     }
//   },

//   disconnectSocket: () => {
//     if (socket) {
//       socket.disconnect();
//       socket = null;
//     }
//     set({ 
//       socket: null, 
//       socketConnected: false, 
//       error: null,
//       messageCallbacks: [],
//       confirmationCallbacks: [],
//       errorCallbacks: [],
//       statusCallbacks: [],
//       typingCallbacks: [],
//       stopTypingCallbacks: [],
//       readReceiptCallbacks: []
//     });
//   },

//   // *** UTILITY METHODS ***
  
//   getSocket: () => socket,

//   isConnected: () => get().socketConnected && socket?.connected,

//   clearError: () => {
//     set({ error: null });
//   },

//   // Clean up resources
//   cleanup: () => {
//     if (socket) {
//       socket.removeAllListeners();
//       socket.disconnect();
//       socket = null;
//     }
//     set({
//       socket: null,
//       socketConnected: false,
//       error: null,
//       messageCallbacks: [],
//       confirmationCallbacks: [],
//       errorCallbacks: [],
//       statusCallbacks: [],
//       typingCallbacks: [],
//       stopTypingCallbacks: [],
//       readReceiptCallbacks: []
//     });
//   },
// }));