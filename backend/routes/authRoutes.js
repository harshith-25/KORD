import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  setupProfile,
  logoutUser,
} from "../controllers/AuthController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", verifyToken, logoutUser); // Requires authentication to log out
router.get("/me", verifyToken, getMe); // Get current user's details
router.post("/setup-profile", verifyToken, setupProfile); // For initial profile setup

export default router;