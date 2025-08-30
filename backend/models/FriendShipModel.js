import mongoose from "mongoose";

const friendshipSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Friendship must have a sender."],
    },
    recipient: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Friendship must have a recipient."],
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate pending requests or accepted friendships
friendshipSchema.index({ sender: 1, recipient: 1 }, { unique: true });

// Ensure sender and recipient are different
friendshipSchema.path("recipient").validate(function (value) {
  return this.sender.toString() !== value.toString();
}, "Cannot send a friend request to yourself.");

const Friendship = mongoose.model("Friendship", friendshipSchema);
export default Friendship;