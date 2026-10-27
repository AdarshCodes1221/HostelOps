/**
 * Notification Dispatch Service
 * Handles unified creation of system, admin, warden, security, and student notifications.
 * Enforces strict recipient & hostel scoping.
 */

const Notification = require('../models/Notification');

/**
 * Dispatches notification to administrators and/or wardens
 * Supports strict hostel targeting so hostel-specific events reach only the relevant warden(s).
 */
exports.notifyAdmins = async ({
  title,
  message,
  type = 'system',
  entityId = null,
  entityType = '',
  actionUrl = null,
  hostel = null,
  hostelId = null,
  roomNumber = null,
  recipientRole = 'admin',
  recipientRoles = null,
}) => {
  try {
    const roles = Array.isArray(recipientRoles) && recipientRoles.length > 0
      ? recipientRoles
      : (recipientRole ? [recipientRole] : ['admin']);

    const notification = await Notification.create({
      recipientRole: roles[0] || 'admin',
      recipientRoles: roles,
      title: title.trim(),
      message: message.trim(),
      type,
      entityId,
      entityType,
      actionUrl,
      hostel: hostel ? hostel.trim() : null,
      hostelId: hostelId || null,
      roomNumber: roomNumber ? roomNumber.toString().trim() : null,
      read: false,
      readBy: [],
    });
    return notification;
  } catch (error) {
    console.error('Failed to dispatch admin notification:', error.message);
    return null;
  }
};

/**
 * Dispatches notification to a specific user (student/admin/warden/security)
 */
exports.notifyUser = async ({
  userId,
  title,
  message,
  type = 'general',
  entityId = null,
  entityType = '',
  actionUrl = null,
  hostel = null,
  hostelId = null,
  roomNumber = null,
}) => {
  try {
    if (!userId) return null;
    const notification = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      type,
      entityId,
      entityType,
      actionUrl,
      hostel: hostel ? hostel.trim() : null,
      hostelId: hostelId || null,
      roomNumber: roomNumber ? roomNumber.toString().trim() : null,
      read: false,
      readBy: [],
    });
    return notification;
  } catch (error) {
    console.error(`Failed to dispatch notification to user ${userId}:`, error.message);
    return null;
  }
};

/**
 * Dispatches notification to gate security officers
 */
exports.notifySecurity = async ({
  title,
  message,
  type = 'general',
  entityId = null,
  entityType = '',
  actionUrl = null,
  hostel = null,
}) => {
  try {
    const notification = await Notification.create({
      recipientRole: 'security',
      recipientRoles: ['security'],
      title: title.trim(),
      message: message.trim(),
      type,
      entityId,
      entityType,
      actionUrl,
      hostel: hostel ? hostel.trim() : null,
      read: false,
      readBy: [],
    });
    return notification;
  } catch (error) {
    console.error('Failed to dispatch security notification:', error.message);
    return null;
  }
};
