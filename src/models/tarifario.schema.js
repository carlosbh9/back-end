const mongoose = require('mongoose');

const tarifarioSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true,
    discriminatorKey: 'type',
    collection: 'tariffs'
  }
);

tarifarioSchema.index({ type: 1, active: 1, createdAt: -1 });

module.exports = mongoose.models.Tariff || mongoose.model('Tariff', tarifarioSchema);
