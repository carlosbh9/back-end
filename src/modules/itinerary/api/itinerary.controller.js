const itineraryService = require('../application/services/itinerary.service');

function resolveError(res, error, fallbackMessage) {
  if (error?.status) {
    return res.status(error.status).json({ message: error.message, details: error.details || null });
  }

  return res.status(500).json({ message: fallbackMessage, error: error?.message || error });
}

class ItineraryController {
  async list(_req, res) {
    try {
      const items = await itineraryService.list();
      return res.status(200).json({ data: items });
    } catch (error) {
      return resolveError(res, error, 'Error listing itineraries');
    }
  }

  async getById(req, res) {
    try {
      const item = await itineraryService.getById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      return res.status(200).json({ data: item });
    } catch (error) {
      return resolveError(res, error, 'Error loading itinerary');
    }
  }

  async create(req, res) {
    try {
      const created = await itineraryService.create(req.body);
      return res.status(201).json({ message: 'Itinerary created successfully', data: created });
    } catch (error) {
      return resolveError(res, error, 'Error creating itinerary');
    }
  }

  async createFromQuoter(req, res) {
    try {
      const created = await itineraryService.createFromQuoter(req.params.quoterId);
      return res.status(201).json({ message: 'Itinerary created from quoter successfully', data: created });
    } catch (error) {
      return resolveError(res, error, 'Error creating itinerary from quoter');
    }
  }

  async update(req, res) {
    try {
      const updated = await itineraryService.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      return res.status(200).json({ message: 'Itinerary updated successfully', data: updated });
    } catch (error) {
      return resolveError(res, error, 'Error updating itinerary');
    }
  }

  async remove(req, res) {
    try {
      const removed = await itineraryService.remove(req.params.id);
      if (!removed) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      return res.status(200).json({ message: 'Itinerary deleted successfully', data: removed });
    } catch (error) {
      return resolveError(res, error, 'Error deleting itinerary');
    }
  }

  async addItemToDay(req, res) {
    try {
      const result = await itineraryService.addItemToDay(req.params.id, req.params.dayNumber, req.body.item || req.body);
      if (!result) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      if (result.reason === 'DAY_NOT_FOUND') {
        return res.status(404).json({ error: 'Day not found' });
      }
      return res.status(200).json({ message: 'Item added successfully', data: result.itinerary });
    } catch (error) {
      return resolveError(res, error, 'Error adding item to itinerary day');
    }
  }

  async updateItem(req, res) {
    try {
      const result = await itineraryService.updateItem(req.params.id, req.params.dayNumber, req.params.itemId, req.body);
      if (!result) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      if (result.reason === 'DAY_NOT_FOUND') {
        return res.status(404).json({ error: 'Day not found' });
      }
      if (result.reason === 'ITEM_NOT_FOUND') {
        return res.status(404).json({ error: 'Item not found' });
      }
      return res.status(200).json({ message: 'Item updated successfully', data: result.itinerary });
    } catch (error) {
      return resolveError(res, error, 'Error updating itinerary item');
    }
  }

  async deleteItem(req, res) {
    try {
      const result = await itineraryService.deleteItem(req.params.id, req.params.dayNumber, req.params.itemId);
      if (!result) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      if (result.reason === 'DAY_NOT_FOUND') {
        return res.status(404).json({ error: 'Day not found' });
      }
      return res.status(200).json({ message: 'Item deleted successfully', data: result.itinerary });
    } catch (error) {
      return resolveError(res, error, 'Error deleting itinerary item');
    }
  }

  async reorderItems(req, res) {
    try {
      const result = await itineraryService.reorderItems(req.params.id, req.params.dayNumber, req.body.items || []);
      if (!result) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      if (result.reason === 'DAY_NOT_FOUND') {
        return res.status(404).json({ error: 'Day not found' });
      }
      return res.status(200).json({ message: 'Items reordered successfully', data: result.itinerary });
    } catch (error) {
      return resolveError(res, error, 'Error reordering itinerary items');
    }
  }

  async restoreVersion(req, res) {
    try {
      const result = await itineraryService.restoreVersion(req.params.id, req.params.versionId);
      if (!result) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      if (result.reason === 'VERSION_NOT_FOUND') {
        return res.status(404).json({ error: 'Version not found' });
      }
      return res.status(200).json({ message: 'Version restored successfully', data: result.itinerary });
    } catch (error) {
      return resolveError(res, error, 'Error restoring itinerary version');
    }
  }
}

module.exports = new ItineraryController();
