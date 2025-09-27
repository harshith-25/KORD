import { io } from "socket.io-client";
import { HOST } from "@/utils/ApiRoutes";
import { useAuthStore } from "./authStore";

const SOCKET_SERVER_URL = HOST;
let socket = null;

export const initializeSocket = (set, get) => {
  // Pass the set and get from the Zustand store
  const storeSet = set;
  const storeGet = get;

  if (!storeGet().isAuthenticated()) {
    console.log("User not authenticated, skipping socket initialization");
    return null;
  }

  if (socket && socket.connected) {
    console.log("Socket already connected.");
    return socket;
  }

  if (socket && !socket.connected && storeGet().socketConnected) {
    console.log("Socket disconnected, attempting reconnect...");
    socket.connect();
    return socket;
  }

  if (socket && !socket.connected) {
    console.log("Socket instance exists but is not connected, reusing it.");
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_SERVER_URL, {
    withCredentials: true,
    auth: { token: localStorage.getItem("token") },
  });

  // Attach event listeners to the new socket instance
  socket.on("connect", () => {
    console.log("Socket.IO connected:", socket.id);
    storeGet().setSocketConnected(true);
    const selectedChatId = storeGet().selectedChatId;
    if (selectedChatId) {
      socket.emit("join_conversation", selectedChatId);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket.IO disconnected:", reason);
    storeGet().setSocketConnected(false);
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
      storeSet({ error: `Socket connection failed: ${error.message}` });
    }
  });

  // Delegate event handling to the chat store's public methods
  socket.on("receive_message", (message) => {
    console.log("Received message:", message);
    storeGet().handleReceiveMessage(message);
  });

  socket.on("message_delivered", (data) => {
    console.log(
      `Message ${data.messageId} delivered in ${data.conversationId}`
    );
    storeGet().handleMessageDelivered(data);
  });

  socket.on("messages_read", (data) => {
    console.log(`Messages in ${data.conversationId} read by ${data.userId}`);
    storeGet().handleMessagesRead(data);
  });

  socket.on("message_error", (data) => {
    console.error("Message error from server:", data);
    storeGet().handleMessageError(data);
  });

  return socket;
};

export const getSocket = () => socket;