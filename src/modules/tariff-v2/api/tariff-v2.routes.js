const express = require('express');
const tariffV2Controller = require('./tariff-v2.controller');

const router = express.Router();

router.get('/options', (req, res) => tariffV2Controller.getOptions(req, res));
router.get('/filters', (req, res) => tariffV2Controller.getFilters(req, res));
router.get('/items', (req, res) => tariffV2Controller.list(req, res));
router.get('/items/:id', (req, res) => tariffV2Controller.getById(req, res));
router.post('/items', (req, res) => tariffV2Controller.create(req, res));
router.patch('/items/:id', (req, res) => tariffV2Controller.update(req, res));
router.delete('/items/:id', (req, res) => tariffV2Controller.remove(req, res));

module.exports = router;
