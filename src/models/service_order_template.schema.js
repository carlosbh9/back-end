const mongoose = require('mongoose');
const { Schema } = mongoose;

const ORDER_AREAS = ['RESERVAS', 'OPERACIONES', 'CONTABILIDAD', 'PAGOS'];
const ORDER_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS', 'PREPAYMENT', 'INVOICE'];
const ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const checklistTemplateSchema = new Schema({
  itemId: { type: String, required: true },
  label: { type: String, required: true }
}, { _id: false });

const serviceOrderTemplateSchema = new Schema({
  type: { type: String, enum: ORDER_TYPES, required: true, unique: true, index: true },
  area: { type: String, enum: ORDER_AREAS, required: true },
  defaultPriority: { type: String, enum: ORDER_PRIORITIES, default: 'MEDIUM' },
  slaDays: { type: Number, default: 2, min: 0 },
  checklistTemplate: { type: [checklistTemplateSchema], default: [] },
  blocking: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ServiceOrderTemplate', serviceOrderTemplateSchema);
