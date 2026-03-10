const templateService = require('../../Services/service-orders/service-order-template.service');

class ServiceOrderTemplatesController {
  async list(_req, res) {
    try {
      const items = await templateService.list();
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: 'Error listing templates', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await templateService.getById(req.params.id);
      if (!item) return res.status(404).json({ message: 'Template not found' });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching template', error: error.message });
    }
  }

  async upsert(req, res) {
    try {
      const item = await templateService.upsertByType(req.body || {});
      return res.status(200).json(item);
    } catch (error) {
      return res.status(400).json({ message: 'Error upserting template', error: error.message });
    }
  }

  async remove(req, res) {
    try {
      const item = await templateService.deleteById(req.params.id);
      if (!item) return res.status(404).json({ message: 'Template not found' });
      return res.status(200).json({ ok: true, deletedId: item._id });
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
  }
}

module.exports = new ServiceOrderTemplatesController();
