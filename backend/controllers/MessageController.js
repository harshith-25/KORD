import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import Message from "../models/MessagesModel.js";
import User from "../models/UserModel.js";
import Channel from "../models/ChannelModel.js";
import Notification from "../models/NotificationModel.js";
import { getIo, isUserOnline, getUserSocketIds } from "../socket.js";
import { sendErrorResponse } from "../middleware/errorHandler.js";

let ioInstance;
export const setIoInstance = (io) => {
  ioInstance = io;
};

// @desc    Send a new message (text or file)
// @route   POST /api/messages/send
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
  const { recipientId, channelId, content, type } = req.body;
  const sender = req.user._id;
  const file = req.file; // From Multer middleware

  if (!recipientId && !channelId) {
    return sendErrorResponse(
      res,
      null,
      "Recipient or channel ID is required.",
      400
    );
  }

  if (!content && !file) {
    return sendErrorResponse(
      res,
      null,
      "Message content or a file is required.",
      400
    );
  }

  // Construct message object
  let messageData = {
    sender,
    type: type || "text",
    readBy: [sender], // Sender has read their own message
  };

  if (recipientId) {
    // Direct message
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return sendErrorResponse(res, null, "Invalid recipient ID format.", 400);
    }
    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) {
      return sendErrorResponse(res, null, "Recipient not found.", 404);
    }
    messageData.recipient = recipientId;
  } else if (channelId) {
    // Channel message
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return sendErrorResponse(res, null, "Invalid channel ID format.", 400);
    }
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return sendErrorResponse(res, null, "Channel not found.", 404);
    }
    // Ensure sender is a member of the channel
    if (!channel.members.includes(sender)) {
      return sendErrorResponse(
        res,
        null,
        "You are not a member of this channel.",
        403
      );
    }
    messageData.channel = channelId;
  }

  // Handle file upload
  if (file) {
    // If content is also provided, it will be the message text accompanying the file
    messageData.content = content || ""; // Content can be optional if it's just a file
    messageData.file = {
      fileName: file.originalname,
      filePath: `/uploads/${file.filename}`, // Relative path to access via static middleware
      fileMimeType: file.mimetype,
      fileSize: file.size,
    };
    messageData.type = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
      ? "video"
      : file.mimetype.startsWith("audio/")
      ? "audio"
      : "file"; // Determine type based on mimetype
  } else {
    messageData.content = content;
    // If no file, type should be explicitly 'text' or as provided in body
    messageData.type = type || "text";
  }

  const message = await Message.create(messageData);
  // Fixed: Remove .execPopulate() - populate() returns a promise directly in newer Mongoose versions
  const populatedMessage = await message.populate(
    "sender",
    "username firstName lastName image color"
  );

  // Emit message via Socket.IO
  if (ioInstance) {
    if (message.recipient) {
      // Direct message
      const recipientSocketIds = getUserSocketIds(message.recipient.toString());
      const senderSocketIds = getUserSocketIds(message.sender.toString());

      // Emit to recipient
      recipientSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("privateMessage", populatedMessage);
      });
      // Emit to sender's other devices
      senderSocketIds.forEach((socketId) => {
        if (socketId !== req.socketId) {
          // Avoid sending back to the initiating socket if unnecessary
          ioInstance.to(socketId).emit("privateMessage", populatedMessage);
        }
      });

      // Create notification for recipient if offline or on other device
      if (
        !isUserOnline(message.recipient.toString()) ||
        (recipientSocketIds.size === 0 && senderSocketIds.size > 0)
      ) {
        await Notification.create({
          recipient: message.recipient,
          sender: message.sender,
          type: "new_message",
          content: `New message from ${
            req.user.username || req.user.firstName
          }`,
          relatedEntity: { id: message._id, kind: "Message" },
        });
      }
    } else if (message.channel) {
      // Channel message
      ioInstance
        .to(message.channel.toString())
        .emit("channelMessage", populatedMessage);

      // Handle Mentions: Parse message content for @mentions
      const channel = await Channel.findById(message.channel);
      if (channel && typeof message.content === "string") {
        const mentionRegex = /@([a-zA-Z0-9_]+)/g; // Matches @username
        let match;
        const mentionedUsernames = new Set();
        while ((match = mentionRegex.exec(message.content)) !== null) {
          mentionedUsernames.add(match[1]);
        }

        if (mentionedUsernames.size > 0) {
          const mentionedUsers = await User.find({
            username: { $in: Array.from(mentionedUsernames) },
          });
          for (const mentionedUser of mentionedUsers) {
            // Ensure the mentioned user is a member of the channel and not the sender
            if (
              channel.members.includes(mentionedUser._id) &&
              mentionedUser._id.toString() !== sender.toString()
            ) {
              // Emit specific mention notification if online
              const mentionedUserSocketIds = getUserSocketIds(
                mentionedUser._id.toString()
              );
              mentionedUserSocketIds.forEach((socketId) => {
                ioInstance.to(socketId).emit("user-mentioned", {
                  messageId: message._id,
                  channelId: channel._id,
                  mentionerId: sender,
                  mentionedId: mentionedUser._id,
                  content: message.content,
                });
              });

              // Create notification for mentioned user
              await Notification.create({
                recipient: mentionedUser._id,
                sender: sender,
                type: "mention",
                content: `${
                  req.user.username || req.user.firstName
                } mentioned you in #${
                  channel.name
                }: "${message.content.substring(0, 50)}..."`,
                relatedEntity: { id: message._id, kind: "Message" },
              });
            }
          }
        }
      }

      // Create notifications for other channel members (excluding sender and mentioned users)
      const otherMembers = channel.members.filter(
        (memberId) =>
          memberId.toString() !== sender.toString() &&
          !mentionedUsernames.has(memberId.username) // Already notified if mentioned
      );

      for (const memberId of otherMembers) {
        if (!isUserOnline(memberId.toString())) {
          await Notification.create({
            recipient: memberId,
            sender: message.sender,
            type: "new_message",
            content: `New message in #${channel.name} from ${
              req.user.username || req.user.firstName
            }`,
            relatedEntity: { id: message._id, kind: "Message" },
          });
        }
      }
    }
  }

  res.status(201).json(populatedMessage);
});

