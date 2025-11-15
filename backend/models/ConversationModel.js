import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

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
    leftAt: { type: Date },
    isActive: { type: Boolean, default: true },
    nickname: { type: String },
    permissions: {
      canSendMessages: { type: Boolean, default: true },
      canAddMembers: { type: Boolean, default: false },
      canRemoveMembers: { type: Boolean, default: false },
      canEditInfo: { type: Boolean, default: false },
      canDeleteMessages: { type: Boolean, default: false },
      canPinMessages: { type: Boolean, default: false },
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastReadAt: { type: Date },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date },
  },
  { _id: false }
);

const conversationSettingsSchema = mongoose.Schema(
  {
    allowMemberToAddOthers: { type: Boolean, default: false }, // Legacy - kept for backwards compatibility
    allowMemberToEditInfo: { type: Boolean, default: false },
    messageRetentionDays: { type: Number, default: 0 },
    isEncrypted: { type: Boolean, default: false },
    disappearingMessages: {
      enabled: { type: Boolean, default: false },
      duration: { type: Number, default: 0 },
    },
    onlyAdminsCanMessage: { type: Boolean, default: false },
    requireApprovalToJoin: { type: Boolean, default: false }, // Legacy - kept for backwards compatibility
    // WhatsApp-style membership control
    whoCanAdd: {
      type: String,
      enum: ["everyone", "only_admins"],
      default: "everyone", // Default allows everyone to add (backwards compatible)
    },
    approveNewParticipants: {
      type: Boolean,
      default: false, // Default: direct add (backwards compatible)
    },
    allowModeratorsToApprove: {
      type: Boolean,
      default: false, // Only admins can approve by default
    },
    // Invite link settings
    inviteLinkEnabled: {
      type: Boolean,
      default: false,
    },
    inviteLinkCode: {
      type: String,
      default: null,
      sparse: true,
    },
    slowModeDelay: { type: Number, default: 0 },
    isReadOnly: { type: Boolean, default: false },
    allowFileUploads: { type: Boolean, default: true },
    maxFileSize: { type: Number, default: 10 * 1024 * 1024 },
    allowedFileTypes: {
      type: [String],
      default: ["image", "video", "audio", "document"],
    },
  },
  { _id: false }
);

const conversationSchema = mongoose.Schema(
  {
    conversationId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["direct", "group", "channel"],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
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
    participants: [participantSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lastMessage: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      content: { type: String, maxlength: 200 },
      type: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date },
    },
    lastActivity: { type: Date, default: Date.now, index: true },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPublic: { type: Boolean, default: false },
    inviteLink: { type: String, unique: true, sparse: true },
    inviteLinkExpiry: { type: Date },
    settings: conversationSettingsSchema,
    messageCount: { type: Number, default: 0 },
    memberCount: { type: Number, default: 0 },
    category: {
      type: String,
      enum: [
        "general",
        "work",
        "family",
        "friends",
        "education",
        "entertainment",
        "other",
      ],
      default: "general",
    },
    tags: [{ type: String, trim: true }],
    pinnedMessages: [
      {
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pinnedAt: { type: Date, default: Date.now },
      },
    ],
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
    joinRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
        message: String,
        source: {
          type: String,
          enum: ["admin_add", "invite_link", "direct_join"],
          default: "direct_join",
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null, // If admin initiated the add, track who
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

conversationSchema.pre("save", async function (next) {
  if (this.isModified("participants") || this.isNew) {
    this.memberCount = this.participants.filter((p) => p.isActive).length;
  }

  if (this.isNew && !this.conversationId) {
    if (this.type === "direct") {
      const userIds = this.participants.map((p) => p.user.toString()).sort();
      this.conversationId = `direct_${userIds.join("_")}`;
      this.directParticipants = userIds;
      this.name = null;
    } else {
      this.conversationId = `${this.type}_${this._id.toString()}`;
    }
  }

  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  // Ensure creator is an admin in group/channel
  if (this.isNew && (this.type === "group" || this.type === "channel")) {
    const creator = this.participants.find(
      (p) => p.user.toString() === this.createdBy.toString()
    );
    if (creator) {
      creator.role = "admin";
    }
  }

  next();
});

conversationSchema.index({ "participants.user": 1, lastActivity: -1 });
conversationSchema.index({ type: 1, isActive: 1, lastActivity: -1 });
conversationSchema.index({ slug: 1 });
conversationSchema.index({ inviteLink: 1 });
conversationSchema.index({ directParticipants: 1 });
conversationSchema.index({ isPublic: 1, lastActivity: -1 });

conversationSchema.plugin(mongoosePaginate);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;