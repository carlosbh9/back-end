const masterQuoterV2Service = require('../application/services/master-quoter-v2.service');
const { buildCreateMasterQuoterV2Dto } = require('../application/dto/create-master-quoter-v2.dto');
const { buildUpdateMasterQuoterV2Dto } = require('../application/dto/update-master-quoter-v2.dto');
const { buildListMasterQuotersV2QueryDto } = require('../application/dto/list-master-quoters-v2.dto');
const {
  ALLOWED_SORT_FIELDS,
  validateAndNormalizeListQuery,
  validateCreatePayload,
  validateUpdatePayload,
} = require('../application/validators/master-quoter-v2.validators');
const masterQuoterV2Types = require('../domain/master-quoter-v2.types');

function resolveError(res, error, fallbackMessage) {
  if (error instanceof Error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, details: error.details || null });
    }

    if (error.message === 'INVALID_MASTER_QUOTER_V2_ID') {
      return res.status(400).json({ message: 'Invalid master-quoter-v2 id' });
    }

    if (error.message === 'MASTER_QUOTER_V2_NOT_FOUND') {
      return res.status(404).json({ message: 'Master Quoter V2 not found' });
    }

    if (error.message === 'MASTER_QUOTER_V2_INVALID_TARIFF_REFERENCES') {
      return res.status(400).json({ message: 'Some tariff-v2 references do not exist', details: error.details || null });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Master Quoter V2 validation failed', error: error.message });
    }
  }

  return res.status(500).json({ message: fallbackMessage, error });
}

class MasterQuoterV2Controller {
  async list(req, res) {
    try {
      const rawQuery = buildListMasterQuotersV2QueryDto({
        q: req.query.q,
        type: req.query.type,
        status: req.query.status,
        active: req.query.active === undefined ? undefined : req.query.active === 'true',
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      const query = validateAndNormalizeListQuery(rawQuery);
      console.log('[master-quoter-v2] list query', query);
      const result = await masterQuoterV2Service.list(query);
      console.log('[master-quoter-v2] list result count', result.pagination?.total, result.items?.map((item) => ({ id: item._id, name: item.name, type: item.type, active: item.active, totalDays: item.totalDays })));
      return res.status(200).json(result);
    } catch (error) {
      return resolveError(res, error, 'Failed to list master-quoter-v2 templates');
    }
  }

  async getById(req, res) {
    try {
      const item = await masterQuoterV2Service.getById(req.params.id);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to get master-quoter-v2 template');
    }
  }

  async getResolvedById(req, res) {
    try {
      const item = await masterQuoterV2Service.getResolvedById(req.params.id);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to resolve master-quoter-v2 template');
    }
  }

  async create(req, res) {
    try {
      const payload = buildCreateMasterQuoterV2Dto(req.body);
      validateCreatePayload(payload);
      const item = await masterQuoterV2Service.create(payload);
      return res.status(201).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to create master-quoter-v2 template');
    }
  }

  async update(req, res) {
    try {
      const payload = buildUpdateMasterQuoterV2Dto(req.body);
      validateUpdatePayload(payload);
      const item = await masterQuoterV2Service.update(req.params.id, payload);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to update master-quoter-v2 template');
    }
  }

  async remove(req, res) {
    try {
      const item = await masterQuoterV2Service.remove(req.params.id);
      return res.status(200).json(item);
    } catch (error) {
      return resolveError(res, error, 'Failed to delete master-quoter-v2 template');
    }
  }

  async getOptions(_req, res) {
    return res.status(200).json({
      types: masterQuoterV2Types.MASTER_QUOTER_V2_TYPES,
      placements: masterQuoterV2Types.MASTER_QUOTER_V2_ITEM_PLACEMENTS,
      statuses: masterQuoterV2Types.MASTER_QUOTER_V2_STATUSES,
      sortFields: ALLOWED_SORT_FIELDS,
    });
  }
}

module.exports = new MasterQuoterV2Controller();