// @desc    Get messages for a specific direct chat or channel
// @route   GET /api/messages/:id?type=direct|channel&page=1&limit=20
// @access  Private
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params; // This is either recipientId or channelId
  const { type = "direct", page = 1, limit = 20 } = req.query;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendErrorResponse(res, null, "Invalid ID format.", 400);
  }

  let query = {};
  if (type === "direct") {
    // Direct messages between current user and :id
    query = {
      $or: [
        { sender: userId, recipient: id },
        { sender: id, recipient: userId },
      ],
    };
  } else if (type === "channel") {
    // Messages in a specific channel
    const channel = await Channel.findById(id);
    if (!channel || !channel.members.includes(userId)) {
      return sendErrorResponse(
        res,
        null,
        "Channel not found or you are not a member.",
        404
      );
    }
    query = { channel: id };
  } else {
    return sendErrorResponse(
      res,
      null,
      'Invalid message type. Must be "direct" or "channel".',
      400
    );
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { timestamp: 1 }, // Sort by timestamp ascending
    populate: {
      path: "sender recipient", // Populate sender and recipient details
      select: "username firstName lastName image color",
    },
  };

  const messages = await Message.paginate(query, options);

  // After fetching messages, mark them as read for the current user
  // (Only for messages sent to the current user or in a channel they are part of)
  const messagesToMarkRead = messages.docs.filter(
    (msg) =>
      !msg.readBy.includes(userId) &&
      (msg.recipient?.toString() === userId.toString() ||
        (msg.channel && type === "channel"))
  );

  if (messagesToMarkRead.length > 0) {
    const messageIdsToUpdate = messagesToMarkRead.map((msg) => msg._id);
    await Message.updateMany(
      { _id: { $in: messageIdsToUpdate } },
      { $addToSet: { readBy: userId } } // Add userId to readBy if not already present
    );

    // Emit 'message-read' events for the messages that were just marked as read
    if (ioInstance) {
      messagesToMarkRead.forEach((msg) => {
        if (msg.recipient) {
          // Direct message
          const senderSocketIds = getUserSocketIds(msg.sender.toString());
          senderSocketIds.forEach((socketId) => {
            ioInstance.to(socketId).emit("message-read", {
              messageId: msg._id,
              readerId: userId,
              chatId: msg.recipient.toString(),
              chatType: "direct",
            });
          });
        } else if (msg.channel) {
          // Channel message
          ioInstance.to(msg.channel.toString()).emit("message-read", {
            messageId: msg._id,
            readerId: userId,
            chatId: msg.channel.toString(),
            chatType: "channel",
          });
        }
      });
    }
  }

  res.status(200).json(messages);
});

