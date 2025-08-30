import express from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  deleteAllNotifications // NOW CORRECTLY REFERENCED
} from '../controllers/NotificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getNotifications); // Get all notifications for the user
router.put('/:notificationId/read', verifyToken, markNotificationAsRead); // Mark a specific notification as read
router.put('/read-all', verifyToken, markAllNotificationsAsRead); // Mark all notifications as read
router.get('/unread-count', verifyToken, getUnreadNotificationCount); // Get unread notification count
router.delete('/:notificationId', verifyToken, deleteNotification); // Delete a specific notification
router.delete('/delete-all', verifyToken, deleteAllNotifications); // Delete all notifications

export default router;