const express = require('express');
const controller = require('./itinerary-launch.controller');
const { authenticate } = require('../../../middlewares/auth');

const router = express.Router();

router.post('/token', authenticate, (req, res) => controller.issue(req, res));
router.post('/consume', (req, res) => controller.consume(req, res));

module.exports = router;
