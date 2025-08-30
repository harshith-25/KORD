import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Define member schema with roles and permissions
const memberSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date }, // When user left the channel
    isActive: { type: Boolean, default: true }, // Whether user is still in channel
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date },
    permissions: {
      canSendMessages: { type: Boolean, default: true },
      canAddMembers: { type: Boolean, default: false },
      canRemoveMembers: { type: Boolean, default: false },
      canEditChannel: { type: Boolean, default: false },
      canDeleteMessages: { type: Boolean, default: false },
      canPinMessages: { type: Boolean, default: false },
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastReadAt: { type: Date },
  },
  { _id: false }
);

// Define channel settings schema
const channelSettingsSchema = mongoose.Schema(
  {
    allowMemberToAddOthers: { type: Boolean, default: false },
    allowMemberToEditInfo: { type: Boolean, default: false },
    messageRetentionDays: { type: Number, default: 0 }, // 0 means no deletion
    slowModeDelay: { type: Number, default: 0 }, // Seconds between messages
    isReadOnly: { type: Boolean, default: false },
    requireApprovalToJoin: { type: Boolean, default: false },
    allowFileUploads: { type: Boolean, default: true },
    maxFileSize: { type: Number, default: 10 * 1024 * 1024 }, // 10MB default
    allowedFileTypes: {
      type: [String],
      default: ["image", "video", "audio", "document"],
    },
    disappearingMessages: {
      enabled: { type: Boolean, default: false },
      duration: { type: Number, default: 0 }, // in seconds
    },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 1,
      maxlength: 100,
      // Ensure channel names are URL-friendly
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s\-_]+$/.test(v);
        },
        message:
          "Channel name can only contain letters, numbers, spaces, hyphens, and underscores",
      },
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    avatar: {
      fileName: { type: String },
      filePath: { type: String },
      fileMimeType: { type: String },
      fileSize: { type: Number },
    },

    // NEW: Conversation reference for unified chat system
    conversationId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Enhanced member management
    members: [memberSchema],

    // Multiple admins support
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Channel creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Channel type and privacy
    type: {
      type: String,
      enum: ["public", "private", "announcement"],
      default: "public",
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    // Channel status
    isActive: {
      type: Boolean,
      default: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Last activity tracking
    lastActivity: { type: Date, default: Date.now, index: true },

    // Last message info for quick channel list loading
    lastMessage: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      content: { type: String, maxlength: 200 },
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

    // Channel settings
    settings: channelSettingsSchema,

    // Invite management
    inviteLink: {
      type: String,
      unique: true,
      sparse: true,
    },

    inviteLinkExpiry: { type: Date },

    // Category and organization
    category: {
      type: String,
      enum: ["general", "work", "project", "social", "announcement", "other"],
      default: "general",
    },

    tags: [{ type: String, trim: true }],

    // Statistics
    memberCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },

    // Pinned messages
    pinnedMessages: [
      {
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pinnedAt: { type: Date, default: Date.now },
      },
    ],

    // Join requests for private channels
    joinRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
        message: { type: String, maxlength: 200 },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to generate slug, conversationId and update member count
channelSchema.pre("save", function (next) {
  // Generate slug from name
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .trim();
  }

  // NEW: Generate conversationId for unified chat system
  if (!this.conversationId) {
    this.conversationId = `channel_${this._id.toString()}`;
  }

  // Update member count
  this.memberCount = this.members.filter((m) => m.isActive).length;

  // Ensure creator is in admins array
  if (this.createdBy && !this.admins.includes(this.createdBy)) {
    this.admins.push(this.createdBy);
  }

  next();
});

// Indexes for efficient queries
channelSchema.index({ name: 1 });
channelSchema.index({ slug: 1 });
channelSchema.index({ conversationId: 1 }); // NEW: Index for conversation lookup
channelSchema.index({ "members.user": 1, "members.isActive": 1 });
channelSchema.index({ type: 1, isPrivate: 1, isActive: 1 });
channelSchema.index({ createdBy: 1 });
channelSchema.index({ category: 1, isActive: 1 });
channelSchema.index({ lastActivity: -1 });
channelSchema.index({ inviteLink: 1 });

// Compound index for user's channel list
channelSchema.index({
  "members.user": 1,
  "members.isActive": 1,
  lastActivity: -1,
});

// Virtual for active members
channelSchema.virtual("activeMembers").get(function () {
  return this.members.filter((member) => member.isActive);
});

// Methods
channelSchema.methods.addMember = function (userId, role = "member") {
  const existingMember = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );

  if (existingMember) {
    existingMember.isActive = true;
    existingMember.leftAt = undefined;
    existingMember.joinedAt = new Date();
    existingMember.role = role;
  } else {
    this.members.push({
      user: userId,
      role: role,
      joinedAt: new Date(),
      isActive: true,
    });
  }

  return this.save();
};

