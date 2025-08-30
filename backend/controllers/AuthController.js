import User from "../models/UserModel.js";
import jwt from "jsonwebtoken";
import { unlinkSync, existsSync } from "fs";
import path from "path";

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

// Generate JWT Token
const generateToken = (id) => {
  console.log("🔐 JWT_SECRET when creating token:", JSON.stringify(process.env.JWT_SECRET));
  return jwt.sign({ id: id }, process.env.JWT_SECRET.trim(), {
    expiresIn: "30d",
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Basic validation
    if (!email || !password || !firstName || !lastName) {
      return res
        .status(400)
        .send(
          "Please enter all required fields: email, password, first name, and last name."
        );
    }
    if (password.length < 6) {
      return res
        .status(400)
        .send("Password must be at least 6 characters long.");
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).send("User with this email already exists.");
    }

    // Create user
    const user = await User.create({
      email,
      password, // Password hashing happens in the User model's pre-save hook
      firstName,
      lastName,
      username: email.split("@")[0], // Default username from email prefix
    });

    if (user) {
      return res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        profileSetup: user.profileSetup,
        token: generateToken(user._id),
      });
    } else {
      return res.status(400).send("Invalid user data provided.");
    }
  } catch (error) {
    return sendErrorResponse(res, error, "Registration failed.");
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).send("Please enter email and password.");
    }

    // Check for user by email
    const user = await User.findOne({ email });

    // Check password
    if (user && (await user.comparePassword(password))) {
      // Update status to online upon successful login
      user.status = "online";
      user.lastOnline = new Date();
      await user.save();

      return res.status(200).json({
        token: generateToken(user._id), // Token at the top level
        user: {
          // <--- ***NESTED USER OBJECT HERE***
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username,
          image: user.image,
          color: user.color,
          bio: user.bio,
          profileSetup: user.profileSetup,
          status: user.status,
          lastOnline: user.lastOnline,
        },
      });
    } else {
      return res.status(401).send("Invalid email or password.");
    }
  } catch (error) {
    return sendErrorResponse(res, error, "Login failed.");
  }
};

// @desc    Log out user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    user.status = "offline";
    user.lastOnline = new Date(); // Update last online timestamp
    await user.save();

    // In a real application, you might invalidate the token on the server-side
    // (e.g., add to a blacklist), but for JWTs, usually rely on client-side deletion.
    return res.status(200).send("Logged out successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error logging out.");
  }
};

// @desc    Get current logged in user's details
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    // req.user is populated by the verifyToken middleware
    if (!req.user) {
      return res.status(404).send("User not found or not authenticated.");
    }

    // Return the user object (excluding sensitive data like password)
    const user = req.user.toObject(); // Convert Mongoose document to plain JS object
    delete user.password; // Ensure password is not sent
    delete user.__v; // Remove Mongoose version key

    return res.status(200).json(user);
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching user details.");
  }
};

// @desc    Complete initial profile setup (username, image, color, bio)
// @route   POST /api/auth/setup-profile
// @access  Private
export const setupProfile = async (req, res) => {
  try {
    const { username, image, color, bio } = req.body;
    const userId = req.userId;

    if (!username || !image || !color) {
      return res
        .status(400)
        .send("Username, profile image, and color are required for setup.");
    }

    // Check if username is already taken
    const usernameExists = await User.findOne({
      username,
      _id: { $ne: userId },
    });
    if (usernameExists) {
      return res.status(400).send("This username is already taken.");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        username,
        image,
        color,
        bio: bio || "",
        profileSetup: true,
      },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    ).select("-password"); // Exclude password from the response

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.status(200).json({
      message: "Profile setup complete.",
      user: user,
    });
  } catch (error) {
    // Check for duplicate key error for username specifically
    if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).send("This username is already taken.");
    }
    return sendErrorResponse(res, error, "Error completing profile setup.");
  }
};

