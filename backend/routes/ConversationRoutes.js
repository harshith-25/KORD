import express from "express";
import ConversationController from "../controllers/ConversationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Core conversation routes
router.post("/", ConversationController.getOrCreateConversation);
router.get("/", ConversationController.getUserConversations);
router.get("/:conversationId", ConversationController.getConversationInfo);
router.put("/:conversationId", ConversationController.updateConversation);
router.delete(
  "/:conversationId/archive",
  ConversationController.archiveConversation
);

// Message management
router.post("/:conversationId/messages", ConversationController.sendMessage);
router.get("/:conversationId/messages", ConversationController.getMessages);
router.put("/:conversationId/read", ConversationController.markAsRead);

// Participant management
router.post(
  "/:conversationId/participants",
  ConversationController.addParticipant
);
router.delete(
  "/:conversationId/participants",
  ConversationController.removeParticipant
);

// Backward compatibility routes - redirect to conversation endpoints
router.get("/channels/:channelId/messages", async (req, res, next) => {
  req.params.conversationId = `channel_${req.params.channelId}`;
  return ConversationController.getMessages(req, res, next);
});

router.post("/channels/:channelId/messages", async (req, res, next) => {
  req.params.conversationId = `channel_${req.params.channelId}`;
  return ConversationController.sendMessage(req, res, next);
});

router.get("/direct/:userId/messages", async (req, res, next) => {
  const userIds = [
    req.user._id.toString(),
    req.params.userId.toString(),
  ].sort();
  req.params.conversationId = `direct_${userIds.join("_")}`;
  return ConversationController.getMessages(req, res, next);
});

router.post("/direct/:userId/messages", async (req, res, next) => {
  const userIds = [
    req.user._id.toString(),
    req.params.userId.toString(),
  ].sort();
  req.params.conversationId = `direct_${userIds.join("_")}`;
  return ConversationController.sendMessage(req, res, next);
});

export default router;