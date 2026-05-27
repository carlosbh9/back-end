const Notification = require('../../models/notification.schema');
const User = require('../../models/user.schema');

const OPERATIONS_ROLES = ['Reservas', 'Operaciones', 'Admin', 'Ventas'];

class NotificationService {
  async createForUsers(userIds, { type, message, entityId = null, entityType = null }) {
    if (!Array.isArray(userIds) || !userIds.length) return [];
    const docs = userIds.map((userId) => ({ userId, type, message, entityId, entityType }));
    return Notification.insertMany(docs, { ordered: false });
  }

  async createForOperationsUsers({ type, message, entityId = null, entityType = null }) {
    const users = await User.find({ role: { $in: OPERATIONS_ROLES } }).select('_id').lean();
    const ids = users.map((u) => u._id);
    return this.createForUsers(ids, { type, message, entityId, entityType });
  }

  async createForUser(userId, { type, message, entityId = null, entityType = null }) {
    if (!userId) return null;
    return Notification.create({ userId, type, message, entityId, entityType });
  }

  async listForUser(userId, { limit = 30 } = {}) {
    return Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async countUnread(userId) {
    return Notification.countDocuments({ userId, read: false });
  }

  async markRead(id, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true } },
      { new: true }
    ).lean();
  }

  async markAllRead(userId) {
    return Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  }
}

module.exports = new NotificationService();
