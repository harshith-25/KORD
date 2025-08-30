import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Define a schema for reactions
const reactionSchema = mongoose.Schema(
  {
    emoji: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Define read receipt schema for better tracking
const readReceiptSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: { type: Date, default: Date.now },
    deviceInfo: { type: String }, // Optional: track which device read it
  },
  { _id: false }
);

// Define file metadata schema
const fileSchema = mongoose.Schema(
  {
    fileName: { type: String }, // Original file name
    filePath: { type: String }, // Path on server or URL
    fileMimeType: { type: String }, // MIME type (e.g., image/jpeg)
    fileSize: { type: Number }, // Size in bytes
    thumbnailPath: { type: String }, // For images/videos
    duration: { type: Number }, // For audio/video in seconds
    width: { type: Number }, // For images/videos
    height: { type: Number }, // For images/videos
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Define location schema
const locationSchema = mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String },
    name: { type: String }, // Place name
  },
  { _id: false }
);

// Define contact schema
const contactSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String },
    email: { type: String },
    avatar: { type: String },
  },
  { _id: false }
);

const messageSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      index: true,
    },

    // UPDATED: Make conversationId required for new unified system
    conversationId: {
      type: String,
      required: true,
      index: true,
    },

    // Content with better typing
    content: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          // Content is required for text messages
          if (this.type === "text" && (!v || v.toString().trim() === "")) {
            return false;
          }
          return true;
        },
        message: "Content is required for text messages",
      },
    },

    // Enhanced file handling
    file: fileSchema,

    // Location data
    location: locationSchema,

    // Contact data
    contact: contactSchema,

    type: {
      type: String,
      required: true,
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
        "system", // NEW: For system messages (user joined, left, etc.)
      ],
      default: "text",
    },

    // Enhanced system message support
    systemMessageType: {
      type: String,
      enum: [
        "user_joined",
        "user_left",
        "user_added",
        "user_removed",
        "channel_created",
        "channel_updated",
        "message_pinned",
        "message_unpinned",
      ],
      required: function () {
        return this.type === "system";
      },
    },

    timestamp: { type: Date, default: Date.now, index: true },

    // Enhanced read receipts
    readReceipts: [readReceiptSchema],

    // DEPRECATED: Keep for backward compatibility, but use readReceipts instead
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Message status
    deliveryStatus: {
      type: String,
      enum: ["sent", "delivered", "failed"],
      default: "sent",
    },

    // Message states
    isDeleted: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },

    // Soft delete for specific users
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reactions
    reactions: [reactionSchema],

    // Reply/Thread support
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Thread support
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true,
    },

    replyCount: { type: Number, default: 0 },

    // Message priority (for important messages)
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Message expiry (for disappearing messages)
    expiresAt: { type: Date },

    // Forwarding information
    forwardedFrom: {
      originalSender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      originalMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      forwardedAt: { type: Date },
    },

    // Pinned status
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Mentions
    mentions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        startIndex: Number,
        endIndex: Number,
      },
    ],

    // Message metadata
    metadata: {
      clientId: { type: String }, // For message deduplication
      deviceType: { type: String }, // mobile, web, desktop
      appVersion: { type: String },
      ip: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// UPDATED: Pre-validate with better conversation handling
messageSchema.pre("validate", function (next) {
  // For new messages, conversationId is required
  if (!this.conversationId) {
    // Auto-generate conversationId for backward compatibility
    if (this.recipient) {
      const userIds = [
        this.sender.toString(),
        this.recipient.toString(),
      ].sort();
      this.conversationId = `direct_${userIds.join("_")}`;
    } else if (this.channel) {
      this.conversationId = `channel_${this.channel.toString()}`;
    } else {
      return next(new Error("conversationId is required"));
    }
  }

  // Validate content based on message type
  if (this.type === "location" && !this.location) {
    return next(new Error("Location data is required for location messages"));
  }

  if (this.type === "contact" && !this.contact) {
    return next(new Error("Contact data is required for contact messages"));
  }

  if (["image", "video", "audio", "file"].includes(this.type) && !this.file) {
    return next(new Error(`File data is required for ${this.type} messages`));
  }

  next();
});

// Pre-save middleware
messageSchema.pre("save", function (next) {
  // Update edited timestamp
  if (this.isModified("content") && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  next();
});

// UPDATED: Enhanced indexes for better performance
messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
messageSchema.index({ channel: 1, timestamp: -1 });
messageSchema.index({ conversationId: 1, timestamp: -1 }); // Primary conversation index
messageSchema.index({ conversationId: 1, timestamp: -1, isDeleted: 1 }); // NEW: Compound index
messageSchema.index({ content: "text" });
messageSchema.index({ type: 1, timestamp: -1 });
messageSchema.index({ threadId: 1, timestamp: 1 });
messageSchema.index({ "mentions.user": 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ isPinned: 1, conversationId: 1 }); // Updated to use conversationId
messageSchema.index({ "metadata.clientId": 1 });

// Compound indexes for common queries
messageSchema.index({ sender: 1, type: 1, timestamp: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, timestamp: -1 });

// Virtual for checking if message is in thread
messageSchema.virtual("isInThread").get(function () {
  return !!this.threadId;
});

// Methods
messageSchema.methods.markAsRead = function (userId, deviceInfo = null) {
  // Remove from old readBy array (backward compatibility)
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
  }

  // Add to new readReceipts array
  const existingReceipt = this.readReceipts.find(
    (r) => r.user.toString() === userId.toString()
  );

  if (!existingReceipt) {
    this.readReceipts.push({
      user: userId,
      readAt: new Date(),
      deviceInfo,
    });
  }

  return this.save();
};

messageSchema.methods.addReaction = function (userId, emoji) {
  // Remove existing reaction from same user
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString() || r.emoji !== emoji
  );

  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji,
    reactedAt: new Date(),
  });

  return this.save();
};

