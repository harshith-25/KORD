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

messageSchema.pre("save", function (next) {
  if (this.isModified("content") && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ threadId: 1, timestamp: 1 });
messageSchema.index({ "mentions.user": 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ "metadata.clientId": 1 });
messageSchema.index({ content: "text" });

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
    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "senderDetails",
      },
    },
    { $unwind: "$senderDetails" },
    {
      $lookup: {
        from: "messages",
        localField: "replyTo",
        foreignField: "_id",
        as: "replyToDetails",
      },
    },
    { $unwind: { path: "$replyToDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        conversationId: 1,
        content: 1,
        type: 1,
        timestamp: 1,
        file: 1,
        location: 1,
        contact: 1,
        isEdited: 1,
        editedAt: 1,
        isDeleted: 1,
        deletedFor: 1,
        reactions: 1,
        replyTo: {
          _id: "$replyToDetails._id",
          content: "$replyToDetails.content",
          type: "$replyToDetails.type",
          sender: "$replyToDetails.sender",
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
        sender: {
          _id: "$senderDetails._id",
          name: "$senderDetails.name",
          avatar: "$senderDetails.avatar",
        },
      },
    },
  ]);
  return result.reverse(); // Return in chronological order
};

messageSchema.statics.findThreadMessages = function (threadId, options = {}) {
  const { limit = 20, page = 1 } = options;
  const skip = (page - 1) * limit;

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
  const { limit = 20, page = 1 } = options;
  const skip = (page - 1) * limit;

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

messageSchema.statics.getMediaFiles = function (conversationId, options = {}) {
  const { limit = 20, page = 1 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    conversationId,
    type: { $in: ["image", "video", "audio", "file"] },
    isDeleted: false,
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .select("file timestamp sender");
};

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
  return this.deletedFor.some((id) => id.toString() === userId.toString());
};

messageSchema.methods.canUserEdit = function (userId) {
  if (!this.sender) {
    console.error("Sender is undefined in canUserEdit");
    return false;
  }

  return (
    this.sender.toString() === userId.toString() &&
    Date.now() - this.createdAt.getTime() < 15 * 60 * 1000
  );
};

messageSchema.plugin(mongoosePaginate);

const Message = mongoose.model("Message", messageSchema);
export default Message;
