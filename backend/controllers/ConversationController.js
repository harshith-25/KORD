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
      .populate(
        "directParticipants",
        "firstName lastName email username image isOnline"
      )
      .populate(
        "participants.user",
        "firstName lastName email username image isOnline"
      );

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
      conversation = await Conversation.findById(conversation._id)
        .populate(
          "directParticipants",
          "firstName lastName email username image isOnline"
        )
        .populate(
          "participants.user",
          "firstName lastName email username image isOnline"
        );

      // Emit socket event for new conversation
      const io = req.app.get("io");
      if (io) {
        io.to(userId).emit("conversation_created", {
          conversation: conversation,
          type: "direct",
        });
      }

      return res.status(201).json({
        conversation,
        isNewConversation: true,
      });
    }

    res.status(200).json({
      conversation,
      isNewConversation: false,
    });
  } catch (error) {
    console.error("Error in getOrCreateDirectConversation:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

// @desc    Create a new group or channel
// @route   POST /api/conversations
const createGroupOrChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const {
    type,
    name,
    description,
    participants,
    settings,
    isPublic,
    category,
    tags,
  } = req.body;
  const currentUserId = req.user.id;

  if (type === "direct") {
    return res.status(400).json({
      message: "Use POST /api/conversations/direct for direct chats.",
    });
  }

  // Validate name
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      message: "Conversation name is required for groups and channels.",
    });
  }

  try {
    const allParticipants = [
      ...new Set([...(participants || []), currentUserId]),
    ];
    if (allParticipants.length < 2) {
      return res
        .status(400)
        .json({ message: `${type}s must have at least 2 members.` });
    }

    // Verify all participants exist
    const validUsers = await User.find({ _id: { $in: allParticipants } });
    if (validUsers.length !== allParticipants.length) {
      return res.status(404).json({ message: "One or more users not found." });
    }

    // Generate a temporary unique ID using timestamp and random string
    const mongoose = await import("mongoose");
    const tempId = new mongoose.Types.ObjectId();
    const conversationId = `${type}_${tempId}`;

    // Create the conversation with the generated conversationId
    const newConversation = await Conversation.create({
      conversationId,
      type,
      name: name.trim(),
      description: description?.trim(),
      isPublic: isPublic || false,
      category: category || "general",
      tags: tags || [],
      participants: allParticipants.map((userId) => ({
        user: userId,
        role:
          userId.toString() === currentUserId.toString() ? "admin" : "member",
      })),
      createdBy: currentUserId,
      settings: settings || {},
    });

    // Populate the user details for the new conversation before sending
    const populatedConversation = await Conversation.findById(
      newConversation._id
    )
      .populate(
        "participants.user",
        "firstName lastName email username image isOnline"
      )
      .populate("createdBy", "firstName lastName email username image");

    // Emit socket event to all participants
    const io = req.app.get("io");
    if (io) {
      allParticipants.forEach((participantId) => {
        if (participantId.toString() !== currentUserId.toString()) {
          io.to(participantId.toString()).emit("conversation_created", {
            conversation: populatedConversation,
            type: type,
          });
        }
      });
    }

    res.status(201).json(populatedConversation);
  } catch (error) {
    console.error("Error in createGroupOrChannel:", error);
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
      .populate(
        "participants.user",
        "firstName lastName email username image name avatar isOnline"
      )
      .populate("createdBy", "firstName lastName email username image")
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getUserConversations:", error);
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
        "firstName lastName name avatar email username image isOnline"
      )
      .populate(
        "createdBy",
        "firstName lastName name avatar email username image"
      )
      .populate("pinnedMessages.messageId")
      .populate(
        "pinnedMessages.pinnedBy",
        "firstName lastName email username image"
      )
      .populate("joinRequests.user", "firstName lastName email username image");

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user._id.toString() === currentUserId && p.isActive
    );
    if (!isParticipant && !conversation.isPublic) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Error in getConversationById:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update conversation info
