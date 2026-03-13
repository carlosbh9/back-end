function attachNestedArrayCrudRoutes(router, Model, config) {
  const {
    parentParam,
    arrayField,
    routeSegment = arrayField,
    notFoundMessage,
    deleteNotFoundMessage,
  } = config;

  router.post(`/:${parentParam}/${routeSegment}`, async (req, res) => {
    const parentId = req.params[parentParam];
    const newItem = req.body;

    try {
      const parentDoc = await Model.findById(parentId);
      if (!parentDoc) {
        return res.status(404).send({ message: notFoundMessage });
      }

      parentDoc[arrayField].push(newItem);
      await parentDoc.save();
      res.status(201).send(newItem);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  router.get(`/:${parentParam}/${routeSegment}`, async (req, res) => {
    const parentId = req.params[parentParam];

    try {
      const parentDoc = await Model.findById(parentId).select(arrayField);
      if (!parentDoc) {
        return res.status(404).send({ message: notFoundMessage });
      }

      res.status(200).send(parentDoc[arrayField]);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  router.get(`/:${parentParam}/${routeSegment}/:serviceId`, async (req, res) => {
    const parentId = req.params[parentParam];
    const { serviceId } = req.params;

    try {
      const parentDoc = await Model.findById(parentId);
      if (!parentDoc) {
        return res.status(404).send({ message: notFoundMessage });
      }

      const nestedDoc = parentDoc[arrayField].id(serviceId);
      if (!nestedDoc) {
        return res.status(404).send({ message: 'Service not found' });
      }

      res.status(200).send(nestedDoc);
    } catch (error) {
      res.status(400).send({ message: 'Error retrieving service', error });
    }
  });

  router.patch(`/:${parentParam}/${routeSegment}/:serviceId`, async (req, res) => {
    const parentId = req.params[parentParam];
    const { serviceId } = req.params;

    try {
      const parentDoc = await Model.findById(parentId);
      if (!parentDoc) {
        return res.status(404).send({ message: notFoundMessage });
      }

      const nestedDoc = parentDoc[arrayField].id(serviceId);
      if (!nestedDoc) {
        return res.status(404).send({ message: 'Service not found' });
      }

      nestedDoc.set(req.body);
      await parentDoc.save();
      res.status(200).send(nestedDoc);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  router.delete(`/:${parentParam}/${routeSegment}/:serviceId`, async (req, res) => {
    const parentId = req.params[parentParam];
    const { serviceId } = req.params;

    try {
      const updatedDoc = await Model.findByIdAndUpdate(
        parentId,
        { $pull: { [arrayField]: { _id: serviceId } } },
        { new: true }
      );

      if (!updatedDoc) {
        return res.status(404).send({ message: deleteNotFoundMessage });
      }

      res.status(200).send({ message: 'Service deleted' });
    } catch (error) {
      res.status(400).send({ message: 'Error deleting service', error });
    }
  });
}

module.exports = attachNestedArrayCrudRoutes;
