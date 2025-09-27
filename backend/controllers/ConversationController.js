import Conversation from "../models/ConversationModel.js";
import User from "../models/UserModel.js";
import { validationResult } from "express-validator";

// @desc    Get or create a direct conversation
// @route   POST /api/conversations/direct
const getOrCreateDirectConversation = async (req, res) => {
  const { userId } = req.body;
  const currentUserId = req.user.id;

  if (currentUserId === userId) {
    return res
      .status(400)
      .json({ message: "Cannot create a direct conversation with yourself." });
  }

  try {
    const sortedIds = [currentUserId.toString(), userId.toString()].sort();
    const conversationId = `direct_${sortedIds[0]}_${sortedIds[1]}`;

    // Find the conversation and automatically populate the user details
    let conversation = await Conversation.findOne({ conversationId })
      .populate("directParticipants")
      .populate("participants.user");

    if (!conversation) {
      const usersExist =
        (await User.countDocuments({
          _id: { $in: [currentUserId, userId] },
        })) === 2;
      if (!usersExist) {
        return res
          .status(404)
          .json({ message: "One or more users not found." });
      }

      conversation = await Conversation.create({
        conversationId,
        type: "direct",
        directParticipants: [currentUserId, userId],
        participants: [{ user: currentUserId }, { user: userId }],
        createdBy: currentUserId,
      });

      // If a new conversation was created, we need to populate it before sending the response
      conversation = await conversation
        .populate("directParticipants")
        .populate("participants.user");
    }

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new group or channel
// @route   POST /api/conversations
const createGroupOrChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { type, name, description, participants, settings, isPublic } =
    req.body;
  const currentUserId = req.user.id;

  if (type === "direct") {
    return res.status(400).json({
      message: "Use POST /api/conversations/direct for direct chats.",
    });
  }

  try {
    const allParticipants = [...new Set([...participants, currentUserId])];
    if (allParticipants.length < 2) {
      return res
        .status(400)
        .json({ message: `${type}s must have at least 2 members.` });
    }

    const newConversation = await Conversation.create({
      type,
      name,
      description,
      isPublic,
      participants: allParticipants.map((userId) => ({ user: userId })),
      createdBy: currentUserId,
      settings: settings || {},
    });

    // Populate the user details for the new conversation before sending
    const populatedConversation = await newConversation.populate(
      "participants.user"
    );

    res.status(201).json(populatedConversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a user's conversations
// @route   GET /api/conversations
const getUserConversations = async (req, res) => {
  const currentUserId = req.user.id;
  const { page = 1, limit = 20, type = null } = req.query;

  try {
    const query = {
      "participants.user": currentUserId,
      "participants.isActive": true,
    };
    if (type) {
      query.type = type;
    }

    const conversations = await Conversation.find(query)
      .populate("lastMessage.sender", "firstName lastName email image")
      // Updated: Populate participants with all user details
      .populate(
        "participants.user",
        "firstName lastName email username image name avatar isOnline"
      )
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single conversation by ID
// @route   GET /api/conversations/:conversationId
const getConversationById = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId })
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image"
      )
      // Updated: Populate createdBy with full user details
      .populate(
        "createdBy",
        "firstName lastName name avatar email username image"
      )
      .populate("pinnedMessages.messageId");

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user._id.toString() === currentUserId
    );
    if (!isParticipant && !conversation.isPublic) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update conversation info
// @route   PUT /api/conversations/:conversationId
const updateConversationInfo = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;
  const { name, description, avatar, settings, isPublic } = req.body;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId
    );
    const canEdit =
      currentUserParticipant &&
      (currentUserParticipant.role === "admin" ||
        currentUserParticipant.permissions.canEditInfo);

    if (!canEdit) {
      return res.status(403).json({
        message: "You do not have permission to edit this conversation.",
      });
    }

    conversation.name = name || conversation.name;
    conversation.description = description || conversation.description;
    conversation.avatar = avatar || conversation.avatar;
    conversation.settings = { ...conversation.settings, ...settings };
    conversation.isPublic =
      isPublic !== undefined ? isPublic : conversation.isPublic;

    await conversation.save();

    // Updated: Re-fetch and populate the document to return the complete object
    const populatedConversation = await Conversation.findOne({ conversationId })
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image"
      )
      .populate(
        "createdBy",
        "firstName lastName name avatar email username image"
      );

    res.status(200).json(populatedConversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a public group or channel
// @route   POST /api/conversations/:conversationId/join
const joinConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    if (conversation.isPublic && !conversation.settings.requireApprovalToJoin) {
      const isAlreadyMember = conversation.participants.some(
        (p) => p.user.toString() === currentUserId
      );
      if (isAlreadyMember) {
        return res.status(400).json({ message: "Already a member." });
      }

      conversation.participants.push({ user: currentUserId, role: "member" });
      await conversation.save();
      return res
        .status(200)
        .json({ message: "Joined conversation successfully." });
    } else if (conversation.settings.requireApprovalToJoin) {
      const isAlreadyRequested = conversation.joinRequests.some(
        (r) => r.user.toString() === currentUserId
      );
      if (isAlreadyRequested) {
        return res
          .status(400)
          .json({ message: "Join request already submitted." });
      }
      conversation.joinRequests.push({
        user: currentUserId,
        message: req.body.message,
      });
      await conversation.save();
      return res
        .status(202)
        .json({ message: "Join request submitted for approval." });
    } else {
      return res
        .status(403)
        .json({ message: "Cannot join this conversation directly." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a member to a group or channel
// @route   POST /api/conversations/:conversationId/add
const addMember = async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId
    );
    const canAdd =
      currentUserParticipant &&
      (currentUserParticipant.role === "admin" ||
        currentUserParticipant.permissions.canAddMembers);

    if (!canAdd) {
      return res
        .status(403)
        .json({ message: "You do not have permission to add members." });
    }

    const isAlreadyMember = conversation.participants.some(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (isAlreadyMember) {
      return res.status(400).json({ message: "User is already a member." });
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd)
      return res.status(404).json({ message: "User to add not found." });

    conversation.participants.push({ user: userId, role: "member" });
    await conversation.save();

    res.status(200).json({ message: "Member added successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Leave a group or channel
// @route   POST /api/conversations/:conversationId/leave
const leaveConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    const participant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId
    );
    if (!participant)
      return res
        .status(400)
        .json({ message: "You are not a member of this conversation." });

    participant.isActive = false;
    participant.leftAt = new Date();
    await conversation.save();

    res.status(200).json({ message: "Successfully left the conversation." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public groups and channels
// @route   GET /api/conversations/public
const getPublicConversations = async (req, res) => {
  const { page = 1, limit = 20, type = ["group", "channel"] } = req.query;

  try {
    const conversations = await Conversation.find({
      type: { $in: type },
      isPublic: true,
      isActive: true,
      isArchived: false,
    })
      .select(
        "name description avatar type memberCount lastActivity participants"
      )
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image isOnline"
      )
      .sort({ memberCount: -1, lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a member from a group or channel
// @route   DELETE /api/conversations/:conversationId/members/:userId
const removeMember = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    } // Check if the current user is an admin

    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can remove members.",
      });
    } // Find the participant to be removed

    const memberToRemove = conversation.participants.find(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (!memberToRemove) {
      return res.status(404).json({ message: "User is not an active member." });
    } // Prevent an admin from removing the last admin

    const activeAdmins = conversation.participants.filter(
      (p) => p.role === "admin" && p.isActive
    );
    if (activeAdmins.length === 1 && memberToRemove.role === "admin") {
      return res.status(400).json({
        message: "Cannot remove the last administrator.",
      });
    } // Set the user's isActive status to false

    memberToRemove.isActive = false;
    memberToRemove.removedBy = currentUserId;
    memberToRemove.removedAt = new Date();
    await conversation.save();

    res.status(200).json({ message: "Member removed successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getOrCreateDirectConversation,
  createGroupOrChannel,
  getUserConversations,
  getConversationById,
  updateConversationInfo,
  joinConversation,
  addMember,
  leaveConversation,
  getPublicConversations,
  removeMember,
};
