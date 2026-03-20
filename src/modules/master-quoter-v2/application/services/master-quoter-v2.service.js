const { isValidObjectId } = require('mongoose');
const MasterQuoterV2Model = require('../../infrastructure/mongoose/master-quoter-v2.schema');
const TariffItemV2Model = require('../../../tariff-v2/infrastructure/mongoose/tariff-item-v2.schema');

class MasterQuoterV2Service {
  async list(query = {}) {
    const filters = this.buildFilters(query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const sort = { [query.sortBy || 'updatedAt']: query.sortDir === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      MasterQuoterV2Model.find(filters).sort(sort).skip(skip).limit(limit).lean(),
      MasterQuoterV2Model.countDocuments(filters),
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
    const item = await MasterQuoterV2Model.findById(id).lean();
    if (!item) {
      throw new Error('MASTER_QUOTER_V2_NOT_FOUND');
    }
    return item;
  }

  async getResolvedById(id) {
    const template = await this.getById(id);
    const tariffIds = this.collectTariffIds(template.days || []);

    const tariffItems = await TariffItemV2Model.find({ _id: { $in: tariffIds } })
      .select('_id name type category provider city active status validity pricing')
      .lean();

    const tariffMap = new Map(tariffItems.map((item) => [String(item._id), item]));

    return {
      ...template,
      days: (template.days || []).map((day) => ({
        ...day,
        items: (day.items || []).map((item) => ({
          ...item,
          tariffItem: tariffMap.get(String(item.tariffItemId)) || null,
        })),
      })),
    };
  }

  async create(payload) {
    const hydratedDays = await this.hydrateDayItemSnapshots(payload.days || []);
    const item = await MasterQuoterV2Model.create({
      active: payload.active ?? true,
      status: payload.status ?? 'DRAFT',
      ...payload,
      days: hydratedDays,
    });
    return item.toObject();
  }

  async update(id, payload) {
    this.ensureValidId(id);

    const current = await MasterQuoterV2Model.findById(id).lean();
    if (!current) {
      throw new Error('MASTER_QUOTER_V2_NOT_FOUND');
    }

    const nextDocument = {
      ...current,
      ...payload,
      days: payload.days !== undefined ? payload.days : current.days,
      totalDays: payload.totalDays !== undefined ? payload.totalDays : current.totalDays,
    };

    const hydratedDays = await this.hydrateDayItemSnapshots(nextDocument.days || []);

    const item = await MasterQuoterV2Model.findByIdAndUpdate(
      id,
      { $set: { ...payload, ...(payload.days !== undefined ? { days: hydratedDays } : {}) } },
      { new: true, runValidators: true },
    ).lean();

    return item;
  }

  async remove(id) {
    this.ensureValidId(id);
    const deleted = await MasterQuoterV2Model.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new Error('MASTER_QUOTER_V2_NOT_FOUND');
    }
    return deleted;
  }

  buildFilters(query) {
    const filters = {};

    if (query.type) filters.type = query.type;
    if (query.status) filters.status = query.status;
    if (typeof query.active === 'boolean') filters.active = query.active;

    if (query.q && String(query.q).trim()) {
      const regex = new RegExp(String(query.q).trim(), 'i');
      filters.$or = [
        { name: regex },
        { destinations: regex },
        { notes: regex },
      ];
    }

    return filters;
  }

  collectTariffIds(days) {
    const ids = [];
    days.forEach((day) => {
      (day.items || []).forEach((item) => {
        if (item.tariffItemId) {
          ids.push(item.tariffItemId);
        }
      });
    });
    return [...new Set(ids.map((id) => String(id)))];
  }

  async ensureTariffReferencesExist(days) {
    const ids = this.collectTariffIds(days);
    if (ids.length === 0) {
      return [];
    }

    const items = await TariffItemV2Model.find({ _id: { $in: ids } })
      .select('_id name type category provider city')
      .lean();

    const foundSet = new Set(items.map((item) => String(item._id)));
    const missing = ids.filter((id) => !foundSet.has(String(id)));

    if (missing.length > 0) {
      const error = new Error('MASTER_QUOTER_V2_INVALID_TARIFF_REFERENCES');
      error.details = { missingTariffItemIds: missing };
      throw error;
    }

    return items;
  }

  async hydrateDayItemSnapshots(days) {
    const tariffItems = await this.ensureTariffReferencesExist(days);
    const tariffMap = new Map(tariffItems.map((item) => [String(item._id), item]));

    return (days || []).map((day) => ({
      ...day,
      items: (day.items || []).map((item) => {
        const tariffItem = tariffMap.get(String(item.tariffItemId));

        return {
          ...item,
          tariffSnapshot: tariffItem ? {
            name: tariffItem.name,
            type: tariffItem.type,
            category: tariffItem.category,
            provider: tariffItem.provider,
            city: tariffItem.city,
          } : item.tariffSnapshot,
        };
      }),
    }));
  }

  ensureValidId(id) {
    if (!isValidObjectId(id)) {
      throw new Error('INVALID_MASTER_QUOTER_V2_ID');
    }
  }
}

module.exports = new MasterQuoterV2Service();
