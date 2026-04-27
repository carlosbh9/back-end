const mongoose = require('mongoose');
const { Schema } = mongoose;

const CHECKLIST_ITEM_STATUSES = ['PENDING', 'DONE', 'SKIPPED'];
const STAGE_STATUSES = ['PENDING', 'ACTIVE', 'DONE', 'SKIPPED'];
const ORDER_AREAS = ['RESERVAS', 'OPERACIONES', 'CONTABILIDAD', 'PAGOS'];
const ORDER_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS', 'PREPAYMENT', 'INVOICE'];
const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO', 'DONE', 'CANCELLED'];
const ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const ACCOUNTING_STATUSES = ['NOT_REQUIRED', 'PENDING_INVOICE', 'INVOICED', 'PARTIALLY_PAID', 'PAID'];
const ATTACHMENT_TYPES = ['VOUCHER', 'INVOICE', 'PAYMENT_PROOF', 'RESERVATION_CONFIRMATION', 'TICKET', 'PASSPORT_COPY', 'OTHER'];
const PAYMENT_STATUSES = ['NOT_REQUIRED', 'PENDING', 'PARTIAL', 'PAID', 'REFUNDED'];
const PAYMENT_METHODS = ['TRANSFER', 'CASH', 'CARD', 'CHECK', 'OTHER'];
const STAGE_COLORS = ['slate', 'blue', 'amber', 'emerald', 'rose', 'violet', 'sky', 'teal', 'orange', 'indigo', 'fuchsia'];

const dependencySchema = new Schema({
  dependsOnOrderId: { type: Schema.Types.ObjectId, ref: 'ServiceOrder', required: true },
  relation: { type: String, enum: ['BLOCKING', 'RELATED'], default: 'BLOCKING' }
}, { _id: false });

const checklistItemSchema = new Schema({
  itemId: { type: String, required: true },
  label: { type: String, required: true },
  required: { type: Boolean, default: true },
  helpText: { type: String, default: '' },
  status: { type: String, enum: CHECKLIST_ITEM_STATUSES, default: 'PENDING' },
  doneAt: { type: Date, default: null },
  doneBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: false });

const stageSnapshotSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  color: { type: String, enum: STAGE_COLORS, default: 'slate' },
  order: { type: Number, required: true, min: 1 },
  isFinal: { type: Boolean, default: false },
  requireCommentOnEnter: { type: Boolean, default: false },
  requireCommentOnComplete: { type: Boolean, default: false },
  requiredAttachments: { type: [{ type: String, enum: ATTACHMENT_TYPES }], default: [] },
  status: { type: String, enum: STAGE_STATUSES, default: 'PENDING' },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  checklist: { type: [checklistItemSchema], default: [] }
}, { _id: false });

const auditLogSchema = new Schema({
  action: { type: String, required: true },
  at: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  message: { type: String, default: '' },
  payload: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const attachmentSchema = new Schema({
  attachmentId: { type: String, required: true },
  type: { type: String, enum: ATTACHMENT_TYPES, default: 'OTHER', required: true },
  fileName: { type: String, required: true },
  url: { type: String, default: '' },
  storageKey: { type: String, default: '' },
  contentType: { type: String, default: '' },
  notes: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: false });

const financialsSchema = new Schema({
  supplierName: { type: String, default: '' },
  supplierReference: { type: String, default: '' },
  currency: { type: String, default: 'USD' },
  expectedCost: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'NOT_REQUIRED' },
  paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'OTHER' },
  paymentDueDate: { type: Date, default: null },
  paymentDate: { type: Date, default: null },
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: Date, default: null }
}, { _id: false });

const serviceOrderSchema = new Schema({
  file_id: { type: Schema.Types.ObjectId, ref: 'BookingFile', required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  soldQuoterId: { type: Schema.Types.ObjectId, ref: 'QuoterV2', required: true, index: true },
  sourceQuoterId: { type: Schema.Types.ObjectId, ref: 'QuoterV2', required: true, index: true },
  businessEventId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },

  area: { type: String, enum: ORDER_AREAS, required: true, index: true },
  type: { type: String, enum: ORDER_TYPES, required: true, index: true },
  status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
  priority: { type: String, enum: ORDER_PRIORITIES, default: 'MEDIUM' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  dueDate: { type: Date, default: null, index: true },

  workflowTemplateId: { type: Schema.Types.ObjectId, ref: 'ServiceOrderTemplate', default: null, index: true },
  workflowTemplateCode: { type: String, default: '', trim: true, index: true },
  workflowTemplateName: { type: String, default: '', trim: true },
  currentStageCode: { type: String, default: '', trim: true, uppercase: true, index: true },
  currentStageLabel: { type: String, default: '', trim: true },
  stagesSnapshot: { type: [stageSnapshotSchema], default: [] },

  dependencies: { type: [dependencySchema], default: [] },
  checklist: { type: [checklistItemSchema], default: [] },

  sourceSnapshot: { type: Schema.Types.Mixed, required: true },
  accountingStatus: { type: String, enum: ACCOUNTING_STATUSES, default: 'NOT_REQUIRED' },
  financials: { type: financialsSchema, default: () => ({}) },
  attachments: { type: [attachmentSchema], default: [] },
  auditLogs: { type: [auditLogSchema], default: [] },
  lastStatusChangeAt: { type: Date, default: Date.now },
  lastStageChangeAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancellationReason: { type: String, default: '', trim: true },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

serviceOrderSchema.index({ area: 1, status: 1, dueDate: 1 });
serviceOrderSchema.index({ contactId: 1, soldQuoterId: 1, type: 1 });
serviceOrderSchema.index({ file_id: 1, area: 1, status: 1 });

module.exports = mongoose.model('ServiceOrder', serviceOrderSchema);
