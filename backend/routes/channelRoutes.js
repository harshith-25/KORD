import express from "express";
import {
  createChannel,
  getChannelDetails,
  updateChannelDetails,
  deleteChannel,
  joinChannel,
  leaveChannel,
  addChannelMember, // NOW CORRECTLY REFERENCED
  removeChannelMember,
  getChannelMessages,
  markChannelMessagesAsRead,
  getUnreadChannelMessageCount,
} from "../controllers/ChannelController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- Channel Management ---
router.post("/", verifyToken, createChannel); // Create a new channel
router.get("/:channelId", verifyToken, getChannelDetails); // Get details of a specific channel
router.put("/:channelId", verifyToken, updateChannelDetails); // Update channel details (admin/creator only)
router.delete("/:channelId", verifyToken, deleteChannel); // Delete a channel (admin/creator only)

// --- Membership Management ---
router.post("/:channelId/join", verifyToken, joinChannel); // Join a public channel
router.post("/:channelId/leave", verifyToken, leaveChannel); // Leave a channel
router.post("/:channelId/members", verifyToken, addChannelMember); // Add member to channel (admin only)
router.delete(
  "/:channelId/members/:memberId",
  verifyToken,
  removeChannelMember
); // Remove member from channel (admin only)

// --- Channel Messages ---
router.get("/:channelId/messages", verifyToken, getChannelMessages); // Get messages for a channel
router.put("/:channelId/messages/read", verifyToken, markChannelMessagesAsRead); // Mark all channel messages as read for user
router.get(
  "/:channelId/unread-count",
  verifyToken,
  getUnreadChannelMessageCount
); // Get unread messages count for a channel

export default router;