import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  deleteProfileImage,
  changePassword,
  deleteAccount,
} from "../controllers/AuthController.js";
import {
  updateUserStatus,
  getUserStatus,
  getMultipleUsersStatus,
  startSharingLiveLocation,
  stopSharingLiveLocation,
  getLiveLocationStatusAndLastKnown,
} from "../controllers/UserStatusController.js";
import {
  searchContacts,
  getContactsForDMList,
  getAllContacts,
  initiateDirectMessage,
} from "../controllers/ContactController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js"; // For profile image uploads

const router = express.Router();

// --- Profile Management ---
router.get("/:userId", verifyToken, getUserProfile); // Get a user's profile by ID
router.put("/", verifyToken, updateUserProfile); // Update current user's profile
router.post(
  "/profile-image",
  verifyToken,
  upload.single("profileImage"),
  updateProfileImage
);
router.delete("/profile-image", verifyToken, deleteProfileImage);
router.put("/change-password", verifyToken, changePassword);
router.delete("/delete-account", verifyToken, deleteAccount);

// --- Contact/User Management ---
router.post("/search-contacts", verifyToken, searchContacts); // Your existing route
router.get("/contacts/dm-list", verifyToken, getContactsForDMList); // Your existing route
router.get("/all-contacts", verifyToken, getAllContacts); // Your existing route

// --- NEW ROUTE FOR DM INITIATION ---
router.post("/initiate-dm", verifyToken, initiateDirectMessage);


// --- User Status & Live Location ---
router.put("/status", verifyToken, updateUserStatus); // Set user's online/away/etc. status
router.get("/status/:userId", verifyToken, getUserStatus); // Get status of a specific user
router.post("/status/multiple", verifyToken, getMultipleUsersStatus); // Get status of multiple users
router.post("/live-location/start", verifyToken, startSharingLiveLocation); // Start live location
router.post("/live-location/stop", verifyToken, stopSharingLiveLocation); // Stop live location
router.get(
  "/live-location/:targetUserId",
  verifyToken,
  getLiveLocationStatusAndLastKnown
);

export default router;
