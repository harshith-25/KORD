// This hook would connect to your Socket.IO backend and handle real-time events.
// You'll need to install 'socket.io-client': npm install socket.io-client
import { useEffect, useRef } from "react";
import io from "socket.io-client";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { HOST } from "@/utils/ApiRoutes"; // Use your backend HOST for socket connection

export const useChatSocket = () => {
  const socketRef = useRef(null);
  const addMessage = useChatStore((state) => state.addMessage);
  const addTypingUser = useChatStore((state) => state.addTypingUser);
  const removeTypingUser = useChatStore((state) => state.removeTypingUser);
  const user = useAuthStore.getState().user; // Get user from auth store directly

  useEffect(() => {
    if (!user) return; // Don't connect if no user

    // Connect to Socket.IO server
    socketRef.current = io(HOST, {
      auth: {
        token: localStorage.getItem("jwtToken"), // Send token for authentication
      },
      transports: ["websocket", "polling"], // Prioritize websocket
    });

    // Event Listeners
    socketRef.current.on("connect", () => {
      console.log("Socket.IO connected:", socketRef.current.id);
      // Emit a 'join' event for the user if necessary
      // socketRef.current.emit('joinUser', user.id);
    });

    socketRef.current.on("receiveMessage", (message) => {
      console.log("Received message:", message);
      addMessage(message);
    });

    socketRef.current.on("user typing", ({ userId, chatId }) => {
      console.log(`User ${userId} is typing in chat ${chatId}`);
      if (chatId === useChatStore.getState().activeChatId) {
        // Check if it's the active chat
        addTypingUser(userId);
      }
    });

    socketRef.current.on("user stop typing", ({ userId, chatId }) => {
      console.log(`User ${userId} stopped typing in chat ${chatId}`);
      if (chatId === useChatStore.getState().activeChatId) {
        removeTypingUser(userId);
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket.IO disconnected");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      // Handle specific errors, e.g., invalid token
      if (error.message === "Authentication error") {
        useAuthStore.getState().logout(); // Logout if token is invalid
        // Optionally redirect to login
      }
    });

    // Clean up on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, addMessage, addTypingUser, removeTypingUser]); // Reconnect if user changes

  // Function to emit messages/typing events
  const emit = (eventName, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(eventName, data);
    } else {
      console.warn("Socket not connected. Cannot emit event:", eventName);
    }
  };

  return { socket: socketRef.current, emit };
};