// @desc    Edit a message
// @route   PUT /api/messages/:messageId
// @access  Private (Only sender can edit)
export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { newContent, newType } = req.body; // newType could be used if changing from text to something else, or for structured content
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  if (message.sender.toString() !== userId.toString()) {
    return sendErrorResponse(
      res,
      null,
      "Not authorized to edit this message.",
      403
    );
  }

  if (message.isDeleted) {
    return sendErrorResponse(res, null, "Cannot edit a deleted message.", 400);
  }

  // Only allow editing of 'text' type messages or updating content for file messages
  if (message.type !== "text" && !req.file) {
    // If it's a file message and no new file is provided, only allow content update
    if (newContent !== undefined) {
      message.content = newContent;
    } else {
      return sendErrorResponse(
        res,
        null,
        "Only text messages can be fully edited without providing a new file.",
        400
      );
    }
  } else {
    // It's a text message or a file message with a new file being provided
    if (newContent === undefined && !req.file) {
      return sendErrorResponse(
        res,
        null,
        "New content or a new file is required to edit the message.",
        400
      );
    }
    message.content = newContent;
    if (newType) {
      message.type = newType;
    }

    if (req.file) {
      // If a new file is uploaded, update file metadata
      message.file = {
        fileName: req.file.originalname,
        filePath: `/uploads/${req.file.filename}`,
        fileMimeType: req.file.mimetype,
        fileSize: req.file.size,
      };
      message.type = req.file.mimetype.startsWith("image/")
        ? "image"
        : req.file.mimetype.startsWith("video/")
        ? "video"
        : req.file.mimetype.startsWith("audio/")
        ? "audio"
        : "file";
    } else if (message.type !== "text") {
      // If message was a file and no new file is sent, but new content, ensure type remains
      // or if it was text, but changed to text, ensure type remains text
      // This part might need more nuanced logic depending on whether editing a file message means changing its type to text.
      // For now, if no new file and type is not text, it assumes content is being added to an existing file message.
      // If file was there and now not, means content changed to text
      if (!req.file && message.file && newContent !== undefined) {
        message.file = undefined; // Remove file metadata
        message.type = "text"; // Change type to text
      }
    }
  }

  message.isEdited = true;
  message.editedAt = new Date();

  await message.save();
  const populatedMessage = await message
    .populate("sender", "username firstName lastName image color")
    .execPopulate();

  // Emit message edited event via Socket.IO
  if (ioInstance) {
    if (message.recipient) {
      // Direct message
      const recipientSocketIds = getUserSocketIds(message.recipient.toString());
      const senderSocketIds = getUserSocketIds(message.sender.toString());

      recipientSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageEdited", populatedMessage);
      });
      senderSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageEdited", populatedMessage);
      });
    } else if (message.channel) {
      // Channel message
      ioInstance
        .to(message.channel.toString())
        .emit("messageEdited", populatedMessage);
    }
  }

  res.status(200).json(populatedMessage);
});

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId?deleteFor=me|everyone
// @access  Private (Only sender can delete for everyone, any user can delete for themselves)
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { deleteFor } = req.query; // 'me' or 'everyone'
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  if (deleteFor === "everyone") {
    if (message.sender.toString() !== userId.toString()) {
      return sendErrorResponse(
        res,
        null,
        "Not authorized to delete this message for everyone.",
        403
      );
    }
    message.isDeleted = true; // Soft delete
    message.content = "This message was deleted."; // Replace content
    message.file = undefined; // Remove file reference
    message.reactions = []; // Clear reactions
    message.readBy = []; // Reset readBy
    message.deletedFor = []; // Clear personal deletes
  } else if (deleteFor === "me") {
    if (message.deletedFor.includes(userId)) {
      return sendErrorResponse(
        res,
        null,
        "Message already deleted for you.",
        400
      );
    }
    message.deletedFor.push(userId);
  } else {
    return sendErrorResponse(
      res,
      null,
      'Invalid deleteFor parameter. Must be "me" or "everyone".',
      400
    );
  }

  await message.save();

  const populatedMessage = await message
    .populate("sender", "username firstName lastName image color")
    .execPopulate();

  // Emit message deleted event via Socket.IO
  if (ioInstance) {
    if (message.recipient) {
      // Direct message
      const targetUserIds = [
        message.sender.toString(),
        message.recipient.toString(),
      ].filter((id) => id !== null); // Ensure no nulls
      targetUserIds.forEach((targetId) => {
        getUserSocketIds(targetId).forEach((socketId) => {
          ioInstance.to(socketId).emit("messageDeleted", {
            messageId,
            deleteFor,
            deletedBy: userId,
            populatedMessage,
          });
        });
      });
    } else if (message.channel) {
      // Channel message
      ioInstance.to(message.channel.toString()).emit("messageDeleted", {
        messageId,
        deleteFor,
        deletedBy: userId,
        populatedMessage,
      });
    }
  }

  res
    .status(200)
    .json({ message: `Message deleted successfully for ${deleteFor}.` });
});

