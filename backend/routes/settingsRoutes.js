import express from "express";
import {
  getUserSettings, // Now correctly imported
  updateUserSettings, // Now correctly imported
} from "../controllers/SettingsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All settings routes require authentication
router.use(verifyToken);

// Get user settings
router.get("/", getUserSettings);

// Update user settings
router.put("/", updateUserSettings);

export default router;