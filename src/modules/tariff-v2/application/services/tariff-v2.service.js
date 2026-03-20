const TariffItemV2Model = require('../../infrastructure/mongoose/tariff-item-v2.schema');
const { isValidObjectId } = require('mongoose');

class TariffV2Service {
  async list(query = {}) {
    const filters = this.buildFilters(query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const sort = { [query.sortBy || 'createdAt']: query.sortDir === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      TariffItemV2Model.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      TariffItemV2Model.countDocuments(filters),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getById(id) {
    this.ensureValidId(id);

    const item = await TariffItemV2Model.findById(id).lean();
    if (!item) {
      throw new Error('TARIFF_ITEM_NOT_FOUND');
    }

    return item;
  }

  async create(payload) {
    const item = await TariffItemV2Model.create({
      active: payload.active ?? true,
      status: payload.status ?? 'DRAFT',
      ...payload,
    });

    return item.toObject();
  }

  async update(id, payload) {
    this.ensureValidId(id);

    const item = await TariffItemV2Model.findByIdAndUpdate(
      id,
      { $set: payload },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!item) {
      throw new Error('TARIFF_ITEM_NOT_FOUND');
    }

    return item;
  }

  async remove(id) {
    this.ensureValidId(id);

    const deleted = await TariffItemV2Model.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new Error('TARIFF_ITEM_NOT_FOUND');
    }

    return deleted;
  }

  async getFilters() {
    const [providers, cities, years, tags] = await Promise.all([
      TariffItemV2Model.distinct('provider', { provider: { $nin: [null, ''] } }),
      TariffItemV2Model.distinct('city', { city: { $nin: [null, ''] } }),
      TariffItemV2Model.distinct('validity.year', { 'validity.year': { $nin: [null, ''] } }),
      TariffItemV2Model.distinct('tags'),
    ]);

    return {
      providers: providers.filter(Boolean).sort(),
      cities: cities.filter(Boolean).sort(),
      years: years.filter(Boolean).sort(),
      tags: tags.filter(Boolean).sort(),
    };
  }

  buildFilters(query) {
    const filters = {};

    if (query.type) filters.type = query.type;
    if (query.category) filters.category = query.category;
    if (query.status) filters.status = query.status;
    if (query.provider) filters.provider = query.provider;
    if (query.city) filters.city = query.city;
    if (typeof query.active === 'boolean') filters.active = query.active;
    if (query.year) filters['validity.year'] = query.year;

    if (query.q && String(query.q).trim()) {
      const regex = new RegExp(String(query.q).trim(), 'i');
      filters.$or = [
        { name: regex },
        { code: regex },
        { provider: regex },
        { city: regex },
        { tags: regex },
      ];
    }

    return filters;
  }

  ensureValidId(id) {
    if (!isValidObjectId(id)) {
      throw new Error('INVALID_TARIFF_ITEM_ID');
    }
  }
}

module.exports = new TariffV2Service();
