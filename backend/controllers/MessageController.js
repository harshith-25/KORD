import asyncHandler from "express-async-handler";
import Conversation from "../models/ConversationModel.js";
import Message from "../models/MessagesModel.js";
import User from "../models/UserModel.js";
import Notification from "../models/NotificationModel.js";
import { isUserOnline, getUserSocketIds } from "../socket.js";
import { sendErrorResponse } from "../middleware/errorHandler.js";

// This is the variable that will hold the Socket.IO instance
let ioInstance;

// This function is the one that your server.js needs to call to pass the io instance
export const setIoInstance = (io) => {
  ioInstance = io;
};

// @desc    Send a new message (text or file)
// @route   POST /api/messages/send
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, content, type, isForwarded } = req.body;
  const senderId = req.user.id;
  const file = req.file; // From Multer middleware

  if (!conversationId) {
    return sendErrorResponse(res, null, "Conversation ID is required.", 400);
  }

  if (!content && !file) {
    return sendErrorResponse(
      res,
      null,
      "Message content or a file is required.",
      400
    );
  }

  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    return sendErrorResponse(res, null, "Conversation not found.", 404);
  }

  const senderParticipant = conversation.participants.find(
    (p) => p.user.toString() === senderId.toString()
  );
  if (!senderParticipant || !senderParticipant.isActive) {
    return sendErrorResponse(
      res,
      null,
      "You are not a member of this conversation.",
      403
    );
  }

  // Check conversation settings and user permissions
  if (senderParticipant.isMuted) {
    return sendErrorResponse(
      res,
      null,
      "You are muted in this conversation.",
      403
    );
  }
  if (
    conversation.settings?.onlyAdminsCanMessage &&
    senderParticipant.role !== "admin"
  ) {
    return sendErrorResponse(
      res,
      null,
      "Only admins can send messages in this conversation.",
      403
    );
  }

  // Construct message object
  let messageData = {
    conversationId,
    sender: senderId,
    readBy: [senderId],
    isForwarded: !!isForwarded,
  };

  if (file) {
    messageData.content = content || "";
    messageData.file = {
      fileName: file.originalname,
      filePath: `/uploads/${file.filename}`,
      fileMimeType: file.mimetype,
      fileSize: file.size,
    };
    messageData.type = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
      ? "video"
      : file.mimetype.startsWith("audio/")
      ? "audio"
      : "file";
  } else {
    messageData.content = content;
    messageData.type = type || "text";
  }

  const message = await Message.create(messageData);
  const populatedMessage = await message.populate(
    "sender",
    "username name avatar color"
  );

  // Update conversation's last message and activity
  conversation.lastMessage = {
    messageId: message._id, // Changed from newMessage to message
    content: message.content?.toString().substring(0, 200) || "", // Changed from newMessage to message
    type: message.type, // Changed from newMessage to message
    sender: message.sender, // Changed from newMessage to message
    timestamp: message.createdAt, // Changed from newMessage to message
  };
  conversation.lastActivity = new Date();
  await conversation.save();

  // Emit message via Socket.IO
  if (ioInstance) {
    const roomName =
      conversation.type === "direct"
        ? conversation.conversationId
        : conversation.slug;

    ioInstance.to(roomName).emit("newMessage", populatedMessage);

    const recipients = conversation.participants.filter(
      (p) => p.user.toString() !== senderId.toString() && p.isActive
    );

    // Handle Mentions: Parse message content for @mentions
    const mentionedUsernames = new Set();
    if (typeof message.content === "string") {
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      let match;
      while ((match = mentionRegex.exec(message.content)) !== null) {
        mentionedUsernames.add(match[1]);
      }
    }

    const mentionedUsers = await User.find({
      username: { $in: Array.from(mentionedUsernames) },
    });
    const mentionedUserIds = new Set(
      mentionedUsers.map((u) => u._id.toString())
    );

    for (const recipient of recipients) {
      const recipientId = recipient.user.toString();
      const isRecipientOnline = isUserOnline(recipientId);

      // Create notification if user is offline or if they were mentioned
      if (!isRecipientOnline || mentionedUserIds.has(recipientId)) {
        let notificationContent;
        if (mentionedUserIds.has(recipientId)) {
          notificationContent = `@${
            req.user.username || req.user.firstName
          } mentioned you in ${
            conversation.name ? "#" + conversation.name : "a chat"
          }`;
        } else {
          notificationContent = `New message in ${
            conversation.name ? "#" + conversation.name : "a chat"
          } from ${req.user.username || req.user.firstName}`;
        }

        await Notification.create({
          recipient: recipientId,
          sender: senderId,
          type: mentionedUserIds.has(recipientId) ? "mention" : "new_message",
          content: notificationContent,
          relatedEntity: { id: message._id, kind: "Message" },
        });
      }
    }
  }
  res.status(201).json(populatedMessage);
});

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const currentUserId = req.user.id;

  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    return sendErrorResponse(res, null, "Conversation not found.", 404);
  }
  const isParticipant = conversation.participants.some(
    (p) => p.user.toString() === currentUserId.toString()
  );
  if (!isParticipant) {
    return sendErrorResponse(
      res,
      null,
      "You are not a member of this conversation.",
      403
    );
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: 1 },
    populate: {
      path: "sender",
      select: "name avatar isOnline",
    },
  };

  const messages = await Message.paginate(
    {
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: currentUserId },
    },
    options
  );

  // Fix: Check if readBy exists and is an array before using includes
  const messagesToMarkRead = messages.docs.filter(
    (msg) =>
      !msg.readBy ||
      !Array.isArray(msg.readBy) ||
      !msg.readBy.includes(currentUserId)
  );

  if (messagesToMarkRead.length > 0) {
    const messageIdsToUpdate = messagesToMarkRead.map((m) => m._id);
    await Message.updateMany(
      { _id: { $in: messageIdsToUpdate } },
      { $addToSet: { readBy: currentUserId } }
    );

    if (ioInstance) {
      messagesToMarkRead.forEach((msg) => {
        const senderSocketIds = getUserSocketIds(msg.sender.toString());
        senderSocketIds.forEach((socketId) => {
          ioInstance.to(socketId).emit("message-read", {
            messageId: msg._id,
            readerId: currentUserId,
            conversationId: msg.conversationId,
            chatType: conversation.type,
          });
        });
      });
    }
  }

  res.status(200).json(messages);
});

