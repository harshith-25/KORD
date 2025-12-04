import Message from "../models/MessagesModel.js";
import Conversation from "../models/ConversationModel.js";
import User from "../models/UserModel.js";
import { getIo } from "../socket.js";

/**
 * System Message Action Types
 */
export const SystemMessageTypes = {
  // Group Lifecycle
  GROUP_CREATED: "group_created",
  GROUP_ICON_CHANGED: "group_icon_changed",
  GROUP_NAME_CHANGED: "group_name_changed",
  GROUP_DESCRIPTION_CHANGED: "group_description_changed",
  GROUP_SETTINGS_CHANGED: "group_settings_changed",

  // Member Management
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
  MEMBER_LEFT: "member_left",
  MEMBER_JOINED: "member_joined",

  // Permissions & Roles
  MEMBER_PROMOTED_ADMIN: "member_promoted_admin",
  MEMBER_DEMOTED_ADMIN: "member_demoted_admin",
  MEMBER_MADE_MODERATOR: "member_made_moderator",
  MEMBER_REMOVED_MODERATOR: "member_removed_moderator",

  // Join Requests
  JOIN_REQUEST_SENT: "join_request_sent",
  JOIN_REQUEST_APPROVED: "join_request_approved",
  JOIN_REQUEST_DECLINED: "join_request_declined",

  // Security & Privacy
  ENCRYPTION_ENABLED: "encryption_enabled",
  DISAPPEARING_MESSAGES_ON: "disappearing_messages_on",
  DISAPPEARING_MESSAGES_OFF: "disappearing_messages_off",
};

/**
 * Create a system message and emit it to all conversation participants
 * @param {Object} params
 * @param {String} params.conversationId - Conversation ID
 * @param {String} params.action - System message action type
 * @param {String} params.actorId - User ID who performed the action
 * @param {Array<String>} params.targetUserIds - User IDs affected by the action
 * @param {Object} params.metadata - Additional metadata (oldValue, newValue, groupName, etc.)
 * @returns {Promise<Object>} Created system message
 */
export const createSystemMessage = async ({
  conversationId,
  action,
  actorId,
  targetUserIds = [],
  metadata = {},
}) => {
  try {
    // Get conversation to verify it exists
    const conversation = await Conversation.findOne({ conversationId }).populate(
      "participants.user",
      "firstName lastName username email"
    );

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get actor user details
    const actor = await User.findById(actorId).select(
      "firstName lastName username email"
    );

    if (!actor) {
      throw new Error(`Actor user ${actorId} not found`);
    }

    // Create system message content based on action
    const content = formatSystemMessageContent({
      action,
      actor,
      targetUserIds,
      metadata,
      conversation,
    });

    // Create system message
    const systemMessage = await Message.create({
      conversationId,
      sender: actorId, // System messages still have a sender (the actor)
      type: "system",
      content,
      systemData: {
        action,
        affectedUsers: targetUserIds,
        oldValue: metadata.oldValue || null,
        newValue: metadata.newValue || null,
      },
      deliveryStatus: "sent",
      timestamp: new Date(),
      // System messages are automatically "read" by all participants
      readReceipts: [],
      deliveryReceipts: [],
    });

    // Populate sender for response
    await systemMessage.populate("sender", "firstName lastName username email image");

    // Update conversation lastMessage and lastActivity
    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: content,
      type: "system",
      sender: actorId,
      timestamp: new Date(),
    };
    conversation.lastActivity = new Date();
    await conversation.save();

    // Emit to all conversation participants via socket
    const io = getIo();
    if (io) {
      conversation.participants.forEach((participant) => {
        if (participant.isActive) {
          io.to(participant.user._id.toString()).emit("message:new", {
            conversationId,
            message: systemMessage,
          });
        }
      });
    }

    return systemMessage;
  } catch (error) {
    console.error("Error creating system message:", error);
    throw error;
  }
};

/**
 * Format system message content based on action type
 * @param {Object} params
 * @returns {String} Formatted message content
 */
