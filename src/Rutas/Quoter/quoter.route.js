const express = require('express');
const router = express.Router();
const Quoter = require('../../../src/models/quoter.schema');

// Crear una nueva cotización
router.post('/', async (req, res) => {
    try {
        const quoter = new Quoter(req.body);
        await quoter.save();
        res.status(201).send(quoter);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todas las cotizaciones
router.get('/', async (req, res) => {
    try {
        const quoters = await Quoter.find();
        res.status(200).send(quoters);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener una cotización por ID
router.get('/:id', async (req, res) => {
    try {
        const quoter = await Quoter.findById(req.params.id);
        if (!quoter) {
            return res.status(404).send(boomErrors.notFound('Error, ID no válida/encontrada'));
        }
        res.status(200).send(quoter);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar una cotización por ID
router.patch('/:id', async (req, res) => {
    try {
        const quoter = await Quoter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!quoter) {
            return res.status(404).send();
        }
        res.status(200).send(quoter);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar una cotización por ID
router.delete('/:id', async (req, res) => {
    try {
        const quoter = await Quoter.findByIdAndDelete(req.params.id);
        if (!quoter) {
            return res.status(404).send();
        }
        res.status(200).send(quoter);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;