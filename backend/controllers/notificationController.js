const Notification = require('../models/Notification');

// Helper to determine notification query based on user role and assigned hostel
const buildNotificationQuery = (user) => {
  const userId = user._id || user.id;
  const role = user.role;

  // 1. SUPER_ADMIN: Global system oversight (system notices, admin & warden notifications)
  if (role === 'super_admin') {
    return {
      $or: [
        { userId },
        { recipientRole: { $in: ['super_admin', 'admin', 'warden', 'all'] } },
        { recipientRoles: { $in: ['super_admin', 'admin', 'warden', 'all'] } },
      ],
    };
  }

  // 2. ADMIN: System-wide administrative notifications, registrations, complaints & notices
  if (role === 'admin') {
    return {
      $or: [
        { userId },
        { recipientRole: { $in: ['admin', 'all'] } },
        { recipientRoles: { $in: ['admin', 'all'] } },
      ],
    };
  }

  // 3. WARDEN: STRICT HOSTEL SCOPING!
  // Receives student-registration, complaint, and outpass notifications ONLY for students belonging to their assigned hostel.
  // Administrative notifications intended for Wardens:
  // - Hostel-specific notices go only to the assigned hostel's Warden(s)
  // - System-wide instructions go to all appropriate Wardens (where hostel is null or 'all')
  if (role === 'warden') {
    const wardenHostel = user.hostel ? user.hostel.trim() : null;

    const hostelScopeCriteria = wardenHostel
      ? [
          { hostel: wardenHostel },
          { hostel: null },
          { hostel: '' },
          { hostel: 'all' },
        ]
      : [
          { hostel: null },
          { hostel: '' },
          { hostel: 'all' },
        ];

    return {
      $or: [
        { userId },
        {
          $and: [
            {
              $or: [
                { recipientRole: { $in: ['warden', 'all'] } },
                { recipientRoles: { $in: ['warden', 'all'] } },
              ],
            },
            {
              $or: hostelScopeCriteria,
            },
          ],
        },
      ],
    };
  }

  // 4. SECURITY: Receives only gate-relevant notifications (e.g. approved outpasses)
  if (role === 'security') {
    return {
      $or: [
        { userId },
        { recipientRole: { $in: ['security', 'all'] } },
        { recipientRoles: { $in: ['security', 'all'] } },
      ],
    };
  }

  // 5. STUDENT: Receives notifications concerning their own account, complaints, approvals, and outpasses
  // Broadcast notices only if specifically for their hostel or campus-wide
  const studentHostel = user.hostel ? user.hostel.trim() : null;
  const studentHostelScope = studentHostel
    ? [
        { hostel: studentHostel },
        { hostel: null },
        { hostel: '' },
        { hostel: 'all' },
      ]
    : [
        { hostel: null },
        { hostel: '' },
        { hostel: 'all' },
      ];

  return {
    $or: [
      { userId },
      {
        $and: [
          {
            $or: [
              { recipientRole: { $in: ['student', 'all'] } },
              { recipientRoles: { $in: ['student', 'all'] } },
            ],
          },
          {
            type: { $in: ['notice', 'system', 'general', 'mess-menu', 'bus-route'] },
          },
          {
            $or: studentHostelScope,
          },
        ],
      },
    ],
  };
};

// Helper to check if a notification has been read by the current user
const isNotificationRead = (notification, userId) => {
  if (notification.read) return true;
  if (Array.isArray(notification.readBy) && notification.readBy.some(id => id.toString() === userId.toString())) {
    return true;
  }
  return false;
};

// @desc    Get user's notifications (Derived from role & user ID)
// @route   GET /api/notifications/my
// @access  Private
exports.getMyNotifications = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const query = buildNotificationQuery(req.user);

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(query),
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Format read state per-user
    const formatted = notifications.map(n => ({
      ...n,
      read: isNotificationRead(n, req.user.id),
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const query = buildNotificationQuery(req.user);
    const notifications = await Notification.find(query).select('read readBy').lean();
    const unreadCount = notifications.filter(n => !isNotificationRead(n, req.user.id)).length;

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create notification
// @route   POST /api/notifications
// @access  Private/Admin
exports.createNotification = async (req, res) => {
  try {
    const { userId, recipientRole, title, message, type, hostel, roomNumber, entityId, entityType } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const notification = await Notification.create({
      userId: userId || null,
      recipientRole: recipientRole || null,
      title: title.trim(),
      message: message.trim(),
      type: type || 'general',
      hostel: hostel || null,
      roomNumber: roomNumber || null,
      entityId: entityId || null,
      entityType: entityType || '',
      read: false,
      readBy: [],
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notification',
    });
  }
};

// @desc    Bulk create notifications
// @route   POST /api/notifications/bulk
// @access  Private/Admin
exports.bulkCreateNotifications = async (req, res) => {
  try {
    const { userIds, recipientRole, title, message, type, hostel } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    let notifications;
    if (Array.isArray(userIds) && userIds.length > 0) {
      notifications = await Notification.insertMany(
        userIds.map(userId => ({
          userId,
          title: title.trim(),
          message: message.trim(),
          type: type || 'general',
          hostel: hostel || null,
          read: false,
        }))
      );
    } else {
      const singleRoleNotification = await Notification.create({
        recipientRole: recipientRole || 'all',
        title: title.trim(),
        message: message.trim(),
        type: type || 'general',
        hostel: hostel || null,
        read: false,
        readBy: [],
      });
      notifications = [singleRoleNotification];
    }

    res.status(201).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('Error bulk creating notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notifications',
    });
  }
};

// @desc    Mark individual notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
      ...buildNotificationQuery(req.user),
    };

    const notification = await Notification.findOne(query);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    if (notification.userId && notification.userId.toString() === req.user.id.toString()) {
      notification.read = true;
    } else {
      // Role broadcast: add current user to readBy
      if (!notification.readBy.some(id => id.toString() === req.user.id.toString())) {
        notification.readBy.push(req.user.id);
      }
    }

    await notification.save();

    res.status(200).json({
      success: true,
      data: {
        ...notification.toObject(),
        read: true,
      },
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification',
    });
  }
};

// @desc    Mark all user's notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const scopedQuery = buildNotificationQuery(req.user);

    // 1. Mark direct user notifications
    await Notification.updateMany({ userId }, { $set: { read: true } });

    // 2. Mark scoped notifications that match this user's query
    await Notification.updateMany(scopedQuery, {
      $addToSet: { readBy: userId },
    });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.buildNotificationQuery = buildNotificationQuery;
