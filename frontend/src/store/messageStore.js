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

  // Process reply data if present
  let replyToData = null;
  if (msg.replyTo) {
    replyToData = {
      _id: msg.replyTo._id,
      content: msg.replyTo.content,
      type: msg.replyTo.type,
      sender: msg.replyTo.sender,
      file: msg.replyTo.file,
      isDeleted: msg.replyTo.isDeleted || false,
      isAvailable: msg.replyTo.isAvailable !== false, // Default to true
    };
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
    readBy: msg.readReceipts || msg.readBy || [], // Support both readReceipts and readBy
    readReceipts: msg.readReceipts || msg.readBy || [],
    deliveryReceipts: msg.deliveryReceipts || [],
    reactions: msg.reactions || [],
    isEdited: msg.isEdited || false,
    isDeleted: msg.isDeleted || false,
    isForwarded: msg.isForwarded || false,
    file: msg.file ? { ...msg.file, filePath } : undefined,
    media: msg.media,
    metadata: msg.metadata || {},
    replyTo: replyToData, // NEW: Add reply data
    replyCount: msg.replyCount || 0, // NEW: Add reply count
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
      messagePagination: {},
      replyingTo: null, // NEW: Track which message is being replied to

      // ==================== HELPER FUNCTIONS ====================

      calculateMessageStatus: (message, currentUserId) => {
        const isSentByCurrentUser =
          (message.senderId || message.sender?._id)?.toString() ===
          currentUserId?.toString();

        if (!isSentByCurrentUser) return "received";

        // Handle sending and failed states (optimistic updates)
        if (
          message.status === "sending" ||
          message.deliveryStatus === "sending" ||
          message.deliveryStatus === "pending"
        )
          return "sending";
        if (message.status === "failed" || message.deliveryStatus === "failed")
          return "failed";

        // For sent messages, check read receipts first (highest priority)
        const readBy = message.readReceipts || message.readBy || [];
        const deliveryReceipts = message.deliveryReceipts || [];

        // Check if anyone other than the sender has read it
        const othersRead = readBy.some((receipt) => {
          const receiptUserId = receipt.user?._id || receipt.user;
          return receiptUserId?.toString() !== currentUserId?.toString();
        });

        if (othersRead) {
          return "read"; // Double blue ticks
        }

        // Check if message has been delivered to recipients (but not read yet)
        const othersDelivered = deliveryReceipts.some((receipt) => {
          const receiptUserId = receipt.user?._id || receipt.user;
          return receiptUserId?.toString() !== currentUserId?.toString();
        });

        if (othersDelivered) {
          return "delivered"; // Double gray ticks
        }

        // Message is just sent (reached server but not delivered yet)
        return "sent"; // Single gray tick
      },

      updateMessageDeliveryStatus: (
        conversationId,
        messageId,
        recipientId,
        deliveredAt
      ) => {
        set((state) => {
          const messages = state.messages[conversationId] || [];
          const currentUser = useAuthStore.getState().user;

          console.log(
            `🔄 Updating delivery status for message ${messageId} to recipient ${recipientId}`
          );

          const updatedMessages = messages.map((msg) => {
            if (msg._id === messageId || msg.id === messageId) {
              const deliveryReceipts = [...(msg.deliveryReceipts || [])];
              const alreadyDelivered = deliveryReceipts.some((receipt) => {
                const userId =
                  typeof receipt === "object"
                    ? receipt.user?._id || receipt.user
                    : receipt;
                return userId?.toString() === recipientId.toString();
              });

              if (!alreadyDelivered) {
                deliveryReceipts.push({
                  user: recipientId,
                  deliveredAt: deliveredAt || new Date(),
                });
                console.log(
                  `✅ Added delivery receipt for message ${messageId}`
                );
              }

              const newStatus = get().calculateMessageStatus(
                {
                  ...msg,
                  deliveryReceipts,
                  readReceipts: msg.readReceipts || msg.readBy || [],
                },
                currentUser?._id
              );

              console.log(
                `📊 Message ${messageId} delivery status updated to: ${newStatus}`
              );

              return {
                ...msg,
                deliveryReceipts,
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
              const readBy = [...(msg.readReceipts || msg.readBy || [])];
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

              // Ensure delivery receipt exists (read implies delivered)
              const deliveryReceipts = [...(msg.deliveryReceipts || [])];
              const hasDeliveryReceipt = deliveryReceipts.some((receipt) => {
                const userId =
                  typeof receipt === "object"
                    ? receipt.user?._id || receipt.user
                    : receipt;
                return userId?.toString() === readerId.toString();
              });
              if (!hasDeliveryReceipt) {
                deliveryReceipts.push({
                  user: readerId,
                  deliveredAt: readAt || new Date(),
                });
              }

              const newStatus = get().calculateMessageStatus(
                {
                  ...msg,
                  readReceipts: readBy,
                  readBy,
                  deliveryReceipts,
                },
                currentUser?._id
              );

              console.log(
                `📊 Message ${messageId} status updated to: ${newStatus}`
              );

              return {
                ...msg,
                readBy,
                readReceipts: readBy,
                deliveryReceipts,
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

      // ==================== REPLY MANAGEMENT ====================

      // NEW: Set the message to reply to
      setReplyingTo: (message) => {
        set({ replyingTo: message });
      },

      // NEW: Clear the replying state
      clearReplyingTo: () => {
        set({ replyingTo: null });
      },

      // NEW: Get the current replying message
      getReplyingTo: () => {
        return get().replyingTo;
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
            console.log("🔄 Received echo of own message from server");

            const resolved = get().resolveOptimisticMessage(
              message.conversationId,
              message
            );

            if (!resolved) {
              console.log(
                "ℹ️ No pending optimistic message - adding as new (from other session?)"
              );
              get().addMessage(message.conversationId, message);
            }

            useConversationStore
              .getState()
              .updateContactForOptimisticSend(message.conversationId, message);
          } else {
            console.log("➕ Adding message from other user");
            get().addMessage(message.conversationId, message);

            // Confirm delivery for received messages
            const socketStore = useSocketStore.getState();
            if (message._id && message.conversationId) {
              socketStore.confirmMessageDelivery(message._id, message.conversationId);
            }

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
              useConversationStore
                .getState()
                .incrementUnreadCount(message.conversationId);
            }
          }
        });

        // --- Message Delivery Status ---
        socketStore.onMessageDelivered?.(
          ({ messageId, conversationId, recipientId, deliveredAt }) => {
            console.log("📬 Message delivered event:", {
              messageId,
              conversationId,
              recipientId,
              deliveredAt,
            });
            get().updateMessageDeliveryStatus(
              conversationId,
              messageId,
              recipientId,
              deliveredAt
            );
          }
        );

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

          if (userId?.toString() === currentUser?._id?.toString()) {
            console.log("Ignoring read receipt from self");
            return;
          }

          set((state) => {
            const updatedMessages = messages.map((msg) => {
              const isSentByMe =
                (msg.senderId || msg.sender?._id)?.toString() ===
                currentUser?._id?.toString();

              if (isSentByMe && msg._id) {
                const readBy = [...(msg.readReceipts || msg.readBy || [])];
                const deliveryReceipts = [...(msg.deliveryReceipts || [])];
                const readAt = new Date().toISOString();

                // Check if already read
                const alreadyReadByReader = readBy.some(
                  (r) =>
                    (r.user?._id || r.user)?.toString() === userId.toString()
                );

                if (!alreadyReadByReader) {
                  readBy.push({ user: userId, readAt });
                  
                  // Ensure delivery receipt exists (read implies delivered)
                  const hasDeliveryReceipt = deliveryReceipts.some(
                    (r) =>
                      (r.user?._id || r.user)?.toString() === userId.toString()
                  );
                  if (!hasDeliveryReceipt) {
                    deliveryReceipts.push({ user: userId, deliveredAt: readAt });
                  }

                  const newStatus = get().calculateMessageStatus(
                    { ...msg, readReceipts: readBy, readBy, deliveryReceipts },
                    currentUser?._id
                  );
                  return {
                    ...msg,
                    readBy,
                    readReceipts: readBy,
                    deliveryReceipts,
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
                [conversationId]: state.messages[conversationId]?.map((msg) => {
                  if (msg._id === messageId || msg.id === messageId) {
                    return {
                      ...msg,
                      content: "This message was deleted.",
                      text: "This message was deleted.",
                      isDeleted: true,
                      file: undefined,
                      media: undefined,
                      reactions: [],
                    };
                  }
                  // Update reply references to this message
                  if (msg.replyTo?._id === messageId) {
                    return {
                      ...msg,
                      replyTo: {
                        ...msg.replyTo,
                        content: "This message was deleted",
                        isDeleted: true,
                        isAvailable: false,
                      },
                    };
                  }
                  return msg;
                }),
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
        socketStore.offMessageDelivered?.();
        socketStore.offMessageReaction?.();
        socketStore.offMessageEdited?.();
        socketStore.offMessageDeleted?.();
        set({
          socketListenersInitialized: false,
          pendingOptimisticMessages: new Map(),
          replyingTo: null,
        });
        console.log("🧹 Socket listeners cleaned up");
      },

      // ==================== OPTIMISTIC MESSAGE RESOLUTION ====================

      resolveOptimisticMessage: (conversationId, serverMessage) => {
        const state = get();
        const messages = state.messages[conversationId] || [];
        const currentUser = useAuthStore.getState().user;

        let optimisticIndex = -1;

        if (serverMessage.metadata?.tempId) {
          optimisticIndex = messages.findIndex((msg) => {
            if (!msg.id?.startsWith("temp-")) return false;
            const msgSenderId = msg.senderId || msg.sender?._id;
            if (msgSenderId?.toString() !== currentUser?._id?.toString())
              return false;
            return msg.metadata?.tempId === serverMessage.metadata.tempId;
          });
        }

        if (optimisticIndex === -1) {
          optimisticIndex = messages.findIndex((msg) => {
            if (!msg.id?.startsWith("temp-")) return false;

            const msgSenderId = msg.senderId || msg.sender?._id;
            if (msgSenderId?.toString() !== currentUser?._id?.toString())
              return false;

            if (msg.content !== serverMessage.content) return false;

            const msgTime = new Date(msg.time || msg.createdAt).getTime();
            const serverTime = new Date(
              serverMessage.createdAt || serverMessage.time
            ).getTime();
            const timeDiff = Math.abs(msgTime - serverTime);

            return timeDiff < 30000;
          });
        }

        if (optimisticIndex === -1) {
          console.log(
            "❌ No matching optimistic message found for server message"
          );
          return false;
        }

        console.log(
          `✅ Resolving optimistic message at index ${optimisticIndex}`
        );

        set((state) => {
          const existingMessages = [...(state.messages[conversationId] || [])];

          const processedServerMsg = processRawMessage(
            serverMessage,
            currentUser,
            get().calculateMessageStatus
          );

          // Recalculate status using the proper calculation function
          const finalStatus = get().calculateMessageStatus(
            processedServerMsg,
            currentUser?._id
          );

          existingMessages[optimisticIndex] = {
            ...processedServerMsg,
            id: processedServerMsg._id?.toString() || processedServerMsg.id,
            _id: processedServerMsg._id,
            status: finalStatus,
            deliveryStatus: finalStatus,
          };

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

          if (processedMessage._id) {
            const existsIndex = existingMessages.findIndex(
              (msg) => msg._id?.toString() === processedMessage._id.toString()
            );

            if (existsIndex >= 0) {
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
          const response = await api.get(
            GET_ALL_MESSAGES_ROUTE(conversationId),
            {
              params: { page, limit },
            }
          );

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

          const currentUser = useAuthStore.getState().user;
          const getMessageStatus = get().calculateMessageStatus;

          const validatedMessages = messagesArray
            .map((msg) => processRawMessage(msg, currentUser, getMessageStatus))
            .filter((msg) => msg !== null);

          set((state) => {
            const existingMessages = state.messages[conversationId] || [];

            let updatedMessages;
            if (append && page > 1) {
              const existingIds = new Set(
                existingMessages.map((m) => m._id?.toString() || m.id)
              );
              const newMessages = validatedMessages.filter(
                (m) => !existingIds.has(m._id?.toString() || m.id)
              );

              updatedMessages = [...newMessages, ...existingMessages].sort(
                (a, b) => new Date(a.time) - new Date(b.time)
              );
            } else {
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

        // Get replying message if exists
        const replyingTo = get().replyingTo;

        // Create optimistic message with reply data
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
          status: "sending", // Clock icon - message is being sent
          deliveryStatus: "sending", // Clock icon - message is being sent
          readBy: [{ user: currentUser._id, readAt: new Date() }],
          readReceipts: [{ user: currentUser._id, readAt: new Date() }],
          deliveryReceipts: [], // Empty until delivered
          media,
          metadata: {
            ...metadata,
            tempId: tempMessageId,
          },
          replyTo: replyingTo
            ? {
                _id: replyingTo._id,
                content: replyingTo.content,
                type: replyingTo.type || replyingTo.messageType,
                sender: replyingTo.sender,
                file: replyingTo.file,
                isDeleted: replyingTo.isDeleted,
                isAvailable: !replyingTo.isDeleted,
              }
            : null,
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
            if (replyingTo) formData.append("replyTo", replyingTo._id); // NEW: Add replyTo
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
              replyTo: replyingTo?._id || null, // NEW: Add replyTo
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

          const resolved = get().resolveOptimisticMessage(
            conversationId,
            serverMessage
          );
          if (!resolved) {
            get().addMessage(conversationId, serverMessage);
          }

          // Clear replying state after successful send
          get().clearReplyingTo();

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
                [conversationId]: state.messages[conversationId]?.map((msg) => {
                  // Update the deleted message
                  if (msg._id === messageId || msg.id === messageId) {
                    return {
                      ...msg,
                      content: "This message was deleted.",
                      text: "This message was deleted.",
                      isDeleted: true,
                      file: undefined,
                      media: undefined,
                      reactions: [],
                    };
                  }
                  // Update messages that replied to this message
                  if (
                    msg.replyTo?._id === messageId ||
                    msg.replyTo?.id === messageId
                  ) {
                    return {
                      ...msg,
                      replyTo: {
                        ...msg.replyTo,
                        content: "This message was deleted",
                        isDeleted: true,
                        isAvailable: false,
                      },
                    };
                  }
                  return msg;
                }),
              },
            }));
          } else {
            // Delete for me - just remove from local state
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
              user: currentUser, // Use full user object
              reactedAt: new Date().toISOString(),
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

      hasMoreMessages: (conversationId) => {
        const pagination = get().messagePagination[conversationId];
        return pagination?.hasMore || false;
      },

      getMessagePagination: (conversationId) => {
        return get().messagePagination[conversationId] || null;
      },

      // NEW: Get message by ID from any conversation
      getMessageById: (messageId, conversationId) => {
        const messages = get().messages[conversationId] || [];
        return messages.find(
          (msg) =>
            msg._id?.toString() === messageId?.toString() ||
            msg.id === messageId
        );
      },

      loadMessagesUntilFound: async (
        conversationId,
        targetMessageId,
        maxAttempts = 10
      ) => {
        const state = get();
        let attempts = 0;

        console.log(
          `🔍 Searching for message ${targetMessageId} in conversation ${conversationId}`
        );

        // First check if message is already loaded
        let message = get().getMessageById(targetMessageId, conversationId);
        if (message) {
          console.log("✅ Message already loaded");
          return { found: true, message };
        }

        // Keep loading pages until we find it or reach max attempts
        while (attempts < maxAttempts) {
          const pagination = state.messagePagination[conversationId];

          // Check if we have more pages to load
          if (!pagination?.hasMore) {
            console.log("❌ No more pages to load, message not found");
            return { found: false, message: null };
          }

          console.log(
            `📜 Loading page ${pagination.page + 1} (attempt ${
              attempts + 1
            }/${maxAttempts})`
          );

          try {
            await get().loadMoreMessages(conversationId);

            // Check again after loading
            message = get().getMessageById(targetMessageId, conversationId);
            if (message) {
              console.log(
                `✅ Message found after loading page ${pagination.page}`
              );
              return { found: true, message };
            }

            attempts++;
          } catch (error) {
            console.error("Error loading messages:", error);
            return { found: false, message: null, error };
          }
        }

        console.log(`❌ Message not found after ${maxAttempts} attempts`);
        return { found: false, message: null };
      },

      // NEW: Enhanced getMessageById that can load more pages if needed
      getMessageByIdWithLoad: async (conversationId, messageId) => {
        // First try to find in current messages
        let message = get().getMessageById(messageId, conversationId);

        if (message) {
          return { found: true, message, alreadyLoaded: true };
        }

        // If not found, try loading more pages
        const result = await get().loadMessagesUntilFound(
          conversationId,
          messageId
        );
        return { ...result, alreadyLoaded: false };
      },

      clearMessageState: () => {
        get().cleanupSocketListeners();
        set({
          messages: {},
          loadingMessages: false,
          error: null,
          socketListenersInitialized: false,
          pendingOptimisticMessages: new Map(),
          messagePagination: {},
          replyingTo: null,
        });
      },

      debugMessageState: () => {
        const state = get();
        console.log("🔍 Message Store Debug:", {
          messagesCount: Object.keys(state.messages).length,
          conversations: Object.keys(state.messages),
          loadingMessages: state.loadingMessages,
          error: state.error,
          socketListenersInitialized: state.socketListenersInitialized,
          replyingTo: state.replyingTo,
        });
        Object.keys(state.messages).forEach((convId) => {
          console.log(
            `📨 Conversation ${convId}:`,
            state.messages[convId].length,
            "messages"
          );
        });
      },

      initializeStore: () => {
        const state = get();

        if (
          Object.keys(state.messages).length > 0 &&
          !state.socketListenersInitialized
        ) {
          get().initializeSocketListeners();
        }
      },
    }),
    {
      name: "message-store",
      partialize: (state) => ({
        messages: state.messages,
        messagePagination: state.messagePagination,
      }),
    }
  )
);