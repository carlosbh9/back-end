const ServiceOrder = require('../../models/service_order.schema');
const bookingFileSummaryService = require('../booking-files/booking-file-summary.service');
const { PERMISSIONS } = require('../../security/permissions');
const {
  isAdminRole,
  getServiceOrderAreasForRole,
  canAccessServiceOrderArea,
} = require('../../security/access-policies');

const ALLOWED_STATUS_TRANSITIONS = {
  // Operational flow allows back-and-forth while work is active.
  PENDING: ['IN_PROGRESS', 'WAITING_INFO', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'WAITING_INFO', 'DONE', 'CANCELLED'],
  WAITING_INFO: ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: ['IN_PROGRESS'],
  CANCELLED: ['IN_PROGRESS']
};

class ServiceOrderService {
  canCancelOrder(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_CANCEL);
  }

  canManageFinancials(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_FINANCIALS_MANAGE);
  }

  canManageAttachments(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_ATTACHMENTS_MANAGE);
  }

  canAssignOrder(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_ASSIGN);
  }

  canUpdateChecklist(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_CHECKLIST_UPDATE);
  }

  canUpdateStage(userRole = '', userPermissions = []) {
    if (isAdminRole(userRole)) return true;
    return Array.isArray(userPermissions) && userPermissions.includes(PERMISSIONS.SERVICE_ORDER_STAGE_UPDATE);
  }

  async refreshFileSummary(order, userId = null) {
    if (!order?.file_id) return;
    await bookingFileSummaryService.recalculateFileSummary(String(order.file_id), { updatedBy: userId });
  }

  getActiveStage(order) {
    return (order?.stagesSnapshot || []).find((stage) => stage.status === 'ACTIVE') || null;
  }

  syncLegacyChecklistWithActiveStage(order) {
    const activeStage = this.getActiveStage(order);
    order.checklist = activeStage?.checklist || [];
    order.currentStageCode = activeStage?.code || '';
    order.currentStageLabel = activeStage?.label || '';
  }

  getStageByCode(order, stageCode) {
    return (order?.stagesSnapshot || []).find((stage) => stage.code === stageCode) || null;
  }

  hasPendingRequiredChecklist(stage) {
    return (stage?.checklist || []).some((item) => item.required !== false && item.status !== 'DONE');
  }

  hasMissingRequiredAttachments(order, stage) {
    const required = Array.isArray(stage?.requiredAttachments) ? stage.requiredAttachments : [];
    if (!required.length) return [];
    const present = new Set((order?.attachments || []).map((item) => item.type));
    return required.filter((type) => !present.has(type));
  }

  canManageOrderByRole(order, userRole) {
    if (!userRole) return false;
    return canAccessServiceOrderArea(userRole, order.area);
  }

  getAllowedAreasByRole(userRole) {
    return getServiceOrderAreasForRole(userRole);
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

  async updateStatus({ id, status, reason = '', userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageOrderByRole(order, userRole)) {
      throw new Error('You do not have permissions to update this order');
    }

    if (status === 'CANCELLED' && !this.canCancelOrder(userRole, userPermissions)) {
      throw new Error('You do not have permissions to cancel orders');
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
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async assign({ id, assigneeId, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canAssignOrder(userRole, userPermissions)) {
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
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateChecklistItem({ id, itemId, done, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canUpdateChecklist(userRole, userPermissions)) {
      throw new Error('You do not have permissions to update this order');
    }

    let item = order.checklist.find((check) => check.itemId === itemId);
    let activeStage = this.getActiveStage(order);

    if (!item && activeStage) {
      item = activeStage.checklist.find((check) => check.itemId === itemId);
    }
    if (!item) return null;

    item.status = done ? 'DONE' : 'PENDING';
    item.doneAt = done ? new Date() : null;
    item.doneBy = done ? userId : null;
    if (activeStage) {
      const activeStageItem = activeStage.checklist.find((check) => check.itemId === itemId);
      if (activeStageItem) {
        activeStageItem.status = item.status;
        activeStageItem.doneAt = item.doneAt;
        activeStageItem.doneBy = item.doneBy;
      }
      this.syncLegacyChecklistWithActiveStage(order);
    }
    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'CHECKLIST_UPDATED',
      by: userId,
      payload: { itemId, done }
    });
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateStage({ id, stageCode, comment = '', userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canUpdateStage(userRole, userPermissions)) {
      throw new Error('You do not have permissions to update this order');
    }

    const nextCode = String(stageCode || '').trim().toUpperCase();
    if (!nextCode) {
      throw new Error('stageCode is required');
    }

    const nextStage = (order.stagesSnapshot || []).find((stage) => stage.code === nextCode);
    if (!nextStage) {
      throw new Error('Stage not found in this workflow');
    }

    const previousStage = this.getActiveStage(order);
    const transitionComment = String(comment || '').trim();

    if (previousStage && previousStage.code !== nextStage.code) {
      if (this.hasPendingRequiredChecklist(previousStage)) {
        throw new Error(`Complete the required checklist items in ${previousStage.label} before moving on`);
      }

      const missingAttachments = this.hasMissingRequiredAttachments(order, previousStage);
      if (missingAttachments.length) {
        throw new Error(`Missing required attachments for ${previousStage.label}: ${missingAttachments.join(', ')}`);
      }

      if (previousStage.requireCommentOnComplete && !transitionComment) {
        throw new Error(`A comment is required to complete ${previousStage.label}`);
      }
    }

    if (nextStage.requireCommentOnEnter && !transitionComment) {
      throw new Error(`A comment is required to enter ${nextStage.label}`);
    }

    if (previousStage && previousStage.code !== nextStage.code) {
      previousStage.status = 'DONE';
      previousStage.completedAt = previousStage.completedAt || new Date();
    }

    (order.stagesSnapshot || []).forEach((stage) => {
      if (stage.code === nextCode) {
        stage.status = 'ACTIVE';
        stage.startedAt = stage.startedAt || new Date();
      } else if (stage.status !== 'DONE' && stage.status !== 'SKIPPED') {
        stage.status = 'PENDING';
      }
    });

    this.syncLegacyChecklistWithActiveStage(order);

    if (nextStage.isFinal) {
      order.status = 'DONE';
    } else if (order.status === 'PENDING') {
      order.status = 'IN_PROGRESS';
    }

    order.updatedBy = userId;
    order.auditLogs.push({
      action: 'STAGE_CHANGED',
      by: userId,
      message: transitionComment,
      payload: {
        from: previousStage?.code || null,
        to: nextStage.code,
        comment: transitionComment || null
      }
    });
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateFinancials({ id, payload = {}, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageFinancials(userRole, userPermissions)) {
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
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async addAttachment({ id, payload = {}, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageAttachments(userRole, userPermissions)) {
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
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async removeAttachment({ id, attachmentId, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageAttachments(userRole, userPermissions)) {
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
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async canManageById(id, userRole = '', userPermissions = []) {
    const order = await ServiceOrder.findById(id).select('_id area').lean();
    if (!order) return null;
    if (!this.canManageAttachments(userRole, userPermissions)) {
      throw new Error('You do not have permissions to manage this order');
    }
    return order;
  }

  async getAttachmentById(id, attachmentId, userRole = '', userPermissions = []) {
    const order = await ServiceOrder.findById(id).lean();
    if (!order) return null;
    if (!this.canManageAttachments(userRole, userPermissions)) {
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
