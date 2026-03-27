const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Itinerary = require('../../infrastructure/mongoose/itinerary.schema');
const QuoterV2 = require('../../../quoter-v2/infrastructure/mongoose/quoter-v2.schema');
const { mapQuoterToItinerary } = require('./itinerary-from-quoter.mapper');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeDestinations(destinations) {
  if (!Array.isArray(destinations)) {
    return [];
  }

  return destinations.map((d) => String(d || '').trim()).filter(Boolean);
}

function generateDays(startDate, endDate, destinations) {
  const days = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  let dayNumber = 1;

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor((end - currentDate) / msPerDay) + 1;
  const daysPerDestination = Math.max(1, Math.ceil(totalDays / Math.max(1, destinations.length)));

  while (currentDate <= end) {
    const destinationPosition = Math.floor((dayNumber - 1) / daysPerDestination);
    const location = destinations[Math.min(destinationPosition, destinations.length - 1)] || 'Destination';

    days.push({
      dayNumber,
      location,
      date: new Date(currentDate),
      items: [],
    });

    currentDate.setDate(currentDate.getDate() + 1);
    dayNumber += 1;
  }

  return days;
}

class ItineraryService {
  async list() {
    return Itinerary.find().sort({ createdAt: -1 }).lean();
  }

  async getById(id) {
    if (!isValidObjectId(id)) {
      return null;
    }

    return Itinerary.findById(id).lean();
  }

  async create(payload = {}) {
    const { tripName, client, startDate, endDate, destinations, days, status, versions, currentVersion } = payload;

    if (!tripName || !client || !startDate || !endDate || !destinations) {
      const err = new Error('Missing required fields: tripName, client, startDate, endDate, destinations');
      err.status = 400;
      throw err;
    }

    const normalizedDestinations = normalizeDestinations(destinations);
    if (normalizedDestinations.length === 0) {
      const err = new Error('destinations must contain at least one valid location');
      err.status = 400;
      throw err;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const err = new Error('Invalid startDate or endDate');
      err.status = 400;
      throw err;
    }

    if (end < start) {
      const err = new Error('endDate must be greater than or equal to startDate');
      err.status = 400;
      throw err;
    }

    const finalDays = Array.isArray(days) && days.length > 0
      ? days
      : generateDays(start, end, normalizedDestinations);

    const created = await Itinerary.create({
      tripName,
      client,
      startDate: start,
      endDate: end,
      destinations: normalizedDestinations,
      days: finalDays,
      status: status || 'draft',
      versions: Array.isArray(versions) ? versions : [],
      currentVersion: currentVersion || 'v1',
    });

    return created.toObject();
  }

  async createFromQuoter(quoterId) {
    if (!isValidObjectId(quoterId)) {
      const err = new Error('Invalid quoter id');
      err.status = 400;
      throw err;
    }

    const quoter = await QuoterV2.findById(quoterId).lean();
    if (!quoter) {
      const err = new Error('Quoter not found');
      err.status = 404;
      throw err;
    }

    const mapped = mapQuoterToItinerary(quoter);
    mapped.source_quoter_id = quoter._id;

    const created = await Itinerary.create(mapped);
    return created.toObject();
  }

  async update(id, payload = {}) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const updateData = {
      ...payload,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      updatedAt: new Date(),
    };

    return Itinerary.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
  }

  async remove(id) {
    if (!isValidObjectId(id)) {
      return null;
    }

    return Itinerary.findByIdAndDelete(id).lean();
  }

  async addItemToDay(id, dayNumber, item) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return null;
    }

    const day = itinerary.days.find((d) => d.dayNumber === Number(dayNumber));
    if (!day) {
      return { itinerary: null, reason: 'DAY_NOT_FOUND' };
    }

    day.items.push({
      id: randomUUID(),
      ...item,
      order: day.items.length,
    });

    await itinerary.save();
    return { itinerary: itinerary.toObject() };
  }

  async updateItem(id, dayNumber, itemId, updates = {}) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) return null;

    const day = itinerary.days.find((d) => d.dayNumber === Number(dayNumber));
    if (!day) {
      return { itinerary: null, reason: 'DAY_NOT_FOUND' };
    }

    const index = day.items.findIndex((x) => x.id === itemId);
    if (index === -1) {
      return { itinerary: null, reason: 'ITEM_NOT_FOUND' };
    }

    Object.assign(day.items[index], updates);
    await itinerary.save();
    return { itinerary: itinerary.toObject() };
  }

  async deleteItem(id, dayNumber, itemId) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) return null;

    const day = itinerary.days.find((d) => d.dayNumber === Number(dayNumber));
    if (!day) {
      return { itinerary: null, reason: 'DAY_NOT_FOUND' };
    }

    day.items = day.items.filter((x) => x.id !== itemId);
    await itinerary.save();
    return { itinerary: itinerary.toObject() };
  }

  async reorderItems(id, dayNumber, items = []) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) return null;

    const day = itinerary.days.find((d) => d.dayNumber === Number(dayNumber));
    if (!day) {
      return { itinerary: null, reason: 'DAY_NOT_FOUND' };
    }

    day.items = items;
    await itinerary.save();
    return { itinerary: itinerary.toObject() };
  }

  async restoreVersion(id, versionId) {
    if (!isValidObjectId(id)) {
      return null;
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return null;
    }

    const version = (itinerary.versions || []).find((v) => v.id === versionId);
    if (!version) {
      return { itinerary: null, reason: 'VERSION_NOT_FOUND' };
    }

    itinerary.tripName = version.snapshot.tripName;
    itinerary.client = version.snapshot.client;
    itinerary.startDate = new Date(version.snapshot.startDate);
    itinerary.endDate = new Date(version.snapshot.endDate);
    itinerary.destinations = version.snapshot.destinations;
    itinerary.days = version.snapshot.days;
    itinerary.status = version.snapshot.status;
    itinerary.currentVersion = version.id;
    itinerary.updatedAt = new Date();

    await itinerary.save();
    return { itinerary: itinerary.toObject() };
  }
}

module.exports = new ItineraryService();
