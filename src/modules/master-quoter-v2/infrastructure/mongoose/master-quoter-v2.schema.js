const mongoose = require('mongoose');
const { MASTER_QUOTER_V2_ITEM_PLACEMENTS, MASTER_QUOTER_V2_STATUSES, MASTER_QUOTER_V2_TYPES } = require('../../domain/master-quoter-v2.types');
const { Schema } = mongoose;

const TariffSnapshotSchema = new Schema({
  name: { type: String, trim: true },
  type: { type: String, trim: true },
  category: { type: String, trim: true },
  provider: { type: String, trim: true },
  city: { type: String, trim: true },
}, { _id: false });

const MasterQuoterV2ItemSchema = new Schema({
  placement: { type: String, enum: MASTER_QUOTER_V2_ITEM_PLACEMENTS, required: true, default: 'services' },
  tariffItemId: { type: Schema.Types.ObjectId, ref: 'TariffItemV2', required: true },
  itemOrder: { type: Number, default: 0, min: 0 },
  title: { type: String, trim: true },
  notes: { type: String, trim: true },
  tariffSnapshot: { type: TariffSnapshotSchema, default: undefined },
}, { _id: true });

const MasterQuoterV2DaySchema = new Schema({
  dayNumber: { type: Number, required: true, min: 1 },
  city: { type: String, trim: true },
  title: { type: String, trim: true },
  notes: { type: String, trim: true },
  items: { type: [MasterQuoterV2ItemSchema], default: [] },
}, { _id: true });

const MasterQuoterV2Schema = new Schema({
  name: { type: String, required: true, trim: true, index: true },
  type: { type: String, enum: MASTER_QUOTER_V2_TYPES, required: true, default: 'TEMPLATE', index: true },
  destinations: { type: String, trim: true },
  totalDays: { type: Number, required: true, min: 1 },
  status: { type: String, enum: MASTER_QUOTER_V2_STATUSES, required: true, default: 'DRAFT', index: true },
  active: { type: Boolean, required: true, default: true, index: true },
  notes: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed, default: undefined },
  days: { type: [MasterQuoterV2DaySchema], default: [] },
}, {
  collection: 'master_quoters_v2',
  timestamps: true,
  versionKey: false,
});

MasterQuoterV2Schema.index({ type: 1, status: 1, active: 1 });
MasterQuoterV2Schema.index({ 'days.dayNumber': 1 });
MasterQuoterV2Schema.index({ 'days.items.tariffItemId': 1 });

MasterQuoterV2Schema.path('days').validate({
  validator: function validateDays(days) {
    if (!Array.isArray(days) || days.length === 0) return false;

    const uniqueDayNumbers = new Set(days.map((day) => day.dayNumber));
    if (uniqueDayNumbers.size !== days.length) return false;

    const maxDayNumber = Math.max(...days.map((day) => day.dayNumber));
    if (this.totalDays && maxDayNumber > this.totalDays) return false;

    return days.every((day) => Array.isArray(day.items));
  },
  message: 'days must contain unique dayNumber values and stay within totalDays',
});

module.exports = mongoose.models.MasterQuoterV2 || mongoose.model('MasterQuoterV2', MasterQuoterV2Schema);
