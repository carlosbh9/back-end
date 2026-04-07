const express = require('express');
const { authorizePermissions } = require('../../middlewares/auth');
const controller = require('./serviceOrderTemplates.controller');
const { PERMISSIONS } = require('../../security/permissions');

const router = express.Router();

// Template governance via backend permissions, keeping admin as global override.
router.get('/', authorizePermissions([PERMISSIONS.SERVICE_ORDER_TEMPLATES_MANAGE]), (req, res) => controller.list(req, res));
router.get('/:id', authorizePermissions([PERMISSIONS.SERVICE_ORDER_TEMPLATES_MANAGE]), (req, res) => controller.getById(req, res));
router.put('/', authorizePermissions([PERMISSIONS.SERVICE_ORDER_TEMPLATES_MANAGE]), (req, res) => controller.upsert(req, res));
router.delete('/:id', authorizePermissions([PERMISSIONS.SERVICE_ORDER_TEMPLATES_MANAGE]), (req, res) => controller.remove(req, res));

module.exports = router;
