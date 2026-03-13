const express = require('express');

function createCrudRouter(Model, options = {}) {
  const router = express.Router();
  const {
    listQueryBuilder = null,
    createPayload = null,
  } = options;

  router.post('/', async (req, res) => {
    try {
      const payload = createPayload ? createPayload(req) : req.body;
      const doc = new Model(payload);
      await doc.save();
      res.status(201).send(doc);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  router.get('/', async (req, res) => {
    try {
      const query = listQueryBuilder ? listQueryBuilder(req) : Model.find();
      const docs = await query;
      res.status(200).send(docs);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) {
        return res.status(404).send();
      }
      res.status(200).send(doc);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) {
        return res.status(404).send();
      }
      res.status(200).send(doc);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) {
        return res.status(404).send();
      }
      res.status(200).send(doc);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  return router;
}

module.exports = createCrudRouter;
