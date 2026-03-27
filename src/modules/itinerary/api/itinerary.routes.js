const express = require('express');
const controller = require('./itinerary.controller');

const router = express.Router();

router.get('/', (req, res) => controller.list(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.post('/', (req, res) => controller.create(req, res));
router.post('/from-quoter/:quoterId', (req, res) => controller.createFromQuoter(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.remove(req, res));

router.post('/:id/days/:dayNumber/items', (req, res) => controller.addItemToDay(req, res));
router.put('/:id/days/:dayNumber/items/:itemId', (req, res) => controller.updateItem(req, res));
router.delete('/:id/days/:dayNumber/items/:itemId', (req, res) => controller.deleteItem(req, res));
router.put('/:id/days/:dayNumber/items/reorder', (req, res) => controller.reorderItems(req, res));

router.post('/:id/versions/:versionId/restore', (req, res) => controller.restoreVersion(req, res));

module.exports = router;
