import express from "express";
import {
  sendMessage, // <-- NEWLY UPDATED
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  forwardMessage,
  searchMessages,
} from "../controllers/MessageController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  validateMessageId,
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
  validateAddReaction,
  validateRemoveReaction,
  validateForwardMessage,
  validateSearchMessages,
} from "../middleware/validationMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js"; // <--- UPDATED IMPORT PATH

const router = express.Router();

router.use(verifyToken);
// Send a new message (text or file)
// Use upload.single('file') for a single file upload, 'file' is the field name in the form data
router.post(
  "/send",
  upload.single("file"), // This will now correctly access 'upload'
  validateSendMessage,
  sendMessage
);

// Get messages for a specific direct chat or channel (now with pagination/search)
router.get("/:id", getMessages);

// Message Management Enhancements
router.put(
  "/:messageId",
  upload.single("file"), // This will now correctly access 'upload'
  validateMessageId,
  validateEditMessage,
  editMessage
);

router.delete(
  "/:messageId",
  validateMessageId,
  validateDeleteMessage,
  deleteMessage
);

router.post(
  "/:messageId/react",
  validateMessageId,
  validateAddReaction,
  addReaction
);
router.delete(
  "/:messageId/react/:emoji",
  validateMessageId,
  validateRemoveReaction,
  removeReaction
);

router.post(
  "/:messageId/forward",
  validateMessageId,
  validateForwardMessage,
  forwardMessage
);

router.get("/search", validateSearchMessages, searchMessages);

export default router;
