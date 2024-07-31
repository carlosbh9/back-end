const express = require('express');
const router = express.Router();
const Operator = require('../../../src/models/operators.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const operator = new Operator(req.body);
        await operator.save();
        res.status(201).send(operator);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const operators = await Operator.find();
        res.status(200).send(operators);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const operator = await Operator.findById(req.params.id);
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un operador por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const operator = await Operator.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const operator = await Operator.findByIdAndDelete(req.params.id);
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(500).send(error);
    }
});

//crear un nuevo servicio
router.post('/:operatorId/services', async (req, res) => {
    const { operatorId } = req.params;
    const newService = req.body;

    try {
        const operator = await Operator.findById(operatorId);
        if (!operator) {
            return res.status(404).send({ message: 'Operator not found' });
        }
        operator.servicios.push(newService);
        await operator.save();
        res.status(201).send(newService);
    } catch (error) {
        res.status(400).send(error);
    }
});

//obtener los servicios
router.get('/:operatorId/services', async (req, res) => {
    const { operatorId } = req.params;

    try {
        const operator = await Operator.findById(operatorId).select('servicios');
        if (!operator) {
            return res.status(404).send({ message: 'Operator not found' });
        }
        res.status(200).send(operator.servicios);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Actualizar un servicio existente de un operador
router.patch('/:operatorId/services/:serviceId', async (req, res) => {
    const { operatorId, serviceId } = req.params;
    const serviceUpdates = req.body;

    try {
        const operator = await Operator.findById(operatorId);
        if (!operator) {
            return res.status(404).send({ message: 'Operator not found' });
        }

        const service = operator.servicios.id(serviceId);
        if (!service) {
            return res.status(404).send({ message: 'Service not found' });
        }

        // Actualizar el servicio con los nuevos datos
        service.set(serviceUpdates);

        // Guardar el operador actualizado
        await operator.save();

        res.status(200).send(service);
    } catch (error) {
        res.status(400).send(error);
    }
});
// //actualizar un servicio
// router.patch('/:operatorId/services/:serviceId', async (req, res) => {
//     const { operatorId, serviceId } = req.params;
//     try {
//         const operator = await Operator.findById(operatorId);
//         if (!operator) {
//             return res.status(404).send({ message: 'Operator not found' });
//         }
//         const service = operator.servicios.findById(serviceId);
//         if (!service) {
//             return res.status(404).send({ message: 'Service not found' });
//         }
//         res.status(200).send(service);
//     } catch (error) {
//         res.status(400).send(error);
//     }
// });

router.delete('/:operatorId/services/:serviceId', async (req, res) => {
    const { operatorId, serviceId } = req.params;

    try {
        const result = await Operator.findByIdAndUpdate(
            operatorId,
            { $pull: { servicios: { _id: serviceId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send({ message: 'Operator or Service not found' });
        }

        res.status(200).send({ message: 'Service deleted' });
    } catch (error) {
        res.status(400).send({ message: 'Error deleting service', error });
    }
});


module.exports = router;