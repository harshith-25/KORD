import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      // Optional: for location-based poll options
      name: { type: String, trim: true }, // e.g., "Cafe Coffee Day"
      address: { type: String, trim: true }, // e.g., "123 Main St, Bengaluru"
      latitude: { type: Number },
      longitude: { type: Number },
    },
    votes: [
      {
        // Array of user IDs who voted for this option
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: true }
); // Mongoose will add _id to subdocuments by default, explicit here.

const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [pollOptionSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length >= 2; // Must have at least two options
        },
        message: "A poll must have at least two options.",
      },
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Poll can be associated with a channel or a direct message conversation
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: false,
    },
    sender: {
      // For DM polls (the current user)
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    recipient: {
      // For DM polls (the other user)
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    allowMultipleVotes: {
      type: Boolean,
      default: false,
    },
    isClosed: {
      // Manually closed by creator/admin
      type: Boolean,
      default: false,
    },
    expiresAt: {
      // Automatic expiration
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure either channel or (sender AND recipient) is present for association
pollSchema.pre("save", function (next) {
  if (this.channel && (this.sender || this.recipient)) {
    return next(
      new Error(
        "A poll cannot be both a channel poll and a direct message poll."
      )
    );
  }
  if (!this.channel && (!this.sender || !this.recipient)) {
    return next(
      new Error(
        "A poll must be associated with either a channel or a direct message conversation (sender and recipient)."
      )
    );
  }
  next();
});

const Poll = mongoose.model("Poll", pollSchema);
export default Poll;