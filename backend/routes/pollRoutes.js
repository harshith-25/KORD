import express from "express";
import {
  createPoll,
  voteOnPoll,
  getPollDetails,
  closePoll,
  deletePoll,
} from "../controllers/PollController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, createPoll); // Create a new poll
router.post("/:pollId/vote", verifyToken, voteOnPoll); // Vote on a poll
router.get("/:pollId", verifyToken, getPollDetails); // Get poll details and results
router.put("/:pollId/close", verifyToken, closePoll); // Close a poll
router.delete("/:pollId", verifyToken, deletePoll); // Delete a poll

export default router;