// @desc    Add a reaction to a message
// @route   POST /api/messages/:messageId/react
// @access  Private
export const addReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body; // e.g., '👍', '❤️'
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  // Check if user already reacted with this emoji
  const existingReactionIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString() && r.emoji === emoji
  );

  if (existingReactionIndex === -1) {
    // Add new reaction
    message.reactions.push({ emoji, user: userId });
  } else {
    // If exists, it means user is trying to add same reaction again.
    // Frontend should prevent this, but backend handles idempotency.
    return sendErrorResponse(
      res,
      null,
      "You have already reacted with this emoji.",
      400
    );
  }

  await message.save();

  // Emit reaction added event via Socket.IO
  if (ioInstance) {
    const reactionData = { messageId, emoji, userId: userId.toString() };
    if (message.recipient) {
      // Direct message
      const recipientSocketIds = getUserSocketIds(message.recipient.toString());
      const senderSocketIds = getUserSocketIds(message.sender.toString());
      recipientSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageReactionAdded", reactionData);
      });
      senderSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageReactionAdded", reactionData);
      });
    } else if (message.channel) {
      // Channel message
      ioInstance
        .to(message.channel.toString())
        .emit("messageReactionAdded", reactionData);
    }
  }

  res.status(200).json({
    message: "Reaction added successfully.",
    reactions: message.reactions,
  });
});

// @desc    Remove a reaction from a message
// @route   DELETE /api/messages/:messageId/react/:emoji
// @access  Private
export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId, emoji } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  // Find and remove the specific reaction by user and emoji
  const initialLength = message.reactions.length;
  message.reactions = message.reactions.filter(
    (r) => !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );

  if (message.reactions.length === initialLength) {
    return sendErrorResponse(
      res,
      null,
      "Reaction not found or you did not add this reaction.",
      404
    );
  }

  await message.save();

  // Emit reaction removed event via Socket.IO
  if (ioInstance) {
    const reactionData = { messageId, emoji, userId: userId.toString() };
    if (message.recipient) {
      // Direct message
      const recipientSocketIds = getUserSocketIds(message.recipient.toString());
      const senderSocketIds = getUserSocketIds(message.sender.toString());
      recipientSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageReactionRemoved", reactionData);
      });
      senderSocketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("messageReactionRemoved", reactionData);
      });
    } else if (message.channel) {
      // Channel message
      ioInstance
        .to(message.channel.toString())
        .emit("messageReactionRemoved", reactionData);
    }
  }

  res.status(200).json({
    message: "Reaction removed successfully.",
    reactions: message.reactions,
  });
});

