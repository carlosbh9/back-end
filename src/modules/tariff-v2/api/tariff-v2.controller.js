const tariffV2Service = require('../application/services/tariff-v2.service');
const { buildCreateTariffItemV2Dto } = require('../application/dto/create-tariff-item.dto');
const { buildListTariffItemsV2QueryDto } = require('../application/dto/list-tariff-items.dto');
const { buildUpdateTariffItemV2Dto } = require('../application/dto/update-tariff-item.dto');
const { normalizeTariffItemPayload } = require('../application/normalizers/tariff-v2.normalizer');
const tariffV2Types = require('../domain/tariff-v2.types');
const {
  ALLOWED_SORT_FIELDS,
  validateAndNormalizeListQuery,
  validateCreatePayload,
  validateUpdatePayload,
} = require('../application/validators/tariff-v2.validators');

function resolveError(res, error, fallbackMessage) {
  if (error instanceof Error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, details: error.details || null });
    }

    if (error.message === 'INVALID_TARIFF_ITEM_ID') {
      return res.status(400).json({ message: 'Invalid tariff item id' });
    }

    if (error.message === 'TARIFF_ITEM_NOT_FOUND') {
      return res.status(404).json({ message: 'Tariff item not found' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Tariff item validation failed', error: error.message });
    }
  }

  return res.status(500).json({ message: fallbackMessage, error });
}

class TariffV2Controller {
  async list(req, res) {
    try {
      const rawQuery = buildListTariffItemsV2QueryDto({
        type: req.query.type,
        category: req.query.category,
        status: req.query.status,
        provider: req.query.provider,
        city: req.query.city,
        year: req.query.year,
        q: req.query.q,
        active: req.query.active === undefined ? undefined : req.query.active === 'true',
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      const query = validateAndNormalizeListQuery(rawQuery);

      const result = await tariffV2Service.list(query);
      return res.status(200).json(result);
    } catch (error) {
      return resolveError(res, error, 'Failed to list tariff-v2 items');
    }
  }

  async getById(req, res) {
    try {
      const item = await tariffV2Service.getById(req.params.id);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to get tariff-v2 item');
    }
  }

  async create(req, res) {
    try {
      const payload = normalizeTariffItemPayload(buildCreateTariffItemV2Dto(req.body));
      validateCreatePayload(payload);
      const item = await tariffV2Service.create(payload);
      return res.status(201).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to create tariff-v2 item');
    }
  }

  async update(req, res) {
    try {
      const payload = normalizeTariffItemPayload(buildUpdateTariffItemV2Dto(req.body));
      validateUpdatePayload(payload);
      const item = await tariffV2Service.update(req.params.id, payload);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to update tariff-v2 item');
    }
  }

  async remove(req, res) {
    try {
      const item = await tariffV2Service.remove(req.params.id);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to delete tariff-v2 item');
    }
  }

  async getOptions(_req, res) {
    try {
      return res.status(200).json({
        types: tariffV2Types.TARIFF_ITEM_TYPES,
        categories: tariffV2Types.PRODUCT_CATEGORIES,
        pricingModes: tariffV2Types.PRICING_MODES,
        statuses: tariffV2Types.TARIFF_STATUSES,
        occupancyTypes: tariffV2Types.OCCUPANCY_TYPES,
        seasonTypes: tariffV2Types.SEASON_TYPES,
        childPriceTypes: tariffV2Types.CHILD_PRICE_TYPES,
        specialDateOperations: tariffV2Types.SPECIAL_DATE_OPERATIONS,
        vehicleTypes: tariffV2Types.VEHICLE_TYPES,
        sortFields: ALLOWED_SORT_FIELDS,
      });
    } catch (error) {
      return resolveError(res, error, 'Failed to get tariff-v2 options');
    }
  }

  async getFilters(_req, res) {
    try {
      const filters = await tariffV2Service.getFilters();
      return res.status(200).json(filters);
    } catch (error) {
      return resolveError(res, error, 'Failed to get tariff-v2 filters');
    }
  }
}

module.exports = new TariffV2Controller();
