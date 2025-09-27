import { useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSocketStore } from "@/store/socketStore";
import { useChatStore } from "@/store/chatStore";

export const useRealtimeChat = () => {
  const { isAuthenticated, user } = useAuthStore();
  const {
    initializeSocket,
    isConnected,
    socket,
    socketConnected,
    addEventListener,
    removeEventListener,
  } = useSocketStore();

  const {
    initializeMessageHandling,
    handleConnectionStateChange,
    selectedChatId,
  } = useChatStore();

  const isInitialized = useRef(false);
  const connectionTimeoutRef = useRef(null);

  // Initialize socket connection when user is authenticated
  const initializeConnection = useCallback(() => {
    if (!isAuthenticated || isInitialized.current) {
      return;
    }

    console.log("🔄 Initializing real-time chat connection...");

    // Clear any existing timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    // Initialize socket with timeout fallback
    const socketInstance = initializeSocket();

    if (socketInstance) {
      isInitialized.current = true;

      // Set up connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected()) {
          console.warn("⚠️ Socket connection timeout, attempting reconnect...");
          initializeSocket();
        }
      }, 10000); // 10 second timeout

      console.log("✅ Real-time chat connection initialized");
    }
  }, [isAuthenticated, initializeSocket, isConnected]);

  // Clean up connection
  const cleanupConnection = useCallback(() => {
    console.log("🧹 Cleaning up real-time chat connection...");

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    isInitialized.current = false;
  }, []);

  // Handle connection state changes
  useEffect(() => {
    handleConnectionStateChange(socketConnected);
  }, [socketConnected, handleConnectionStateChange]);

  // Initialize when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeConnection();
    } else {
      cleanupConnection();
    }

    return cleanupConnection;
  }, [isAuthenticated, user, initializeConnection, cleanupConnection]);

  // Set up message handling when socket is ready
  useEffect(() => {
    if (socketConnected && isAuthenticated) {
      initializeMessageHandling();
    }
  }, [socketConnected, isAuthenticated, initializeMessageHandling]);

  // Handle page visibility changes to maintain connection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        // Page became visible, check connection
        if (!isConnected()) {
          console.log("📱 Page visible, reconnecting...");
          initializeConnection();
        }
      }
    };

    const handleOnline = () => {
      if (isAuthenticated && !isConnected()) {
        console.log("🌐 Network online, reconnecting...");
        initializeConnection();
      }
    };

    const handleOffline = () => {
      console.log("📴 Network offline");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isAuthenticated, isConnected, initializeConnection]);

  // Connection status and utilities
  return {
    isConnected: socketConnected,
    isInitialized: isInitialized.current,
    socket,

    // Manual control methods
    reconnect: initializeConnection,
    disconnect: cleanupConnection,

    // Connection status helpers
    getConnectionStatus: () => ({
      connected: socketConnected,
      authenticated: isAuthenticated,
      initialized: isInitialized.current,
      hasSocket: !!socket,
    }),
  };
};

// Optional: Hook for typing indicators
export const useTypingIndicator = (conversationId) => {
  const { emitTyping, emitStopTyping } = useChatStore();
  const { isConnected } = useSocketStore();
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!isConnected() || !conversationId) return;

    if (!isTypingRef.current) {
      emitTyping(conversationId);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        emitStopTyping(conversationId);
        isTypingRef.current = false;
      }
    }, 1000); // Stop typing after 1 second of inactivity
  }, [conversationId, emitTyping, emitStopTyping, isConnected]);

  const stopTyping = useCallback(() => {
    if (!isConnected() || !conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTypingRef.current) {
      emitStopTyping(conversationId);
      isTypingRef.current = false;
    }
  }, [conversationId, emitStopTyping, isConnected]);

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        stopTyping();
      }
    };
  }, [conversationId, stopTyping]);

  return {
    startTyping,
    stopTyping,
    isTyping: isTypingRef.current,
  };
};

// Hook for connection health monitoring
export const useConnectionHealth = () => {
  const { socketConnected, reconnectAttempts, maxReconnectAttempts } =
    useSocketStore();
  const { isAuthenticated } = useAuthStore();

  const connectionHealth = {
    status: socketConnected ? "connected" : "disconnected",
    isHealthy: socketConnected && isAuthenticated,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectProgress:
      reconnectAttempts > 0
        ? (reconnectAttempts / maxReconnectAttempts) * 100
        : 0,
  };

  const getHealthIndicator = () => {
    if (!isAuthenticated) return { color: "gray", text: "Not authenticated" };
    if (socketConnected) return { color: "green", text: "Connected" };
    if (reconnectAttempts > 0)
      return { color: "orange", text: "Reconnecting..." };
    return { color: "red", text: "Disconnected" };
  };

  return {
    ...connectionHealth,
    indicator: getHealthIndicator(),
  };
};