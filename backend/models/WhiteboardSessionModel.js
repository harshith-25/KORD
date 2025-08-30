import mongoose from "mongoose";

const whiteboardSessionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Untitled Whiteboard",
      trim: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: {
      // If the session is associated with a channel
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: false,
    },
    recipient: {
      // If the session is a direct 1-on-1 session
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    participants: [
      {
        // Users who can access/participate in this session
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    isActive: {
      // True if the session is currently active/open
      type: Boolean,
      default: true,
    },
    lastActivity: {
      // To track recent usage and for cleanup
      type: Date,
      default: Date.now,
    },
    // You might add a 'state' field if you want to store the whiteboard drawing data persistently,
    // but for real-time drawing, this is often handled by WebSockets directly.
    // state: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
); // createdAt and updatedAt

// Ensure either channel or (creator AND recipient) is present for association
whiteboardSessionSchema.pre("save", function (next) {
  if (this.channel && this.recipient) {
    return next(
      new Error(
        "A whiteboard session cannot be both a channel session and a direct message session."
      )
    );
  }
  if (!this.channel && !this.recipient) {
    return next(
      new Error(
        "A whiteboard session must be associated with either a channel or a direct message recipient."
      )
    );
  }
  next();
});

const WhiteboardSession = mongoose.model(
  "WhiteboardSession",
  whiteboardSessionSchema
);
export default WhiteboardSession;