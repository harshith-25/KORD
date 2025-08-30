// middleware/validationMiddleware.js
import mongoose from "mongoose";
import { body, param, query } from "express-validator";
import { BadRequestError } from './errorHandler.js'; // Path relative to validationMiddleware.js

// --- Reusable Validation Chains ---

// User-related validations
export const validateRegister = [
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters."),
  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters."),
  body("email")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain at least one special character"),
];

export const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const validateUpdateProfile = [
  body("firstName")
    .optional()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters."),
  body("lastName")
    .optional()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters."),
  body("username")
    .optional()
    .notEmpty()
    .withMessage("Username cannot be empty")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters.")
    .isAlphanumeric()
    .withMessage("Username must be alphanumeric."),
  body("bio")
    .optional()
    .isString()
    .withMessage("Bio must be a string")
    .isLength({ max: 500 })
    .withMessage("Bio cannot exceed 500 characters."),
  body("image").optional().isURL().withMessage("Image must be a valid URL."), // If storing URLs directly
  body("color")
    .optional()
    .matches(/^#[0-9a-fA-F]{6}$/)
    .withMessage("Color must be a valid hex code (e.g., #RRGGBB)."),
];

export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("New password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("New password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("New password must contain at least one number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("New password must contain at least one special character"),
  body("confirmNewPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("New password and confirmation do not match.");
    }
    return true;
  }),
];

// Friend System Validations
export const validateFriendId = [
  param("recipientId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid recipient ID format."),
  param("senderId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid sender ID format."),
  param("friendId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid friend ID format."),
  param("userIdToBlock")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid user ID to block format."),
  param("userIdToUnblock")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid user ID to unblock format."),
];

// Message Validations
export const validateMessageId = [
  param("messageId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid message ID format."),
];

export const validateSendMessage = [
  // Either recipientId or channelId must be present
  body("recipientId")
    .optional()
    .custom((value, { req }) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid recipient ID format.");
      }
      return true;
    }),
  body("channelId")
    .optional()
    .custom((value, { req }) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid channel ID format.");
      }
      return true;
    }),
  body().custom((value, { req }) => {
    if (!req.body.recipientId && !req.body.channelId) {
      throw new Error("Either recipientId or channelId must be provided.");
    }
    return true;
  }),
  // Content or file must be present
  body("content")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Message content must be between 1 and 2000 characters."),
  body().custom((value, { req }) => {
    // If no file is uploaded, content is mandatory.
    // If a file is uploaded, content is optional (e.g., just sending an image).
    if (!req.file && (!req.body.content || req.body.content.trim() === "")) {
      throw new Error("Message content is required if no file is uploaded.");
    }
    return true;
  }),
  body("type")
    .optional()
    .isIn([
      "text",
      "image",
      "video",
      "audio",
      "file",
      "location",
      "contact",
      "sticker",
      "gif",
    ])
    .withMessage("Invalid message type."),
];

export const validateEditMessage = [
  body("newContent")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("New message content must be between 1 and 2000 characters."),
  body("newType")
    .optional()
    .isIn([
      "text",
      "image",
      "video",
      "audio",
      "file",
      "location",
      "contact",
      "sticker",
      "gif",
    ])
    .withMessage("Invalid new message type."),
  body().custom((value, { req }) => {
    // Either newContent or a new file must be provided for edit
    if (!req.body.newContent && !req.file) {
      throw new Error(
        "New content or a new file is required to edit the message."
      );
    }
    return true;
  }),
];

export const validateDeleteMessage = [
  query("deleteFor")
    .isIn(["me", "everyone"])
    .withMessage('deleteFor must be "me" or "everyone".'),
];

export const validateAddReaction = [
  body("emoji")
    .notEmpty()
    .withMessage("Emoji is required")
    .isString()
    .isLength({ max: 10 })
    .withMessage("Emoji too long."),
];

export const validateRemoveReaction = [
  param("emoji").notEmpty().withMessage("Emoji is required to remove."),
];

