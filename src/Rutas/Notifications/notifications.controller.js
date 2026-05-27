const notificationService = require('../../Services/notifications/notification.service');
const { sendError, createHttpError } = require('../../utils/httpError');
const { isValidObjectId } = require('../../utils/requestValidation');

class NotificationsController {
  async list(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, createHttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      const items = await notificationService.listForUser(userId);
      return res.status(200).json({ notifications: items });
    } catch (error) {
      return sendError(res, error, { status: 500, message: 'Error listing notifications', errorCode: 'NOTIFICATIONS_LIST_FAILED' });
    }
  }

  async unreadCount(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, createHttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      const count = await notificationService.countUnread(userId);
      return res.status(200).json({ count });
    } catch (error) {
      return sendError(res, error, { status: 500, message: 'Error counting notifications', errorCode: 'NOTIFICATIONS_COUNT_FAILED' });
    }
  }

  async markRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, createHttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Notification id is invalid', 'NOTIFICATION_ID_INVALID'));
      }
      const updated = await notificationService.markRead(req.params.id, userId);
      if (!updated) return sendError(res, createHttpError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND'));
      return res.status(200).json(updated);
    } catch (error) {
      return sendError(res, error, { status: 500, message: 'Error marking notification', errorCode: 'NOTIFICATION_MARK_READ_FAILED' });
    }
  }

  async markAllRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, createHttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      await notificationService.markAllRead(userId);
      return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
      return sendError(res, error, { status: 500, message: 'Error marking all notifications', errorCode: 'NOTIFICATIONS_MARK_ALL_FAILED' });
    }
  }
}

module.exports = new NotificationsController();
