const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const publicBookingLinkSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, default: '' },
    publicUrl: { type: String},
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'used', 'revoked', 'expired'],
      default: 'active',
      index: true
    },
    submission: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PublicBookingLink', publicBookingLinkSchema);
