import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/utils/axiosInstance";
import { useAuthStore } from "./authStore";
import { useSocketStore } from "./socketStore";
import { useConversationStore } from "./conversationStore";
import { useChatStore } from "./chatStore";
import {
  HOST,
  SEND_MESSAGE_ROUTE,
  SEARCH_MESSAGES_ROUTE,
  GET_ALL_MESSAGES_ROUTE,
  EDIT_MESSAGE_ROUTE,
  DELETE_MESSAGE_ROUTE,
  ADD_REACTION_ROUTE,
  REMOVE_REACTION_ROUTE,
  FORWARD_MESSAGE_ROUTE,
} from "@/utils/ApiRoutes";

// Helper function to process raw message objects into a consistent format
const processRawMessage = (msg, currentUser, getMessageStatus) => {
  if (!msg || typeof msg !== "object") return null;

  const msgSender = msg.sender;
  const msgSenderId = typeof msgSender === "object" ? msgSender._id : msgSender;
  const messageId =
    msg._id?.toString() || msg.id || `temp-${Date.now()}-${Math.random()}`;

  const messageStatus = getMessageStatus(
    { ...msg, senderId: msgSenderId },
    currentUser?._id
  );

  // Ensure file paths are absolute if they exist and are relative
  let filePath = msg.file?.filePath || msg.media?.[0]?.file?.filePath;
  if (
    filePath &&
    typeof filePath === "string" &&
    !filePath.startsWith("http")
  ) {
    filePath = `${HOST}${filePath}`;
  }

  return {
    ...msg,
    id: messageId,
    _id: msg._id,
    content: msg.content || msg.text || msg.message || "",
    text: msg.content || msg.text || msg.message || "",
    createdAt:
      msg.createdAt || msg.time || msg.timestamp || new Date().toISOString(),
    time:
      msg.createdAt || msg.time || msg.timestamp || new Date().toISOString(),
    timestamp: msg.createdAt || msg.time || msg.timestamp,
    type:
      msgSenderId?.toString() === currentUser?._id?.toString()
        ? "sent"
        : "received",
    status: messageStatus,
    deliveryStatus: messageStatus,
    sender: msgSender,
    senderId: msgSenderId,
    readBy: msg.readBy || [],
    reactions: msg.reactions || [],
    isEdited: msg.isEdited || false,
    isDeleted: msg.isDeleted || false,
    isForwarded: msg.isForwarded || false,
    file: msg.file ? { ...msg.file, filePath } : undefined,
    media: msg.media,
    metadata: msg.metadata || {},
  };
};

