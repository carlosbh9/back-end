const serviceOrderService = require('../../Services/service-orders/service-order.service');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');
const Contact = require('../../models/contact.schema');

class ServiceOrdersController {
  async list(req, res) {
    try {
      const result = await serviceOrderService.list({
        ...(req.query || {}),
        userRole: req.user?.role || ''
      });
      const kpis = await serviceOrderService.getKpisByArea();
      return res.status(200).json({ ...result, kpis });
    } catch (error) {
      return res.status(500).json({ message: 'Error listing service orders', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await serviceOrderService.getById(req.params.id, req.user?.role || '');
      if (!item) return res.status(404).json({ message: 'Service order not found' });
      return res.status(200).json(item);
    } catch (error) {
      const code = error.message?.includes('permissions') ? 403 : 500;
      return res.status(code).json({ message: 'Error fetching service order', error: error.message });
    }
  }

  async getByContact(req, res) {
    try {
      const items = await serviceOrderService.getByContact(req.params.contactId, req.user?.role || '');
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching contact service orders', error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status, reason = '' } = req.body || {};
      if (!status) return res.status(400).json({ message: 'status is required' });

      const item = await serviceOrderService.updateStatus({
        id: req.params.id,
        status,
        reason,
        userId: req.user?.id || null,
        userRole: req.user?.role || ''
      });
      if (!item) return res.status(404).json({ message: 'Service order not found' });
      return res.status(200).json(item);
    } catch (error) {
      const code = error.message?.includes('permissions') || error.message?.includes('Only admin')
        ? 403
        : 400;
      return res.status(code).json({ message: 'Error updating status', error: error.message });
    }
  }

  async assign(req, res) {
    try {
      const { assigneeId } = req.body || {};
      const item = await serviceOrderService.assign({
        id: req.params.id,
        assigneeId: assigneeId || null,
        userId: req.user?.id || null,
        userRole: req.user?.role || ''
      });
      if (!item) return res.status(404).json({ message: 'Service order not found' });
      return res.status(200).json(item);
    } catch (error) {
      const code = error.message?.includes('permissions') ? 403 : 400;
      return res.status(code).json({ message: 'Error assigning service order', error: error.message });
    }
  }

  async updateChecklistItem(req, res) {
    try {
      const { done } = req.body || {};
      const item = await serviceOrderService.updateChecklistItem({
        id: req.params.id,
        itemId: req.params.itemId,
        done: !!done,
        userId: req.user?.id || null,
        userRole: req.user?.role || ''
      });
      if (!item) return res.status(404).json({ message: 'Service order or checklist item not found' });
      return res.status(200).json(item);
    } catch (error) {
      const code = error.message?.includes('permissions') ? 403 : 400;
      return res.status(code).json({ message: 'Error updating checklist item', error: error.message });
    }
  }

  async syncByContact(req, res) {
    try {
      const contact = await Contact.findById(req.params.contactId).select('_id soldQuoterId').lean();
      if (!contact) return res.status(404).json({ message: 'Contact not found' });
      if (!contact.soldQuoterId) {
        return res.status(400).json({ message: 'Contact has no soldQuoterId to sync' });
      }

      const result = await serviceOrderOrchestrator.createOrdersForContactSold({
        contactId: String(contact._id),
        soldQuoterId: String(contact.soldQuoterId),
        changedBy: req.user?.id || null
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: 'Error syncing service orders', error: error.message });
    }
  }
}

module.exports = new ServiceOrdersController();