channelSchema.methods.removeMember = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );

  if (member) {
    member.isActive = false;
    member.leftAt = new Date();
  }

  return this.save();
};

channelSchema.methods.updateLastMessage = function (message) {
  this.lastMessage = {
    messageId: message._id,
    content: message.content?.toString().substring(0, 200) || "",
    type: message.type,
    sender: message.sender,
    timestamp: message.timestamp,
  };
  this.lastActivity = new Date();
  this.messageCount += 1;

  return this.save();
};

channelSchema.methods.isMember = function (userId) {
  return this.members.some(
    (m) => m.user.toString() === userId.toString() && m.isActive
  );
};

channelSchema.methods.isAdmin = function (userId) {
  return this.admins.some(
    (adminId) => adminId.toString() === userId.toString()
  );
};

channelSchema.methods.getMemberRole = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString() && m.isActive
  );
  return member ? member.role : null;
};

channelSchema.methods.canUserPerformAction = function (userId, action) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString() && m.isActive
  );

  if (!member) return false;

  // Admins can do everything
  if (this.isAdmin(userId)) return true;

  // Check specific permissions
  return member.permissions[action] || false;
};

channelSchema.methods.generateInviteLink = function () {
  const crypto = require("crypto");
  this.inviteLink = crypto.randomBytes(16).toString("hex");
  this.inviteLinkExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return this.save();
};

// NEW: Convert channel to conversation format for migration
channelSchema.methods.toConversation = function () {
  return {
    conversationId: this.conversationId || `channel_${this._id.toString()}`,
    type: "channel",
    name: this.name,
    description: this.description,
    avatar: this.avatar,
    participants: this.members.map((member) => ({
      user: member.user,
      role: member.role,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      isActive: member.isActive,
      permissions: {
        canSendMessages: member.permissions.canSendMessages,
        canAddMembers: member.permissions.canAddMembers,
        canRemoveMembers: member.permissions.canRemoveMembers,
        canEditInfo: member.permissions.canEditChannel,
      },
      lastReadMessageId: member.lastReadMessageId,
      lastReadAt: member.lastReadAt,
      isMuted: member.isMuted,
      mutedUntil: member.mutedUntil,
    })),
    createdBy: this.createdBy,
    lastMessage: this.lastMessage,
    lastActivity: this.lastActivity,
    isActive: this.isActive,
    isArchived: this.isArchived,
    isPrivate: this.isPrivate,
    inviteLink: this.inviteLink,
    inviteLinkExpiry: this.inviteLinkExpiry,
    settings: {
      allowMemberToAddOthers: this.settings.allowMemberToAddOthers,
      allowMemberToEditInfo: this.settings.allowMemberToEditInfo,
      messageRetentionDays: this.settings.messageRetentionDays,
      isEncrypted: false,
      disappearingMessages: this.settings.disappearingMessages,
    },
    messageCount: this.messageCount,
    mediaCount: 0,
    category: this.category,
    tags: this.tags,
    pinnedMessages: this.pinnedMessages,
  };
};

// Static methods
channelSchema.statics.findUserChannels = function (userId, options = {}) {
  const {
    type = null,
    includeArchived = false,
    limit = 20,
    skip = 0,
  } = options;

  const query = {
    "members.user": userId,
    "members.isActive": true,
    isActive: true,
  };

  if (type) {
    query.type = type;
  }

  if (!includeArchived) {
    query.isArchived = false;
  }

  return this.find(query)
    .populate("members.user", "name avatar email")
    .populate("lastMessage.sender", "name avatar")
    .populate("admins", "name avatar")
    .sort({ lastActivity: -1 })
    .limit(limit)
    .skip(skip);
};

channelSchema.statics.findPublicChannels = function (options = {}) {
  const { limit = 20, skip = 0, category = null } = options;

  const query = {
    isPrivate: false,
    isActive: true,
    isArchived: false,
  };

  if (category) {
    query.category = category;
  }

  return this.find(query)
    .select("name description avatar category memberCount lastActivity")
    .sort({ memberCount: -1, lastActivity: -1 })
    .limit(limit)
    .skip(skip);
};

// NEW: Find channel by conversationId
channelSchema.statics.findByConversationId = function (conversationId) {
  return this.findOne({ conversationId });
};

// NEW: Migration helper to populate conversationId for existing channels
channelSchema.statics.migrateConversationIds = async function () {
  const channelsWithoutConversationId = await this.find({
    conversationId: { $exists: false },
  });

  for (const channel of channelsWithoutConversationId) {
    channel.conversationId = `channel_${channel._id.toString()}`;
    await channel.save();
  }

  console.log(
    `Migrated ${channelsWithoutConversationId.length} channels with conversationId`
  );
};

channelSchema.plugin(mongoosePaginate);

const Channel = mongoose.model("Channel", channelSchema);
export default Channel;