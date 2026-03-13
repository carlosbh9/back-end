const ServiceOrder = require('../../models/service_order.schema');

const ALLOWED_STATUS_TRANSITIONS = {
  // Operational flow allows back-and-forth while work is active.
  PENDING: ['IN_PROGRESS', 'WAITING_INFO', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'WAITING_INFO', 'DONE', 'CANCELLED'],
  WAITING_INFO: ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: []
};

const ROLE_ALLOWED_AREAS = {
  admin: ['RESERVAS', 'OPERACIONES', 'CONTABILIDAD', 'PAGOS'],
  reservas: ['RESERVAS'],
  operaciones: ['OPERACIONES', 'RESERVAS'],
  contabilidad: ['CONTABILIDAD', 'PAGOS'],
  pagos: ['PAGOS', 'CONTABILIDAD'],
  ventas: ['RESERVAS', 'OPERACIONES']
};

class ServiceOrderService {
  canManageOrderByRole(order, userRole) {
    if (!userRole) return false;
    const allowedAreas = ROLE_ALLOWED_AREAS[userRole] || [];
    return allowedAreas.includes(order.area);
  }

  getAllowedAreasByRole(userRole) {
    return ROLE_ALLOWED_AREAS[userRole] || [];
  }

  async list({ page = 1, pageSize = 20, area = '', status = '', contactId = '', assigneeId = '', type = '', userRole = '' }) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;
    const skip = (safePage - 1) * safePageSize;

    const query = {};
    const allowedAreas = this.getAllowedAreasByRole(userRole);
    if (allowedAreas.length > 0) {
      query.area = { $in: allowedAreas };
    }

    if (area) query.area = area;
    if (status) query.status = status;
    if (contactId) query.contactId = contactId;
    if (assigneeId) query.assigneeId = assigneeId;
    if (type) query.type = type;

    const [items, total] = await Promise.all([
      ServiceOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(safePageSize).lean(),
      ServiceOrder.countDocuments(query)
    ]);

    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async getById(id, userRole = '') {
    const order = await ServiceOrder.findById(id).lean();
    if (!order) return null;
    if (!this.canManageOrderByRole(order, userRole)) {
      throw new Error('You do not have permissions to view this order');
    }
    return order;
  }

  async getByContact(contactId, userRole = '') {
    const query = { contactId };
    const allowedAreas = this.getAllowedAreasByRole(userRole);
    if (allowedAreas.length > 0) {
      query.area = { $in: allowedAreas };
    }
    return ServiceOrder.find(query).sort({ createdAt: -1 }).lean();
  }

  async updateStatus({ id, status, reason = '', userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole)) {
      throw new Error('You do not have permissions to update this order');
    }

    if (status === 'CANCELLED' && !['admin', 'ventas'].includes(userRole)) {
      throw new Error('Only admin or ventas can cancel orders');
    }

    const previousStatus = order.status;
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[previousStatus] || [];

    if (!allowedNext.includes(status)) {
      throw new Error(`Invalid status transition: ${previousStatus} -> ${status}`);
    }

    // If a flow marks order DONE, all blocking dependencies must be DONE.
    if (status === 'DONE' && Array.isArray(order.dependencies) && order.dependencies.length > 0) {
      const blockingIds = order.dependencies
        .filter((dep) => dep.relation === 'BLOCKING')
        .map((dep) => dep.dependsOnOrderId);

      if (blockingIds.length > 0) {
        const dependencyOrders = await ServiceOrder.find({
          _id: { $in: blockingIds }
        }).select('status').lean();

        const hasUnresolvedBlocking = dependencyOrders.some((depOrder) => depOrder.status !== 'DONE');
        if (hasUnresolvedBlocking) {
          throw new Error('Cannot complete order while blocking dependencies are unresolved');
        }
      }
    }

    // Enforce reason for cancellation for full traceability.
    if (status === 'CANCELLED' && !String(reason || '').trim()) {
      throw new Error('Cancellation reason is required');
    }

