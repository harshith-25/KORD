// models/NotificationModel.js
import mongoose from "mongoose";

const notificationSchema = mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who triggered the notification (optional)
    type: {
      // e.g., 'new_message', 'channel_invite', 'friend_request', 'status_update'
      type: String,
      required: true,
      enum: [
        "new_message",
        "channel_invite",
        "friend_request", // <-- NEW
        "friend_request_accepted", // <-- NEW
        "friend_request_rejected", // <-- NEW
        "friend_request_cancelled", // <-- NEW
        "status_update",
        "mention", // if someone mentions you in a channel
        "info", // General info notification
      ],
    },
    content: { type: String, required: true }, // The message of the notification
    relatedEntity: {
      // Optional: Link to a specific message, channel, or user that the notification is about
      id: { type: mongoose.Schema.Types.ObjectId },
      kind: { type: String, enum: ["Message", "Channel", "User"] }, // Mongoose's way to identify the model for id
    },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;