// @desc    Edit a message
// @route   PUT /api/messages/:messageId
// @access  Private
export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { newContent } = req.body;
  const currentUserId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }
  if (message.sender.toString() !== currentUserId) {
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
  if (!message.canUserEdit()) {
    return sendErrorResponse(res, null, "Editing time limit has expired.", 403);
  }

  message.content = newContent;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const populatedMessage = await Message.populate(message, {
    path: "sender",
    select: "name avatar isOnline",
  });

  if (ioInstance) {
    const conversation = await Conversation.findOne({
      conversationId: message.conversationId,
    });
    const roomName =
      conversation.type === "direct"
        ? conversation.conversationId
        : conversation.slug;
    ioInstance.to(roomName).emit("messageEdited", populatedMessage);
  }

  res.status(200).json(populatedMessage);
});

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId?deleteFor=me|everyone
// @access  Private
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { deleteFor } = req.query; // 'me' or 'everyone'
  const currentUserId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  const conversation = await Conversation.findOne({
    conversationId: message.conversationId,
  });
  const userParticipant = conversation.participants.find(
    (p) => p.user.toString() === currentUserId.toString()
  );
  if (!userParticipant) {
    return sendErrorResponse(
      res,
      null,
      "You are not a member of this conversation.",
      403
    );
  }

  const isSender = message.sender.toString() === currentUserId;
  const isAdmin = userParticipant.role === "admin";
  const isModerator = userParticipant.role === "moderator";

  if (deleteFor === "everyone") {
    if (!isSender && !isAdmin && !isModerator) {
      return sendErrorResponse(
        res,
        null,
        "Not authorized to delete this message for everyone.",
        403
      );
    }

    message.isDeleted = true;
    message.content = "This message was deleted.";
    message.file = undefined;
    message.reactions = [];
    message.readBy = [];
    message.deletedFor = [];
  } else if (deleteFor === "me") {
    message.deletedFor.push(currentUserId);
  } else {
    return sendErrorResponse(
      res,
      null,
      'Invalid deleteFor parameter. Must be "me" or "everyone".',
      400
    );
  }
  await message.save();

  if (ioInstance) {
    const roomName =
      conversation.type === "direct"
        ? conversation.conversationId
        : conversation.slug;
    ioInstance.to(roomName).emit("messageDeleted", {
      messageId,
      deleteFor,
      deletedBy: currentUserId,
    });
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
  const { emoji } = req.body;
  const currentUserId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  const reactionExists = message.reactions.some(
    (r) => r.user.toString() === currentUserId && r.emoji === emoji
  );
  if (reactionExists) {
    return sendErrorResponse(
      res,
      null,
      "You have already reacted with this emoji.",
      400
    );
  }

  message.reactions.push({ emoji, user: currentUserId });
  await message.save();

  if (ioInstance) {
    const conversation = await Conversation.findOne({
      conversationId: message.conversationId,
    });
    const roomName =
      conversation.type === "direct"
        ? conversation.conversationId
        : conversation.slug;
    ioInstance.to(roomName).emit("messageReactionAdded", {
      messageId,
      emoji,
      userId: currentUserId,
    });
  }

  res.status(200).json({
    message: "Reaction added successfully.",
    reactions: message.reactions,
  });
});

