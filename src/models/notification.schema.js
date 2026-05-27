const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['SALE_CONFIRMED', 'ORDER_STATUS_CHANGED'],
    required: true,
  },
  message: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, default: null },
  entityType: { type: String, enum: ['quoter', 'service_order'], default: null },
  read: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false });

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
