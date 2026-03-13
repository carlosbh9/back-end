const express = require('express');
const controller = require('./serviceOrders.controller');

const router = express.Router();

router.get('/', (req, res) => controller.list(req, res));
router.post('/sync-contact/:contactId', (req, res) => controller.syncByContact(req, res));
router.get('/by-contact/:contactId', (req, res) => controller.getByContact(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.patch('/:id/status', (req, res) => controller.updateStatus(req, res));
router.patch('/:id/assign', (req, res) => controller.assign(req, res));
router.patch('/:id/checklist/:itemId', (req, res) => controller.updateChecklistItem(req, res));
router.patch('/:id/financials', (req, res) => controller.updateFinancials(req, res));
router.post('/:id/attachments/presign', (req, res) => controller.presignAttachment(req, res));
router.post('/:id/attachments', (req, res) => controller.addAttachment(req, res));
router.get('/:id/attachments/:attachmentId/open', (req, res) => controller.openAttachment(req, res));
router.delete('/:id/attachments/:attachmentId', (req, res) => controller.removeAttachment(req, res));

module.exports = router;
