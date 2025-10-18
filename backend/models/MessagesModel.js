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
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          if (this.type === "text" && (!v || v.toString().trim() === "")) {
            return false;
          }
          return true;
        },
        message: "Content is required for text messages",
      },
    },
    file: fileSchema,
    location: locationSchema,
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
        "system",
      ],
      default: "text",
    },
    systemData: {
      action: String,
      affectedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      oldValue: String,
      newValue: String,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    readReceipts: [readReceiptSchema],
    deliveryStatus: {
      type: String,
      enum: ["sent", "delivered", "failed"],
      default: "sent",
    },
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    reactions: [reactionSchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
      validate: {
        validator: async function (value) {
          if (!value) return true;

          // Prevent self-reply
          if (value.toString() === this._id?.toString()) {
            return false;
          }

          const Message = mongoose.model("Message");
          const referencedMessage = await Message.findById(value);

          // Ensure referenced message exists and is in same conversation
          return (
            referencedMessage &&
            referencedMessage.conversationId === this.conversationId
          );
        },
        message:
          "Invalid reply reference: message must exist in the same conversation and cannot reply to itself",
      },
    },
    // Track if the replied message is still available
    isReplyAvailable: {
      type: Boolean,
      default: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true,
    },
    replyCount: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    expiresAt: { type: Date },
    forwardedFrom: {
      originalSender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      originalConversationId: { type: String },
      originalMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      forwardedAt: { type: Date },
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
    metadata: {
      clientId: { type: String },
      deviceType: { type: String },
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

// Validation hooks
messageSchema.pre("validate", function (next) {
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

// Pre-save hooks
messageSchema.pre("save", async function (next) {
  // Track edits
  if (this.isModified("content") && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  // Update reply count on the original message when a new reply is created
  if (this.isNew && this.replyTo) {
    try {
      const originalMessage = await this.constructor.findById(this.replyTo);

      if (originalMessage) {
        // Check if the original message is deleted
        if (originalMessage.isDeleted) {
          return next(new Error("Cannot reply to a deleted message"));
        }

        originalMessage.replyCount = (originalMessage.replyCount || 0) + 1;
        await originalMessage.save();
        this.isReplyAvailable = true;
      } else {
        // Original message doesn't exist
        this.isReplyAvailable = false;
      }
    } catch (error) {
      console.error("Error updating reply count:", error);
      this.isReplyAvailable = false;
    }
  }

  next();
});

// Post-save hook to handle reply availability and counts when messages are deleted
messageSchema.post("save", async function (doc) {
  // If this message is being deleted
  if (doc.isDeleted) {
    try {
      // If this message was itself a reply, decrement the reply count of the original message
      if (doc.replyTo) {
        await this.constructor.findByIdAndUpdate(
          doc.replyTo,
          { $inc: { replyCount: -1 } },
          { new: true }
        );
      }

      // Update all messages that replied to this message to mark reply as unavailable
      await this.constructor.updateMany(
        { replyTo: doc._id },
        { $set: { isReplyAvailable: false } }
      );
    } catch (error) {
      console.error("Error updating reply availability and counts:", error);
    }
  }
});

// Indexes
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ replyTo: 1, conversationId: 1 }); // NEW: For efficient reply queries
messageSchema.index({ threadId: 1, timestamp: 1 });
messageSchema.index({ "mentions.user": 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ "metadata.clientId": 1 });
messageSchema.index({ content: "text" });

// Enhanced static method for fetching conversation messages with proper reply handling
messageSchema.statics.findConversationMessages = async function (
  conversationId,
  options = {}
) {
  const {
    limit = 50,
    page = 1,
    userId = null,
    includeDeleted = false,
  } = options;

  const query = {
    conversationId,
    ...(userId && !includeDeleted && { deletedFor: { $ne: userId } }),
    ...(!includeDeleted && { isDeleted: false }),
  };

  const result = await this.aggregate([
    { $match: query },
    { $sort: { timestamp: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },

    // Lookup sender details
    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "senderDetails",
      },
    },
    { $unwind: "$senderDetails" },

    // Lookup replied message details
    {
      $lookup: {
        from: "messages",
        localField: "replyTo",
        foreignField: "_id",
        as: "replyToDetails",
      },
    },
    {
      $unwind: {
        path: "$replyToDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Lookup sender details for the replied message
    {
      $lookup: {
        from: "users",
        localField: "replyToDetails.sender",
        foreignField: "_id",
        as: "replyToSenderDetails",
      },
    },
    {
      $unwind: {
        path: "$replyToSenderDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Project final structure
    {
      $project: {
        _id: 1,
        conversationId: 1,
        content: 1,
        type: 1,
        timestamp: 1,
        createdAt: 1,
        updatedAt: 1,
        file: 1,
        location: 1,
        contact: 1,
        isEdited: 1,
        editedAt: 1,
        isDeleted: 1,
        deletedFor: 1,
        reactions: 1,
        replyTo: {
          $cond: {
            if: { $ifNull: ["$replyToDetails._id", false] },
            then: {
              _id: "$replyToDetails._id",
              content: {
                $cond: {
                  if: { $eq: ["$replyToDetails.isDeleted", true] },
                  then: "This message was deleted",
                  else: {
                    $cond: {
                      if: {
                        $and: [
                          { $ifNull: ["$replyToDetails.deletedFor", false] },
                          { $in: [userId, "$replyToDetails.deletedFor"] },
                        ],
                      },
                      then: "This message was deleted",
                      else: "$replyToDetails.content",
                    },
                  },
                },
              },
              type: "$replyToDetails.type",
              file: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ["$replyToDetails.isDeleted", true] },
                      { $ifNull: ["$replyToDetails.file", false] },
                    ],
                  },
                  then: {
                    fileName: "$replyToDetails.file.fileName",
                    fileMimeType: "$replyToDetails.file.fileMimeType",
                    thumbnailPath: "$replyToDetails.file.thumbnailPath",
                  },
                  else: "$$REMOVE",
                },
              },
              sender: {
                $cond: {
                  if: { $ifNull: ["$replyToSenderDetails._id", false] },
                  then: {
                    _id: "$replyToSenderDetails._id",
                    name: "$replyToSenderDetails.name",
                    username: "$replyToSenderDetails.username",
                    firstName: "$replyToSenderDetails.firstName",
                    lastName: "$replyToSenderDetails.lastName",
                    avatar: "$replyToSenderDetails.avatar",
                  },
                  else: {
                    _id: null,
                    name: "Unknown User",
                    avatar: null,
                  },
                },
              },
              isDeleted: {
                $or: [
                  { $eq: ["$replyToDetails.isDeleted", true] },
                  {
                    $and: [
                      { $ifNull: ["$replyToDetails.deletedFor", false] },
                      { $in: [userId, "$replyToDetails.deletedFor"] },
                    ],
                  },
                ],
              },
              isAvailable: "$isReplyAvailable",
            },
            else: null,
          },
        },
        threadId: 1,
        replyCount: 1,
        isPinned: 1,
        pinnedAt: 1,
        pinnedBy: 1,
        mentions: 1,
        metadata: 1,
        readReceipts: 1,
        deliveryStatus: 1,
        systemData: 1,
        forwardedFrom: 1,
        priority: 1,
        isReplyAvailable: 1,
        sender: {
          _id: "$senderDetails._id",
          name: "$senderDetails.name",
          username: "$senderDetails.username",
          firstName: "$senderDetails.firstName",
          lastName: "$senderDetails.lastName",
          avatar: "$senderDetails.avatar",
          color: "$senderDetails.color",
          image: "$senderDetails.image",
          status: "$senderDetails.status",
          isOnline: "$senderDetails.isOnline",
        },
      },
    },
  ]);

  return result.reverse(); // Return in chronological order
};

// Static method for finding thread messages
messageSchema.statics.findThreadMessages = function (threadId, options = {}) {
  const { limit = 20, page = 1 } = options;
  const skip = (page - 1) * limit;

  return this.find({ threadId })
    .populate("sender", "name avatar status username firstName lastName")
    .populate({
      path: "replyTo",
      select: "content type sender file isDeleted deletedFor",
      populate: {
        path: "sender",
        select: "name avatar username firstName lastName",
      },
    })
    .sort({ timestamp: 1 })
    .limit(limit)
    .skip(skip);
};

// Static method for searching messages
messageSchema.statics.searchMessages = function (
  query,
  conversationId,
  options = {}
) {
  const { limit = 20, page = 1 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    conversationId,
    $text: { $search: query },
    isDeleted: false,
  })
    .populate("sender", "name avatar username firstName lastName")
    .populate({
      path: "replyTo",
      select: "content type sender file isDeleted deletedFor",
      populate: {
        path: "sender",
        select: "name avatar username firstName lastName",
      },
    })
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .skip(skip);
};

// Static method for getting media files
messageSchema.statics.getMediaFiles = function (conversationId, options = {}) {
  const { limit = 20, page = 1, mediaType = null } = options;
  const skip = (page - 1) * limit;

  const typeFilter = mediaType
    ? { type: mediaType }
    : { type: { $in: ["image", "video", "audio", "file"] } };

  return this.find({
    conversationId,
    ...typeFilter,
    isDeleted: false,
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .select("file timestamp sender type")
    .populate("sender", "name avatar username firstName lastName");
};

// Instance method to mark message as read
messageSchema.methods.markAsRead = function (userId, deviceInfo = null) {
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

// Instance method to add reaction
messageSchema.methods.addReaction = function (userId, emoji) {
  const existingReactionIndex = this.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingReactionIndex !== -1) {
    this.reactions[existingReactionIndex].emoji = emoji;
    this.reactions[existingReactionIndex].reactedAt = new Date();
  } else {
    this.reactions.push({
      user: userId,
      emoji,
      reactedAt: new Date(),
    });
  }
  return this.save();
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function (userId, emoji) {
  this.reactions = this.reactions.filter(
    (r) => !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );
  return this.save();
};

// Instance method for soft delete (delete for specific user)
messageSchema.methods.softDelete = async function (userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
  }
  return this.save();
};

// Instance method to check if message is deleted for a specific user
messageSchema.methods.isDeletedFor = function (userId) {
  return (
    this.isDeleted ||
    this.deletedFor.some((id) => id.toString() === userId.toString())
  );
};

// Instance method to check if user can edit the message
messageSchema.methods.canUserEdit = function (userId) {
  if (!this.sender) {
    console.error("Sender is undefined in canUserEdit");
    return false;
  }

  return (
    this.sender.toString() === userId.toString() &&
    Date.now() - this.createdAt.getTime() < 15 * 60 * 1000 // 15 minutes
  );
};

// Instance method to get reply preview (useful for UI)
messageSchema.methods.getReplyPreview = function () {
  if (!this.replyTo) return null;

  const preview = {
    id: this.replyTo._id,
    type: this.replyTo.type,
  };

  if (this.replyTo.isDeleted) {
    preview.content = "This message was deleted";
    preview.isDeleted = true;
  } else {
    switch (this.replyTo.type) {
      case "text":
        preview.content =
          this.replyTo.content.length > 50
            ? `${this.replyTo.content.substring(0, 50)}...`
            : this.replyTo.content;
        break;
      case "image":
        preview.content = "📷 Photo";
        break;
      case "video":
        preview.content = "🎥 Video";
        break;
      case "audio":
        preview.content = "🎵 Audio";
        break;
      case "file":
        preview.content = `📎 ${this.replyTo.file?.fileName || "File"}`;
        break;
      case "location":
        preview.content = "📍 Location";
        break;
      case "contact":
        preview.content = `👤 ${this.replyTo.contact?.name || "Contact"}`;
        break;
      default:
        preview.content = "Message";
    }
  }

  return preview;
};

messageSchema.plugin(mongoosePaginate);

const Message = mongoose.model("Message", messageSchema);
export default Message;