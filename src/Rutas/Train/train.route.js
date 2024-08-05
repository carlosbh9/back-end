const express = require('express');
const router = express.Router();
const Train = require('../../../src/models/train.schema');

// Crear un nuevo train
router.post('/', async (req, res) => {
    try {
        const train = new Train(req.body);
        await train.save();
        res.status(201).send(train);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los trains
router.get('/', async (req, res) => {
    try {
        const trains = await Train.find();
        res.status(200).send(trains);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un train por ID
router.get('/:id', async (req, res) => {
    try {
        const train = await Train.findById(req.params.id);
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un train por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const train = await Train.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un train por ID
router.delete('/:id', async (req, res) => {
    try {
        const train = await Train.findByIdAndDelete(req.params.id);
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(500).send(error);
    }
});

//crear un nuevo servicio
router.post('/:trainId/services', async (req, res) => {
    const { trainId } = req.params;
    const newService = req.body;

    try {
        const train = await Train.findById(trainId);
        if (!train) {
            return res.status(404).send({ message: 'train not found' });
        }
        train.servicios.push(newService);
        await train.save();
        res.status(201).send(newService);
    } catch (error) {
        res.status(400).send(error);
    }
});

//obtener los servicios
router.get('/:trainId/services', async (req, res) => {
    const { trainId } = req.params;

    try {
        const train = await Train.findById(trainId).select('servicios');
        if (!train) {
            return res.status(404).send({ message: 'train not found' });
        }
        res.status(200).send(train.services);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Actualizar un servicio existente de un operador
router.patch('/:trainId/services/:serviceId', async (req, res) => {
    const { trainId, serviceId } = req.params;
    const serviceUpdates = req.body;

    try {
        const train = await Train.findById(trainId);
        if (!train) {
            return res.status(404).send({ message: 'train not found' });
        }

        const service = train.services.id(serviceId);
        if (!service) {
            return res.status(404).send({ message: 'Service not found' });
        }

        // Actualizar el servicio con los nuevos datos
        service.set(serviceUpdates);

        // Guardar el operador actualizado
        await train.save();

        res.status(200).send(service);
    } catch (error) {
        res.status(400).send(error);
    }
});


router.delete('/:trainId/services/:serviceId', async (req, res) => {
    const { trainId, serviceId } = req.params;

    try {
        const result = await Train.findByIdAndUpdate(
            trainId,
            { $pull: { servicios: { _id: serviceId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send({ message: 'Train or Service not found' });
        }

        res.status(200).send({ message: 'Service deleted' });
    } catch (error) {
        res.status(400).send({ message: 'Error deleting service', error });
    }
});


module.exports = router;