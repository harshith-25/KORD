import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getOrCreateDirectConversation,
  createGroupOrChannel,
  getUserConversations,
  getConversationById,
  updateConversationInfo,
  joinConversation,
  addMember,
  removeMember,
  leaveConversation,
  getPublicConversations,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
  updateMemberPermissions,
  toggleMuteMember,
  deleteConversation,
} from "../controllers/ConversationController.js";

const router = Router();

// =========================================================================
// PUBLIC ROUTES (No authentication required)
// =========================================================================
router.get("/public", getPublicConversations);

// =========================================================================
// PROTECTED ROUTES (Require authentication)
// =========================================================================
router.use(verifyToken);

// Base route: /api/conversations

// Conversation CRUD
router.get("/", getUserConversations); // Get all user's conversations
router.get("/:conversationId", getConversationById); // Get single conversation
router.post("/direct", getOrCreateDirectConversation); // Create/get direct conversation
router.post("/", createGroupOrChannel); // Create group or channel
router.put("/:conversationId", updateConversationInfo); // Update conversation info
router.delete("/:conversationId", deleteConversation); // Delete conversation (soft delete)

// Membership Management
router.post("/:conversationId/join", joinConversation); // Join public conversation
router.post("/:conversationId/leave", leaveConversation); // Leave conversation
router.post("/:conversationId/add", addMember); // Add member to conversation
router.delete("/:conversationId/members/:userId", removeMember); // Remove member

// Join Request Management (for approval-required conversations)
router.post(
  "/:conversationId/join-requests/:userId/approve",
  approveJoinRequest
); // Approve join request
router.delete("/:conversationId/join-requests/:userId", rejectJoinRequest); // Reject join request

// Member Role & Permissions
router.patch("/:conversationId/members/:userId/role", updateMemberRole); // Update member role
router.patch(
  "/:conversationId/members/:userId/permissions",
  updateMemberPermissions
); // Update member permissions
router.patch("/:conversationId/members/:userId/mute", toggleMuteMember); // Mute/unmute member

export default router;