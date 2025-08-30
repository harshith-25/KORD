import User from "../models/UserModel.js";
import mongoose from "mongoose";

// Helper function for consistent error responses
const sendErrorResponse = (
  res,
  error,
  message = "Internal Server Error",
  statusCode = 500
) => {
  console.error(error); // Log the full error for debugging
  return res.status(statusCode).send(message);
};

export const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body; // e.g., 'online', 'away', 'offline', 'busy'
    const userId = req.userId;

    if (
      !status ||
      typeof status !== "string" ||
      !["online", "away", "offline", "busy"].includes(status.toLowerCase())
    ) {
      return res
        .status(400)
        .send(
          "Invalid or missing status. Valid statuses: online, away, offline, busy."
        );
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status: status.toLowerCase(), lastOnline: new Date() }, // Update lastOnline when status changes
      { new: true }
    );

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res
      .status(200)
      .json({ status: user.status, lastOnline: user.lastOnline });
  } catch (error) {
    return sendErrorResponse(res, error, "Error updating user status.");
  }
};

export const getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params; // ID of the user whose status is being queried

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user ID format.");
    }

    const user = await User.findById(userId, "status lastOnline"); // Fetch only status and lastOnline
    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res
      .status(200)
      .json({ status: user.status, lastOnline: user.lastOnline });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching user status.");
  }
};

export const getMultipleUsersStatus = async (req, res) => {
  try {
    const { userIds } = req.body; // Array of user IDs

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).send("Array of user IDs is required.");
    }

    const validUserIds = userIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validUserIds.length !== userIds.length) {
      return res.status(400).send("One or more provided user IDs are invalid.");
    }

    const usersStatus = await User.find(
      { _id: { $in: validUserIds } },
      "firstName lastName email status lastOnline image color"
    );

    return res.status(200).json({ usersStatus });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error fetching multiple users' status."
    );
  }
};

/**
 * @description Initiates live location sharing.
 * IMPORTANT: This endpoint only signals intent. The continuous real-time updates
 * MUST be handled by a WebSocket (Socket.IO) connection from the client.
 */
export const startSharingLiveLocation = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      durationMinutes = 60,
      currentLatitude,
      currentLongitude,
    } = req.body; // Default 60 mins

    if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
      return res.status(400).send("Valid duration in minutes is required.");
    }
    if (
      typeof currentLatitude !== "number" ||
      typeof currentLongitude !== "number"
    ) {
      return res
        .status(400)
        .send("Current latitude and longitude are required to start sharing.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Set a flag or store session info in the user model indicating live location sharing
    user.isSharingLiveLocation = true;
    user.liveLocationExpiresAt = new Date(
      Date.now() + durationMinutes * 60 * 1000
    );
    // You might also want to store the initial location
    user.currentLocation = {
      latitude: currentLatitude,
      longitude: currentLongitude,
      timestamp: new Date(),
    };
    await user.save();

    // After this, the client (via Socket.IO) should start sending location updates
    // io.to(userId).emit('liveLocationSharingStarted', { userId, expiresAt: user.liveLocationExpiresAt });

    return res.status(200).json({
      message:
        "Live location sharing initiated. Client must now send updates via WebSocket.",
      isSharing: user.isSharingLiveLocation,
      expiresAt: user.liveLocationExpiresAt,
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error initiating live location sharing."
    );
  }
};

/**
 * @description Terminates live location sharing.
 * IMPORTANT: This endpoint only signals intent. The client's WebSocket connection
 * should stop sending location updates upon receiving a confirmation or explicit instruction.
 */
export const stopSharingLiveLocation = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    if (!user.isSharingLiveLocation) {
      return res
        .status(200)
        .send("Live location sharing is not active for this user.");
    }

    user.isSharingLiveLocation = false;
    user.liveLocationExpiresAt = null;
    user.currentLocation = null; // Clear current location
    await user.save();

    // After this, the client (via Socket.IO) should stop sending location updates
    // io.to(userId).emit('liveLocationSharingStopped', { userId });

    return res.status(200).json({
      message: "Live location sharing stopped.",
      isSharing: user.isSharingLiveLocation,
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error stopping live location sharing."
    );
  }
};

// New: Get a user's *current* static location (if they are sharing it)
// This is for fetching the last known location, not a real-time stream.
// Access control might be needed here (e.g., only if they are in a chat together).
export const getLiveLocationStatusAndLastKnown = async (req, res) => {
  try {
    const { targetUserId } = req.params; // The ID of the user whose location is being queried
    const requesterId = req.userId; // The current authenticated user

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).send("Invalid target user ID format.");
    }

    const targetUser = await User.findById(
      targetUserId,
      "isSharingLiveLocation liveLocationExpiresAt currentLocation"
    );
    if (!targetUser) {
      return res.status(404).send("Target user not found.");
    }

    // Basic privacy: only allow sharing if user is sharing and it's not expired.
    // You might add more sophisticated checks here, e.g., if requesterId and targetUserId
    // are in a direct chat, or in a shared channel, or if privacy settings allow.
    const isActive =
      targetUser.isSharingLiveLocation &&
      (!targetUser.liveLocationExpiresAt ||
        targetUser.liveLocationExpiresAt > new Date());

    if (isActive) {
      return res.status(200).json({
        userId: targetUser._id,
        isSharing: true,
        expiresAt: targetUser.liveLocationExpiresAt,
        currentLocation: targetUser.currentLocation, // Last reported location
        message: "User is currently sharing live location.",
      });
    } else {
      return res.status(200).json({
        userId: targetUser._id,
        isSharing: false,
        message:
          "User is not currently sharing live location or sharing has expired.",
      });
    }
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Error fetching live location status."
    );
  }
};