export const validateForwardMessage = [
  body("targetIds")
    .isArray({ min: 1 })
    .withMessage("At least one target ID is required.")
    .custom((value) => value.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage("All target IDs must be valid MongoDB ObjectIds."),
  body("targetType")
    .isIn(["direct", "channel"])
    .withMessage('Target type must be "direct" or "channel".'),
];

export const validateSearchMessages = [
  query("query").notEmpty().withMessage("Search query cannot be empty.").trim(),
  query("type")
    .isIn(["direct", "channel"])
    .withMessage('Search type must be "direct" or "channel".'),
  query("id")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid ID for specific chat/channel search."),
  query("page")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("Page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ gt: 0, lt: 101 })
    .withMessage("Limit must be a positive integer up to 100."),
];

// Channel Validations
export const validateChannelId = [
  param("channelId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid channel ID format."),
];

export const validateCreateChannel = [
  body("name")
    .notEmpty()
    .withMessage("Channel name is required")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Channel name must be between 3 and 50 characters."),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters."),
  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean."),
  body("members")
    .optional()
    .isArray()
    .custom((value) => value.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage("All member IDs must be valid MongoDB ObjectIds."),
];

export const validateUpdateChannel = [
  body("name")
    .optional()
    .notEmpty()
    .withMessage("Channel name cannot be empty")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Channel name must be between 3 and 50 characters."),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters."),
  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean."),
];

export const validateManageChannelMembers = [
  body("userId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid user ID format."),
];

// Admin Validations
export const validateAdminAction = [
  param("userId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid user ID format."),
];

export const validateSetUserRole = [
  body("role")
    .isIn(["user", "admin"])
    .withMessage('Role must be "user" or "admin".'),
];

// Settings Validations
export const validateUpdateSettings = [
  body("privacy.lastSeen")
    .optional()
    .isIn(["everyone", "my_contacts", "nobody"])
    .withMessage("Invalid last seen setting."),
  body("privacy.profilePhoto")
    .optional()
    .isIn(["everyone", "my_contacts", "nobody"])
    .withMessage("Invalid profile photo setting."),
  body("privacy.aboutInfo")
    .optional()
    .isIn(["everyone", "my_contacts", "nobody"])
    .withMessage("Invalid about info setting."),
  body("privacy.readReceipts")
    .optional()
    .isBoolean()
    .withMessage("Read receipts setting must be a boolean."),
  body("notifications.messageAlerts")
    .optional()
    .isBoolean()
    .withMessage("Message alerts setting must be a boolean."),
  body("notifications.channelAlerts")
    .optional()
    .isBoolean()
    .withMessage("Channel alerts setting must be a boolean."),
  body("notifications.sound")
    .optional()
    .isBoolean()
    .withMessage("Sound setting must be a boolean."),
  body("theme.darkMode")
    .optional()
    .isBoolean()
    .withMessage("Dark mode setting must be a boolean."),
  body("chatPreferences.enterToSend")
    .optional()
    .isBoolean()
    .withMessage("Enter to send setting must be a boolean."),
  body("chatPreferences.fontSize")
    .optional()
    .isIn(["small", "medium", "large"])
    .withMessage("Invalid font size."),
];

// Poll Validations
export const validateCreatePoll = [
  body("question")
    .notEmpty()
    .withMessage("Poll question is required")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Question must be between 5 and 200 characters."),
  body("options")
    .isArray({ min: 2, max: 10 })
    .withMessage("A poll must have between 2 and 10 options."),
  body("options.*.text")
    .notEmpty()
    .withMessage("Option text cannot be empty")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Option text must be between 1 and 100 characters."),
  body("channelId")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid channel ID for poll."),
  body("privateMessageToId")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid private message recipient ID for poll."),
  body("expiresAt")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid expiry date format.")
    .custom((value, { req }) => {
      if (value && value <= new Date()) {
        throw new Error("Expiry date must be in the future.");
      }
      return true;
    }),
];

export const validateVotePoll = [
  param("pollId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid poll ID format."),
  body("optionId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid option ID format."),
];

// Whiteboard Validations (Basic)
export const validateCreateWhiteboard = [
  body("name")
    .notEmpty()
    .withMessage("Whiteboard name is required")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be between 3 and 100 characters."),
  body("channelId")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid channel ID for whiteboard."),
  body("privateMessageToId")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid private message recipient ID for whiteboard."),
];

export const validateWhiteboardId = [
  param("whiteboardId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid whiteboard ID format."),
];

export const validateShareWhiteboard = [
  body("userId")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid user ID."),
  body("accessLevel")
    .isIn(["viewer", "editor"])
    .withMessage("Access level must be viewer or editor."),
];

// src/middleware/validationMiddleware.js

// Middleware to validate if an ID is a valid MongoDB ObjectId
export const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new BadRequestError(`Invalid ID format for ${paramName}.`));
  }
  next();
};

// Validation for sending a friend request
export const validateSendFriendRequest = (req, res, next) => {
  const { recipientId } = req.body;
  if (!recipientId) {
    return next(new BadRequestError('Recipient ID is required to send a friend request.'));
  }
  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    return next(new BadRequestError('Invalid recipient ID format.'));
  }
  next();
};

// Re-usable validation for friend request actions (accept, reject, cancel)
export const validateFriendRequestAction = validateObjectId('id');

// Re-usable validation for unfriending
export const validateUnfriend = validateObjectId('id');