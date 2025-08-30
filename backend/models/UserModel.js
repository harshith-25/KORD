// models/UserModel.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, unique: true, sparse: true }, // Sparse allows nulls, useful if not set immediately
    image: { type: String, default: null }, // URL to profile image
    color: { type: String, default: "#007bff" }, // Default accent color for UI
    bio: { type: String, default: "" },
    profileSetup: { type: Boolean, default: false }, // True after initial setup
    role: { type: String, default: "user", enum: ["user", "admin"] },
    isBlocked: { type: Boolean, default: false }, // System-wide block (admin-controlled)
    status: {
      type: String,
      default: "offline",
      enum: ["online", "away", "offline", "busy"],
    },
    lastOnline: { type: Date },
    // Live Location fields
    isSharingLiveLocation: { type: Boolean, default: false },
    liveLocationExpiresAt: { type: Date },
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      timestamp: { type: Date },
    },
    settings: {
      // Embedded settings object
      privacy: {
        lastSeen: {
          type: String,
          default: "everyone",
          enum: ["everyone", "my_contacts", "nobody"],
        },
        profilePhoto: {
          type: String,
          default: "everyone",
          enum: ["everyone", "my_contacts", "nobody"],
        },
        aboutInfo: {
          type: String,
          default: "everyone",
          enum: ["everyone", "my_contacts", "nobody"],
        },
        readReceipts: { type: Boolean, default: true },
      },
      notifications: {
        messageAlerts: { type: Boolean, default: true },
        channelAlerts: { type: Boolean, default: true },
        sound: { type: Boolean, default: true },
      },
      theme: {
        darkMode: { type: Boolean, default: false },
      },
      chatPreferences: {
        enterToSend: { type: Boolean, default: false },
        fontSize: {
          type: String,
          default: "medium",
          enum: ["small", "medium", "large"],
        },
      },
    },
    // --- New Fields for Contact/Friend System ---
    friends: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    friendRequestsSent: [
      {
        // Requests sent by THIS user
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    friendRequestsReceived: [
      {
        // Requests received by THIS user
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
    // Personal block list (user-controlled)
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;