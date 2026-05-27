const express = require('express');
const controller = require('./notifications.controller');

const router = express.Router();

router.get('/', (req, res) => controller.list(req, res));
router.get('/unread-count', (req, res) => controller.unreadCount(req, res));
router.patch('/read-all', (req, res) => controller.markAllRead(req, res));
router.patch('/:id/read', (req, res) => controller.markRead(req, res));

module.exports = router;
