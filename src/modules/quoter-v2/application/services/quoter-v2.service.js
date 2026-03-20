const mongoose = require('mongoose');
const QuoterV2 = require('../../infrastructure/mongoose/quoter-v2.schema');
const Contact = require('../../../../models/contact.schema');
const { QUOTER_V2_SORT_FIELDS, QUOTE_V2_STATUSES } = require('../../domain/quoter-v2.types');

function buildListQuery(query = {}) {
  const mongoQuery = {};

  if (query.status && Object.values(QUOTE_V2_STATUSES).includes(query.status)) {
    mongoQuery.status = query.status;
  }

  if (query.contact_id && mongoose.Types.ObjectId.isValid(query.contact_id)) {
    mongoQuery.contact_id = query.contact_id;
  }

  if (query.q) {
    const regex = new RegExp(String(query.q).trim(), 'i');
    mongoQuery.$or = [{ guest: regex }, { name_quoter: regex }, { travel_agent: regex }];
  }

  return mongoQuery;
}

function buildSort(query = {}) {
  const sortBy = QUOTER_V2_SORT_FIELDS.includes(query.sortBy) ? query.sortBy : 'updatedAt';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;
  return { [sortBy]: sortDir };
}

class QuoterV2Service {
  async list(query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const mongoQuery = buildListQuery(query);

    const [items, total] = await Promise.all([
      QuoterV2.find(mongoQuery)
        .sort(buildSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      QuoterV2.countDocuments(mongoQuery),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return QuoterV2.findById(id).lean();
  }

  async create(payload) {
    const created = await QuoterV2.create(payload);
    await Contact.findByIdAndUpdate(
      created.contact_id,
      {
        $push: {
          cotizations: {
            name_version: created.name_quoter || 'version 1',
            quoter_model: 'v2',
            status: 'WIP',
            quoter_id: created._id,
            createQuoter: created.createdAt || new Date(),
          }
        }
      }
    );
    return created.toObject();
  }

  async update(id, payload) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const updated = await QuoterV2.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return null;

    await Contact.findOneAndUpdate(
      { 'cotizations.quoter_id': updated._id },
      {
        $set: {
          'cotizations.$[quote].name_version': updated.name_quoter || 'version 1',
        }
      },
      {
        arrayFilters: [{ 'quote.quoter_id': updated._id }],
      }
    );

    return updated;
  }

  async remove(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const deleted = await QuoterV2.findByIdAndDelete(id).lean();
    if (!deleted) return null;

    await Contact.findOneAndUpdate(
      { 'cotizations.quoter_id': deleted._id },
      { $pull: { cotizations: { quoter_id: deleted._id } } }
    );

    return deleted;
  }
}

module.exports = new QuoterV2Service();
