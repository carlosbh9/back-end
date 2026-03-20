const express = require('express');
const masterQuoterV2Controller = require('./master-quoter-v2.controller');

const router = express.Router();

router.get('/options', (req, res) => masterQuoterV2Controller.getOptions(req, res));
router.get('/templates', (req, res) => masterQuoterV2Controller.list(req, res));
router.get('/templates/:id', (req, res) => masterQuoterV2Controller.getById(req, res));
router.get('/templates/:id/resolved', (req, res) => masterQuoterV2Controller.getResolvedById(req, res));
router.post('/templates', (req, res) => masterQuoterV2Controller.create(req, res));
router.patch('/templates/:id', (req, res) => masterQuoterV2Controller.update(req, res));
router.delete('/templates/:id', (req, res) => masterQuoterV2Controller.remove(req, res));

module.exports = router;
