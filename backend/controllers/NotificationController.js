import Notification from '../models/NotificationModel.js';
import mongoose from 'mongoose';

// Helper function for consistent error responses
const sendErrorResponse = (res, error, message = "Internal Server Error", statusCode = 500) => {
  console.error(error); // Log the full error for debugging
  return res.status(statusCode).send(message);
};

// @desc    Get all notifications for the authenticated user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate('sender', 'firstName lastName username image') // Populate sender details
      .populate('relatedEntity', 'name username'); // Populate related entity (e.g., channel name) if applicable

    return res.status(200).json({ notifications });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching notifications.");
  }
};

// @desc    Mark a specific notification as read
// @route   PUT /api/notifications/:notificationId/read
// @access  Private
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).send("Invalid notification ID format.");
    }

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).send("Notification not found.");
    }

    // Ensure the notification belongs to the authenticated user
    if (notification.recipient.toString() !== userId.toString()) {
      return res.status(403).send("You are not authorized to mark this notification as read.");
    }

    if (notification.isRead) {
      return res.status(200).send("Notification is already marked as read.");
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).send("Notification marked as read successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error marking notification as read.");
  }
};

// @desc    Mark all notifications for the authenticated user as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    if (result.modifiedCount > 0) {
      return res.status(200).send(`${result.modifiedCount} notifications marked as read.`);
    } else {
      return res.status(200).send("No unread notifications to mark as read.");
    }
  } catch (error) {
    return sendErrorResponse(res, error, "Error marking all notifications as read.");
  }
};

// @desc    Get count of unread notifications for the authenticated user
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.userId;

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });

    return res.status(200).json({ unreadCount });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching unread notification count.");
  }
};

// @desc    Delete a specific notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).send("Invalid notification ID format.");
    }

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).send("Notification not found.");
    }

    // Ensure the notification belongs to the authenticated user
    if (notification.recipient.toString() !== userId.toString()) {
      return res.status(403).send("You are not authorized to delete this notification.");
    }

    await notification.deleteOne(); // Use deleteOne for Mongoose 6+

    return res.status(200).send("Notification deleted successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting notification.");
  }
};

// @desc    Delete all notifications for the authenticated user
// @route   DELETE /api/notifications/delete-all
// @access  Private
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await Notification.deleteMany({ recipient: userId });

    if (result.deletedCount > 0) {
      return res.status(200).send(`${result.deletedCount} notifications deleted successfully.`);
    } else {
      return res.status(200).send("No notifications found to delete for this user.");
    }
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting all notifications.");
  }
};