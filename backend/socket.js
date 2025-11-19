import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/UserModel.js";
import Conversation from "./models/ConversationModel.js";
import Message from "./models/MessagesModel.js";

let io;
const onlineUsers = new Map();

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: Token not provided."));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET.trim());
      socket.userId = decoded.id;
      next();
    } catch (err) {
      console.error("JWT verification error:", err);
      return next(new Error("Authentication error: Invalid token."));
    }
  });

  io.on("connection", async (socket) => {
    console.log(
      `User connected: ${socket.userId} with socket ID: ${socket.id}`
    );

    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    try {
      await User.findByIdAndUpdate(socket.userId, {
        status: "online",
        lastOnline: new Date(),
      });
      io.emit("user-status-update", {
        userId: socket.userId,
        status: "online",
      });
    } catch (error) {
      console.error(`Error updating user status for ${socket.userId}:`, error);
    }

    try {
      const userConversations = await Conversation.find({
        "participants.user": new mongoose.Types.ObjectId(socket.userId),
      });
      userConversations.forEach((conv) => {
        socket.join(conv.conversationId);
        console.log(
          `User ${socket.userId} joined conversation room: ${conv.conversationId}`
        );
      });
    } catch (error) {
      console.error(
        `Error joining conversation rooms for user ${socket.userId}:`,
        error
      );
    }

    // Event: Real-time message sending (DEPRECATED - Use REST API instead)
    socket.on(
      "send_message",
      async ({
        conversationId,
        content,
        type = "text",
        media,
        metadata = {},
      }) => {
        try {
          console.log(
            "⚠️ Socket send_message event received - this should use REST API instead"
          );

          // Validate conversation exists and user is participant
          const conversation = await Conversation.findOne({ conversationId });
          if (!conversation) {
            socket.emit("message_send_error", {
              error: "Conversation not found",
            });
            return;
          }

          const senderParticipant = conversation.participants.find(
            (p) => p.user.toString() === socket.userId.toString()
          );
          if (!senderParticipant || !senderParticipant.isActive) {
            socket.emit("message_send_error", {
              error: "You are not a member of this conversation",
            });
            return;
          }

          const newMessage = new Message({
            conversationId,
            sender: socket.userId,
            content,
            type,
            media,
            metadata,
            readBy: [{ user: socket.userId, readAt: new Date() }],
            deliveryStatus: "sent",
          });
          await newMessage.save();

          const populatedMessage = await Message.findById(
            newMessage._id
          ).populate(
            "sender",
            "firstName lastName username name avatar color image"
          );

          // Update conversation
          await Conversation.findOneAndUpdate(
            { conversationId },
            {
              $set: {
                lastMessage: {
                  messageId: newMessage._id,
                  content: newMessage.content?.substring(0, 200) || "",
                  type: newMessage.type,
                  sender: newMessage.sender,
                  timestamp: newMessage.createdAt,
                },
                lastActivity: new Date(),
              },
              $inc: { messageCount: 1 },
            }
          );

          // Broadcast to all participants
          io.to(conversationId).emit("message_received", populatedMessage);
          console.log(
            `✅ Message broadcasted to conversation ${conversationId}`
          );

          // Mark as delivered for online recipients immediately
          const recipients = conversation.participants.filter(
            (p) => p.user.toString() !== socket.userId.toString() && p.isActive
          );

          // Process deliveries sequentially to avoid race conditions
          for (const recipient of recipients) {
            const recipientId = recipient.user.toString();
            const isRecipientOnline = onlineUsers.has(recipientId);

            if (isRecipientOnline) {
              // Recipient is online - mark as delivered immediately
              try {
                // Reload message to ensure we have the latest version with methods
                const messageToUpdate = await Message.findById(newMessage._id);
                if (messageToUpdate) {
                  await messageToUpdate.markAsDelivered(recipientId);

                  // Emit delivery status to sender
                  const senderSocketIds = getUserSocketIds(socket.userId);
                  senderSocketIds.forEach((socketId) => {
                    io.to(socketId).emit("message_delivered", {
                      messageId: newMessage._id,
                      conversationId,
                      recipientId,
                      deliveredAt: new Date(),
                    });
                  });

                  console.log(
                    `✅ Message ${newMessage._id} marked as delivered to ${recipientId}`
                  );
                }
              } catch (error) {
                console.error(`Error marking message as delivered:`, error);
              }
            }
          }
        } catch (error) {
          console.error("Error sending message via socket:", error);
          socket.emit("message_send_error", {
            error: "Failed to send message",
          });
        }
      }
    );

    // Event: User started typing
    const typingUsers = new Map();

    socket.on("typing_start", ({ conversationId }) => {
      const now = Date.now();
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Map());
      }

      const convTyping = typingUsers.get(conversationId);
      const lastTyping = convTyping.get(socket.userId);

      if (!lastTyping || now - lastTyping > 2000) {
        convTyping.set(socket.userId, now);
        socket.to(conversationId).emit("typing_start", {
          userId: socket.userId,
          conversationId,
        });
      }
    });

    socket.on("typing_stop", ({ conversationId }) => {
      if (typingUsers.has(conversationId)) {
        typingUsers.get(conversationId).delete(socket.userId);
      }

      socket.to(conversationId).emit("typing_stop", {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(
        `User ${socket.userId} manually joined conversation room: ${conversationId}`
      );
    });

    socket.on("leave_conversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(
        `User ${socket.userId} manually left conversation room: ${conversationId}`
      );
    });

    // Event: Mark multiple messages as read
    socket.on("messages_read", async ({ conversationId, userId }) => {
      try {
        console.log(
          `📖 Marking messages as read for user ${userId} in conversation ${conversationId}`
        );

        // Find messages that haven't been read by this user
        const messages = await Message.find({
          conversationId,
          sender: { $ne: userId },
          $or: [
            { "readBy.user": { $ne: userId } },
            { readBy: { $exists: false } },
            { readBy: { $size: 0 } },
          ],
        });

        if (messages.length === 0) {
          console.log("No unread messages found");
          return;
        }

        const readAt = new Date();

        // Use bulk update for better performance
        const messageIds = messages.map((m) => m._id);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          {
            $addToSet: {
              readBy: {
                user: userId,
                readAt: readAt,
              },
            },
          }
        );

        // Emit to all participants except the reader
        socket.to(conversationId).emit("messages_read", {
          conversationId,
          userId,
          count: messages.length,
          readAt: readAt,
        });

        // Emit individual message_read events for each sender
        const senderIds = new Set(); // Track unique senders to avoid duplicate events
        messages.forEach((msg) => {
          const senderId = msg.sender.toString();
          if (!senderIds.has(senderId)) {
            senderIds.add(senderId);
            const senderSocketIds = getUserSocketIds(senderId);
            senderSocketIds.forEach((socketId) => {
              io.to(socketId).emit("message_read", {
                messageId: msg._id,
                readerId: userId,
                conversationId: msg.conversationId,
                readAt: readAt,
              });
            });
          }
        });

        console.log(
          `✅ ${messages.length} messages marked as read by user ${userId} in conversation ${conversationId}`
        );
      } catch (error) {
        console.error("Error handling messages_read event:", error);
        socket.emit("messages_read_error", {
          conversationId,
          error: "Failed to mark messages as read",
        });
      }
    });

    // Event: Confirm message delivery (when recipient receives message)
    socket.on(
      "message_delivery_confirmed",
      async ({ messageId, conversationId }) => {
        try {
          const message = await Message.findById(messageId);

          if (!message) {
            console.warn(`Message with ID ${messageId} not found`);
            return;
          }

          // Mark as delivered for this user
          await message.markAsDelivered(socket.userId);

          // Emit delivery status to sender
          const senderId = message.sender.toString();
          if (senderId !== socket.userId.toString()) {
            const senderSocketIds = getUserSocketIds(senderId);
            senderSocketIds.forEach((socketId) => {
              io.to(socketId).emit("message_delivered", {
                messageId,
                conversationId,
                recipientId: socket.userId,
                deliveredAt: new Date(),
              });
            });
          }

          console.log(
            `✅ Message ${messageId} delivery confirmed by user ${socket.userId}`
          );
        } catch (error) {
          console.error("Error handling message_delivery_confirmed:", error);
        }
      }
    );

    // Event: Mark single message as read
    socket.on("mark_message_as_read", async ({ messageId, conversationId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) {
          console.warn(`Message with ID ${messageId} not found`);
          return;
        }

        if (!message.readBy || !Array.isArray(message.readBy)) {
          message.readBy = [];
        }

        const hasAlreadyRead = message.readBy.some(
          (receipt) => receipt.user && receipt.user.toString() === socket.userId
        );

        if (!hasAlreadyRead) {
          message.readBy.push({
            user: socket.userId,
            readAt: new Date(),
          });

          await message.save();

          io.to(conversationId).emit("message_read", {
            messageId,
            readerId: socket.userId,
            conversationId,
            readAt: new Date(),
          });

          console.log(
            `Message ${messageId} marked as read by user ${socket.userId}`
          );
        }
      } catch (error) {
        console.error("Error handling mark_message_as_read event:", error);
        socket.emit("message_read_error", {
          messageId,
          error: "Failed to mark message as read",
        });
      }
    });

    // Event: Conversation updated
    socket.on("conversation_updated", ({ conversationId, updatedInfo }) => {
      io.to(conversationId).emit("conversation_updated", {
        conversationId,
        updatedInfo,
      });
    });

    // Event: Participant joined
    socket.on("participant_joined", ({ conversationId, newParticipant }) => {
      io.to(conversationId).emit("participant_joined", {
        conversationId,
        newParticipant,
      });
    });

    // Event: Participant left
    socket.on("participant_left", ({ conversationId, participantId }) => {
      io.to(conversationId).emit("participant_left", {
        conversationId,
        participantId,
      });
    });

    // Event: Disconnect handler
    socket.on("disconnect", async () => {
      if (!socket.userId) return;

      console.log(
        `User disconnected: ${socket.userId} from socket ID: ${socket.id}`
      );

      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);

        if (onlineUsers.get(socket.userId).size === 0) {
          onlineUsers.delete(socket.userId);
          try {
            await User.findByIdAndUpdate(socket.userId, {
              status: "offline",
              lastOnline: new Date(),
            });
            io.emit("user-status-update", {
              userId: socket.userId,
              status: "offline",
            });
          } catch (error) {
            console.error(
              `Error updating user status on disconnect for ${socket.userId}:`,
              error
            );
          }
        }
      }
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

function getUserSocketIds(userId) {
  return onlineUsers.get(userId) || new Set();
}

// Helper function to emit message reaction events
function emitMessageReaction(conversationId, messageId, reaction, reactions) {
  if (io) {
    io.to(conversationId).emit("message_reaction", {
      conversationId,
      messageId,
      reaction,
      reactions,
    });
    console.log(`✅ Reaction emitted for message ${messageId}`);
  }
}

// Helper function to emit message edit events
function emitMessageEdited(conversationId, messageId, newContent, editedAt) {
  if (io) {
    io.to(conversationId).emit("message_edited", {
      conversationId,
      messageId,
      newContent,
      editedAt,
    });
    console.log(`✅ Edit emitted for message ${messageId}`);
  }
}

// Helper function to emit message delete events
function emitMessageDeleted(conversationId, messageId, deleteFor) {
  if (io) {
    io.to(conversationId).emit("message_deleted", {
      conversationId,
      messageId,
      deleteFor,
    });
    console.log(`✅ Delete emitted for message ${messageId}`);
  }
}

export {
  initSocket,
  getIo,
  isUserOnline,
  getUserSocketIds,
  emitMessageReaction,
  emitMessageEdited,
  emitMessageDeleted,
};