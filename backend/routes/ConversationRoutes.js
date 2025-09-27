import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getOrCreateDirectConversation,
  createGroupOrChannel,
  getUserConversations,
  getConversationById,
  updateConversationInfo,
  joinConversation,
  addMember,
  removeMember, // Don't forget to import the new function
  leaveConversation,
  getPublicConversations,
} from "../controllers/ConversationController.js";

const router = express.Router();

// Public routes
router.get("/public", getPublicConversations);

// Private routes (require authentication)
router.use(verifyToken);

router.get("/", getUserConversations);
router.get("/:conversationId", getConversationById);
router.post("/direct", getOrCreateDirectConversation);
router.post("/", createGroupOrChannel);
router.put("/:conversationId", updateConversationInfo);
router.post("/:conversationId/join", joinConversation);
router.post("/:conversationId/add", addMember);
router.post("/:conversationId/leave", leaveConversation);
router.delete("/:conversationId/members/:userId", removeMember);

export default router;
