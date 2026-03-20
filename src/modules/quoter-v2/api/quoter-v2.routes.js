const express = require('express');
const controller = require('./quoter-v2.controller');

const router = express.Router();

router.get('/options', (req, res) => controller.getOptions(req, res));
router.get('/quoters', (req, res) => controller.list(req, res));
router.get('/quoters/:id', (req, res) => controller.getById(req, res));
router.post('/quoters', (req, res) => controller.create(req, res));
router.patch('/quoters/:id', (req, res) => controller.update(req, res));
router.delete('/quoters/:id', (req, res) => controller.remove(req, res));
router.post('/quoters/:id/confirm-sale', (req, res) => controller.confirmSale(req, res));
router.post('/calculate-prices', (req, res) => controller.calculatePrices(req, res));

module.exports = router;
