import express from "express";
import {
  createWhiteboardSession,
  getWhiteboardSession,
  endWhiteboardSession,
} from "../controllers/WhiteboardController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, createWhiteboardSession); // Create a new whiteboard session
router.get("/:sessionId", verifyToken, getWhiteboardSession); // Get details of a whiteboard session
router.put("/:sessionId/end", verifyToken, endWhiteboardSession); // End a whiteboard session

export default router;