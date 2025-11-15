import mongoose from "mongoose";
import Conversation from "../models/ConversationModel.js";
import User from "../models/UserModel.js";
import { validationResult } from "express-validator";
import {
  createSystemMessage,
  SystemMessageTypes,
} from "../utils/systemMessages.js";

/* ----------------------------- Helpers ---------------------------------- */

// Return a plain object with ONLY active participants and correct memberCount
const omitInactiveParticipants = (convDoc) => {
  if (!convDoc) return convDoc;
  const conv = convDoc.toObject ? convDoc.toObject() : convDoc;
  conv.participants = (conv.participants || []).filter((p) => p.isActive);
  conv.memberCount = conv.participants.length;
  return conv;
};

// Set memberCount (active only) on a Mongoose doc (mutates the doc)
const recomputeMemberCount = (conversation) => {
  conversation.memberCount = (conversation.participants || []).filter(
    (p) => p.isActive
  ).length;
};

/* ----------------------- Get/Create Direct Conversation ------------------ */
// @desc    Get or create a direct conversation
// @route   POST /api/conversations/direct
const getOrCreateDirectConversation = async (req, res) => {
  const { userId } = req.body;
  const currentUserId = req.user.id;

  if (!userId) return res.status(400).json({ message: "User ID is required." });
  if (!mongoose.Types.ObjectId.isValid(userId))
    return res.status(400).json({ message: "Invalid user ID format." });
  if (currentUserId.toString() === userId.toString()) {
    return res
      .status(400)
      .json({ message: "Cannot create a direct conversation with yourself." });
  }

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId),
    ]);
    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "One or more users not found." });
    }

    const sortedIds = [currentUserId.toString(), userId.toString()].sort();
    const conversationId = `direct_${sortedIds[0]}_${sortedIds[1]}`;

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
      conversation = await Conversation.create({
        conversationId,
        type: "direct",
        directParticipants: sortedIds,
        participants: [
          { user: currentUserId, isActive: true },
          { user: userId, isActive: true },
        ],
        createdBy: currentUserId,
      });

      conversation = await Conversation.findById(conversation._id)
        .populate(
          "directParticipants",
          "firstName lastName email username image isOnline"
        )
        .populate(
          "participants.user",
          "firstName lastName email username image isOnline"
        );

      const io = req.app.get("io");
      if (io) {
        io.to(userId.toString()).emit("conversation_created", {
          conversation,
          type: "direct",
        });
      }

      return res.status(201).json({
        conversation: omitInactiveParticipants(conversation),
        isNewConversation: true,
      });
    }

    // Reactivate both sides if needed
    const me = conversation.participants.find(
      (p) => p.user._id.toString() === currentUserId.toString()
    );
    const them = conversation.participants.find(
      (p) => p.user._id.toString() === userId.toString()
    );

    let needsSave = false;
    if (me && !me.isActive) {
      me.isActive = true;
      me.leftAt = null;
      me.joinedAt = new Date();
      needsSave = true;
    }
    if (them && !them.isActive) {
      them.isActive = true;
      them.leftAt = null;
      them.joinedAt = new Date();
      needsSave = true;
    }
    if (needsSave) {
      recomputeMemberCount(conversation);
      await conversation.save();
      conversation = await Conversation.findById(conversation._id)
        .populate(
          "directParticipants",
          "firstName lastName email username image isOnline"
        )
        .populate(
          "participants.user",
          "firstName lastName email username image isOnline"
        );
    }

    res.status(200).json({
      conversation: omitInactiveParticipants(conversation),
      isNewConversation: false,
    });
  } catch (error) {
    console.error("Error in getOrCreateDirectConversation:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

/* -------------------------- Create Group/Channel ------------------------- */
// @desc    Create a new group or channel
// @route   POST /api/conversations
const createGroupOrChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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
    return res
      .status(400)
      .json({
        message: "Use POST /api/conversations/direct for direct chats.",
      });
  }
  if (!["group", "channel"].includes(type)) {
    return res
      .status(400)
      .json({ message: "Type must be 'group' or 'channel'." });
  }
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      message: "Conversation name is required for groups and channels.",
    });
  }
  if (name.trim().length > 100) {
    return res
      .status(400)
      .json({ message: "Conversation name must be 100 characters or less." });
  }

  try {
    const allParticipants = [
      ...new Set([...(participants || []), currentUserId.toString()]),
    ];

    if (allParticipants.length < 2) {
      return res
        .status(400)
        .json({ message: `${type}s must have at least 2 members.` });
    }

    for (const id of allParticipants) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid user ID: ${id}` });
      }
    }

    const validUsers = await User.find({ _id: { $in: allParticipants } });
    if (validUsers.length !== allParticipants.length) {
      return res.status(404).json({ message: "One or more users not found." });
    }

    const tempId = new mongoose.Types.ObjectId();
    const conversationId = `${type}_${tempId}`;

    const newConversation = await Conversation.create({
      conversationId,
      type,
      name: name.trim(),
      description: description?.trim(),
      isPublic: isPublic || false,
      category: category || "general",
      tags: tags || [],
      participants: allParticipants.map((uid) => ({
        user: uid,
        role: uid.toString() === currentUserId.toString() ? "admin" : "member",
        isActive: true,
        joinedAt: new Date(),
      })),
      createdBy: currentUserId,
      settings: settings || {},
    });

    recomputeMemberCount(newConversation);
    await newConversation.save();

    const populatedConversation = await Conversation.findById(
      newConversation._id
    )
      .populate(
        "participants.user",
        "firstName lastName email username image isOnline"
      )
      .populate("createdBy", "firstName lastName email username image");

    const io = req.app.get("io");
    if (io) {
      allParticipants.forEach((pid) => {
        if (pid.toString() !== currentUserId.toString()) {
          io.to(pid.toString()).emit("conversation_created", {
            conversation: populatedConversation,
            type,
          });
        }
      });
    }

    res.status(201).json(omitInactiveParticipants(populatedConversation));
  } catch (error) {
    console.error("Error in createGroupOrChannel:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({
          message: "A conversation with this identifier already exists.",
        });
    }
    res.status(500).json({ message: error.message });
  }
};

/* -------------------------- Get User Conversations ----------------------- */
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
    if (type) query.type = type;

    const conversations = await Conversation.find(query)
      .populate("lastMessage.sender", "firstName lastName email image")
      .populate(
        "participants.user",
        "firstName lastName email username image name avatar isOnline"
      )
      .populate("createdBy", "firstName lastName email username image")
      .sort({ lastActivity: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const sanitized = conversations.map(omitInactiveParticipants);
    res.status(200).json(sanitized);
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    res.status(500).json({ message: error.message });
  }
};

/* -------------------------- Get Conversation by ID ----------------------- */
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

    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    const isParticipant = conversation.participants.some(
      (p) => p.user._id.toString() === currentUserId.toString() && p.isActive
    );
    if (!isParticipant && !conversation.isPublic) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.status(200).json(omitInactiveParticipants(conversation));
  } catch (error) {
    console.error("Error in getConversationById:", error);
    res.status(500).json({ message: error.message });
  }
};

/* -------------------------- Update Conversation Info --------------------- */
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

    if (conversation.type === "direct") {
      return res
        .status(400)
        .json({ message: "Cannot update direct conversation information." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me) {
      return res
        .status(403)
        .json({
          message: "You are not an active member of this conversation.",
        });
    }

    const canEdit = me.role === "admin" || me.permissions?.canEditInfo;
    if (!canEdit) {
      return res
        .status(403)
        .json({
          message: "You do not have permission to edit this conversation.",
        });
    }

    if (name && name.trim().length > 0) conversation.name = name.trim();
    if (description !== undefined)
      conversation.description = description?.trim() || null;
    if (avatar) conversation.avatar = avatar; // If using multipart, your middleware should map file -> avatar
    if (settings)
      conversation.settings = { ...conversation.settings, ...settings };
    if (isPublic !== undefined) conversation.isPublic = isPublic;
    if (category) conversation.category = category;
    if (tags) conversation.tags = tags;

    recomputeMemberCount(conversation);
    await conversation.save();

    const populated = await Conversation.findOne({ conversationId })
      .populate(
        "participants.user",
        "firstName lastName name avatar email username image isOnline"
      )
      .populate(
        "createdBy",
        "firstName lastName name avatar email username image"
      );

    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive) {
          io.to(p.user.toString()).emit("conversation_updated", {
            conversationId,
            updates: {
              name: populated.name,
              description: populated.description,
              avatar: populated.avatar,
              settings: populated.settings,
              isPublic: populated.isPublic,
              category: populated.category,
              tags: populated.tags,
            },
          });
        }
      });
    }

    res.status(200).json(omitInactiveParticipants(populated));
  } catch (error) {
    console.error("Error in updateConversationInfo:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ---------------------------- Join Conversation -------------------------- */
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

    if (!conversation.isActive) {
      return res
        .status(400)
        .json({ message: "Cannot join an inactive conversation." });
    }

    const existing = conversation.participants.find(
      (p) => p.user._id.toString() === currentUserId.toString()
    );
    if (existing && existing.isActive) {
      return res.status(400).json({ message: "Already a member." });
    }

    const needsApproval = conversation.settings?.requireApprovalToJoin;
    if (conversation.isPublic && !needsApproval) {
      if (existing && !existing.isActive) {
        existing.isActive = true;
        existing.leftAt = null;
        existing.joinedAt = new Date();
      } else {
        conversation.participants.push({
          user: currentUserId,
          role: "member",
          isActive: true,
          joinedAt: new Date(),
        });
      }

      recomputeMemberCount(conversation);
      await conversation.save();

      const populatedConversation = await Conversation.findOne({
        conversationId,
      }).populate(
        "participants.user",
        "firstName lastName email username image isOnline"
      );

      const joinedUser = await User.findById(currentUserId).select(
        "firstName lastName email username image"
      );

      const io = req.app.get("io");
      if (io) {
        conversation.participants.forEach((p) => {
          if (
            p.isActive &&
            p.user._id.toString() !== currentUserId.toString()
          ) {
            io.to(p.user._id.toString()).emit("participant_joined", {
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
        conversation: omitInactiveParticipants(populatedConversation),
      });
    }

    if (needsApproval) {
      const isAlreadyRequested = conversation.joinRequests.some(
        (r) => r.user.toString() === currentUserId.toString()
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
    }

    return res
      .status(403)
      .json({ message: "Cannot join this conversation directly." });
  } catch (error) {
    console.error("Error in joinConversation:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ------------------------------- Add Member ------------------------------ */
// @desc    Add a member to a group or channel (WhatsApp-style: may create join request)
// @route   POST /api/conversations/:conversationId/add
const addMember = async (req, res) => {
  const { conversationId } = req.params;
  const { userId, message } = req.body; // message is optional for join requests
  const currentUserId = req.user.id;

  if (!userId) return res.status(400).json({ message: "User ID is required." });
  if (!mongoose.Types.ObjectId.isValid(userId))
    return res.status(400).json({ message: "Invalid user ID format." });
  if (userId.toString() === currentUserId.toString())
    return res.status(400).json({ message: "Cannot add yourself." });

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    if (conversation.type === "direct") {
      return res
        .status(400)
        .json({ message: "Cannot add members to direct conversations." });
    }
    if (!conversation.isActive) {
      return res
        .status(400)
        .json({ message: "Cannot add members to an inactive conversation." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me) {
      return res
        .status(403)
        .json({
          message: "You are not an active member of this conversation.",
        });
    }

    // Check if user is already a member
    const alreadyActive = conversation.participants.some(
      (p) => p.user.toString() === userId.toString() && p.isActive
    );
    if (alreadyActive) {
      return res.status(200).json({ 
        message: "User is already a member.",
        isRequest: false,
      });
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd)
      return res.status(404).json({ message: "User to add not found." });

    // Get settings (with backwards compatibility)
    const whoCanAdd = conversation.settings?.whoCanAdd || 
      (conversation.settings?.allowMemberToAddOthers ? "everyone" : "only_admins");
    const approveNewParticipants = conversation.settings?.approveNewParticipants || 
      conversation.settings?.requireApprovalToJoin || false;

    // Determine if current user can add directly
    const isAdmin = me.role === "admin";
    const hasPermission = me.permissions?.canAddMembers || false;
    const canAddDirectly = isAdmin || hasPermission || whoCanAdd === "everyone";

    // WhatsApp-style logic:
    // 1. If whoCanAdd === "only_admins" and user is NOT admin → create join request
    // 2. If approveNewParticipants === true → create join request (even for admins)
    // 3. Otherwise → add directly

    const shouldCreateRequest = 
      (!canAddDirectly && whoCanAdd === "only_admins") || 
      approveNewParticipants;

    if (shouldCreateRequest) {
      // Check if request already exists
      const existingRequest = conversation.joinRequests.find(
        (r) => r.user.toString() === userId.toString()
      );
      if (existingRequest) {
        return res.status(200).json({
          message: "Join request already pending.",
          isRequest: true,
        });
      }

      // Create join request
      conversation.joinRequests.push({
        user: userId,
        requestedAt: new Date(),
        message: message || "",
        source: "admin_add",
        requestedBy: currentUserId,
      });
      await conversation.save();

      // Emit join_request_received to admins/moderators
      const io = req.app.get("io");
      if (io) {
        const canApprove = conversation.participants.filter((p) => {
          if (!p.isActive) return false;
          if (p.role === "admin") return true;
          if (p.role === "moderator" && conversation.settings?.allowModeratorsToApprove) {
            return true;
          }
          return false;
        });

        const requester = await User.findById(currentUserId).select(
          "firstName lastName email username image"
        );

        canApprove.forEach((approver) => {
          io.to(approver.user.toString()).emit("join_request_received", {
            conversationId,
            requester: {
              _id: requester._id,
              firstName: requester.firstName,
              lastName: requester.lastName,
              email: requester.email,
              username: requester.username,
              image: requester.image,
            },
            requestedUser: {
              _id: userToAdd._id,
              firstName: userToAdd.firstName,
              lastName: userToAdd.lastName,
              email: userToAdd.email,
              username: userToAdd.username,
              image: userToAdd.image,
            },
            message: message || "",
            source: "admin_add",
            requestedBy: currentUserId,
          });
        });
      }

      return res.status(202).json({
        message: "Join request created. Waiting for admin approval.",
        isRequest: true,
      });
    }

    // Direct add (no approval required)
    const prev = conversation.participants.find(
      (p) => p.user.toString() === userId.toString()
    );
    if (prev) {
      prev.isActive = true;
      prev.leftAt = null;
      prev.joinedAt = new Date();
      prev.role = prev.role || "member";
    } else {
      conversation.participants.push({
        user: userId,
        role: "member",
        isActive: true,
        joinedAt: new Date(),
      });
    }

    recomputeMemberCount(conversation);
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive) {
          io.to(p.user.toString()).emit("participant_joined", {
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

      io.to(userId.toString()).emit("added_to_conversation", {
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
      memberCount: conversation.memberCount,
      isRequest: false,
    });
  } catch (error) {
    console.error("Error in addMember:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ------------------------------ Leave Conversation ----------------------- */
// @desc    Leave a group or channel
// @route   POST /api/conversations/:conversationId/leave
const leaveConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found." });

    if (conversation.type === "direct") {
      return res
        .status(400)
        .json({
          message: "Cannot leave direct conversations. Archive it instead.",
        });
    }
    if (!conversation.isActive) {
      return res
        .status(400)
        .json({ message: "Cannot leave an inactive conversation." });
    }

    const participant = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!participant)
      return res
        .status(400)
        .json({ message: "You are not a member of this conversation." });

    const activeAdmins = conversation.participants.filter(
      (p) => p.role === "admin" && p.isActive
    );
    if (activeAdmins.length === 1 && participant.role === "admin") {
      return res.status(400).json({
        message:
          "Cannot leave as the last administrator. Transfer admin role first or delete the conversation.",
      });
    }

    // Soft leave (WhatsApp-style history preservation)
    participant.isActive = false;
    participant.leftAt = new Date();

    recomputeMemberCount(conversation);
    await conversation.save();

    const leavingUser = await User.findById(currentUserId).select(
      "firstName lastName email username image"
    );

    const io = req.app.get("io");
    if (io) {
      conversation.participants.forEach((p) => {
        if (p.isActive && p.user.toString() !== currentUserId.toString()) {
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

/* -------------------------- Get Public Conversations --------------------- */
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

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      query.type = { $in: types };
    } else {
      query.type = { $in: ["group", "channel"] };
    }

    if (category) query.category = category;

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
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Conversation.countDocuments(query);

    const sanitized = conversations.map(omitInactiveParticipants);

    res.status(200).json({
      conversations: sanitized,
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

/* ------------------------------- Remove Member --------------------------- */
// @desc    Remove a member from a group or channel (hard remove, active or not)
// @route   DELETE /api/conversations/:conversationId/members/:userId
const removeMember = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }
  if (userId.toString() === currentUserId.toString()) {
    return res.status(400).json({
      message: "Cannot remove yourself. Use the leave endpoint instead.",
    });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    if (conversation.type === "direct") {
      return res.status(400).json({
        message: "Cannot remove members from direct conversations.",
      });
    }
    if (!conversation.isActive) {
      return res.status(400).json({
        message: "Cannot remove members from an inactive conversation.",
      });
    }

    const acting = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!acting) {
      return res.status(403).json({
        message: "You are not an active member of this conversation.",
      });
    }
    if (acting.role !== "admin" && !acting.permissions?.canRemoveMembers) {
      return res.status(403).json({
        message: "Only administrators can remove members.",
      });
    }

    const idx = conversation.participants.findIndex(
      (p) => p.user.toString() === userId.toString()
    );
    if (idx === -1) {
      return res.status(404).json({ message: "User is not a participant." });
    }

    const memberToRemove = conversation.participants[idx];

    // Prevent removing the last active admin
    const activeAdmins = conversation.participants.filter(
      (p) => p.role === "admin" && p.isActive
    );
    if (
      memberToRemove.isActive &&
      memberToRemove.role === "admin" &&
      activeAdmins.length === 1
    ) {
      return res
        .status(400)
        .json({ message: "Cannot remove the last administrator." });
    }

    // Hard remove (active or inactive)
    conversation.participants.splice(idx, 1);

    recomputeMemberCount(conversation);
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      // Notify remaining active members
      conversation.participants.forEach((p) => {
        if (p.isActive) {
          io.to(p.user.toString()).emit("participant_removed", {
            conversationId,
            userId,
            removedBy: currentUserId,
          });
        }
      });

      // Notify the removed user
      io.to(userId.toString()).emit("removed_from_conversation", {
        conversationId,
        conversationName: conversation.name,
        removedBy: currentUserId,
      });
    }

    res.status(200).json({
      message: "Member removed successfully.",
      memberCount: conversation.memberCount,
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ------------------------------ Approve Join ----------------------------- */
// @desc    Approve join request
// @route   POST /api/conversations/:conversationId/join-requests/:userId/approve
const approveJoinRequest = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me) {
      return res.status(403).json({
        message: "You are not an active member of this conversation.",
      });
    }

    // Check if user can approve (admin or moderator with permission)
    const canApprove = 
      me.role === "admin" || 
      (me.role === "moderator" && conversation.settings?.allowModeratorsToApprove);
    
    if (!canApprove) {
      return res.status(403).json({
        message: "Only administrators and authorized moderators can approve join requests.",
      });
    }

    // Check if user is already a member (idempotency)
    const alreadyMember = conversation.participants.some(
      (p) => p.user.toString() === userId.toString() && p.isActive
    );
    if (alreadyMember) {
      // Remove request if it exists (cleanup)
      const joinRequestIndex = conversation.joinRequests.findIndex(
        (r) => r.user.toString() === userId.toString()
      );
      if (joinRequestIndex !== -1) {
        conversation.joinRequests.splice(joinRequestIndex, 1);
        await conversation.save();
      }
      return res.status(200).json({ 
        message: "User is already a member.",
      });
    }

    const joinRequestIndex = conversation.joinRequests.findIndex(
      (r) => r.user.toString() === userId.toString()
    );
    if (joinRequestIndex === -1) {
      return res.status(404).json({ message: "Join request not found." });
    }

    // Remove join request and add as active member
    conversation.joinRequests.splice(joinRequestIndex, 1);
    conversation.participants.push({
      user: userId,
      role: "member",
      isActive: true,
      joinedAt: new Date(),
    });

    recomputeMemberCount(conversation);
    await conversation.save();

    const approvedUser = await User.findById(userId).select(
      "firstName lastName email username image"
    );

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("join_request_approved", {
        conversationId,
        conversation: await Conversation.findOne({ conversationId })
          .populate(
            "participants.user",
            "firstName lastName email username image isOnline"
          )
          .populate("createdBy", "firstName lastName email username image"),
      });

      conversation.participants.forEach((p) => {
        if (p.isActive && p.user.toString() !== userId.toString()) {
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

/* ------------------------------ Reject Join ------------------------------ */
// @desc    Reject join request
// @route   DELETE /api/conversations/:conversationId/join-requests/:userId
const rejectJoinRequest = async (req, res) => {
  const { conversationId, userId } = req.params;
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me) {
      return res.status(403).json({
        message: "You are not an active member of this conversation.",
      });
    }

    // Check if user can reject (admin or moderator with permission)
    const canReject = 
      me.role === "admin" || 
      (me.role === "moderator" && conversation.settings?.allowModeratorsToApprove);
    
    if (!canReject) {
      return res.status(403).json({
        message: "Only administrators and authorized moderators can reject join requests.",
      });
    }

    const joinRequestIndex = conversation.joinRequests.findIndex(
      (r) => r.user.toString() === userId.toString()
    );
    if (joinRequestIndex === -1) {
      return res.status(404).json({ message: "Join request not found." });
    }

    conversation.joinRequests.splice(joinRequestIndex, 1);
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("join_request_rejected", {
        conversationId,
        userId,
        conversationName: conversation.name,
        rejectedBy: currentUserId,
      });

      // Also notify admins/moderators that request was rejected
      const canSeeRequests = conversation.participants.filter((p) => {
        if (!p.isActive) return false;
        if (p.role === "admin") return true;
        if (p.role === "moderator" && conversation.settings?.allowModeratorsToApprove) {
          return true;
        }
        return false;
      });

      canSeeRequests.forEach((approver) => {
        if (approver.user.toString() !== currentUserId.toString()) {
          io.to(approver.user.toString()).emit("join_request_rejected", {
            conversationId,
            userId,
            rejectedBy: currentUserId,
          });
        }
      });
    }

    res.status(200).json({ message: "Join request rejected." });
  } catch (error) {
    console.error("Error in rejectJoinRequest:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------- Update Role ------------------------------- */
// @desc    Update member role
// @route   PATCH /api/conversations/:conversationId/members/:userId/role
const updateMemberRole = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { role } = req.body;
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }
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

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me || me.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can change member roles.",
      });
    }

    const memberToUpdate = conversation.participants.find(
      (p) => p.user.toString() === userId.toString() && p.isActive
    );
    if (!memberToUpdate) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    if (memberToUpdate.role === "admin" && role !== "admin") {
      const activeAdmins = conversation.participants.filter(
        (p) => p.role === "admin" && p.isActive
      );
      if (activeAdmins.length === 1) {
        return res
          .status(400)
          .json({ message: "Cannot demote the last administrator." });
      }
    }

    const oldRole = memberToUpdate.role;
    memberToUpdate.role = role;

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

/* --------------------------- Update Permissions -------------------------- */
// @desc    Update member permissions
// @route   PATCH /api/conversations/:conversationId/members/:userId/permissions
const updateMemberPermissions = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { permissions } = req.body;
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }
  if (!permissions || typeof permissions !== "object") {
    return res.status(400).json({ message: "Invalid permissions object." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me || me.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can change member permissions.",
      });
    }

    const memberToUpdate = conversation.participants.find(
      (p) => p.user.toString() === userId.toString() && p.isActive
    );
    if (!memberToUpdate) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    if (memberToUpdate.role === "admin") {
      return res
        .status(400)
        .json({ message: "Cannot modify permissions for administrators." });
    }

    memberToUpdate.permissions = {
      ...memberToUpdate.permissions,
      ...permissions,
    };

    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("permissions_updated", {
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

/* ------------------------------- Toggle Mute ----------------------------- */
// @desc    Mute/Unmute member
// @route   PATCH /api/conversations/:conversationId/members/:userId/mute
const toggleMuteMember = async (req, res) => {
  const { conversationId, userId } = req.params;
  const { isMuted, duration } = req.body; // duration in hours
  const currentUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    if (!me || (me.role !== "admin" && me.role !== "moderator")) {
      return res.status(403).json({
        message: "Only administrators and moderators can mute members.",
      });
    }

    const memberToMute = conversation.participants.find(
      (p) => p.user.toString() === userId.toString() && p.isActive
    );
    if (!memberToMute) {
      return res.status(404).json({ message: "User is not an active member." });
    }

    if (memberToMute.role === "admin") {
      return res.status(400).json({ message: "Cannot mute administrators." });
    }

    memberToMute.isMuted = isMuted;
    memberToMute.mutedUntil =
      isMuted && duration
        ? new Date(Date.now() + duration * 60 * 60 * 1000)
        : null;

    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("mute_status_changed", {
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

/* ---------------------------- Delete Conversation ------------------------ */
// @desc    Delete conversation (admin only, soft delete)
// @route   DELETE /api/conversations/:conversationId
const deleteConversation = async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const me = conversation.participants.find(
      (p) => p.user.toString() === currentUserId.toString() && p.isActive
    );
    const isCreator =
      conversation.createdBy.toString() === currentUserId.toString();
    const isAdmin = me?.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        message:
          "Only the creator or administrators can delete this conversation.",
      });
    }

    conversation.isActive = false;
    conversation.isArchived = true;
    await conversation.save();

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