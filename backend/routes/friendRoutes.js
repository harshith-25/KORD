// src/routes/friendRoutes.js
import express from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendRequests,
  getFriendsList,
  unfriend,
} from "../controllers/friendController.js"; // Assuming you have a friendController
import { protect } from "../middleware/authMiddleware.js"; // Assuming you have an authentication middleware
import {
  validateSendFriendRequest,
  validateFriendRequestAction,
  validateUnfriend,
} from "../middleware/validationMiddleware.js"; // Assuming you have validation for these actions

const router = express.Router();

// Apply protect middleware to all friend routes to ensure user is authenticated
router.use(protect);

// Route to send a friend request
// Requires validation for the recipient user ID
router.post("/request", validateSendFriendRequest, sendFriendRequest);

// Route to accept a friend request
// Requires validation for the request ID
router.patch(
  "/request/accept/:id",
  validateFriendRequestAction,
  acceptFriendRequest
);

// Route to reject a friend request
// Requires validation for the request ID
router.patch(
  "/request/reject/:id",
  validateFriendRequestAction,
  rejectFriendRequest
);

// Route to cancel an outgoing friend request
// Requires validation for the request ID
router.patch(
  "/request/cancel/:id",
  validateFriendRequestAction,
  cancelFriendRequest
);

// Route to get all pending friend requests (incoming or outgoing)
router.get("/requests", getFriendRequests);

// Route to get the current user's list of friends
router.get("/list", getFriendsList);

// Route to unfriend a user
// Requires validation for the friend's user ID
router.delete("/unfriend/:id", validateUnfriend, unfriend);

// Export the router as a default export
export default router;