// @route   PUT /api/conversations/:conversationId
const updateConversationInfo = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;
  const { name, description, avatar, settings, isPublic, category, tags } =
    req.body;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    // Don't allow updating direct conversations
    if (conversation.type === "direct") {
      return res.status(400).json({
        message: "Cannot update direct conversation information.",
      });
    }

    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
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

    // Update fields
    if (name && name.trim().length > 0) {
      conversation.name = name.trim();
    }
    if (description !== undefined) {
      conversation.description = description?.trim() || null;
    }
    if (avatar) {
      conversation.avatar = avatar;
    }
    if (settings) {
      conversation.settings = { ...conversation.settings, ...settings };
    }
    if (isPublic !== undefined) {
      conversation.isPublic = isPublic;
    }
    if (category) {
      conversation.category = category;
    }
    if (tags) {
      conversation.tags = tags;
    }

    await conversation.save();

    // Re-fetch and populate the document to return the complete object
    const populatedConversation = await Conversation.findOne({ conversationId })
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image isOnline"
      )
      .populate(
        "createdBy",
        "firstName lastName name avatar email username image"
      );

    // Emit socket event to all participants
    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((participant) => {
        if (participant.isActive) {
          io.to(participant.user.toString()).emit("conversation_updated", {
            conversationId,
            updates: {
              name: populatedConversation.name,
              description: populatedConversation.description,
              avatar: populatedConversation.avatar,
              settings: populatedConversation.settings,
              isPublic: populatedConversation.isPublic,
              category: populatedConversation.category,
              tags: populatedConversation.tags,
            },
          });
        }
      });
    }

    res.status(200).json(populatedConversation);
  } catch (error) {
    console.error("Error in updateConversationInfo:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a public group or channel
// @route   POST /api/conversations/:conversationId/join
const joinConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;
  const { message } = req.body;

  try {
    const conversation = await Conversation.findOne({
      conversationId,
    }).populate("participants.user", "firstName lastName email username image");

    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    // Check if already a member
    const existingParticipant = conversation.participants.find(
      (p) => p.user._id.toString() === currentUserId
    );

    if (existingParticipant && existingParticipant.isActive) {
      return res.status(400).json({ message: "Already a member." });
    }

    if (conversation.isPublic && !conversation.settings.requireApprovalToJoin) {
      // Rejoin if previously left
      if (existingParticipant && !existingParticipant.isActive) {
        existingParticipant.isActive = true;
        existingParticipant.leftAt = null;
        existingParticipant.joinedAt = new Date();
      } else {
        conversation.participants.push({
          user: currentUserId,
          role: "member",
          joinedAt: new Date(),
        });
      }

      await conversation.save();

      // Populate the conversation
      const populatedConversation = await Conversation.findOne({
        conversationId,
      }).populate(
        "participants.user",
        "firstName lastName email username image isOnline"
      );

      // Get the joined user info
      const joinedUser = await User.findById(currentUserId).select(
        "firstName lastName email username image"
      );

      // Emit socket event
      const io = req.app.get("io");
      if (io) {
        conversation.participants.forEach((participant) => {
          if (
            participant.isActive &&
            participant.user._id.toString() !== currentUserId
          ) {
            io.to(participant.user._id.toString()).emit("participant_joined", {
              conversationId,
              participant: {
                _id: joinedUser._id,
                firstName: joinedUser.firstName,
                lastName: joinedUser.lastName,
                email: joinedUser.email,
                username: joinedUser.username,
                image: joinedUser.image,
                role: "member",
                isActive: true,
                joinedAt: new Date(),
              },
            });
          }
        });
      }

      return res.status(200).json({
        message: "Joined conversation successfully.",
        conversation: populatedConversation,
      });
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
        message: message || "",
        requestedAt: new Date(),
      });
      await conversation.save();

      // Notify admins
      const io = req.app.get("io");
      if (io) {
        const admins = conversation.participants.filter(
          (p) => p.role === "admin" && p.isActive
        );
        const requester = await User.findById(currentUserId).select(
          "firstName lastName email username image"
        );

        admins.forEach((admin) => {
          io.to(admin.user._id.toString()).emit("join_request_received", {
            conversationId,
            requester: {
              _id: requester._id,
              firstName: requester.firstName,
              lastName: requester.lastName,
              email: requester.email,
              username: requester.username,
              image: requester.image,
            },
            message: message || "",
          });
        });
      }

      return res
        .status(202)
        .json({ message: "Join request submitted for approval." });
    } else {
      return res
        .status(403)
        .json({ message: "Cannot join this conversation directly." });
    }
  } catch (error) {
    console.error("Error in joinConversation:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a member to a group or channel
// @route   POST /api/conversations/:conversationId/add
const addMember = async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;
  const currentUserId = req.user.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    // Don't allow adding to direct conversations
    if (conversation.type === "direct") {
      return res.status(400).json({
        message: "Cannot add members to direct conversations.",
      });
    }

    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    const canAdd =
      currentUserParticipant &&
      (currentUserParticipant.role === "admin" ||
        currentUserParticipant.permissions.canAddMembers ||
        conversation.settings.allowMemberToAddOthers);

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

    // Check if user previously left and rejoin them
    const previousParticipant = conversation.participants.find(
      (p) => p.user.toString() === userId
    );

    if (previousParticipant) {
      previousParticipant.isActive = true;
      previousParticipant.leftAt = null;
      previousParticipant.joinedAt = new Date();
    } else {
      conversation.participants.push({
        user: userId,
        role: "member",
        joinedAt: new Date(),
      });
    }

    await conversation.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((participant) => {
        if (participant.isActive) {
          io.to(participant.user.toString()).emit("participant_joined", {
            conversationId,
            participant: {
              _id: userToAdd._id,
              firstName: userToAdd.firstName,
              lastName: userToAdd.lastName,
              email: userToAdd.email,
              username: userToAdd.username,
              image: userToAdd.image,
              role: "member",
              isActive: true,
              joinedAt: new Date(),
            },
            addedBy: currentUserId,
          });
        }
      });

      // Notify the added user
      io.to(userId).emit("added_to_conversation", {
        conversation: await Conversation.findOne({ conversationId })
          .populate(
            "participants.user",
            "firstName lastName email username image isOnline"
          )
          .populate("createdBy", "firstName lastName email username image"),
      });
    }

    res.status(200).json({
      message: "Member added successfully.",
      memberCount: conversation.participants.filter((p) => p.isActive).length,
    });
  } catch (error) {
    console.error("Error in addMember:", error);
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

    // Don't allow leaving direct conversations
    if (conversation.type === "direct") {
      return res.status(400).json({
        message: "Cannot leave direct conversations. Archive it instead.",
      });
    }

    const participant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!participant)
      return res
        .status(400)
        .json({ message: "You are not a member of this conversation." });

    // Check if user is the last admin
    const activeAdmins = conversation.participants.filter(
      (p) => p.role === "admin" && p.isActive
    );
    if (activeAdmins.length === 1 && participant.role === "admin") {
      return res.status(400).json({
        message:
          "Cannot leave as the last administrator. Transfer admin role first or delete the conversation.",
      });
    }

    participant.isActive = false;
    participant.leftAt = new Date();
    await conversation.save();

    // Get user info for socket event
    const leavingUser = await User.findById(currentUserId).select(
      "firstName lastName email username image"
    );

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive && p.user.toString() !== currentUserId) {
          io.to(p.user.toString()).emit("participant_left", {
            conversationId,
            userId: currentUserId,
            user: {
              _id: leavingUser._id,
              firstName: leavingUser.firstName,
              lastName: leavingUser.lastName,
              email: leavingUser.email,
              username: leavingUser.username,
              image: leavingUser.image,
            },
          });
        }
      });
    }

    res.status(200).json({ message: "Successfully left the conversation." });
  } catch (error) {
    console.error("Error in leaveConversation:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public groups and channels
// @route   GET /api/conversations/public
const getPublicConversations = async (req, res) => {
  const { page = 1, limit = 20, type, category, search } = req.query;

  try {
    const query = {
      isPublic: true,
      isActive: true,
      isArchived: false,
    };

    // Filter by type
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      query.type = { $in: types };
    } else {
      query.type = { $in: ["group", "channel"] };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const conversations = await Conversation.find(query)
      .select(
        "conversationId name description avatar type memberCount lastActivity participants category tags settings"
      )
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image isOnline"
      )
      .sort({ memberCount: -1, lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Conversation.countDocuments(query);

    res.status(200).json({
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getPublicConversations:", error);
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
    }

    // Don't allow removing from direct conversations
    if (conversation.type === "direct") {
      return res.status(400).json({
        message: "Cannot remove members from direct conversations.",
      });
    }

    // Check if the current user is an admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can remove members.",
      });
    }

    // Find the participant to be removed
    const memberToRemove = conversation.participants.find(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (!memberToRemove) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    // Prevent an admin from removing the last admin
    const activeAdmins = conversation.participants.filter(
      (p) => p.role === "admin" && p.isActive
    );
    if (activeAdmins.length === 1 && memberToRemove.role === "admin") {
      return res.status(400).json({
        message: "Cannot remove the last administrator.",
      });
    }

    // Set the user's isActive status to false
    memberToRemove.isActive = false;
    memberToRemove.removedBy = currentUserId;
    memberToRemove.removedAt = new Date();
    await conversation.save();

    // Get removed user info
    const removedUser = await User.findById(userId).select(
      "firstName lastName email username image"
    );

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      // Notify all remaining members
      conversation.participants.forEach((p) => {
        if (p.isActive && p.user.toString() !== userId) {
          io.to(p.user.toString()).emit("participant_removed", {
            conversationId,
            userId,
            removedBy: currentUserId,
          });
        }
      });

      // Notify the removed user
      io.to(userId).emit("removed_from_conversation", {
        conversationId,
        conversationName: conversation.name,
        removedBy: currentUserId,
      });
    }

    res.status(200).json({
      message: "Member removed successfully.",
      memberCount: conversation.participants.filter((p) => p.isActive).length,
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve join request
// @route   POST /api/conversations/:conversationId/join-requests/:userId/approve
const approveJoinRequest = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can approve join requests.",
      });
    }

    // Find the join request
    const joinRequestIndex = conversation.joinRequests.findIndex(
      (r) => r.user.toString() === userId
    );
    if (joinRequestIndex === -1) {
      return res.status(404).json({ message: "Join request not found." });
    }

    // Remove the join request
    conversation.joinRequests.splice(joinRequestIndex, 1);

    // Add user as member
    conversation.participants.push({
      user: userId,
      role: "member",
      joinedAt: new Date(),
    });

    await conversation.save();

    // Get the approved user info
    const approvedUser = await User.findById(userId).select(
      "firstName lastName email username image"
    );

    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      // Notify the approved user
      io.to(userId).emit("join_request_approved", {
        conversationId,
        conversation: await Conversation.findOne({ conversationId })
          .populate(
            "participants.user",
            "firstName lastName email username image isOnline"
          )
          .populate("createdBy", "firstName lastName email username image"),
      });

      // Notify other members
      conversation.participants.forEach((p) => {
        if (p.isActive && p.user.toString() !== userId) {
          io.to(p.user.toString()).emit("participant_joined", {
            conversationId,
            participant: {
              _id: approvedUser._id,
              firstName: approvedUser.firstName,
              lastName: approvedUser.lastName,
              email: approvedUser.email,
              username: approvedUser.username,
              image: approvedUser.image,
              role: "member",
              isActive: true,
              joinedAt: new Date(),
            },
          });
        }
      });
    }

    res.status(200).json({ message: "Join request approved successfully." });
  } catch (error) {
    console.error("Error in approveJoinRequest:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject join request
// @route   DELETE /api/conversations/:conversationId/join-requests/:userId
const rejectJoinRequest = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can reject join requests.",
      });
    }

    // Find and remove the join request
    const joinRequestIndex = conversation.joinRequests.findIndex(
      (r) => r.user.toString() === userId
    );
    if (joinRequestIndex === -1) {
      return res.status(404).json({ message: "Join request not found." });
    }

    conversation.joinRequests.splice(joinRequestIndex, 1);
    await conversation.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("join_request_rejected", {
        conversationId,
        conversationName: conversation.name,
      });
    }

    res.status(200).json({ message: "Join request rejected." });
  } catch (error) {
    console.error("Error in rejectJoinRequest:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update member role
// @route   PATCH /api/conversations/:conversationId/members/:userId/role
const updateMemberRole = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { role } = req.body;
  const currentUserId = req.user.id;

  if (!role || !["admin", "moderator", "member"].includes(role)) {
    return res.status(400).json({
      message: "Invalid role. Must be 'admin', 'moderator', or 'member'.",
    });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can change member roles.",
      });
    }

    // Find the member to update
    const memberToUpdate = conversation.participants.find(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (!memberToUpdate) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    // Prevent demoting the last admin
    if (memberToUpdate.role === "admin" && role !== "admin") {
      const activeAdmins = conversation.participants.filter(
        (p) => p.role === "admin" && p.isActive
      );
      if (activeAdmins.length === 1) {
        return res.status(400).json({
          message: "Cannot demote the last administrator.",
        });
      }
    }

    const oldRole = memberToUpdate.role;
    memberToUpdate.role = role;

    // Update permissions based on role
    if (role === "admin") {
      memberToUpdate.permissions = {
        canSendMessages: true,
        canAddMembers: true,
        canRemoveMembers: true,
        canEditInfo: true,
        canDeleteMessages: true,
        canPinMessages: true,
      };
    } else if (role === "moderator") {
      memberToUpdate.permissions = {
        canSendMessages: true,
        canAddMembers: true,
        canRemoveMembers: false,
        canEditInfo: false,
        canDeleteMessages: true,
        canPinMessages: true,
      };
    } else {
      memberToUpdate.permissions = {
        canSendMessages: true,
        canAddMembers: false,
        canRemoveMembers: false,
        canEditInfo: false,
        canDeleteMessages: false,
        canPinMessages: false,
      };
    }

    await conversation.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive) {
          io.to(p.user.toString()).emit("member_role_updated", {
            conversationId,
            userId,
            oldRole,
            newRole: role,
            permissions: memberToUpdate.permissions,
          });
        }
      });
    }

    res.status(200).json({
      message: "Member role updated successfully.",
      role,
      permissions: memberToUpdate.permissions,
    });
  } catch (error) {
    console.error("Error in updateMemberRole:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update member permissions
// @route   PATCH /api/conversations/:conversationId/members/:userId/permissions
const updateMemberPermissions = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { permissions } = req.body;
  const currentUserId = req.user.id;

  if (!permissions || typeof permissions !== "object") {
    return res.status(400).json({ message: "Invalid permissions object." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (!currentUserParticipant || currentUserParticipant.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can change member permissions.",
      });
    }

    // Find the member to update
    const memberToUpdate = conversation.participants.find(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (!memberToUpdate) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    // Don't allow changing admin permissions
    if (memberToUpdate.role === "admin") {
      return res.status(400).json({
        message: "Cannot modify permissions for administrators.",
      });
    }

    // Update permissions
    memberToUpdate.permissions = {
      ...memberToUpdate.permissions,
      ...permissions,
    };

    await conversation.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("permissions_updated", {
        conversationId,
        permissions: memberToUpdate.permissions,
      });
    }

    res.status(200).json({
      message: "Permissions updated successfully.",
      permissions: memberToUpdate.permissions,
    });
  } catch (error) {
    console.error("Error in updateMemberPermissions:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mute/Unmute member
// @route   PATCH /api/conversations/:conversationId/members/:userId/mute
const toggleMuteMember = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { isMuted, duration } = req.body; // duration in hours
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is admin or moderator
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );
    if (
      !currentUserParticipant ||
      (currentUserParticipant.role !== "admin" &&
        currentUserParticipant.role !== "moderator")
    ) {
      return res.status(403).json({
        message: "Only administrators and moderators can mute members.",
      });
    }

    // Find the member to mute
    const memberToMute = conversation.participants.find(
      (p) => p.user.toString() === userId && p.isActive
    );
    if (!memberToMute) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    // Don't allow muting admins
    if (memberToMute.role === "admin") {
      return res.status(400).json({
        message: "Cannot mute administrators.",
      });
    }

    memberToMute.isMuted = isMuted;
    memberToMute.mutedUntil =
      isMuted && duration
        ? new Date(Date.now() + duration * 60 * 60 * 1000)
        : null;

    await conversation.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("mute_status_changed", {
        conversationId,
        isMuted,
        mutedUntil: memberToMute.mutedUntil,
      });
    }

    res.status(200).json({
      message: isMuted
        ? "Member muted successfully."
        : "Member unmuted successfully.",
      isMuted,
      mutedUntil: memberToMute.mutedUntil,
    });
  } catch (error) {
    console.error("Error in toggleMuteMember:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete conversation (admin only)
// @route   DELETE /api/conversations/:conversationId
const deleteConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    // Check if current user is the creator or admin
    const currentUserParticipant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId && p.isActive
    );

    const isCreator = conversation.createdBy.toString() === currentUserId;
    const isAdmin = currentUserParticipant?.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        message:
          "Only the creator or administrators can delete this conversation.",
      });
    }

    // Mark as inactive instead of deleting (soft delete)
    conversation.isActive = false;
    conversation.isArchived = true;
    await conversation.save();

    // Emit socket event to all participants
    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive) {
          io.to(p.user.toString()).emit("conversation_deleted", {
            conversationId,
            deletedBy: currentUserId,
          });
        }
      });
    }

    res.status(200).json({ message: "Conversation deleted successfully." });
  } catch (error) {
    console.error("Error in deleteConversation:", error);
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
  removeMember,
  leaveConversation,
  getPublicConversations,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
  updateMemberPermissions,
  toggleMuteMember,
  deleteConversation,
};
