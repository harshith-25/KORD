import asyncHandler from "express-async-handler";
import Conversation from "../models/ConversationModel.js";
import Message from "../models/MessagesModel.js";
import User from "../models/UserModel.js";
import Notification from "../models/NotificationModel.js";
import { getIo, isUserOnline, getUserSocketIds } from "../socket.js";
import { sendErrorResponse } from "../middleware/errorHandler.js";

// Helper function to format reply data consistently
const formatReplyData = (repliedMsg, currentUserId) => {
  if (!repliedMsg) return null;

  const isDeletedForUser = repliedMsg.deletedFor?.some(
    (id) => id.toString() === currentUserId.toString()
  );

  // Get sender name - handle different name formats
  let senderName = "Unknown User";
  if (repliedMsg.sender) {
    if (repliedMsg.sender.firstName) {
      senderName = `${repliedMsg.sender.firstName} ${
        repliedMsg.sender.lastName || ""
      }`.trim();
    } else if (repliedMsg.sender.name) {
      senderName = repliedMsg.sender.name;
    } else if (repliedMsg.sender.username) {
      senderName = repliedMsg.sender.username;
    }
  }

  const baseReply = {
    messageId: repliedMsg._id,
    _id: repliedMsg._id,
    type: repliedMsg.type,
    sender: repliedMsg.sender,
    senderName,
    createdAt: repliedMsg.createdAt,
    isAvailable: true,
  };

  if (repliedMsg.isDeleted || isDeletedForUser) {
    return {
      ...baseReply,
      content: "This message was deleted",
      isDeleted: true,
      isAvailable: false,
    };
  }

  return {
    ...baseReply,
    content: repliedMsg.content,
    file: repliedMsg.file
      ? {
          fileName: repliedMsg.file.fileName,
          fileMimeType: repliedMsg.file.fileMimeType,
          thumbnailPath: repliedMsg.file.thumbnailPath,
        }
      : undefined,
    isDeleted: false,
  };
};

