import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "./models/UserModel.js";
import Message from "./models/MessagesModel.js";
import Channel from "./models/ChannelModel.js";
import Notification from "./models/NotificationModel.js";

let io;
const onlineUsers = new Map(); // Map userId to socketId(s) - A user can have multiple active connections

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST"],
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
      socket.userId = decoded.id; // Attach user ID to socket
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token."));
    }
  });

  io.on("connection", async (socket) => {
    console.log(
      `User connected: ${socket.userId} with socket ID: ${socket.id}`
    );

    // Add user to online users map
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Update user status in DB to 'online'
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

    // Join rooms for channels the user is a member of
    try {
      // Convert string userId to ObjectId for proper Mongoose query
      const userObjectId = new mongoose.Types.ObjectId(socket.userId);
      const userChannels = await Channel.find({ members: userObjectId });

      userChannels.forEach((channel) => {
        socket.join(channel._id.toString());
        console.log(
          `User ${socket.userId} joined channel room: ${channel._id.toString()}`
        );
      });
    } catch (error) {
      console.error(
        `Error joining channel rooms for user ${socket.userId}:`,
        error
      );
    }

    // --- Phase 5: Typing Indicators ---
    socket.on("typing", ({ chatId, chatType }) => {
      // chatId can be recipientId or channelId
      // Broadcast to all other participants in the chat/channel that this user is typing
      const senderId = socket.userId;
      if (chatType === "direct") {
        // Emit to the recipient directly
        const recipientSocketIds = onlineUsers.get(chatId) || new Set();
        recipientSocketIds.forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("user-typing", {
            senderId,
            chatId,
            chatType,
          });
        });
      } else if (chatType === "channel") {
        // Emit to the channel room, excluding the sender's current socket
        socket.to(chatId).emit("user-typing", { senderId, chatId, chatType });
      }
    });

    socket.on("stopTyping", ({ chatId, chatType }) => {
      // Broadcast to all other participants that this user has stopped typing
      const senderId = socket.userId;
      if (chatType === "direct") {
        const recipientSocketIds = onlineUsers.get(chatId) || new Set();
        recipientSocketIds.forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("user-stopped-typing", {
            senderId,
            chatId,
            chatType,
          });
        });
      } else if (chatType === "channel") {
        socket
          .to(chatId)
          .emit("user-stopped-typing", { senderId, chatId, chatType });
      }
    });

    // --- Phase 5: Message Read Receipts ---
    socket.on("messageRead", async ({ messageId, chatId, chatType }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && !message.readBy.includes(socket.userId)) {
          message.readBy.push(socket.userId);
          await message.save();

          // Emit read receipt event to sender (if direct message) or channel members (if group)
          if (chatType === "direct") {
            const senderSocketIds =
              onlineUsers.get(message.sender.toString()) || new Set();
            senderSocketIds.forEach((senderSocketId) => {
              io.to(senderSocketId).emit("message-read", {
                messageId,
                readerId: socket.userId,
                chatId,
                chatType,
              });
            });
          } else if (chatType === "channel") {
            // Emit to the channel room
            io.to(chatId).emit("message-read", {
              messageId,
              readerId: socket.userId,
              chatId,
              chatType,
            });
          }
        }
      } catch (error) {
        console.error("Error handling messageRead event:", error);
      }
    });

    socket.on("disconnect", async () => {
      console.log(
        `User disconnected: ${socket.userId} from socket ID: ${socket.id}`
      );

      // Remove socket from online users map
      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);
        if (onlineUsers.get(socket.userId).size === 0) {
          onlineUsers.delete(socket.userId);
          // If no more active connections, update user status to 'offline'
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