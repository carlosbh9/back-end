const mongoose = require('mongoose');
const { Schema } = mongoose;

const ORDER_AREAS = ['RESERVAS', 'OPERACIONES', 'CONTABILIDAD', 'PAGOS'];
const ORDER_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS', 'PREPAYMENT', 'INVOICE'];
const ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STAGE_COLORS = ['slate', 'blue', 'amber', 'emerald', 'rose', 'violet', 'sky', 'teal', 'orange', 'indigo', 'fuchsia'];
const ATTACHMENT_TYPES = ['VOUCHER', 'INVOICE', 'PAYMENT_PROOF', 'RESERVATION_CONFIRMATION', 'TICKET', 'PASSPORT_COPY', 'OTHER'];

const checklistTemplateItemSchema = new Schema({
  itemId: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  required: { type: Boolean, default: true },
  helpText: { type: String, default: '', trim: true }
}, { _id: false });

const stageTemplateSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  color: { type: String, enum: STAGE_COLORS, default: 'slate' },
  order: { type: Number, required: true, min: 1 },
  isFinal: { type: Boolean, default: false },
  requireCommentOnEnter: { type: Boolean, default: false },
  requireCommentOnComplete: { type: Boolean, default: false },
  requiredAttachments: { type: [{ type: String, enum: ATTACHMENT_TYPES }], default: [] },
  checklistTemplate: { type: [checklistTemplateItemSchema], default: [] }
}, { _id: false });

const serviceOrderTemplateSchema = new Schema({
  code: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true, index: true },
  isDefault: { type: Boolean, default: false, index: true },
  type: { type: String, enum: ORDER_TYPES, required: true, index: true },
  area: { type: String, enum: ORDER_AREAS, required: true },
  defaultPriority: { type: String, enum: ORDER_PRIORITIES, default: 'MEDIUM' },
  slaDays: { type: Number, default: 2, min: 0 },
  defaultStageCode: { type: String, required: true, trim: true, uppercase: true },
  stages: { type: [stageTemplateSchema], default: [] },
  blocking: { type: Boolean, default: true }
}, { timestamps: true });

serviceOrderTemplateSchema.index({ type: 1, active: 1, isDefault: 1 });

module.exports = mongoose.model('ServiceOrderTemplate', serviceOrderTemplateSchema);
