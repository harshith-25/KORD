import Channel from "../models/ChannelModel.js";
import User from "../models/UserModel.js"; // Needed to check user existence
import Message from "../models/MessagesModel.js"; // Needed to get channel messages
import mongoose from "mongoose";

const sendErrorResponse = (
  res,
  error,
  message = "Internal Server Error",
  statusCode = 500
) => {
  console.error(error);
  return res.status(statusCode).send(message);
};

// @desc    Create a new channel
// @route   POST /api/channels
// @access  Private
export const createChannel = async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const adminId = req.userId; // Creator is automatically the admin

    if (!name) {
      return res.status(400).send("Channel name is required.");
    }

    // Check if a channel with this name already exists
    const channelExists = await Channel.findOne({ name });
    if (channelExists) {
      return res.status(400).send("A channel with this name already exists.");
    }

    // Create the channel
    const newChannel = new Channel({
      name,
      description: description || "",
      admin: adminId,
      members: [adminId], // Admin is automatically a member
      isPrivate: isPrivate || false,
    });

    await newChannel.save();

    // Optionally populate admin/members for response
    const populatedChannel = await Channel.findById(newChannel._id)
      .populate("admin", "firstName lastName email username image")
      .populate("members", "firstName lastName email username image");

    return res.status(201).json({
      message: "Channel created successfully.",
      channel: populatedChannel,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Error creating channel.");
  }
};

// @desc    Get details of a specific channel
// @route   GET /api/channels/:channelId
// @access  Private (members only for private channels)
export const getChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId)
      .populate("admin", "firstName lastName email username image")
      .populate("members", "firstName lastName email username image");

    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // If channel is private, check if the user is a member
    if (channel.isPrivate) {
      const isMember = channel.members.some(
        (member) => member._id.toString() === userId.toString()
      );
      if (!isMember) {
        return res
          .status(403)
          .send("You are not authorized to access this private channel.");
      }
    }

    return res.status(200).json({ channel });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching channel details.");
  }
};

// @desc    Update channel details
// @route   PUT /api/channels/:channelId
// @access  Private (admin only)
export const updateChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name, description, isPrivate } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Only channel admin can update
    if (channel.admin.toString() !== userId.toString()) {
      return res
        .status(403)
        .send("You are not authorized to update this channel.");
    }

    // Check if new name already exists for another channel
    if (name && name !== channel.name) {
      const nameExists = await Channel.findOne({
        name,
        _id: { $ne: channelId },
      });
      if (nameExists) {
        return res.status(400).send("A channel with this name already exists.");
      }
      channel.name = name;
    }

    if (description !== undefined) channel.description = description;
    if (isPrivate !== undefined) channel.isPrivate = isPrivate;

    await channel.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate("admin", "firstName lastName email username image")
      .populate("members", "firstName lastName email username image");

    return res.status(200).json({
      message: "Channel updated successfully.",
      channel: populatedChannel,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      // Duplicate name error
      return res.status(400).send("A channel with this name already exists.");
    }
    return sendErrorResponse(res, error, "Error updating channel.");
  }
};

// @desc    Delete a channel
// @route   DELETE /api/channels/:channelId
// @access  Private (admin only)
export const deleteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Only channel admin can delete
    if (channel.admin.toString() !== userId.toString()) {
      return res
        .status(403)
        .send("You are not authorized to delete this channel.");
    }

    // Remove all messages associated with this channel
    await Message.deleteMany({ channel: channelId });

    await channel.deleteOne(); // Use deleteOne for Mongoose 6+

    return res
      .status(200)
      .send("Channel and its messages deleted successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting channel.");
  }
};

// @desc    Join a channel
// @route   POST /api/channels/:channelId/join
// @access  Private
export const joinChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Check if already a member
    const isMember = channel.members.some(
      (member) => member.toString() === userId.toString()
    );
    if (isMember) {
      return res.status(200).send("You are already a member of this channel.");
    }

    // For private channels, joining requires an invitation or admin approval.
    // Here we'll only allow joining public channels via this endpoint.
    if (channel.isPrivate) {
      return res
        .status(403)
        .send("This is a private channel. You must be added by an admin.");
    }

    channel.members.push(userId);
    await channel.save();

    return res.status(200).send("Successfully joined the channel.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error joining channel.");
  }
};

// @desc    Leave a channel
// @route   POST /api/channels/:channelId/leave
// @access  Private
export const leaveChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Check if user is the admin (admin cannot leave, must delete or transfer ownership)
    if (channel.admin.toString() === userId.toString()) {
      return res
        .status(403)
        .send(
          "Channel admin cannot leave the channel. Delete it or transfer ownership."
        );
    }

    // Check if user is a member
    const isMember = channel.members.some(
      (member) => member.toString() === userId.toString()
    );
    if (!isMember) {
      return res.status(400).send("You are not a member of this channel.");
    }

    channel.members = channel.members.filter(
      (member) => member.toString() !== userId.toString()
    );
    await channel.save();

    return res.status(200).send("Successfully left the channel.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error leaving channel.");
  }
};

