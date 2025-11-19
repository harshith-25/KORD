import express from "express";
import {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  forwardMessage,
  searchMessages,
  getMessageInfo,
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

// Search messages - must come before /:conversationId to avoid route conflicts
router.get("/search", validateSearchMessages, searchMessages);

// Send a new message (text or file)
// Use upload.single('file') for a single file upload, 'file' is the field name in the form data
router.post(
  "/send",
  upload.single("file"), // This will now correctly access 'upload'
  validateSendMessage,
  sendMessage
);

// Get detailed message info (read/delivery receipts) - must come before /:conversationId
router.get("/:messageId/info", validateMessageId, getMessageInfo);

// Get messages for a specific direct chat or channel (now with pagination/search)
router.get("/:conversationId", getMessages);

// Message Management Enhancements
router.put(
  "/:messageId",
  upload.single("file"),
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

export default router;

// import express from 'express';
// import {
//     sendMessage,
//     getMessages,
//     editMessage,
//     deleteMessage,
//     addReaction,
//     removeReaction,
//     forwardMessage,
//     searchMessages
// } from '../controllers/messageController.js';

// import { protect } from '../middleware/authMiddleware.js'; // Your authentication middleware
// import upload from '../middleware/multerMiddleware.js'; // Your multer middleware

// const router = express.Router();

// // The upload middleware needs to run before the controller
// router.post('/', protect, upload.single('file'), sendMessage);
// router.get('/:conversationId', protect, getMessages);
// router.put('/:messageId', protect, editMessage);
// router.delete('/:messageId', protect, deleteMessage);
// router.post('/:messageId/react', protect, addReaction);
// router.delete('/:messageId/react', protect, removeReaction);
// router.post('/:messageId/forward', protect, forwardMessage);
// router.get('/search', protect, searchMessages);

// export default router;
