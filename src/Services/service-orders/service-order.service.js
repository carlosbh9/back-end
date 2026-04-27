const ServiceOrder = require('../../models/service_order.schema');
const bookingFileSummaryService = require('../booking-files/booking-file-summary.service');
const { PERMISSIONS } = require('../../security/permissions');
const { createHttpError } = require('../../utils/httpError');
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
  normalizeText(value = '') {
    return String(value || '').trim();
  }

  buildAuditLog({ action, by = null, message = '', payload = {}, source = 'USER_ACTION' }) {
    return {
      action,
      by,
      message: this.normalizeText(message),
      payload: {
        source,
        ...payload,
      },
    };
  }

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

  getOrderedStages(order) {
    return [...(order?.stagesSnapshot || [])].sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  getFinalStage(order) {
    return this.getOrderedStages(order).find((stage) => stage.isFinal) || null;
  }

  getStageTransitionContext(order, fromCode, toCode) {
    const stages = this.getOrderedStages(order);
    const fromIndex = stages.findIndex((stage) => stage.code === fromCode);
    const toIndex = stages.findIndex((stage) => stage.code === toCode);
    return {
      stages,
      fromIndex,
      toIndex,
      direction: fromIndex === -1 || toIndex === -1
        ? 'UNKNOWN'
        : toIndex > fromIndex
          ? 'FORWARD'
          : toIndex < fromIndex
            ? 'BACKWARD'
            : 'STAY',
    };
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

  ensureOrderAccess(order, userRole = '') {
    if (!this.canManageOrderByRole(order, userRole)) {
      throw createHttpError(403, 'You do not have permissions to update this order', 'SERVICE_ORDER_FORBIDDEN');
    }
  }

  ensureDependenciesResolvedForCompletion(order) {
    if (!Array.isArray(order.dependencies) || order.dependencies.length === 0) {
      return Promise.resolve();
    }

    const blockingIds = order.dependencies
      .filter((dep) => dep.relation === 'BLOCKING')
      .map((dep) => dep.dependsOnOrderId);

    if (!blockingIds.length) {
      return Promise.resolve();
    }

    return ServiceOrder.find({
      _id: { $in: blockingIds }
    }).select('status').lean().then((dependencyOrders) => {
      const hasUnresolvedBlocking = dependencyOrders.some((depOrder) => depOrder.status !== 'DONE');
      if (hasUnresolvedBlocking) {
        throw createHttpError(
          409,
          'Cannot complete order while blocking dependencies are unresolved',
          'SERVICE_ORDER_BLOCKING_DEPENDENCIES_PENDING',
        );
      }
    });
  }

  ensureCancellationReason(reason = '') {
    const normalizedReason = this.normalizeText(reason);
    if (!normalizedReason) {
      throw createHttpError(400, 'Cancellation reason is required', 'SERVICE_ORDER_CANCELLATION_REASON_REQUIRED');
    }
    return normalizedReason;
  }

  ensureWaitingInfoReason(reason = '') {
    const normalizedReason = this.normalizeText(reason);
    if (!normalizedReason) {
      throw createHttpError(400, 'A reason is required to move the order to WAITING_INFO', 'SERVICE_ORDER_WAITING_INFO_REASON_REQUIRED');
    }
    return normalizedReason;
  }

  setCompletedLifecycle(order, userId = null, at = new Date()) {
    order.completedAt = order.completedAt || at;
    order.completedBy = order.completedBy || userId || null;
  }

  clearCompletedLifecycle(order) {
    order.completedAt = null;
    order.completedBy = null;
  }

  setCancellationLifecycle(order, reason = '', userId = null, at = new Date()) {
    order.cancelledAt = at;
    order.cancelledBy = userId || null;
    order.cancellationReason = this.normalizeText(reason);
  }

  clearCancellationLifecycle(order) {
    order.cancelledAt = null;
    order.cancelledBy = null;
    order.cancellationReason = '';
  }

  ensureWorkflowCanBeCompleted(order, { source = 'status' } = {}) {
    const activeStage = this.getActiveStage(order);
    const finalStage = this.getFinalStage(order);

    if (!(order?.stagesSnapshot || []).length) {
      return;
    }

    if (!activeStage) {
      throw createHttpError(
        409,
        'Cannot complete order without an active stage',
        'SERVICE_ORDER_STAGE_STATE_INVALID',
      );
    }

    if (!finalStage || activeStage.code !== finalStage.code) {
      throw createHttpError(
        409,
        source === 'status'
          ? 'Use the stage workflow to reach the final stage before completing this order'
          : 'Only the final stage can mark the order as done',
        'SERVICE_ORDER_FINAL_STAGE_REQUIRED',
      );
    }

    if (this.hasPendingRequiredChecklist(activeStage)) {
      throw createHttpError(
        409,
        `Complete the required checklist items in ${activeStage.label} before completing this order`,
        'SERVICE_ORDER_STAGE_CHECKLIST_INCOMPLETE',
      );
    }

    const missingAttachments = this.hasMissingRequiredAttachments(order, activeStage);
    if (missingAttachments.length) {
      throw createHttpError(
        409,
        `Missing required attachments for ${activeStage.label}: ${missingAttachments.join(', ')}`,
        'SERVICE_ORDER_STAGE_ATTACHMENTS_MISSING',
        { missingAttachments, stageCode: activeStage.code },
      );
    }
  }

  ensureStageTransitionAllowed(order, previousStage, nextStage, transitionComment = '') {
    if (order.status === 'CANCELLED') {
      throw createHttpError(409, 'Cannot update stage on a cancelled order', 'SERVICE_ORDER_CANCELLED');
    }

    const { stages, fromIndex, toIndex, direction } = this.getStageTransitionContext(
      order,
      previousStage?.code || '',
      nextStage?.code || '',
    );

    if (!previousStage) {
      const firstStage = stages[0] || null;
      if (firstStage && firstStage.code !== nextStage.code) {
        throw createHttpError(
          409,
          `The first available stage is ${firstStage.label}`,
          'SERVICE_ORDER_STAGE_TRANSITION_INVALID',
          { allowedStageCode: firstStage.code },
        );
      }
      return { direction: 'FORWARD', fromIndex, toIndex };
    }

    if (direction === 'STAY') {
      return { direction, fromIndex, toIndex };
    }

    if (Math.abs(toIndex - fromIndex) !== 1) {
      throw createHttpError(
        409,
        `Invalid stage transition: ${previousStage.code} -> ${nextStage.code}`,
        'SERVICE_ORDER_STAGE_TRANSITION_INVALID',
        {
          from: previousStage.code,
          to: nextStage.code,
          direction,
        },
      );
    }

    if (direction === 'BACKWARD' && !transitionComment) {
      throw createHttpError(
        400,
        `A comment is required to move back to ${nextStage.label}`,
        'SERVICE_ORDER_STAGE_COMMENT_REQUIRED',
      );
    }

    if (direction === 'FORWARD') {
      if (this.hasPendingRequiredChecklist(previousStage)) {
        throw createHttpError(
          409,
          `Complete the required checklist items in ${previousStage.label} before moving on`,
          'SERVICE_ORDER_STAGE_CHECKLIST_INCOMPLETE',
          { stageCode: previousStage.code },
        );
      }

      const missingAttachments = this.hasMissingRequiredAttachments(order, previousStage);
      if (missingAttachments.length) {
        throw createHttpError(
          409,
          `Missing required attachments for ${previousStage.label}: ${missingAttachments.join(', ')}`,
          'SERVICE_ORDER_STAGE_ATTACHMENTS_MISSING',
          { missingAttachments, stageCode: previousStage.code },
        );
      }

      if (previousStage.requireCommentOnComplete && !transitionComment) {
        throw createHttpError(
          400,
          `A comment is required to complete ${previousStage.label}`,
          'SERVICE_ORDER_STAGE_COMMENT_REQUIRED',
        );
      }
    }

    if (nextStage.requireCommentOnEnter && !transitionComment) {
      throw createHttpError(
        400,
        `A comment is required to enter ${nextStage.label}`,
        'SERVICE_ORDER_STAGE_COMMENT_REQUIRED',
      );
    }

    return { direction, fromIndex, toIndex };
  }

  ensureActiveStageExistsIfWorkflowPresent(order) {
    if (!Array.isArray(order.stagesSnapshot) || !order.stagesSnapshot.length) {
      return;
    }

    const activeStage = this.getActiveStage(order);
    if (activeStage) {
      return;
    }

    const orderedStages = this.getOrderedStages(order);
    const firstPendingStage = orderedStages.find((stage) => stage.status === 'PENDING') || orderedStages[0];
    if (firstPendingStage) {
      firstPendingStage.status = 'ACTIVE';
      firstPendingStage.startedAt = firstPendingStage.startedAt || new Date();
      this.syncLegacyChecklistWithActiveStage(order);
    }
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
      throw createHttpError(403, 'You do not have permissions to view this order', 'SERVICE_ORDER_FORBIDDEN');
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

    this.ensureOrderAccess(order, userRole);

    const nextStatus = this.normalizeText(status).toUpperCase();
    const normalizedReason = this.normalizeText(reason);

    if (nextStatus === 'CANCELLED' && !this.canCancelOrder(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to cancel orders', 'SERVICE_ORDER_FORBIDDEN');
    }

    const previousStatus = order.status;
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[previousStatus] || [];

    if (!allowedNext.includes(nextStatus)) {
      throw createHttpError(
        409,
        `Invalid status transition: ${previousStatus} -> ${nextStatus}`,
        'SERVICE_ORDER_STATUS_TRANSITION_INVALID',
        { from: previousStatus, to: nextStatus },
      );
    }

    if (nextStatus === 'DONE') {
      await this.ensureDependenciesResolvedForCompletion(order);
      this.ensureWorkflowCanBeCompleted(order, { source: 'status' });
    }

    if (nextStatus === 'CANCELLED') {
      this.ensureCancellationReason(normalizedReason);
    }

    if (nextStatus === 'WAITING_INFO') {
      this.ensureWaitingInfoReason(normalizedReason);
    }

    const now = new Date();
    order.status = nextStatus;
    order.lastStatusChangeAt = now;
    order.updatedBy = userId;

    if (nextStatus === 'DONE') {
      this.setCompletedLifecycle(order, userId, now);
      this.clearCancellationLifecycle(order);
    } else {
      if (previousStatus === 'DONE') {
        this.clearCompletedLifecycle(order);
      }
      if (nextStatus === 'CANCELLED') {
        this.setCancellationLifecycle(order, normalizedReason, userId, now);
      } else if (previousStatus === 'CANCELLED') {
        this.clearCancellationLifecycle(order);
        this.ensureActiveStageExistsIfWorkflowPresent(order);
      }
    }

    order.auditLogs.push(this.buildAuditLog({
      action: nextStatus === 'CANCELLED' ? 'CANCELLED' : 'STATUS_CHANGED',
      by: userId,
      message: normalizedReason,
      payload: {
        kind: 'STATUS_TRANSITION',
        fromStatus: previousStatus,
        toStatus: nextStatus,
        reason: normalizedReason || null,
      },
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async assign({ id, assigneeId, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canAssignOrder(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to assign this order', 'SERVICE_ORDER_FORBIDDEN');
    }

    const previousAssignee = order.assigneeId ? String(order.assigneeId) : null;
    order.assigneeId = assigneeId || null;
    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'ASSIGNED',
      by: userId,
      payload: {
        kind: 'ASSIGNMENT',
        fromAssigneeId: previousAssignee,
        toAssigneeId: assigneeId || null,
      },
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateChecklistItem({ id, itemId, done, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canUpdateChecklist(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to update this order', 'SERVICE_ORDER_FORBIDDEN');
    }

    if (order.status === 'CANCELLED') {
      throw createHttpError(409, 'Cannot update checklist on a cancelled order', 'SERVICE_ORDER_CANCELLED');
    }

    let item = order.checklist.find((check) => check.itemId === itemId);
    let activeStage = this.getActiveStage(order);

    if (!item && activeStage) {
      item = activeStage.checklist.find((check) => check.itemId === itemId);
    }
    if (!item) return null;

    const previousOrderStatus = order.status;
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

    if (order.status === 'DONE' && activeStage?.isFinal && this.hasPendingRequiredChecklist(activeStage)) {
      order.status = 'IN_PROGRESS';
      order.lastStatusChangeAt = new Date();
      this.clearCompletedLifecycle(order);
    }

    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'CHECKLIST_UPDATED',
      by: userId,
      payload: {
        kind: 'CHECKLIST',
        itemId,
        done,
        stageCode: activeStage?.code || null,
        fromStatus: previousOrderStatus,
        toStatus: order.status,
      },
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateStage({ id, stageCode, comment = '', userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canUpdateStage(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to update this order', 'SERVICE_ORDER_FORBIDDEN');
    }

    const nextCode = String(stageCode || '').trim().toUpperCase();
    if (!nextCode) {
      throw createHttpError(400, 'stageCode is required', 'SERVICE_ORDER_STAGE_REQUIRED');
    }

    const nextStage = (order.stagesSnapshot || []).find((stage) => stage.code === nextCode);
    if (!nextStage) {
      throw createHttpError(404, 'Stage not found in this workflow', 'SERVICE_ORDER_STAGE_NOT_FOUND');
    }

    const previousStage = this.getActiveStage(order);
    const transitionComment = String(comment || '').trim();
    const previousOrderStatus = order.status;
    const transitionContext = this.ensureStageTransitionAllowed(order, previousStage, nextStage, transitionComment);

    if (transitionContext.direction === 'STAY') {
      return order.toObject();
    }

    const now = new Date();

    if (previousStage && previousStage.code !== nextStage.code) {
      if (transitionContext.direction === 'FORWARD') {
        previousStage.status = 'DONE';
        previousStage.completedAt = previousStage.completedAt || now;
      } else {
        previousStage.status = 'PENDING';
        previousStage.completedAt = null;
      }
    }

    (order.stagesSnapshot || []).forEach((stage) => {
      if (stage.code === nextCode) {
        stage.status = 'ACTIVE';
        stage.startedAt = stage.startedAt || now;
        if (transitionContext.direction === 'BACKWARD') {
          stage.completedAt = null;
        }
      } else if (stage.status !== 'DONE' && stage.status !== 'SKIPPED') {
        stage.status = 'PENDING';
      }
    });

    this.syncLegacyChecklistWithActiveStage(order);

    if (nextStage.isFinal) {
      await this.ensureDependenciesResolvedForCompletion(order);
      this.ensureWorkflowCanBeCompleted(order, { source: 'stage' });
      order.status = 'DONE';
      this.setCompletedLifecycle(order, userId, now);
      this.clearCancellationLifecycle(order);
    } else {
      if (order.status === 'CANCELLED') {
        this.clearCancellationLifecycle(order);
      }
      if (order.status === 'DONE' || order.status === 'PENDING' || order.status === 'WAITING_INFO') {
        order.status = 'IN_PROGRESS';
      }
      this.clearCompletedLifecycle(order);
    }

    if (order.status === 'IN_PROGRESS' || order.status === 'DONE') {
      order.lastStatusChangeAt = now;
    } else if (order.status === 'PENDING') {
      order.status = 'IN_PROGRESS';
      order.lastStatusChangeAt = now;
    }

    order.lastStageChangeAt = now;
    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'STAGE_CHANGED',
      by: userId,
      message: transitionComment,
      payload: {
        kind: 'STAGE_TRANSITION',
        fromStageCode: previousStage?.code || null,
        toStageCode: nextStage.code,
        direction: transitionContext.direction,
        fromStatus: previousOrderStatus,
        toStatus: order.status,
        comment: transitionComment || null,
      },
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async updateFinancials({ id, payload = {}, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageFinancials(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to update financials for this order', 'SERVICE_ORDER_FORBIDDEN');
    }

    const previous = order.financials ? order.financials.toObject?.() || { ...order.financials } : {};
    order.financials = {
      ...(previous || {}),
      ...(payload || {})
    };
    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'FINANCIALS_UPDATED',
      by: userId,
      payload: { kind: 'FINANCIALS', previous, next: order.financials }
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async addAttachment({ id, payload = {}, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageAttachments(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to attach files to this order', 'SERVICE_ORDER_FORBIDDEN');
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
      throw createHttpError(400, 'fileName is required', 'SERVICE_ORDER_ATTACHMENT_FILE_NAME_REQUIRED');
    }

    order.attachments.push(attachment);
    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'ATTACHMENT_ADDED',
      by: userId,
      payload: {
        kind: 'ATTACHMENT',
        attachmentId,
        type: attachment.type,
        fileName: attachment.fileName
      },
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async removeAttachment({ id, attachmentId, userId = null, userRole = '', userPermissions = [] }) {
    const order = await ServiceOrder.findById(id);
    if (!order) return null;

    if (!this.canManageAttachments(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to remove attachments from this order', 'SERVICE_ORDER_FORBIDDEN');
    }

    const previousCount = order.attachments.length;
    order.attachments = order.attachments.filter((item) => item.attachmentId !== attachmentId);
    if (order.attachments.length === previousCount) {
      return null;
    }

    order.updatedBy = userId;
    order.auditLogs.push(this.buildAuditLog({
      action: 'ATTACHMENT_REMOVED',
      by: userId,
      payload: { kind: 'ATTACHMENT', attachmentId }
    }));
    await order.save();
    await this.refreshFileSummary(order, userId);
    return order.toObject();
  }

  async canManageById(id, userRole = '', userPermissions = []) {
    const order = await ServiceOrder.findById(id).select('_id area').lean();
    if (!order) return null;
    if (!this.canManageAttachments(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to manage this order', 'SERVICE_ORDER_FORBIDDEN');
    }
    return order;
  }

  async getAttachmentById(id, attachmentId, userRole = '', userPermissions = []) {
    const order = await ServiceOrder.findById(id).lean();
    if (!order) return null;
    if (!this.canManageAttachments(userRole, userPermissions)) {
      throw createHttpError(403, 'You do not have permissions to manage this order', 'SERVICE_ORDER_FORBIDDEN');
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