messageSchema.methods.removeReaction = function (userId, emoji) {
  this.reactions = this.reactions.filter(
    (r) => !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );

  return this.save();
};

messageSchema.methods.softDelete = function (userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
  }
  return this.save();
};

messageSchema.methods.isDeletedFor = function (userId) {
  return this.deletedFor.includes(userId);
};

messageSchema.methods.canUserEdit = function (userId) {
  return (
    this.sender.toString() === userId.toString() &&
    Date.now() - this.createdAt.getTime() < 15 * 60 * 1000
  ); // 15 minutes
};

// UPDATED: Static methods with better conversation support
messageSchema.statics.findConversationMessages = function (
  conversationId,
  options = {}
) {
  const {
    limit = 50,
    skip = 0,
    userId = null,
    includeDeleted = false,
  } = options;

  const query = {
    conversationId,
    ...(userId && !includeDeleted && { deletedFor: { $ne: userId } }),
    ...(!includeDeleted && { isDeleted: false }),
  };

  return this.find(query)
    .populate("sender", "name avatar")
    .populate("replyTo", "content sender type")
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.findThreadMessages = function (threadId, options = {}) {
  const { limit = 20, skip = 0 } = options;

  return this.find({ threadId })
    .populate("sender", "name avatar")
    .sort({ timestamp: 1 })
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.searchMessages = function (
  query,
  conversationId,
  options = {}
) {
  const { limit = 20, skip = 0 } = options;

  return this.find({
    conversationId,
    $text: { $search: query },
    isDeleted: false,
  })
    .populate("sender", "name avatar")
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .skip(skip);
};

// NEW: Migration helper method
messageSchema.statics.migrateToConversations = async function () {
  // Migrate messages without conversationId
  const messagesToMigrate = await this.find({
    conversationId: { $exists: false },
  });

  for (const message of messagesToMigrate) {
    if (message.recipient) {
      const userIds = [
        message.sender.toString(),
        message.recipient.toString(),
      ].sort();
      message.conversationId = `direct_${userIds.join("_")}`;
    } else if (message.channel) {
      message.conversationId = `channel_${message.channel.toString()}`;
    }

    await message.save();
  }

  console.log(
    `Migrated ${messagesToMigrate.length} messages to conversation format`
  );
};

messageSchema.plugin(mongoosePaginate);

const Message = mongoose.model("Message", messageSchema);
export default Message;