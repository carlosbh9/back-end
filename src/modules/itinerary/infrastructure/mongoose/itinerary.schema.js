const mongoose = require('mongoose');
const {
  ITINERARY_STATUSES,
  ITINERARY_ITEM_TYPES,
  ITINERARY_ITEM_STATUSES,
} = require('../../domain/itinerary.types');

const { Schema } = mongoose;

const ItineraryItemSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ITINERARY_ITEM_TYPES, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    image: { type: String, default: '' },
    time: { type: String, default: '' },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ITINERARY_ITEM_STATUSES, default: 'draft' },
    isOptional: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
  },
  { _id: false }
);

const ItineraryDaySchema = new Schema(
  {
    dayNumber: { type: Number, required: true },
    location: { type: String, required: true },
    date: { type: Date, required: true },
    items: { type: [ItineraryItemSchema], default: [] },
  },
  { _id: false }
);

const ItineraryVersionSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    snapshot: { type: Object, required: true },
  },
  { _id: false }
);

const ItinerarySchema = new Schema(
  {
    tripName: { type: String, required: true },
    client: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    destinations: { type: [String], default: [] },
    days: { type: [ItineraryDaySchema], default: [] },
    status: { type: String, enum: ITINERARY_STATUSES, default: 'draft' },
    versions: { type: [ItineraryVersionSchema], default: [] },
    currentVersion: { type: String, default: 'v1' },
  },
  {
    collection: 'itineraries',
    timestamps: true,
    versionKey: false,
  }
);

ItinerarySchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Itinerary || mongoose.model('Itinerary', ItinerarySchema);