// @desc    Send a new message (text or file) with reply support
// @route   POST /api/messages/send
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
  const {
    conversationId,
    content,
    type,
    isForwarded,
    replyTo, // ID of the message being replied to
    metadata = {},
  } = req.body;
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

  // Validate replyTo if provided
  if (replyTo) {
    const repliedMessage = await Message.findById(replyTo);
    if (!repliedMessage) {
      return sendErrorResponse(res, null, "Replied message not found.", 404);
    }
    if (repliedMessage.conversationId !== conversationId) {
      return sendErrorResponse(
        res,
        null,
        "Cannot reply to a message from a different conversation.",
        400
      );
    }
    // Check if the replied message is deleted
    if (repliedMessage.isDeleted) {
      return sendErrorResponse(
        res,
        null,
        "Cannot reply to a deleted message.",
        400
      );
    }
    // Check if the message is deleted for the current user
    if (repliedMessage.isDeletedFor(senderId)) {
      return sendErrorResponse(
        res,
        null,
        "Cannot reply to a deleted message.",
        400
      );
    }
  }

  // Construct message object
  let messageData = {
    conversationId,
    sender: senderId,
    readReceipts: [{ user: senderId, readAt: new Date() }], // Sender always reads their own message
    deliveryReceipts: [], // Will be populated when recipients receive it
    isForwarded: !!isForwarded,
    replyTo: replyTo || null,
    metadata,
    deliveryStatus: "sent", // Starts as "sent" when saved to server
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

  // Populate message with sender and reply details
  const populatedMessage = await Message.findById(message._id)
    .populate(
      "sender",
      "firstName lastName username name avatar color image isOnline"
    )
    .populate({
      path: "replyTo",
      select: "content type sender file isDeleted deletedFor",
      populate: {
        path: "sender",
        select: "firstName lastName username name avatar",
      },
    });

  // Format reply data for frontend (handle deleted messages)
  if (populatedMessage.replyTo) {
    populatedMessage.replyTo = formatReplyData(
      populatedMessage.replyTo,
      senderId
    );
  }

  // Update conversation's last message and activity
  await Conversation.findOneAndUpdate(
    { conversationId },
    {
      $set: {
        lastMessage: {
          messageId: message._id,
          content: message.content?.toString().substring(0, 200) || "",
          type: message.type,
          sender: message.sender,
          timestamp: message.createdAt,
        },
        lastActivity: new Date(),
      },
      $inc: { messageCount: 1 },
    }
  );

  // Emit message via Socket.IO
  try {
    const io = getIo();
    io.to(conversationId).emit("message_received", populatedMessage);
    console.log(`✅ Message broadcasted to conversation ${conversationId}`);

    const recipients = conversation.participants.filter(
      (p) => p.user.toString() !== senderId.toString() && p.isActive
    );

    // Mark as delivered for online recipients immediately
    // Process sequentially to avoid race conditions
    for (const recipient of recipients) {
      const recipientId = recipient.user.toString();
      const isRecipientOnline = isUserOnline(recipientId);

      if (isRecipientOnline) {
        // Recipient is online - mark as delivered immediately
        try {
          // Reload message to ensure we have the latest version with methods
          const messageToUpdate = await Message.findById(message._id);
          if (messageToUpdate) {
            await messageToUpdate.markAsDelivered(recipientId);

            // Emit delivery status to sender
            const senderSocketIds = getUserSocketIds(senderId);
            senderSocketIds.forEach((socketId) => {
              io.to(socketId).emit("message_delivered", {
                messageId: message._id,
                conversationId,
                recipientId,
                deliveredAt: new Date(),
              });
            });

            console.log(
              `✅ Message ${message._id} marked as delivered to ${recipientId}`
            );
          }
        } catch (error) {
          console.error(`Error marking message as delivered:`, error);
        }
      }
    }

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

    // If this is a reply, notify the original message sender
    if (
      replyTo &&
      populatedMessage.replyTo &&
      !populatedMessage.replyTo.isDeleted
    ) {
      const originalSenderId = populatedMessage.replyTo.sender._id.toString();
      if (originalSenderId !== senderId.toString()) {
        const isOriginalSenderOnline = isUserOnline(originalSenderId);
        if (!isOriginalSenderOnline) {
          await Notification.create({
            recipient: originalSenderId,
            sender: senderId,
            type: "reply",
            content: `${
              req.user.username || req.user.firstName
            } replied to your message in ${
              conversation.name ? "#" + conversation.name : "a chat"
            }`,
            relatedEntity: { id: message._id, kind: "Message" },
            metadata: {
              replyPreview: message.content?.toString().substring(0, 50) || "",
              originalMessageId: replyTo,
              conversationId: conversationId,
            },
          });
        }
      }
    }

    // Send notifications to other recipients
    for (const recipient of recipients) {
      const recipientId = recipient.user.toString();

      // Skip if already notified as reply recipient
      if (
        replyTo &&
        populatedMessage.replyTo &&
        recipientId === populatedMessage.replyTo.sender._id.toString()
      ) {
        continue;
      }

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
  } catch (error) {
    console.error("Error emitting message via Socket.IO:", error);
  }

  res.status(201).json(populatedMessage);
});