export const useMessageStore = create(
  persist(
    (set, get) => ({
      messages: {},
      loadingMessages: false,
      error: null,
      socketListenersInitialized: false,
      pendingOptimisticMessages: new Map(),
      // NEW: Add pagination tracking
      messagePagination: {}, // { conversationId: { page, hasMore, totalPages } }
      // ==================== HELPER FUNCTIONS ====================

      calculateMessageStatus: (message, currentUserId) => {
        const isSentByCurrentUser =
          (message.senderId || message.sender?._id)?.toString() ===
          currentUserId?.toString();

        if (!isSentByCurrentUser) return "received";

        // Handle sending and failed states
        if (
          message.status === "sending" ||
          message.deliveryStatus === "sending"
        )
          return "sending";
        if (message.status === "failed" || message.deliveryStatus === "failed")
          return "failed";

        // For sent messages, check read receipts like WhatsApp
        const readBy = message.readBy || [];

        // If no read receipts yet, it's just sent
        if (readBy.length === 0) return "sent";

        // Check if anyone other than the sender has read it
        const othersRead = readBy.some((receipt) => {
          const receiptUserId = receipt.user?._id || receipt.user;
          return receiptUserId?.toString() !== currentUserId?.toString();
        });

        if (othersRead) {
          // Someone else has read it - mark as read
          return "read";
        } else {
          // Only sender has read it - mark as delivered
          return "delivered";
        }
      },

      updateMessageReadStatus: (
        conversationId,
        messageId,
        readerId,
        readAt
      ) => {
        set((state) => {
          const messages = state.messages[conversationId] || [];
          const currentUser = useAuthStore.getState().user;

          console.log(
            `🔄 Updating read status for message ${messageId} by user ${readerId}`
          );

          const updatedMessages = messages.map((msg) => {
            if (msg._id === messageId || msg.id === messageId) {
              const readBy = [...(msg.readBy || [])];
              const alreadyRead = readBy.some((receipt) => {
                const userId =
                  typeof receipt === "object"
                    ? receipt.user?._id || receipt.user
                    : receipt;
                return userId?.toString() === readerId.toString();
              });

              if (!alreadyRead) {
                readBy.push({ user: readerId, readAt: readAt || new Date() });
                console.log(`✅ Added read receipt for message ${messageId}`);
              }

              const newStatus = get().calculateMessageStatus(
                { ...msg, readBy },
                currentUser?._id
              );

              console.log(
                `📊 Message ${messageId} status updated to: ${newStatus}`
              );

              return {
                ...msg,
                readBy,
                status: newStatus,
                deliveryStatus: newStatus,
              };
            }
            return msg;
          });

          return {
            messages: { ...state.messages, [conversationId]: updatedMessages },
          };
        });
      },

      // ==================== SOCKET EVENT LISTENERS SETUP ====================

      initializeSocketListeners: () => {
        const socketStore = useSocketStore.getState();

        if (get().socketListenersInitialized) {
          console.log("Socket listeners already initialized");
          return;
        }

        // --- Message Reception Handler ---
        socketStore.onReceiveMessage((message) => {
          console.log("📩 Real-time message received:", message);

          const currentUser = useAuthStore.getState().user;
          const senderId = message.sender?._id || message.senderId;
          const isOwnMessage =
            senderId?.toString() === currentUser?._id?.toString();

          if (isOwnMessage) {
            // This is our own message coming back from server
            console.log("🔄 Received echo of own message from server");

            // Try to resolve optimistic message
            const resolved = get().resolveOptimisticMessage(
              message.conversationId,
              message
            );

            if (!resolved) {
              // No pending optimistic message found - might be from another session/tab
              console.log(
                "ℹ️ No pending optimistic message - adding as new (from other session?)"
              );
              get().addMessage(message.conversationId, message);
            }

            // Update conversation store with the final message
            useConversationStore
              .getState()
              .updateContactForOptimisticSend(message.conversationId, message);
          } else {
            // Message from another user - add it
            console.log("➕ Adding message from other user");
            get().addMessage(message.conversationId, message);

            // Update conversation store with the new message
            const displayMessage = message.media
              ? `📎 ${
                  message.type === "image"
                    ? "Image"
                    : message.type === "video"
                    ? "Video"
                    : "File"
                }`
              : message.content;

            useConversationStore
              .getState()
              .updateContactLastMessage(
                message.conversationId,
                displayMessage,
                message.createdAt || message.timestamp
              );

            // Auto-mark as read if conversation is open
            const currentConversation =
              useChatStore.getState().currentConversation;
            if (
              currentConversation === message.conversationId &&
              currentUser?._id
            ) {
              // Use the REST API to mark messages as read instead of socket
              // This ensures proper persistence
              setTimeout(() => {
                fetch(
                  `/api/messages/${message.conversationId}?page=1&limit=50`,
                  {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                      "Content-Type": "application/json",
                    },
                  }
                ).catch((err) => console.log("Auto-mark read failed:", err));
              }, 100);
            } else {
              // Increment unread count if not the current conversation
              useConversationStore
                .getState()
                .incrementUnreadCount(message.conversationId);
            }
          }
        });

        // --- Single Message Read Receipt ---
        socketStore.onMessageRead(
          ({ messageId, readerId, conversationId, readAt }) => {
            console.log("👁️ Single message read event:", {
              messageId,
              readerId,
              conversationId,
              readAt,
            });
            get().updateMessageReadStatus(
              conversationId,
              messageId,
              readerId,
              readAt
            );
          }
        );

        // --- Bulk Messages Read Receipt ---
        socketStore.onMessagesRead(({ conversationId, userId, count }) => {
          console.log(
            `👁️ Bulk read event: ${count} messages read by user ${userId} in ${conversationId}`
          );

          const messages = get().messages[conversationId] || [];
          const currentUser = useAuthStore.getState().user;

          // Don't update read receipts for own messages
          if (userId?.toString() === currentUser?._id?.toString()) {
            console.log("Ignoring read receipt from self");
            return;
          }

          set((state) => {
            const updatedMessages = messages.map((msg) => {
              const isSentByMe =
                (msg.senderId || msg.sender?._id)?.toString() ===
                currentUser?._id?.toString();

              // Only update read receipts for messages sent by current user
              if (isSentByMe && msg._id) {
                const alreadyReadByReader = (msg.readBy || []).some(
                  (r) =>
                    (r.user?._id || r.user)?.toString() === userId.toString()
                );

                if (!alreadyReadByReader) {
                  const readBy = [
                    ...(msg.readBy || []),
                    { user: userId, readAt: new Date().toISOString() },
                  ];
                  const newStatus = get().calculateMessageStatus(
                    { ...msg, readBy },
                    currentUser?._id
                  );
                  return {
                    ...msg,
                    readBy,
                    status: newStatus,
                    deliveryStatus: newStatus,
                  };
                }
              }
              return msg;
            });

            return {
              messages: {
                ...state.messages,
                [conversationId]: updatedMessages,
              },
            };
          });
        });

        // --- Feature Real-Time Updates ---
        socketStore.onMessageReaction((data) => {
          const { messageId, conversationId, reactions } = data;
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) =>
                msg._id === messageId || msg.id === messageId
                  ? { ...msg, reactions: reactions || msg.reactions }
                  : msg
              ),
            },
          }));
        });

        socketStore.onMessageEdited((data) => {
          const { messageId, conversationId, newContent, editedAt } = data;
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) =>
                msg._id === messageId || msg.id === messageId
                  ? {
                      ...msg,
                      content: newContent,
                      text: newContent,
                      isEdited: true,
                      editedAt,
                    }
                  : msg
              ),
            },
          }));
        });

        socketStore.onMessageDeleted((data) => {
          const { messageId, conversationId, deleteFor } = data;
          if (deleteFor === "everyone") {
            set((state) => ({
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId]?.map((msg) =>
                  msg._id === messageId || msg.id === messageId
                    ? {
                        ...msg,
                        content: "This message was deleted.",
                        text: "This message was deleted.",
                        isDeleted: true,
                        file: undefined,
                        media: undefined,
                        reactions: [],
                      }
                    : msg
                ),
              },
            }));
          }
        });

        set({ socketListenersInitialized: true });
        console.log("✅ Socket listeners initialized for messages");
      },

      cleanupSocketListeners: () => {
        const socketStore = useSocketStore.getState();
        socketStore.offReceiveMessage();
        socketStore.offMessageRead();
        socketStore.offMessagesRead();
        socketStore.offMessageReaction?.();
        socketStore.offMessageEdited?.();
        socketStore.offMessageDeleted?.();
        set({
          socketListenersInitialized: false,
          pendingOptimisticMessages: new Map(),
        });
        console.log("🧹 Socket listeners cleaned up");
      },

      // ==================== OPTIMISTIC MESSAGE RESOLUTION ====================

      /**
       * Resolves an optimistic message when server confirmation arrives
       * Returns true if resolved, false if no matching optimistic message found
       */
      resolveOptimisticMessage: (conversationId, serverMessage) => {
        const state = get();
        const messages = state.messages[conversationId] || [];
        const currentUser = useAuthStore.getState().user;

        // Find optimistic message by tempId from metadata first, then fallback to content matching
        let optimisticIndex = -1;

        // First try to match by tempId from metadata
        if (serverMessage.metadata?.tempId) {
          optimisticIndex = messages.findIndex((msg) => {
            if (!msg.id?.startsWith("temp-")) return false;
            const msgSenderId = msg.senderId || msg.sender?._id;
            if (msgSenderId?.toString() !== currentUser?._id?.toString())
              return false;
            return msg.metadata?.tempId === serverMessage.metadata.tempId;
          });
        }

        // Fallback to content and timestamp matching
        if (optimisticIndex === -1) {
          optimisticIndex = messages.findIndex((msg) => {
            // Must be a temp message
            if (!msg.id?.startsWith("temp-")) return false;

            // Must be from current user
            const msgSenderId = msg.senderId || msg.sender?._id;
            if (msgSenderId?.toString() !== currentUser?._id?.toString())
              return false;

            // Content must match
            if (msg.content !== serverMessage.content) return false;

            // Timestamp should be within 30 seconds (increased tolerance)
            const msgTime = new Date(msg.time || msg.createdAt).getTime();
            const serverTime = new Date(
              serverMessage.createdAt || serverMessage.time
            ).getTime();
            const timeDiff = Math.abs(msgTime - serverTime);

            return timeDiff < 30000; // 30 seconds tolerance
          });
        }

        if (optimisticIndex === -1) {
          console.log(
            "❌ No matching optimistic message found for server message"
          );
          return false; // No matching optimistic message
        }

        console.log(
          `✅ Resolving optimistic message at index ${optimisticIndex}`
        );

        // Replace optimistic message with server message
        set((state) => {
          const existingMessages = [...(state.messages[conversationId] || [])];
          const optimisticMsg = existingMessages[optimisticIndex];

          // Process server message with proper status calculation
          const processedServerMsg = processRawMessage(
            serverMessage,
            currentUser,
            get().calculateMessageStatus
          );

          // Ensure proper message status based on readBy array
          let finalStatus = processedServerMsg.status;
          if (
            processedServerMsg.readBy &&
            processedServerMsg.readBy.length > 1
          ) {
            // If others have read it, mark as read
            const othersRead = processedServerMsg.readBy.some(
              (receipt) =>
                (receipt.user?._id || receipt.user)?.toString() !==
                currentUser?._id?.toString()
            );
            if (othersRead) {
              finalStatus = "read";
            } else {
              finalStatus = "delivered";
            }
          } else if (
            processedServerMsg.readBy &&
            processedServerMsg.readBy.length === 1
          ) {
            // Only sender has read it
            finalStatus = "sent";
          }

          // Replace at same position with updated status
          existingMessages[optimisticIndex] = {
            ...processedServerMsg,
            id: processedServerMsg._id?.toString() || processedServerMsg.id,
            _id: processedServerMsg._id,
            status: finalStatus,
            deliveryStatus: finalStatus,
          };

          // Sort by timestamp to ensure proper order
          existingMessages.sort((a, b) => new Date(a.time) - new Date(b.time));

          return {
            messages: { ...state.messages, [conversationId]: existingMessages },
          };
        });

        return true;
      },

      // ==================== CORE ACTIONS ====================

      addMessage: (conversationId, message) => {
        set((state) => {
          const existingMessages = [...(state.messages[conversationId] || [])];
          const currentUser = useAuthStore.getState().user;
          const getMessageStatus = get().calculateMessageStatus;

          const processedMessage = processRawMessage(
            message,
            currentUser,
            getMessageStatus
          );
          if (!processedMessage) return state;

          // Check if message already exists by permanent _id
          if (processedMessage._id) {
            const existsIndex = existingMessages.findIndex(
              (msg) => msg._id?.toString() === processedMessage._id.toString()
            );

            if (existsIndex >= 0) {
              // Update existing message
              console.log(
                `🔄 Updating existing message at index ${existsIndex}`
              );
              existingMessages[existsIndex] = {
                ...existingMessages[existsIndex],
                ...processedMessage,
                id: processedMessage._id.toString(),
                _id: processedMessage._id,
              };

              existingMessages.sort(
                (a, b) => new Date(a.time) - new Date(b.time)
              );
              return {
                messages: {
                  ...state.messages,
                  [conversationId]: existingMessages,
                },
              };
            }
          }

          // Add as new message
          console.log("➕ Adding new message");
          existingMessages.push(processedMessage);
          existingMessages.sort((a, b) => new Date(a.time) - new Date(b.time));

          return {
            messages: { ...state.messages, [conversationId]: existingMessages },
          };
        });
      },

      getMessagesForConversation: (conversationId) => {
        return get().messages[conversationId] || [];
      },

      // ==================== FETCH MESSAGES ====================

      fetchMessages: async (
        conversationId,
        page = 1,
        limit = 50,
        append = false
      ) => {
        const { isAuthenticated } = useChatStore.getState();

        console.log(
          `🔄 Fetching messages for conversation: ${conversationId}, page: ${page}`
        );

        if (!isAuthenticated() || !conversationId) {
          console.error("❌ Cannot fetch messages:", {
            isAuthenticated: isAuthenticated(),
            conversationId,
          });
          set({ loadingMessages: false, error: "Authentication or ID error" });
          return;
        }

        set({ loadingMessages: true, error: null });

        try {
          console.log(
            `📡 Making API request to: ${GET_ALL_MESSAGES_ROUTE(
              conversationId
            )}`
          );

          const response = await api.get(
            GET_ALL_MESSAGES_ROUTE(conversationId),
            {
              params: { page, limit },
            }
          );

          console.log("📨 API Response:", response.data);

          // Handle pagination metadata
          const paginationInfo = {
            page: response.data.page || page,
            totalPages: response.data.totalPages || 1,
            hasMore: response.data.hasNextPage || false,
            total: response.data.totalDocs || 0,
          };

          let messagesArray =
            response.data.docs ||
            response.data.messages ||
            response.data.data ||
            response.data;

          if (!Array.isArray(messagesArray)) {
            console.warn(
              "⚠️ Messages response is not an array:",
              messagesArray
            );
            messagesArray = [messagesArray].filter(Boolean);
          }

          console.log(`📝 Processing ${messagesArray.length} messages`);

          const currentUser = useAuthStore.getState().user;
          const getMessageStatus = get().calculateMessageStatus;

          const validatedMessages = messagesArray
            .map((msg) => processRawMessage(msg, currentUser, getMessageStatus))
            .filter((msg) => msg !== null);

          console.log(
            `✅ Successfully processed ${validatedMessages.length} messages`
          );

          set((state) => {
            const existingMessages = state.messages[conversationId] || [];

            let updatedMessages;
            if (append && page > 1) {
              // APPEND mode: Add older messages to the beginning (for pagination)
              // Filter out duplicates
              const existingIds = new Set(
                existingMessages.map((m) => m._id?.toString() || m.id)
              );
              const newMessages = validatedMessages.filter(
                (m) => !existingIds.has(m._id?.toString() || m.id)
              );

              // Prepend older messages and sort
              updatedMessages = [...newMessages, ...existingMessages].sort(
                (a, b) => new Date(a.time) - new Date(b.time)
              );
            } else {
              // REPLACE mode: First load or refresh
              updatedMessages = validatedMessages;
            }

            return {
              messages: {
                ...state.messages,
                [conversationId]: updatedMessages,
              },
              messagePagination: {
                ...state.messagePagination,
                [conversationId]: paginationInfo,
              },
              loadingMessages: false,
            };
          });

          useSocketStore.getState().joinConversation(conversationId);
          useChatStore.getState().markConversationAsRead(conversationId);

          if (!get().socketListenersInitialized) {
            get().initializeSocketListeners();
          }

          return paginationInfo;
        } catch (err) {
          const errorMessage =
            err.response?.data?.message ||
            err.message ||
            "Failed to fetch messages from backend.";
          console.error("❌ Error fetching messages:", {
            error: err,
            response: err.response?.data,
            conversationId,
            url: GET_ALL_MESSAGES_ROUTE(conversationId),
          });
          set({
            error: errorMessage,
            loadingMessages: false,
          });
          throw err;
        }
      },

      // ==================== SEND MESSAGE ====================

      sendMessage: async (
        conversationId,
        content,
        type = "text",
        file = null,
        isForwarded = false,
        media = null,
        metadata = {}
      ) => {
        const {
          isAuthenticated,
          stopTyping,
          getFormattedDisplayName,
          getFormattedAvatar,
        } = useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        if (
          !isAuthenticated() ||
          !currentUser ||
          (!content && !file && !media)
        ) {
          useChatStore.getState().set({ error: "Invalid send request." });
          return;
        }

        stopTyping(conversationId);

        const tempMessageId = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        let messageType = type;
        if (file) {
          if (file.type.startsWith("image/")) messageType = "image";
          else if (file.type.startsWith("video/")) messageType = "video";
          else if (file.type.startsWith("audio/")) messageType = "audio";
          else messageType = "file";
        }

        // Create optimistic message
        const tempMessage = {
          id: `temp-${tempMessageId}`,
          _id: undefined,
          conversationId,
          sender: {
            _id: currentUser._id,
            name: getFormattedDisplayName(currentUser),
            avatar: getFormattedAvatar(currentUser),
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            username: currentUser.username,
            image: currentUser.image,
          },
          senderId: currentUser._id,
          content: content || "",
          text: content || "",
          type: "sent",
          messageType,
          status: "sending",
          deliveryStatus: "sending",
          readBy: [{ user: currentUser._id, readAt: new Date() }],
          media,
          metadata: { ...metadata, tempId: tempMessageId },
          time: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          reactions: [],
          isEdited: false,
          isDeleted: false,
          isForwarded: isForwarded,
        };

        // Add optimistic message
        get().addMessage(conversationId, tempMessage);
        useConversationStore
          .getState()
          .updateContactForOptimisticSend(conversationId, tempMessage);

        try {
          // ALWAYS USE REST API PATH - Remove socket path to prevent duplicates
          let requestData;
          let requestConfig = { headers: {} };

          if (file) {
            const formData = new FormData();
            formData.append("conversationId", conversationId);
            if (content) formData.append("content", content);
            formData.append("type", messageType);
            formData.append("isForwarded", isForwarded.toString());
            formData.append("file", file);
            if (media) formData.append("media", JSON.stringify(media));
            formData.append(
              "metadata",
              JSON.stringify({ ...metadata, tempId: tempMessageId })
            );

            requestData = formData;
            requestConfig.headers["Content-Type"] = "multipart/form-data";
          } else {
            requestData = {
              conversationId,
              content,
              type: messageType,
              isForwarded,
              media,
              metadata: { ...metadata, tempId: tempMessageId },
            };
            requestConfig.headers["Content-Type"] = "application/json";
          }

          console.log("📤 Sending via REST API, tempId:", tempMessageId);

          const response = await api.post(
            SEND_MESSAGE_ROUTE,
            requestData,
            requestConfig
          );
          const serverMessage = response.data;

          console.log("✅ API response received, resolving optimistic message");

          // Try to resolve optimistic message, fallback to adding if not found
          const resolved = get().resolveOptimisticMessage(
            conversationId,
            serverMessage
          );
          if (!resolved) {
            get().addMessage(conversationId, serverMessage);
          }

          return serverMessage;
        } catch (err) {
          const errorMessage = useConversationStore
            .getState()
            .getDetailedErrorMessage(err);
          console.error("Error sending message:", err);

          // Mark optimistic message as failed
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) =>
                msg.id === `temp-${tempMessageId}`
                  ? {
                      ...msg,
                      status: "failed",
                      deliveryStatus: "failed",
                      error: errorMessage,
                    }
                  : msg
              ),
            },
          }));

          useConversationStore
            .getState()
            .revertContactOnFailedSend(conversationId);
          throw err;
        }
      },

      // ==================== EDIT MESSAGE ====================

      editMessage: async (messageId, newContent) => {
        try {
          const response = await api.put(EDIT_MESSAGE_ROUTE(messageId), {
            newContent,
          });
          const editedMessage = response.data;
          const conversationId = editedMessage.conversationId;

          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) =>
                msg._id === messageId || msg.id === messageId
                  ? {
                      ...msg,
                      ...editedMessage,
                      content: editedMessage.content,
                      text: editedMessage.content,
                      isEdited: true,
                      editedAt: editedMessage.editedAt,
                    }
                  : msg
              ),
            },
          }));

          return editedMessage;
        } catch (err) {
          const errorMessage =
            err.response?.data?.message || "Failed to edit message";
          console.error("Error editing message:", err);
          throw new Error(errorMessage);
        }
      },

      // ==================== DELETE MESSAGE ====================

      deleteMessage: async (messageId, conversationId, deleteFor = "me") => {
        try {
          await api.delete(DELETE_MESSAGE_ROUTE(messageId), {
            params: { deleteFor },
          });

          if (deleteFor === "everyone") {
            set((state) => ({
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId]?.map((msg) =>
                  msg._id === messageId || msg.id === messageId
                    ? {
                        ...msg,
                        content: "This message was deleted.",
                        text: "This message was deleted.",
                        isDeleted: true,
                        file: undefined,
                        media: undefined,
                        reactions: [],
                      }
                    : msg
                ),
              },
            }));
          } else {
            set((state) => ({
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId]?.filter(
                  (msg) => msg._id !== messageId && msg.id !== messageId
                ),
              },
            }));
          }

          return { success: true, deleteFor };
        } catch (err) {
          const errorMessage =
            err.response?.data?.message || "Failed to delete message";
          console.error("Error deleting message:", err);
          throw new Error(errorMessage);
        }
      },

      // ==================== REACTIONS ====================

      addReaction: async (messageId, conversationId, emoji) => {
        try {
          const response = await api.post(ADD_REACTION_ROUTE(messageId), {
            emoji,
          });
          const currentUser = useAuthStore.getState().user;

          set((state) => {
            const newReaction = {
              emoji,
              user: currentUser._id,
              timestamp: new Date().toISOString(),
            };

            return {
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId]?.map((msg) => {
                  if (msg._id === messageId || msg.id === messageId) {
                    const currentReactions = msg.reactions || [];
                    const existingIndex = currentReactions.findIndex(
                      (r) =>
                        r.emoji === emoji &&
                        (r.user?._id || r.user)?.toString() ===
                          currentUser._id.toString()
                    );

                    let updatedReactions;
                    if (existingIndex > -1) {
                      updatedReactions = currentReactions;
                    } else {
                      updatedReactions = [...currentReactions, newReaction];
                    }

                    return { ...msg, reactions: updatedReactions };
                  }
                  return msg;
                }),
              },
            };
          });

          return response.data;
        } catch (err) {
          throw new Error(
            err.response?.data?.message || "Failed to add reaction"
          );
        }
      },

      removeReaction: async (messageId, conversationId, emoji) => {
        const currentUser = useAuthStore.getState().user;

        try {
          await api.delete(REMOVE_REACTION_ROUTE(messageId, emoji), {
            data: { emoji },
          });

          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId]?.map((msg) => {
                if (msg._id === messageId || msg.id === messageId) {
                  return {
                    ...msg,
                    reactions: (msg.reactions || []).filter(
                      (r) =>
                        !(
                          r.emoji === emoji &&
                          (r.user?._id || r.user)?.toString() ===
                            currentUser._id.toString()
                        )
                    ),
                  };
                }
                return msg;
              }),
            },
          }));

          return { success: true };
        } catch (err) {
          throw new Error(
            err.response?.data?.message || "Failed to remove reaction"
          );
        }
      },

      // ==================== OTHER UTILITIES ====================

      forwardMessage: async (messageId, targetConversationIds) => {
        try {
          const response = await api.post(FORWARD_MESSAGE_ROUTE(messageId), {
            targetConversationIds,
          });
          const forwardedMessages = response.data.forwardedMessages || [];

          forwardedMessages.forEach((msg) => {
            get().addMessage(msg.conversationId, msg);
          });

          return response.data;
        } catch (err) {
          const errorMessage =
            err.response?.data?.message || "Failed to forward message";
          console.error("Error forwarding message:", err);
          throw new Error(errorMessage);
        }
      },

      searchMessages: async (conversationId, query, page = 1, limit = 20) => {
        try {
          const response = await api.get(SEARCH_MESSAGES_ROUTE, {
            params: { conversationId, query, page, limit },
          });
          return response.data;
        } catch (err) {
          const errorMessage =
            err.response?.data?.message || "Failed to search messages";
          console.error("Error searching messages:", err);
          throw new Error(errorMessage);
        }
      },

      retryFailedMessage: async (messageId, conversationId) => {
        const state = get();
        const messages = state.messages[conversationId] || [];
        const failedMessage = messages.find(
          (msg) => msg.id === messageId && msg.status === "failed"
        );

        if (!failedMessage) {
          console.error("Failed message not found:", messageId);
          return;
        }

        // Remove the failed message
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: state.messages[conversationId].filter(
              (msg) => msg.id !== messageId
            ),
          },
        }));

        // Re-send the message
        await get().sendMessage(
          conversationId,
          failedMessage.content,
          failedMessage.messageType || "text",
          null,
          failedMessage.isForwarded || false,
          failedMessage.media,
          failedMessage.metadata || {}
        );
      },

      loadMoreMessages: async (conversationId) => {
        const state = get();
        const pagination = state.messagePagination[conversationId];

        if (!pagination || !pagination.hasMore || state.loadingMessages) {
          console.log("No more messages to load or already loading");
          return;
        }

        const nextPage = pagination.page + 1;
        console.log(`📜 Loading more messages, page ${nextPage}`);

        await get().fetchMessages(conversationId, nextPage, 50, true);
      },

      // NEW: Check if more messages are available
      hasMoreMessages: (conversationId) => {
        const pagination = get().messagePagination[conversationId];
        return pagination?.hasMore || false;
      },

      // NEW: Get current page info
      getMessagePagination: (conversationId) => {
        return get().messagePagination[conversationId] || null;
      },

      // MODIFIED: Clear message state to also clear pagination
      clearMessageState: () => {
        get().cleanupSocketListeners();
        set({
          messages: {},
          loadingMessages: false,
          error: null,
          socketListenersInitialized: false,
          pendingOptimisticMessages: new Map(),
          messagePagination: {}, // Clear pagination data
        });
      },

      // Debug function to check message state
      debugMessageState: () => {
        const state = get();
        console.log("🔍 Message Store Debug:", {
          messagesCount: Object.keys(state.messages).length,
          conversations: Object.keys(state.messages),
          loadingMessages: state.loadingMessages,
          error: state.error,
          socketListenersInitialized: state.socketListenersInitialized,
        });
        Object.keys(state.messages).forEach((convId) => {
          console.log(
            `📨 Conversation ${convId}:`,
            state.messages[convId].length,
            "messages"
          );
        });
      },

      // Initialize store on app load
      initializeStore: () => {
        console.log("🚀 Initializing message store...");
        const state = get();
        console.log(
          "📦 Loaded messages from localStorage:",
          Object.keys(state.messages).length,
          "conversations"
        );

        // Initialize socket listeners if we have messages
        if (
          Object.keys(state.messages).length > 0 &&
          !state.socketListenersInitialized
        ) {
          console.log("🔌 Initializing socket listeners for existing messages");
          get().initializeSocketListeners();
        }
      },
    }),
    {
      name: "message-store",
      partialize: (state) => ({
        messages: state.messages,
        // Don't persist pagination, loading states, errors, or socket listeners
      }),
    }
  )
);