const formatSystemMessageContent = ({
  action,
  actor,
  targetUserIds,
  metadata,
  conversation,
}) => {
  const actorName = getUserDisplayName(actor);
  const isActorCurrentUser = (userId) => userId === actor._id.toString();

  switch (action) {
    case SystemMessageTypes.GROUP_CREATED:
      return isActorCurrentUser(metadata.createdById || actor._id)
        ? `You created group "${conversation.name || "this group"}"`
        : `${actorName} created group "${conversation.name || "this group"}"`;

    case SystemMessageTypes.GROUP_ICON_CHANGED:
      return isActorCurrentUser(actor._id)
        ? "You changed the group icon"
        : `${actorName} changed the group icon`;

    case SystemMessageTypes.GROUP_NAME_CHANGED:
      const oldName = metadata.oldValue || "this group";
      const newName = metadata.newValue || conversation.name;
      return isActorCurrentUser(actor._id)
        ? `You changed the group name to "${newName}"`
        : `${actorName} changed the group name from "${oldName}" to "${newName}"`;

    case SystemMessageTypes.GROUP_DESCRIPTION_CHANGED:
      return isActorCurrentUser(actor._id)
        ? "You changed the group description"
        : `${actorName} changed the group description`;

    case SystemMessageTypes.MEMBER_ADDED: {
      const targetUsers = metadata.targetUsers || [];
      if (targetUsers.length === 0) return "";
      if (targetUsers.length === 1) {
        const targetName = getUserDisplayName(targetUsers[0]);
        return isActorCurrentUser(actor._id)
          ? `You added ${targetName}`
          : `${actorName} added ${targetName}`;
      }
      if (targetUsers.length === 2) {
        const names = targetUsers.map(getUserDisplayName).join(" and ");
        return isActorCurrentUser(actor._id)
          ? `You added ${names}`
          : `${actorName} added ${names}`;
      }
      const firstTwo = targetUsers.slice(0, 2).map(getUserDisplayName).join(", ");
      const othersCount = targetUsers.length - 2;
      return isActorCurrentUser(actor._id)
        ? `You added ${firstTwo} and ${othersCount} other${othersCount > 1 ? "s" : ""}`
        : `${actorName} added ${firstTwo} and ${othersCount} other${othersCount > 1 ? "s" : ""}`;
    }

    case SystemMessageTypes.MEMBER_REMOVED: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return isActorCurrentUser(actor._id)
          ? "You removed yourself"
          : `${actorName} removed you`;
      }
      return isActorCurrentUser(actor._id)
        ? `You removed ${targetName}`
        : `${actorName} removed ${targetName}`;
    }

    case SystemMessageTypes.MEMBER_LEFT: {
      const targetName = isActorCurrentUser(actor._id) ? "You" : actorName;
      return `${targetName} left`;
    }

    case SystemMessageTypes.MEMBER_JOINED: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return "You joined via group link";
      }
      return `${targetName} joined via group link`;
    }

    case SystemMessageTypes.MEMBER_PROMOTED_ADMIN: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return isActorCurrentUser(actor._id)
          ? "You made yourself an admin"
          : `${actorName} made you an admin`;
      }
      return isActorCurrentUser(actor._id)
        ? `You made ${targetName} an admin`
        : `${actorName} made ${targetName} an admin`;
    }

    case SystemMessageTypes.MEMBER_DEMOTED_ADMIN: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return `${actorName} removed you as admin`;
      }
      return isActorCurrentUser(actor._id)
        ? `You removed ${targetName} as admin`
        : `${actorName} removed ${targetName} as admin`;
    }

    case SystemMessageTypes.MEMBER_MADE_MODERATOR: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return `${actorName} made you a moderator`;
      }
      return isActorCurrentUser(actor._id)
        ? `You made ${targetName} a moderator`
        : `${actorName} made ${targetName} a moderator`;
    }

    case SystemMessageTypes.JOIN_REQUEST_APPROVED: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return `${actorName} approved your request to join`;
      }
      return isActorCurrentUser(actor._id)
        ? `You approved ${targetName}'s request to join`
        : `${actorName} approved ${targetName}'s request to join`;
    }

    case SystemMessageTypes.JOIN_REQUEST_DECLINED: {
      const targetUser = metadata.targetUser;
      if (!targetUser) return "";
      const targetName = getUserDisplayName(targetUser);
      const isTargetCurrentUser = targetUserIds.includes(targetUser._id?.toString() || targetUser);
      
      if (isTargetCurrentUser) {
        return `${actorName} declined your request to join`;
      }
      return isActorCurrentUser(actor._id)
        ? `You declined ${targetName}'s request to join`
        : `${actorName} declined ${targetName}'s request to join`;
    }

    case SystemMessageTypes.DISAPPEARING_MESSAGES_ON: {
      const duration = metadata.duration || 7;
      return isActorCurrentUser(actor._id)
        ? `You turned on disappearing messages. Messages will disappear after ${duration} day${duration > 1 ? "s" : ""}`
        : `${actorName} turned on disappearing messages. Messages will disappear after ${duration} day${duration > 1 ? "s" : ""}`;
    }

    case SystemMessageTypes.DISAPPEARING_MESSAGES_OFF:
      return isActorCurrentUser(actor._id)
        ? "You turned off disappearing messages"
        : `${actorName} turned off disappearing messages`;

    default:
      return "System message";
  }
};

/**
 * Get user display name (helper function)
 * @param {Object} user - User object
 * @returns {String} Display name
 */
const getUserDisplayName = (user) => {
  if (!user) return "Unknown User";
  if (user.firstName) {
    return `${user.firstName} ${user.lastName || ""}`.trim();
  }
  if (user.name) {
    return user.name;
  }
  if (user.username) {
    return user.username;
  }
  if (user.email) {
    return user.email.split("@")[0];
  }
  return "Unknown User";
};