// @desc    Get messages for a conversation with reply support
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

  // Use custom static method with reply support
  const messages = await Message.findConversationMessages(conversationId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    userId: currentUserId,
    includeDeleted: false,
  });

  const formattedMessages = messages.map((msg) => {
    if (msg.replyTo) {
      const plainMsg = msg.toObject ? msg.toObject() : msg;
      plainMsg.replyTo = formatReplyData(msg.replyTo, currentUserId);
      return plainMsg;
    }
    return msg;
  });

  // Mark messages as read - only for messages from other users
  const messagesToMarkRead = messages.filter((msg) => {
    // Skip messages sent by the current user
    if (msg.sender._id.toString() === currentUserId.toString()) {
      return false;
    }

    if (!msg.readReceipts || !Array.isArray(msg.readReceipts)) {
      return true;
    }

    const hasRead = msg.readReceipts.some((receipt) => {
      if (typeof receipt === "object" && receipt.user) {
        return receipt.user.toString() === currentUserId.toString();
      }
      return receipt.toString() === currentUserId.toString();
    });

    return !hasRead;
  });

  if (messagesToMarkRead.length > 0) {
    const messageIdsToUpdate = messagesToMarkRead.map((m) => m._id);
    const readAt = new Date();

    await Message.updateMany(
      { _id: { $in: messageIdsToUpdate } },
      {
        $addToSet: {
          readReceipts: {
            user: currentUserId,
            readAt: readAt,
          },
        },
      }
    );

    // Emit read receipts via Socket.IO
    try {
      const io = getIo();

      // Emit bulk read event to all participants
      io.to(conversationId).emit("messages_read", {
        conversationId,
        userId: currentUserId,
        count: messagesToMarkRead.length,
        readAt: readAt,
      });

      // Emit individual message_read events for each sender
      const senderIds = new Set();
      messagesToMarkRead.forEach((msg) => {
        const senderId = msg.sender._id.toString();
        if (!senderIds.has(senderId)) {
          senderIds.add(senderId);
          const senderSocketIds = getUserSocketIds(senderId);
          senderSocketIds.forEach((socketId) => {
            io.to(socketId).emit("message_read", {
              messageId: msg._id,
              readerId: currentUserId,
              conversationId: msg.conversationId,
              readAt: readAt,
            });
          });
        }
      });

      console.log(
        `✅ ${messagesToMarkRead.length} messages marked as read by user ${currentUserId} in conversation ${conversationId}`
      );
    } catch (error) {
      console.error("Error emitting read receipts:", error);
    }
  }

  // Return messages with pagination-like structure for frontend compatibility
  res.status(200).json({
    docs: formattedMessages, // Changed from messages
    totalDocs: formattedMessages.length,
    limit: parseInt(limit, 10),
    page: parseInt(page, 10),
    totalPages: Math.ceil(messages.length / parseInt(limit, 10)),
    hasNextPage: messages.length === parseInt(limit, 10),
    hasPrevPage: parseInt(page, 10) > 1,
  });
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

  if (!message.sender) {
    return sendErrorResponse(res, null, "Sender information is missing.", 400);
  }

  if (message.sender.toString() !== currentUserId.toString()) {
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

  if (message.canUserEdit && !message.canUserEdit(currentUserId)) {
    return sendErrorResponse(res, null, "Editing time limit has expired.", 403);
  }

  message.content = newContent;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Populate after saving with reply support
  const populatedMessage = await Message.findById(message._id)
    .populate(
      "sender",
      "firstName lastName username name avatar image isOnline"
    )
    .populate({
      path: "replyTo",
      select: "content type sender file isDeleted deletedFor",
      populate: {
        path: "sender",
        select: "firstName lastName username name avatar",
      },
    });

  // Format reply data for frontend
  if (populatedMessage.replyTo) {
    populatedMessage.replyTo = formatReplyData(
      populatedMessage.replyTo,
      currentUserId
    );
  }

  try {
    const io = getIo();
    io.to(message.conversationId).emit("message_edited", {
      conversationId: message.conversationId,
      messageId: message._id,
      newContent: message.content,
      editedAt: message.editedAt,
    });
    console.log(`✅ Edit emitted for message ${messageId}`);
  } catch (error) {
    console.error("Error emitting message edit:", error);
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
    message.location = undefined;
    message.contact = undefined;
    message.reactions = [];
    message.readReceipts = [];
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

  try {
    const io = getIo();
    io.to(message.conversationId).emit("message_deleted", {
      conversationId: message.conversationId,
      messageId,
      deleteFor,
      deletedBy: currentUserId,
    });
    console.log(`✅ Delete emitted for message ${messageId}`);
  } catch (error) {
    console.error("Error emitting message delete:", error);
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

  if (!emoji) {
    return sendErrorResponse(res, null, "Emoji is required.", 400);
  }

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  // Use the addReaction method from the model
  try {
    await message.addReaction(currentUserId, emoji);

    // Reload to get updated reactions
    const updatedMessage = await Message.findById(messageId).populate(
      "reactions.user",
      "name username firstName lastName avatar image"
    );

    const io = getIo();
    io.to(message.conversationId).emit("message_reaction", {
      conversationId: message.conversationId,
      messageId,
      reaction: { emoji, user: currentUserId },
      reactions: updatedMessage.reactions,
    });
    console.log(`✅ Reaction emitted for message ${messageId}`);

    res.status(200).json({
      message: "Reaction added successfully.",
      reactions: updatedMessage.reactions,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return sendErrorResponse(res, null, "Failed to add reaction.", 500);
  }
});

// @desc    Remove a reaction from a message
// @route   DELETE /api/messages/:messageId/react
// @access  Private
export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const currentUserId = req.user.id;

  if (!emoji) {
    return sendErrorResponse(res, null, "Emoji is required.", 400);
  }

  const message = await Message.findById(messageId);
  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  // Use the removeReaction method from the model
  try {
    await message.removeReaction(currentUserId, emoji);

    // Reload to get updated reactions
    const updatedMessage = await Message.findById(messageId).populate(
      "reactions.user",
      "name username firstName lastName avatar image"
    );

    const io = getIo();
    io.to(message.conversationId).emit("message_reaction", {
      conversationId: message.conversationId,
      messageId,
      reaction: { emoji, user: currentUserId, removed: true },
      reactions: updatedMessage.reactions,
    });
    console.log(`✅ Reaction removal emitted for message ${messageId}`);

    res.status(200).json({
      message: "Reaction removed successfully.",
      reactions: updatedMessage.reactions,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return sendErrorResponse(res, null, "Failed to remove reaction.", 500);
  }
});

// @desc    Forward a message (with reply support)
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
  const io = getIo();

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
      location: originalMessage.location,
      contact: originalMessage.contact,
      metadata: originalMessage.metadata || {},
      replyTo: null, // Clear reply reference when forwarding
      forwardedFrom: {
        originalSender: originalMessage.sender,
        originalConversationId: originalMessage.conversationId,
        originalMessageId: originalMessage._id,
        forwardedAt: new Date(),
      },
      readReceipts: [{ user: currentUserId, readAt: new Date() }],
      deliveryReceipts: [],
      deliveryStatus: "sent",
    };
    const newMessage = await Message.create(newMessageData);

    // Update conversation last message
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

    const populatedNewMessage = await Message.findById(newMessage._id)
      .populate(
        "sender",
        "firstName lastName username name avatar image isOnline"
      )
      .populate(
        "forwardedFrom.originalSender",
        "firstName lastName username name avatar"
      );

    forwardedMessages.push(populatedNewMessage);

    try {
      io.to(conversationId).emit("message_received", populatedNewMessage);
      console.log(
        `✅ Forwarded message broadcasted to conversation ${conversationId}`
      );
    } catch (error) {
      console.error(
        `Error emitting forwarded message to ${conversationId}:`,
        error
      );
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

// @desc    Search messages (with reply support)
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
    populate: [
      {
        path: "sender",
        select: "firstName lastName username name avatar image isOnline",
      },
      {
        path: "replyTo",
        select: "content type sender file isDeleted deletedFor",
        populate: {
          path: "sender",
          select: "firstName lastName username name avatar",
        },
      },
    ],
  };
  const messages = await Message.paginate(searchFilter, options);

  // Format reply data for deleted messages in search results
  messages.docs = messages.docs.map((msg) => {
    if (msg.replyTo) {
      msg.replyTo = formatReplyData(msg.replyTo, currentUserId);
    }
    return msg;
  });

  res.status(200).json(messages);
});

