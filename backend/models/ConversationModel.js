import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Define participant schema with role and permissions
const participantSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "member", "moderator"],
      default: "member",
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date }, // When user left the conversation
    isActive: { type: Boolean, default: true }, // Whether user is still in conversation
    nickname: { type: String }, // User's nickname in this conversation
    permissions: {
      canSendMessages: { type: Boolean, default: true },
      canAddMembers: { type: Boolean, default: false },
      canRemoveMembers: { type: Boolean, default: false },
      canEditInfo: { type: Boolean, default: false },
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    }, // For read receipts
    lastReadAt: { type: Date },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date },
  },
  { _id: false }
);

// Define conversation settings schema
const conversationSettingsSchema = mongoose.Schema(
  {
    allowMemberToAddOthers: { type: Boolean, default: false },
    allowMemberToEditInfo: { type: Boolean, default: false },
    messageRetentionDays: { type: Number, default: 0 }, // 0 means no deletion
    isEncrypted: { type: Boolean, default: false },
    disappearingMessages: {
      enabled: { type: Boolean, default: false },
      duration: { type: Number, default: 0 }, // in seconds
    },
  },
  { _id: false }
);

const conversationSchema = mongoose.Schema(
  {
    // Conversation identification
    conversationId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    // Conversation type
    type: {
      type: String,
      enum: ["direct", "group", "channel"],
      required: true,
      default: "direct",
    },

    // Basic info
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    avatar: {
      fileName: { type: String },
      filePath: { type: String },
      fileMimeType: { type: String },
      fileSize: { type: Number },
    },

    // Participants
    participants: [participantSchema],

    // Creator/Admin info
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Last message info for quick conversation list loading
    lastMessage: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      content: { type: String, maxlength: 200 }, // Truncated content preview
      type: {
        type: String,
        enum: [
          "text",
          "image",
          "video",
          "audio",
          "file",
          "location",
          "contact",
          "sticker",
          "gif",
        ],
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: { type: Date },
    },

    // Activity tracking
    lastActivity: { type: Date, default: Date.now, index: true },

    // Status and visibility
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Privacy settings
    isPrivate: { type: Boolean, default: false },
    inviteLink: { type: String, unique: true, sparse: true },
    inviteLinkExpiry: { type: Date },

    // Conversation settings
    settings: conversationSettingsSchema,

    // Metadata
    messageCount: { type: Number, default: 0 },
    mediaCount: { type: Number, default: 0 },

    // For channels/groups
    category: {
      type: String,
      enum: ["general", "work", "family", "friends", "other"],
      default: "general",
    },
    tags: [{ type: String, trim: true }],

    // Pinned messages
    pinnedMessages: [
      {
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pinnedAt: { type: Date, default: Date.now },
      },
    ],

    // For direct messages - store participant IDs for quick lookup
    directParticipants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      index: true,
      validate: {
        validator: function (participants) {
          return this.type !== "direct" || participants.length === 2;
        },
        message: "Direct conversations must have exactly 2 participants",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to generate conversationId and handle direct message participants
conversationSchema.pre("save", function (next) {
  // Generate conversationId if not provided
  if (!this.conversationId) {
    if (this.type === "direct" && this.participants.length === 2) {
      // For direct messages, create deterministic ID from participant IDs
      const userIds = this.participants.map((p) => p.user.toString()).sort();
      this.conversationId = `direct_${userIds.join("_")}`;
      this.directParticipants = userIds;
    } else {
      // For groups/channels, generate random ID
      this.conversationId = `${this.type}_${new mongoose.Types.ObjectId()}`;
    }
  }

  // Set directParticipants for direct messages
  if (this.type === "direct") {
    this.directParticipants = this.participants.map((p) => p.user);
  }

  // Auto-generate name for direct conversations
  if (this.type === "direct" && !this.name) {
    this.name = null; // Will be dynamically generated in frontend
  }

  next();
});

// Validation for conversation types
conversationSchema.pre("validate", function (next) {
  if (this.type === "direct") {
    if (this.participants.length !== 2) {
      return next(
        new Error("Direct conversations must have exactly 2 participants")
      );
    }
  } else if (this.type === "group") {
    if (this.participants.length < 2) {
      return next(
        new Error("Group conversations must have at least 2 participants")
      );
    }
    if (!this.name || this.name.trim() === "") {
      return next(new Error("Group conversations must have a name"));
    }
  }
  next();
});

// Indexes for efficient queries
conversationSchema.index({ "participants.user": 1, lastActivity: -1 });
conversationSchema.index({ type: 1, isActive: 1, lastActivity: -1 });
conversationSchema.index({ createdBy: 1, createdAt: -1 });
conversationSchema.index({ directParticipants: 1 }); // For direct message lookup
conversationSchema.index({ inviteLink: 1 });

// Compound index for user's conversation list
conversationSchema.index({
  "participants.user": 1,
  "participants.isActive": 1,
  lastActivity: -1,
});

// Methods
conversationSchema.methods.addParticipant = function (userId, role = "member") {
  const existingParticipant = this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );

  if (existingParticipant) {
    existingParticipant.isActive = true;
    existingParticipant.leftAt = undefined;
    existingParticipant.joinedAt = new Date();
  } else {
    this.participants.push({
      user: userId,
      role: role,
      joinedAt: new Date(),
      isActive: true,
    });
  }

  return this.save();
};

conversationSchema.methods.removeParticipant = function (userId) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );

  if (participant) {
    participant.isActive = false;
    participant.leftAt = new Date();
  }

  return this.save();
};

conversationSchema.methods.updateLastMessage = function (message) {
  this.lastMessage = {
    messageId: message._id,
    content: message.content?.toString().substring(0, 200) || "",
    type: message.type,
    sender: message.sender,
    timestamp: message.timestamp,
  };
  this.lastActivity = new Date();

  return this.save();
};

conversationSchema.methods.getActiveParticipants = function () {
  return this.participants.filter((p) => p.isActive);
};

conversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some(
    (p) => p.user.toString() === userId.toString() && p.isActive
  );
};

conversationSchema.methods.getParticipantRole = function (userId) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString() && p.isActive
  );
  return participant ? participant.role : null;
};

// Static methods
conversationSchema.statics.findDirectConversation = function (
  user1Id,
  user2Id
) {
  const userIds = [user1Id.toString(), user2Id.toString()].sort();
  return this.findOne({
    type: "direct",
    directParticipants: { $all: userIds, $size: 2 },
    isActive: true,
  });
};

conversationSchema.statics.findUserConversations = function (
  userId,
  options = {}
) {
  const {
    type = null,
    includeArchived = false,
    limit = 20,
    skip = 0,
  } = options;

  const query = {
    "participants.user": userId,
    "participants.isActive": true,
    isActive: true,
  };

  if (type) {
    query.type = type;
  }

  if (!includeArchived) {
    query.archivedBy = { $ne: userId };
  }

  return this.find(query)
    .populate("participants.user", "name avatar email")
    .populate("lastMessage.sender", "name avatar")
    .sort({ lastActivity: -1 })
    .limit(limit)
    .skip(skip);
};

conversationSchema.plugin(mongoosePaginate);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;