    order.status = status;
    order.updatedBy = userId;
    order.auditLogs.push({
      action: status === 'CANCELLED' ? 'CANCELLED' : 'STATUS_CHANGED',
      by: userId,
      message: reason || '',
      payload: { from: previousStatus, to: status, reason: reason || null }
    });
    await order.save();
    return order.toObject();
  }

  async assign({ id, assigneeId, userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole)) {
      throw new Error('You do not have permissions to assign this order');
    }

    const previousAssignee = order.assigneeId ? String(order.assigneeId) : null;
    order.assigneeId = assigneeId || null;
    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'ASSIGNED',
      by: userId,
      payload: { from: previousAssignee, to: assigneeId || null }
    });
    await order.save();
    return order.toObject();
  }

  async updateChecklistItem({ id, itemId, done, userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole)) {
      throw new Error('You do not have permissions to update this order');
    }

    const item = order.checklist.find((check) => check.itemId === itemId);
    if (!item) return null;

    item.status = done ? 'DONE' : 'PENDING';
    item.doneAt = done ? new Date() : null;
    item.doneBy = done ? userId : null;
    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'CHECKLIST_UPDATED',
      by: userId,
      payload: { itemId, done }
    });
    await order.save();
    return order.toObject();
  }

  async updateFinancials({ id, payload = {}, userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole) && !['admin', 'contabilidad', 'pagos'].includes(userRole)) {
      throw new Error('You do not have permissions to update financials for this order');
    }

    const previous = order.financials ? order.financials.toObject?.() || { ...order.financials } : {};
    order.financials = {
      ...(previous || {}),
      ...(payload || {})
    };
    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'FINANCIALS_UPDATED',
      by: userId,
      payload: { previous, next: order.financials }
    });
    await order.save();
    return order.toObject();
  }

  async addAttachment({ id, payload = {}, userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole) && !['admin', 'contabilidad', 'pagos'].includes(userRole)) {
      throw new Error('You do not have permissions to attach files to this order');
    }

    const attachmentId = payload.attachmentId
      || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const attachment = {
      attachmentId,
      type: payload.type || 'OTHER',
      fileName: String(payload.fileName || '').trim(),
      url: payload.url || '',
      storageKey: payload.storageKey || '',
      contentType: payload.contentType || '',
      notes: payload.notes || '',
      uploadedAt: new Date(),
      uploadedBy: userId || null
    };

    if (!attachment.fileName) {
      throw new Error('fileName is required');
    }

    order.attachments.push(attachment);
    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'ATTACHMENT_ADDED',
      by: userId,
      payload: {
        attachmentId,
        type: attachment.type,
        fileName: attachment.fileName
      }
    });
    await order.save();
    return order.toObject();
  }

  async removeAttachment({ id, attachmentId, userId = null, userRole = '' }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole) && !['admin', 'contabilidad', 'pagos'].includes(userRole)) {
      throw new Error('You do not have permissions to remove attachments from this order');
    }

    const previousCount = order.attachments.length;
    order.attachments = order.attachments.filter((item) => item.attachmentId !== attachmentId);
    if (order.attachments.length === previousCount) {
      return null;
    }

    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'ATTACHMENT_REMOVED',
      by: userId,
      payload: { attachmentId }
    });
    await order.save();
    return order.toObject();
  }

  async canManageById(id, userRole = '') {
    const order = await ServiceOrder.findById(id).select('_id area').lean();
    if (!order) return null;
    if (!this.canManageOrderByRole(order, userRole) && !['admin', 'contabilidad', 'pagos'].includes(userRole)) {
      throw new Error('You do not have permissions to manage this order');
    }
    return order;
  }

  async getAttachmentById(id, attachmentId, userRole = '') {
    const order = await ServiceOrder.findById(id).lean();
    if (!order) return null;
    if (!this.canManageOrderByRole(order, userRole) && !['admin', 'contabilidad', 'pagos'].includes(userRole)) {
      throw new Error('You do not have permissions to manage this order');
    }
    const attachment = (order.attachments || []).find((item) => item.attachmentId === attachmentId);
    if (!attachment) return { order, attachment: null };
    return { order, attachment };
  }

  async getKpisByArea() {
    const now = new Date();
    const [pending, inProgress, done, overdue] = await Promise.all([
      ServiceOrder.countDocuments({ status: 'PENDING' }),
      ServiceOrder.countDocuments({ status: 'IN_PROGRESS' }),
      ServiceOrder.countDocuments({ status: 'DONE' }),
      ServiceOrder.countDocuments({
        status: { $nin: ['DONE', 'CANCELLED'] },
        dueDate: { $ne: null, $lt: now }
      })
    ]);

    return { pending, inProgress, done, overdue };
  }
}

module.exports = new ServiceOrderService();