// @desc    Get detailed message info (delivery and read receipts)
// @route   GET /api/messages/:messageId/info
// @access  Private
export const getMessageInfo = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const currentUserId = req.user.id;

  const message = await Message.findById(messageId)
    .populate("sender", "firstName lastName username name avatar image")
    .populate({
      path: "deliveryReceipts.user",
      select: "firstName lastName username name avatar image",
    })
    .populate({
      path: "readReceipts.user",
      select: "firstName lastName username name avatar image",
    })
    .populate({
      path: "reactions.user",
      select: "firstName lastName username name avatar image",
    });

  if (!message) {
    return sendErrorResponse(res, null, "Message not found.", 404);
  }

  // Verify user is part of the conversation
  const conversation = await Conversation.findOne({
    conversationId: message.conversationId,
  });

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
      "You are not authorized to view this message info.",
      403
    );
  }

  // Only the sender can view message info (WhatsApp behavior)
  const isSender = message.sender._id.toString() === currentUserId.toString();
  if (!isSender) {
    return sendErrorResponse(
      res,
      null,
      "Only the message sender can view message info.",
      403
    );
  }

  // Format delivery receipts with user info (exclude sender)
  const deliveryReceipts = (message.deliveryReceipts || [])
    .filter((receipt) => receipt.user._id.toString() !== message.sender._id.toString())
    .map((receipt) => {
      const user = receipt.user;
      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          username: user.username,
          phone: user.phone,
          email: user.email,
          avatar: user.avatar,
          image: user.image,
        },
        deliveredAt: receipt.deliveredAt,
      };
    });

  // Format read receipts with user info (exclude sender)
  const readReceipts = (message.readReceipts || [])
    .filter((receipt) => receipt.user._id.toString() !== message.sender._id.toString())
    .map((receipt) => {
      const user = receipt.user;
      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          username: user.username,
          phone: user.phone,
          email: user.email,
          avatar: user.avatar,
          image: user.image,
        },
        readAt: receipt.readAt,
      };
    });

  // Format reactions with user info
  const reactions = (message.reactions || []).map((reaction) => {
    const user = reaction.user;
    return {
      emoji: reaction.emoji,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        image: user.image,
      },
      reactedAt: reaction.reactedAt,
    };
  });

  // Get list of all participants who haven't read or received the message
  const allParticipantIds = conversation.participants
    .filter(
      (p) => p.isActive && p.user.toString() !== message.sender.toString()
    )
    .map((p) => p.user.toString());

  const deliveredUserIds = deliveryReceipts.map((r) => r.user._id.toString());
  const readUserIds = readReceipts.map((r) => r.user._id.toString());

  const notDeliveredUserIds = allParticipantIds.filter(
    (id) => !deliveredUserIds.includes(id)
  );
  const deliveredButNotReadUserIds = deliveredUserIds.filter(
    (id) => !readUserIds.includes(id)
  );

  // Get delivered timestamps for users who haven't read
  const deliveredButNotReadWithTimestamps = deliveryReceipts.filter((receipt) =>
    deliveredButNotReadUserIds.includes(receipt.user._id.toString())
  );

  // Calculate global deliveredAt and readAt timestamps
  let globalDeliveredAt = null;
  let globalReadAt = null;

  // For deliveredAt, we need ALL users who have either delivered OR read
  // Build a complete list of delivery timestamps
  const allDeliveryTimestamps = [];
  const userIdsWithDelivery = new Set();
  
  // Add explicit delivery receipts
  deliveryReceipts.forEach(receipt => {
    if (receipt.deliveredAt) {
      allDeliveryTimestamps.push(receipt.deliveredAt);
      userIdsWithDelivery.add(receipt.user._id.toString());
    }
  });
  
  // For users who have READ but don't have an explicit delivery receipt,
  // we need to find their delivery timestamp from the original message
  readReceipts.forEach(receipt => {
    const userId = receipt.user._id.toString();
    if (!userIdsWithDelivery.has(userId)) {
      // Check if this user has a delivery receipt in the original message
      const originalDeliveryReceipt = (message.deliveryReceipts || []).find(
        dr => dr.user._id.toString() === userId
      );
      if (originalDeliveryReceipt && originalDeliveryReceipt.deliveredAt) {
        allDeliveryTimestamps.push(originalDeliveryReceipt.deliveredAt);
      }
    }
  });
  
  // Use the EARLIEST timestamp as globalDeliveredAt
  if (allDeliveryTimestamps.length > 0) {
    globalDeliveredAt = allDeliveryTimestamps.reduce((earliest, timestamp) => {
      const current = new Date(timestamp);
      return !earliest || current < new Date(earliest) ? timestamp : earliest;
    }, null);
  }

  // For readAt, use the LATEST read time (when the last person read it)
  if (readReceipts.length > 0) {
    globalReadAt = readReceipts.reduce((latest, receipt) => {
      const current = new Date(receipt.readAt);
      return !latest || current > new Date(latest) ? receipt.readAt : latest;
    }, null);
  }

  // Fetch user details for those who haven't delivered
  const notDeliveredUsers = await User.find({
    _id: { $in: notDeliveredUserIds },
  }).select("firstName lastName username name avatar image");

  // Prepare file/media info for preview
  let filePreview = null;
  if (message.file) {
    filePreview = {
      type: message.file.fileType || message.type,
      name: message.file.fileName,
      url: message.file.filePath,
      size: message.file.fileSize,
    };
  }

  const messageInfo = {
    messageId: message._id,
    conversationId: message.conversationId,
    isGroupMessage:
      conversation.type === "group" || conversation.participants.length > 2,
    
    // Message details for preview
    content: message.content,
    type: message.type,
    file: filePreview,
    createdAt: message.createdAt,
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,

    // Global timestamps for top-level display
    deliveredAt: globalDeliveredAt,
    readAt: globalReadAt,

    // Read receipts (people who read the message)
    readReceipts,
    readCount: readReceipts.length,

    // Delivered but not read (people who haven't read yet) - WITH timestamps
    deliveredButNotReadUsers: deliveredButNotReadWithTimestamps.map((receipt) => ({
      user: receipt.user,
      deliveredAt: receipt.deliveredAt,
    })),
    pendingReadCount: deliveredButNotReadWithTimestamps.length,

    // Summary
    totalParticipants: allParticipantIds.length,

    // Users who haven't interacted with message yet
    notDeliveredUsers: notDeliveredUsers.map((u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      image: u.image,
    })),
  };

  res.status(200).json(messageInfo);
});
