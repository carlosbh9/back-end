const ServiceOrderTemplate = require('../../models/service_order_template.schema');

function slugify(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeChecklistTemplate(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    itemId: String(item?.itemId || `item-${index + 1}`).trim(),
    label: String(item?.label || '').trim(),
    required: item?.required !== false,
    helpText: String(item?.helpText || '').trim()
  })).filter((item) => item.itemId && item.label);
}

function normalizeStages(stages = []) {
  return (Array.isArray(stages) ? stages : [])
    .map((stage, index) => ({
      code: String(stage?.code || `STAGE_${index + 1}`).trim().toUpperCase(),
      label: String(stage?.label || '').trim(),
      description: String(stage?.description || '').trim(),
      color: String(stage?.color || 'slate').trim(),
      order: Number(stage?.order) > 0 ? Number(stage.order) : index + 1,
      isFinal: stage?.isFinal === true,
      requireCommentOnEnter: stage?.requireCommentOnEnter === true,
      requireCommentOnComplete: stage?.requireCommentOnComplete === true,
      requiredAttachments: Array.isArray(stage?.requiredAttachments) ? stage.requiredAttachments : [],
      checklistTemplate: normalizeChecklistTemplate(stage?.checklistTemplate || [])
    }))
    .filter((stage) => stage.code && stage.label)
    .sort((a, b) => a.order - b.order);
}

class ServiceOrderTemplateService {
  async list() {
    return ServiceOrderTemplate.find().sort({ type: 1, name: 1 }).lean();
  }

  async getById(id) {
    return ServiceOrderTemplate.findById(id).lean();
  }

  async upsert(payload) {
    const type = String(payload?.type || '').trim();
    const area = String(payload?.area || '').trim();
    const name = String(payload?.name || '').trim();
    const code = slugify(payload?.code || name || `${type}-template`);
    const stages = normalizeStages(payload?.stages || []);

    if (!type || !area || !name) {
      throw new Error('type, area and name are required');
    }

    if (!stages.length) {
      throw new Error('At least one stage is required');
    }

    const defaultStageCode = String(payload?.defaultStageCode || stages[0]?.code || '').trim().toUpperCase();
    if (!stages.some((stage) => stage.code === defaultStageCode)) {
      throw new Error('defaultStageCode must exist in stages');
    }

    const finalStages = stages.filter((stage) => stage.isFinal);
    if (!finalStages.length) {
      throw new Error('At least one final stage is required');
    }

    const safePayload = {
      code,
      name,
      active: payload?.active !== false,
      isDefault: payload?.isDefault === true,
      type,
      area,
      defaultPriority: payload?.defaultPriority || 'MEDIUM',
      slaDays: Number(payload?.slaDays) >= 0 ? Number(payload.slaDays) : 2,
      defaultStageCode,
      stages,
      blocking: payload?.blocking !== false
    };

    if (safePayload.isDefault) {
      await ServiceOrderTemplate.updateMany(
        { type: safePayload.type, _id: { $ne: payload?._id || null } },
        { $set: { isDefault: false } }
      );
    }

    if (payload?._id) {
      return ServiceOrderTemplate.findByIdAndUpdate(
        payload._id,
        { $set: safePayload },
        { new: true, runValidators: true }
      ).lean();
    }

    return ServiceOrderTemplate.findOneAndUpdate(
      { code },
      { $set: safePayload },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  }

  async deleteById(id) {
    return ServiceOrderTemplate.findByIdAndDelete(id).lean();
  }
}

module.exports = new ServiceOrderTemplateService();
