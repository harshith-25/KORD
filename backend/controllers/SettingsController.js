import User from "../models/UserModel.js"; // Assuming user model also stores settings directly or has a settings sub-document
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

// @desc    Get user's settings
// @route   GET /api/settings
// @access  Private
export const getUserSettings = async (req, res) => {
  try {
    const userId = req.userId; // From verifyToken middleware

    const user = await User.findById(userId).select("settings"); // Select only the settings field
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // If settings is a subdocument or embedded object, it will be returned
    // If you define a separate SettingsModel, you'd populate it here.
    return res.status(200).json({ settings: user.settings });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching user settings.");
  }
};

// @desc    Update user's settings
// @route   PUT /api/settings
// @access  Private
export const updateUserSettings = async (req, res) => {
  try {
    const userId = req.userId; // From verifyToken middleware
    const updates = req.body; // Expecting an object with settings to update

    // Basic validation: ensure updates is an object and not empty
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).send("No settings provided for update.");
    }

    // Define allowed settings fields to prevent arbitrary updates
    const allowedSettingsFields = [
      "privacy.lastSeen", // e.g., 'everyone', 'my_contacts', 'nobody'
      "privacy.profilePhoto", // e.g., 'everyone', 'my_contacts', 'nobody'
      "privacy.aboutInfo", // e.g., 'everyone', 'my_contacts', 'nobody'
      "privacy.readReceipts", // boolean
      "notifications.messageAlerts", // boolean
      "notifications.channelAlerts", // boolean
      "notifications.sound", // boolean
      "theme.darkMode", // boolean
      "chatPreferences.enterToSend", // boolean
      "chatPreferences.fontSize", // string e.g., 'small', 'medium', 'large'
      // Add more settings fields as your application grows
    ];

    const updateObject = {};
    for (const key in updates) {
      if (allowedSettingsFields.includes(key)) {
        updateObject[`settings.${key}`] = updates[key];
      } else {
        // Optionally, warn or reject if unknown fields are sent
        console.warn(`Attempted to update unknown settings field: ${key}`);
      }
    }

    if (Object.keys(updateObject).length === 0) {
      return res
        .status(400)
        .send("No valid settings fields provided for update.");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateObject }, // Use $set to update specific fields within the settings object
      { new: true, runValidators: true } // Return the updated document and run schema validators
    ).select("settings"); // Only return the updated settings

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.status(200).json({
      message: "Settings updated successfully.",
      settings: user.settings,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Error updating user settings.");
  }
};