// @desc    Get a user's public profile details
// @route   GET /api/users/:userId
// @access  Private (accessible to logged-in users)
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password"); // Exclude sensitive info
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // You might want to implement privacy settings here
    // e.g., if user.settings.privacy.profileVisibility is 'contacts' and req.userId is not a contact
    // then return limited info or a permission error.

    return res.status(200).json(user);
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching user profile.");
  }
};

// @desc    Update current user's profile details
// @route   PUT /api/users
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { firstName, lastName, username, bio, color } = req.body;

    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (username) {
      // Check for username uniqueness if it's being updated
      const usernameExists = await User.findOne({
        username,
        _id: { $ne: userId },
      });
      if (usernameExists) {
        return res.status(400).send("This username is already taken.");
      }
      updateFields.username = username;
    }
    if (bio !== undefined) updateFields.bio = bio; // Allow empty string for bio
    if (color) updateFields.color = color;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res
      .status(200)
      .json({ message: "Profile updated successfully.", user });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).send("This username is already taken.");
    }
    return sendErrorResponse(res, error, "Error updating profile.");
  }
};

// @desc    Upload/update user's profile image
// @route   POST /api/users/profile-image
// @access  Private
export const updateProfileImage = async (req, res) => {
  try {
    const userId = req.userId;
    if (!req.file) {
      return res.status(400).send("No image file uploaded.");
    }

    const user = await User.findById(userId);
    if (!user) {
      // Clean up uploaded file if user not found
      unlinkSync(req.file.path);
      return res.status(404).send("User not found.");
    }

    // Delete old profile image if it exists and is not a default/placeholder
    if (user.image && user.image.startsWith("uploads/")) {
      // Only delete if it's a locally stored upload
      const oldImagePath = path.join(process.cwd(), user.image);
      if (existsSync(oldImagePath)) {
        unlinkSync(oldImagePath);
      }
    }

    // Assuming req.file.path from multer is the new image path
    // Multer stores in a 'temp' folder, you might want to move it to a permanent 'profile_images' folder.
    // For now, let's assume `req.file.path` is the final accessible path.
    // Ensure `FILE_UPLOAD_DIR` from .env is used consistently.
    const newImagePath = req.file.path.replace(/\\/g, "/"); // Normalize path for URL

    user.image = newImagePath;
    await user.save();

    return res.status(200).json({
      message: "Profile image updated successfully.",
      image: user.image,
    });
  } catch (error) {
    // Clean up temporary file if any error occurs after upload but before DB save
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    return sendErrorResponse(res, error, "Error updating profile image.");
  }
};

// @desc    Delete user's profile image
// @route   DELETE /api/users/profile-image
// @access  Private
export const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Only delete if it's a custom uploaded image and not a default or remote URL
    if (user.image && user.image.startsWith("uploads/")) {
      const imagePath = path.join(process.cwd(), user.image);
      if (existsSync(imagePath)) {
        unlinkSync(imagePath);
      }
      user.image = null; // Set image to null or a default placeholder
      await user.save();
      return res.status(200).send("Profile image deleted successfully.");
    } else if (user.image) {
      return res
        .status(400)
        .send("No custom uploaded profile image to delete.");
    } else {
      return res.status(200).send("No profile image to delete.");
    }
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting profile image.");
  }
};

// @desc    Change user's password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .send("Both current and new passwords are required.");
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .send("New password must be at least 6 characters long.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Verify current password
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).send("Incorrect current password.");
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    return res.status(200).send("Password changed successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error changing password.");
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/delete-account
// @access  Private
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;

    // Optional: Re-authenticate user before deletion for security
    // const { password } = req.body;
    // const user = await User.findById(userId);
    // if (!user || !(await user.comparePassword(password))) {
    //   return res.status(401).send("Authentication required to delete account.");
    // }

    // Find and delete the user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // TODO: Implement cascading deletions for:
    // - All messages sent/received by this user
    // - Remove user from channels/groups
    // - Delete user's profile image file from storage
    // - Delete notifications related to this user
    // - Delete polls created by this user, or reassign creator
    // - Delete whiteboard sessions created by this user

    return res.status(200).send("Account deleted successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting account.");
  }
};
