const express = require('express');
const { authorize } = require('../../middlewares/auth');
const controller = require('./serviceOrderTemplates.controller');

const router = express.Router();

// Admin-only endpoints for template governance.
router.get('/', authorize(['admin']), (req, res) => controller.list(req, res));
router.get('/:id', authorize(['admin']), (req, res) => controller.getById(req, res));
router.put('/', authorize(['admin']), (req, res) => controller.upsert(req, res));
router.delete('/:id', authorize(['admin']), (req, res) => controller.remove(req, res));

module.exports = router;