// @desc    Add a member to a channel
// @route   POST /api/channels/:channelId/members
// @access  Private (admin only)
export const addChannelMember = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { newMemberId } = req.body; // The ID of the user to add
    const adminId = req.userId; // The user performing the action

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(newMemberId)
    ) {
      return res.status(400).send("Invalid channel or new member ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Only channel admin can add members
    if (channel.admin.toString() !== adminId.toString()) {
      return res
        .status(403)
        .send("You are not authorized to add members to this channel.");
    }

    // Check if new member exists
    const newMember = await User.findById(newMemberId);
    if (!newMember) {
      return res.status(404).send("New member user not found.");
    }

    // Check if new member is already a member
    const isAlreadyMember = channel.members.some(
      (member) => member.toString() === newMemberId.toString()
    );
    if (isAlreadyMember) {
      return res.status(400).send("User is already a member of this channel.");
    }

    channel.members.push(newMemberId);
    await channel.save();

    return res.status(200).json({
      message: "Member added successfully.",
      channel: channel,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Error adding member to channel.");
  }
};

// @desc    Remove a member from a channel
// @route   DELETE /api/channels/:channelId/members/:memberId
// @access  Private (admin only)
export const removeChannelMember = async (req, res) => {
  try {
    const { channelId, memberId } = req.params;
    const adminId = req.userId; // The user performing the action

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).send("Invalid channel or member ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Only channel admin can remove members
    if (channel.admin.toString() !== adminId.toString()) {
      return res
        .status(403)
        .send("You are not authorized to remove members from this channel.");
    }

    // Prevent admin from removing themselves unless transferring ownership (not implemented here)
    if (channel.admin.toString() === memberId.toString()) {
      return res
        .status(403)
        .send("Cannot remove the channel admin. Transfer ownership first.");
    }

    // Check if member exists in the channel
    const isMember = channel.members.some(
      (m) => m.toString() === memberId.toString()
    );
    if (!isMember) {
      return res.status(400).send("User is not a member of this channel.");
    }

    channel.members = channel.members.filter(
      (m) => m.toString() !== memberId.toString()
    );
    await channel.save();

    return res.status(200).json({
      message: "Member removed successfully.",
      channel: channel,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Error removing member from channel.");
  }
};

// @desc    Get messages for a specific channel
// @route   GET /api/channels/:channelId/messages
// @access  Private (members only)
export const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Ensure user is a member of the channel
    const isMember = channel.members.some(
      (member) => member.toString() === userId.toString()
    );
    if (!isMember) {
      return res
        .status(403)
        .send(
          "You are not a member of this channel and cannot view its messages."
        );
    }

    const messages = await Message.find({ channel: channelId })
      .sort({ timestamp: 1 })
      .populate("sender", "firstName lastName email username image color"); // Populate sender details

    return res.status(200).json({ messages });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching channel messages.");
  }
};

// @desc    Mark all channel messages as read for the current user
// @route   PUT /api/channels/:channelId/messages/read
// @access  Private (members only)
export const markChannelMessagesAsRead = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Ensure user is a member of the channel
    const isMember = channel.members.some(
      (member) => member.toString() === userId.toString()
    );
    if (!isMember) {
      return res
        .status(403)
        .send(
          "You are not a member of this channel and cannot mark messages as read."
        );
    }

    // Update all messages in the channel that have the current user as recipient
    // (though channel messages don't have recipient, we want to mark all as read for the user)
    // This logic relies on 'readBy' array in message model.
    const result = await Message.updateMany(
      {
        channel: channelId,
        sender: { $ne: userId }, // Don't mark your own messages as unread by yourself
        readBy: { $ne: userId }, // Where userId is not already in readBy
      },
      {
        $addToSet: { readBy: userId }, // Add userId to readBy array if not already present
      }
    );

    if (result.modifiedCount > 0) {
      return res
        .status(200)
        .send(`${result.modifiedCount} channel messages marked as read.`);
    } else {
      return res.status(200).send("No new channel messages to mark as read.");
    }
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error marking channel messages as read."
    );
  }
};

// @desc    Get unread message count for a specific channel for the current user
// @route   GET /api/channels/:channelId/unread-count
// @access  Private (members only)
export const getUnreadChannelMessageCount = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).send("Channel not found.");
    }

    // Ensure user is a member of the channel
    const isMember = channel.members.some(
      (member) => member.toString() === userId.toString()
    );
    if (!isMember) {
      return res
        .status(403)
        .send(
          "You are not a member of this channel and cannot view unread count."
        );
    }

    const unreadCount = await Message.countDocuments({
      channel: channelId,
      sender: { $ne: userId }, // Messages sent by others
      readBy: { $ne: userId }, // Not yet read by the current user
    });

    return res.status(200).json({ unreadCount });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error getting unread channel message count."
    );
  }
};