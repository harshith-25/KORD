import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  blockUser,
  unblockUser,
  deleteUser,
  getAllChannels,
  deleteChannel as adminDeleteChannel, // Correctly renamed import
} from "../controllers/AdminController.js";
import { verifyToken, authorizeAdmin } from "../middleware/authMiddleware.js"; // Requires admin authorization

const router = express.Router();

// All routes in this file should be protected by verifyToken and authorizeAdmin
router.use(verifyToken);
router.use(authorizeAdmin);

// --- User Management ---
router.get("/users", getAllUsers); // Get all users
router.get("/users/:userId", getUserById); // Get specific user by ID
router.put("/users/:userId/role", updateUserRole); // Update user's role
router.put("/users/:userId/block", blockUser); // Block a user
router.put("/users/:userId/unblock", unblockUser); // Unblock a user
router.delete("/users/:userId", deleteUser); // Delete a user

// --- Channel Management ---
router.get("/channels", getAllChannels); // Get all channels
router.delete("/channels/:channelId", adminDeleteChannel); // Delete a channel

export default router;