import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/UserModel.js";
import Conversation from "./models/ConversationModel.js"; // Your provided model
import Message from "./models/MessagesModel.js"; // Assuming this exists

let io;
const onlineUsers = new Map(); // Maps userId to a Set of socket IDs

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    // Authenticate user with JWT from handshake auth
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

    // Add user's socket to the onlineUsers map
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Update user status to 'online' and broadcast
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

    // Join rooms for all of the user's conversations
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

    // Event: Real-time message sending (from client to server)
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
          const newMessage = new Message({
            conversationId,
            sender: socket.userId,
            content,
            type,
            media,
            metadata,
            deliveryStatus: "sent",
          });
          await newMessage.save();

          // Populate sender details for the broadcast
          const populatedMessage = await Message.findById(
            newMessage._id
          ).populate("sender", "name avatar");

          // Update the last message and message count in the conversation
          const conversation = await Conversation.findOneAndUpdate(
            { conversationId },
            {
              $set: {
                lastMessage: {
                  messageId: newMessage._id,
                  content: newMessage.content.substring(0, 200),
                  type: newMessage.type,
                  sender: newMessage.sender,
                  timestamp: newMessage.timestamp,
                },
                lastActivity: new Date(),
              },
              $inc: { messageCount: 1 },
            },
            { new: true }
          );

          // Broadcast the new message to all participants in the conversation room
          if (conversation) {
            io.to(conversationId).emit("message_received", populatedMessage);
          }
        } catch (error) {
          console.error("Error sending message:", error);
        }
      }
    );

    // Event: User started typing in a conversation
    socket.on("typing_start", ({ conversationId }) => {
      socket.to(conversationId).emit("typing_start", {
        userId: socket.userId,
        conversationId,
      });
    });

    // Event: User stopped typing in a conversation
    socket.on("typing_stop", ({ conversationId }) => {
      socket.to(conversationId).emit("typing_stop", {
        userId: socket.userId,
        conversationId,
      });
    });

    // Event: User has read a message - FIXED VERSION
    socket.on("mark_message_as_read", async ({ messageId, conversationId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) {
          console.warn(`Message with ID ${messageId} not found`);
          return;
        }

        // Initialize readBy array if it doesn't exist or is null
        if (!message.readBy || !Array.isArray(message.readBy)) {
          message.readBy = [];
        }

        // Check if user has already read the message
        const hasAlreadyRead = message.readBy.some(
          (receipt) => receipt.user && receipt.user.toString() === socket.userId
        );

        if (!hasAlreadyRead) {
          message.readBy.push({
            user: socket.userId,
            readAt: new Date(),
          });

          await message.save();

          // Emit to all participants in the conversation
          io.to(conversationId).emit("message_read", {
            messageId,
            readerId: socket.userId,
            conversationId,
          });

          console.log(
            `Message ${messageId} marked as read by user ${socket.userId}`
          );
        }
      } catch (error) {
        console.error("Error handling mark_message_as_read event:", error);

        // Emit error back to client if needed
        socket.emit("message_read_error", {
          messageId,
          error: "Failed to mark message as read",
        });
      }
    });

    // Event: A conversation's information has been updated
    socket.on("conversation_updated", ({ conversationId, updatedInfo }) => {
      io.to(conversationId).emit("conversation_updated", {
        conversationId,
        updatedInfo,
      });
    });

    // Event: A user has joined a conversation
    socket.on("participant_joined", ({ conversationId, newParticipant }) => {
      io.to(conversationId).emit("participant_joined", {
        conversationId,
        newParticipant,
      });
    });

    // Event: A user has left a conversation
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

// Function to get online status of a user
function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

// Function to get all socket IDs for a given user
function getUserSocketIds(userId) {
  return onlineUsers.get(userId) || new Set();
}

export { initSocket, getIo, isUserOnline, getUserSocketIds };