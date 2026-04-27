const serviceOrderService = require('../../Services/service-orders/service-order.service');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');
const Contact = require('../../models/contact.schema');
const BookingFile = require('../../models/booking_file.schema');
const {
  createServiceOrderAttachmentPresign,
  createServiceOrderAttachmentReadPresign,
} = require('../../utils/serviceOrderUploads');
const { createHttpError, sendError } = require('../../utils/httpError');
const { createValidator, isPlainObject, isValidObjectId } = require('../../utils/requestValidation');

const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO', 'DONE', 'CANCELLED'];
const ATTACHMENT_TYPES = ['VOUCHER', 'INVOICE', 'PAYMENT_PROOF', 'RESERVATION_CONFIRMATION', 'TICKET', 'PASSPORT_COPY', 'OTHER'];
const PAYMENT_STATUSES = ['NOT_REQUIRED', 'PENDING', 'PARTIAL', 'PAID', 'REFUNDED'];
const PAYMENT_METHODS = ['TRANSFER', 'CASH', 'CARD', 'CHECK', 'OTHER'];

function validateStatusPayload(body) {
  const validator = createValidator({
    message: 'Invalid service order status payload',
    errorCode: 'SERVICE_ORDER_STATUS_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.optionalEnum('status', body.status, ORDER_STATUSES);
  validator.requireNonEmptyString('status', body.status);
  validator.optionalString('reason', body.reason);
  validator.assert();
}

function validateAssignPayload(body) {
  const validator = createValidator({
    message: 'Invalid service order assignment payload',
    errorCode: 'SERVICE_ORDER_ASSIGN_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'assigneeId')) {
    validator.addIssue('assigneeId', 'assigneeId is required');
  } else if (body.assigneeId !== null && body.assigneeId !== '' && !isValidObjectId(body.assigneeId)) {
    validator.addIssue('assigneeId', 'assigneeId must be a valid id or null', body.assigneeId);
  }

  validator.assert();
}

function validateChecklistPayload(body) {
  const validator = createValidator({
    message: 'Invalid service order checklist payload',
    errorCode: 'SERVICE_ORDER_CHECKLIST_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireBoolean('done', body.done);
  validator.assert();
}

function validateStagePayload(body) {
  const validator = createValidator({
    message: 'Invalid service order stage payload',
    errorCode: 'SERVICE_ORDER_STAGE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('stageCode', body.stageCode);
  validator.optionalString('comment', body.comment);
  validator.assert();
}

function validateFinancialsPayload(body) {
  const validator = createValidator({
    message: 'Invalid service order financials payload',
    errorCode: 'SERVICE_ORDER_FINANCIALS_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  if (!Object.keys(body).length) {
    validator.addIssue('body', 'body must not be empty');
  }

  validator.optionalString('supplierName', body.supplierName);
  validator.optionalString('supplierReference', body.supplierReference);
  validator.optionalString('currency', body.currency, { allowEmpty: false });
  validator.optionalNumber('expectedCost', body.expectedCost, { min: 0 });
  validator.optionalNumber('paidAmount', body.paidAmount, { min: 0 });
  validator.optionalEnum('paymentStatus', body.paymentStatus, PAYMENT_STATUSES);
  validator.optionalEnum('paymentMethod', body.paymentMethod, PAYMENT_METHODS);
  validator.optionalDate('paymentDueDate', body.paymentDueDate, { allowNull: true, allowEmpty: true });
  validator.optionalDate('paymentDate', body.paymentDate, { allowNull: true, allowEmpty: true });
  validator.optionalString('invoiceNumber', body.invoiceNumber);
  validator.optionalDate('invoiceDate', body.invoiceDate, { allowNull: true, allowEmpty: true });
  validator.assert();
}

function validateAttachmentPayload(body, { presign = false } = {}) {
  const validator = createValidator({
    message: presign ? 'Invalid attachment presign payload' : 'Invalid attachment payload',
    errorCode: presign ? 'SERVICE_ORDER_ATTACHMENT_PRESIGN_VALIDATION_FAILED' : 'SERVICE_ORDER_ATTACHMENT_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('fileName', body.fileName);
  validator.optionalEnum('type', body.type, ATTACHMENT_TYPES);
  validator.optionalString('contentType', body.contentType, { allowEmpty: false });
  validator.optionalString('attachmentId', body.attachmentId, { allowEmpty: false });
  validator.optionalString('url', body.url);
  validator.optionalString('storageKey', body.storageKey);
  validator.optionalString('notes', body.notes);

  if (presign) {
    validator.requireNonEmptyString('contentType', body.contentType);
  }

  validator.assert();
}

class ServiceOrdersController {
  async list(req, res) {
    try {
      const result = await serviceOrderService.list({
        ...(req.query || {}),
        userRole: req.user?.role || '',
      });
      const kpis = await serviceOrderService.getKpisByArea();
      return res.status(200).json({ ...result, kpis });
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error listing service orders',
        errorCode: 'SERVICE_ORDER_LIST_FAILED',
      });
    }
  }

  async getById(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      const item = await serviceOrderService.getById(req.params.id, req.user?.role || '');
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 500,
        message: 'Error fetching service order',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_FETCH_FAILED',
      });
    }
  }

  async getByContact(req, res) {
    try {
      if (!isValidObjectId(req.params.contactId)) {
        return sendError(res, createHttpError(400, 'contactId is invalid', 'CONTACT_ID_INVALID'));
      }

      const items = await serviceOrderService.getByContact(req.params.contactId, req.user?.role || '');
      return res.status(200).json(items);
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error fetching contact service orders',
        errorCode: 'SERVICE_ORDER_CONTACT_FETCH_FAILED',
      });
    }
  }

  async updateStatus(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateStatusPayload(req.body);

      const { status, reason = '' } = req.body || {};
      if (!status) {
        return sendError(res, createHttpError(400, 'status is required', 'SERVICE_ORDER_STATUS_REQUIRED'));
      }

      const item = await serviceOrderService.updateStatus({
        id: req.params.id,
        status,
        reason,
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions') || error.message?.includes('Only admin');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error updating status',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_STATUS_UPDATE_FAILED',
      });
    }
  }

  async assign(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateAssignPayload(req.body);

      const { assigneeId } = req.body || {};
      const item = await serviceOrderService.assign({
        id: req.params.id,
        assigneeId: assigneeId || null,
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error assigning service order',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_ASSIGN_FAILED',
      });
    }
  }

  async updateChecklistItem(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }
      if (!String(req.params.itemId || '').trim()) {
        return sendError(res, createHttpError(400, 'itemId is required', 'SERVICE_ORDER_CHECKLIST_ITEM_ID_REQUIRED'));
      }

      validateChecklistPayload(req.body);

      const { done } = req.body || {};
      const item = await serviceOrderService.updateChecklistItem({
        id: req.params.id,
        itemId: req.params.itemId,
        done: !!done,
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order or checklist item not found', 'SERVICE_ORDER_CHECKLIST_ITEM_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error updating checklist item',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_CHECKLIST_UPDATE_FAILED',
      });
    }
  }

  async updateStage(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateStagePayload(req.body);

      const { stageCode, comment = '' } = req.body || {};
      const item = await serviceOrderService.updateStage({
        id: req.params.id,
        stageCode,
        comment,
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error updating stage',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_STAGE_UPDATE_FAILED',
      });
    }
  }

  async updateFinancials(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateFinancialsPayload(req.body);

      const item = await serviceOrderService.updateFinancials({
        id: req.params.id,
        payload: req.body || {},
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error updating financials',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_FINANCIALS_UPDATE_FAILED',
      });
    }
  }

  async addAttachment(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateAttachmentPayload(req.body);

      const item = await serviceOrderService.addAttachment({
        id: req.params.id,
        payload: req.body || {},
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error adding attachment',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_ATTACHMENT_ADD_FAILED',
      });
    }
  }

  async removeAttachment(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }
      if (!String(req.params.attachmentId || '').trim()) {
        return sendError(res, createHttpError(400, 'attachmentId is required', 'SERVICE_ORDER_ATTACHMENT_ID_REQUIRED'));
      }

      const item = await serviceOrderService.removeAttachment({
        id: req.params.id,
        attachmentId: req.params.attachmentId,
        userId: req.user?.id || null,
        userRole: req.user?.role || '',
        userPermissions: req.user?.permissions || [],
      });
      if (!item) {
        return sendError(res, createHttpError(404, 'Service order or attachment not found', 'SERVICE_ORDER_ATTACHMENT_NOT_FOUND'));
      }

      return res.status(200).json(item);
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : 400,
        message: 'Error removing attachment',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_ATTACHMENT_REMOVE_FAILED',
      });
    }
  }

  async presignAttachment(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }

      validateAttachmentPayload(req.body, { presign: true });

      const { fileName, contentType, type = 'OTHER' } = req.body || {};
      if (!fileName || !contentType) {
        return sendError(res, createHttpError(400, 'fileName and contentType are required', 'SERVICE_ORDER_ATTACHMENT_METADATA_REQUIRED'));
      }

      const order = await serviceOrderService.canManageById(
        req.params.id,
        req.user?.role || '',
        req.user?.permissions || []
      );
      if (!order) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }

      const result = await createServiceOrderAttachmentPresign({
        orderId: req.params.id,
        fileName,
        contentType,
        attachmentType: type,
      });

      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : (error.status || 400),
        message: 'Error presigning attachment upload',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_ATTACHMENT_PRESIGN_FAILED',
      });
    }
  }

  async openAttachment(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Service order id is invalid', 'SERVICE_ORDER_ID_INVALID'));
      }
      if (!String(req.params.attachmentId || '').trim()) {
        return sendError(res, createHttpError(400, 'attachmentId is required', 'SERVICE_ORDER_ATTACHMENT_ID_REQUIRED'));
      }

      const result = await serviceOrderService.getAttachmentById(
        req.params.id,
        req.params.attachmentId,
        req.user?.role || '',
        req.user?.permissions || []
      );
      if (!result) {
        return sendError(res, createHttpError(404, 'Service order not found', 'SERVICE_ORDER_NOT_FOUND'));
      }
      if (!result.attachment) {
        return sendError(res, createHttpError(404, 'Attachment not found', 'SERVICE_ORDER_ATTACHMENT_NOT_FOUND'));
      }

      const response = await createServiceOrderAttachmentReadPresign({
        key: result.attachment.storageKey,
        fileName: result.attachment.fileName,
      });

      return res.status(200).json({ ok: true, ...response });
    } catch (error) {
      const isForbidden = error.message?.includes('permissions');
      return sendError(res, error, {
        status: isForbidden ? 403 : (error.status || 400),
        message: 'Error opening attachment',
        errorCode: isForbidden ? 'SERVICE_ORDER_FORBIDDEN' : 'SERVICE_ORDER_ATTACHMENT_OPEN_FAILED',
      });
    }
  }

  async syncByContact(req, res) {
    try {
      if (!isValidObjectId(req.params.contactId)) {
        return sendError(res, createHttpError(400, 'contactId is invalid', 'CONTACT_ID_INVALID'));
      }

      const contact = await Contact.findById(req.params.contactId).select('_id soldQuoterId').lean();
      if (!contact) {
        return sendError(res, createHttpError(404, 'Contact not found', 'CONTACT_NOT_FOUND'));
      }
      if (!contact.soldQuoterId) {
        return sendError(res, createHttpError(400, 'Contact has no soldQuoterId to sync', 'CONTACT_SOLD_QUOTER_REQUIRED'));
      }

      const bookingFile = await BookingFile.findOne({ quoter_id: contact.soldQuoterId }).select('_id');
      if (!bookingFile) {
        return sendError(res, createHttpError(400, 'Booking file not found for this sold quoter', 'BOOKING_FILE_NOT_FOUND'));
      }

      const result = await serviceOrderOrchestrator.createOrdersForContactSold({
        contactId: String(contact._id),
        soldQuoterId: String(contact.soldQuoterId),
        fileId: String(bookingFile._id),
        changedBy: req.user?.id || null,
      });
      return res.status(200).json(result);
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error syncing service orders',
        errorCode: 'SERVICE_ORDER_SYNC_FAILED',
      });
    }
  }
}

module.exports = new ServiceOrdersController();