// @desc    Remove a reaction from a message
// @route   DELETE /api/messages/:messageId/react
// @access  Private
export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const currentUserId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  const initialLength = message.reactions.length;
  message.reactions = message.reactions.filter(
    (r) => !(r.user.toString() === currentUserId && r.emoji === emoji)
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

  if (ioInstance) {
    const conversation = await Conversation.findOne({
      conversationId: message.conversationId,
    });
    const roomName =
      conversation.type === "direct"
        ? conversation.conversationId
        : conversation.slug;
    ioInstance.to(roomName).emit("messageReactionRemoved", {
      messageId,
      emoji,
      userId: currentUserId,
    });
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
  const { targetConversationIds } = req.body;
  const currentUserId = req.user.id;

  if (
    !Array.isArray(targetConversationIds) ||
    targetConversationIds.length === 0
  ) {
    return sendErrorResponse(
      res,
      null,
      "At least one target conversation ID is required.",
      400
    );
  }

  const originalMessage = await Message.findById(messageId);
  if (!originalMessage) {
    return sendErrorResponse(res, null, "Original message not found.", 404);
  }

  const senderConversation = await Conversation.findOne({
    conversationId: originalMessage.conversationId,
  });
  if (
    !senderConversation.participants.some(
      (p) => p.user.toString() === currentUserId
    )
  ) {
    return sendErrorResponse(
      res,
      null,
      "You are not a member of the original conversation.",
      403
    );
  }

  const forwardedMessages = [];
  for (const conversationId of targetConversationIds) {
    const targetConversation = await Conversation.findOne({ conversationId });
    if (!targetConversation) {
      console.warn(
        `Forwarding failed: Target conversation ${conversationId} not found.`
      );
      continue;
    }

    const newParticipant = targetConversation.participants.find(
      (p) => p.user.toString() === currentUserId
    );
    if (!newParticipant) {
      console.warn(
        `Forwarding failed: User ${currentUserId} is not a member of conversation ${conversationId}.`
      );
      continue;
    }

    const newMessageData = {
      conversationId,
      sender: currentUserId,
      content: originalMessage.content,
      type: originalMessage.type,
      file: originalMessage.file,
      isForwarded: true,
      readBy: [currentUserId],
    };
    const newMessage = await Message.create(newMessageData);
    await targetConversation.updateLastMessage(newMessage);

    const populatedNewMessage = await Message.populate(newMessage, {
      path: "sender",
      select: "name avatar isOnline",
    });
    forwardedMessages.push(populatedNewMessage);

    if (ioInstance) {
      const roomName =
        targetConversation.type === "direct"
          ? targetConversation.conversationId
          : targetConversation.slug;
      ioInstance.to(roomName).emit("newMessage", populatedNewMessage);
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
// @route   GET /api/messages/search?query=text&conversationId=chat_id
// @access  Private
export const searchMessages = asyncHandler(async (req, res) => {
  const { query, conversationId, page = 1, limit = 20 } = req.query;
  const currentUserId = req.user.id;

  if (!query) {
    return sendErrorResponse(res, null, "Search query is required.", 400);
  }

  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    return sendErrorResponse(res, null, "Conversation not found.", 404);
  }
  const isParticipant = conversation.participants.some(
    (p) => p.user.toString() === currentUserId
  );
  if (!isParticipant) {
    return sendErrorResponse(
      res,
      null,
      "You are not a member of this conversation.",
      403
    );
  }

  const searchFilter = {
    conversationId,
    $text: { $search: query },
    isDeleted: false,
    deletedFor: { $ne: currentUserId },
  };
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
    populate: {
      path: "sender",
      select: "name avatar isOnline",
    },
  };
  const messages = await Message.paginate(searchFilter, options);
  res.status(200).json(messages);
});