// @desc    Forward a message
// @route   POST /api/messages/:messageId/forward
// @access  Private
export const forwardMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { targetIds, targetType } = req.body; // targetIds: array of user/channel IDs, targetType: 'direct' or 'channel'
  const sender = req.user._id;

  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return sendErrorResponse(
      res,
      null,
      "At least one target ID is required.",
      400
    );
  }

  const originalMessage = await Message.findById(messageId);

  if (!originalMessage) {
    return sendErrorResponse(res, null, "Original message not found.", 404);
  }

  // Prevent forwarding deleted messages that were deleted for everyone
  if (
    originalMessage.isDeleted &&
    !originalMessage.deletedFor.includes(req.user._id)
  ) {
    return sendErrorResponse(
      res,
      null,
      "Cannot forward a message that was deleted for everyone.",
      400
    );
  }

  const forwardedMessages = [];

  for (const targetId of targetIds) {
    let newMessageData = {
      sender: sender,
      content: originalMessage.content,
      type: originalMessage.type,
      // Only forward file path/metadata if the original message had a file
      ...(originalMessage.file && { file: originalMessage.file }),
      readBy: [sender], // Sender reads their forwarded message
    };

    if (targetType === "direct") {
      const recipientUser = await User.findById(targetId);
      if (!recipientUser) {
        console.warn(
          `Forwarding failed: Recipient user ${targetId} not found.`
        );
        continue; // Skip to next target
      }
      newMessageData.recipient = targetId;
    } else if (targetType === "channel") {
      const channel = await Channel.findById(targetId);
      if (!channel || !channel.members.includes(sender)) {
        console.warn(
          `Forwarding failed: Channel ${targetId} not found or user not a member.`
        );
        continue; // Skip to next target
      }
      newMessageData.channel = targetId;
    } else {
      console.warn(`Forwarding failed: Invalid target type ${targetType}.`);
      continue; // Skip to next target
    }

    const newMessage = await Message.create(newMessageData);
    const populatedNewMessage = await newMessage
      .populate("sender", "username firstName lastName image color")
      .execPopulate();
    forwardedMessages.push(populatedNewMessage);

    // Emit message via Socket.IO
    if (ioInstance) {
      if (newMessage.recipient) {
        const recipientSocketIds = getUserSocketIds(
          newMessage.recipient.toString()
        );
        const senderSocketIds = getUserSocketIds(newMessage.sender.toString());

        recipientSocketIds.forEach((socketId) => {
          ioInstance.to(socketId).emit("privateMessage", populatedNewMessage);
        });
        senderSocketIds.forEach((socketId) => {
          if (socketId !== req.socketId) {
            ioInstance.to(socketId).emit("privateMessage", populatedNewMessage);
          }
        });

        // Create notification if recipient is offline
        if (!isUserOnline(newMessage.recipient.toString())) {
          await Notification.create({
            recipient: newMessage.recipient,
            sender: newMessage.sender,
            type: "new_message",
            content: `New forwarded message from ${
              req.user.username || req.user.firstName
            }`,
            relatedEntity: { id: newMessage._id, kind: "Message" },
          });
        }
      } else if (newMessage.channel) {
        ioInstance
          .to(newMessage.channel.toString())
          .emit("channelMessage", populatedNewMessage);

        // Create notifications for other channel members
        const channel = await Channel.findById(newMessage.channel);
        if (channel) {
          const otherMembers = channel.members.filter(
            (memberId) => memberId.toString() !== sender.toString()
          );
          for (const memberId of otherMembers) {
            if (!isUserOnline(memberId.toString())) {
              await Notification.create({
                recipient: memberId,
                sender: newMessage.sender,
                type: "new_message",
                content: `New forwarded message in #${channel.name} from ${
                  req.user.username || req.user.firstName
                }`,
                relatedEntity: { id: newMessage._id, kind: "Message" },
              });
            }
          }
        }
      }
    }
  }

  if (forwardedMessages.length === 0) {
    return sendErrorResponse(
      res,
      null,
      "Failed to forward message to any target.",
      500
    );
  }

  res
    .status(201)
    .json({ message: "Messages forwarded successfully.", forwardedMessages });
});

// @desc    Search messages
// @route   GET /api/messages/search?query=text&type=direct|channel&id=chat_or_channel_id&page=1&limit=20
// @access  Private
export const searchMessages = asyncHandler(async (req, res) => {
  const { query, type, id, page = 1, limit = 20 } = req.query;
  const userId = req.user._id;

  if (!query) {
    return sendErrorResponse(res, null, "Search query is required.", 400);
  }

  let searchFilter = { $text: { $search: query } }; // Uses the text index on 'content'

  if (type === "direct") {
    if (!id)
      return sendErrorResponse(
        res,
        null,
        "Direct chat ID is required for direct message search.",
        400
      );
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(
        res,
        null,
        "Invalid direct chat ID format.",
        400
      );
    }
    searchFilter.$or = [
      { sender: userId, recipient: id },
      { sender: id, recipient: userId },
    ];
  } else if (type === "channel") {
    if (!id)
      return sendErrorResponse(
        res,
        null,
        "Channel ID is required for channel message search.",
        400
      );
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(res, null, "Invalid channel ID format.", 400);
    }
    const channel = await Channel.findById(id);
    if (!channel || !channel.members.includes(userId)) {
      return sendErrorResponse(
        res,
        null,
        "Channel not found or you are not a member.",
        404
      );
    }
    searchFilter.channel = id;
  } else {
    // If no type or invalid type, search across all messages user has access to
    // This is more complex and would require searching direct messages and channels separately
    // For simplicity, for now, we will require 'type'. Or, we could search only public channels.
    return sendErrorResponse(
      res,
      null,
      'Message search requires a type ("direct" or "channel") and a corresponding ID.',
      400
    );
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { timestamp: -1 }, // Most recent matches first
    populate: {
      path: "sender recipient",
      select: "username firstName lastName image color",
    },
  };

  // Exclude messages deleted for everyone or for the current user
  searchFilter.isDeleted = false;
  searchFilter.deletedFor = { $ne: userId };

  const messages = await Message.paginate(searchFilter, options);

  res.status(200).json(messages);
});
