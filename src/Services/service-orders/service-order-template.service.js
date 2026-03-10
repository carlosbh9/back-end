const ServiceOrderTemplate = require('../../models/service_order_template.schema');

class ServiceOrderTemplateService {
  async list() {
    return ServiceOrderTemplate.find().sort({ type: 1 }).lean();
  }

  async getById(id) {
    return ServiceOrderTemplate.findById(id).lean();
  }

  async upsertByType(payload) {
    const { type, area, defaultPriority = 'MEDIUM', slaDays = 2, checklistTemplate = [], blocking = true } = payload;
    if (!type || !area) {
      throw new Error('type and area are required');
    }

    return ServiceOrderTemplate.findOneAndUpdate(
      { type },
      { $set: { area, defaultPriority, slaDays, checklistTemplate, blocking } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  }

  async deleteById(id) {
    return ServiceOrderTemplate.findByIdAndDelete(id).lean();
  }
}

module.exports = new ServiceOrderTemplateService();
