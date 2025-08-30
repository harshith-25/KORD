import User from "../models/UserModel.js";
import Channel from "../models/ChannelModel.js"; // Needed for channel management
import Message from "../models/MessagesModel.js"; // Needed for cascading message deletion
import mongoose from "mongoose";

// Helper function for consistent error responses
const sendErrorResponse = (
  res,
  error,
  message = "Internal Server Error",
  statusCode = 500
) => {
  console.error(error); // Log the full error for debugging
  return res.status(statusCode).send(message);
};

// @desc    Get all users (for admin panel)
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password -__v"); // Exclude password and __v
    return res.status(200).json({ users });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching all users.");
  }
};

// @desc    Get a single user by ID (for admin panel)
// @route   GET /api/admin/users/:userId
// @access  Private (Admin only)
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }

    const user = await User.findById(userId).select("-password -__v"); // Exclude password and __v
    if (!user) {
      return res.status(404).send("User not found.");
    }
    return res.status(200).json({ user });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching user by ID.");
  }
};

// @desc    Update a user's role
// @route   PUT /api/admin/users/:userId/role
// @access  Private (Admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body; // e.g., 'user', 'admin'

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }
    if (!role || !["user", "admin"].includes(role)) {
      // Add more roles if needed
      return res
        .status(400)
        .send("Invalid role specified. Role must be 'user' or 'admin'.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Prevent an admin from demoting themselves
    if (user._id.toString() === req.userId.toString() && role === "user") {
      return res.status(403).send("Admin cannot demote their own account.");
    }
    // Prevent an admin from deleting or modifying the only admin account (optional but good practice)
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 1 && user.role === "admin" && role === "user") {
      return res.status(403).send("Cannot demote the last admin account.");
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      message: `User role updated to ${role}.`,
      user: user.email,
      newRole: user.role,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Error updating user role.");
  }
};

// @desc    Block a user
// @route   PUT /api/admin/users/:userId/block
// @access  Private (Admin only)
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Prevent blocking an admin account by another admin
    if (user.role === "admin") {
      return res.status(403).send("Cannot block an administrator account.");
    }
    // Prevent admin from blocking themselves
    if (user._id.toString() === req.userId.toString()) {
      return res.status(403).send("Admin cannot block their own account.");
    }

    user.isBlocked = true;
    user.status = "offline"; // Set status to offline when blocked
    await user.save();

    return res.status(200).send("User blocked successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error blocking user.");
  }
};

// @desc    Unblock a user
// @route   PUT /api/admin/users/:userId/unblock
// @access  Private (Admin only)
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    user.isBlocked = false;
    // Optionally, set status to 'offline' or 'away' or handle dynamically
    await user.save();

    return res.status(200).send("User unblocked successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error unblocking user.");
  }
};

// @desc    Delete a user account
// @route   DELETE /api/admin/users/:userId
// @access  Private (Admin only)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).send("User not found.");
    }

    // Prevent an admin from deleting another admin or themselves
    if (userToDelete.role === "admin") {
      return res.status(403).send("Cannot delete an administrator account.");
    }
    if (userToDelete._id.toString() === req.userId.toString()) {
      return res
        .status(403)
        .send("Admin cannot delete their own account through this panel.");
    }

    // Implement cascading deletions for:
    // - All messages sent/received by this user
    await Message.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }],
    });
    // - Remove user from channels/groups (pull their ID from members array)
    await Channel.updateMany({}, { $pull: { members: userId } });
    // - If this user was an admin of any channel, consider transferring admin rights or deleting channel
    //   For simplicity here, channels without an admin might need manual cleanup or specific logic.
    //   E.g., if a channel's admin is deleted, set a default admin or delete the channel.
    // - Delete user's profile image file from storage (if locally stored)
    // - Delete notifications related to this user
    // - Delete polls created by this user, or reassign creator
    // - Delete whiteboard sessions created by this user

    await User.findByIdAndDelete(userId);

    return res
      .status(200)
      .send("User account and associated data deleted successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting user account.");
  }
};

// @desc    Get all channels (for admin panel)
// @route   GET /api/admin/channels
// @access  Private (Admin only)
export const getAllChannels = async (req, res) => {
  try {
    const channels = await Channel.find({})
      .populate("admin", "firstName lastName email username")
      .select("-__v"); // Exclude __v

    return res.status(200).json({ channels });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching all channels.");
  }
};

// @desc    Delete a channel (Admin Panel version)
// @route   DELETE /api/admin/channels/:channelId
// @access  Private (Admin only)
// Note: Renamed to adminDeleteChannel in routes to avoid conflict with channelRoutes deleteChannel
export const deleteChannel = async (req, res) => {
  // This is the function that was missing
  try {
    const { channelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Admin can delete any channel regardless of who created it
    // Remove all messages associated with this channel
    await Message.deleteMany({ channel: channelId });

    await channel.deleteOne(); // Use deleteOne for Mongoose 6+

    return res
      .status(200)
      .send("Channel and its messages deleted successfully by admin.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting channel by admin.");
  }
};